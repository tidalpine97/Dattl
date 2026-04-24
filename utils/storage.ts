import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ItemCategory =
  | 'fridge'
  | 'freezer'
  | 'pantry'
  | 'medicine'
  | 'cosmetics'
  | 'household'
  | 'other';

// Central definition of an item — imported by any screen that needs it.
export type Item = {
  id: string;
  name: string;
  expiryDate: string;      // ISO string — AsyncStorage only holds strings, not Date objects
  dateAdded?: string;      // ISO string — set when the item is first created.
                           // Optional so older items without this field still load cleanly.
  notificationId?: string;    // Items: kept for legacy; batch notifications now tracked separately.
  notificationIds?: string[]; // Subscriptions: up to 2 notification IDs (7-day + 1-day warning).
  longerUsableHint?: string;   // German hint — set when added via lookup; shown on expired cards.
  longerUsableHintEn?: string; // English counterpart.
  category?: ItemCategory;     // Storage category; defaults to 'other' on first load for legacy items.
};

// ─── Storage ──────────────────────────────────────────────────────────────────

// Returns the saved list, or an empty array if nothing is stored yet.
// Migrates legacy items missing a category to 'other'.
export async function loadItems(key = 'dattl_items'): Promise<Item[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  const items: Item[] = JSON.parse(raw);
  return items.map(item => ({ ...item, category: item.category ?? 'other' }));
}

// Serialises the full item array and overwrites storage.
// We always store the complete list, not diffs.
export async function saveItems(items: Item[], key = 'dattl_items'): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(items));
}
