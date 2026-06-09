import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';

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
        <Stack screenOptions={ROOT_SCREEN_OPTIONS}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="tabs" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
