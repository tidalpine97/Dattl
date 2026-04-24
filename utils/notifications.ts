import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import type { Item } from './storage';

// ─── Time constants ────────────────────────────────────────────────────────────

export const NOTIF_TIME_MORNING       = '09:00';
export const NOTIF_TIME_EVENING       = '17:00';
export const NOTIF_TIME_SUBSCRIPTIONS = '10:00';

const ITEM_NOTIF_IDS_KEY    = 'dattl_notif_item_ids';
const SCHEDULE_HORIZON_DAYS = 90;
const IOS_NOTIF_LIMIT       = 64;

// ─── Setup ────────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Dattl',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

// Parses "YYYY-MM-DD..." as local midnight, not UTC midnight.
// new Date("2026-04-24") → UTC midnight → 22:00 local in UTC+2 (yesterday!).
// This fix ensures today's items are never treated as past-dated.
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function parseTime(timeStr: string): { hour: number; minute: number } {
  const [h, m] = timeStr.split(':').map(Number);
  return { hour: h ?? 9, minute: m ?? 0 };
}

function buildFireDate(baseDate: Date, timeStr: string): Date {
  const { hour, minute } = parseTime(timeStr);
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hour, minute, 0);
}

function isoDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildMorningBody(items: Item[]): string {
  if (items.length === 1) return `🟡 ${items[0].name} expires today`;
  if (items.length === 2) return `🟡 ${items[0].name}, ${items[1].name} expire today`;
  return `🟡 ${items[0].name}, ${items[1].name} and ${items.length - 2} more expire today`;
}

// ─── Item notifications (batch per day) ───────────────────────────────────────

let isReschedulingItems = false;

export async function rescheduleAllItemNotifications(items: Item[]): Promise<void> {
  if (isReschedulingItems) return;
  isReschedulingItems = true;
  try {
    // Cancel all previously scheduled item notifications
    const storedIds = await AsyncStorage.getItem(ITEM_NOTIF_IDS_KEY);
    const oldIds: string[] = storedIds ? JSON.parse(storedIds) : [];
    await Promise.all(oldIds.map(id =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    ));

    const granted = await requestNotificationPermission();
    if (!granted) return;

    // Load time settings
    const [savedMorning, savedEvening] = await Promise.all([
      AsyncStorage.getItem('notif_time_morning'),
      AsyncStorage.getItem('notif_time_evening'),
    ]);
    const morningTime = savedMorning ?? NOTIF_TIME_MORNING;
    const eveningTime = savedEvening ?? NOTIF_TIME_EVENING;

    // Group items by expiry date within the scheduling horizon.
    // Use parseLocalDate so "2026-04-24" → local midnight, not UTC midnight.
    const today = new Date();
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + SCHEDULE_HORIZON_DAYS);

    const byDay = new Map<string, Item[]>();
    for (const item of items) {
      const expiry = parseLocalDate(item.expiryDate);
      if (expiry < today || expiry > horizon) continue;
      const key = isoDateKey(expiry);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(item);
    }

    const newIds: string[] = [];
    let scheduled = 0;
    // 60-second buffer guards against race conditions at the exact current minute.
    const nowPlus60 = new Date(Date.now() + 60_000);

    for (const [key, dayItems] of [...byDay.entries()].sort()) {
      if (scheduled >= IOS_NOTIF_LIMIT - 1) break;

      const expiryDate = parseLocalDate(key);

      // Morning notification on expiry day
      const morningAt = buildFireDate(expiryDate, morningTime);
      if (morningAt > nowPlus60 && scheduled < IOS_NOTIF_LIMIT) {
        const id = await Notifications.scheduleNotificationAsync({
          content: { title: 'Dattl', body: buildMorningBody(dayItems) },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: morningAt },
        });
        newIds.push(id);
        scheduled++;
      }

      // Evening D-1 warning (the evening before expiry)
      const prevDay = new Date(expiryDate);
      prevDay.setDate(prevDay.getDate() - 1);
      const eveningAt = buildFireDate(prevDay, eveningTime);
      if (eveningAt > nowPlus60 && scheduled < IOS_NOTIF_LIMIT) {
        const count = dayItems.length;
        const body = count === 1
          ? `Tomorrow ${dayItems[0].name} expires — time to shop?`
          : `Tomorrow ${count} products expire — time to shop?`;
        const id = await Notifications.scheduleNotificationAsync({
          content: { title: 'Dattl', body },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: eveningAt },
        });
        newIds.push(id);
        scheduled++;
      }
    }

    await AsyncStorage.setItem(ITEM_NOTIF_IDS_KEY, JSON.stringify(newIds));
  } catch (e) {
    Sentry.captureException(e);
    console.error('[Notifications] rescheduleAllItemNotifications failed:', e);
    // Never rethrow — notification failure must not crash the app.
  } finally {
    isReschedulingItems = false;
  }
}

// ─── Subscription notifications (per item, 7-day + 1-day) ────────────────────

export async function scheduleSubscriptionNotifications(item: Item): Promise<string[]> {
  const saved = await AsyncStorage.getItem('notif_time_subscriptions');
  const time = saved ?? NOTIF_TIME_SUBSCRIPTIONS;

  const renewDate = parseLocalDate(item.expiryDate);
  const nowPlus60 = new Date(Date.now() + 60_000);
  const ids: string[] = [];

  for (const daysAhead of [7, 1]) {
    const fireDate = new Date(renewDate);
    fireDate.setDate(fireDate.getDate() - daysAhead);
    const fireAt = buildFireDate(fireDate, time);
    if (fireAt <= nowPlus60) continue;

    const body = daysAhead === 7
      ? `📅 ${item.name} renews in 7 days — still time to cancel`
      : `⚠️ ${item.name} renews tomorrow`;

    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'Dattl', body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
    ids.push(id);
  }

  return ids;
}

export async function cancelSubscriptionNotifications(ids: string[] | undefined): Promise<void> {
  if (!ids?.length) return;
  await Promise.all(ids.map(id =>
    Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
  ));
}

let isReschedulingSubscriptions = false;

// Cancels and reschedules all subscriptions; returns updated items with new notification IDs.
export async function rescheduleAllSubscriptionNotifications(subscriptions: Item[]): Promise<Item[]> {
  if (isReschedulingSubscriptions) return subscriptions;
  isReschedulingSubscriptions = true;
  try {
    const updated: Item[] = [];
    for (const sub of subscriptions) {
      await cancelSubscriptionNotifications(sub.notificationIds);
      const ids = await scheduleSubscriptionNotifications(sub);
      updated.push({ ...sub, notificationIds: ids.length ? ids : undefined });
    }
    return updated;
  } catch (e) {
    Sentry.captureException(e);
    console.error('[Notifications] rescheduleAllSubscriptionNotifications failed:', e);
    return subscriptions; // return originals unchanged on failure
  } finally {
    isReschedulingSubscriptions = false;
  }
}

// Kept for legacy compatibility (no-op if ID is missing).
export async function cancelNotification(notificationId: string | undefined): Promise<void> {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}
