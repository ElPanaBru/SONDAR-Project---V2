const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const mobile = path.resolve(__dirname, '../sondar-mobile');
const mobileRequire = createRequire(path.join(mobile, 'package.json'));
const cliEntry = mobileRequire.resolve('@expo/cli');
const cliRequire = createRequire(cliEntry);
const { printQRCode } = require(path.join(path.dirname(cliEntry), '../src/utils/qr.js'));
const { toQR } = cliRequire('toqr');
const url = process.argv[2];
if (!url || !/^exps?:\/\//.test(url)) throw new Error('Se requiere una URL de Expo Go.');
printQRCode(url).print();
const cells = toQR(url);
const size = Math.sqrt(cells.length);
const margin = 4;
let squares = '';
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    if (cells[y * size + x]) squares += `<rect x="${x + margin}" y="${y + margin}" width="1" height="1"/>`;
  }
}
const output = path.join(mobile, '.expo', 'sondar-qr.svg');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 ${size + margin * 2} ${size + margin * 2}"><rect width="100%" height="100%" fill="white"/><g fill="black">${squares}</g></svg>`);
console.log(`QR guardado en: ${output}`);