// Generacion offline desde un catalogo observado. No conecta a ninguna base.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const dir = path.join(root, 'docs/base-datos');
const db = JSON.parse(fs.readFileSync(path.join(dir, 'catalogo-observado.json'), 'utf8'));
const exclusions = JSON.parse(fs.readFileSync(path.join(dir, 'exclusiones.json'), 'utf8'));
const q = x => '"' + String(x).replaceAll('"', '""') + '"';
const lit = x => x === null ? 'NULL' : typeof x === 'boolean' ? String(x) : typeof x === 'number' ? String(x) : "'" + String(x).replaceAll("'", "''") + "'";
const role = x => x.toUpperCase() === 'PUBLIC' ? 'PUBLIC' : q(x);
const fq = table => 'public.' + q(table);
const removedTables = new Set(Object.keys(exclusions.tables));
// SELECT * es un contrato observable: el modo compatible conserva los 27
// candidatos expuestos por exportarDatosActuales/listar notificaciones.
const removedColumns = new Set(['user_settings.created_at']);
const tables = db.tables.filter(t => !removedTables.has(t.name));
const names = new Set(tables.map(t => t.name));
const columns = db.columns.filter(c => names.has(c.table_name) && !removedColumns.has(c.table_name + '.' + c.name));
const constraints = db.constraints.filter(c => names.has(c.table_name) && !exclusions.constraints[c.name]);
const indexes = db.indexes.filter(i => names.has(i.tablename));
const sequenceNames = new Set(db.sequence_columns.filter(s => names.has(s.table_name)).map(s => s.sequence_name));
const policies = db.policies.filter(p => p.schemaname !== 'public' || names.has(p.tablename));
const roles = new Set(['PUBLIC','anon','authenticated','service_role', ...db.grants.map(g => g.grantee), ...db.function_grants.map(g => g.grantee)]);
const write = (name, data) => fs.writeFileSync(path.join(dir, name), data + '\n', 'utf8');
const sql = ['-- SONDAR: instalacion compatible optimizada. SOLO destino Supabase vacio.',
  '-- Generado desde catalogo-observado.json; sin filas privadas. No es un backup.',
  '-- Ejecutar como postgres. No aplicar junto con 02 sobre el mismo destino.',
  'BEGIN;', "SET LOCAL search_path = public, extensions, gis, pg_catalog;", "SET LOCAL TIME ZONE 'UTC';",
  `DO $guard$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public') THEN
      RAISE EXCEPTION 'Destino public no vacio: usar restauracion completa y 02, no este instalador';
    END IF;
    IF to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL OR to_regclass('realtime.messages') IS NULL THEN
      RAISE EXCEPTION 'Se requiere un proyecto Supabase inicializado';
    END IF;
  END $guard$;`,
  'CREATE SCHEMA IF NOT EXISTS gis;', 'CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA gis;',
  'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;',
  `DO $guard$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='postgis' AND n.nspname='gis') THEN
      RAISE EXCEPTION 'PostGIS debe estar en gis';
    END IF;
  END $guard$;`];

for (const t of tables) {
  const defs = columns.filter(c => c.table_name === t.name).map(c => {
    let def = q(c.name) + ' ' + c.type;
    if (c.generated) throw new Error('Columna generada no soportada: ' + t.name + '.' + c.name);
    if (c.identity) {
      const rel = db.sequence_columns.find(s => s.table_name === t.name && s.column_name === c.name);
      const s = db.sequences.find(s => s.sequencename === rel?.sequence_name);
      if (!s) throw new Error('Secuencia identity faltante');
      def += ` GENERATED ${c.identity === 'a' ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY (SEQUENCE NAME public.${q(s.sequencename)} START WITH ${s.start_value} INCREMENT BY ${s.increment_by} MINVALUE ${s.min_value} MAXVALUE ${s.max_value} CACHE ${s.cache_size}${s.cycle ? ' CYCLE' : ' NO CYCLE'})`;
    } else if (c.default_value !== null) def += ' DEFAULT ' + c.default_value;
    if (c.not_null) def += ' NOT NULL';
    return '  ' + def;
  });
  sql.push(`CREATE TABLE ${fq(t.name)} (\n${defs.join(',\n')}\n);`);
}
for (const type of ['p','u','c','f']) for (const c of constraints.filter(c => c.type === type)) {
  sql.push(`ALTER TABLE ${fq(c.table_name)} ADD CONSTRAINT ${q(c.name)} ${c.definition};`);
}
for (const i of indexes) {
  if (!constraints.some(c => c.table_name === i.tablename && ['p','u'].includes(c.type) && c.name === i.indexname)) sql.push(i.indexdef + ';');
}
sql.push('SET LOCAL check_function_bodies = false;');
for (const f of db.functions) sql.push(f.definition.trim() + ';');
for (const t of db.triggers) {
  sql.push(`DROP TRIGGER IF EXISTS ${q(t.name)} ON ${q(t.schema)}.${q(t.table_name)};`, t.definition + ';');
  if (t.enabled !== 'O') throw new Error('Revisar trigger deshabilitado: ' + t.name);
}
for (const table of ['generos','comunidades']) for (const row of db[table]) {
  sql.push(`INSERT INTO ${fq(table)} (${Object.keys(row).map(q).join(', ')}) VALUES (${Object.values(row).map(lit).join(', ')});`);
}
for (const b of db.buckets) {
  const mime = b.allowed_mime_types === null ? 'NULL' : 'ARRAY[' + b.allowed_mime_types.map(lit).join(',') + ']::text[]';
  sql.push(`INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES (${lit(b.id)},${lit(b.name)},${lit(b.public)},${lit(b.file_size_limit)},${mime}) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,public=EXCLUDED.public,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;`);
}
for (const t of tables) {
  if (t.rls) sql.push(`ALTER TABLE ${fq(t.name)} ENABLE ROW LEVEL SECURITY;`);
  if (t.force_rls) sql.push(`ALTER TABLE ${fq(t.name)} FORCE ROW LEVEL SECURITY;`);
}
for (const p of policies) {
  const parsedRoles = Array.isArray(p.roles) ? p.roles : p.roles.replace(/[{}]/g,'').split(',');
  if (p.schemaname !== 'public') sql.push(`DROP POLICY IF EXISTS ${q(p.policyname)} ON ${q(p.schemaname)}.${q(p.tablename)};`);
  sql.push(`CREATE POLICY ${q(p.policyname)} ON ${q(p.schemaname)}.${q(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${parsedRoles.map(role).join(', ')}${p.qual ? ' USING (' + p.qual + ')' : ''}${p.with_check ? ' WITH CHECK (' + p.with_check + ')' : ''};`);
}
// Restablecer ACL de objetos nuevos: evita heredar escrituras de default grants.
const roleList = [...roles].map(role).join(', ');
for (const t of tables) sql.push(`REVOKE ALL ON TABLE ${fq(t.name)} FROM ${roleList};`);
for (const g of db.grants.filter(g => g.table_schema === 'public' && names.has(g.table_name))) sql.push(`GRANT ${g.privilege_type} ON TABLE ${fq(g.table_name)} TO ${role(g.grantee)}${g.is_grantable === true || g.is_grantable === 'YES' ? ' WITH GRANT OPTION' : ''};`);
for (const f of db.functions) sql.push(`REVOKE ALL ON FUNCTION public.${f.name} FROM ${roleList};`);
for (const g of db.function_grants) sql.push(`GRANT ${g.privilege_type} ON FUNCTION public.${g.name} TO ${role(g.grantee)}${g.is_grantable ? ' WITH GRANT OPTION' : ''};`);
for (const s of sequenceNames) sql.push(`REVOKE ALL ON SEQUENCE public.${q(s)} FROM ${roleList};`);
for (const g of db.sequence_grants.filter(g => sequenceNames.has(g.name))) sql.push(`GRANT ${g.privilege_type} ON SEQUENCE public.${q(g.name)} TO ${role(g.grantee)}${g.is_grantable ? ' WITH GRANT OPTION' : ''};`);
for (const g of db.schema_grants) sql.push(`GRANT ${g.privilege_type} ON SCHEMA ${q(g.name)} TO ${role(g.grantee)}${g.is_grantable ? ' WITH GRANT OPTION' : ''};`);
sql.push("NOTIFY pgrst, 'reload schema';", 'COMMIT;');
write('01_instalacion_compatible.sql', sql.join('\n\n'));

const cleanup = ['-- SOLO sobre una COPIA restaurada y respaldada. No ejecutado por esta auditoria.',
  '-- Retira 4 tablas (incluyen datos historicos), 1 columna y 2 checks duplicados.',
  '-- No usar 01 antes: este archivo es para una restauracion completa del origen.',
  'BEGIN;', "SET LOCAL lock_timeout = '5s';", "SET LOCAL search_path = public, extensions, gis, pg_catalog;",
  '-- DROP sin CASCADE: una dependencia desconocida debe detener la operacion.',
  'DROP TABLE IF EXISTS public.profile_community_comments;', 'DROP TABLE IF EXISTS public.profile_community_posts;',
  'DROP TABLE IF EXISTS public.user_genre_preferences;', 'DROP TABLE IF EXISTS public.reel_saves;',
  'ALTER TABLE public.user_settings DROP COLUMN IF EXISTS created_at;',
  `DO $guard$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.follows'::regclass AND conname='follows_no_self' AND convalidated)
      OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.user_blocks'::regclass AND conname='user_blocks_different_users' AND convalidated) THEN
      RAISE EXCEPTION 'Faltan los checks validados que reemplazan a los duplicados';
    END IF;
  END $guard$;`,
  'ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_no_self_follow_chk;',
  'ALTER TABLE public.user_blocks DROP CONSTRAINT IF EXISTS user_blocks_no_self_block_chk;',
  "NOTIFY pgrst, 'reload schema';", 'COMMIT;'];
write('02_optimizar_copia_restaurada.sql', cleanup.join('\n\n'));

const manifest = {
  captured_at: db.captured_at,
  original: { tables: db.tables.length, columns: db.columns.length },
  optimized: { tables: tables.length, columns: columns.length, constraints: constraints.length, indexes: indexes.length, functions: db.functions.length, triggers: db.triggers.length, policies: policies.length },
  excluded_tables: [...removedTables], excluded_columns: [...removedColumns], excluded_constraints: Object.keys(exclusions.constraints),
  retained_candidates: Object.entries(exclusions.columns).flatMap(([t,cs]) => Object.keys(cs).map(c => t+'.'+c)).filter(c => !removedColumns.has(c)),
  tables: tables.map(t => ({ name: t.name, rows_at_audit: db.counts[t.name], columns: columns.filter(c => c.table_name===t.name).map(c => c.name) })),
};
write('manifiesto-compatible.json', JSON.stringify(manifest, null, 2));

const verify = ['-- Solo lectura. Ejecutar en destino despues de restaurar/optimizar.',
  '-- Las primeras consultas deben devolver cero diferencias. Los conteos se comparan con el respaldo final, no con la foto de esta auditoria.',
  'BEGIN READ ONLY;',
  `WITH esperado(nombre) AS (VALUES ${tables.map(t => '('+lit(t.name)+')').join(',')})
   SELECT 'tabla_faltante' AS problema,nombre FROM esperado WHERE to_regclass('public.'||quote_ident(nombre)) IS NULL
   UNION ALL SELECT 'tabla_extra',tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN (SELECT nombre FROM esperado);`,
  `WITH esperado(tabla,columna,tipo,no_nulo) AS (VALUES ${columns.map(c => '('+[lit(c.table_name),lit(c.name),lit(c.type),lit(c.not_null)].join(',')+')').join(',')})
   SELECT e.* FROM esperado e LEFT JOIN pg_namespace n ON n.nspname='public'
   LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.tabla
   LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname=e.columna AND NOT a.attisdropped
   WHERE a.attnum IS NULL OR format_type(a.atttypid,a.atttypmod)<>e.tipo OR a.attnotnull<>e.no_nulo;`,
  "SELECT tablename FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity;",
  ...tables.map(t => `SELECT ${lit(t.name)} AS tabla,count(*) AS filas FROM ${fq(t.name)};`),
  "SELECT p.oid::regprocedure AS funcion FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') ORDER BY 1;",
  "SELECT n.nspname,c.relname,t.tgname,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND (n.nspname='public' OR (n.nspname='auth' AND c.relname='users')) ORDER BY 1,2,3;",
  "SELECT policyname,schemaname,tablename,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','storage','realtime') ORDER BY 2,3,1;",
  "SELECT count(*) AS perfiles_sin_auth FROM public.users u LEFT JOIN auth.users a ON a.id=u.id WHERE a.id IS NULL;",
  "SELECT count(*) AS conversaciones_sin_dos_miembros FROM public.conversations c WHERE (SELECT count(*) FROM public.conversation_members cm WHERE cm.conversation_id=c.id)<>2;",
  "-- Una membresia sin perfil puede ser historial de usuario eliminado, no borrarla.",
  "SELECT count(*) AS mensajes_respuesta_otra_conversacion FROM public.messages m JOIN public.messages p ON p.id=m.reply_to_id WHERE m.conversation_id<>p.conversation_id;",
  ...db.sequence_columns.filter(s => names.has(s.table_name)).map(s => `SELECT ${lit(s.sequence_name)} AS secuencia,last_value,is_called,(SELECT max(${q(s.column_name)}) FROM ${fq(s.table_name)}) AS id_maximo FROM public.${q(s.sequence_name)};`),
  "SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets ORDER BY id;",
  'ROLLBACK;'];
write('03_verificar_destino.sql',verify.join('\n\n'));

const sourceDirs = ['Backend/Controllers','Backend/services','Backend/routes','Backend/middlewares','Frontend/src'];
function filesAt(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory() ? filesAt(path.join(dir,e.name)) : /\.(js|jsx)$/.test(e.name) ? [path.join(dir,e.name)] : []); }
const sources = sourceDirs.flatMap(d => filesAt(path.join(root,d))).map(file => ({file:path.relative(root,file).replaceAll('\\','/'), lines:fs.readFileSync(file,'utf8').split(/\r?\n/)}));
const references = table => sources.flatMap(s => s.lines.flatMap((line,i) => new RegExp('\\b'+table+'\\b').test(line) ? [{file:s.file,line:i+1,text:line.trim()}] : []));
for (const t of removedTables) if (references(t).length) throw new Error('Tabla excluida referenciada: '+t);
write('referencias-tablas.json', JSON.stringify(Object.fromEntries(db.tables.map(t => [t.name,references(t.name)])),null,2));
const escape = x => String(x ?? '—').replaceAll('|','\\|').replaceAll('\n',' ');
const dict = ['# Diccionario de la base compatible optimizada', '', `Catalogo real: ${db.captured_at}. ${tables.length} tablas y ${columns.length} columnas. Solo objetos conservados.`, '',
  'Tipos, nulabilidad, valores por defecto y restricciones se preservan del origen; no se endurecen reglas por comparacion con SQL historicos.', '',
  'La evidencia por tabla enumera referencias lexicas para facilitar la revision; la clasificacion funcional esta en INFORME.md.'];
for (const t of tables) {
  const refs = references(t.name);
  dict.push('', '## public.'+t.name, '', `Filas observadas: ${db.counts[t.name]}. RLS: ${t.rls ? 'activado' : 'desactivado'}.`, '',
    refs.length ? 'Referencias: '+[...new Set(refs.map(r => r.file))].map(f => '`'+f+'`').join(', ')+'.' : 'Dependencia SQL o de integridad; revisar funciones/relaciones listadas debajo.', '',
    '| Columna | Tipo exacto | Permite NULL | Default / identity |', '|---|---|---|---|');
  for (const c of columns.filter(c => c.table_name===t.name)) dict.push(`| ${c.name} | ${c.type} | ${c.not_null ? 'No' : 'Si'} | ${escape(c.identity ? 'GENERATED '+(c.identity==='a'?'ALWAYS':'BY DEFAULT')+' AS IDENTITY' : c.default_value)} |`);
  dict.push('', '| Restriccion | Definicion |', '|---|---|');
  for (const c of constraints.filter(c => c.table_name===t.name)) dict.push(`| ${c.name} | ${escape(c.definition)} |`);
  dict.push('', '| Indice | Definicion |', '|---|---|');
  for (const i of indexes.filter(i => i.tablename===t.name)) dict.push(`| ${i.indexname} | ${escape(i.indexdef)} |`);
}
dict.push('', '## Funciones, triggers y seguridad', '', 'Definiciones completas en `01_instalacion_compatible.sql`; metadatos originales en `catalogo-observado.json`.', '', '| Funcion |', '|---|', ...db.functions.map(f => '| '+f.name+' |'), '', '| Trigger | Tabla |', '|---|---|', ...db.triggers.map(t => `| ${t.name} | ${t.schema}.${t.table_name} |`));
write('DICCIONARIO.md',dict.join('\n'));

const removed = ['# Elementos excluidos y candidatos conservados', '', 'Excluido significa omitido del modelo propuesto. No se borro ningun objeto ni fila de la base de origen.', '',
  '## Tablas excluidas', '', '| Tabla | Filas al auditar | Evidencia / motivo |', '|---|---:|---|'];
for (const [t,reason] of Object.entries(exclusions.tables)) removed.push(`| ${t} | ${db.counts[t]} | ${reason} |`);
removed.push('', 'Las 13 filas historicas deben permanecer en el backup completo externo al modelo activo. No se trasladan automaticamente a tablas con nombres parecidos. La ausencia de referencias se limita al codigo disponible, no demuestra ausencia de clientes externos.', '',
  '## Atributo excluido', '', '`user_settings.created_at`: la configuracion se proyecta por mapearConfiguracion, incluso en la exportacion; este atributo no sale en el contrato de respuesta ni se usa en consultas/triggers.', '',
  '## Restricciones excluidas', '', ...Object.entries(exclusions.constraints).map(([n,r]) => '- `'+n+'`: '+r), '',
  '## Objetos dependientes excluidos', '', 'Al excluir una tabla se excluyen tambien todos sus atributos, PK/FK, indices, politicas, grants y secuencias propias. Inventario exacto:', '',
  '| Tabla | Atributos |', '|---|---|', ...[...removedTables].map(t => `| ${t} | ${db.columns.filter(c => c.table_name===t).map(c => c.name).join(', ')} |`), '',
  ...db.constraints.filter(c => removedTables.has(c.table_name)).map(c => '- Restriccion `'+c.name+'`: '+c.definition),
  ...db.indexes.filter(i => removedTables.has(i.tablename)).map(i => '- Indice `'+i.indexname+'`.'),
  ...db.policies.filter(p => p.schemaname==='public' && removedTables.has(p.tablename)).map(p => '- Politica `'+p.policyname+'`.'),
  ...db.sequence_columns.filter(s => removedTables.has(s.table_name)).map(s => '- Secuencia `'+s.sequence_name+'`.'), '',
  '## 27 atributos candidatos que NO se excluyen', '',
  'No son necesarios para las pantallas principales, pero los devuelve SELECT * en exportarDatosActuales (usuarioController.js:971–989); notifications tambien los devuelve por n.*. Quitarlos cambia respuestas y datos exportados. Se mantienen para cumplir la compatibilidad solicitada. Las observaciones siguientes describen su consumo funcional, no ausencia absoluta de uso.', '',
  '| Atributo | Observacion |', '|---|---|');
for (const [t,cs] of Object.entries(exclusions.columns)) for (const [c,reason] of Object.entries(cs)) if (!removedColumns.has(t+'.'+c)) removed.push(`| ${t}.${c} | ${reason} |`);
removed.push('', '## Indices candidatos, sin eliminar', '',
  '`conversation_members_user_id_idx` y `messages_sender_id_idx` comparten prefijo con indices compuestos. No son duplicados exactos: sin planes, tamanos y carga representativa no se afirma que retirarlos mejore rendimiento. `users_username_key` se conserva junto al indice lower(username): no se cambia el contrato de errores de unicidad.', '',
  '## Objetos historicos ausentes del origen', '',
  '`settings`, `event_attendance_events`, `reel_listen_events`, `content_moderation_alerts` y `handle_reel_share_counter` aparecen en scripts antiguos, pero no en el catalogo observado. No se contabilizan como eliminaciones nuevas ni se reintroducen.');
write('EXCLUIDOS_Y_CANDIDATOS.md',removed.join('\n'));

// Checks estructurales offline, antes de entregar.
if (tables.length !== 34 || columns.length !== 236) throw new Error('Cambio de inventario: revisar manualmente las decisiones');
if (db.views.length || db.publications.length) throw new Error('Revisar vistas/publicaciones antes de generar');
if (db.sequence_columns.length !== db.sequences.length) throw new Error('Secuencias independientes requieren revision');
for (const c of constraints.filter(c => c.type==='f')) for (const t of removedTables) if (new RegExp('REFERENCES (?:public\\.)?'+t+'\\(').test(c.definition)) throw new Error('FK activa hacia tabla excluida');
write('VALIDACION_GENERACION.json',JSON.stringify({ ok:true, mode:'offline-structural-only', manifest, checks:['Tablas excluidas sin referencias lexicas en runtime','Sin FK conservada a tablas excluidas','Identity con secuencia catalogada','Sin vistas ni publicaciones public pendientes','Inventario compatible 34 tablas / 236 columnas','27 candidatos retenidos por contrato SELECT *'], limitations:['No ejecuta SQL ni prueba restauracion','No prueba Auth, Storage ni Realtime en destino'] },null,2));
console.log(JSON.stringify(manifest.optimized));
