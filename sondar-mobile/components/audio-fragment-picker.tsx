import { AudioWaveformLoader } from './audio-waveform-loader';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useVideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { palette } from '@/constants/sondar';
import { audioFragment, fragmentTime, type AudioFragment } from '@/lib/audio-fragment';

/* eslint-disable react-hooks/immutability -- expo-video provides an imperative currentTime setter. */
export function AudioFragmentPicker({ uri, name, value, onChange, onDurationChange, selectionEnabled = true, disabled = false }: {
  uri: string; name: string; value: AudioFragment | null;
  onChange: (value: AudioFragment | null) => void; disabled?: boolean;
  onDurationChange?: (seconds: number) => void; selectionEnabled?: boolean;
}) {
  const player = useVideoPlayer(uri, p => { p.timeUpdateEventInterval = 0.05; });
  const loaded = useEvent(player, 'sourceLoad');
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const total = loaded?.duration || player.duration;
  const [peaks, setPeaks] = useState<number[] | null | undefined>(undefined);
  const time = useEvent(player, 'timeUpdate');
  const [width, setWidth] = useState(1);
  const drag = useRef<{ edge: 'start' | 'end'; x: number; range: AudioFragment } | null>(null);
  const range = value || (selectionEnabled ? audioFragment(total) : audioFragment(total, 0, Math.min(30, total)));

  useEffect(() => {
    if (total > 0 && Number.isFinite(total)) {
      onDurationChange?.(total);
      if (!value) onChange(selectionEnabled ? audioFragment(total) : audioFragment(total, 0, Math.min(30, total)));
    }
  }, [total, value, onChange, onDurationChange, selectionEnabled]);
  useEffect(() => {
    const subscription = player.addListener('timeUpdate', ({ currentTime }) => {
      if (currentTime >= range.end) { player.pause(); player.currentTime = range.start; }
    });
    return () => subscription.remove();
  }, [player, range.start, range.end]);
  useEffect(() => { if (disabled) player.pause(); }, [disabled, player]);

  function begin(edge: 'start' | 'end', event: GestureResponderEvent) {
    player.pause();
    drag.current = { edge, x: event.nativeEvent.pageX, range };
  }
  function move(event: GestureResponderEvent) {
    const current = drag.current;
    if (!current) return;
    const delta = (event.nativeEvent.pageX - current.x) / width * total;
    let next: AudioFragment;
    if (current.edge === 'start') {
      const start = Math.max(0, Math.min(total - 0.1, current.range.start + delta));
      next = audioFragment(total, start, Math.max(current.range.end, start + 0.1));
    } else {
      const end = Math.max(0.1, Math.min(total, current.range.end + delta));
      next = audioFragment(total, Math.min(current.range.start, end - 0.1), end);
      if (end - next.start > 30) next = audioFragment(total, end - 30, end);
      else if (end > next.end) next = audioFragment(total, end - 30, end);
    }
    onChange(next);
    player.currentTime = next.start;
  }
  function adjust(edge: 'start' | 'end', delta: number) {
    player.pause();
    const next = edge === 'start' ? audioFragment(total, range.start + delta, range.end) : audioFragment(total, range.start, range.end + delta);
    onChange(next); player.currentTime = next.start;
  }
  return <View style={styles.card}>
    {peaks === undefined ? <AudioWaveformLoader key={uri} uri={uri} onResult={setPeaks} /> : null}
    <View style={styles.heading}><Text style={styles.title}>{selectionEnabled ? 'ELEGÍ EL FRAGMENTO' : 'VISTA PREVIA DEL AUDIO'}</Text><Text style={styles.badge}>{fragmentTime(range.end - range.start)}</Text></View>
    <Text style={styles.muted}>{selectionEnabled ? 'Arrastrá los extremos · máximo 30 segundos' : 'Se publicará el archivo completo. Para subir solo un fragmento, recortá el audio antes de seleccionarlo.'}</Text>
    {status === 'error' ? <Text style={styles.muted}>No se pudo leer el audio. Seleccioná otro archivo.</Text> : !value ? <Text style={styles.muted}>Cargando duración del audio…</Text> : <>
      <View style={styles.row}><Pressable disabled={disabled} accessibilityLabel={isPlaying ? 'Pausar fragmento' : 'Escuchar fragmento'} onPress={() => {
        if (isPlaying) player.pause(); else { player.currentTime = range.start; player.play(); }
      }} style={styles.play}><Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color='#111' /></Pressable>
        <View style={styles.track} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
          <View pointerEvents='none' style={styles.waveform}>
            {peaks ? peaks.map((peak, index) => {
              const second = (index + 0.5) / peaks.length * total;
              return <View key={index} style={[styles.waveBar, { height: Math.max(2, peak * 48), backgroundColor: second >= range.start && second <= range.end ? palette.amber : '#5D4300' }]} />;
            }) : <Text style={styles.waveStatus}>{peaks === null ? 'No se pudo dibujar la onda' : 'Cargando onda…'}</Text>}
          </View>
          <View pointerEvents='none' style={[styles.playhead, { left: Math.max(0, Math.min(1, (time?.currentTime || 0) / total)) * width }]} />
          <View pointerEvents='none' style={[styles.selection, { left: range.start / total * width, width: (range.end - range.start) / total * width }]} />
          {selectionEnabled ? (['start', 'end'] as const).map(edge => <View key={edge} accessibilityRole='adjustable' accessibilityLabel={edge === 'start' ? 'Inicio del fragmento' : 'Fin del fragmento'} accessibilityValue={{ min: 0, max: total, now: range[edge] }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={event => { if (!disabled) adjust(edge, event.nativeEvent.actionName === 'increment' ? 0.5 : -0.5); }}
            onStartShouldSetResponder={() => !disabled} onMoveShouldSetResponder={() => !disabled} onResponderGrant={event => begin(edge, event)} onResponderMove={move} onResponderRelease={() => { drag.current = null; }} onResponderTerminate={() => { drag.current = null; }} onResponderTerminationRequest={() => false}
            style={[styles.handle, { left: range[edge] / total * width - 14 }]}><View style={styles.grip} /></View>) : null}
        </View>
      </View>
      {selectionEnabled ? <View style={styles.heading}><Text style={styles.muted}>Inicio {fragmentTime(range.start)}</Text><Text style={styles.muted}>Fin {fragmentTime(range.end)}</Text></View> : null}
    </>}
    <Text style={styles.muted} numberOfLines={1}>{name}</Text><Text style={styles.muted}>Total: {total > 0 ? fragmentTime(total) : '—'}</Text>
  </View>;
}
/* eslint-enable react-hooks/immutability */
const styles = StyleSheet.create({
  card: { margin: 16, padding: 16, gap: 12, backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: '#6D4109' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: palette.text, fontWeight: '900', flex: 1 }, muted: { color: palette.muted, fontSize: 12 },
  badge: { backgroundColor: palette.amber, color: '#111', padding: 8, borderRadius: 8, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 24, paddingRight: 14 },
  play: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.amber, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 64, backgroundColor: '#080808', borderRadius: 8 },
  waveform: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 4, overflow: 'hidden' },
  waveBar: { flex: 1, maxWidth: 2, marginHorizontal: 0.5, borderRadius: 1 },
  waveStatus: { color: palette.muted, fontSize: 10, textAlign: 'center' },
  playhead: { position: 'absolute', top: 4, bottom: 4, width: 1, backgroundColor: '#FFF' },
  selection: { position: 'absolute', top: 4, bottom: 4, borderWidth: 1, borderColor: palette.amber, backgroundColor: '#FFAE0014' },
  handle: { position: 'absolute', top: -4, bottom: -4, width: 28, alignItems: 'center', justifyContent: 'center' },
  grip: { width: 10, height: 64, borderRadius: 5, backgroundColor: palette.amber, borderWidth: 1, borderColor: '#111' },
});
