import { Button, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

export default function SettingsTab() {
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.logo}>Dattl</Text>
      <Text style={styles.version}>Version {version}</Text>
      {/* TODO: remove before App Store submission */}
      <Button title="Test Sentry" onPress={() => Sentry.captureException(new Error('First error'))} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 56,
    color: '#D97706',
    letterSpacing: -1,
  },
  version: {
    fontSize: 14,
    color: '#888888',
    marginTop: 8,
  },
});
