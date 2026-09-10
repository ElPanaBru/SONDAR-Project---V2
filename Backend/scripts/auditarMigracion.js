// Solo lectura: captura estructura, nunca filas ni credenciales.
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

async function main() {
  const client = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000, statement_timeout: 20000,
  });
  const queries = {
    version: 'SELECT version(), current_setting(\'TimeZone\') AS timezone',
    extensions: `SELECT e.extname, e.extversion, n.nspname AS schema FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace`,
    tables: `SELECT c.relname AS name, c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY 1`,
    columns: `SELECT c.relname AS table_name, a.attname AS name, format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull AS not_null, a.attidentity AS identity, a.attgenerated AS generated, pg_get_expr(d.adbin,d.adrelid) AS default_value FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`,
    constraints: `SELECT c.conrelid::regclass::text AS table_name,c.conname AS name,c.contype AS type,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' ORDER BY 1,2`,
    indexes: `SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2`,
    functions: `SELECT p.oid::regprocedure::text AS name,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') ORDER BY 1`,
    triggers: `SELECT n.nspname AS schema,c.relname AS table_name,t.tgname AS name,t.tgenabled AS enabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND (n.nspname='public' OR (n.nspname='auth' AND c.relname='users')) ORDER BY 1,2,3`,
    policies: `SELECT * FROM pg_policies WHERE schemaname IN ('public','storage','realtime') ORDER BY schemaname,tablename,policyname`,
    grants: `SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,n.nspname AS table_schema,c.relname AS table_name,a.privilege_type,a.is_grantable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname IN ('public','storage','realtime') AND c.relkind IN ('r','p') ORDER BY 2,3,1,4`,
    views: `SELECT schemaname,viewname,definition FROM pg_views WHERE schemaname='public'`,
    sequences: `SELECT schemaname,sequencename,data_type,start_value,min_value,max_value,increment_by,cycle,cache_size FROM pg_sequences WHERE schemaname='public'`,
    buckets: `SELECT id,name,public,file_size_limit,allowed_mime_types FROM storage.buckets ORDER BY id`,
    publications: `SELECT pubname,schemaname,tablename FROM pg_publication_tables WHERE schemaname='public' ORDER BY 1,2,3`,
    function_grants: `SELECT p.oid::regprocedure::text AS name, CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee, a.privilege_type, a.is_grantable FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') ORDER BY 1,2`,
    sequence_columns: `SELECT s.relname AS sequence_name,t.relname AS table_name,a.attname AS column_name FROM pg_class s JOIN pg_depend d ON d.objid=s.oid AND d.classid='pg_class'::regclass AND d.refclassid='pg_class'::regclass AND d.deptype IN ('i','a') JOIN pg_class t ON t.oid=d.refobjid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid WHERE s.relkind='S' AND n.nspname='public'`,
    sequence_grants: `SELECT c.relname AS name,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('S',c.relowner))) a WHERE n.nspname='public' AND c.relkind='S'`,
    schema_grants: `SELECT n.nspname AS name,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_namespace n CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname IN ('public','gis')`,
    default_grants: `SELECT pg_get_userbyid(d.defaclrole) AS owner,n.nspname AS schema,d.defaclobjtype,d.defaclacl::text FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace`,
    generos: 'SELECT * FROM public.generos ORDER BY slug',
    comunidades: 'SELECT * FROM public.comunidades ORDER BY id',
  };
  try {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result = { captured_at: new Date().toISOString(), mode: 'metadata-only-read-only' };
    for (const [name, sql] of Object.entries(queries)) result[name] = (await client.query(sql)).rows;
    result.counts = {};
    for (const table of result.tables) {
      const quoted = '"' + table.name.replaceAll('"', '""') + '"';
      result.counts[table.name] = (await client.query(`SELECT count(*)::text AS total FROM public.${quoted}`)).rows[0].total;
    }
    await client.query('ROLLBACK');
    const output = path.resolve(process.argv[2] || path.join(__dirname, '../../docs/base-datos/catalogo-observado.json'));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ output, tables: result.tables.length, columns: result.columns.length }));
  } finally { await client.end(); }
}
main().catch(error => { console.error('Auditoria no completada:', error.code || error.name); process.exitCode = 1; });
