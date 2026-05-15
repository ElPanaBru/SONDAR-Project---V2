import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebaseConfig";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      setMensaje(`Bienvenido ${userCredential.user.email}`);

      // 🔥 redirección
      navigate("/");

    } catch (error) {
      console.error(error);

      switch (error.code) {
        case "auth/user-not-found":
          setMensaje("Usuario no encontrado");
          break;
        case "auth/wrong-password":
          setMensaje("Contraseña incorrecta");
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
      <h2>Login</h2>

      <form onSubmit={handleSubmit}>
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
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>

      {mensaje && <p style={styles.msg}>{mensaje}</p>}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "300px",
    margin: "100px auto",
    textAlign: "center",
  },
  input: {
    width: "100%",
    padding: "8px",
    marginTop: "10px",
  },
  btn: {
    width: "100%",
    padding: "10px",
    marginTop: "15px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  msg: {
    marginTop: "15px",
  },
};
