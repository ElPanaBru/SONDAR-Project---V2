import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import "./configuracion.css";

const AJUSTES_INICIALES = {
  telefono: "",
  idioma: "es",
  zonaHoraria: "America/Argentina/Buenos_Aires",
  loginAlertas: true,
  newsletter: false,
  actividadCuenta: true,
  perfilPrivado: false,
  mostrarEmail: false,
  permitirMensajes: true,
};

export default function Configuracion({ usuario }) {
  const navigate = useNavigate();
  const [ajustes, setAjustes] = useState(AJUSTES_INICIALES);
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordRepetida, setPasswordRepetida] = useState("");
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [mostrarEliminar, setMostrarEliminar] = useState(false);
  const [confirmacionEliminar, setConfirmacionEliminar] = useState("");
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    const configuracionGuardada = usuario?.user_metadata?.configuracion;
    setAjustes({
      ...AJUSTES_INICIALES,
      ...(configuracionGuardada && typeof configuracionGuardada === "object"
        ? configuracionGuardada
        : {}),
      telefono:
        configuracionGuardada?.telefono || usuario?.phone || usuario?.user_metadata?.phone || "",
    });
  }, [usuario?.id, usuario?.phone, usuario?.user_metadata]);

  const nombreCuenta = useMemo(() => {
    if (usuario?.user_metadata?.username) return usuario.user_metadata.username;
    if (usuario?.user_metadata?.name) return usuario.user_metadata.name;
    if (usuario?.email) return usuario.email.split("@")[0];
    return "Cuenta SONDAR";
  }, [usuario]);

  const inicial = nombreCuenta.trim().charAt(0).toUpperCase() || "S";

  const mostrarMensaje = (tipo, texto) => setMensaje({ tipo, texto });

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setMensaje(null);
    setAjustes((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const guardarAjustes = async (e) => {
    e.preventDefault();

    if (!usuario) {
      mostrarMensaje("error", "Inicia sesion para guardar tu configuracion.");
      return;
    }

    setGuardando(true);
    setMensaje(null);

    const { error } = await supabase.auth.updateUser({
      data: { configuracion: ajustes },
    });

    setGuardando(false);
    if (error) {
      mostrarMensaje("error", error.message || "No pudimos guardar los cambios.");
      return;
    }

    mostrarMensaje("success", "Configuracion guardada correctamente.");
  };

  const cambiarPassword = async (e) => {
    e.preventDefault();

    if (password.length < 8) {
      mostrarMensaje("error", "La contrasena debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== passwordRepetida) {
      mostrarMensaje("error", "Las contrasenas no coinciden.");
      return;
    }

    setCambiandoPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setCambiandoPassword(false);

    if (error) {
      mostrarMensaje("error", error.message || "No pudimos cambiar la contrasena.");
      return;
    }

    setPassword("");
    setPasswordRepetida("");
    setMostrarPassword(false);
    mostrarMensaje("success", "Contrasena actualizada correctamente.");
  };

  const descargarDatos = () => {
    if (!usuario) {
      mostrarMensaje("error", "Inicia sesion para descargar tus datos.");
      return;
    }

    const datos = {
      exportado_en: new Date().toISOString(),
      cuenta: {
        id: usuario.id,
        email: usuario.email,
        telefono: usuario.phone || ajustes.telefono,
        creada_en: usuario.created_at,
        ultimo_acceso: usuario.last_sign_in_at,
      },
      perfil: {
        username: usuario.user_metadata?.username || null,
        nombre: usuario.user_metadata?.name || null,
      },
      configuracion: ajustes,
    };

    const archivo = new Blob([JSON.stringify(datos, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const enlace = document.createElement("a");
    const url = URL.createObjectURL(archivo);
    enlace.href = url;
    enlace.download = `sondar-datos-${usuario.id}.json`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
    mostrarMensaje("success", "Descarga preparada correctamente.");
  };

  const eliminarCuenta = async (e) => {
    e.preventDefault();
    if (!usuario?.email || confirmacionEliminar.trim() !== usuario.email) return;

    setEliminando(true);
    setMensaje(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Tu sesion vencio. Inicia sesion nuevamente.");

      const response = await fetch(apiUrl("/api/usuarios/me"), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo eliminar la cuenta.");

      await supabase.auth.signOut({ scope: "local" });
      navigate("/auth", { replace: true });
    } catch (error) {
      setEliminando(false);
      mostrarMensaje("error", error.message || "No se pudo eliminar la cuenta.");
    }
  };

  return (
    <section className="config-page">
      <header className="config-header">
        <div>
          <p className="config-kicker">Cuenta</p>
          <h1>Configuracion</h1>
          <p>Ajustes generales de acceso, seguridad, privacidad y comunicaciones de tu cuenta.</p>
        </div>

        <div className="config-account">
          <div className="config-avatar" aria-hidden="true">{inicial}</div>
          <div>
            <strong>{nombreCuenta}</strong>
            <span>{usuario?.email || "Sin email conectado"}</span>
          </div>
        </div>
      </header>

      <form className="config-layout" onSubmit={guardarAjustes}>
        <aside className="config-sidebar" aria-label="Secciones de configuracion">
          <a href="#datos">Datos</a>
          <a href="#seguridad">Seguridad</a>
          <a href="#notificaciones">Notificaciones</a>
          <a href="#privacidad">Privacidad</a>
          <a href="#zona-cuenta">Zona de cuenta</a>
        </aside>

        <div className="config-content">
          <section className="config-panel" id="datos">
            <div className="config-panel-heading">
              <h2>Datos de la cuenta</h2>
              <p>Informacion privada usada para iniciar sesion y gestionar tu cuenta.</p>
            </div>

            <div className="config-grid">
              <label>
                Email
                <input type="email" value={usuario?.email || ""} readOnly aria-readonly="true" />
                <small>El correo de acceso no se modifica desde esta pantalla.</small>
              </label>

              <label>
                Telefono
                <input
                  type="tel"
                  name="telefono"
                  value={ajustes.telefono}
                  onChange={handleChange}
                  placeholder="+54 9 11 0000 0000"
                  autoComplete="tel"
                />
              </label>

              <label>
                Idioma
                <select name="idioma" value={ajustes.idioma} onChange={handleChange}>
                  <option value="es">Espanol</option>
                  <option value="en">Ingles</option>
                  <option value="pt">Portugues</option>
                </select>
              </label>

              <label>
                Zona horaria
                <select name="zonaHoraria" value={ajustes.zonaHoraria} onChange={handleChange}>
                  <option value="America/Argentina/Buenos_Aires">Buenos Aires</option>
                  <option value="America/Santiago">Santiago</option>
                  <option value="America/Montevideo">Montevideo</option>
                </select>
              </label>
            </div>
          </section>

          <section className="config-panel" id="seguridad">
            <div className="config-panel-heading">
              <h2>Seguridad</h2>
              <p>Opciones para proteger el acceso a tu cuenta.</p>
            </div>

            <div className="config-actions-list">
              <div className="config-action-row">
                <div>
                  <strong>Contrasena</strong>
                  <span>Actualiza tu contrasena de acceso.</span>
                </div>
                <button type="button" onClick={() => setMostrarPassword(true)}>Cambiar</button>
              </div>

              <label className="config-switch-row">
                <div>
                  <strong>Alertas de inicio de sesion</strong>
                  <span>Recibi un aviso cuando haya actividad nueva.</span>
                </div>
                <input type="checkbox" name="loginAlertas" checked={ajustes.loginAlertas} onChange={handleChange} />
              </label>
            </div>
          </section>

          <section className="config-panel" id="notificaciones">
            <div className="config-panel-heading">
              <h2>Notificaciones</h2>
              <p>Define que mensajes queres recibir de SONDAR.</p>
            </div>

            <div className="config-actions-list">
              <label className="config-switch-row">
                <div>
                  <strong>Actividad importante</strong>
                  <span>Eventos de seguridad, cambios de cuenta y avisos criticos.</span>
                </div>
                <input type="checkbox" name="actividadCuenta" checked={ajustes.actividadCuenta} onChange={handleChange} />
              </label>

              <label className="config-switch-row">
                <div>
                  <strong>Novedades por email</strong>
                  <span>Resumenes, lanzamientos y recomendaciones de la plataforma.</span>
                </div>
                <input type="checkbox" name="newsletter" checked={ajustes.newsletter} onChange={handleChange} />
              </label>
            </div>
          </section>

          <section className="config-panel" id="privacidad">
            <div className="config-panel-heading">
              <h2>Privacidad</h2>
              <p>Controla como otros usuarios interactuan con tu cuenta.</p>
            </div>

            <div className="config-actions-list">
              <label className="config-switch-row">
                <div>
                  <strong>Cuenta privada</strong>
                  <span>Limita la visibilidad publica de tu actividad.</span>
                </div>
                <input type="checkbox" name="perfilPrivado" checked={ajustes.perfilPrivado} onChange={handleChange} />
              </label>

              <label className="config-switch-row">
                <div>
                  <strong>Mostrar email</strong>
                  <span>Permite que otros usuarios vean tu email de contacto.</span>
                </div>
                <input type="checkbox" name="mostrarEmail" checked={ajustes.mostrarEmail} onChange={handleChange} />
              </label>

              <label className="config-switch-row">
                <div>
                  <strong>Mensajes directos</strong>
                  <span>Habilita contactos desde comunidades y eventos.</span>
                </div>
                <input type="checkbox" name="permitirMensajes" checked={ajustes.permitirMensajes} onChange={handleChange} />
              </label>
            </div>
          </section>

          <section className="config-panel config-danger" id="zona-cuenta">
            <div className="config-panel-heading">
              <h2>Zona de cuenta</h2>
              <p>Acciones sensibles que afectan tu acceso y datos.</p>
            </div>

            <div className="config-actions-list">
              <div className="config-action-row">
                <div>
                  <strong>Descargar datos</strong>
                  <span>Guarda una copia JSON de tu cuenta y configuracion.</span>
                </div>
                <button type="button" onClick={descargarDatos}>Descargar</button>
              </div>

              <div className="config-action-row">
                <div>
                  <strong>Eliminar cuenta</strong>
                  <span>Elimina permanentemente tu perfil, publicaciones, eventos e interacciones.</span>
                </div>
                <button className="config-danger-button" type="button" onClick={() => setMostrarEliminar(true)}>
                  Eliminar
                </button>
              </div>
            </div>
          </section>

          <div className="config-savebar">
            {mensaje ? (
              <p className={`config-message ${mensaje.tipo}`} role="status">{mensaje.texto}</p>
            ) : (
              <span>Guarda los cambios para aplicarlos a tu cuenta.</span>
            )}
            <button type="submit" disabled={guardando || !usuario}>
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </form>

      {mostrarPassword && (
        <div className="config-modal-backdrop" role="presentation" onMouseDown={() => !cambiandoPassword && setMostrarPassword(false)}>
          <form className="config-modal" role="dialog" aria-modal="true" aria-labelledby="password-title" onSubmit={cambiarPassword} onMouseDown={(e) => e.stopPropagation()}>
            <h2 id="password-title">Cambiar contrasena</h2>
            <p>Usa al menos 8 caracteres y evita contrasenas que ya hayas utilizado.</p>
            <label>Nueva contrasena<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus /></label>
            <label>Repetir contrasena<input type="password" value={passwordRepetida} onChange={(e) => setPasswordRepetida(e.target.value)} autoComplete="new-password" /></label>
            <div className="config-modal-actions">
              <button type="button" onClick={() => setMostrarPassword(false)} disabled={cambiandoPassword}>Cancelar</button>
              <button type="submit" disabled={cambiandoPassword}>{cambiandoPassword ? "Actualizando..." : "Actualizar"}</button>
            </div>
          </form>
        </div>
      )}

      {mostrarEliminar && (
        <div className="config-modal-backdrop" role="presentation" onMouseDown={() => !eliminando && setMostrarEliminar(false)}>
          <form className="config-modal config-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onSubmit={eliminarCuenta} onMouseDown={(e) => e.stopPropagation()}>
            <h2 id="delete-title">Eliminar cuenta permanentemente</h2>
            <p>Esta accion no se puede deshacer. Se eliminaran tu perfil, reels, eventos, comentarios, guardados y archivos publicados.</p>
            <label>
              Escribi <strong>{usuario?.email}</strong> para confirmar
              <input type="email" value={confirmacionEliminar} onChange={(e) => setConfirmacionEliminar(e.target.value)} placeholder={usuario?.email || "tu@email.com"} autoComplete="off" autoFocus />
            </label>
            <div className="config-modal-actions">
              <button type="button" onClick={() => setMostrarEliminar(false)} disabled={eliminando}>Cancelar</button>
              <button className="config-confirm-delete" type="submit" disabled={eliminando || confirmacionEliminar.trim() !== usuario?.email}>
                {eliminando ? "Eliminando..." : "Eliminar definitivamente"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
