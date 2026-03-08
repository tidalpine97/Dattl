import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

// Central definition of an item — imported by any screen that needs it.
export type Item = {
  id: string;
  name: string;
  expiryDate: string;      // ISO string — AsyncStorage only holds strings, not Date objects
  dateAdded?: string;      // ISO string — set when the item is first created.
                           // Optional so older items without this field still load cleanly.
  notificationId?: string;  // Items: single expiry-day notification ID.
  notificationIds?: string[]; // Subscriptions: up to 7 notification IDs (one per warning day).
};

// ─── Storage ──────────────────────────────────────────────────────────────────

// Returns the saved list, or an empty array if nothing is stored yet.
export async function loadItems(key = 'dattl_items'): Promise<Item[]> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

// Serialises the full item array and overwrites storage.
// We always store the complete list, not diffs.
export async function saveItems(items: Item[], key = 'dattl_items'): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(items));
}
