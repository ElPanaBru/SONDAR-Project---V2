import { Redirect, useLocalSearchParams } from 'expo-router';
import { ProfileView } from '@/components/profile-view';
import { Loading, Screen } from '@/components/sondar-ui';
import { useAuth } from '@/contexts/auth';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading } = useAuth();
  if (loading) return <Screen><Loading /></Screen>;
  if (user && id === user.id) return <Redirect href="/(tabs)/profile" />;
  return <ProfileView identifier={id} />;
}
