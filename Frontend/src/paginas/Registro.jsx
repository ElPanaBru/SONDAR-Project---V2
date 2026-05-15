import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebaseConfig";

export default function Register({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setMensaje("");
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      setMensaje(`Usuario ${userCredential.user.email} creado con éxito`);
      setEmail("");
      setPassword("");

    } catch (error) {
      console.error(error);

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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2>Registro</h2>

      <form onSubmit={handleRegister}>
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
        />

        <button type="submit" disabled={loading} style={styles.btn}>
          <Link to="/inicio">Registrarse</Link>
        </button>
      </form>

      <p style={styles.msg}>{mensaje}</p>

      <p>
        ¿Ya tenés cuenta?{" "}
        <button onClick={onSwitch} style={styles.linkBtn}>
          Iniciar sesión
        </button>
      </p>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "320px",
    margin: "100px auto",
    padding: "20px",
    border: "1px solid #ccc",
    borderRadius: "10px",
    textAlign: "center",
  },
  input: {
    width: "100%",
    padding: "8px",
    margin: "8px 0",
  },
  btn: {
    width: "100%",
    padding: "10px",
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#1976d2",
    cursor: "pointer",
    textDecoration: "underline",
  },
  msg: {
    marginTop: "15px",
  },
};