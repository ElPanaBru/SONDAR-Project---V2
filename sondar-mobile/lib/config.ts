import Constants from 'expo-constants';

function isLocalHostName(hostname: string) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
}

function normalizeDevUrl(value?: string | null) {
  if (!value) return '';

  const raw = String(value).trim();
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `http://${raw}`;

  try {
    const url = new URL(withProtocol);
    if (!url.hostname || !['http:', 'https:', 'exp:', 'exps:'].includes(url.protocol)) return '';

    const protocol = url.protocol === 'https:' || url.protocol === 'exps:' || !isLocalHostName(url.hostname)
      ? 'https:'
      : 'http:';
    return `${protocol}//${url.host}`;
  } catch {
    return '';
  }
}

function getDevServerUrl() {
  const constants = Constants as typeof Constants & {
    manifest?: { debuggerHost?: string; hostUri?: string };
    manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
  };
  const serverUrl = [
    Constants.expoConfig?.hostUri,
    constants.manifest2?.extra?.expoClient?.hostUri,
    constants.manifest?.debuggerHost,
    constants.manifest?.hostUri,
    Constants.linkingUri,
    Constants.experienceUrl,
  ].map(normalizeDevUrl).find(Boolean);

  return serverUrl || 'http://localhost:8081';
}

function getDevApiUrl() {
  // The phone already reached this host to download the Expo bundle. Keeping
  // API requests on that same origin lets Metro proxy /api to the local
  // backend without exposing port 3000 to the LAN.
  return getDevServerUrl();
}

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || getDevApiUrl()
).replace(/\/$/, '');

export const IS_LOCAL_SUPABASE = process.env.EXPO_PUBLIC_SUPABASE_LOCAL === 'true';
export const SUPABASE_URL = IS_LOCAL_SUPABASE
  ? `${getDevServerUrl()}/supabase`
  : process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const IS_SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Storage guarda URLs de la PC. En el telefono se accede por el mismo Expo
// que entrego el bundle, tanto en LAN como mediante tunnel.
export function localMediaUrl(value: string) {
  if (!IS_LOCAL_SUPABASE) return value;
  try {
    const url = new URL(value);
    const local = ['127.0.0.1', 'localhost'].includes(url.hostname);
    const configured = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:55321');
    if (local && url.port === configured.port && url.pathname.startsWith('/storage/v1/')) {
      return `${SUPABASE_URL}${url.pathname}${url.search}`;
    }
  } catch { /* El valor puede ser texto o una ruta relativa. */ }
  return value;
}

