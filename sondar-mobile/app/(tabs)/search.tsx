import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, Empty, ErrorNotice, Header, IconButton, NotificationButton, Loading, Screen, ui } from '@/components/sondar-ui';
import { palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';
import { api } from '@/lib/api';
import { normalizeEvent, normalizeReel } from '@/lib/normalizers';
import { searchScore } from '@/lib/search';

type Result = Record<string, any> & { resultType: 'usuario' | 'reel' | 'evento' };

export default function SearchScreen() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'todos' | 'usuario' | 'reel' | 'evento'>('todos');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const term = query.trim().replace(/^@+/, '').replace(/\s+/g, ' ');
  const ready = term.length >= 2;

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await Promise.allSettled([
          api<any[]>(`/api/usuarios?query=${encodeURIComponent(term)}`, { token, signal: controller.signal }),
          api<any[]>('/api/reels', { token, signal: controller.signal }),
          api<any[]>('/api/eventos', { token, signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        const [usersResult, reelsResult, eventsResult] = response;
        const users = usersResult.status === 'fulfilled' ? usersResult.value : [];
        const reels = reelsResult.status === 'fulfilled' ? reelsResult.value.map(normalizeReel) : [];
        const events = eventsResult.status === 'fulfilled' ? eventsResult.value.map(normalizeEvent) : [];
        const ranked = [
          ...users.map(item => ({ ...item, resultType: 'usuario' as const, score: Math.max(1, searchScore(term, [item.nombre, item.username, item.usuario])) })),
          ...reels.map(item => ({ ...item, resultType: 'reel' as const, score: searchScore(term, [item.tema, item.artista], [item.album, item.genero, item.descripcion]) })),
          ...events.map(item => ({ ...item, resultType: 'evento' as const, score: searchScore(term, [item.titulo], [item.descripcion, item.genero, item.lugar, item.ubicacion]) })),
        ].filter(item => item.score > 0).sort((a, b) => b.score - a.score);
        setResults(ranked);
        const failed = response.flatMap((result, index) => result.status === 'rejected' ? [['personas', 'música', 'eventos'][index]] : []);
        setError(failed.length === 3 ? 'No pudimos completar la búsqueda. Revisá tu conexión y volvé a intentar.' : failed.length ? 'No pudimos cargar ' + failed.join(' y ') + '. Los demás resultados están disponibles.' : '');
      } catch {
        if (!controller.signal.aborted) setError('No pudimos completar la búsqueda. Volvé a intentar.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [term, ready, token, retry]);

  function updateQuery(value: string) {
    setQuery(value);
    const next = value.trim().replace(/^@+/, '').replace(/\s+/g, ' ');
    if (next === term) return;
    requestRef.current?.abort();
    setResults([]);
    setError('');
    setLoading(next.length >= 2);
  }

  function retrySearch() {
    requestRef.current?.abort();
    setError('');
    setLoading(true);
    setRetry(value => value + 1);
  }

  const visible = useMemo(() => tab === 'todos' ? results : results.filter(item => item.resultType === tab), [results, tab]);
  function open(item: Result) {
    Keyboard.dismiss();
    if (item.resultType === 'usuario') router.push({ pathname: '/profile/[id]', params: { id: String(item.id || item.username) } });
    else if (item.resultType === 'reel') router.push({ pathname: '/discover', params: { reelId: String(item.backendId ?? item.id) } });
    else router.push({ pathname: '/', params: { eventId: String(item.id) } });
  }

  return (
    <Screen>
      <Header title="Buscar" subtitle="Personas, música y eventos" actions={<><IconButton name="chatbubbles-outline" onPress={() => router.push('/messages')} /><NotificationButton /></>} />
      <View style={styles.search}>
        <Ionicons name="search" size={21} color={palette.muted} />
        <TextInput accessibilityLabel="Buscar personas, música y eventos" value={query} onChangeText={updateQuery} placeholder="Nombre, @usuario, género o lugar" placeholderTextColor={palette.muted} autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()} style={styles.input} />
        {query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" hitSlop={8} onPress={() => updateQuery('')} style={styles.clear}><Ionicons name="close-circle" size={22} color={palette.muted} /></Pressable> : null}
      </View>
      <View style={styles.tabs}>{([['todos', 'Todo'], ['usuario', 'Personas'], ['reel', 'Música'], ['evento', 'Eventos']] as const).map(([id, label]) => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabActive]}><Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text></Pressable>)}</View>
      <ErrorNotice message={error} />
      {error ? <Pressable accessibilityRole="button" onPress={retrySearch} style={styles.retry}><Ionicons name="refresh" size={17} color={palette.amber} /><Text style={styles.retryText}>Volver a intentar</Text></Pressable> : null}
      {ready && !loading && visible.length > 0 ? <Text accessibilityLiveRegion="polite" style={styles.summary}>{visible.length} {visible.length === 1 ? 'resultado' : 'resultados'}</Text> : null}
      {loading ? <View style={styles.loading}><Loading /><Text style={ui.muted}>Buscando…</Text></View> : <FlatList key={tab} data={visible} keyExtractor={item => item.resultType + '-' + item.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.list} ListEmptyComponent={error ? null : <Empty icon="search-outline" title={!ready ? 'Buscá lo que te mueve' : 'No encontramos resultados'} text={!ready ? 'Escribí al menos dos letras para buscar personas, música o eventos.' : 'Probá con otro nombre, género o lugar, o cambiá el filtro.'} />} renderItem={({ item }) => <ResultCard item={item} onPress={() => open(item)} />} />}

    </Screen>
  );
}

function ResultCard({ item, onPress }: { item: Result; onPress: () => void }) {
  const image = item.resultType === 'usuario' ? item.avatar || item.profile_img_url : item.resultType === 'reel' ? item.portada : item.img || item.img_url;
  const title = item.resultType === 'usuario' ? item.nombre || item.username || item.usuario : item.resultType === 'reel' ? item.tema : item.titulo;
  const detail = item.resultType === 'usuario' ? `@${String(item.usuario || item.username || '').replace(/^@/, '')} · ${item.seguidores || 0} seguidores` : item.resultType === 'reel' ? `${item.artista} · ${item.genero}` : `${item.lugar || item.ubicacion} · ${item.genero}`;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: .75 }]}>{item.resultType === 'usuario' ? <Avatar uri={image} name={title} size={58} /> : image ? <Image source={{ uri: image }} style={styles.image} contentFit="cover" /> : <View style={[styles.image, styles.placeholder]}><Ionicons name={item.resultType === 'reel' ? 'musical-note' : 'calendar'} size={25} color={palette.orange} /></View>}<View style={{ flex: 1, gap: 5 }}><Text style={styles.title} numberOfLines={1}>{title}</Text><Text style={ui.muted} numberOfLines={2}>{detail}</Text><View style={styles.type}><Text style={styles.typeText}>{item.resultType === 'usuario' ? 'PERSONA' : item.resultType === 'reel' ? 'LANZAMIENTO' : 'EVENTO'}</Text></View></View><Ionicons name="chevron-forward" size={21} color={palette.muted} /></Pressable>;
}

const styles = StyleSheet.create({
  clear: { minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  retry: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44, gap: 7, marginHorizontal: 16, paddingHorizontal: 8 },
  retryText: { color: palette.amber, fontWeight: '700' },
  summary: { color: palette.muted, fontSize: 12, marginHorizontal: 16, marginBottom: 8 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  search: { margin: 16, marginBottom: 9, height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 8 }, input: { flex: 1, color: palette.text, fontSize: 16 },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 10 }, tab: { flex: 1, minWidth: 0, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: palette.surface }, tabActive: { backgroundColor: palette.orange }, tabText: { color: palette.muted, fontSize: 10, fontWeight: '700' }, tabTextActive: { color: '#111' },
  list: { padding: 16, paddingTop: 6, paddingBottom: 110, gap: 10 }, card: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 8 }, image: { width: 60, height: 60, borderRadius: 8 }, placeholder: { backgroundColor: palette.surface2, alignItems: 'center', justifyContent: 'center' }, title: { color: palette.text, fontSize: 16, fontWeight: '800' }, type: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: '#FF790022' }, typeText: { color: palette.orange, fontSize: 9, fontWeight: '800' },
});

