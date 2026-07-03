import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';

const icons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  index: 'calendar', discover: 'play-circle', search: 'search', community: 'people', profile: 'person-circle',
};

export default function TabLayout() {
  const { loading, user } = useAuth();
  if (loading) return <View style={styles.loading}><ActivityIndicator color={palette.orange} size="large" /></View>;
  if (!user) return <Redirect href="/auth" />;

  return (
    <Tabs screenOptions={({ route }) => ({
      headerShown: false,
      sceneStyle: { backgroundColor: palette.bg },
      tabBarActiveTintColor: palette.orange,
      tabBarInactiveTintColor: palette.muted,
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.label,
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? icons[route.name] : `${icons[route.name]}-outline` as any} color={color} size={size + 1} />,
    })}>
      <Tabs.Screen name="index" options={{ title: 'Eventos' }} />
      <Tabs.Screen name="discover" options={{ title: 'Descubrir' }} />
      <Tabs.Screen name="search" options={{ title: 'Buscar' }} />
      <Tabs.Screen name="community" options={{ title: 'Comunidad' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' },
  tabBar: { position: 'absolute', height: 72, paddingTop: 7, paddingBottom: 10, backgroundColor: '#101217F5', borderTopColor: palette.border },
  label: { fontSize: 10, fontWeight: '700' },
});
