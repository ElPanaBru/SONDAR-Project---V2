import { supabase } from "./supabaseClient";
import { apiUrl } from "./api";

async function obtenerToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

function construirHeaders(options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  return headers;
}

async function backendFetch(path, options = {}) {
  const token = await obtenerToken();
  const url = apiUrl(path);
  const headers = construirHeaders(options);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
}

async function parseBackendResponse(response) {
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const error = new Error(
      (body && typeof body === "object" ? body.error : body) || response.statusText || "Error en la solicitud al backend."
    );
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

async function backendFetchJson(path, options = {}) {
  const response = await backendFetch(path, options);
  return parseBackendResponse(response);
}

export { backendFetch, backendFetchJson };
