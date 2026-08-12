import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import { usePreferencias } from "../contextos/PreferenciasContext";
import "./auth.css";

const mensajesSupabase = {
  "Invalid login credentials": "Email o contraseña incorrectos",
  "Email not confirmed": "Tenes que confirmar tu correo antes de ingresar",
  "User already registered": "El correo ya esta registrado",
  "Password should be at least 6 characters": "La contraseña debe tener al menos 6 caracteres"
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
  const modo = new URLSearchParams(location.search).get("modo") === "registro" ? "registro" : "login";
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
      const timeout = window.setTimeout(() => reject(new Error(mensaje)), timeoutMs);
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
      body: JSON.stringify({ username: cleanUsername })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "No se pudo crear el perfil en el servidor.");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");
    setLoading(true);

    const cleanEmail = email.trim();
    const cleanPassword = password;
    const cleanUsername = username.trim().replace(/^@+/, "").toLowerCase();

    try {
      if (modo === "login") {
        const { data, error } = await esperarConTimeout(
          supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPassword
          }),
          "El inicio de sesion tardo demasiado. Proba de nuevo."
        );

        if (error) throw error;

        const perfil = await verificarPerfilBackend(data.session.access_token);

        if (!perfil.existe) {
          const pendingUsername = data.user?.user_metadata?.username;

          if (!pendingUsername) {
            await supabase.auth.signOut();
            setMensaje("Error: usuario no registrado en la base de datos.");
            return;
          }

          await crearPerfilBackend(data.session.access_token, pendingUsername);
        }

        navigate("/");
        return;
      }

      if (!cleanUsername) {
        setMensaje("El nombre de usuario es obligatorio.");
        return;
      }
      if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
        setMensaje("El @ debe tener entre 3 y 30 caracteres y usar solo letras, numeros, punto, guion o guion bajo.");
        return;
      }
      if (fuerzaPassword < 4) {
        setMensaje("La contraseña debe tener 8 caracteres e incluir mayúscula, minúscula, número y símbolo.");
        return;
      }
      if (cleanPassword !== passwordRepetida) {
        setMensaje("Las contraseñas no coinciden.");
        return;
      }

      const crearCuentaResponse = await apiRequest("/api/usuarios/crear-cuenta", {
        method: "POST",
        auth: false,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
          username: cleanUsername
        })
      });

      if (!crearCuentaResponse.ok) {
        const data = await crearCuentaResponse.json().catch(() => ({}));
        throw new Error(
          data.error
            ? `${crearCuentaResponse.status} - ${data.error}`
            : `${crearCuentaResponse.status} - No se pudo crear la cuenta.`
        );
      }

      let loginError = null;
      try {
        const loginResult = await esperarConTimeout(
          supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPassword
          }),
          "No se pudo iniciar sesion automaticamente."
        );
        loginError = loginResult.error;
      } catch (error) {
        loginError = error;
      }

      if (loginError) {
        setMensaje("Cuenta creada, pero no se pudo iniciar sesion automaticamente. Inicia sesion con tu email y contrasena.");
        navigate("/auth", { replace: true });
        return;
      }
      window.localStorage.setItem("sondar:onboarding-pending", "true");
      navigate("/");
    } catch (error) {
      setMensaje(traducirError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
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
          <img className="auth-brand" src="/logo/sondar-logo.png" alt="SONDAR" />
          <h1>{t("Tu música empieza acá.")}</h1>
          <p>Conecta con artistas, eventos y comunidades que estan sonando cerca tuyo.</p>
        </div>

        <div className="auth-card">
          <div className="switch-container" role="tablist" aria-label="Modo de acceso">
            <button
              type="button"
              onClick={() => { navigate("/auth"); setMensaje(""); setPasswordRepetida(""); }}
              className={`switch-btn ${modo === "login" ? "active" : ""}`}
              aria-selected={modo === "login"}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => { navigate("/auth?modo=registro"); setMensaje(""); setPasswordRepetida(""); }}
              className={`switch-btn ${modo === "registro" ? "active" : ""}`}
              aria-selected={modo === "registro"}
            >
              Registro
            </button>
          </div>

          <div className="auth-heading">
            <span>{modo === "login" ? "Bienvenido de vuelta" : "Nuevo en SONDAR"}</span>
            <h2>{modo === "login" ? t("Iniciar sesión") : t("Crear cuenta")}</h2>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {modo === "registro" && (
              <label className="auth-field">
                @ de usuario
                <input
                  type="text"
                  placeholder="tu_usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/^@+/, "").toLowerCase())}
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
                  placeholder={modo === "registro" ? "Mínimo 8 caracteres" : "Tu contraseña"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="auth-input"
                  autoComplete={modo === "registro" ? "new-password" : "current-password"}
                />
                <button type="button" onClick={() => setPasswordVisible((visible) => !visible)}>
                  {passwordVisible ? "Ocultar" : "Ver"}
                </button>
              </div>
            </label>

            {modo === "registro" ? (
              <>
                <div className="auth-password-strength" aria-label={`Seguridad de contraseña: ${fuerzaPassword} de 4`}>
                  {[1, 2, 3, 4].map((nivel) => <span className={fuerzaPassword >= nivel ? "active" : ""} key={nivel} />)}
                </div>
                <p className="auth-password-help">8 caracteres, mayúscula, minúscula, número y símbolo.</p>
                <label className="auth-field">
                  Repetir contraseña
                  <input
                    type={passwordVisible ? "text" : "password"}
                    value={passwordRepetida}
                    onChange={(e) => setPasswordRepetida(e.target.value)}
                    required
                    className={`auth-input ${passwordRepetida && password !== passwordRepetida ? "error" : ""}`}
                    autoComplete="new-password"
                  />
                  {passwordRepetida ? (
                    <small className={password === passwordRepetida ? "auth-password-match" : "auth-password-mismatch"}>
                      {password === passwordRepetida ? "✓ Las contraseñas coinciden" : "Las contraseñas todavía no coinciden"}
                    </small>
                  ) : null}
                </label>
              </>
            ) : null}

            <button type="submit" disabled={loading} className="auth-btn">
              {loading
                ? (modo === "login" ? "Ingresando..." : "Registrando...")
                : (modo === "login" ? "Ingresar" : "Registrarse")}
            </button>
          </form>

          {mensaje && <p className="auth-msg">{mensaje}</p>}
        </div>
      </div>
    </section>
  );
}
