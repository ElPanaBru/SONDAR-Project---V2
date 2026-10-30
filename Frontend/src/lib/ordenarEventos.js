export function ordenarEventos(eventos, orden) {
  const [criterio, sentido] = orden.split("-");
  const campo = { precio: "precio", distancia: "distancia_km", fecha: "fecha" }[criterio];
  if (!campo) return eventos;

  const valor = (evento) => {
    const dato = evento[campo];
    if (dato == null || dato === "") return NaN;
    return criterio === "fecha" ? new Date(dato).getTime() : Number(dato);
  };
  const direccion = sentido === "desc" ? -1 : 1;
  return [...eventos].sort((a, b) => {
    const primero = valor(a);
    const segundo = valor(b);
    if (!Number.isFinite(primero)) return Number.isFinite(segundo) ? 1 : 0;
    if (!Number.isFinite(segundo)) return -1;
    return (primero - segundo) * direccion;
  });
}
