// Alias de verificacion estructural offline; no certifica sintaxis ni ejecuta SQL.
const { verificarRepositorio } = require('./verificarRepositorio');
try { console.log(JSON.stringify(verificarRepositorio(), null, 2)); }
catch (error) { console.error(error.message); process.exitCode = 1; }
