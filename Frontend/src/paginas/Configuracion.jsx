import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import "./configuracion.css";

export default function Configuracion({ usuario }) {
  const [ajustes, setAjustes] = useState({
    email: usuario?.email || "",
    telefono: "",
    idioma: "es",
    zonaHoraria: "America/Argentina/Buenos_Aires",
    loginAlertas: true,
    newsletter: false,
    actividadCuenta: true,
    perfilPrivado: false,
    mostrarEmail: false,
    permitirMensajes: true,
  });

  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!usuario?.uid) return;

    api.obtenerConfiguracion(usuario.uid)
      .then((configuracion) => {
        setAjustes((prev) => ({
          ...prev,
          ...configuracion,
          email: configuracion.email || usuario.email || "",
        }));
      })
      .catch((error) => {
        console.error(error);
        setMensaje("No se pudo cargar la configuracion guardada.");
      });
  }, [usuario]);

  const nombreCuenta = useMemo(() => {
    if (usuario?.displayName) return usuario.displayName;
    if (usuario?.email) return usuario.email.split("@")[0];
    return "Cuenta SONDAR";
  }, [usuario]);

  const inicial = nombreCuenta.trim().charAt(0).toUpperCase() || "S";

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setAjustes((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const guardarAjustes = async (e) => {
    e.preventDefault();

    if (!usuario?.uid) {
      setMensaje("Inicia sesion para guardar la configuracion.");
      return;
    }

    setGuardando(true);
    try {
      const configuracion = await api.guardarConfiguracion(usuario.uid, ajustes);
      setAjustes(configuracion);
      setMensaje("Cambios guardados en la base de datos.");
    } catch (error) {
      console.error(error);
      setMensaje(error.message || "No se pudieron guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="config-page">
      <header className="config-header">
        <div>
          <p className="config-kicker">Cuenta</p>
          <h1>Configuracion</h1>
          <p>
            Ajustes generales de acceso, seguridad, privacidad y comunicaciones
            de tu cuenta.
          </p>
        </div>

        <div className="config-account">
          <div className="config-avatar" aria-hidden="true">
            {inicial}
          </div>
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
                <input
                  type="email"
                  name="email"
                  value={ajustes.email}
                  onChange={handleChange}
                  placeholder="tu@email.com"
                />
              </label>

              <label>
                Telefono
                <input
                  type="tel"
                  name="telefono"
                  value={ajustes.telefono}
                  onChange={handleChange}
                  placeholder="+54 9 11 0000 0000"
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
                <select
                  name="zonaHoraria"
                  value={ajustes.zonaHoraria}
                  onChange={handleChange}
                >
                  <option value="America/Argentina/Buenos_Aires">
                    Buenos Aires
                  </option>
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
                <button type="button">Cambiar</button>
              </div>

              <label className="config-switch-row">
                <div>
                  <strong>Alertas de inicio de sesion</strong>
                  <span>Recibi un aviso cuando haya actividad nueva.</span>
                </div>
                <input
                  type="checkbox"
                  name="loginAlertas"
                  checked={ajustes.loginAlertas}
                  onChange={handleChange}
                />
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
                <input
                  type="checkbox"
                  name="actividadCuenta"
                  checked={ajustes.actividadCuenta}
                  onChange={handleChange}
                />
              </label>

              <label className="config-switch-row">
                <div>
                  <strong>Novedades por email</strong>
                  <span>Resumenes, lanzamientos y recomendaciones de la plataforma.</span>
                </div>
                <input
                  type="checkbox"
                  name="newsletter"
                  checked={ajustes.newsletter}
                  onChange={handleChange}
                />
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
                <input
                  type="checkbox"
                  name="perfilPrivado"
                  checked={ajustes.perfilPrivado}
                  onChange={handleChange}
                />
              </label>

              <label className="config-switch-row">
                <div>
                  <strong>Mostrar email</strong>
                  <span>Permite que otros usuarios vean tu email de contacto.</span>
                </div>
                <input
                  type="checkbox"
                  name="mostrarEmail"
                  checked={ajustes.mostrarEmail}
                  onChange={handleChange}
                />
              </label>

              <label className="config-switch-row">
                <div>
                  <strong>Mensajes directos</strong>
                  <span>Habilita contactos desde comunidades y eventos.</span>
                </div>
                <input
                  type="checkbox"
                  name="permitirMensajes"
                  checked={ajustes.permitirMensajes}
                  onChange={handleChange}
                />
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
                  <span>Prepara una copia de la informacion de tu cuenta.</span>
                </div>
                <button type="button">Solicitar</button>
              </div>

              <div className="config-action-row">
                <div>
                  <strong>Eliminar cuenta</strong>
                  <span>Esta accion sera permanente cuando la conectemos.</span>
                </div>
                <button className="config-danger-button" type="button">
                  Eliminar
                </button>
              </div>
            </div>
          </section>

          <div className="config-savebar">
            {mensaje ? <p>{mensaje}</p> : <span>Los cambios aun no se enviaron.</span>}
            <button type="submit" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
