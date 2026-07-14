import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type DattlWidgetBridge = {
  setSnapshot(json: string): void;
};

// Optional, not required: the native module only exists in a custom dev client
// or release build. In Expo Go, on Android, and on web it resolves to null and
// every call below turns into a no-op rather than a crash.
const native = requireOptionalNativeModule<DattlWidgetBridge>('DattlWidgetBridge');

export const isAvailable = Platform.OS === 'ios' && native != null;

/** Hands the serialised snapshot to the shared App Group container. */
export function setSnapshot(json: string): void {
  if (!isAvailable) return;
  native!.setSnapshot(json);
}
