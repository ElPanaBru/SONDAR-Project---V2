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

export function apiUrl(path) {
  return `${API_URL}${path}`;
}
