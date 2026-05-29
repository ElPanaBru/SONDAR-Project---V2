import { firebaseSync } from "./firebaseSync";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:3000/api";

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });
  } catch {
    throw new Error(
      "No se pudo conectar con el backend. Ejecuta npm run dev:all y deja esa terminal abierta."
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "Error conectando con el servidor");
  }

  return data;
}

export const api = {
  verificarUsuario(uid) {
    return request(`/usuarios/verificar/${uid}`).then((data) => {
      if (data?.user) firebaseSync.user(data.user);
      return data;
    });
  },

  registrarUsuario(payload) {
    return request("/usuarios/registrar", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((user) => {
      firebaseSync.user(user);
      return user;
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
    }).then((perfilGuardado) => {
      firebaseSync.profile(uid, perfilGuardado);
      return perfilGuardado;
    });
  },

  obtenerConfiguracion(uid) {
    return request(`/usuarios/${uid}/configuracion`);
  },

  guardarConfiguracion(uid, configuracion) {
    return request(`/usuarios/${uid}/configuracion`, {
      method: "PUT",
      body: JSON.stringify(configuracion),
    }).then((configuracionGuardada) => {
      firebaseSync.settings(uid, configuracionGuardada);
      return configuracionGuardada;
    });
  },

  obtenerGuardados(uid) {
    return request(`/usuarios/${uid}/guardados`);
  },

  guardarItem(uid, itemType, itemId, itemData) {
    return request(`/usuarios/${uid}/guardados`, {
      method: "POST",
      body: JSON.stringify({ itemType, itemId, itemData }),
    }).then((guardado) => {
      firebaseSync.savedItem(uid, itemType, itemId, itemData);
      return guardado;
    });
  },

  quitarGuardado(uid, itemType, itemId) {
    return request(`/usuarios/${uid}/guardados/${itemType}/${itemId}`, {
      method: "DELETE",
    }).then((resultado) => {
      firebaseSync.removeSavedItem(uid, itemType, itemId);
      return resultado;
    });
  },

  guardarInteraccion(uid, payload) {
    return request(`/usuarios/${uid}/interacciones`, {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((interaccion) => {
      firebaseSync.interaction(uid, payload);
      return interaccion;
    });
  },

  obtenerPublicaciones(uid) {
    return request(`/usuarios/${uid}/publicaciones`);
  },

  crearPublicacion(uid, publicacion) {
    return request(`/usuarios/${uid}/publicaciones`, {
      method: "POST",
      body: JSON.stringify(publicacion),
    }).then((publicacionGuardada) => {
      firebaseSync.publication(uid, publicacionGuardada);
      return publicacionGuardada;
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
    }).then((eventoGuardado) => {
      firebaseSync.event(eventoGuardado);
      return eventoGuardado;
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
    }).then((hiloGuardado) => {
      firebaseSync.thread(hiloGuardado);
      return hiloGuardado;
    });
  },

  responderHilo(hiloId, respuesta) {
    return request(`/posts/hilos/${hiloId}/respuestas`, {
      method: "POST",
      body: JSON.stringify(respuesta),
    }).then((respuestaGuardada) => {
      firebaseSync.comment(hiloId, respuestaGuardada);
      return respuestaGuardada;
    });
  },

  votarHilo(hiloId, uid) {
    return request(`/posts/hilos/${hiloId}/votar`, {
      method: "POST",
      body: JSON.stringify({ uid }),
    }).then((voto) => {
      firebaseSync.interaction(uid, {
        itemType: "hilo",
        itemId: hiloId,
        interactionType: "vote",
        active: voto?.votado,
        itemData: { votos: voto?.votos },
      });
      return voto;
    });
  },

  obtenerCatalogo(nombre) {
    return request(`/catalogo/${encodeURIComponent(nombre)}`);
  },

  guardarCatalogo(nombre, items) {
    return request(`/catalogo/${encodeURIComponent(nombre)}`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    }).then((itemsGuardados) => {
      firebaseSync.catalog(nombre, itemsGuardados);
      return itemsGuardados;
    });
  },
};
