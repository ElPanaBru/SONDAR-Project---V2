import { useContext } from "react";
import { PreferenciasContext } from "../contextos/preferenciasBase";

export function usePreferencias() {
  const contexto = useContext(PreferenciasContext);
  if (!contexto) throw new Error("usePreferencias debe usarse dentro de PreferenciasProvider");
  return contexto;
}
