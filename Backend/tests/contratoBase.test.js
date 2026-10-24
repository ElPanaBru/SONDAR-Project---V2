const assert = require('node:assert/strict');
const test = require('node:test');
const { tablasDelSnapshot, cuerpoTransaccional, resolverSql, MIGRACION_ACTUAL } = require('../database/catalogoSql');
const { verificarContrato, COLUMNAS_REQUERIDAS, TABLAS_HISTORICAS } = require('../database/verificarContrato');
const { GENEROS_MUSICALES } = require('../services/generos');
const { actualizar } = require('../scripts/actualizarBaseLocal');

function baseFalsa({ sin = [], alterada = false, falloMigracion = false, metal = false } = {}) {
  const consultas = [];
  const tablas = tablasDelSnapshot().filter(t => !sin.includes(t)).concat('mi_tabla_personal');
  const columnas = Object.entries(COLUMNAS_REQUERIDAS).flatMap(([table_name, nombres]) => nombres.map(column_name => ({ table_name, column_name })));
  let migrada = false;
  return { consultas, async query(sql) {
    consultas.push(sql);
    if (sql.includes('pg_tables')) return { rows: tablas.map(tablename => ({ tablename })) };
    if (sql.startsWith('SELECT') && sql.includes('information_schema.columns')) return { rows: columnas.filter(c => !sin.includes(c.table_name)) };
    if (sql.startsWith('SELECT slug')) return { rows: GENEROS_MUSICALES.map(slug => ({ slug })) };
    if (sql.includes('equivalencias_generos')) {
      if (falloMigracion) throw new Error('Reggae tiene referencias');
      migrada = true;
    }
    if (sql.startsWith('SELECT * FROM public."eventos"')) return { rows: metal && migrada ? [] : [{ id: 1, genero: metal ? 'metal' : migrada ? 'urbano' : 'trap', lugar: alterada && migrada ? 'Otro lugar' : 'Sala' }] };
    if (sql.startsWith('SELECT * FROM public."users"')) return { rows: [{ id: 'usuario', username: 'artista' }] };
    return { rows: [] };
  } };
}

test('el contrato acepta tablas personales y no exige tablas historicas sin uso', async () => {
  const base = baseFalsa({ sin: [...TABLAS_HISTORICAS] });
  const resultado = await verificarContrato(base);
  assert.equal(resultado.ok, true);
  assert.deepEqual(resultado.tablasAdicionales, ['mi_tabla_personal']);
});

test('el contrato detecta la ausencia de guardados de previews', async () => {
  const resultado = await verificarContrato(baseFalsa({ sin: ['reel_saves'] }));
  assert.equal(resultado.ok, false);
  assert.ok(resultado.tablasFaltantes.includes('reel_saves'));
});

test('actualizar conserva contenido, normaliza genero y permite ensayar sin confirmar', async () => {
  const base = baseFalsa({ sin: ['user_genre_preferences'] });
  let respaldo;
  await actualizar(base, { dryRun: true, respaldar: datos => { respaldo = datos; } });
  assert.ok(base.consultas.some(sql => sql.includes('ADD COLUMN IF NOT EXISTS deletion_scheduled_at')));
  assert.equal(respaldo.eventos[0].genero, 'trap');
  assert.equal(base.consultas.at(-1), 'ROLLBACK');
  assert.ok(!base.consultas.includes('COMMIT'));
});

test('actualizar revierte si cambia contenido o una categoria exige revision manual', async () => {
  for (const escenario of [{ alterada: true }, { falloMigracion: true }]) {
    const base = baseFalsa(escenario);
    await assert.rejects(actualizar(base), /Cambio inesperado|Reggae tiene referencias/);
    assert.equal(base.consultas.at(-1), 'ROLLBACK');
    assert.ok(!base.consultas.includes('COMMIT'));
  }
});

test('los alias manuales resuelven una sola fuente y rechazan rutas externas', () => {
  assert.equal(resolverSql('Unificar_Generos_Definitivos.sql'), resolverSql('20261015182000_generos_definitivos.sql'));
  assert.ok(resolverSql(MIGRACION_ACTUAL).endsWith(MIGRACION_ACTUAL));
  for (const nombre of ['../seed.sql', 'C:\\secreto.sql', 'Esquema_Minimo_SONDAR.sql']) assert.throws(() => resolverSql(nombre));
  assert.equal(cuerpoTransaccional('BEGIN;\nDO $$ BEGIN\n NULL;\nEND $$;\nCOMMIT;').trim(), 'DO $$ BEGIN\n NULL;\nEND $$;');
});

test('el modo manual conserva la eleccion del operador sin DDL automatico', (t) => {
  const { esquemaAutomatico } = require('../services/schemaMode');
  const previo = process.env.SONDAR_SCHEMA_MODE;
  t.after(() => { if (previo === undefined) delete process.env.SONDAR_SCHEMA_MODE; else process.env.SONDAR_SCHEMA_MODE = previo; });
  process.env.SONDAR_SCHEMA_MODE = 'manual';
  assert.equal(esquemaAutomatico(), false);
  process.env.SONDAR_SCHEMA_MODE = 'compatible';
  assert.equal(esquemaAutomatico(), true);
  process.env.SONDAR_SCHEMA_MODE = 'desconocido';
  assert.throws(esquemaAutomatico, /compatible o manual/);
});

test('actualizar admite exclusivamente la eliminacion autorizada del contenido de Metal', async () => {
  const base = baseFalsa({ metal: true });
  const resultado = await actualizar(base, { dryRun: true });
  assert.equal(resultado.ok, true);
  assert.equal(base.consultas.at(-1), 'ROLLBACK');
});


test('el contrato detecta columnas faltantes de recuperacion de cuentas en modo manual', async () => {
  const base = baseFalsa();
  const consultar = base.query.bind(base);
  base.query = async (sql) => {
    const result = await consultar(sql);
    if (sql.includes('information_schema.columns')) {
      result.rows = result.rows.filter(c => c.column_name !== 'deletion_scheduled_at');
    }
    return result;
  };
  const resultado = await verificarContrato(base);
  assert.equal(resultado.ok, false);
  assert.ok(resultado.columnasFaltantes.includes('users.deletion_scheduled_at'));
});
