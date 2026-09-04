import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { palette } from '@/constants/sondar';
import { AuthProvider } from '@/contexts/auth';

const sondarTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: palette.bg, card: palette.surface, border: palette.border, primary: palette.orange, text: palette.text },
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={sondarTheme}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
            <Stack.Screen name="messages" options={{ presentation: 'card' }} />
            <Stack.Screen name="settings" options={{ presentation: 'card' }} />
            <Stack.Screen name="support" options={{ presentation: 'card' }} />
            <Stack.Screen name="profile/[id]" options={{ presentation: 'card' }} />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
