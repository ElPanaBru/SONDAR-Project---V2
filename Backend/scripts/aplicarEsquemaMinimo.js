// Compatibilidad de comando. El esquema vigente se valida sin retirar tablas/columnas.
const { main } = require('./verificarBase');
if (process.argv.slice(2).some(arg => arg !== '--check')) {
  console.error('Los modos destructivos del esquema minimo fueron retirados. Consultar docs/BASE_DE_DATOS.md y db:aplicar.');
  process.exitCode = 1;
} else {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
