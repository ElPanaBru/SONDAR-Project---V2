const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { listarMigraciones, leerSql, resolverSql, ALIASES } = require('../database/catalogoSql');
const { GENEROS_MUSICALES } = require('../services/generos');

function verificarRepositorio() {
  const migraciones = listarMigraciones();
  assert.ok(migraciones.length >= 5, 'Falta el historial canonico');
  assert.equal(new Set(migraciones.map(n => n.slice(0, 14))).size, migraciones.length, 'Versiones SQL duplicadas');
  for (const nombre of migraciones) assert.ok(leerSql(nombre).trim(), `Migracion vacia: ${nombre}`);
  for (const alias of Object.keys(ALIASES)) resolverSql(alias);
  const seed = fs.readFileSync(path.resolve(__dirname, '../../supabase/seed.sql'), 'utf8');
  const generosSeed = [...seed.matchAll(/\('([a-z]+)',/g)].map(m => m[1]);
  assert.deepEqual(generosSeed, GENEROS_MUSICALES, 'El seed no coincide con shared/generos.json');
  return { ok: true, migraciones, generos: generosSeed, modo: 'offline-sin-ejecutar-sql' };
}

if (require.main === module) {
  try { console.log(JSON.stringify(verificarRepositorio(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { verificarRepositorio };
