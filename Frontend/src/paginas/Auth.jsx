import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
} from "firebase/auth";
import { auth } from "./firebaseConfig";

export default function Auth() {
  const [modo, setModo] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(""); 
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

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

        const response = await fetch(`http://localhost:3000/api/usuarios/verificar/${user.uid}`);
        const data = await response.json();
        
        if (!data.existe) {
          await auth.signOut();
          setMensaje("Error: Usuario no registrado en la base de datos.");
          setLoading(false);
          return;
        }

        navigate("/inicio");

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

          navigate("/inicio");
          
        } catch (dbError) {
          await deleteUser(user);
          console.dir(dbError);
          throw new Error("No se pudo vincular con el servidor. Intente de nuevo.");
        }
      }
    } catch (error) {
      console.error(error);
      const erroresFirebase = {
        "auth/email-already-in-use": "El correo ya está registrado",
        "auth/weak-password": "La contraseña es muy corta",
        "auth/invalid-credential": "Credenciales incorrectas"
      };
      setMensaje(erroresFirebase[error.code] || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.switchContainer}>
        <button
          onClick={() => { setModo("login"); setMensaje(""); }}
          style={{
            ...styles.switchBtn,
            background: modo === "login" ? "#1976d2" : "#eee",
            color: modo === "login" ? "#fff" : "#000",
          }}
        >
          Login
        </button>

        <button
          onClick={() => { setModo("registro"); setMensaje(""); }}
          style={{
            ...styles.switchBtn,
            background: modo === "registro" ? "#1976d2" : "#eee",
            color: modo === "registro" ? "#fff" : "#000",
          }}
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
            style={styles.input}
          />
        )}

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
          {loading
            ? modo === "login" ? "Ingresando..." : "Registrando..."
            : modo === "login" ? "Ingresar" : "Registrarse"}
        </button>
      </form>

      {mensaje && <p style={styles.msg}>{mensaje}</p>}
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
    color: "#000"
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
    marginTop: "10px"
  },
  msg: {
    marginTop: "15px",
    fontSize: "14px",
    color: "#d32f2f"
  },
};