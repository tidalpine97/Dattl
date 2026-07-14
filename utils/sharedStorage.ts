import * as WidgetBridge from '@/modules/dattl-widget-bridge';
import type { Lang } from '@/context/language';
import { isValidDate, parseLocalDate } from './dates';
import type { Item } from './storage';

// ─────────────────────────────────────────────────────────────────────────────
// Widget bridge — the JS side.
//
// The WidgetKit extension runs as its own process and cannot read this app's
// AsyncStorage, so everything it renders comes from the snapshot written here
// into the shared App Group container.
//
// Two invariants hold this together:
//
//   • Dates cross as local calendar days ("2026-07-18"), never as the raw UTC
//     timestamps Item.expiryDate actually holds. expiryDate is written with
//     .toISOString(), so reading its day in the wrong zone lands a day off —
//     the hazard utils/dates.ts exists to contain. Resolving it here with
//     parseLocalDate means the Swift side never does timezone maths.
//
//   • Days-remaining is deliberately NOT precomputed. The widget derives it
//     from these dates against its own clock, so its numbers stay correct as it
//     crosses midnight even if the app is never opened.
//
// Keep the snapshot shape in sync with the Snapshot struct in
// targets/widget/index.swift.
// ─────────────────────────────────────────────────────────────────────────────

const SNAPSHOT_VERSION = 1;

// The widget shows at most five rows but also reports how many items are due
// this week, so it needs more than five to count honestly. Forty rows is still
// only a couple of KB in UserDefaults.
const MAX_SNAPSHOT_ITEMS = 40;

type SnapshotItem = {
  id: string;
  name: string;
  expiry: string; // local calendar day, YYYY-MM-DD
};

type WidgetSnapshot = {
  v: number;
  lang: Lang;
  items: SnapshotItem[];
};

function toLocalDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Called on every item add / edit / delete. Never throws: a stale widget is a
// much smaller problem than a save that fails because of one.
export function syncWidgetItems(items: Item[], lang: Lang = 'en'): void {
  if (!WidgetBridge.isAvailable) return;

  try {
    const rows = items
      .map(item => {
        const expiry = parseLocalDate(item.expiryDate);
        if (!isValidDate(expiry)) return null;
        return { id: item.id, name: item.name, expiry: toLocalDayKey(expiry) };
      })
      .filter((row): row is SnapshotItem => row !== null)
      // YYYY-MM-DD sorts chronologically as a plain string.
      .sort((a, b) => a.expiry.localeCompare(b.expiry))
      .slice(0, MAX_SNAPSHOT_ITEMS);

    const snapshot: WidgetSnapshot = { v: SNAPSHOT_VERSION, lang, items: rows };
    WidgetBridge.setSnapshot(JSON.stringify(snapshot));
  } catch (e) {
    console.error('Failed to sync widget snapshot:', e);
  }
}
