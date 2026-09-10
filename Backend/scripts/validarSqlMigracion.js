// Uso: node Backend/scripts/validarSqlMigracion.js /ruta/al/modulo/pgsql-parser
// El parser es opcional y externo a las dependencias de la aplicacion.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

async function main() {
  if (!process.argv[2]) throw new Error('Indicar la ruta al modulo pgsql-parser');
  const parserPath = path.resolve(process.argv[2]);
  const { parse } = require(parserPath);
  const dir = path.resolve(__dirname, '../../docs/base-datos');
  const results = [];
  for (const file of ['01_instalacion_compatible.sql','02_optimizar_copia_restaurada.sql','03_verificar_destino.sql']) {
    const text = fs.readFileSync(path.join(dir,file),'utf8');
    const parsed = await parse(text);
    results.push({ file, valid_syntax:true, statements:parsed.stmts?.length ?? parsed.length, sha256:crypto.createHash('sha256').update(text).digest('hex') });
  }
  const result = { verified_at:new Date().toISOString(), parser:'pgsql-parser', version:require(path.join(parserPath,'package.json')).version, mode:'syntax-only-no-database-execution', results };
  fs.writeFileSync(path.join(dir,'VALIDACION_SQL.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
