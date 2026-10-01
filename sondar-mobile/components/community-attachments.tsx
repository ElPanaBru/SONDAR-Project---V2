import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette } from '@/constants/sondar';
import { api } from '@/lib/api';
import { normalizeEvent, normalizeReel } from '@/lib/normalizers';
import { Button, ErrorNotice, Field, Loading, ui } from './sondar-ui';

export type CommunityAttachment = { id: number; tipo: 'evento' | 'reel'; titulo: string; imagen?: string; detalle?: string; fecha?: string; duracion?: string };
type Choice = CommunityAttachment & { search: string; heading?: string; subtitle?: string; secondary?: string };

export function CommunityAttachmentPicker({ type, token, value, onChange, disabled = false }: { disabled?: boolean; type: 'evento' | 'reel'; token?: string | null; value: CommunityAttachment | null; onChange: (value: CommunityAttachment | null) => void }) {
  const [items, setItems] = useState<Choice[]>([]);
  const [query, setQuery] = useState('');
  const [width, setWidth] = useState(0);
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
            heading: item.creador || item.titulo, subtitle: item.genero, secondary: item.titulo,
            fecha: item.fecha,
            search: [item.titulo, item.creador, item.lugar, item.genero].filter(Boolean).join(' ').toLowerCase(),
          };
        }
        const item = normalizeReel(raw);
        return {
          id: Number(item.backendId || item.id), tipo: type, titulo: item.tema, imagen: item.portada,
          detalle: [item.artista, item.genero].filter(Boolean).join(' / '),
          heading: item.tema, subtitle: [item.artista, item.genero].filter(Boolean).join(' · '), secondary: item.genero,
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
  return <View style={styles.pickerSection} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <Text style={styles.pickerLabel}>{type === 'evento' ? 'EVENTO ASOCIADO (OPCIONAL)' : 'PREVIEW ASOCIADA (OPCIONAL)'}</Text>
    <Field editable={!disabled} value={query} onChangeText={setQuery} placeholder={type === 'evento' ? 'Buscar por evento, lugar, creador o género' : 'Buscar por tema, artista, preview o género'} style={styles.searchField} />
    {loading ? <Loading /> : error ? <><ErrorNotice message={error} /><Button kind="secondary" disabled={disabled} onPress={retry}>Reintentar</Button></> : <>
      {value && !filtered.slice(0, 6).some(item => item.id === value.id) ? <AttachmentChoice item={items.find(item => item.id === value.id) || { ...value, search: '' }} selected disabled={disabled} onPress={() => onChange(null)} /> : null}
      <View style={styles.choiceGrid}>
        {filtered.slice(0, 6).map(item => <View key={item.id} style={{ width: width >= 650 ? (width - 12) / 2 : '100%' }}><AttachmentChoice item={item} selected={value?.id === item.id} disabled={disabled} onPress={() => onChange(value?.id === item.id ? null : item)} /></View>)}
      </View>
      <Text style={ui.muted}>{filtered.length === 0 ? 'No hay resultados.' : filtered.length > 6 ? 'Mostrando 6 de ' + filtered.length + '. Usá el buscador para encontrar otros.' : filtered.length + (type === 'evento' ? (filtered.length === 1 ? ' evento disponible' : ' eventos disponibles') : (filtered.length === 1 ? ' preview disponible' : ' previews disponibles'))}</Text>
    </>}
  </View>;
}

function AttachmentChoice({ item, selected, disabled, onPress }: { item: Choice; selected?: boolean; disabled?: boolean; onPress: () => void }) {
  const date = item.fecha ? new Date(item.fecha) : null;
  const detail = item.tipo === 'evento' && date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : item.duracion;
  return <Pressable accessibilityRole="button" accessibilityLabel={(selected ? 'Quitar ' : 'Asociar ') + (item.heading || item.titulo)} accessibilityState={{ selected: Boolean(selected), disabled }} disabled={disabled} onPress={onPress} style={[styles.choice, selected && styles.selected]}>
    <View style={styles.choiceCover}>
      {item.imagen ? <Image source={{ uri: item.imagen }} contentFit="cover" style={styles.choiceImage} /> : <View style={[styles.choiceImage, styles.choicePlaceholder]}><Ionicons name="disc-outline" size={60} color="#FFAE00" /></View>}
      <Text style={styles.choiceBadge}>{item.tipo === 'evento' ? 'EVENTO' : 'PREVIEW'}</Text>
    </View>
    <View style={styles.choiceInfo}>
      <Text style={styles.choiceTitle} numberOfLines={2}>{item.heading || item.titulo}</Text>
      <Text style={ui.muted} numberOfLines={2}>{item.subtitle || item.detalle}</Text>
      <View style={styles.choiceBottom}><Text style={[ui.muted, { flex: 1 }]} numberOfLines={1}>{item.secondary}</Text>{detail ? <Text style={styles.choiceDate}>{detail}</Text> : null}</View>
    </View>
    <View style={[styles.choiceAdd, selected && styles.choiceAdded]}><Ionicons name={selected ? 'close' : 'add'} size={22} color="#080808" /></View>
  </Pressable>;
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
  pickerSection: { gap: 12 },
  pickerLabel: { color: '#C8C8C8', fontSize: 13, fontWeight: '800' },
  searchField: { minHeight: 54, backgroundColor: '#222', borderColor: '#333', borderRadius: 10, fontSize: 16 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, minHeight: 100, borderWidth: 1, borderColor: '#333', borderRadius: 15, backgroundColor: '#181818' },
  choiceCover: { width: 68, height: 76 },
  choiceImage: { width: 68, height: 76, borderRadius: 10 },
  choicePlaceholder: { backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' },
  choiceBadge: { position: 'absolute', bottom: 3, alignSelf: 'center', paddingHorizontal: 6, paddingVertical: 3, backgroundColor: '#FF9900', borderRadius: 12, color: '#000', fontSize: 10, fontWeight: '900' },
  choiceInfo: { flex: 1, minWidth: 0, gap: 6 },
  choiceTitle: { color: '#FFF', fontWeight: '900', fontSize: 15 },
  choiceBottom: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  choiceDate: { color: '#FFAE00', fontWeight: '900', fontSize: 12 },
  choiceAdd: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D0D0D0', justifyContent: 'center', alignItems: 'center' },
  choiceAdded: { backgroundColor: '#FFAE00' },
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

