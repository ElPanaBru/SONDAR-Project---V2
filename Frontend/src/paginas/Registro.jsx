import { useState } from "react";
import { Link } from "react-router-dom";
import { register } from "./localAuth";

export default function Register({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = (e) => {
    e.preventDefault();
    setMensaje("");
    setLoading(true);

    try {
      const user = register({
        email: email.trim(),
        password: password.trim(),
        username: email.trim().split("@")[0],
      });

      setMensaje(`Usuario ${user.email} creado con exito`);
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error(error);
      setMensaje("Error: " + error.message);
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
          placeholder="Contrasena"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
        />

        <button type="submit" disabled={loading} style={styles.btn}>
          {loading ? "Registrando..." : "Registrarse"}
        </button>
      </form>

      <p style={styles.msg}>{mensaje}</p>

      <p>
        Ya tenes cuenta?{" "}
        {onSwitch ? (
          <button onClick={onSwitch} style={styles.linkBtn}>
            Iniciar sesion
          </button>
        ) : (
          <Link to="/auth?modo=login" style={styles.link}>
            Iniciar sesion
          </Link>
        )}
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
  link: {
    color: "#1976d2",
    textDecoration: "underline",
  },
  msg: {
    marginTop: "15px",
  },
};
