import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { EventMap } from '@/components/event-map';
import { EventLocationPicker } from '@/components/event-location-picker';
import { ReportModal, type ReportPayload } from '@/components/report-modal';
import { Avatar, Button, Empty, ErrorNotice, Field, Header, IconButton, Loading, Screen, ui } from '@/components/sondar-ui';
import { formatGenre, genres, musicGenres, palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';
import { api, mediaPart } from '@/lib/api';
import { normalizeEvent } from '@/lib/normalizers';

type EventPreview = {
  id: number | string; backendId?: number | string; artista: string; usuario: string; tema: string; album?: string;
  genero: string; descripcion?: string; portada?: string; audio?: string; avatar?: string; creadorId?: string;
  duracion?: string; fragmentStart?: number; fragmentEnd?: number | null;
};

type EventOrganizer = { id?: string; nombre?: string; username?: string; usuario?: string; avatar?: string };

type EventItem = {
  id: number | string; titulo: string; descripcion?: string; genero: string; lugar?: string; ubicacion?: string; fecha: string;
  img?: string; img_url?: string; precio?: number | null; link?: string; latitud: number | string; longitud: number | string;
  creador?: string; creador_id?: string; avatar?: string; guardado?: boolean; organizadores?: EventOrganizer[]; previews?: EventPreview[];
};

const initialRegion = { latitude: -34.6037, longitude: -58.3816, latitudeDelta: .16, longitudeDelta: .16 };
const emptyForm = () => ({ titulo: '', descripcion: '', generos: [] as string[], lugar: '', fecha: new Date(), precio: '', link: '', latitud: initialRegion.latitude, longitud: initialRegion.longitude });

function eventGenres(value?: string) {
  return String(value || '').toLowerCase().split(/\s*(?:\/|,|\|)\s*/).filter(Boolean);
}

function externalEventUrl(value?: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const target = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return /^https?:\/\/[^\s]+$/i.test(target) ? target : '';
}

function previewDuration(value?: string) {
  const [minutes, seconds] = String(value || '0:30').split(':').map(Number);
  const total = ((Number.isFinite(minutes) ? minutes : 0) * 60) + (Number.isFinite(seconds) ? seconds : 30);
  return Math.max(1, total || 30);
}

export default function EventsScreen() {
  const { token, user } = useAuth();
  const { eventId } = useLocalSearchParams<{ eventId?: string | string[] }>();
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
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<EventItem | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const tabBarHeight = useBottomTabBarHeight();

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try { setEvents((await api<EventItem[]>('/api/eventos', { token })).map(normalizeEvent)); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los eventos.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  useEffect(() => {
    const requestedId = Array.isArray(eventId) ? eventId[0] : eventId;
    if (!requestedId || loading) return;

    const task = setTimeout(() => {
      const target = events.find(event => String(event.id) === requestedId);
      if (target) setSelected(target);
      else Alert.alert('SONDAR', 'El evento ya no está disponible.');
      router.setParams({ eventId: undefined });
    }, 0);

    return () => clearTimeout(task);
  }, [eventId, events, loading]);

  useEffect(() => {
    const task = setTimeout(() => setPlayingPreviewId(null), 0);
    return () => clearTimeout(task);
  }, [selected?.id]);

  useEffect(() => {
    if (organizerQuery.trim().length < 2) return;
    const timeout = setTimeout(() => api<any[]>(`/api/usuarios?query=${encodeURIComponent(organizerQuery)}`, { token }).then(setOrganizerResults).catch(() => setOrganizerResults([])), 300);
    return () => clearTimeout(timeout);
  }, [organizerQuery, token]);

  const filtered = useMemo(() => events.filter(event => genre === 'todos' || eventGenres(event.genero).includes(genre)), [events, genre]);

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
    if (!form.titulo.trim() || !form.lugar.trim() || form.generos.length === 0) return setError('Completá el nombre, el lugar y al menos un género.');
    setBusy(true);
    try {
      const body = new FormData();
      body.append('titulo', form.titulo.trim()); body.append('descripcion', form.descripcion.trim()); body.append('genero', form.generos.join(' / '));
      body.append('ubicacion', form.lugar.trim()); body.append('fecha', form.fecha.toISOString()); body.append('precio', form.precio);
      body.append('link', form.link.trim()); body.append('latitud', String(form.latitud)); body.append('longitud', String(form.longitud));
      body.append('organizadores', JSON.stringify(organizers.map(item => item.id)));
      if (image) body.append('imagen', mediaPart(image, 'evento.jpg'));
      const created = normalizeEvent(await api<EventItem>('/api/eventos/crear', { method: 'POST', token, body }));
      setEvents(current => [created, ...current]); setSelected(created); setCreating(false); setForm(emptyForm()); setImage(null); setOrganizers([]); setOrganizerOpen(false); setOrganizerQuery(''); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el evento.'); }
    finally { setBusy(false); }
  }

  function toggleEventGenre(value: string) {
    setForm(current => {
      const selected = current.generos.includes(value);
      if (!selected && current.generos.length >= 3) {
        setError('Podés elegir hasta 3 géneros.');
        return current;
      }
      setError('');
      return { ...current, generos: selected ? current.generos.filter(item => item !== value) : [...current.generos, value] };
    });
  }

  async function toggleSave(event: EventItem) {
    try {
      const result = await api<{ guardado: boolean }>(`/api/eventos/${event.id}/guardar`, { method: 'POST', token });
      setEvents(items => items.map(item => item.id === event.id ? { ...item, guardado: result.guardado } : item));
      setSelected(value => value?.id === event.id ? { ...value, guardado: result.guardado } : value);
    } catch (e) { Alert.alert('SONDAR', e instanceof Error ? e.message : 'No se pudo guardar.'); }
  }

  async function openEventLink(event: EventItem) {
    const target = externalEventUrl(event.link);
    if (!target) {
      Alert.alert('Enlace no disponible', 'Este evento no tiene un enlace válido.');
      return;
    }

    try {
      await Linking.openURL(target);
    } catch {
      Alert.alert('No se pudo abrir', 'Revisá el enlace de compra e intentá nuevamente.');
    }
  }

  async function shareEvent(event: EventItem) {
    const target = externalEventUrl(event.link);
    const place = event.lugar || event.ubicacion;
    const date = event.fecha ? new Date(event.fecha).toLocaleString('es-AR') : '';
    const message = [`${event.titulo} en SONDAR`, place, date, target].filter(Boolean).join('\n');

    try {
      await Share.share({ title: event.titulo, message, ...(target && Platform.OS === 'ios' ? { url: target } : {}) });
    } catch {
      Alert.alert('SONDAR', 'No se pudo compartir el evento.');
    }
  }

  function openParticipant(id?: string | number) {
    if (!id) return;
    setSelected(null);
    router.push({ pathname: '/profile/[id]', params: { id: String(id) } });
  }

  function openPreview(preview: EventPreview) {
    setSelected(null);
    router.push({ pathname: '/discover', params: { reelId: String(preview.backendId || preview.id) } });
  }

  async function submitReport(payload: ReportPayload) {
    if (!reportTarget) return;
    setReportBusy(true);
    try {
      await api(`/api/eventos/${reportTarget.id}/denunciar`, { method: 'POST', token, body: JSON.stringify(payload) });
      setReportTarget(null);
      Alert.alert('Listo', 'Recibimos tu denuncia.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar la denuncia.');
    } finally {
      setReportBusy(false);
    }
  }

  function remove(event: EventItem) {
    Alert.alert('Eliminar evento', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => api(`/api/eventos/${event.id}`, { method: 'DELETE', token }).then(() => { setEvents(v => v.filter(x => x.id !== event.id)); setSelected(null); }).catch(e => Alert.alert('Error', e.message)) },
    ]);
  }

  return (
    <Screen>
      <Header title="Eventos" subtitle="Lo que está sonando cerca" actions={<><IconButton name="chatbubbles-outline" onPress={() => router.push('/messages')} /><IconButton name="notifications-outline" onPress={() => router.push('/notifications')} /><IconButton name="add" active onPress={() => setCreating(true)} /></>} />
      {loading ? <Loading /> : <View style={[styles.body, { paddingBottom: tabBarHeight }]}>
        <EventMap events={filtered} initialRegion={initialRegion} customMapStyle={darkMap} onSelect={setSelected} style={styles.map} />
        <View style={styles.sheet}>
          <View style={styles.genreRail}>
            <FlatList horizontal bounces={false} directionalLockEnabled nestedScrollEnabled showsHorizontalScrollIndicator={false} data={genres} keyExtractor={item => item} style={styles.genreList} contentContainerStyle={styles.chips} renderItem={({ item }) => <Pressable onPress={() => setGenre(item)} style={[styles.chip, genre === item && styles.chipActive]}><Text style={[styles.chipText, genre === item && styles.chipTextActive]}>{item === 'todos' ? 'Todos' : formatGenre(item)}</Text></Pressable>} />
          </View>
          <ErrorNotice message={error} />
          <FlatList horizontal showsHorizontalScrollIndicator={false} data={filtered} keyExtractor={item => String(item.id)} refreshing={refreshing} onRefresh={() => load(true)} contentContainerStyle={styles.list} ListEmptyComponent={<Empty title="No hay eventos en este género" />} renderItem={({ item }) => <EventCard event={item} onPress={() => setSelected(item)} onSave={() => toggleSave(item)} />} />
        </View>
      </View>}

      <Modal visible={Boolean(selected)} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}><ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCard}>{selected ? <>
          <View style={styles.modalTop}>
            <View style={styles.modalTitle}><Text style={styles.eventEyebrow}>EVENTO</Text><Text style={ui.h1}>{selected.titulo}</Text></View>
            <View style={styles.modalActions}><IconButton name={selected.guardado ? 'bookmark' : 'bookmark-outline'} active={selected.guardado} onPress={() => toggleSave(selected)} /><IconButton name="share-social-outline" onPress={() => shareEvent(selected)} /><IconButton name="close" onPress={() => setSelected(null)} /></View>
          </View>
          {(selected.img || selected.img_url || selected.avatar) ? <Image source={{ uri: selected.img || selected.img_url || selected.avatar }} style={styles.hero} contentFit="cover" /> : <View style={[styles.hero, styles.heroFallback]}><Ionicons name="musical-notes" size={50} color={palette.orange} /></View>}
          <View style={styles.detailGenres}>{eventGenres(selected.genero).map(item => <View key={item} style={styles.detailGenre}><Text style={styles.detailGenreText}>{formatGenre(item)}</Text></View>)}</View>
          <View style={styles.detailLine}><Ionicons name="calendar" size={19} color={palette.orange} /><Text style={ui.text}>{new Date(selected.fecha).toLocaleString('es-AR')}</Text></View>
          <View style={styles.detailLine}><Ionicons name="location" size={19} color={palette.orange} /><Text style={ui.text}>{selected.lugar || selected.ubicacion}</Text></View>
          <View style={styles.detailLine}><Ionicons name="ticket" size={19} color={palette.orange} /><Text style={ui.text}>{selected.precio ? `$ ${selected.precio}` : 'Entrada libre / consultar'}</Text></View>
          <Text style={styles.description}>{selected.descripcion || 'Sin descripción.'}</Text>
          {externalEventUrl(selected.link) ? <Button icon="open-outline" onPress={() => openEventLink(selected)}>Comprar entradas</Button> : null}

          <View style={styles.participantsSection}>
            <Text style={styles.sectionLabel}>MÚSICOS</Text>
            <View style={styles.participantsRow}>
              <Pressable disabled={!selected.creador_id} onPress={() => openParticipant(selected.creador_id)} style={styles.participantChip}><Avatar uri={selected.avatar} name={selected.creador || 'SONDAR'} size={34} /><View><Text style={styles.participantName} numberOfLines={1}>{selected.creador || 'SONDAR'}</Text><Text style={styles.participantRole}>Organiza</Text></View></Pressable>
              {(selected.organizadores || []).map((item, index) => <Pressable key={String(item.id || item.username || index)} disabled={!item.id} onPress={() => openParticipant(item.id)} style={styles.participantChip}><Avatar uri={item.avatar} name={item.nombre || item.username || item.usuario} size={34} /><View><Text style={styles.participantName} numberOfLines={1}>{item.nombre || item.username || item.usuario || 'Artista'}</Text><Text style={styles.participantRole}>Invitado</Text></View></Pressable>)}
            </View>
          </View>

          <View style={styles.actionRow}><Button kind="secondary" icon="share-social-outline" onPress={() => shareEvent(selected)}>Compartir</Button><Button kind="ghost" icon="flag-outline" onPress={() => setReportTarget(selected)}>Denunciar</Button></View>
          {selected.creador_id === user?.id ? <Button kind="danger" icon="trash-outline" onPress={() => remove(selected)}>Eliminar evento</Button> : null}

          <View style={styles.previewsSection}>
            <Text style={styles.sectionLabel}>PREVIEWS</Text>
            <Text style={styles.previewsTitle}>Así suena este evento</Text>
            <Text style={styles.previewsCaption}>Previews publicadas por sus participantes</Text>
            {(selected.previews || []).length ? <View style={styles.previewList}>{(selected.previews || []).map(preview => { const previewId = String(preview.backendId || preview.id); return <EventPreviewRow key={previewId} preview={preview} active={playingPreviewId === previewId} onActiveChange={active => setPlayingPreviewId(active ? previewId : null)} onOpen={() => openPreview(preview)} />; })}</View> : <View style={styles.previewsEmpty}><Ionicons name="musical-notes-outline" size={25} color={palette.orange} /><Text style={styles.previewsEmptyText}>Los participantes todavía no publicaron previews.</Text></View>}
          </View>
        </> : null}</ScrollView></View>
      </Modal>

      <Modal visible={creating} animationType="slide" onRequestClose={() => setCreating(false)}>
        <Screen scroll><Header title="Crear nuevo evento" subtitle="EVENTOS" back onBack={() => setCreating(false)} actions={<IconButton name="close" onPress={() => setCreating(false)} />} />
          <ErrorNotice message={error} />

          <View style={styles.creatorSection}>
            <View style={styles.creatorSectionTitle}><Ionicons name="sparkles" size={17} color={palette.amber} /><Text style={styles.creatorHeading}>Información del evento</Text></View>
            <Field label="Nombre del evento *" value={form.titulo} onChangeText={titulo => setForm(f => ({ ...f, titulo }))} placeholder="Ej: Noche SONDAR" maxLength={120} />
            <Field label="Descripción" value={form.descripcion} onChangeText={descripcion => setForm(f => ({ ...f, descripcion }))} placeholder="Contá de qué se trata…" multiline maxLength={1000} />
            <Pressable onPress={pickImage} style={styles.imagePicker}>{image ? <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <><Ionicons name="image-outline" size={32} color={palette.orange} /><Text style={styles.fileTitle}>Elegir imagen</Text><Text style={ui.muted}>JPG, PNG o WEBP</Text></>}</Pressable>
            {image ? <Button kind="secondary" icon="trash-outline" onPress={() => setImage(null)}>Quitar imagen</Button> : null}
          </View>

          <EventLocationPicker
            coordinate={{ latitude: form.latitud, longitude: form.longitud }}
            onChange={coordinate => setForm(current => ({ ...current, latitud: coordinate.latitude, longitud: coordinate.longitude }))}
            customMapStyle={darkMap}
          />
          <View style={styles.locationMeta}><Text style={styles.coordinates}>{form.latitud.toFixed(5)}, {form.longitud.toFixed(5)}</Text><Pressable onPress={locateMe} style={styles.inlineAction}><Ionicons name="navigate" size={16} color={palette.amber} /><Text style={styles.inlineActionText}>Usar mi ubicación</Text></Pressable></View>

          <View style={styles.creatorSection}>
            <View style={styles.organizerHeader}><View style={{ flex: 1 }}><Text style={styles.creatorHeading}>INVITADOS O BANDAS INVITADAS</Text><Text style={styles.creatorCaption}>Vos sos quien crea el evento</Text></View><Text style={styles.genreCounter}>{organizers.length}/8</Text></View>
            {organizers.map(item => <Pressable key={item.id} style={[styles.personResult, styles.selectedPerson]} onPress={() => setOrganizers(v => v.filter(o => o.id !== item.id))}><Text style={ui.text}>{item.nombre || `@${item.username || item.usuario}`}</Text><Ionicons name="close-circle" color={palette.danger} size={22} /></Pressable>)}
            <Pressable style={styles.addOrganizer} onPress={() => setOrganizerOpen(open => !open)}><Ionicons name={organizerOpen ? 'remove' : 'add'} size={22} color={palette.amber} /><Text style={styles.addOrganizerText}>{organizerOpen ? 'Cerrar buscador' : 'Agregar invitado'}</Text></Pressable>
            {organizerOpen ? <Field label="Buscar invitado" value={organizerQuery} onChangeText={value => { setOrganizerQuery(value); if (value.trim().length < 2) setOrganizerResults([]); }} placeholder="Nombre o @usuario" autoCapitalize="none" /> : null}
            {organizerOpen ? organizerResults.filter(item => !organizers.some(o => o.id === item.id)).slice(0, 4).map(item => <Pressable key={item.id} style={styles.personResult} onPress={() => { setOrganizers(v => [...v, item]); setOrganizerQuery(''); setOrganizerResults([]); }}><View><Text style={ui.text}>{item.nombre || item.username || item.usuario}</Text><Text style={ui.muted}>@{String(item.username || item.usuario || '').replace(/^@/, '')}</Text></View><Ionicons name="add-circle" color={palette.orange} size={22} /></Pressable>) : null}
          </View>

          <View style={styles.creatorSection}>
            <View style={styles.organizerHeader}><Text style={styles.creatorHeading}>Géneros musicales</Text><Text style={styles.genreCounter}>{form.generos.length}/3</Text></View>
            <View style={styles.genreWrap}>{musicGenres.map(item => { const active = form.generos.includes(item); return <Pressable key={item} onPress={() => toggleEventGenre(item)} style={[styles.genreChoice, active && styles.genreChoiceActive]}><Text style={[styles.genreChoiceText, active && styles.genreChoiceTextActive]}>{formatGenre(item)}</Text></Pressable>; })}</View>
          </View>

          <View style={styles.creatorSection}>
            <Field label="Lugar *" value={form.lugar} onChangeText={lugar => setForm(f => ({ ...f, lugar }))} placeholder="Nombre del lugar (Ej: Niceto Club, Palermo)" />
            <View style={ui.card}><Text style={styles.formLabel}>Fecha y hora</Text><DateTimePicker value={form.fecha} mode={Platform.OS === 'ios' ? 'datetime' : 'date'} minimumDate={new Date()} onChange={(_, fecha) => fecha && setForm(f => ({ ...f, fecha }))} />{Platform.OS === 'android' ? <DateTimePicker value={form.fecha} mode="time" onChange={(_, fecha) => fecha && setForm(f => ({ ...f, fecha }))} /> : null}</View>
            <Field label="Precio de entrada (opcional)" keyboardType="decimal-pad" value={form.precio} onChangeText={precio => setForm(f => ({ ...f, precio }))} placeholder="0" />
            <Field label="URL de compra (opcional)" autoCapitalize="none" keyboardType="url" value={form.link} onChangeText={link => setForm(f => ({ ...f, link }))} placeholder="https://…" />
          </View>

          <Button onPress={createEvent} disabled={busy}>{busy ? 'Guardando…' : 'Crear evento'}</Button>
        </Screen>
      </Modal>
      <ReportModal visible={Boolean(reportTarget)} subject={reportTarget?.titulo} busy={reportBusy} onClose={() => setReportTarget(null)} onSubmit={submitReport} />
    </Screen>
  );
}

/* eslint-disable react-hooks/immutability -- expo-video exposes currentTime as an intentionally writable seek API. */
function EventPreviewRow({ preview, active, onActiveChange, onOpen }: { preview: EventPreview; active: boolean; onActiveChange: (active: boolean) => void; onOpen: () => void }) {
  const fragmentStart = Math.max(0, Number(preview.fragmentStart) || 0);
  const storedFragmentEnd = Number(preview.fragmentEnd);
  const fragmentEnd = storedFragmentEnd > fragmentStart ? storedFragmentEnd : fragmentStart + previewDuration(preview.duracion);
  const playable = Boolean(preview.audio);
  const player = useVideoPlayer(preview.audio || null, instance => { instance.loop = false; instance.timeUpdateEventInterval = .25; });
  const { isPlaying: playing } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  useEffect(() => {
    if (!active) player.pause();
  }, [active, player]);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      if (player.currentTime >= fragmentEnd || player.currentTime < fragmentStart) {
        player.pause();
        player.currentTime = fragmentStart;
        onActiveChange(false);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [fragmentEnd, fragmentStart, onActiveChange, player, playing]);

  function togglePlay() {
    if (!playable) {
      onOpen();
      return;
    }
    if (playing) {
      player.pause();
      onActiveChange(false);
      return;
    }
    onActiveChange(true);
    if (player.currentTime < fragmentStart || player.currentTime >= fragmentEnd) player.currentTime = fragmentStart;
    player.play();
  }

  const genreLabel = eventGenres(preview.genero).map(formatGenre).join(' / ');
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.previewRow, pressed && styles.previewPressed]}>
      {preview.portada ? <Image source={{ uri: preview.portada }} style={styles.previewCover} contentFit="cover" /> : <View style={[styles.previewCover, styles.previewCoverFallback]}><Ionicons name="musical-note" size={24} color={palette.orange} /></View>}
      <View style={styles.previewInfo}><Text style={styles.previewName} numberOfLines={1}>{preview.tema}</Text><Text style={styles.previewArtist} numberOfLines={1}>{preview.artista}{genreLabel ? ` · ${genreLabel}` : ''}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pausar preview' : 'Reproducir preview'} hitSlop={8} onPress={event => { event.stopPropagation(); togglePlay(); }} style={({ pressed }) => [styles.previewPlay, active && playing && styles.previewPlayActive, pressed && styles.previewPressed]}><Ionicons name={!playable ? 'arrow-forward' : playing ? 'pause' : 'play'} size={21} color={active && playing ? '#111' : palette.amber} /></Pressable>
    </Pressable>
  );
}
/* eslint-enable react-hooks/immutability */

function EventCard({ event, onPress, onSave }: { event: EventItem; onPress: () => void; onSave: () => void }) {
  return <View style={styles.card}><Pressable onPress={onPress} style={styles.cardOpen}><View style={styles.cardImage}><Image source={require('../../assets/images/icon.png')} style={styles.cardLogo} contentFit="contain" /></View><View style={styles.cardInfo}><Text style={styles.cardTitle} numberOfLines={1}>{event.titulo}</Text><Text style={ui.muted} numberOfLines={1}>{event.lugar || event.ubicacion}</Text><Text style={styles.cardDate}>{new Date(event.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}</Text></View></Pressable><IconButton name={event.guardado ? 'bookmark' : 'bookmark-outline'} active={event.guardado} onPress={onSave} /></View>;
}

const styles = StyleSheet.create({
  body: { flex: 1 }, map: { flex: 1 }, sheet: { height: 206, marginTop: -22, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: palette.bg, overflow: 'hidden', paddingTop: 10, paddingBottom: 12 },
  genreRail: { height: 50, flexShrink: 0 },
  genreList: { height: 44, flexGrow: 0, flexShrink: 0 },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 6 }, chip: { height: 36, paddingHorizontal: 14, marginRight: 7, borderRadius: 8, justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, chipActive: { backgroundColor: palette.orange, borderColor: palette.orange }, chipText: { color: palette.muted, textTransform: 'capitalize', fontWeight: '600' }, chipTextActive: { color: '#111' },
  list: { paddingHorizontal: 14, paddingTop: 5, gap: 10 }, card: { width: 292, height: 104, flexDirection: 'row', alignItems: 'center', padding: 10, gap: 11, backgroundColor: palette.surface, borderRadius: 8, borderWidth: 1, borderColor: palette.border }, cardOpen: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 }, cardImage: { width: 82, height: 82, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#050505', borderWidth: 1, borderColor: palette.amber }, cardLogo: { width: 74, height: 74 }, cardInfo: { flex: 1, gap: 4 }, cardTitle: { color: palette.text, fontSize: 16, fontWeight: '800' }, cardDate: { color: palette.amber, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  marker: { width: 48, height: 48, borderRadius: 24, padding: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: palette.amber, borderWidth: 3, borderColor: '#080808' }, markerImage: { width: 38, height: 38, borderRadius: 19 }, markerTip: { width: 0, height: 0, alignSelf: 'center', borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#080808', marginTop: -2 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A' }, modalScroll: { width: '100%', maxHeight: '94%' }, modalCard: { minHeight: '100%', backgroundColor: palette.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 48, gap: 16 }, modalTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, modalTitle: { flex: 1, minWidth: 0, gap: 3 }, modalActions: { flexDirection: 'row', gap: 6 }, eventEyebrow: { color: palette.orange, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }, hero: { width: '100%', height: 220, borderRadius: 10 }, heroFallback: { backgroundColor: palette.surface2, alignItems: 'center', justifyContent: 'center' }, detailGenres: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, detailGenre: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#2B180B', borderWidth: 1, borderColor: '#63330E' }, detailGenreText: { color: palette.amber, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }, detailLine: { flexDirection: 'row', alignItems: 'center', gap: 10 }, description: { color: palette.text, lineHeight: 22 }, actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 },
  participantsSection: { gap: 9 }, sectionLabel: { color: palette.orange, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }, participantsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, participantChip: { minWidth: 142, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface }, participantName: { maxWidth: 130, color: palette.text, fontSize: 12, fontWeight: '800' }, participantRole: { color: palette.muted, fontSize: 10, marginTop: 1 },
  previewsSection: { marginTop: 4, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, gap: 5 }, previewsTitle: { color: palette.text, fontSize: 21, fontWeight: '900' }, previewsCaption: { color: palette.muted, fontSize: 12, marginBottom: 8 }, previewList: { gap: 9 }, previewRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 9, borderRadius: 11, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface }, previewPressed: { opacity: .72 }, previewCover: { width: 54, height: 54, borderRadius: 8, overflow: 'hidden' }, previewCoverFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface2 }, previewInfo: { flex: 1, minWidth: 0, gap: 4 }, previewName: { color: palette.text, fontSize: 14, fontWeight: '900' }, previewArtist: { color: palette.muted, fontSize: 11 }, previewPlay: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.amber, backgroundColor: '#20150B' }, previewPlayActive: { backgroundColor: palette.amber }, previewsEmpty: { minHeight: 86, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.border }, previewsEmptyText: { flex: 1, color: palette.muted, fontSize: 12, lineHeight: 18 },
  imagePicker: { height: 180, borderRadius: 8, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 8 }, formLabel: { color: palette.muted, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  personResult: { minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 8, borderWidth: 1, borderColor: palette.border }, selectedPerson: { borderColor: palette.orange },
  creatorSection: { gap: 12, padding: 14, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  creatorSectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 }, creatorHeading: { color: palette.text, fontSize: 13, fontWeight: '900' }, creatorCaption: { color: palette.muted, fontSize: 11, marginTop: 3 },
  fileTitle: { color: palette.text, fontWeight: '900' }, locationMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, coordinates: { color: palette.muted, fontSize: 11 }, inlineAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#2B180B' }, inlineActionText: { color: palette.amber, fontSize: 12, fontWeight: '800' },
  organizerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, genreCounter: { color: palette.amber, fontWeight: '900' }, addOrganizer: { minHeight: 48, borderRadius: 9, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.amber, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 }, addOrganizerText: { color: palette.amber, fontWeight: '900' },
  genreWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, genreChoice: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface2 }, genreChoiceActive: { backgroundColor: palette.amber, borderColor: palette.amber }, genreChoiceText: { color: palette.muted, fontSize: 12, fontWeight: '800' }, genreChoiceTextActive: { color: '#111' },
});

const darkMap = [{ elementType: 'geometry', stylers: [{ color: '#17191e' }] }, { elementType: 'labels.text.fill', stylers: [{ color: '#8a8f9b' }] }, { elementType: 'labels.text.stroke', stylers: [{ color: '#17191e' }] }, { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#282b33' }] }, { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#090b10' }] }];
