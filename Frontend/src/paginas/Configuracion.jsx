import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import { PREFERENCIAS_INICIALES, usePreferencias } from "../contextos/PreferenciasContext";
import "./configuracion.css";

const AJUSTES_INICIALES = PREFERENCIAS_INICIALES;

export default function Configuracion({ usuario }) {
  const navigate = useNavigate();
  const { actualizarPreferencias, t } = usePreferencias();
  const [ajustes, setAjustes] = useState(AJUSTES_INICIALES);
  const [ajustesGuardados, setAjustesGuardados] = useState(AJUSTES_INICIALES);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordRepetida, setPasswordRepetida] = useState("");
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordActualizada, setPasswordActualizada] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [mostrarEliminar, setMostrarEliminar] = useState(false);
  const [confirmacionEliminar, setConfirmacionEliminar] = useState("");
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    const configuracionGuardada = usuario?.user_metadata?.configuracion;
    const ajustesIniciales = {
      ...AJUSTES_INICIALES,
      ...(configuracionGuardada && typeof configuracionGuardada === "object"
        ? configuracionGuardada
        : {}),
      telefono:
        configuracionGuardada?.telefono || usuario?.phone || usuario?.user_metadata?.phone || "",
    };
    setAjustes(ajustesIniciales);
    setAjustesGuardados(ajustesIniciales);
    if (!usuario) {
      setCargando(false);
      return undefined;
    }

    let vigente = true;
    const cargarConfiguracion = async () => {
      setCargando(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Tu sesion vencio. Inicia sesion nuevamente.");

        const response = await fetch(apiUrl("/api/usuarios/me/configuracion"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "No se pudo cargar la configuracion.");
        if (vigente) {
          const ajustesCargados = { ...AJUSTES_INICIALES, ...body };
          setAjustes(ajustesCargados);
          setAjustesGuardados(ajustesCargados);
          actualizarPreferencias(ajustesCargados);
        }
      } catch (error) {
        if (vigente) mostrarMensaje("error", error.message || "No se pudo cargar la configuracion.");
      } finally {
        if (vigente) setCargando(false);
      }
    };

    cargarConfiguracion();
    return () => {
      vigente = false;
    };
  }, [actualizarPreferencias, usuario]);

  useEffect(() => {
    if (!mensaje) return undefined;
    const timeout = window.setTimeout(() => setMensaje(null), mensaje.tipo === "success" ? 5000 : 8000);
    return () => window.clearTimeout(timeout);
  }, [mensaje]);

  const nombreCuenta = useMemo(() => {
    if (usuario?.user_metadata?.username) return usuario.user_metadata.username;
    if (usuario?.user_metadata?.name) return usuario.user_metadata.name;
    if (usuario?.email) return usuario.email.split("@")[0];
    return "Cuenta SONDAR";
  }, [usuario]);

  const inicial = nombreCuenta.trim().charAt(0).toUpperCase() || "S";
  const hayCambios = useMemo(
    () => JSON.stringify(ajustes) !== JSON.stringify(ajustesGuardados),
    [ajustes, ajustesGuardados]
  );
  const fuerzaPassword = useMemo(() => {
    let puntos = 0;
    if (password.length >= 8) puntos += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) puntos += 1;
    if (/\d/.test(password)) puntos += 1;
    if (/[^A-Za-z0-9]/.test(password)) puntos += 1;
    return puntos;
  }, [password]);

  const mostrarMensaje = (tipo, texto) => setMensaje({ tipo, texto });

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    const valor = type === "checkbox" ? checked : name === "telefono" ? value.replace(/\D/g, "").slice(0, 18) : value;
    setMensaje(null);
    setAjustes((prev) => ({
      ...prev,
      [name]: valor,
    }));
    if (name === "idioma" || name === "reducirMovimiento") {
      actualizarPreferencias({ [name]: valor });
    }
  };

  const restablecerPreferencias = () => {
    const siguientes = {
      ...ajustes,
      idioma: "es",
      zonaHoraria: "America/Argentina/Buenos_Aires",
      actividadCuenta: true,
      notificarInteracciones: true,
      notificarComentarios: true,
      notificarSeguidores: true,
      notificarPublicaciones: true,
      notificarMenciones: true,
      reducirMovimiento: false,
    };
    setAjustes(siguientes);
    actualizarPreferencias(siguientes);
    mostrarMensaje("success", "Preferencias restablecidas. Guardá los cambios para conservarlas.");
  };

  const guardarAjustes = async (e) => {
    e.preventDefault();

    if (!usuario) {
      mostrarMensaje("error", "Inicia sesion para guardar tu configuracion.");
      return;
    }

    setGuardando(true);
    setMensaje(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Tu sesion vencio. Inicia sesion nuevamente.");

      const response = await fetch(apiUrl("/api/usuarios/me/configuracion"), {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ajustes),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No pudimos guardar los cambios.");
      const ajustesActualizados = { ...AJUSTES_INICIALES, ...body };
      setAjustes(ajustesActualizados);
      setAjustesGuardados(ajustesActualizados);
      actualizarPreferencias(ajustesActualizados);
      await supabase.auth.refreshSession();
      mostrarMensaje("success", "Configuracion guardada correctamente.");
    } catch (error) {
      mostrarMensaje("error", error.message || "No pudimos guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  };

  const cambiarPassword = async (e) => {
    e.preventDefault();

    if (password.length < 8) {
      mostrarMensaje("error", "La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== passwordRepetida) {
      mostrarMensaje("error", "Las contraseñas no coinciden.");
      return;
    }

    setCambiandoPassword(true);
    setMensaje(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPasswordActualizada(true);
      mostrarMensaje("success", "Contraseña actualizada. Ya podés usarla en tu próximo inicio de sesión.");
      window.setTimeout(() => {
        setPassword("");
        setPasswordRepetida("");
        setPasswordActualizada(false);
        setMostrarPassword(false);
      }, 1400);
    } catch (error) {
      mostrarMensaje("error", error.message || "No pudimos cambiar la contraseña.");
    } finally {
      setCambiandoPassword(false);
    }
  };

  const descargarDatos = async () => {
    if (!usuario) {
      mostrarMensaje("error", "Inicia sesion para descargar tus datos.");
      return;
    }

    setDescargando(true);
    setMensaje(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Tu sesion vencio. Inicia sesion nuevamente.");
      const response = await fetch(apiUrl("/api/usuarios/me/exportar"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const datos = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(datos.error || "No se pudieron preparar tus datos.");

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
    } catch (error) {
      mostrarMensaje("error", error.message || "No se pudieron preparar tus datos.");
    } finally {
      setDescargando(false);
    }
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
          <p className="config-kicker">{t("Cuenta")}</p>
          <h1>{t("Configuración")}</h1>
          <p>{t("Ajustes generales de acceso, seguridad, privacidad y comunicaciones de tu cuenta.")}</p>
        </div>

        <div className="config-account">
          <div className="config-avatar" aria-hidden="true">{inicial}</div>
          <div>
            <strong>{nombreCuenta}</strong>
            <span>{usuario?.email || t("Sin email conectado")}</span>
          </div>
        </div>
      </header>

      <form className="config-layout" onSubmit={guardarAjustes}>
        <aside className="config-sidebar" aria-label="Secciones de configuracion">
          <a href="#datos">{t("Datos")}</a>
          <a href="#seguridad">{t("Seguridad")}</a>
          <a href="#notificaciones">{t("Notificaciones")}</a>
          <a href="#privacidad">{t("Privacidad")}</a>
          <a href="#experiencia">{t("Experiencia")}</a>
          <a href="#zona-cuenta">{t("Zona de cuenta")}</a>
        </aside>

        <div className="config-content">
          <section className="config-panel" id="datos">
            <div className="config-panel-heading">
              <h2>{t("Datos de la cuenta")}</h2>
              <p>{t("Información privada usada para iniciar sesión y gestionar tu cuenta.")}</p>
            </div>

            <div className="config-grid">
              <label>
                Email
                <input type="email" value={usuario?.email || ""} readOnly aria-readonly="true" />
                <small>{t("El correo de acceso no se modifica desde esta pantalla.")}</small>
              </label>

              <label className="config-phone-field">
                {t("Teléfono")}
                <div className="config-phone-control">
                  <select name="codigoPais" value={ajustes.codigoPais} onChange={handleChange} aria-label="Código de país">
                    <option value="+54">🇦🇷 +54</option>
                    <option value="+55">🇧🇷 +55</option>
                    <option value="+56">🇨🇱 +56</option>
                    <option value="+598">🇺🇾 +598</option>
                  </select>
                  <input
                    type="tel"
                    inputMode="numeric"
                    name="telefono"
                    value={ajustes.telefono}
                    onChange={handleChange}
                    placeholder="11 0000 0000"
                    autoComplete="tel-national"
                  />
                </div>
                <small>{t("Elegí el país y escribí el número sin el prefijo internacional.")}</small>
              </label>

              <label>
                {t("Idioma")}
                <select name="idioma" value={ajustes.idioma} onChange={handleChange}>
                  <option value="es">{t("Español")}</option>
                  <option value="en">{t("Inglés")}</option>
                  <option value="pt">{t("Portugués")}</option>
                </select>
                <small>{ajustes.idioma === ajustesGuardados.idioma ? "" : t("Vista previa activa. Guardá para conservar el idioma.")}</small>
              </label>

              <label>
                {t("Zona horaria")}
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
              <h2>{t("Seguridad")}</h2>
              <p>{t("Opciones para proteger el acceso a tu cuenta.")}</p>
            </div>

            <div className="config-actions-list">
              <div className="config-action-row">
                <div>
                  <strong>{t("Contraseña")}</strong>
                  <span>{t("Actualizá tu contraseña de acceso con confirmación visible.")}</span>
                </div>
                <button type="button" disabled={!usuario} onClick={() => {
                  setPasswordActualizada(false);
                  setMostrarPassword(true);
                }}>{t("Cambiar contraseña")}</button>
              </div>
            </div>
          </section>

          <section className="config-panel" id="notificaciones">
            <div className="config-panel-heading">
              <h2>{t("Notificaciones")}</h2>
              <p>{t("Define qué avisos querés recibir de SONDAR.")}</p>
            </div>

            <div className="config-actions-list">
              <label className="config-switch-row config-switch-master">
                <div>
                  <strong>{t("Notificaciones en la app")}</strong>
                  <span>{t("Activa o pausa todos los avisos nuevos.")}</span>
                </div>
                <input type="checkbox" name="actividadCuenta" checked={ajustes.actividadCuenta} onChange={handleChange} />
              </label>

              {!ajustes.actividadCuenta ? (
                <p className="config-disabled-notice" role="status">
                  {t("Las notificaciones están pausadas. No se crearán avisos nuevos.")}
                </p>
              ) : null}

              <label className="config-switch-row config-switch-child">
                <div>
                  <strong>{t("Me gusta y reacciones")}</strong>
                  <span>{t("Reels, comentarios y publicaciones de comunidad.")}</span>
                </div>
                <input type="checkbox" name="notificarInteracciones" checked={ajustes.notificarInteracciones} onChange={handleChange} disabled={!ajustes.actividadCuenta} />
              </label>

              <label className="config-switch-row config-switch-child">
                <div>
                  <strong>{t("Comentarios y respuestas")}</strong>
                  <span>{t("Conversaciones nuevas en tus reels y publicaciones.")}</span>
                </div>
                <input type="checkbox" name="notificarComentarios" checked={ajustes.notificarComentarios} onChange={handleChange} disabled={!ajustes.actividadCuenta} />
              </label>

              <label className="config-switch-row config-switch-child">
                <div>
                  <strong>{t("Nuevos seguidores")}</strong>
                  <span>{t("Cuando otra persona empieza a seguirte.")}</span>
                </div>
                <input type="checkbox" name="notificarSeguidores" checked={ajustes.notificarSeguidores} onChange={handleChange} disabled={!ajustes.actividadCuenta} />
              </label>

              <label className="config-switch-row config-switch-child">
                <div>
                  <strong>{t("Publicaciones de gente que seguís")}</strong>
                  <span>{t("Reels, eventos y publicaciones de comunidad nuevos.")}</span>
                </div>
                <input type="checkbox" name="notificarPublicaciones" checked={ajustes.notificarPublicaciones} onChange={handleChange} disabled={!ajustes.actividadCuenta} />
              </label>

              <label className="config-switch-row config-switch-child">
                <div>
                  <strong>{t("Menciones e invitaciones")}</strong>
                  <span>{t("Etiquetas con @ e invitaciones para organizar eventos.")}</span>
                </div>
                <input type="checkbox" name="notificarMenciones" checked={ajustes.notificarMenciones} onChange={handleChange} disabled={!ajustes.actividadCuenta} />
              </label>
            </div>
          </section>

          <section className="config-panel" id="privacidad">
            <div className="config-panel-heading">
              <h2>{t("Privacidad")}</h2>
              <p>{t("Controlá cómo otros usuarios pueden ver tu cuenta.")}</p>
            </div>

            <div className="config-actions-list">
              <label className="config-switch-row">
                <div>
                  <strong>{t("Cuenta privada")}</strong>
                  <span>{t("Solo vos y las cuentas que seguís pueden ver tus reels, eventos y listas.")}</span>
                </div>
                <input type="checkbox" name="perfilPrivado" checked={ajustes.perfilPrivado} onChange={handleChange} />
              </label>

              <label className="config-switch-row">
                <div>
                  <strong>{t("Mostrar email")}</strong>
                  <span>{t("Permite que otros usuarios vean tu email de contacto.")}</span>
                </div>
                <input type="checkbox" name="mostrarEmail" checked={ajustes.mostrarEmail} onChange={handleChange} />
              </label>

            </div>
          </section>

          <section className="config-panel" id="experiencia">
            <div className="config-panel-heading">
              <h2>{t("Apariencia y accesibilidad")}</h2>
              <p>{t("Preferencias que cambian cómo se siente la aplicación en este dispositivo.")}</p>
            </div>

            <div className="config-actions-list">
              <label className="config-switch-row">
                <div>
                  <strong>{t("Reducir movimiento")}</strong>
                  <span>{t("Desactiva animaciones y transiciones que no sean necesarias.")}</span>
                </div>
                <input type="checkbox" name="reducirMovimiento" checked={ajustes.reducirMovimiento} onChange={handleChange} />
              </label>

              <div className="config-action-row">
                <div>
                  <strong>{t("Restablecer preferencias")}</strong>
                  <span>{t("Vuelve a activar las notificaciones y la experiencia visual predeterminada.")}</span>
                </div>
                <button type="button" onClick={restablecerPreferencias}>{t("Restablecer")}</button>
              </div>
            </div>
          </section>

          <section className="config-panel config-danger" id="zona-cuenta">
            <div className="config-panel-heading">
              <h2>{t("Zona de cuenta")}</h2>
              <p>{t("Acciones sensibles que afectan tu acceso y datos.")}</p>
            </div>

            <div className="config-actions-list">
              <div className="config-action-row">
                <div>
                  <strong>{t("Descargar datos")}</strong>
                  <span>{t("Guarda una copia JSON de tu cuenta y configuración.")}</span>
                </div>
                <button type="button" disabled={!usuario || descargando} onClick={descargarDatos}>
                  {descargando ? <><span className="config-spinner" />{t("Preparando...")}</> : t("Descargar")}
                </button>
              </div>

              <div className="config-action-row">
                <div>
                  <strong>{t("Eliminar cuenta")}</strong>
                  <span>{t("Elimina permanentemente tu perfil, publicaciones, eventos e interacciones.")}</span>
                </div>
                <button className="config-danger-button" type="button" onClick={() => setMostrarEliminar(true)}>
                  {t("Eliminar")}
                </button>
              </div>
            </div>
          </section>

          <div className="config-savebar">
            {cargando ? (
              <span>{t("Cargando tu configuración...")}</span>
            ) : hayCambios ? (
              <p className="config-unsaved"><span aria-hidden="true">●</span> {t("Tenés cambios sin guardar")}</p>
            ) : (
              <p className="config-saved"><span aria-hidden="true">✓</span> {t("Todos los cambios están guardados")}</p>
            )}
            <button type="submit" disabled={cargando || guardando || !usuario || !hayCambios}>
              {guardando ? <><span className="config-spinner" />{t("Guardando...")}</> : hayCambios ? t("Guardar cambios") : t("Guardado")}
            </button>
          </div>
        </div>
      </form>

      {mensaje ? (
        <div className={`config-toast ${mensaje.tipo}`} role="status" aria-live="polite">
          <span className="config-toast-icon" aria-hidden="true">{mensaje.tipo === "success" ? "✓" : "!"}</span>
          <div>
            <strong>{mensaje.tipo === "success" ? t("Listo") : t("Algo salió mal")}</strong>
            <p>{mensaje.texto}</p>
          </div>
          <button type="button" onClick={() => setMensaje(null)} aria-label={t("Cerrar aviso")}>×</button>
        </div>
      ) : null}

      {mostrarPassword && (
        <div className="config-modal-backdrop" role="presentation" onMouseDown={() => !cambiandoPassword && setMostrarPassword(false)}>
          <form className="config-modal" role="dialog" aria-modal="true" aria-labelledby="password-title" onSubmit={cambiarPassword} onMouseDown={(e) => e.stopPropagation()}>
            {passwordActualizada ? (
              <div className="config-password-success">
                <span aria-hidden="true">✓</span>
                <h2 id="password-title">Contraseña actualizada</h2>
                <p>El cambio se guardó correctamente.</p>
              </div>
            ) : (
              <>
                <h2 id="password-title">Cambiar contraseña</h2>
                <p>Vas a ver una confirmación clara cuando Supabase acepte y guarde el cambio.</p>
                <label>
                  Nueva contraseña
                  <div className="config-password-control">
                    <input type={passwordVisible ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
                    <button type="button" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}>
                      {passwordVisible ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                </label>
                <div className="config-password-strength" aria-label={`Seguridad de contraseña: ${fuerzaPassword} de 4`}>
                  {[1, 2, 3, 4].map((nivel) => <span className={fuerzaPassword >= nivel ? "active" : ""} key={nivel} />)}
                </div>
                <small className="config-password-help">8 caracteres, mayúscula, minúscula, número y símbolo.</small>
                <label>
                  Repetir contraseña
                  <input className={passwordRepetida && password !== passwordRepetida ? "input-error" : ""} type={passwordVisible ? "text" : "password"} value={passwordRepetida} onChange={(e) => setPasswordRepetida(e.target.value)} autoComplete="new-password" />
                  {passwordRepetida ? <small className={password === passwordRepetida ? "password-match" : "password-mismatch"}>{password === passwordRepetida ? "✓ Las contraseñas coinciden" : "Las contraseñas todavía no coinciden"}</small> : null}
                </label>
                <div className="config-modal-actions">
                  <button type="button" onClick={() => setMostrarPassword(false)} disabled={cambiandoPassword}>Cancelar</button>
                  <button type="submit" disabled={cambiandoPassword || password.length < 8 || password !== passwordRepetida}>
                    {cambiandoPassword ? <><span className="config-spinner" />Guardando contraseña...</> : "Guardar nueva contraseña"}
                  </button>
                </div>
              </>
            )}
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
