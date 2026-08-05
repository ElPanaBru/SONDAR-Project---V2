import { API_URL, IS_SUPABASE_CONFIGURED } from './config';
import { supabase } from './supabase';

type ApiOptions = RequestInit & { token?: string | null };

async function resolveAuthToken(token?: string | null) {
  if (token === null || !IS_SUPABASE_CONFIGURED) return token || null;

  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.expires_at && data.session.expires_at * 1000 <= Date.now() + 60_000) {
      return await refreshAuthToken() || token || null;
    }
    return data.session?.access_token || token || null;
  } catch {
    return token || null;
  }
}

async function refreshAuthToken() {
  if (!IS_SUPABASE_CONFIGURED) return null;

  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    return data.session?.access_token || null;
  } catch {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => null);
    return null;
  }
}

async function parseResponse(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text ? { message: text } : null;
  }
}

function readableMessage(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed && !['{}', '[]', 'null', 'undefined', '[object Object]'].includes(trimmed) ? trimmed : '';
  }
  if (value instanceof Error) return readableMessage(value.message);
  if (typeof value === 'object') {
    const candidate =
      readableMessage((value as { message?: unknown }).message) ||
      readableMessage((value as { error_description?: unknown }).error_description) ||
      readableMessage((value as { error?: unknown }).error) ||
      readableMessage((value as { detail?: unknown }).detail) ||
      readableMessage((value as { details?: unknown }).details);
    if (candidate) return candidate;
  }

  return readableMessage(String(value));
}

function apiErrorMessage(body: any, status: number) {
  return readableMessage(body?.error) ||
    readableMessage(body?.message) ||
    readableMessage(body) ||
    `Error ${status}`;
}

export async function api<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers, ...request } = options;
  let authToken = await resolveAuthToken(token);
  const send = (nextToken: string | null) => fetch(`${API_URL}${path}`, {
      ...request,
      headers: {
        ...(request.body && !(request.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(nextToken ? { Authorization: `Bearer ${nextToken}` } : {}),
        ...headers,
      },
    });

  let response: Response;
  try {
    response = await send(authToken);
  } catch {
    throw new Error(`No se pudo conectar con la API (${API_URL}). Verifica que el backend este iniciado y accesible desde el telefono.`);
  }

  let body = await parseResponse(response);
  if (response.status === 401 && authToken && token !== null) {
    const refreshedToken = await refreshAuthToken();
    if (refreshedToken && refreshedToken !== authToken) {
      authToken = refreshedToken;
      response = await send(authToken);
      body = await parseResponse(response);
    } else {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => null);
    }
  }

  if (!response.ok) {
    throw new Error(response.status === 401
      ? 'Tu sesion vencio. Inicia sesion de nuevo.'
      : apiErrorMessage(body, response.status));
  }
  return body as T;
}

export function mediaPart(asset: { uri: string; fileName?: string | null; mimeType?: string | null }, fallback: string) {
  return {
    uri: asset.uri,
    name: asset.fileName || fallback,
    type: asset.mimeType || 'application/octet-stream',
  } as any;
}

