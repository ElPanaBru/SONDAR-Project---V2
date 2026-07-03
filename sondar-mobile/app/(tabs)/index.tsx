import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { Button, Empty, ErrorNotice, Field, Header, IconButton, Loading, Screen, ui } from '@/components/sondar-ui';
import { genres, palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';
import { api, mediaPart } from '@/lib/api';

type EventItem = {
  id: number; titulo: string; descripcion?: string; genero: string; lugar?: string; ubicacion?: string; fecha: string;
  img?: string; img_url?: string; precio?: number | null; link?: string; latitud: number | string; longitud: number | string;
  creador?: string; creador_id?: string; avatar?: string; guardado?: boolean; organizadores?: any[];
};

const initialRegion = { latitude: -34.6037, longitude: -58.3816, latitudeDelta: .16, longitudeDelta: .16 };
const emptyForm = () => ({ titulo: '', descripcion: '', genero: 'rock', lugar: '', fecha: new Date(), precio: '', link: '', latitud: initialRegion.latitude, longitud: initialRegion.longitude });

export default function EventsScreen() {
  const { token, user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [genre, setGenre] = useState('todos');
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [organizerQuery, setOrganizerQuery] = useState('');
  const [organizerResults, setOrganizerResults] = useState<any[]>([]);
  const [organizers, setOrganizers] = useState<any[]>([]);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try { setEvents(await api<EventItem[]>('/api/eventos', { token })); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los eventos.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  useEffect(() => {
    if (organizerQuery.trim().length < 2) return;
    const timeout = setTimeout(() => api<any[]>(`/api/usuarios?query=${encodeURIComponent(organizerQuery)}`, { token }).then(setOrganizerResults).catch(() => setOrganizerResults([])), 300);
    return () => clearTimeout(timeout);
  }, [organizerQuery, token]);

  const filtered = useMemo(() => events.filter(event => genre === 'todos' || event.genero?.toLowerCase() === genre), [events, genre]);

  async function locateMe() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return Alert.alert('Ubicación', 'Necesitamos permiso para usar tu posición.');
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setForm(f => ({ ...f, latitud: position.coords.latitude, longitud: position.coords.longitude }));
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .85, allowsEditing: true, aspect: [16, 10] });
    if (!result.canceled) setImage(result.assets[0]);
  }

  async function createEvent() {
    if (!form.titulo.trim() || !form.lugar.trim()) return setError('Completá título y ubicación.');
    setBusy(true);
    try {
      const body = new FormData();
      body.append('titulo', form.titulo.trim()); body.append('descripcion', form.descripcion.trim()); body.append('genero', form.genero);
      body.append('ubicacion', form.lugar.trim()); body.append('fecha', form.fecha.toISOString()); body.append('precio', form.precio);
      body.append('link', form.link.trim()); body.append('latitud', String(form.latitud)); body.append('longitud', String(form.longitud));
      body.append('organizadores', JSON.stringify(organizers.map(item => item.id)));
      if (image) body.append('imagen', mediaPart(image, 'evento.jpg'));
      const created = await api<EventItem>('/api/eventos/crear', { method: 'POST', token, body });
      setEvents(current => [created, ...current]); setSelected(created); setCreating(false); setForm(emptyForm()); setImage(null); setOrganizers([]); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el evento.'); }
    finally { setBusy(false); }
  }

  async function toggleSave(event: EventItem) {
    try {
      const result = await api<{ guardado: boolean }>(`/api/eventos/${event.id}/guardar`, { method: 'POST', token });
      setEvents(items => items.map(item => item.id === event.id ? { ...item, guardado: result.guardado } : item));
      setSelected(value => value?.id === event.id ? { ...value, guardado: result.guardado } : value);
    } catch (e) { Alert.alert('SONDAR', e instanceof Error ? e.message : 'No se pudo guardar.'); }
  }

  function report(event: EventItem) {
    Alert.alert('Denunciar evento', '¿Querés enviar esta denuncia al equipo de moderación?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Denunciar', style: 'destructive', onPress: () => api(`/api/eventos/${event.id}/denunciar`, { method: 'POST', token, body: JSON.stringify({ reason: 'contenido_inapropiado', detail: 'Denuncia desde la app móvil' }) }).then(() => Alert.alert('Listo', 'Recibimos tu denuncia.')).catch(e => Alert.alert('Error', e.message)) },
    ]);
  }

  function remove(event: EventItem) {
    Alert.alert('Eliminar evento', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => api(`/api/eventos/${event.id}`, { method: 'DELETE', token }).then(() => { setEvents(v => v.filter(x => x.id !== event.id)); setSelected(null); }).catch(e => Alert.alert('Error', e.message)) },
    ]);
  }

  return (
    <Screen>
      <Header title="Eventos" subtitle="Lo que está sonando cerca" actions={<><IconButton name="notifications-outline" onPress={() => router.push('/notifications')} /><IconButton name="add" active onPress={() => setCreating(true)} /></>} />
      {loading ? <Loading /> : <View style={styles.body}>
        <MapView provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined} style={styles.map} initialRegion={initialRegion} customMapStyle={darkMap}>
          {filtered.map(event => {
            const latitude = Number(event.latitud), longitude = Number(event.longitud);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
            const markerImage = event.img || event.img_url;
            return <Marker key={event.id} coordinate={{ latitude, longitude }} title={event.titulo} description={event.lugar || event.ubicacion} onPress={() => setSelected(event)} anchor={{ x: .5, y: 1 }}>
              <View style={styles.marker}>{markerImage ? <Image source={{ uri: markerImage }} style={styles.markerImage} contentFit="cover" /> : <Ionicons name="musical-note" size={18} color="#080808" />}</View>
              <View style={styles.markerTip} />
            </Marker>;
          })}
        </MapView>
        <View style={styles.sheet}>
          <FlatList horizontal showsHorizontalScrollIndicator={false} data={genres} keyExtractor={item => item} contentContainerStyle={styles.chips} renderItem={({ item }) => <Pressable onPress={() => setGenre(item)} style={[styles.chip, genre === item && styles.chipActive]}><Text style={[styles.chipText, genre === item && styles.chipTextActive]}>{item}</Text></Pressable>} />
          <ErrorNotice message={error} />
          <FlatList horizontal showsHorizontalScrollIndicator={false} data={filtered} keyExtractor={item => String(item.id)} refreshing={refreshing} onRefresh={() => load(true)} contentContainerStyle={styles.list} ListEmptyComponent={<Empty title="No hay eventos en este género" />} renderItem={({ item }) => <EventCard event={item} onPress={() => setSelected(item)} onSave={() => toggleSave(item)} />} />
        </View>
      </View>}

      <Modal visible={Boolean(selected)} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}><ScrollView contentContainerStyle={styles.modalCard}>{selected ? <>
          <View style={styles.modalTop}><Text style={ui.h1}>{selected.titulo}</Text><IconButton name="close" onPress={() => setSelected(null)} /></View>
          {(selected.img || selected.img_url) ? <Image source={{ uri: selected.img || selected.img_url }} style={styles.hero} contentFit="cover" /> : <View style={[styles.hero, styles.heroFallback]}><Ionicons name="musical-notes" size={50} color={palette.orange} /></View>}
          <View style={styles.detailLine}><Ionicons name="calendar" size={19} color={palette.orange} /><Text style={ui.text}>{new Date(selected.fecha).toLocaleString('es-AR')}</Text></View>
          <View style={styles.detailLine}><Ionicons name="location" size={19} color={palette.orange} /><Text style={ui.text}>{selected.lugar || selected.ubicacion}</Text></View>
          <View style={styles.detailLine}><Ionicons name="ticket" size={19} color={palette.orange} /><Text style={ui.text}>{selected.precio ? `$ ${selected.precio}` : 'Entrada libre / consultar'}</Text></View>
          <Text style={styles.description}>{selected.descripcion || 'Sin descripción.'}</Text>
          <Text style={ui.muted}>Organiza @{selected.creador || 'sondar'}{selected.organizadores?.length ? ` + ${selected.organizadores.length} coorganizadores` : ''}</Text>
          <View style={styles.actionRow}><Button kind="secondary" icon={selected.guardado ? 'bookmark' : 'bookmark-outline'} onPress={() => toggleSave(selected)}>{selected.guardado ? 'Guardado' : 'Guardar'}</Button><Button kind="ghost" icon="flag-outline" onPress={() => report(selected)}>Denunciar</Button></View>
          {selected.creador_id === user?.id ? <Button kind="danger" icon="trash-outline" onPress={() => remove(selected)}>Eliminar evento</Button> : null}
        </> : null}</ScrollView></View>
      </Modal>

      <Modal visible={creating} animationType="slide" onRequestClose={() => setCreating(false)}>
        <Screen scroll><Header title="Crear evento" back onBack={() => setCreating(false)} actions={<IconButton name="close" onPress={() => setCreating(false)} />} />
          <ErrorNotice message={error} />
          <Pressable onPress={pickImage} style={styles.imagePicker}>{image ? <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <><Ionicons name="image-outline" size={32} color={palette.orange} /><Text style={ui.muted}>Elegir portada</Text></>}</Pressable>
          <Field label="Título *" value={form.titulo} onChangeText={titulo => setForm(f => ({ ...f, titulo }))} placeholder="Nombre del evento" />
          <Field label="Descripción" value={form.descripcion} onChangeText={descripcion => setForm(f => ({ ...f, descripcion }))} placeholder="Contá de qué se trata" multiline maxLength={1000} />
          <Text style={styles.formLabel}>Género</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{genres.filter(x => x !== 'todos').map(item => <Pressable key={item} onPress={() => setForm(f => ({ ...f, genero: item }))} style={[styles.chip, form.genero === item && styles.chipActive]}><Text style={[styles.chipText, form.genero === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</ScrollView>
          <Field label="Lugar *" value={form.lugar} onChangeText={lugar => setForm(f => ({ ...f, lugar }))} placeholder="Club, sala o dirección" />
          <View style={ui.card}><Text style={styles.formLabel}>Fecha y hora</Text><DateTimePicker value={form.fecha} mode={Platform.OS === 'ios' ? 'datetime' : 'date'} minimumDate={new Date()} onChange={(_, fecha) => fecha && setForm(f => ({ ...f, fecha }))} />{Platform.OS === 'android' ? <DateTimePicker value={form.fecha} mode="time" onChange={(_, fecha) => fecha && setForm(f => ({ ...f, fecha }))} /> : null}</View>
          <View style={styles.actionRow}><Field label="Precio" style={{ minWidth: 120 }} keyboardType="numeric" value={form.precio} onChangeText={precio => setForm(f => ({ ...f, precio }))} placeholder="0" /><View style={{ flex: 1 }}><Field label="Link" autoCapitalize="none" value={form.link} onChangeText={link => setForm(f => ({ ...f, link }))} placeholder="https://…" /></View></View>
          <Button kind="secondary" icon="navigate" onPress={locateMe}>Usar mi ubicación</Button>
          <Field label="Buscar coorganizadores" value={organizerQuery} onChangeText={value => { setOrganizerQuery(value); if (value.trim().length < 2) setOrganizerResults([]); }} placeholder="Nombre o @usuario" />
          {organizerResults.filter(item => !organizers.some(o => o.id === item.id)).slice(0, 4).map(item => <Pressable key={item.id} style={styles.personResult} onPress={() => { setOrganizers(v => [...v, item]); setOrganizerQuery(''); }}><Text style={ui.text}>@{item.username || item.usuario}</Text><Ionicons name="add-circle" color={palette.orange} size={22} /></Pressable>)}
          {organizers.map(item => <Pressable key={item.id} style={[styles.personResult, styles.selectedPerson]} onPress={() => setOrganizers(v => v.filter(o => o.id !== item.id))}><Text style={ui.text}>@{item.username || item.usuario}</Text><Ionicons name="close-circle" color={palette.danger} size={22} /></Pressable>)}
          <Button onPress={createEvent} disabled={busy}>{busy ? 'Publicando…' : 'Publicar evento'}</Button>
        </Screen>
      </Modal>
    </Screen>
  );
}

function EventCard({ event, onPress, onSave }: { event: EventItem; onPress: () => void; onSave: () => void }) {
  const image = event.img || event.img_url;
  return <Pressable onPress={onPress} style={styles.card}>{image ? <Image source={{ uri: image }} style={styles.cardImage} contentFit="cover" /> : <View style={[styles.cardImage, styles.heroFallback]}><Ionicons name="musical-note" size={28} color={palette.orange} /></View>}<View style={styles.cardInfo}><Text style={styles.cardTitle} numberOfLines={1}>{event.titulo}</Text><Text style={ui.muted} numberOfLines={1}>{event.lugar || event.ubicacion}</Text><Text style={styles.cardDate}>{new Date(event.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}</Text></View><IconButton name={event.guardado ? 'bookmark' : 'bookmark-outline'} active={event.guardado} onPress={onSave} /></Pressable>;
}

const styles = StyleSheet.create({
  body: { flex: 1 }, map: { flex: 1 }, sheet: { height: 238, marginTop: -22, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: palette.bg, overflow: 'hidden', paddingTop: 10, paddingBottom: 72 },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 6 }, chip: { height: 36, paddingHorizontal: 14, marginRight: 7, borderRadius: 18, justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, chipActive: { backgroundColor: palette.orange, borderColor: palette.orange }, chipText: { color: palette.muted, textTransform: 'capitalize', fontWeight: '600' }, chipTextActive: { color: '#111' },
  list: { paddingHorizontal: 14, paddingTop: 5, gap: 10 }, card: { width: 292, height: 104, flexDirection: 'row', alignItems: 'center', padding: 10, gap: 11, backgroundColor: palette.surface, borderRadius: 15, borderWidth: 1, borderColor: palette.border }, cardImage: { width: 82, height: 82, borderRadius: 11 }, cardInfo: { flex: 1, gap: 4 }, cardTitle: { color: palette.text, fontSize: 16, fontWeight: '800' }, cardDate: { color: palette.amber, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  marker: { width: 48, height: 48, borderRadius: 24, padding: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: palette.amber, borderWidth: 3, borderColor: '#080808' }, markerImage: { width: 38, height: 38, borderRadius: 19 }, markerTip: { width: 0, height: 0, alignSelf: 'center', borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#080808', marginTop: -2 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A' }, modalCard: { minHeight: '72%', marginTop: 70, backgroundColor: palette.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, paddingBottom: 40, gap: 16 }, modalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, hero: { width: '100%', height: 220, borderRadius: 18 }, heroFallback: { backgroundColor: palette.surface2, alignItems: 'center', justifyContent: 'center' }, detailLine: { flexDirection: 'row', alignItems: 'center', gap: 10 }, description: { color: palette.text, lineHeight: 22 }, actionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  imagePicker: { height: 180, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 8 }, formLabel: { color: palette.muted, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  personResult: { minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 13, borderWidth: 1, borderColor: palette.border }, selectedPerson: { borderColor: palette.orange },
});

const darkMap = [{ elementType: 'geometry', stylers: [{ color: '#17191e' }] }, { elementType: 'labels.text.fill', stylers: [{ color: '#8a8f9b' }] }, { elementType: 'labels.text.stroke', stylers: [{ color: '#17191e' }] }, { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#282b33' }] }, { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#090b10' }] }];
