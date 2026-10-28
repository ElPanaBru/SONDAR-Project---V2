import { File } from 'expo-file-system';
import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { waveformHTML, waveformScript } from '@/lib/waveform-document';

const source = { html: waveformHTML };
export function AudioWaveformLoader({ uri, onResult }: { uri: string; onResult: (peaks: number[] | null) => void }) {
  const web = useRef<WebView<object>>(null);
  const active = useRef(true);
  const started = useRef(false);
  useEffect(() => {
    active.current = true;
    const timeout = setTimeout(() => { if (active.current) onResult(null); }, 30000);
    return () => { active.current = false; clearTimeout(timeout); };
  }, [onResult]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false;
    const decoder = new Function('window', waveformScript + ';return window.decodeWaveform;')({
      AudioContext: globalThis.AudioContext,
      ReactNativeWebView: { postMessage: (value: string) => { if (!cancelled) onResult(JSON.parse(value).peaks || null); } },
    });
    void fetch(uri).then(response => response.blob()).then(blob => new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob);
    })).then(decoder).catch(() => { if (!cancelled) onResult(null); });
    return () => { cancelled = true; };
  }, [uri, onResult]);
  if (Platform.OS === 'web') return null;
  return <View pointerEvents='none' accessibilityElementsHidden importantForAccessibility='no-hide-descendants' style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
    <WebView<object> ref={web} source={source} originWhitelist={['*']} javaScriptEnabled scrollEnabled
      onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith('data:text/html')}
      onLoadEnd={() => {
        if (started.current) return;
        started.current = true;
        void new File(uri).base64().then(base64 => {
          if (active.current) web.current?.injectJavaScript('window.decodeWaveform(' + JSON.stringify(base64) + ');true;');
        }).catch(() => { if (active.current) onResult(null); });
      }}
      onMessage={event => {
        if (!active.current) return;
        try {
          const data = JSON.parse(event.nativeEvent.data);
          onResult(Array.isArray(data.peaks) && data.peaks.length === 80 && data.peaks.every((p: unknown) => typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1) ? data.peaks : null);
        } catch { onResult(null); }
      }} onError={() => onResult(null)} onContentProcessDidTerminate={() => onResult(null)} />
  </View>;
}
