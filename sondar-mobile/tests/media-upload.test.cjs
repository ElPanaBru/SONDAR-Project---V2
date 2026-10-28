const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTypeScript(relativePath, dependencies = {}) {
  const filename = path.resolve(__dirname, relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  const requireMock = name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error('Unexpected dependency: ' + name);
  };
  new Function('require', 'module', 'exports', outputText)(requireMock, module, module.exports);
  return module.exports;
}

const files = new Map([
  ['file:///cache/song.m4a', new Uint8Array([1, 2, 3, 4])],
  ['file:///cache/cover.jpg', new Uint8Array([5, 6, 7])],
]);
const { mediaPart } = loadTypeScript('../lib/api.ts', {
  'expo-file-system': { File: class {
    constructor(uri) { this.uri = uri; }
    async bytes() {
      if (!files.has(this.uri)) throw new Error('File no longer exists');
      return files.get(this.uri);
    }
  } },
  './config': {}, './supabase': {},
});
// Use the installed Expo serializer to catch compatibility regressions.
const { convertFormDataAsync } = loadTypeScript('../node_modules/expo/src/winter/fetch/convertFormData.ts', {
  '../../utils/blobUtils': { blobToArrayBufferAsync: blob => blob.arrayBuffer() },
});
const form = entries => ({ entries: () => entries });

test('Expo rejects the old URI-only attachment', async () => {
  await assert.rejects(convertFormDataAsync(form([['audio', {
    uri: 'file:///cache/song.m4a', name: 'song.m4a', type: 'audio/mp4',
  }]])), /Unsupported FormDataPart/);
});

test('reel audio and cover serialize as multipart bytes with their filenames and MIME types', async () => {
  const audio = mediaPart({ uri: 'file:///cache/song.m4a', fileName: 'song.m4a' }, 'audio.mp3');
  const cover = mediaPart({ uri: 'file:///cache/cover.jpg' }, 'portada.jpg');
  const { body } = await convertFormDataAsync(form([['tema', 'Song'], ['audio', audio], ['portada', cover]]), 'test-boundary');
  const result = Buffer.from(body);
  assert.ok(result.includes(Buffer.from('filename="song.m4a"')));
  assert.ok(result.includes(Buffer.from('content-type: audio/mp4')));
  assert.ok(result.includes(Buffer.from('filename="portada.jpg"')));
  assert.ok(result.includes(Buffer.from('content-type: image/jpeg')));
  assert.ok(result.includes(Buffer.from([1, 2, 3, 4])));
  assert.ok(result.includes(Buffer.from([5, 6, 7])));
  assert.equal(audio.uri, 'file:///cache/song.m4a');
});

test('unreadable files fail instead of sending empty attachments', async () => {
  const audio = mediaPart({ uri: 'file:///missing.mp3' }, 'audio.mp3');
  await assert.rejects(convertFormDataAsync(form([['audio', audio]])), /File no longer exists/);
});
