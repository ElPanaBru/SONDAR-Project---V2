import { supabase } from "../lib/supabaseClient";
const API_URL = import.meta.env.VITE_API_URL;
export async function avisarDenunciaASoporte({
  tipo,
  contenidoId,
  titulo,
  autor,
  motivo,
  detalle,
  nombreUsuario,
  url,
}) {
  const urlContenido = url || window.location.href;

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) {
    throw sessionError;
  }
  if (!session?.access_token) {
    throw new Error("Debes iniciar sesión para enviar una denuncia.");
  }

  const response = await fetch(`${API_URL}/api/soporte`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      tipo: "denuncia",
      contenidoTipo: tipo,
      contenidoId,
      titulo,
      autor,
      motivo,
      detalle,
      nombreUsuario,
      url: urlContenido,
    }),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    // La respuesta puede no contener JSON.
  }

  if (!response.ok) {
    throw new Error(
      data?.error || "No se pudo enviar la denuncia al equipo de soporte."
    );
  }

  return data;
}