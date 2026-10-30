// Compatible conserva las reparaciones de instalaciones anteriores.
// Manual deja todo el DDL a los SQL que el operador decide aplicar.
function esquemaAutomatico() {
  const modo = process.env.SONDAR_SCHEMA_MODE || 'compatible';
  if (!['compatible', 'manual'].includes(modo)) throw new Error('SONDAR_SCHEMA_MODE debe ser compatible o manual.');
  return modo === 'compatible';
}

module.exports = { esquemaAutomatico };
