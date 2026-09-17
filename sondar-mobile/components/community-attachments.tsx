import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette } from '@/constants/sondar';
import { api } from '@/lib/api';
import { normalizeEvent, normalizeReel } from '@/lib/normalizers';
import { Button, ErrorNotice, Field, Loading, ui } from './sondar-ui';

export type CommunityAttachment = { id: number; tipo: 'evento' | 'reel'; titulo: string; imagen?: string; detalle?: string; fecha?: string; duracion?: string };
type Choice = CommunityAttachment & { search: string };

export function CommunityAttachmentPicker({ type, token, value, onChange }: { type: 'evento' | 'reel'; token?: string | null; value: CommunityAttachment | null; onChange: (value: CommunityAttachment | null) => void }) {
  const [items, setItems] = useState<Choice[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    api<any[]>(type === 'evento' ? '/api/eventos' : '/api/reels', { token }).then(data => {
      if (!current) return;
      setItems(data.map(raw => {
        if (type === 'evento') {
          const item = normalizeEvent(raw);
          return {
            id: Number(item.id), tipo: type, titulo: item.titulo, imagen: item.img,
            detalle: [item.creador, item.lugar, item.genero].filter(Boolean).join(' / '),
            fecha: item.fecha,
            search: [item.titulo, item.creador, item.lugar, item.genero].filter(Boolean).join(' ').toLowerCase(),
          };
        }
        const item = normalizeReel(raw);
        return {
          id: Number(item.backendId || item.id), tipo: type, titulo: item.tema, imagen: item.portada,
          detalle: [item.artista, item.genero].filter(Boolean).join(' / '),
          duracion: item.duracion,
          search: [item.tema, item.album, item.artista, item.genero].filter(Boolean).join(' ').toLowerCase(),
        };
      }));
      setError('');
    }).catch(e => { if (current) setError(e.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [type, token, attempt]);
  const retry = useCallback(() => { setLoading(true); setError(''); setAttempt(n => n + 1); }, []);
  const filtered = items.filter(item => item.search.includes(query.trim().toLowerCase()));
  return <View style={styles.section}>
    <Text style={styles.label}>{type === 'evento' ? 'EVENTO ASOCIADO (OPCIONAL)' : 'PREVIEW ASOCIADA (OPCIONAL)'}</Text>
    {value ? <AttachmentRow item={value} selected onPress={() => onChange(null)} /> : <>
      <Field value={query} onChangeText={setQuery} placeholder={type === 'evento' ? 'Buscar evento, lugar, creador o genero' : 'Buscar tema, artista, preview o genero'} />
      {loading ? <Loading /> : error ? <><ErrorNotice message={error} /><Button kind="secondary" onPress={retry}>Reintentar</Button></> : <>
        {filtered.slice(0, 6).map(item => <AttachmentRow key={item.id} item={item} onPress={() => onChange(item)} />)}
        <Text style={ui.muted}>{filtered.length === 0 ? 'No hay resultados.' : filtered.length > 6 ? 'Mostrando 6 de ' + filtered.length + '. Usa el buscador para encontrar otros.' : filtered.length + ' disponibles'}</Text>
      </>}
    </>}
  </View>;
}

export function CommunityAttachments({ items, onOpen }: { items?: CommunityAttachment[]; onOpen: (item: CommunityAttachment) => void }) {
  return items?.length ? <View style={styles.section}>{items.map(item => <AttachmentRow key={item.tipo + '-' + item.id} item={item} onPress={() => onOpen(item)} link />)}</View> : null;
}

function AttachmentRow({ item, selected, link, onPress }: { item: CommunityAttachment; selected?: boolean; link?: boolean; onPress: () => void }) {
  const date = item.fecha ? new Date(item.fecha) : null;
  const detail = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : item.duracion;
  return <Pressable accessibilityRole="button" accessibilityLabel={(selected ? 'Quitar ' : link ? 'Abrir ' : 'Asociar ') + item.titulo} onPress={onPress} style={[styles.row, selected && styles.selected]}>
    <View>
      {item.imagen ? <Image source={{ uri: item.imagen }} contentFit="cover" style={styles.image} /> : <View style={[styles.image, styles.placeholder]}><Ionicons name={item.tipo === 'evento' ? 'calendar-outline' : 'play-circle-outline'} size={25} color={palette.amber} /></View>}
      <Text style={styles.badge}>{item.tipo === 'evento' ? 'EVENTO' : 'PREVIEW'}</Text>
    </View>
    <View style={{ flex: 1, gap: 4 }}><Text style={styles.title} numberOfLines={2}>{item.titulo}</Text><Text style={ui.muted} numberOfLines={2}>{item.detalle}</Text>{detail ? <Text style={styles.date}>{detail}</Text> : null}</View>
    <Ionicons name={selected ? 'close-circle' : link ? 'chevron-forward' : 'add-circle'} size={25} color={palette.amber} />
  </Pressable>;
}

const styles = StyleSheet.create({
  section: { gap: 9, marginVertical: 7 },
  label: { color: palette.text, fontSize: 12, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 10, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  selected: { borderColor: palette.orange, backgroundColor: '#FF790018' },
  image: { width: 58, height: 64, borderRadius: 9 },
  placeholder: { backgroundColor: palette.surface2, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', bottom: 0, alignSelf: 'center', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, backgroundColor: palette.orange, color: '#111', fontSize: 8, fontWeight: '900' },
  title: { color: palette.text, fontSize: 14, fontWeight: '800' },
  date: { color: palette.amber, fontSize: 11, fontWeight: '800' },
});

