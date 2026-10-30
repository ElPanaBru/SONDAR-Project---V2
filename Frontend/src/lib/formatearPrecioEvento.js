export function formatearPrecioEvento(valor) {
  const precio = Number(valor);
  if (valor == null || String(valor).trim() === "" || !Number.isFinite(precio) || precio < 0) {
    return "Precio a confirmar";
  }
  return precio === 0 ? "Gratis" : "$" + precio.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}
