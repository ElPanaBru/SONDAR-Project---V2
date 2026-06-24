import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import { usePreferencias } from "../contextos/PreferenciasContext";

function tiempoRelativo(fecha, idioma, locale, t) {
  const segundos = Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 1000));
  if (segundos < 60) return t("Ahora");
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return idioma === "en" ? `${minutos} min ago` : idioma === "pt" ? `Há ${minutos} min` : `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return idioma === "en" ? `${horas} h ago` : idioma === "pt" ? `Há ${horas} h` : `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return idioma === "en" ? `${dias} d ago` : idioma === "pt" ? `Há ${dias} d` : `Hace ${dias} d`;
  return new Date(fecha).toLocaleDateString(locale);
}

function NotificationPanel({ usuario, onClose, onCountChange }) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { preferencias, locale, t } = usePreferencias();

  const pedir = useCallback(async (ruta, options = {}) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Tu sesion expiro.");
    const response = await fetch(apiUrl(ruta), {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const dataError = await response.json().catch(() => ({}));
      throw new Error(dataError.error || "No se pudo actualizar las notificaciones.");
    }
    return response.json();
  }, []);

  const cargar = useCallback(async () => {
    if (!usuario) return;
    try {
      setError("");
      const data = await pedir("/api/notificaciones?limit=50");
      setItems(data.items || []);
      onCountChange?.(Number(data.noLeidas || 0));
    } catch (cargaError) {
      setError(cargaError.message);
    } finally {
      setCargando(false);
    }
  }, [onCountChange, pedir, usuario]);

  useEffect(() => {
    if (!preferencias.actividadCuenta) {
      setItems([]);
      setCargando(false);
      setError("");
      onCountChange?.(0);
      return;
    }
    setCargando(true);
    cargar();
  }, [cargar, onCountChange, preferencias.actividadCuenta]);

  const publicarContador = (siguientes) => {
    const noLeidas = siguientes.filter((item) => !item.read_at).length;
    onCountChange?.(noLeidas);
    window.dispatchEvent(new CustomEvent("sondar:notificaciones-actualizadas", {
      detail: { noLeidas },
    }));
  };

  const abrirNotificacion = async (notificacion) => {
    let siguientes = items;
    if (!notificacion.read_at) {
      siguientes = items.map((item) => item.id === notificacion.id
        ? { ...item, read_at: new Date().toISOString() }
        : item);
      setItems(siguientes);
      publicarContador(siguientes);
      pedir(`/api/notificaciones/${notificacion.id}/leer`, { method: "POST" }).catch(() => cargar());
    }
    onClose();
    if (notificacion.target_url?.startsWith("/")) navigate(notificacion.target_url);
  };

  const marcarTodas = async () => {
    try {
      await pedir("/api/notificaciones/leer-todas", { method: "POST" });
      const ahora = new Date().toISOString();
      const siguientes = items.map((item) => ({ ...item, read_at: item.read_at || ahora }));
      setItems(siguientes);
      publicarContador(siguientes);
    } catch (accionError) {
      setError(accionError.message);
    }
  };

  const limpiarLeidas = async () => {
    try {
      await pedir("/api/notificaciones/leidas", { method: "DELETE" });
      const siguientes = items.filter((item) => !item.read_at);
      setItems(siguientes);
      publicarContador(siguientes);
    } catch (accionError) {
      setError(accionError.message);
    }
  };

  const tieneNoLeidas = items.some((item) => !item.read_at);
  const tieneLeidas = items.some((item) => item.read_at);

  return (
    <div className="notifications-panel" role="dialog" aria-label="Notificaciones">
      <div className="panel-header">
        <div>
          <h3>{t("Notificaciones")}</h3>
          <span>{items.length} {preferencias.idioma === "en" ? "recent" : preferencias.idioma === "pt" ? "recentes" : "recientes"}</span>
        </div>
        <button className="panel-close" onClick={onClose} aria-label="Cerrar" type="button">×</button>
      </div>

      <div className="notifications-toolbar">
        <button type="button" onClick={marcarTodas} disabled={!tieneNoLeidas}>{t("Marcar todas")}</button>
        <button type="button" onClick={limpiarLeidas} disabled={!tieneLeidas}>{t("Limpiar leídas")}</button>
      </div>

      <div className="panel-body">
        {!preferencias.actividadCuenta ? <div className="panel-empty">{t("Las notificaciones están pausadas. No se crearán avisos nuevos.")}</div> : null}
        {preferencias.actividadCuenta && cargando ? <div className="panel-empty">{t("Cargando notificaciones...")}</div> : null}
        {preferencias.actividadCuenta && !cargando && error ? <div className="panel-empty panel-error">{error}</div> : null}
        {preferencias.actividadCuenta && !cargando && !error && items.length === 0 ? (
          <div className="panel-empty">{t("No tenés notificaciones por ahora.")}</div>
        ) : null}
        {preferencias.actividadCuenta && !cargando && !error ? items.map((notificacion) => (
          <button
            type="button"
            key={notificacion.id}
            className={`notif-item ${notificacion.read_at ? "read" : "unread"}`}
            onClick={() => abrirNotificacion(notificacion)}
          >
            <span className="notif-avatar">
              {notificacion.actor_avatar ? (
                <img src={notificacion.actor_avatar} alt="" />
              ) : (
                String(notificacion.actor_name || "S").charAt(0).toUpperCase()
              )}
            </span>
            <span className="notif-copy">
              <span className="notif-title">{notificacion.title}</span>
              {notificacion.body ? <span className="notif-body">{notificacion.body}</span> : null}
              <span className="notif-time">{tiempoRelativo(notificacion.created_at, preferencias.idioma, locale, t)}</span>
            </span>
            {!notificacion.read_at ? <span className="notif-dot" aria-label={t("Notificación no leída")} /> : null}
          </button>
        )) : null}
      </div>
    </div>
  );
}

export default NotificationPanel;
