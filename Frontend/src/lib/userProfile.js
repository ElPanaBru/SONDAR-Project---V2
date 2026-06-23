import { supabase } from "./supabaseClient";

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

  const email = user.email || `${user.id}@sin-email.local`;
  const { data: perfil, error: perfilError } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (perfilError) {
    throw perfilError;
  }

  if (perfil) {
    const { error } = await supabase
      .from("users")
      .update({ email })
      .eq("id", user.id);

    if (error) {
      throw error;
    }

    return { existe: true };
  }

  const { error } = await supabase.from("users").insert([
    {
      id: user.id,
      email,
      username: generarUsernameSeguro(user),
      user_type: "musico"
    }
  ]);

  if (error) {
    throw error;
  }

  return { existe: false };
}
