import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, Empty, ErrorNotice, Header, Loading, Screen, ui } from '@/components/sondar-ui';
import { palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';
import { api } from '@/lib/api';
import { normalizeEvent, normalizeReel } from '@/lib/normalizers';

type Result = any & { resultType: 'usuario' | 'reel' | 'evento' };

export default function SearchScreen() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'todos' | 'usuario' | 'reel' | 'evento'>('todos');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setError('');
      setLoading(false);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const [usersResult, reelsResult, eventsResult] = await Promise.allSettled([
          api<any[]>(`/api/usuarios?query=${encodeURIComponent(term)}`, { token }), api<any[]>('/api/reels', { token }), api<any[]>('/api/eventos', { token }),
        ]);
        const users = usersResult.status === 'fulfilled' ? usersResult.value : [];
        const reels = reelsResult.status === 'fulfilled' ? reelsResult.value : [];
        const events = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
        const lower = term.toLowerCase();
        const normalizedReels = reels.map(normalizeReel);
        const normalizedEvents = events.map(normalizeEvent);
        const matchedReels = normalizedReels.filter(item => [item.tema, item.artista, item.album, item.genero].join(' ').toLowerCase().includes(lower));
        const matchedEvents = normalizedEvents.filter(item => [item.titulo, item.descripcion, item.genero, item.lugar, item.ubicacion].join(' ').toLowerCase().includes(lower));
        setResults([...users.map(item => ({ ...item, resultType: 'usuario' })), ...matchedReels.map(item => ({ ...item, resultType: 'reel' })), ...matchedEvents.map(item => ({ ...item, resultType: 'evento' }))]);
        setError(usersResult.status === 'rejected' && reelsResult.status === 'rejected' && eventsResult.status === 'rejected' ? 'No se pudo buscar.' : '');
      } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo buscar.'); }
      finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(timeout);
  }, [query, token]);

  const visible = useMemo(() => tab === 'todos' ? results : results.filter(item => item.resultType === tab), [results, tab]);
  function open(item: Result) {
    if (item.resultType === 'usuario') router.push({ pathname: '/profile/[id]', params: { id: item.id || item.username } });
    else if (item.resultType === 'reel') router.push('/discover');
    else router.push('/');
  }

  return (
    <Screen>
      <Header title="Buscar" subtitle="Personas, música y eventos" />
      <View style={styles.search}><Ionicons name="search" size={21} color={palette.muted} /><TextInput value={query} onChangeText={value => { setQuery(value); if (value.trim().length < 2) { setResults([]); setError(''); setLoading(false); } }} placeholder="Buscar en SONDAR" placeholderTextColor={palette.muted} autoCapitalize="none" autoFocus style={styles.input} /></View>
      <View style={styles.tabs}>{([['todos', 'Todo'], ['usuario', 'Personas'], ['reel', 'Música'], ['evento', 'Eventos']] as const).map(([id, label]) => <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabActive]}><Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text></Pressable>)}</View>
      <ErrorNotice message={error} />
      {loading ? <Loading /> : <FlatList data={visible} keyExtractor={(item, index) => `${item.resultType}-${item.id}-${index}`} contentContainerStyle={styles.list} ListEmptyComponent={<Empty icon="search-outline" title={query.length < 2 ? 'Buscá lo que te mueve' : 'No encontramos resultados'} text={query.length < 2 ? 'Escribí al menos dos letras.' : 'Probá con otro nombre, género o lugar.'} />} renderItem={({ item }) => <ResultCard item={item} onPress={() => open(item)} />} />}
    </Screen>
  );
}

function ResultCard({ item, onPress }: { item: Result; onPress: () => void }) {
  const image = item.avatar || item.portada || item.img || item.img_url;
  const title = item.nombre || item.username || item.tema || item.titulo;
  const detail = item.resultType === 'usuario' ? `@${String(item.usuario || item.username || '').replace(/^@/, '')} · ${item.seguidores || 0} seguidores` : item.resultType === 'reel' ? `${item.artista} · ${item.genero}` : `${item.lugar || item.ubicacion} · ${item.genero}`;
  return <Pressable onPress={onPress} style={styles.card}>{item.resultType === 'usuario' ? <Avatar uri={image} name={title} size={58} /> : image ? <Image source={{ uri: image }} style={styles.image} contentFit="cover" /> : <View style={[styles.image, styles.placeholder]}><Ionicons name={item.resultType === 'reel' ? 'musical-note' : 'calendar'} size={25} color={palette.orange} /></View>}<View style={{ flex: 1, gap: 5 }}><Text style={styles.title} numberOfLines={1}>{title}</Text><Text style={ui.muted} numberOfLines={2}>{detail}</Text><View style={styles.type}><Text style={styles.typeText}>{item.resultType === 'usuario' ? 'PERSONA' : item.resultType === 'reel' ? 'LANZAMIENTO' : 'EVENTO'}</Text></View></View><Ionicons name="chevron-forward" size={21} color={palette.muted} /></Pressable>;
}

const styles = StyleSheet.create({
  search: { margin: 16, marginBottom: 9, height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 8 }, input: { flex: 1, color: palette.text, fontSize: 16 },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 10 }, tab: { flex: 1, minWidth: 0, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: palette.surface }, tabActive: { backgroundColor: palette.orange }, tabText: { color: palette.muted, fontSize: 10, fontWeight: '700' }, tabTextActive: { color: '#111' },
  list: { padding: 16, paddingTop: 6, paddingBottom: 110, gap: 10 }, card: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 8 }, image: { width: 60, height: 60, borderRadius: 8 }, placeholder: { backgroundColor: palette.surface2, alignItems: 'center', justifyContent: 'center' }, title: { color: palette.text, fontSize: 16, fontWeight: '800' }, type: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: '#FF790022' }, typeText: { color: palette.orange, fontSize: 9, fontWeight: '800' },
});

