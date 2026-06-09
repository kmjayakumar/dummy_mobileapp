import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../../constants/colors';

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  // Tab bar height accounts for the home indicator / gesture nav bar on Android.
  // The screenOptions object is built here (not at module level) because it
  // depends on the runtime `insets` value.
  const tabBarStyle = {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 60 + insets.bottom,
    paddingBottom: insets.bottom + 4,
    paddingTop: 8,
    // Elevation 0 removes the Android shadow that can cause a visual seam.
    elevation: 0,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        // Disable the tab press animation ripple on Android —
        // it can look out of place on dark themes.
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: 'App Tools',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="hammer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
