import { supabase } from "./supabaseClient";

function resolverApiUrl() {
  const configurada = import.meta.env.VITE_API_URL || "http://localhost:3000";
  if (typeof window === "undefined") return configurada;

  try {
    const url = new URL(configurada);
    const apiLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (apiLocal) url.hostname = window.location.hostname;
    return url.origin;
  } catch {
    return configurada;
  }
}

export const API_URL = resolverApiUrl();
const DEFAULT_API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 25000);

export function apiUrl(path) {
  return `${API_URL}${path}`;
}

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, cause } = {}) {
    super(message, { cause });
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function obtenerToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new ApiError("No se pudo obtener la sesión actual.", { cause: error });
  return data.session?.access_token || null;
}

function prepararBodyYHeaders(body, headers) {
  const finales = new Headers(headers || {});
  const esFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const esBodyDirecto = esFormData
    || typeof body === "string"
    || body instanceof Blob
    || body instanceof ArrayBuffer
    || body instanceof URLSearchParams;

  if (body != null && !esBodyDirecto) {
    if (!finales.has("Content-Type")) finales.set("Content-Type", "application/json");
    return { body: JSON.stringify(body), headers: finales };
  }

  return { body, headers: finales };
}

export async function apiRequest(path, options = {}) {
  const {
    auth = true,
    body,
    headers,
    signal,
    timeoutMs = DEFAULT_API_TIMEOUT_MS,
    ...fetchOptions
  } = options;
  const preparados = prepararBodyYHeaders(body, headers);
  const controller = new AbortController();
  let timeoutId = null;
  let timeoutAgotado = false;

  if (auth && !preparados.headers.has("Authorization")) {
    const token = await obtenerToken();
    if (token) preparados.headers.set("Authorization", `Bearer ${token}`);
  }

  const abortarPorSignalExterno = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      abortarPorSignalExterno();
    } else {
      signal.addEventListener("abort", abortarPorSignalExterno, { once: true });
    }
  }

  if (timeoutMs > 0) {
    timeoutId = window.setTimeout(() => {
      timeoutAgotado = true;
      controller.abort();
    }, timeoutMs);
  }

  try {
    return await fetch(apiUrl(path), {
      ...fetchOptions,
      body: preparados.body,
      headers: preparados.headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError(
        timeoutAgotado
          ? "El servidor tardo demasiado en responder. Proba de nuevo en unos segundos."
          : "La solicitud fue cancelada.",
        { status: timeoutAgotado ? 504 : 0, cause: error }
      );
    }
    throw new ApiError("No se pudo conectar con el servidor de SONDAR.", { cause: error });
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
    if (signal) signal.removeEventListener("abort", abortarPorSignalExterno);
  }
}

export async function apiJson(path, options = {}) {
  const response = await apiRequest(path, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof data === "object" && data?.error
      ? data.error
      : `La solicitud falló con estado ${response.status}.`;
    throw new ApiError(message, { status: response.status, data });
  }

  return data;
}
