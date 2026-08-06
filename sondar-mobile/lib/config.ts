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
    const protocol = url.protocol === 'https:' || !isLocalHostName(url.hostname)
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

function getBackendUrlFromDevServer(serverUrl: string) {
  try {
    const url = new URL(serverUrl);
    if (isLocalHostName(url.hostname)) {
      url.port = process.env.EXPO_PUBLIC_API_PORT || '3000';
      return `${url.protocol}//${url.host}`;
    }
  } catch {
    return serverUrl;
  }

  return serverUrl;
}

function getDevApiUrl() {
  return getBackendUrlFromDevServer(getDevServerUrl());
}

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || getDevApiUrl()
).replace(/\/$/, '');

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const IS_SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

