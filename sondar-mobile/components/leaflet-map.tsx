import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { createMapHTML, serializeMapState, validCoordinate, type Coordinate, type MapState } from '@/lib/leaflet/document';
import { palette } from '@/constants/sondar';

type Props = {
  state: MapState;
  picker?: boolean;
  style?: StyleProp<ViewStyle>;
  onSelect?: (id: string) => void;
  onCoordinate?: (coordinate: Coordinate) => void;
};

export function LeafletMap({ state, picker = false, style, onSelect, onCoordinate }: Props) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [generation, setGeneration] = useState(0);
  const source = useMemo(() => ({ html: createMapHTML(picker) }), [picker]);
  const serialized = serializeMapState(state);

  useEffect(() => {
    if (ready) web.current?.injectJavaScript('window.updateSondarMap(' + serialized + ');true;');
  }, [ready, serialized]);

  useEffect(() => {
    const timer = setTimeout(() => { if (!ready) setError(true); }, 15000);
    return () => clearTimeout(timer);
  }, [ready, generation]);

  function retry() { setReady(false); setError(false); setGeneration(value => value + 1); }

  return <View style={[styles.frame, style]}>
    <WebView
      key={generation}
      ref={web}
      source={source}
      style={styles.web}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled={false}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      mixedContentMode="never"
      onError={() => setError(true)}
      onContentProcessDidTerminate={retry}
      onRenderProcessGone={retry}
      onShouldStartLoadWithRequest={request => {
        if (request.url === 'about:blank' || request.url.startsWith('data:text/html')) return true;
        if (/^https:\/\/(www\.openstreetmap\.org|carto\.com|leafletjs\.com)(\/|$)/.test(request.url)) void Linking.openURL(request.url).catch(() => null);
        return false;
      }}
      onMessage={event => {
        try {
          const message = JSON.parse(event.nativeEvent.data);
          if (message.type === 'ready') { setReady(true); setError(false); }
          else if (message.type === 'error' || message.type === 'tilesError') setError(true);
          else if (message.type === 'tilesLoaded') setError(false);
          else if (message.type === 'select' && typeof message.id === 'string' && state.events.some(item => item.id === message.id)) onSelect?.(message.id);
          else if (message.type === 'coordinate' && picker && validCoordinate(message.coordinate)) onCoordinate?.(message.coordinate);
        } catch { /* Ignore malformed WebView messages. */ }
      }}
    />
    {!ready && !error ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={palette.orange} /><Text style={styles.text}>Cargando mapa...</Text></View> : null}
    {error ? <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}><Text style={styles.text}>No se pudo cargar el mapa. Reintentar</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: '#202020' },
  web: { flex: 1, backgroundColor: '#202020' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#202020' },
  retry: { position: 'absolute', bottom: 36, left: 12, right: 12, padding: 12, borderRadius: 8, backgroundColor: '#151515', borderWidth: 1, borderColor: palette.orange },
  text: { color: palette.text, fontSize: 12, textAlign: 'center' },
});
