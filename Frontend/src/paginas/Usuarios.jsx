import { useEffect, useState } from "react";

function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    // Endpoint real del backend: /api/usuarios (ajustar cuando exista ruta para listar)
    fetch("http://localhost:3000/api/usuarios/me", {
      method: "GET",
      headers: {
        // Si se quiere hacer público, se puede exponer un endpoint/listado. Por ahora requiere auth.
        // token se obtiene desde Supabase en Auth/Evento, aquí lo dejamos sin implementar.
      }
    })
      .then((res) => res.json())
      .then((data) => setUsuarios(Array.isArray(data) ? data : [data]));
  }, []);

  return (
    <div>
      {usuarios.map(u => (
        <p key={u.id}>{u.nombre}</p>
      ))}
    </div>
  );
}

export default Usuarios;