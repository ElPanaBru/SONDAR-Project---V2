import { backendFetchJson } from "./backendClient";

function normalizarUsername(valor = "") {
  return String(valor).trim().replace(/^@+/, "").toLowerCase();
}

function generarUsernameSeguro(user) {
  const usernameElegido = normalizarUsername(user?.user_metadata?.username);
  if (/^[a-z0-9._-]{3,30}$/.test(usernameElegido)) {
    return usernameElegido;
  }

  const base =
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "usuario";

  const limpio = normalizarUsername(base).replace(/[^a-z0-9._-]/g, "").slice(0, 21) || "usuario";
  return `${limpio}_${user.id.slice(0, 8)}`;
}

export async function asegurarPerfilSupabase(user) {
  if (!user?.id) {
    throw new Error("No se obtuvo el usuario de Supabase.");
  }

  return backendFetchJson("/api/usuarios/registrar", {
    method: "POST",
    body: JSON.stringify({
      username: generarUsernameSeguro(user),
      user_type: "musico"
    })
  });
}
