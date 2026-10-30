const path = require('node:path');
const fs = require('node:fs');

// La configuracion generada por local:start tiene prioridad sobre el .env heredado.
const local = path.join(__dirname, '.env.local');
require('dotenv').config({ path: fs.existsSync(local) ? local : path.join(__dirname, '.env'), quiet: true });
