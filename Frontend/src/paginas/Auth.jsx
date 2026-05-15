import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
} from "firebase/auth";
import { auth } from "./firebaseConfig";
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
    if (modoURL === "registro") setModo("registro");
    else setModo("login");
  }, [location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");
    setLoading(true);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    const cleanUsername = username.trim();

    try {
      let userCredential;

      if (modo === "login") {
        userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
        const user = userCredential.user;

        // URL corregida con backticks para evitar errores
        const response = await fetch(`http://localhost:3000/api/usuarios/verificar/${user.uid}`);
        const data = await response.json();

        if (!data.existe) {
          await auth.signOut();
          setMensaje("Error: Usuario no registrado en la base de datos.");
          setLoading(false);
          return;
        }
        navigate("/");

      } else if (modo === "registro") {
        userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
        const user = userCredential.user;

        try {
          const response = await fetch('http://127.0.0.1:3000/api/usuarios/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              uid: user.uid, 
              email: user.email,
              username: cleanUsername 
            })
          });

          if (!response.ok) throw new Error("Fallo en base de datos");
          navigate("/");

        } catch (dbError) {
          console.error("Error de DB:", dbError); // Uso de dbError para evitar el warning
          await deleteUser(user);
          throw new Error("No se pudo vincular con el servidor. Intente de nuevo.");
        }
      }
    } catch (error) {
      const erroresFirebase = {
        "auth/user-not-found": "Usuario no encontrado",
        "auth/wrong-password": "Contraseña incorrecta",
        "auth/email-already-in-use": "El correo ya está registrado",
        "auth/weak-password": "La contraseña es muy corta",
        "auth/invalid-credential": "Email o contraseña incorrectos",
        "auth/invalid-email": "Correo inválido",
        "auth/too-many-requests": "Demasiados intentos. Probá más tarde"
      };
      setMensaje(erroresFirebase[error.code] || error.message);
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

      <h2>{modo === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>

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