import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Item } from './storage';
import { formatDate } from './dates';

// ─── Setup ────────────────────────────────────────────────────────────────────

/**
 * Requests notification permission from the user.
 * On Android, also creates the required notification channel.
 *
 * Safe to call multiple times — returns immediately if permission is
 * already granted without prompting the user again.
 *
 * Returns true if permission is granted, false otherwise.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  // Android 8+ requires a channel before any notification can be shown.
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

// ─── Scheduling ───────────────────────────────────────────────────────────────

/**
 * Schedules a notification for 9:00 AM on the item's expiry date.
 *
 * Returns the notification ID — store this on the item so the
 * notification can be cancelled if the item is deleted or edited.
 *
 * Returns null if the expiry date is already in the past (no point
 * scheduling a notification that would fire immediately or never).
 */
export async function scheduleExpiryNotification(item: Item): Promise<string | null> {
  const expiry = new Date(item.expiryDate);

  // Build the exact moment to fire: 9:00 AM on the expiry date.
  const fireAt = new Date(
    expiry.getFullYear(),
    expiry.getMonth(),
    expiry.getDate(),
    9, 0, 0
  );

  if (fireAt <= new Date()) return null; // date already passed — skip

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Dattl',
      body: `${item.name} expires today.`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });
}

/**
 * Cancels a previously scheduled notification.
 * Safe to call with undefined (e.g. items that were added before
 * notifications were implemented) — returns without doing anything.
 */
export async function cancelNotification(notificationId: string | undefined): Promise<void> {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

// ─── Subscription notifications ───────────────────────────────────────────────

/**
 * Schedules up to 7 daily notifications for a subscription — one each for the
 * 6 days leading up to the cancel-by date, plus one on the cancel-by date itself.
 *
 * Only future dates are scheduled (past dates are skipped silently).
 * Returns an array of notification IDs so they can all be cancelled later.
 */
export async function scheduleSubscriptionNotifications(item: Item): Promise<string[]> {
  const cancelDate = new Date(item.expiryDate);
  const ids: string[] = [];

  for (let daysAhead = 6; daysAhead >= 0; daysAhead--) {
    const fireAt = new Date(
      cancelDate.getFullYear(),
      cancelDate.getMonth(),
      cancelDate.getDate() - daysAhead,
      9, 0, 0
    );
    if (fireAt <= new Date()) continue; // already past — skip

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Dattl',
        body: `${item.name} — cancel by ${formatDate(item.expiryDate)}`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });
    ids.push(id);
  }

  return ids;
}

/**
 * Cancels all notifications scheduled for a subscription.
 * Safe to call with undefined or an empty array.
 */
export async function cancelSubscriptionNotifications(ids: string[] | undefined): Promise<void> {
  if (!ids?.length) return;
  await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id)));
}

// ─── Debug ────────────────────────────────────────────────────────────────────

/**
 * Schedules a test notification to fire 60 seconds from now.
 * Use during development to verify that notifications are working
 * without having to wait until an actual expiry date.
 * Remove or comment out before shipping to the App Store.
 */
export async function scheduleDebugNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Dattl Debug',
      body: 'Push notifications are working! 🎉',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60,
      repeats: false,
    },
  });
}
