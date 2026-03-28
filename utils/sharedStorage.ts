import { NativeModules, Platform } from 'react-native';
import type { Item } from './storage';

// Only the fields the widget needs — keep the payload small.
type WidgetItem = {
  id: string;
  name: string;
  expiryDate: string;
};

const { DattlSharedStorage } = NativeModules;

/**
 * Writes the current item list to the iOS App Group UserDefaults so the
 * home-screen widget can read it.  No-ops silently on Android or when the
 * native module isn't linked yet.
 */
export function syncWidgetItems(items: Item[]): void {
  if (Platform.OS !== 'ios' || !DattlSharedStorage?.writeItems) return;

  const payload: WidgetItem[] = items.map(({ id, name, expiryDate }) => ({
    id,
    name,
    expiryDate,
  }));

  DattlSharedStorage.writeItems(JSON.stringify(payload));
}
