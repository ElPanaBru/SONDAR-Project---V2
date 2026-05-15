import { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "./firebaseConfig";
import { useLocation } from "react-router-dom";
import "./auth.css";

export default function Auth() {
  const [modo, setModo] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");
    setLoading(true);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
      let userCredential;

      if (modo === "login") {
        userCredential = await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          cleanPassword
        );
      } else {
        userCredential = await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          cleanPassword
        );
      }

      setMensaje(`Bienvenido ${userCredential.user.email}`);
      setEmail("");
      setPassword("");
      navigate("/");

    } catch (error) {
      console.error(error);

      if (modo === "login") {
        switch (error.code) {
          case "auth/user-not-found":
            setMensaje("Usuario no encontrado");
            break;
          case "auth/wrong-password":
            setMensaje("Contraseña incorrecta");
            break;
          case "auth/invalid-credential":
            setMensaje("Email o contraseña incorrectos");
            break;
          case "auth/invalid-email":
            setMensaje("Correo inválido");
            break;
          case "auth/too-many-requests":
            setMensaje("Demasiados intentos. Probá más tarde");
            break;
          default:
            setMensaje("Error: " + error.message);
        }
      } else {
        switch (error.code) {
          case "auth/email-already-in-use":
            setMensaje("El correo ya está registrado");
            break;
          case "auth/weak-password":
            setMensaje("La contraseña debe tener al menos 6 caracteres");
            break;
          case "auth/invalid-email":
            setMensaje("Correo inválido");
            break;
          case "auth/too-many-requests":
            setMensaje("Demasiados intentos. Probá más tarde");
            break;
          default:
            setMensaje("Error: " + error.message);
        }
      }
    } finally {
      setLoading(false);
    }
  };
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const modoURL = params.get("modo");
    if (modoURL === "registro") setModo("registro");
      else setModo("login");
    },
  [location.search]);

  return (
    <div className="auth-container">
      <div className="switch-container">
        <button
          onClick={() => {
            setModo("login");
            setMensaje("");
          }}
          className={`switch-btn ${modo === "login" ? "active" : ""}`}
        >
          Login
        </button>

        <button
          onClick={() => {
            setModo("registro");
            setMensaje("");
          }}
          className={`switch-btn ${modo === "registro" ? "active" : ""}`}
        >
          Registro
        </button>
      </div>

      <h2>{modo === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>

      <form onSubmit={handleSubmit}>
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
            ? modo === "login"
              ? "Ingresando..."
              : "Registrando..."
            : modo === "login"
            ? "Ingresar"
            : "Registrarse"}
        </button>
      </form>

      {mensaje && <p className="auth-msg">{mensaje}</p>}
    </div>
  );
}