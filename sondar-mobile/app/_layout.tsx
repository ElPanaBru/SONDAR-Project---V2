import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { palette } from '@/constants/sondar';
import { AuthProvider, useAuth } from '@/contexts/auth';

const sondarTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: palette.bg, card: palette.surface, border: palette.border, primary: palette.orange, text: palette.text },
};

function SessionStack() {
  const { loading, user } = useAuth();
  if (loading) return null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
      <Stack.Protected guard={Boolean(user)}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
        <Stack.Screen name="messages" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings" options={{ presentation: 'card' }} />
        <Stack.Screen name="support" options={{ presentation: 'card' }} />
        <Stack.Screen name="profile/[id]" options={{ presentation: 'card' }} />
      </Stack.Protected>
      <Stack.Screen name="auth" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={sondarTheme}>
          <SessionStack />
          <StatusBar style="light" />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
