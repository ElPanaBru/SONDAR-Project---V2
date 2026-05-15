const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "Error conectando con el servidor");
  }

  return data;
}

export const api = {
  verificarUsuario(uid) {
    return request(`/usuarios/verificar/${uid}`);
  },

  registrarUsuario(payload) {
    return request("/usuarios/registrar", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  obtenerCuenta(uid) {
    return request(`/usuarios/${uid}`);
  },

  obtenerPerfil(uid) {
    return request(`/usuarios/${uid}/perfil`);
  },

  guardarPerfil(uid, perfil) {
    return request(`/usuarios/${uid}/perfil`, {
      method: "PUT",
      body: JSON.stringify(perfil),
    });
  },

  obtenerConfiguracion(uid) {
    return request(`/usuarios/${uid}/configuracion`);
  },

  guardarConfiguracion(uid, configuracion) {
    return request(`/usuarios/${uid}/configuracion`, {
      method: "PUT",
      body: JSON.stringify(configuracion),
    });
  },

  obtenerGuardados(uid) {
    return request(`/usuarios/${uid}/guardados`);
  },

  guardarItem(uid, itemType, itemId, itemData) {
    return request(`/usuarios/${uid}/guardados`, {
      method: "POST",
      body: JSON.stringify({ itemType, itemId, itemData }),
    });
  },

  quitarGuardado(uid, itemType, itemId) {
    return request(`/usuarios/${uid}/guardados/${itemType}/${itemId}`, {
      method: "DELETE",
    });
  },

  guardarInteraccion(uid, payload) {
    return request(`/usuarios/${uid}/interacciones`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  obtenerPublicaciones(uid) {
    return request(`/usuarios/${uid}/publicaciones`);
  },

  crearPublicacion(uid, publicacion) {
    return request(`/usuarios/${uid}/publicaciones`, {
      method: "POST",
      body: JSON.stringify(publicacion),
    });
  },

  obtenerEventos(uid) {
    const query = uid ? `?uid=${encodeURIComponent(uid)}` : "";
    return request(`/eventos${query}`);
  },

  crearEvento(evento) {
    return request("/eventos", {
      method: "POST",
      body: JSON.stringify(evento),
    });
  },

  obtenerHilos(uid) {
    const query = uid ? `?uid=${encodeURIComponent(uid)}` : "";
    return request(`/posts/hilos${query}`);
  },

  crearHilo(hilo) {
    return request("/posts/hilos", {
      method: "POST",
      body: JSON.stringify(hilo),
    });
  },

  responderHilo(hiloId, respuesta) {
    return request(`/posts/hilos/${hiloId}/respuestas`, {
      method: "POST",
      body: JSON.stringify(respuesta),
    });
  },

  votarHilo(hiloId) {
    return request(`/posts/hilos/${hiloId}/votar`, {
      method: "POST",
    });
  },
};
