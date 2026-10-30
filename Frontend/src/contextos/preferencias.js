import { createContext, useContext } from "react";

export const PreferenciasContext = createContext(null);

export function usePreferencias() {
  const contexto = useContext(PreferenciasContext);
  if (!contexto) throw new Error("usePreferencias debe usarse dentro de PreferenciasProvider");
  return contexto;
}
