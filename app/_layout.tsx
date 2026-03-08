import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated'; // must be imported in the root layout to initialise the library
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { useFonts, Poppins_800ExtraBold } from '@expo-google-fonts/poppins';

import { useColorScheme } from '@/hooks/use-color-scheme';

// Keep the splash screen visible until fonts (and any other async setup) are ready.
// Called at module level so it takes effect before the first render.
SplashScreen.preventAutoHideAsync();

// Configures how notifications behave when the app is in the foreground.
// Must be called at module level (before any notification fires).
// Without this, notifications are silently swallowed when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,  // show the banner
    shouldPlaySound: true,
    shouldSetBadge: false,  // no badge counter for V1
  }),
});

// Tells expo-router which route group is the default entry point.
// Without this, navigating to "/" would be ambiguous.
export const unstable_settings = {
  anchor: '(tabs)',
};

// Root layout — wraps the entire app. Runs once on startup.
export default function RootLayout() {
  const colorScheme = useColorScheme(); // 'light' | 'dark' — follows the phone's system setting

  // Load the Poppins ExtraBold weight used for the app title.
  // fontError lets us proceed even if the download fails — the system font
  // is used as a fallback and the app remains fully functional.
  const [fontsLoaded, fontError] = useFonts({ Poppins_800ExtraBold });

  // Hide the splash screen once fonts are ready (or have failed).
  // The two-condition guard prevents an infinite splash if the font CDN is unreachable.
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Render nothing while fonts are still loading — splash screen is still visible.
  if (!fontsLoaded && !fontError) return null;

  return (
    // GestureHandlerRootView must wrap the entire app for Swipeable (and any
    // other gesture-handler components) to work. flex:1 ensures it fills the screen.
    <GestureHandlerRootView style={{ flex: 1 }}>
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

      {/* StatusBar sits above the app content (clock, battery, signal).
          style="light" keeps icons white to contrast against the dark background. */}
      <StatusBar style="light" />
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}
