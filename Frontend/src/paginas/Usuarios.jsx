import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function mapearUsuario(row) {
  return {
    id: row.id,
    nombre: row.artist_name || row.full_name || row.username || row.email?.split("@")[0] || "Usuario SONDAR"
  };
}

function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    async function cargarUsuarioActual() {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user?.id;
      if (!userId) {
        setUsuarios([]);
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("id,email,username,full_name,artist_name")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      setUsuarios(data ? [mapearUsuario(data)] : []);
    }

    cargarUsuarioActual().catch((error) => {
      console.error("No se pudieron cargar los usuarios:", error);
      setUsuarios([]);
    });
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
