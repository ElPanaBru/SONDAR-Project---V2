/**
 * Compatibilidad temporal para importaciones antiguas.
 *
 * El esquema ya no se modifica al iniciar el servidor. Los cambios de
 * configuracion viven en supabase/migrations y deben aplicarse como parte del
 * despliegue, con permisos y observabilidad propios de una migracion.
 */
async function asegurarEsquemaConfiguracion() {
  return undefined;
}

module.exports = { asegurarEsquemaConfiguracion };
