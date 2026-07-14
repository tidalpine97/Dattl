// ─── Locale & format ──────────────────────────────────────────────────────────

// Defined once here so every date display in the app is consistent.
// de-AT produces DD.MM.YYYY — Austrian/European convention.
export const LOCALE = 'de-AT';

export const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Type-narrowing validity check for Date objects.
// Use this anywhere a Date crosses into a native bridge (DateTimePicker,
// expo-notifications). iOS 26 made these surfaces strict — an Invalid Date
// triggers an NSInternalInconsistencyException instead of being coerced.
export function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Builds a local-midnight Date, rejecting out-of-range parts. `new Date(y, m, d)`
// happily rolls over (Feb 31 → Mar 3) and remaps years 0-99 into the 1900s, so
// round-trip the fields back out and reject anything that moved.
function localMidnight(year: number, month: number, day: number): Date {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date(NaN);
  }
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return new Date(NaN);
  }
  return d;
}

// Resolves a stored date string to the local calendar day it represents.
//
// Item.expiryDate is written with `.toISOString()`, so it is a full UTC
// timestamp ("2026-04-24T21:08:53.729Z"), not a bare "YYYY-MM-DD". Both shapes
// have to work, and each needs the opposite treatment:
//
//   • Full ISO — parse the instant, then read its LOCAL fields. Slicing the
//     first 10 characters would read the UTC day, which is the previous day for
//     any local time before the UTC offset (00:30 in UTC+2 → "...T22:30Z" on
//     the day before).
//   • Bare "YYYY-MM-DD" — build from the parts directly. `new Date("2026-04-24")`
//     is defined as UTC midnight, which lands on the previous day in any
//     negative-offset zone.
//
// Returns an Invalid Date for anything unparseable; callers must check with
// isValidDate before letting the result reach a native module.
export function parseLocalDate(value: string | null | undefined): Date {
  if (typeof value !== 'string') return new Date(NaN);
  const s = value.trim();

  const parts = DATE_ONLY_RE.exec(s);
  if (parts) {
    return localMidnight(Number(parts[1]), Number(parts[2]), Number(parts[3]));
  }

  const instant = new Date(s);
  if (!isValidDate(instant)) return new Date(NaN);
  return localMidnight(instant.getFullYear(), instant.getMonth() + 1, instant.getDate());
}

// Forces a date into [min, max], substituting `new Date()` for an invalid input.
//
// iOS 26's date picker (UIDatePicker in `inline` style) is backed by
// UICalendarView, which asserts rather than clamps when its selected date falls
// outside its range: NSInternalInconsistencyException, "Invalid state. Unable to
// find a lower bounds in range." Older iOS silently ignored the same input. Every
// `value` handed to a bounded DateTimePicker must go through here.
//
// Returns the `min`/`max` object itself when clamping, so a caller passing stable
// bounds gets a stable prop identity back rather than a fresh Date each render.
export function clampDate(value: unknown, min?: Date, max?: Date): Date {
  const lo = isValidDate(min) ? min : undefined;
  const hi = isValidDate(max) ? max : undefined;
  const d  = isValidDate(value) ? value : new Date();

  // A degenerate range (min > max) has no satisfying value and would itself trip
  // the assertion. Prefer the lower bound and let the caller's bounds be wrong.
  if (lo && hi && lo.getTime() > hi.getTime()) return lo;
  if (lo && d.getTime() < lo.getTime()) return lo;
  if (hi && d.getTime() > hi.getTime()) return hi;
  return d;
}

// Today at 23:59:59.999, local. Used as the picker's upper bound so it stays
// valid for the whole day rather than going stale the moment it is created.
export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

// How many days between today and the expiry date.
// Returns a negative number if the item has already expired.
// Both dates are floored to midnight so the result is always a whole day,
// not a fraction depending on what time it currently is.
export function getDaysUntilExpiry(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(isoDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Formats an ISO date string for display using the shared locale and format.
// Pass a locale override when the app language differs from the default.
export function formatDate(isoDate: string, locale = LOCALE): string {
  return new Date(isoDate).toLocaleDateString(locale, DATE_FORMAT);
}

// Human-readable relative label for the days-remaining value.
// Used on each list card to give an at-a-glance status.
export function getExpiryLabel(daysLeft: number): string {
  if (daysLeft === 0)  return 'expires today';
  if (daysLeft === 1)  return 'expires tomorrow';
  if (daysLeft > 1)    return `expires in ${daysLeft} days`;
  if (daysLeft === -1) return 'expired yesterday';
  return `expired ${Math.abs(daysLeft)} days ago`;
}

// Same shape but for subscription cancel-by dates.
export function getSubscriptionLabel(daysLeft: number): string {
  if (daysLeft === 0)  return 'cancel today';
  if (daysLeft === 1)  return 'cancel tomorrow';
  if (daysLeft > 1)    return `cancel in ${daysLeft} days`;
  if (daysLeft === -1) return 'overdue by 1 day';
  return `overdue by ${Math.abs(daysLeft)} days`;
}
