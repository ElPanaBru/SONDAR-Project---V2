const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/waveform-document.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleExports = {};
new Function('exports', output)(moduleExports);
async function decode(channels, fail = false) {
  let result, closed = false;
  const context = { window: {
    AudioContext: class {
      async decodeAudioData(bytes) {
        assert.equal(bytes.byteLength, 3);
        if (fail) throw new Error('Invalid audio');
        return { numberOfChannels: channels.length, getChannelData: index => channels[index] };
      }
      async close() { closed = true; }
    },
    ReactNativeWebView: { postMessage: value => { result = JSON.parse(value); } },
  }, atob, Uint8Array };
  vm.runInNewContext(moduleExports.waveformScript, context);
  await context.window.decodeWaveform('AQID');
  assert.equal(closed, true);
  return result;
}
test('waveform uses real PCM peaks from both audio channels', async () => {
  const left = new Float32Array(160); left[10] = -0.25;
  const right = new Float32Array(160); right[100] = 0.5;
  const { peaks } = await decode([left, right]);
  assert.equal(peaks.length, 80);
  assert.equal(peaks[5], 0.5);
  assert.equal(peaks[50], 1);
  assert.equal(peaks[0], 0);
});
test('silence produces a flat waveform without invalid amplitudes', async () => {
  const { peaks } = await decode([new Float32Array(160)]);
  assert.ok(peaks.every(value => value === 0));
});
test('invalid audio reports an error and releases the decoder', async () => {
  assert.deepEqual(await decode([], true), { error: true });
});
test('fragment picker labels retain their Spanish Unicode characters', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/audio-fragment-picker.tsx'), 'utf8');
  assert.ok(source.includes('ELEG\u00cd EL FRAGMENTO'));
  assert.ok(source.includes('Arrastr\u00e1 los extremos \u00b7 m\u00e1ximo 30 segundos'));
  assert.ok(!source.includes('duraci?n'));
});
