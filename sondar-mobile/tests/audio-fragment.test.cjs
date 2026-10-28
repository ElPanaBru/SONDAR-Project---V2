const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../lib/audio-fragment.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const loaded = { exports: {} };
new Function('exports', outputText)(loaded.exports);
const { audioFragment, fragmentTime } = loaded.exports;

test('a seven-second audio defaults to the complete seven-second fragment', () => {
  assert.deepEqual(audioFragment(7), { start: 0, end: 7 });
  assert.equal(fragmentTime(7), '0:07.00');
});
test('legacy thirty-second metadata is clamped to the real audio duration', () => {
  assert.deepEqual(audioFragment(7, 0, 30), { start: 0, end: 7 });
});
test('long audio supports fragments away from the start with a thirty-second maximum', () => {
  assert.deepEqual(audioFragment(472), { start: 0, end: 30 });
  assert.deepEqual(audioFragment(472, 80, 110), { start: 80, end: 110 });
  assert.deepEqual(audioFragment(472, 80, 120), { start: 80, end: 110 });
  assert.deepEqual(audioFragment(472, 465, 495), { start: 465, end: 472 });
});
test('fractional durations remain precise when saving the selected fragment', () => {
  const range = audioFragment(7.24, 1.25, 7.24);
  assert.equal(fragmentTime(range.end - range.start), '0:05.99');
  assert.equal(fragmentTime(59.999), '1:00.00');
});
test('unloaded and invalid metadata never produce negative or infinite ranges', () => {
  assert.deepEqual(audioFragment(0), { start: 0, end: 0 });
  assert.deepEqual(audioFragment(Infinity), { start: 0, end: 0 });
  const range = audioFragment(7, 50, 90);
  assert.ok(range.start >= 0 && range.start < range.end && range.end <= 7);
});
