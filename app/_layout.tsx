import { Poppins_800ExtraBold, useFonts } from '@expo-google-fonts/poppins';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated'; // must be imported in the root layout to initialise the library

import { Onboarding } from '@/components/Onboarding';
import { LanguageProvider } from '@/context/language';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Sentry from '@sentry/react-native';

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <View style={errorStyles.container}>
      <Text style={errorStyles.title}>Something went wrong</Text>
      <Text style={errorStyles.message}>{error.message}</Text>
      <Pressable style={errorStyles.button} onPress={retry}>
        <Text style={errorStyles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  message: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#D97706',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});

Sentry.init({
  dsn: 'https://97ab29c8dc0596ab6567a01aaa5f3332@o4511010826420224.ingest.de.sentry.io/4511010828582992',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,
  integrations: [Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Keep the splash screen visible until fonts (and any other async setup) are ready.
// Called at module level so it takes effect before the first render.
SplashScreen.preventAutoHideAsync();

// Configures how notifications behave when the app is in the foreground.
// Must be called at module level (before any notification fires).
// Without this, notifications are silently swallowed when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

// Tells expo-router which route group is the default entry point.
// Without this, navigating to "/" would be ambiguous.
export const unstable_settings = {
  anchor: '(tabs)',
};

// Root layout — wraps the entire app. Runs once on startup.
export default Sentry.wrap(function RootLayout() {
  const colorScheme = useColorScheme(); // 'light' | 'dark' — follows the phone's system setting

  // Load the Poppins ExtraBold weight used for the app title.
  // fontError lets us proceed even if the download fails — the system font
  // is used as a fallback and the app remains fully functional.
  const [fontsLoaded, fontError] = useFonts({ Poppins_800ExtraBold });

  // null = still loading, false = not yet onboarded, true = onboarded
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('dattl_onboarded')
      .then(val => setOnboarded(val === 'false'))
      .catch(() => setOnboarded(false));
  }, []);

  // Hide the splash screen once fonts and onboarding check are both ready.
  useEffect(() => {
    if ((fontsLoaded || fontError) && onboarded !== null) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError, onboarded]);

  // Render nothing while either fonts or onboarding check is still loading.
  if ((!fontsLoaded && !fontError) || onboarded === null) return null;

  function handleOnboardingDone() {
    AsyncStorage.setItem('dattl_onboarded', 'true').catch(() => {});
    setOnboarded(true);
  }

  return (
    // GestureHandlerRootView must wrap the entire app for Swipeable (and any
    // other gesture-handler components) to work. flex:1 ensures it fills the screen.
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
      <LanguageProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>

        {/* Stack is the navigation container for the whole app.
            Each Screen here is a "page" that can be pushed onto the stack.
            (tabs) is the main page; modal is a separate overlay screen. */}
        <Stack>
          {/* The (tabs) group covers the main app — headerShown: false because
              each individual tab screen handles its own layout. */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          {/* modal.tsx is presented as a card that slides up from the bottom.
              Kept here in case it's useful for future features — not used in V1. */}
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>

        {/* Onboarding overlay — shown only on first launch, sits above the Stack */}
        {!onboarded && <Onboarding onDone={handleOnboardingDone} />}

        {/* StatusBar sits above the app content (clock, battery, signal).
            style="light" keeps icons white to contrast against the dark background. */}
        <StatusBar style="light" />
      </ThemeProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );
});
