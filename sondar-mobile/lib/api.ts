import { API_URL } from './config';

type ApiOptions = RequestInit & { token?: string | null };

export async function api<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers, ...request } = options;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...request,
      headers: {
        ...(request.body && !(request.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new Error(`No se pudo conectar con la API (${API_URL}). Verifica que el backend este iniciado y accesible desde el telefono.`);
  }

  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text ? { message: text } : null;
  }
  if (!response.ok) {
    throw new Error(body?.error || body?.message || `Error ${response.status}`);
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

