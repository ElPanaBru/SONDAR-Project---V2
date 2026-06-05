import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiUrl } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import "./auth.css";

const mensajesSupabase = {
  "Invalid login credentials": "Email o contraseña incorrectos",
  "Email not confirmed": "Tenes que confirmar tu correo antes de ingresar",
  "User already registered": "El correo ya esta registrado",
  "Password should be at least 6 characters": "La contraseña debe tener al menos 6 caracteres"
};

export default function Auth() {
  const [modo, setModo] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const modoURL = params.get("modo");
    setModo(modoURL === "registro" ? "registro" : "login");
  }, [location.search]);

  const traducirError = (error) => {
    if (!error) return "Ocurrio un error inesperado.";
    return mensajesSupabase[error.message] || error.message;
  };

  const crearPerfilBackend = async (accessToken, cleanUsername) => {
    const response = await fetch(apiUrl("/api/usuarios/registrar"), {
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
    const response = await fetch(apiUrl("/api/usuarios/me"), {
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
    const cleanPassword = password.trim();
    const cleanUsername = username.trim();

    try {
      if (modo === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword
        });

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

      const crearCuentaResponse = await fetch(apiUrl("/api/usuarios/crear-cuenta"), {
        method: "POST",
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

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword
      });

      if (loginError) throw loginError;

      navigate("/");
    } catch (error) {
      setMensaje(traducirError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="switch-container">
        <button
          type="button"
          onClick={() => { setModo("login"); setMensaje(""); }}
          className={`switch-btn ${modo === "login" ? "active" : ""}`}
        >
          Login
        </button>

        <button
          type="button"
          onClick={() => { setModo("registro"); setMensaje(""); }}
          className={`switch-btn ${modo === "registro" ? "active" : ""}`}
        >
          Registro
        </button>
      </div>

      <h2>{modo === "login" ? "Iniciar sesion" : "Crear cuenta"}</h2>

      <form onSubmit={handleSubmit}>
        {modo === "registro" && (
          <input
            type="text"
            placeholder="Nombre de usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="auth-input"
          />
        )}

        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="auth-input"
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="auth-input"
        />

        <button type="submit" disabled={loading} className="auth-btn">
          {loading
            ? (modo === "login" ? "Ingresando..." : "Registrando...")
            : (modo === "login" ? "Ingresar" : "Registrarse")}
        </button>
      </form>

      {mensaje && <p className="auth-msg">{mensaje}</p>}
    </div>
  );
}
