import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import type { Item } from './storage';
import { isValidDate, parseLocalDate } from './dates';

// ─── Time constants ────────────────────────────────────────────────────────────

export const NOTIF_TIME_MORNING       = '09:00';
export const NOTIF_TIME_EVENING       = '17:00';
export const NOTIF_TIME_SUBSCRIPTIONS = '10:00';

const ITEM_NOTIF_IDS_KEY    = 'dattl_notif_item_ids';
const SCHEDULE_HORIZON_DAYS = 90;
const IOS_NOTIF_LIMIT       = 64;

// Nothing legitimately schedules further out than the horizon plus a year of
// slack. A fire date beyond this means the source data is corrupt (a bad year,
// a rolled-over month), not that the user owns very long-life yoghurt.
const MAX_SCHEDULE_AHEAD_MS = (SCHEDULE_HORIZON_DAYS + 365) * 24 * 60 * 60 * 1000;

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

// The one gate every Date must pass before it crosses the expo-notifications
// bridge. expo-modules-core casts `trigger.date` to a Swift `Date` on the
// AsyncFunctionQueue; an Invalid Date arrives as NaN, fails that cast and takes
// the process down natively. A JS try/catch around scheduleNotificationAsync
// does NOT catch it — the throw happens in Swift, not in JS — so the date has to
// be rejected here, before the call, rather than handled after it.
//
// `notBefore` carries a 60s buffer: a trigger in the past (or firing this very
// minute) is rejected outright rather than handed to UNCalendarNotificationTrigger.
function isSchedulable(date: Date, notBefore: Date, context: string): boolean {
  if (!isValidDate(date)) {
    Sentry.captureMessage(`[Notifications] rejected invalid fire date (${context})`);
    return false;
  }
  const ms = date.getTime();
  if (ms <= notBefore.getTime()) return false; // in the past — nothing to schedule
  if (ms > notBefore.getTime() + MAX_SCHEDULE_AHEAD_MS) {
    Sentry.captureMessage(`[Notifications] rejected out-of-range fire date (${context}): ${date.toISOString()}`);
    return false;
  }
  return true;
}

function parseTime(timeStr: string): { hour: number; minute: number } {
  const [h, m] = (timeStr ?? '').split(':').map(Number);
  const hour   = Number.isFinite(h) && h >= 0 && h <= 23 ? h : 9;
  const minute = Number.isFinite(m) && m >= 0 && m <= 59 ? m : 0;
  return { hour, minute };
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

// Reschedules read-modify-write ITEM_NOTIF_IDS_KEY, so two overlapping runs would
// interleave their cancel/schedule passes and leak orphaned notification IDs.
// They must not overlap — but the previous guard was a boolean that made a
// concurrent call return immediately, silently DROPPING it. That lost real
// updates: a time change in Settings landing while ListScreen's mount-effect
// reschedule was still in flight was simply discarded, and the new time never
// took effect until the next reschedule.
//
// Serialize instead of dropping: queue the call behind the in-flight one so it
// still runs, just not concurrently. Callers get a promise that settles when
// *their* run is done.
let itemQueue: Promise<void> = Promise.resolve();

export function rescheduleAllItemNotifications(items: Item[]): Promise<void> {
  itemQueue = itemQueue.catch(() => {}).then(() => runRescheduleAllItemNotifications(items));
  return itemQueue;
}

async function runRescheduleAllItemNotifications(items: Item[]): Promise<void> {
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
      if (!isValidDate(expiry)) {
        Sentry.captureMessage(`Item ${item.id} has invalid expiryDate "${item.expiryDate}"`);
        continue;
      }
      if (expiry < today || expiry > horizon) continue;
      const key = isoDateKey(expiry);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(item);
    }

    const newIds: string[] = [];
    let scheduled = 0;
    // 60-second buffer guards against a trigger landing in the current minute.
    const nowPlus60 = new Date(Date.now() + 60_000);

    for (const [key, dayItems] of [...byDay.entries()].sort()) {
      if (scheduled >= IOS_NOTIF_LIMIT - 1) break;

      const expiryDate = parseLocalDate(key);

      // Morning notification on expiry day
      const morningAt = buildFireDate(expiryDate, morningTime);
      if (isSchedulable(morningAt, nowPlus60, `item morning ${key}`) && scheduled < IOS_NOTIF_LIMIT) {
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
      if (isSchedulable(eveningAt, nowPlus60, `item evening ${key}`) && scheduled < IOS_NOTIF_LIMIT) {
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
    // Catches JS-level failures only (AsyncStorage, permissions). A native
    // Objective-C exception raised inside expo-notifications does not surface
    // here — see isSchedulable().
    Sentry.captureException(e);
    console.error('[Notifications] rescheduleAllItemNotifications failed:', e);
    // Never rethrow — notification failure must not crash the app.
  }
}

// ─── Subscription notifications (per item, 7-day + 1-day) ────────────────────

export async function scheduleSubscriptionNotifications(item: Item): Promise<string[]> {
  const saved = await AsyncStorage.getItem('notif_time_subscriptions');
  const time = saved ?? NOTIF_TIME_SUBSCRIPTIONS;

  const renewDate = parseLocalDate(item.expiryDate);
  if (!isValidDate(renewDate)) {
    Sentry.captureMessage(`Subscription ${item.id} has invalid expiryDate "${item.expiryDate}"`);
    return [];
  }
  const nowPlus60 = new Date(Date.now() + 60_000);
  const ids: string[] = [];

  for (const daysAhead of [7, 1]) {
    const fireDate = new Date(renewDate);
    fireDate.setDate(fireDate.getDate() - daysAhead);
    const fireAt = buildFireDate(fireDate, time);
    if (!isSchedulable(fireAt, nowPlus60, `subscription ${item.id} D-${daysAhead}`)) continue;

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

// Serialized for the same reason as the item queue above: overlapping runs would
// cancel IDs the other run had just scheduled. Queued, not dropped, so a caller
// never silently loses its update.
let subscriptionQueue: Promise<unknown> = Promise.resolve();

// Cancels and reschedules all subscriptions; returns updated items with new notification IDs.
export function rescheduleAllSubscriptionNotifications(subscriptions: Item[]): Promise<Item[]> {
  const next = subscriptionQueue
    .catch(() => {})
    .then(() => runRescheduleAllSubscriptionNotifications(subscriptions));
  subscriptionQueue = next;
  return next;
}

async function runRescheduleAllSubscriptionNotifications(subscriptions: Item[]): Promise<Item[]> {
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
  }
}

// Kept for legacy compatibility (no-op if ID is missing).
export async function cancelNotification(notificationId: string | undefined): Promise<void> {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}
