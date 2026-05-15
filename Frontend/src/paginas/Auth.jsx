import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
} from "firebase/auth";
import { auth } from "./firebaseConfig";
import { api } from "../api";
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

    if (modoURL === "registro") {
      setModo("registro");
    } else {
      setModo("login");
    }
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
        userCredential = await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          cleanPassword
        );

        const user = userCredential.user;

        const data = await api.verificarUsuario(user.uid);

        if (!data.existe) {
          await auth.signOut();
          setMensaje("Error: Usuario no registrado en la base de datos.");
          setLoading(false);
          return;
        }

        setMensaje(`Bienvenido ${userCredential.user.email}`);
        setEmail("");
        setPassword("");

        navigate("/");
      } else if (modo === "registro") {
        userCredential = await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          cleanPassword
        );

        const user = userCredential.user;

        try {
          await api.registrarUsuario({
            uid: user.uid,
            email: user.email,
            username: cleanUsername,
          });

          setMensaje(`Bienvenido ${userCredential.user.email}`);
          setEmail("");
          setPassword("");
          setUsername("");

          navigate("/");
        } catch (dbError) {
          await deleteUser(user);
          console.dir(dbError);

          throw new Error(
            "No se pudo vincular con el servidor. Intente de nuevo."
          );
        }
      }
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
            setMensaje(error.message || "Error al iniciar sesión");
        }
      } else {
        switch (error.code) {
          case "auth/email-already-in-use":
            setMensaje("El correo ya está registrado");
            break;

          case "auth/weak-password":
            setMensaje(
              "La contraseña debe tener al menos 6 caracteres"
            );
            break;

          case "auth/invalid-email":
            setMensaje("Correo inválido");
            break;

          case "auth/too-many-requests":
            setMensaje("Demasiados intentos. Probá más tarde");
            break;

          default:
            setMensaje(error.message || "Error al registrarse");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" style={styles.container}>
      <div
        className="switch-container"
        style={styles.switchContainer}
      >
        <button
          onClick={() => {
            setModo("login");
            setMensaje("");
          }}
          className={`switch-btn ${
            modo === "login" ? "active" : ""
          }`}
          style={{
            ...styles.switchBtn,
            background: modo === "login" ? "#1976d2" : "#eee",
            color: modo === "login" ? "#fff" : "#000",
          }}
        >
          Login
        </button>

        <button
          onClick={() => {
            setModo("registro");
            setMensaje("");
          }}
          className={`switch-btn ${
            modo === "registro" ? "active" : ""
          }`}
          style={{
            ...styles.switchBtn,
            background: modo === "registro" ? "#1976d2" : "#eee",
            color: modo === "registro" ? "#fff" : "#000",
          }}
        >
          Registro
        </button>
      </div>

      <h2>
        {modo === "login"
          ? "Iniciar sesión"
          : "Crear cuenta"}
      </h2>

      <form onSubmit={handleSubmit}>
        {modo === "registro" && (
          <input
            type="text"
            placeholder="Nombre de usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="auth-input"
            style={styles.input}
          />
        )}

        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="auth-input"
          style={styles.input}
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="auth-input"
          style={styles.input}
        />

        <button
          type="submit"
          disabled={loading}
          className="auth-btn"
          style={styles.btn}
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
        <p className="auth-msg" style={styles.msg}>
          {mensaje}
        </p>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "340px",
    margin: "100px auto",
    padding: "20px",
    border: "1px solid #ccc",
    borderRadius: "10px",
    textAlign: "center",
    backgroundColor: "#fff",
    color: "#000",
  },

  switchContainer: {
    display: "flex",
    marginBottom: "15px",
    borderRadius: "5px",
    overflow: "hidden",
  },

  switchBtn: {
    flex: 1,
    padding: "10px",
    border: "none",
    cursor: "pointer",
    transition: "0.2s",
  },

  input: {
    width: "100%",
    padding: "10px",
    margin: "8px 0",
    boxSizing: "border-box",
  },

  btn: {
    width: "100%",
    padding: "10px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    marginTop: "10px",
  },

  msg: {
    marginTop: "15px",
    fontSize: "14px",
    color: "#d32f2f",
  },
};
