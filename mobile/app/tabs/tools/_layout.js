import { Stack } from 'expo-router';
import Colors from '../../../constants/colors';

export default function ToolsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600', fontSize: 17 },
        headerShadowVisible: false,
        headerBackTitle: 'Tools',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="audio-converter" options={{ title: 'Audio Converter' }} />
      <Stack.Screen name="converted-files" options={{ title: 'Converted Files' }} />
    </Stack>
  );
}
