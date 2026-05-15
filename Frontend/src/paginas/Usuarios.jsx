import { useEffect, useState } from "react";

function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3000/api/usuarios")
      .then(res => res.json())
      .then(data => setUsuarios(data));
  }, []);

  return (
    <div>
      {usuarios.map(u => (
        <p key={u.id}>{u.username || u.email}</p>
      ))}
    </div>
  );
}

export default Usuarios;
