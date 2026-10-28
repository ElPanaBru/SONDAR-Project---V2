// Runs locally in WebKit so compressed audio can be decoded without a native plugin.
export const waveformScript = `
window.decodeWaveform = async function(base64) {
  var context;
  try {
    var raw = atob(base64), bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    raw = null;
    var Context = window.AudioContext || window.webkitAudioContext;
    context = new Context({ sampleRate: 16000 });
    var audio = await context.decodeAudioData(bytes.buffer);
    var peaks = new Array(80).fill(0);
    for (var channel = 0; channel < audio.numberOfChannels; channel++) {
      var samples = audio.getChannelData(channel);
      for (var bin = 0; bin < peaks.length; bin++) {
        var start = Math.floor(bin * samples.length / peaks.length);
        var end = Math.floor((bin + 1) * samples.length / peaks.length);
        for (var j = start; j < end; j++) peaks[bin] = Math.max(peaks[bin], Math.abs(samples[j]));
      }
    }
    var max = Math.max.apply(null, peaks) || 1;
    window.ReactNativeWebView.postMessage(JSON.stringify({ peaks: peaks.map(function(p) { return p / max; }) }));
  } catch (error) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ error: true }));
  } finally {
    if (context) await context.close();
  }
};
true;
`;
export const waveformHTML = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src '+"'none'; script-src 'unsafe-inline'"+'"></head><body><script>' + waveformScript + '</script></body></html>';
