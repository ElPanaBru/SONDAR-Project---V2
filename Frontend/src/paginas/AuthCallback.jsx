import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { asegurarPerfilSupabase } from "../lib/userProfile";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let activo = true;

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) {
        throw error;
      }

      if (data.session?.user) {
        await asegurarPerfilSupabase(data.session.user);
      }

      if (activo) {
        navigate("/");
      }
    }).catch(() => {
      if (activo) {
        navigate("/auth");
      }
    });

    return () => {
      activo = false;
    };
  }, [navigate]);

  return <p>Iniciando sesiÃ³n...</p>;
}
