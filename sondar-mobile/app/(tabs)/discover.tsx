import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useIsFocused } from 'expo-router/react-navigation';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Share, StatusBar as RNStatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Empty, ErrorNotice, Field, Header, IconButton, Loading, Screen, ui } from '@/components/sondar-ui';
import { ReportModal, type ReportPayload } from '@/components/report-modal';
import { formatCount, formatGenre, musicGenres, palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';
import { api, mediaPart } from '@/lib/api';
import { normalizeComment, normalizeReel } from '@/lib/normalizers';

type Reel = { id: number; backendId?: number; artista: string; usuario: string; tema: string; album: string; genero: string; descripcion?: string; portada?: string; audio?: string; avatar?: string; likes: number; comentarios: number | string; compartidos: number; guardados: number; visitas: number; liked?: boolean; guardado?: boolean; siguiendo?: boolean; creadorId?: string; duracion?: string; colorAmbiente?: string; fragmentStart?: number; fragmentEnd?: number };
type Comment = { id: number; userId?: string; parentId?: number | null; usuario: string; avatar?: string; texto: string; respondeA?: string; tiempo?: string; likes?: number; liked?: boolean; respuestas?: Comment[] };
type ReplyTarget = { parentId: number; usuario: string };
const countComments = (items: Comment[]): number => items.reduce((total, item) => total + 1 + countComments(item.respuestas || []), 0);
const removeComment = (items: Comment[], id: number): Comment[] => items
  .filter(item => item.id !== id)
  .map(item => ({ ...item, respuestas: removeComment(item.respuestas || [], id) }));
const emptyReelForm = () => ({ tema: '', album: '', generos: [] as string[], descripcion: '', colorAmbiente: '#8F5136', fragmentStart: 0, fragmentDuration: 30 });
const coverColors = ['#8F5136', '#9B3F28', '#51418F', '#28716A', '#98640F', '#5F3B74'];

export default function DiscoverScreen() {
  const { token, user } = useAuth();
  const { reelId } = useLocalSearchParams<{ reelId?: string | string[] }>();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState<number | null>(null);
  const [commentReel, setCommentReel] = useState<Reel | null>(null);
  const [shareReel, setShareReel] = useState<Reel | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyReelForm);
  const [cover, setCover] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [audio, setAudio] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [reportTarget, setReportTarget] = useState<Reel | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const reelsList = useRef<FlatList<Reel>>(null);
  const viewed = useRef(new Set<number>());
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();
  const { height: windowHeight } = useWindowDimensions();
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 44 : RNStatusBar.currentHeight || 0);
  const reelHeight = Math.max(420, Math.floor(windowHeight - topInset - 58 - tabBarHeight));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await api<Reel[]>('/api/reels', { token })).map(normalizeReel);
      setReels(data); setActive(current => data.some(item => item.id === current) ? current : data[0]?.id || null); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los reels.'); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  useEffect(() => {
    const requestedId = Array.isArray(reelId) ? reelId[0] : reelId;
    if (!requestedId || loading) return;

    const task = setTimeout(() => {
      const index = reels.findIndex(item => String(item.backendId || item.id) === requestedId || String(item.id) === requestedId);
      if (index >= 0) {
        setActive(reels[index].id);
        reelsList.current?.scrollToIndex({ index, animated: false });
      } else {
        Alert.alert('SONDAR', 'La preview ya no está disponible.');
      }
      router.setParams({ reelId: undefined });
    }, 0);

    return () => clearTimeout(task);
  }, [loading, reelId, reels]);

  async function interact(reel: Reel, kind: 'like' | 'guardar') {
    try {
      const result = await api<any>(`/api/reels/${reel.backendId || reel.id}/${kind}`, { method: 'POST', token });
      setReels(items => items.map(item => item.id === reel.id ? { ...item, ...result, liked: kind === 'like' ? result.liked : item.liked, guardado: kind === 'guardar' ? result.guardado : item.guardado } : item));
    } catch (e) { Alert.alert('SONDAR', e instanceof Error ? e.message : 'No se pudo completar la acción.'); }
  }

  async function openComments(reel: Reel) {
    setCommentReel(reel); setReplyTo(null);
    try {
      const normalized = (await api<Comment[]>(`/api/reels/${reel.backendId || reel.id}/comentarios`, { token })).map(normalizeComment);
      setComments(normalized);
      setReels(items => items.map(item => item.id === reel.id ? { ...item, comentarios: countComments(normalized) } : item));
    }
    catch { setComments([]); }
  }

  async function sendComment() {
    if (!comment.trim() || !commentReel) return;
    try {
      const created = normalizeComment(await api<Comment>(`/api/reels/${commentReel.backendId || commentReel.id}/comentarios`, { method: 'POST', token, body: JSON.stringify({ texto: comment.trim(), parentId: replyTo?.parentId, respondeA: replyTo?.usuario }) }));
      setComments(items => replyTo ? appendReply(items, replyTo.parentId, created) : [...items, created]); setComment(''); setReplyTo(null);
      setReels(items => items.map(item => item.id === commentReel.id ? { ...item, comentarios: Number(item.comentarios || 0) + 1 } : item));
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo comentar.'); }
  }

  async function toggleFollow(reel: Reel) {
    if (!reel.creadorId) return;
    try { const result = await api<any>(`/api/usuarios/${reel.creadorId}/seguir`, { method: 'POST', token }); setReels(items => items.map(item => item.creadorId === reel.creadorId ? { ...item, siguiendo: result.siguiendo ?? result.following } : item)); }
    catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo seguir.'); }
  }

  async function registerShare(reel: Reel) {
    const result = await api<{ compartidos: number; nuevoCompartido?: boolean }>(`/api/reels/${reel.backendId || reel.id}/compartir`, { method: 'POST', token });
    setReels(items => items.map(item => item.id === reel.id ? { ...item, compartidos: result.compartidos } : item));
    setShareReel(current => current?.id === reel.id ? { ...current, compartidos: result.compartidos } : current);
    return result;
  }

  function share(reel: Reel) {
    setShareReel(reel);
  }

  async function performShare(reel: Reel) {
    setShareBusy(true);
    try {
      const response = await Share.share({
        title: `${reel.tema} - ${reel.artista}`,
        message: `Escucha "${reel.tema}" de ${reel.artista} en SONDAR.`,
      });
      if (response.action === Share.dismissedAction) return;

      const result = await registerShare(reel);
      if (result.nuevoCompartido === false) {
        Alert.alert('SONDAR', 'Ya habias compartido este reel.');
      }
    } catch (e) {
      Alert.alert('SONDAR', e instanceof Error ? e.message : 'No se pudo compartir.');
    } finally {
      setShareBusy(false);
    }
  }

  async function toggleCommentLike(target: Comment) {
    try {
      const result = await api<{ id: number; liked: boolean; likes: number }>(`/api/reels/comentarios/${target.id}/like`, { method: 'POST', token });
      setComments(items => updateComment(items, target.id, item => ({ ...item, liked: result.liked, likes: result.likes })));
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo actualizar el me gusta.'); }
  }

  function deleteComment(target: Comment) {
    if (!commentReel) return;
    if (!token) {
      Alert.alert('SONDAR', 'Inicia sesion para eliminar comentarios.');
      return;
    }

    const reelId = commentReel.id;
    const backendId = commentReel.backendId || commentReel.id;
    Alert.alert('Eliminar comentario', 'Esta accion no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/reels/comentarios/${target.id}`, { method: 'DELETE', token });
            setComments(items => {
              const next = removeComment(items, target.id);
              const total = countComments(next);
              setReels(current => current.map(item => item.id === reelId || item.backendId === backendId ? { ...item, comentarios: total } : item));
              return next;
            });
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar el comentario.');
          }
        },
      },
    ]);
  }

  async function submitReport(payload: ReportPayload) {
    if (!reportTarget) return;
    setReportBusy(true);
    try {
      await api(`/api/reels/${reportTarget.backendId || reportTarget.id}/denunciar`, { method: 'POST', token, body: JSON.stringify(payload) });
      setReportTarget(null);
      Alert.alert('Listo', 'Denuncia enviada.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar la denuncia.');
    } finally {
      setReportBusy(false);
    }
  }

  function removeReel(reel: Reel) {
    Alert.alert('Eliminar lanzamiento', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/reels/${reel.backendId || reel.id}`, { method: 'DELETE', token });
            setReels(current => current.filter(item => item.id !== reel.id));
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar el lanzamiento.');
          }
        },
      },
    ]);
  }

  function openOptions(reel: Reel) {
    if (reel.creadorId === user?.id) {
      Alert.alert('Opciones del lanzamiento', undefined, [
        { text: 'Eliminar lanzamiento', style: 'destructive', onPress: () => removeReel(reel) },
        { text: 'Cancelar', style: 'cancel' },
      ]);
      return;
    }
    setReportTarget(reel);
  }

  async function pickCover() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .85, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) {
      const selected = result.assets[0];
      const seed = [...(selected.fileName || selected.uri)].reduce((total, character) => total + character.charCodeAt(0), 0);
      setCover(selected);
      setForm(current => ({ ...current, colorAmbiente: coverColors[seed % coverColors.length] }));
    }
  }
  async function pickAudio() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (!result.canceled) {
      setAudio(result.assets[0]);
      setForm(current => ({ ...current, fragmentStart: 0, fragmentDuration: 30 }));
    }
  }

  function toggleReelGenre(value: string) {
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

  async function publish() {
    if (!form.tema.trim() || !form.album.trim() || !audio || form.generos.length === 0) return setError('Completá título, nombre, género y seleccioná un audio.');
    setBusy(true);
    try {
      const fragmentEnd = form.fragmentStart + form.fragmentDuration;
      const body = new FormData();
      body.append('tema', form.tema.trim()); body.append('album', form.album.trim()); body.append('genero', form.generos.join(' / '));
      body.append('descripcion', form.descripcion.trim()); body.append('duracion', formatTime(form.fragmentDuration));
      body.append('colorAmbiente', form.colorAmbiente); body.append('fragmentStart', String(form.fragmentStart)); body.append('fragmentEnd', String(fragmentEnd));
      body.append('audio', mediaPart(audio, 'audio.mp3')); if (cover) body.append('portada', mediaPart(cover, 'portada.jpg'));
      const created = normalizeReel(await api<Reel>('/api/reels/crear', { method: 'POST', token, body }));
      setReels(items => [created, ...items]); setActive(created.id); setCreating(false); setCover(null); setAudio(null); setForm(emptyReelForm()); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo publicar.'); }
    finally { setBusy(false); }
  }

  const viewability = useCallback(({ viewableItems }: any) => {
    const item = viewableItems[0]?.item as Reel | undefined; if (!item) return; setActive(item.id);
    if (!viewed.current.has(item.id)) { viewed.current.add(item.id); api(`/api/reels/${item.backendId || item.id}/visita`, { method: 'POST', token }).catch(() => null); }
  }, [token]);

  return (
    <Screen>
      <Header title="Descubrir" subtitle="Nuevos sonidos" actions={<><IconButton name="chatbubbles-outline" onPress={() => router.push('/messages')} /><IconButton name="notifications-outline" onPress={() => router.push('/notifications')} /><IconButton name="add" active onPress={() => setCreating(true)} /></>} />
      {loading ? <Loading /> : error && !reels.length ? <View style={{ padding: 16 }}><ErrorNotice message={error} /><Empty title="No pudimos cargar música" /></View> : (
        <FlatList ref={reelsList} data={reels} keyExtractor={item => String(item.id)} style={[styles.reelsList, { height: reelHeight }]} pagingEnabled snapToInterval={reelHeight} decelerationRate="fast" disableIntervalMomentum getItemLayout={(_, index) => ({ length: reelHeight, offset: reelHeight * index, index })} removeClippedSubviews={false} showsVerticalScrollIndicator={false} onViewableItemsChanged={viewability} viewabilityConfig={{ itemVisiblePercentThreshold: 65 }} ListEmptyComponent={<Empty title="Todavía no hay lanzamientos" text="Sé la primera persona en compartir música." />} renderItem={({ item }) => <ReelCard height={reelHeight} reel={item} active={active === item.id} screenFocused={isFocused} mine={item.creadorId === user?.id} onLike={() => interact(item, 'like')} onSave={() => interact(item, 'guardar')} onComments={() => openComments(item)} onShare={() => share(item)} onFollow={() => toggleFollow(item)} onReport={() => openOptions(item)} />} />
      )}

      <Modal visible={Boolean(shareReel)} animationType="fade" transparent onRequestClose={() => setShareReel(null)}>
        <View style={styles.shareBackdrop}>
          <View style={styles.shareModal}>
            <View style={styles.modalTop}><Text style={ui.h2}>Compartir reel</Text><IconButton name="close" onPress={() => setShareReel(null)} /></View>
            {shareReel ? <>
              <View style={styles.shareCreator}>
                <Avatar uri={shareReel.avatar} name={shareReel.artista} size={48} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.shareTitle} numberOfLines={1}>{shareReel.tema}</Text>
                  <Text style={styles.time} numberOfLines={1}>{shareReel.artista}</Text>
                </View>
              </View>
              <View style={styles.shareCount}><Ionicons name="share-social-outline" size={20} color={palette.orange} /><Text style={styles.shareCountText}>{formatCount(shareReel.compartidos)} compartidos</Text></View>
              <Button icon="share-social-outline" onPress={() => performShare(shareReel)} disabled={shareBusy}>{shareBusy ? 'Abriendo...' : 'Compartir'}</Button>
            </> : null}
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(commentReel)} animationType="slide" transparent onRequestClose={() => setCommentReel(null)}>
        <View style={styles.backdrop}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.commentsModal}><View style={styles.modalTop}><Text style={ui.h2}>Comentarios · {countComments(comments)}</Text><IconButton name="close" onPress={() => setCommentReel(null)} /></View>
          <FlatList data={comments} keyExtractor={item => String(item.id)} style={{ flex: 1 }} contentContainerStyle={{ gap: 15, paddingVertical: 12 }} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Empty title="Todavía no hay comentarios" />} renderItem={({ item }) => <CommentRow item={item} currentUserId={user?.id} onLike={toggleCommentLike} onReply={setReplyTo} onDelete={deleteComment} />} />
          {replyTo ? <View style={styles.replyBanner}><Text style={styles.time}>Respondiendo a {replyTo.usuario}</Text><Pressable onPress={() => setReplyTo(null)}><Ionicons name="close-circle" size={20} color={palette.muted} /></Pressable></View> : null}
          <View style={styles.commentComposer}><View style={{ flex: 1 }}><Field placeholder={replyTo ? `Responder a ${replyTo.usuario}…` : 'Sumate a la conversación…'} value={comment} onChangeText={setComment} /></View><IconButton name="send" active onPress={sendComment} /></View>
        </KeyboardAvoidingView></View>
      </Modal>

      <Modal visible={creating} animationType="slide" onRequestClose={() => setCreating(false)}>
        <Screen scroll><Header title="Crear nueva preview" subtitle="PREVIEWS" back onBack={() => setCreating(false)} actions={<IconButton name="close" onPress={() => setCreating(false)} />} /><ErrorNotice message={error} />
          <View style={[styles.previewCreator, { backgroundColor: form.colorAmbiente }]}>
            {cover ? <Image source={{ uri: cover.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={styles.previewPlaceholder}><Ionicons name="person" size={74} color="#FFFFFF55" /></View>}
            <LinearGradient colors={['#00000005', '#00000015', '#000000D9']} style={StyleSheet.absoluteFill} />
            <View style={styles.previewCopy}><Text style={styles.previewAlbum} numberOfLines={2}>{form.album || 'Nombre de la preview'}</Text><Text style={styles.previewHandle}>@{user?.user_metadata?.username || user?.email?.split('@')[0] || 'artista'}</Text></View>
          </View>

          <View style={styles.creatorCard}>
            <Field label="Título de la canción *" value={form.tema} onChangeText={tema => setForm(current => ({ ...current, tema }))} placeholder="Ej: Neón de madrugada" maxLength={50} />
            <Field label="Nombre de la preview *" value={form.album} onChangeText={album => setForm(current => ({ ...current, album }))} placeholder="El texto principal de la portada" maxLength={60} />
            <Field label="Descripción" value={form.descripcion} onChangeText={descripcion => setForm(current => ({ ...current, descripcion }))} placeholder="Contá algo y mencioná personas con @usuario…" multiline maxLength={180} />
          </View>

          <View style={styles.creatorCard}>
            <View style={styles.creatorCardHeader}><Text style={styles.creatorCardTitle}>GÉNEROS MUSICALES</Text><Text style={styles.creatorCounter}>{form.generos.length}/3</Text></View>
            <View style={styles.genreWrap}>{musicGenres.map(item => { const selected = form.generos.includes(item); return <Pressable key={item} style={[styles.genre, selected && styles.genreActive]} onPress={() => toggleReelGenre(item)}><Text style={[styles.genreText, selected && styles.genreTextActive]}>{formatGenre(item)}</Text></Pressable>; })}</View>
          </View>

          <View style={styles.creatorCard}>
            <Text style={styles.creatorCardTitle}>COLOR DEL AMBIENTE</Text>
            <View style={styles.colorField}><View style={[styles.colorSample, { backgroundColor: form.colorAmbiente }]} /><Text style={styles.colorValue}>{form.colorAmbiente.toUpperCase()}</Text></View>
            <Text style={styles.creatorHint}>Detectado automáticamente desde la portada. Podés ajustarlo.</Text>
            <View style={styles.colorChoices}>{coverColors.map(color => <Pressable key={color} accessibilityLabel={`Elegir color ${color}`} onPress={() => setForm(current => ({ ...current, colorAmbiente: color }))} style={[styles.colorChoice, { backgroundColor: color }, form.colorAmbiente === color && styles.colorChoiceActive]} />)}</View>
          </View>

          <View style={styles.fileRow}>
            <View style={styles.fileColumn}><Pressable onPress={pickCover} style={styles.filePicker}><Ionicons name="image-outline" size={21} color="#111" /><View style={{ flex: 1 }}><Text style={styles.filePickerTitle}>Elegir portada</Text><Text style={styles.filePickerName} numberOfLines={1}>{cover?.fileName || 'JPG, PNG o WEBP'}</Text></View></Pressable>{cover ? <Button kind="secondary" onPress={() => setCover(null)}>Quitar portada</Button> : null}</View>
            <View style={styles.fileColumn}><Pressable onPress={pickAudio} style={styles.filePicker}><Ionicons name="musical-note" size={21} color="#111" /><View style={{ flex: 1 }}><Text style={styles.filePickerTitle}>Elegir audio</Text><Text style={styles.filePickerName} numberOfLines={1}>{audio?.name || 'MP3, WAV u OGG'}</Text></View></Pressable>{audio ? <Button kind="secondary" onPress={() => setAudio(null)}>Quitar audio</Button> : null}</View>
          </View>

          {audio ? <AudioFragmentEditor audio={audio} start={form.fragmentStart} duration={form.fragmentDuration} onStart={fragmentStart => setForm(current => ({ ...current, fragmentStart }))} onDuration={fragmentDuration => setForm(current => ({ ...current, fragmentDuration, fragmentStart: Math.min(current.fragmentStart, 90 - fragmentDuration) }))} /> : null}

          <Button onPress={publish} disabled={busy}>{busy ? 'Publicando…' : 'Publicar preview'}</Button>
        </Screen>
      </Modal>
      <ReportModal visible={Boolean(reportTarget)} subject={reportTarget ? `${reportTarget.tema} · ${reportTarget.artista}` : ''} busy={reportBusy} onClose={() => setReportTarget(null)} onSubmit={submitReport} />
    </Screen>
  );
}

const fragmentBars = Array.from({ length: 48 }, (_, index) => 10 + ((index * 19 + index * index * 7) % 36));

/* eslint-disable react-hooks/immutability -- expo-video exposes currentTime as an intentionally writable, imperative seek API. */
function AudioFragmentEditor({ audio, start, duration, onStart, onDuration }: { audio: DocumentPicker.DocumentPickerAsset; start: number; duration: number; onStart: (value: number) => void; onDuration: (value: number) => void }) {
  const player = useVideoPlayer(audio.uri, instance => { instance.loop = false; instance.timeUpdateEventInterval = .2; });
  const { isPlaying: playing } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const [trackWidth, setTrackWidth] = useState(1);
  const total = 90;
  const end = Math.min(total, start + duration);
  const selectedStart = (start / total) * 100;
  const selectedWidth = ((end - start) / total) * 100;

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      if (player.currentTime >= end || player.currentTime < start) {
        player.pause();
        player.currentTime = start;
      }
    }, 150);
    return () => clearInterval(interval);
  }, [end, player, playing, start]);

  function togglePreview() {
    if (playing) {
      player.pause();
      return;
    }
    player.currentTime = start;
    player.play();
  }

  function chooseStart(event: GestureResponderEvent) {
    const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / trackWidth));
    onStart(Math.round(Math.min(total - duration, ratio * total)));
  }

  return (
    <View style={styles.fragmentCard}>
      <View style={styles.creatorCardHeader}><View><Text style={styles.creatorCardTitle}>ELEGÍ EL FRAGMENTO</Text><Text style={styles.creatorHint}>Tocá la onda para elegir el inicio · máximo 30 segundos</Text></View><View style={styles.durationBadge}><Text style={styles.durationBadgeText}>00:{String(duration).padStart(2, '0')}.00</Text></View></View>
      <View style={styles.waveRow}>
        <Pressable onPress={togglePreview} style={styles.fragmentPlay}><Ionicons name={playing ? 'pause' : 'play'} size={25} color="#111" /></Pressable>
        <Text style={styles.waveTime}>{formatTime(start)}</Text>
        <Pressable onLayout={event => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))} onPress={chooseStart} style={styles.waveform}>
          <View style={[styles.fragmentSelection, { left: `${selectedStart}%`, width: `${selectedWidth}%` }]} />
          {fragmentBars.map((height, index) => { const position = (index / (fragmentBars.length - 1)) * 100; const selected = position >= selectedStart && position <= selectedStart + selectedWidth; return <View key={index} style={[styles.waveBar, { height }, selected && styles.waveBarSelected]} />; })}
          <View style={[styles.fragmentHandle, { left: `${selectedStart}%` }]} /><View style={[styles.fragmentHandle, { left: `${selectedStart + selectedWidth}%` }]} />
        </Pressable>
        <Text style={styles.waveTime}>{formatTime(end)}</Text>
      </View>
      <View style={styles.fragmentDurations}>{[15, 20, 30].map(value => <Pressable key={value} onPress={() => onDuration(value)} style={[styles.durationChoice, duration === value && styles.durationChoiceActive]}><Text style={[styles.durationChoiceText, duration === value && styles.durationChoiceTextActive]}>{value} s</Text></Pressable>)}</View>
      <View style={styles.fragmentFooter}><Text style={styles.audioName} numberOfLines={1}>{audio.name}</Text><Text style={styles.creatorHint}>Total estimado: 01:30</Text></View>
    </View>
  );
}
/* eslint-enable react-hooks/immutability */

/* eslint-disable react-hooks/immutability -- expo-video exposes currentTime as an intentionally writable, imperative seek API. */
function ReelCard({ height, reel, active, screenFocused, mine, onLike, onSave, onComments, onShare, onFollow, onReport }: { height: number; reel: Reel; active: boolean; screenFocused: boolean; mine: boolean; onLike: () => void; onSave: () => void; onComments: () => void; onShare: () => void; onFollow: () => void; onReport: () => void }) {
  const fragmentStart = Math.max(0, Number(reel.fragmentStart) || 0);
  const storedFragmentEnd = Number(reel.fragmentEnd);
  const fragmentLength = storedFragmentEnd > fragmentStart ? storedFragmentEnd - fragmentStart : parseDuration(reel.duracion);
  const fragmentEnd = storedFragmentEnd > fragmentStart ? storedFragmentEnd : fragmentStart + fragmentLength;
  const player = useVideoPlayer(reel.audio || null, instance => { instance.loop = fragmentStart === 0 && !storedFragmentEnd; instance.timeUpdateEventInterval = .25; });
  const { isPlaying: playing } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const [progress, setProgress] = useState({ current: 0, duration: fragmentLength });
  const [barWidth, setBarWidth] = useState(1);
  const manuallyPaused = useRef(false);
  const playable = Boolean(reel.audio);
  const duration = progress.duration || fragmentLength;
  const percent = duration > 0 ? Math.min(100, Math.max(0, (progress.current / duration) * 100)) : 0;

  useEffect(() => {
    if (!active || !screenFocused || !playable) {
      player.pause();
      if (!active) manuallyPaused.current = false;
      return;
    }

    if (!manuallyPaused.current) {
      if (player.currentTime < fragmentStart || player.currentTime >= fragmentEnd) player.currentTime = fragmentStart;
      player.play();
    }
  }, [active, fragmentEnd, fragmentStart, player, playable, screenFocused]);

  useEffect(() => {
    if (!active || !screenFocused || !playable) return;
    const interval = setInterval(() => {
      if (player.currentTime >= fragmentEnd) {
        player.currentTime = fragmentStart;
        if (active && screenFocused) player.play();
      }
      const nextCurrent = Number.isFinite(player.currentTime) ? player.currentTime : 0;
      setProgress({ current: Math.max(0, nextCurrent - fragmentStart), duration: fragmentLength });
    }, 250);

    return () => clearInterval(interval);
  }, [active, fragmentEnd, fragmentLength, fragmentStart, player, playable, screenFocused]);

  function togglePlay() {
    if (!playable) return;
    if (playing) {
      manuallyPaused.current = true;
      player.pause();
      return;
    }

    manuallyPaused.current = false;
    player.play();
  }

  function onProgressLayout(event: LayoutChangeEvent) {
    setBarWidth(Math.max(1, event.nativeEvent.layout.width));
  }

  function seek(event: GestureResponderEvent) {
    if (!playable || duration <= 0) return;
    const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / barWidth));
    const nextTime = fragmentStart + (ratio * duration);
    player.currentTime = nextTime;
    setProgress(value => ({ ...value, current: nextTime - fragmentStart }));
    if (active && screenFocused && !playing) {
      manuallyPaused.current = false;
      player.play();
    }
  }
  return (
    <View style={[styles.reel, { height }]}>
      {reel.portada ? <Image source={{ uri: reel.portada }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <LinearGradient colors={[reel.colorAmbiente || '#5A2904', '#17100A', '#090A0D']} style={StyleSheet.absoluteFill} />}
      <LinearGradient colors={['#00000010', '#00000025', '#08090CF5']} locations={[0, .48, 1]} style={StyleSheet.absoluteFill} />
      <Pressable onPress={togglePlay} style={styles.playArea}>{!playing ? <View style={styles.play}><Ionicons name="play" size={33} color="#111" /></View> : null}</Pressable>
      <View style={styles.reelBottom}>
        <View style={styles.artist}><Pressable style={styles.artistIdentity} onPress={() => reel.creadorId && router.push({ pathname: '/profile/[id]', params: { id: reel.creadorId } })}><Avatar uri={reel.avatar} name={reel.artista} size={43} /><View style={{ flex: 1 }}><Text style={styles.artistName}>{reel.artista}</Text><Text style={styles.handle}>{reel.usuario}</Text></View></Pressable>{!mine ? <Pressable onPress={onFollow} style={[styles.follow, reel.siguiendo && styles.following]}><Text style={styles.followText}>{reel.siguiendo ? 'Siguiendo' : 'Seguir'}</Text></Pressable> : null}</View>
        <Text style={styles.song}>{reel.tema}</Text><Text style={styles.album}>{reel.album} · {formatGenre(reel.genero)}</Text>{reel.descripcion ? <Text style={styles.reelDescription} numberOfLines={2}>{reel.descripcion}</Text> : null}
        <View style={styles.progressBox}>
          <Pressable onPress={seek} onLayout={onProgressLayout} style={styles.progressTrack}>
            <View style={styles.progressBase} />
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
            <View style={[styles.progressKnob, { left: `${percent}%` }]} />
          </Pressable>
          <View style={styles.progressTimes}><Text style={styles.progressText}>{formatTime(progress.current)}</Text><Text style={styles.progressText}>{formatTime(duration)}</Text></View>
        </View>
      </View>
      <View style={styles.actions}><ReelAction icon={reel.liked ? 'heart' : 'heart-outline'} active={reel.liked} label={reel.likes} onPress={onLike} /><ReelAction icon="chatbubble-outline" label={Number(reel.comentarios || 0)} onPress={onComments} /><ReelAction icon={reel.guardado ? 'bookmark' : 'bookmark-outline'} active={reel.guardado} label={reel.guardados || 0} onPress={onSave} /><ReelAction icon="share-social-outline" label={reel.compartidos || 0} onPress={onShare} /><ReelAction icon="ellipsis-horizontal" label="" onPress={onReport} /></View>
    </View>
  );
}
/* eslint-enable react-hooks/immutability */

function ReelAction({ icon, label, onPress, active }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: number | string; onPress: () => void; active?: boolean }) {
  return <Pressable onPress={onPress} style={styles.reelAction}><View style={[styles.actionCircle, active && styles.actionActive]}><Ionicons name={icon} size={24} color={active ? palette.orange : palette.text} /></View>{label === '' ? <View style={styles.actionSpacer} /> : <Text style={styles.actionLabel}>{formatCount(label)}</Text>}</Pressable>;
}

function parseDuration(value?: string) {
  const parts = String(value || '').split(':').map(part => Number(part));
  if (parts.length === 2 && parts.every(Number.isFinite)) return (parts[0] * 60) + parts[1];
  if (parts.length === 3 && parts.every(Number.isFinite)) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTime(value?: number) {
  const safe = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = String(safe % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function CommentRow({ item, currentUserId, onLike, onReply, onDelete, nested = false, rootId }: { item: Comment; currentUserId?: string; onLike: (item: Comment) => void; onReply: (target: ReplyTarget) => void; onDelete: (item: Comment) => void; nested?: boolean; rootId?: number }) {
  const parentId = rootId || item.id;
  const canDelete = Boolean(currentUserId && item.userId === currentUserId);
  return <View style={nested && styles.nestedComment}><View style={styles.comment}><Avatar uri={item.avatar} name={item.usuario} size={nested ? 30 : 36} /><View style={{ flex: 1 }}><Text style={styles.username}>{item.usuario}{nested && item.respondeA ? <Text style={styles.replyTarget}> para {item.respondeA}</Text> : null} <Text style={styles.time}>{item.tiempo}</Text></Text><Text style={styles.commentText}>{item.texto}</Text><Pressable onPress={() => onReply({ parentId, usuario: item.usuario })} hitSlop={8}><Text style={styles.replyAction}>Responder</Text></Pressable></View><View style={styles.commentTools}><Pressable onPress={() => onLike(item)} hitSlop={10} style={styles.commentLike}><Ionicons name={item.liked ? 'heart' : 'heart-outline'} size={17} color={item.liked ? palette.orange : palette.muted} /><Text style={styles.time}>{formatCount(item.likes || 0)}</Text></Pressable>{canDelete ? <Pressable onPress={() => onDelete(item)} hitSlop={10} style={styles.commentDelete}><Ionicons name="trash-outline" size={17} color={palette.muted} /></Pressable> : null}</View></View>{item.respuestas?.map(reply => <CommentRow key={reply.id} item={reply} currentUserId={currentUserId} onLike={onLike} onReply={onReply} onDelete={onDelete} nested rootId={parentId} />)}</View>;
}

function updateComment(items: Comment[], id: number, updater: (item: Comment) => Comment): Comment[] { return items.map(item => item.id === id ? updater(item) : { ...item, respuestas: updateComment(item.respuestas || [], id, updater) }); }
function appendReply(items: Comment[], id: number, reply: Comment): Comment[] { return updateComment(items, id, item => ({ ...item, respuestas: [...(item.respuestas || []), reply] })); }

const styles = StyleSheet.create({
  reelsList: { flexGrow: 0, flexShrink: 0, backgroundColor: palette.bg },
  reel: { backgroundColor: palette.surface, overflow: 'hidden' }, playArea: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' }, play: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#FFFFFFDC', alignItems: 'center', justifyContent: 'center' },
  reelBottom: { position: 'absolute', left: 16, right: 78, bottom: 22, gap: 4 }, artist: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 5 }, artistIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 }, artistName: { color: '#fff', fontSize: 15, fontWeight: '800' }, handle: { color: '#D0D1D5', fontSize: 12 }, follow: { borderRadius: 10, borderWidth: 1, borderColor: palette.amber, paddingVertical: 6, paddingHorizontal: 11 }, following: { backgroundColor: '#FFAE0030' }, followText: { color: palette.text, fontSize: 12, fontWeight: '700' }, song: { color: '#fff', fontSize: 21, fontWeight: '900' }, album: { color: palette.amber, fontSize: 13, fontWeight: '800' }, reelDescription: { color: '#E4E4E6', fontSize: 13, lineHeight: 17, marginTop: 2 },
  progressBox: { gap: 5, paddingTop: 7 },
  progressTrack: { height: 20, justifyContent: 'center' },
  progressBase: { ...StyleSheet.absoluteFill, top: 8, bottom: 8, borderRadius: 2, backgroundColor: '#FFFFFF26' },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: palette.orange },
  progressKnob: { position: 'absolute', top: 4, width: 12, height: 12, marginLeft: -6, borderRadius: 6, backgroundColor: palette.text, borderWidth: 2, borderColor: palette.orange },
  progressTimes: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { color: '#D0D1D5', fontSize: 10, fontWeight: '700' },
  actions: { position: 'absolute', right: 10, bottom: 18, gap: 8 }, reelAction: { width: 52, alignItems: 'center', gap: 3, minHeight: 58 }, actionCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101010D9', borderWidth: 1, borderColor: '#FFFFFF22' }, actionActive: { borderColor: palette.amber }, actionLabel: { minWidth: 26, minHeight: 17, paddingHorizontal: 5, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000000A8', color: '#fff', textAlign: 'center', fontSize: 11, lineHeight: 15, fontWeight: '900' }, actionSpacer: { height: 17 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A' }, commentsModal: { height: '76%', backgroundColor: palette.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16, paddingBottom: 24 }, modalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, comment: { flexDirection: 'row', gap: 10 }, nestedComment: { marginLeft: 35, marginTop: 12, gap: 12 }, username: { color: palette.text, fontWeight: '700', fontSize: 13 }, replyTarget: { color: palette.amber, fontWeight: '800' }, time: { color: palette.muted, fontSize: 11, fontWeight: '500' }, commentText: { color: palette.text, marginTop: 4, lineHeight: 19 }, commentTools: { alignItems: 'center', gap: 6 }, commentLike: { alignItems: 'center', gap: 2, padding: 4 }, commentDelete: { padding: 4 }, replyAction: { color: palette.muted, fontSize: 11, fontWeight: '700', marginTop: 6 }, replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 7, backgroundColor: palette.surface }, commentComposer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.border },
  shareBackdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#000B' },
  shareModal: { gap: 16, padding: 16, borderRadius: 12, backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.border },
  shareCreator: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shareTitle: { color: palette.text, fontSize: 17, fontWeight: '900' },
  shareCount: { minHeight: 46, borderRadius: 8, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareCountText: { color: palette.text, fontSize: 15, fontWeight: '800' },
  coverPicker: { width: 210, height: 210, alignSelf: 'center', borderRadius: 8, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 8 }, label: { color: palette.muted, fontSize: 12, fontWeight: '700' }, genreWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, genre: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 8, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, genreActive: { backgroundColor: palette.orange, borderColor: palette.orange }, genreText: { color: palette.muted, textTransform: 'capitalize', fontWeight: '600' },
  previewCreator: { width: '100%', aspectRatio: 1, maxHeight: 390, alignSelf: 'center', overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#70410D' }, previewPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' }, previewCopy: { position: 'absolute', left: 20, right: 20, bottom: 21, gap: 5 }, previewAlbum: { color: '#fff', fontSize: 34, lineHeight: 38, fontWeight: '900' }, previewHandle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  creatorCard: { gap: 12, padding: 14, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, creatorCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, creatorCardTitle: { color: palette.text, fontSize: 12, fontWeight: '900' }, creatorCounter: { color: palette.amber, fontWeight: '900' }, creatorHint: { color: palette.muted, fontSize: 11, lineHeight: 15 }, genreTextActive: { color: '#111' },
  colorField: { minHeight: 52, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 9, backgroundColor: palette.surface2, borderWidth: 1, borderColor: palette.border }, colorSample: { width: 56, height: 32, borderRadius: 3 }, colorValue: { color: palette.text, fontSize: 15, fontWeight: '900' }, colorChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, colorChoice: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#FFFFFF33' }, colorChoiceActive: { borderColor: palette.amber, borderWidth: 4 },
  fileRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, fileColumn: { flex: 1, gap: 8 }, filePicker: { minHeight: 78, padding: 11, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.orange, borderWidth: 1, borderColor: palette.amber }, filePickerTitle: { color: '#111', fontSize: 13, fontWeight: '900' }, filePickerName: { color: '#231309', fontSize: 10, fontWeight: '700', marginTop: 4 },
  fragmentCard: { gap: 13, padding: 14, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: '#6D4109' }, durationBadge: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 8, backgroundColor: palette.amber }, durationBadgeText: { color: '#111', fontSize: 12, fontWeight: '900' }, waveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, fragmentPlay: { width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.amber }, waveTime: { width: 35, color: palette.muted, fontSize: 9, fontWeight: '800', textAlign: 'center' }, waveform: { flex: 1, height: 64, overflow: 'hidden', paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, backgroundColor: '#080808' }, waveBar: { width: 2, borderRadius: 2, backgroundColor: '#5D4300' }, waveBarSelected: { backgroundColor: palette.amber }, fragmentSelection: { position: 'absolute', top: 4, bottom: 4, borderRadius: 6, borderWidth: 1, borderColor: palette.amber, backgroundColor: '#FFAE0014' }, fragmentHandle: { position: 'absolute', top: 1, bottom: 1, width: 6, marginLeft: -3, borderRadius: 4, backgroundColor: palette.amber, borderWidth: 1, borderColor: '#111' }, fragmentDurations: { flexDirection: 'row', gap: 8 }, durationChoice: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface2 }, durationChoiceActive: { backgroundColor: palette.amber, borderColor: palette.amber }, durationChoiceText: { color: palette.muted, fontWeight: '800' }, durationChoiceTextActive: { color: '#111' }, fragmentFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, audioName: { flex: 1, color: palette.text, fontSize: 11, fontWeight: '700' },
});

