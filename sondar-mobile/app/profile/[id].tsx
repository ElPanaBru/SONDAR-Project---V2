import { useLocalSearchParams } from 'expo-router';
import { ProfileView } from '@/components/profile-view';
export default function PublicProfileScreen() { const { id } = useLocalSearchParams<{ id: string }>(); return <ProfileView identifier={id} />; }
