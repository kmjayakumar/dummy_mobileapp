import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { ShareIntentProvider } from '../context/ShareIntentContext';
import ShareIntentHandler from '../components/ShareIntentHandler';

const ROOT_SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'slide_from_right',
  animationDuration: 200,
};

export default function RootLayout() {
  useEffect(() => {
    // Apply imperatively so it takes effect immediately on every mount,
    // regardless of what any child screen may do.
    // 'light-content' = white icons (time, battery, signal) on dark background.
    StatusBar.setBarStyle('light-content', true);
    StatusBar.setBackgroundColor('#0F0F0F', true);
    StatusBar.setTranslucent(false);
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ShareIntentProvider>
          {/*
            ShareIntentHandler sits inside the provider tree so it has access
            to ShareIntentContext.  It watches expo-router params at the root
            level — the highest point where params are reliably available —
            and handles cold-start, foreground, and background-wake intents.
          */}
          <ShareIntentHandler />
          <Stack screenOptions={ROOT_SCREEN_OPTIONS}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="tabs" />
          </Stack>
        </ShareIntentProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
