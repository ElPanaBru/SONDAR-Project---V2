const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectDir = __dirname;
const lockfile = path.join(projectDir, 'sondar-mobile', 'package-lock.json');
const stampfile = path.join(projectDir, 'sondar-mobile', 'node_modules', '.sondar-lock-hash');
const lockHash = crypto.createHash('sha256').update(fs.readFileSync(lockfile)).digest('hex');
let previousHash = '';

try {
  previousHash = fs.readFileSync(stampfile, 'utf8').trim();
} catch {
  // A fresh dependency volume is populated from the image before Metro starts.
}

if (previousHash !== lockHash) {
  console.log('Las dependencias móviles cambiaron; instalando el lockfile del contenedor.');
  const install = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], {
    cwd: path.join(projectDir, 'sondar-mobile'),
    stdio: 'inherit',
  });
  if (install.error) throw install.error;
  if (install.status !== 0) process.exit(install.status || 1);
  fs.writeFileSync(stampfile, lockHash);
}

const expoArgs = process.env.SONDAR_EXPO_CLEAR === '1'
  ? ['start', '--', '--clear']
  : ['start'];
const expo = spawnSync('npm', expoArgs, {
  cwd: path.join(projectDir, 'sondar-mobile'),
  stdio: 'inherit',
});

if (expo.error) throw expo.error;
process.exit(expo.status || 0);
