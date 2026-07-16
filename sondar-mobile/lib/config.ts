import Constants from 'expo-constants';

function getDevHost() {
  const hostUri = Constants.expoConfig?.hostUri;
  return hostUri?.split(':')[0] || 'localhost';
}

function isLocalHost(host: string) {
  return host === 'localhost'
    || host === '127.0.0.1'
    || /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

function getDevApiUrl() {
  const host = getDevHost();
  if (isLocalHost(host)) {
    return `http://${host}:3000`;
  }

  return `https://${host}`;
}

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || getDevApiUrl()
).replace(/\/$/, '');

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const IS_SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

