import Constants from 'expo-constants';

function getDevHost() {
  const hostUri = Constants.expoConfig?.hostUri;
  return hostUri?.split(':')[0] || 'localhost';
}

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || `http://${getDevHost()}:3000`
).replace(/\/$/, '');

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const IS_SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

