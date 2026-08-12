import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login, register } from "./localAuth";
import "./auth.css";

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

  const handleSubmit = (e) => {
    e.preventDefault();
    setMensaje("");
    setLoading(true);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    const cleanUsername = username.trim();

    try {
      if (modo === "login") {
        login(cleanEmail, cleanPassword);
      } else {
        register({
          email: cleanEmail,
          password: cleanPassword,
          username: cleanUsername,
        });
      }

      navigate("/");
    } catch (error) {
      setMensaje(error.message);
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
          placeholder="Contrasena"
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
