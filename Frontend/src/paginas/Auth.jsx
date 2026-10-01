import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import { usePreferencias } from "../contextos/PreferenciasContext";
import "./auth.css";

const mensajesSupabase = {
  "Invalid login credentials": "Email o contraseña incorrectos",
  "Email not confirmed": "Tenes que confirmar tu correo antes de ingresar",
  "User already registered": "El correo ya esta registrado",
  "Password should be at least 6 characters": "La contraseña debe tener al menos 6 caracteres",
  "Password should be at least 8 characters": "La contraseña debe tener al menos 8 caracteres"
};

export default function Auth() {
  const { t } = usePreferencias();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepetida, setPasswordRepetida] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [username, setUsername] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const modo =
    new URLSearchParams(location.search).get("modo") === "registro"
      ? "registro"
      : "login";

  const fuerzaPassword = useMemo(() => {
    let puntos = 0;

    if (password.length >= 8) puntos += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) puntos += 1;
    if (/\d/.test(password)) puntos += 1;
    if (/[^A-Za-z0-9]/.test(password)) puntos += 1;

    return puntos;
  }, [password]);

  const traducirError = (error) => {
    if (!error) return "Ocurrio un error inesperado.";

    return mensajesSupabase[error.message] || error.message;
  };

  const esperarConTimeout = (promesa, mensaje, timeoutMs = 15000) => (
    new Promise((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error(mensaje)),
        timeoutMs
      );

      promesa
        .then(resolve)
        .catch(reject)
        .finally(() => window.clearTimeout(timeout));
    })
  );

  const crearPerfilBackend = async (accessToken, cleanUsername) => {
    const response = await apiRequest("/api/usuarios/registrar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        username: cleanUsername
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));

      throw new Error(
        data.error || "No se pudo crear el perfil en el servidor."
      );
    }
  };

  const verificarPerfilBackend = async (accessToken) => {
    const response = await apiRequest("/api/usuarios/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (response.status === 404) {
      return { existe: false };
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));

      throw new Error(
        data.error
          ? `${response.status} - ${data.error}`
          : `${response.status} - No se pudo verificar el perfil en el servidor.`
      );
    }

    return response.json();
  };

  /*
   * Procesa una sesión de Supabase.
   *
   * Esto es especialmente importante después de que el usuario
   * confirma su correo electrónico.
   *
   * Supabase recupera la sesión y esta función:
   *
   * 1. Comprueba si existe el perfil de SONDAR.
   * 2. Si no existe, lo crea usando el username guardado
   *    en user_metadata durante el registro.
   * 3. Redirige al usuario automáticamente.
   */
  const procesarSesion = async (session) => {
    if (!session?.access_token || !session?.user) {
      return false;
    }

    const accessToken = session.access_token;
    const user = session.user;

    try {
      const perfil = await verificarPerfilBackend(accessToken);

      if (!perfil.existe) {
        const pendingUsername =
          user.user_metadata?.username ||
          window.localStorage.getItem("sondar:pending-username");

        if (!pendingUsername) {
          await supabase.auth.signOut();

          setMensaje(
            "Error: no se encontró el nombre de usuario asociado a esta cuenta."
          );

          return false;
        }

        await crearPerfilBackend(
          accessToken,
          pendingUsername
        );
      }

      window.localStorage.removeItem("sondar:pending-username");
      window.localStorage.removeItem("sondar:onboarding-pending");

      navigate("/", { replace: true });

      return true;
    } catch (error) {
      console.error("Error procesando sesión:", error);

      setMensaje(
        error.message ||
        "No se pudo completar la configuración de tu cuenta."
      );

      return false;
    }
  };

  useEffect(() => {
  let activo = true;

  const procesarCallbackAuth = async () => {
    try {
      const hash = window.location.hash;

      const tieneAccessToken =
        hash.includes("access_token=") &&
        hash.includes("type=signup");

      if (tieneAccessToken) {
        console.log("Callback de verificación detectado.");

        const {
          data: { session },
          error
        } = await supabase.auth.getSession();

        if (!activo) return;

        if (error) {
          console.error(
            "Error recuperando sesión después de verificar:",
            error
          );
          setMensaje(
            "El correo fue verificado, pero no se pudo recuperar la sesión."
          );
          return;
        }

        if (session) {
          console.log("Sesión recuperada después de verificar.");

          /*
           * Eliminamos el hash de la URL.
           * El token ya fue procesado por Supabase.
           */
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.search
          );

          await procesarSesion(session);
        } else {
          console.error(
            "Supabase no devolvió una sesión después de verificar."
          );

          setMensaje(
            "El correo fue verificado, pero no se pudo iniciar la sesión automáticamente."
          );
        }

        return;
      }

      /*
       * Login normal o sesión ya existente.
       */
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!activo || !session) {
        return;
      }

      await procesarSesion(session);
    } catch (error) {
      console.error("Error procesando autenticación:", error);

      if (activo) {
        setMensaje(
          error.message ||
          "No se pudo completar la autenticación."
        );
      }
    }
  };

  procesarCallbackAuth();

  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (!activo) return;

    console.log("Supabase Auth Event:", event);

    if (event === "SIGNED_IN" && session) {
      setTimeout(() => {
        if (activo) {
          procesarSesion(session);
        }
      }, 0);
    }
  });

  return () => {
    activo = false;
    subscription.unsubscribe();
  };
}, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMensaje("");
    setLoading(true);

    const cleanEmail = email.trim();
    const cleanPassword = password;

    const cleanUsername = username
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();

    try {
      /*
       * ==========================
       * LOGIN
       * ==========================
       */
      if (modo === "login") {
        const { data, error } = await esperarConTimeout(
          supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPassword
          }),
          "El inicio de sesion tardo demasiado. Proba de nuevo."
        );

        if (error) {
          throw error;
        }

        if (!data?.session) {
          throw new Error("No se pudo recuperar la sesión.");
        }

        const procesado = await procesarSesion(data.session);

        if (!procesado) {
          return;
        }

        return;
      }

      /*
       * ==========================
       * VALIDACIONES DEL REGISTRO
       * ==========================
       */

      if (!cleanUsername) {
        setMensaje("El nombre de usuario es obligatorio.");
        return;
      }

      if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
        setMensaje(
          "El @ debe tener entre 3 y 30 caracteres y usar solo letras, numeros, punto, guion o guion bajo."
        );
        return;
      }

      if (fuerzaPassword < 4) {
        setMensaje(
          "La contraseña debe tener 8 caracteres e incluir mayúscula, minúscula, número y símbolo."
        );
        return;
      }

      if (cleanPassword !== passwordRepetida) {
        setMensaje("Las contraseñas no coinciden.");
        return;
      }

      /*
       * Guardamos temporalmente el username.
       *
       * Esto sirve como respaldo para cuando el usuario vuelva
       * desde el enlace de verificación.
       */
      window.localStorage.setItem(
        "sondar:pending-username",
        cleanUsername
      );

      /*
       * ==========================
       * REGISTRO CON SUPABASE AUTH
       * ==========================
       *
       * IMPORTANTE:
       *
       * Ya NO usamos:
       *
       * /api/usuarios/crear-cuenta
       *
       * Tampoco hacemos:
       *
       * signInWithPassword()
       *
       * después del registro.
       *
       * Supabase crea la cuenta y envía el email de confirmación.
       */

      const { data, error } = await esperarConTimeout(
        supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,

          options: {
            data: {
              username: cleanUsername
            },

            /*
             * Después de verificar el correo, Supabase
             * devolverá al usuario a esta página.
             *
             * window.location.origin permite que funcione tanto
             * en producción como durante desarrollo local.
             */
            emailRedirectTo: `${window.location.origin}/auth`
          }
        }),
        "El registro tardo demasiado. Proba de nuevo."
      );

      if (error) {
        throw error;
      }

      /*
       * Algunas configuraciones de Supabase pueden devolver
       * un usuario sin error cuando el email ya existe.
       *
       * Si identities está vacío, lo tratamos como usuario
       * ya registrado.
       */
      if (
        data?.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      ) {
        throw new Error("User already registered");
      }

      /*
       * Con "Confirm email" activado normalmente:
       *
       * data.user  -> existe
       * data.session -> null
       *
       * Eso significa que Supabase creó la cuenta pero espera
       * que el usuario confirme su correo.
       */

      if (!data?.session) {
        setMensaje(
          "Cuenta creada. Te enviamos un correo a tu email para verificar tu cuenta. Después de verificarlo, vas a entrar automáticamente a SONDAR."
        );

        setPassword("");
        setPasswordRepetida("");

        return;
      }

      /*
       * Si por alguna configuración Supabase devuelve una sesión
       * inmediatamente, procesamos la sesión normalmente.
       */
      await procesarSesion(data.session);
    } catch (error) {
      console.error("Error en autenticación:", error);

      /*
       * Si el registro falló, eliminamos el username temporal.
       */
      if (modo === "registro") {
        window.localStorage.removeItem("sondar:pending-username");
      }

      setMensaje(traducirError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-scene">
        <video
          className="auth-video"
          src="/auth-background.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onLoadedMetadata={(event) => {
            event.currentTarget.playbackRate = 1.45;
          }}
          aria-hidden="true"
        />

        <div className="auth-overlay" />

        <div className="auth-shell">
          <div className="auth-hero">
            <img
              className="sondar-brand-image auth-brand"
              src="/sondar-logo.png?v=19"
              alt="SONDAR"
            />

            <h1>{t("Tu música empieza acá.")}</h1>

            <p>
              Conecta con artistas, eventos y comunidades que estan sonando
              cerca tuyo.
            </p>
          </div>

          <div className="auth-card">
            <div
              className="switch-container"
              role="tablist"
              aria-label="Modo de acceso"
            >
              <button
                type="button"
                onClick={() => {
                  navigate("/auth");
                  setMensaje("");
                  setPasswordRepetida("");
                }}
                className={`switch-btn ${
                  modo === "login" ? "active" : ""
                }`}
                aria-selected={modo === "login"}
              >
                Login
              </button>

              <button
                type="button"
                onClick={() => {
                  navigate("/auth?modo=registro");
                  setMensaje("");
                  setPasswordRepetida("");
                }}
                className={`switch-btn ${
                  modo === "registro" ? "active" : ""
                }`}
                aria-selected={modo === "registro"}
              >
                Registro
              </button>
            </div>

            <div className="auth-heading">
              <span>
                {modo === "login"
                  ? "Bienvenido de vuelta"
                  : "Nuevo en SONDAR"}
              </span>

              <h2>
                {modo === "login"
                  ? t("Iniciar sesión")
                  : t("Crear cuenta")}
              </h2>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {modo === "registro" && (
                <label className="auth-field">
                  @ de usuario

                  <input
                    type="text"
                    placeholder="tu_usuario"
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        e.target.value
                          .replace(/^@+/, "")
                          .toLowerCase()
                      )
                    }
                    minLength={3}
                    maxLength={30}
                    pattern="[a-z0-9._-]{3,30}"
                    autoComplete="username"
                    required
                    className="auth-input"
                  />
                </label>
              )}

              <label className="auth-field">
                Correo

                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="auth-input"
                />
              </label>

              <label className="auth-field">
                Contraseña

                <div className="auth-password-control">
                  <input
                    type={passwordVisible ? "text" : "password"}
                    placeholder={
                      modo === "registro"
                        ? "Mínimo 8 caracteres"
                        : "Tu contraseña"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="auth-input"
                    autoComplete={
                      modo === "registro"
                        ? "new-password"
                        : "current-password"
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setPasswordVisible((visible) => !visible)
                    }
                  >
                    {passwordVisible ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </label>

              {modo === "registro" ? (
                <>
                  <div
                    className="auth-password-strength"
                    aria-label={`Seguridad de contraseña: ${fuerzaPassword} de 4`}
                  >
                    {[1, 2, 3, 4].map((nivel) => (
                      <span
                        className={
                          fuerzaPassword >= nivel ? "active" : ""
                        }
                        key={nivel}
                      />
                    ))}
                  </div>

                  <p className="auth-password-help">
                    8 caracteres, mayúscula, minúscula, número y símbolo.
                  </p>

                  <label className="auth-field">
                    Repetir contraseña

                    <input
                      type={passwordVisible ? "text" : "password"}
                      value={passwordRepetida}
                      onChange={(e) =>
                        setPasswordRepetida(e.target.value)
                      }
                      required
                      className={`auth-input ${
                        passwordRepetida &&
                        password !== passwordRepetida
                          ? "error"
                          : ""
                      }`}
                      autoComplete="new-password"
                    />

                    {passwordRepetida ? (
                      <small
                        className={
                          password === passwordRepetida
                            ? "auth-password-match"
                            : "auth-password-mismatch"
                        }
                      >
                        {password === passwordRepetida
                          ? "✓ Las contraseñas coinciden"
                          : "Las contraseñas todavía no coinciden"}
                      </small>
                    ) : null}
                  </label>
                </>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="auth-btn"
              >
                {loading
                  ? modo === "login"
                    ? "Ingresando..."
                    : "Registrando..."
                  : modo === "login"
                    ? "Ingresar"
                    : "Registrarse"}
              </button>
            </form>

            {mensaje && (
              <p className="auth-msg">
                {mensaje}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}