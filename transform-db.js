const fs = require('fs');

const filePath = 'database_sondar.sql';

// Read the file
let content = fs.readFileSync(filePath, 'utf-8');

// Replace CREATE TABLE IF NOT EXISTS with ALTER TABLE
content = content.replace(/CREATE TABLE IF NOT EXISTS/g, 'ALTER TABLE');

// Remove all lines that start with INSERT INTO (including leading whitespace)
content = content.split('\n').filter(line => {
  return !line.trim().startsWith('INSERT INTO');
}).join('\n');

// Remove extra blank lines (more than 2 consecutive blank lines)
content = content.replace(/\n{3,}/g, '\n\n');

// Write back to file
fs.writeFileSync(filePath, content, 'utf-8');

console.log('✓ Transformation complete');
console.log('  - Replaced CREATE TABLE IF NOT EXISTS with ALTER TABLE');
console.log('  - Removed all INSERT INTO statements');
