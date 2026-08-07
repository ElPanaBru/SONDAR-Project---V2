import { createContext } from "react";

export const PREFERENCIAS_INICIALES = Object.freeze({
  telefono: "",
  codigoPais: "+54",
  idioma: "es",
  actividadCuenta: true,
  notificarInteracciones: true,
  notificarComentarios: true,
  notificarSeguidores: true,
  notificarPublicaciones: true,
  notificarMenciones: true,
  reducirMovimiento: false,
  mostrarEmail: false,
});

export const PreferenciasContext = createContext(null);
