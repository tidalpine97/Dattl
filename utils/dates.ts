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
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(LOCALE, DATE_FORMAT);
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
