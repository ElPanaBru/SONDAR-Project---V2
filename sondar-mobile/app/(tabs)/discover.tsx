import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Share, StatusBar as RNStatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Empty, ErrorNotice, Field, Header, IconButton, Loading, Screen, ui } from '@/components/sondar-ui';
import { formatCount, formatGenre, musicGenres, palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';
import { api, mediaPart } from '@/lib/api';
import { normalizeComment, normalizeReel } from '@/lib/normalizers';

type Reel = { id: number; backendId?: number; artista: string; usuario: string; tema: string; album: string; genero: string; descripcion?: string; portada?: string; audio?: string; avatar?: string; likes: number; comentarios: number | string; compartidos: number; guardados: number; visitas: number; liked?: boolean; guardado?: boolean; siguiendo?: boolean; creadorId?: string; duracion?: string };
type Comment = { id: number; userId?: string; parentId?: number | null; usuario: string; avatar?: string; texto: string; respondeA?: string; tiempo?: string; likes?: number; liked?: boolean; respuestas?: Comment[] };
type ReplyTarget = { parentId: number; usuario: string };
const countComments = (items: Comment[]): number => items.reduce((total, item) => total + 1 + countComments(item.respuestas || []), 0);
const removeComment = (items: Comment[], id: number): Comment[] => items
  .filter(item => item.id !== id)
  .map(item => ({ ...item, respuestas: removeComment(item.respuestas || [], id) }));

export default function DiscoverScreen() {
  const { token, user } = useAuth();
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
  const [form, setForm] = useState({ tema: '', album: '', genero: 'rock', descripcion: '', duracion: '0:30' });
  const [cover, setCover] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [audio, setAudio] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
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

  function report(reel: Reel) {
    Alert.alert('Denunciar lanzamiento', 'El equipo de moderación revisará el contenido.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Denunciar', style: 'destructive', onPress: () => api(`/api/reels/${reel.backendId || reel.id}/denunciar`, { method: 'POST', token, body: JSON.stringify({ reason: 'contenido_inapropiado', detail: 'Denuncia desde móvil' }) }).then(() => Alert.alert('Listo', 'Denuncia enviada.')).catch(e => Alert.alert('Error', e.message)) }]);
  }

  async function pickCover() { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .85, allowsEditing: true, aspect: [1, 1] }); if (!result.canceled) setCover(result.assets[0]); }
  async function pickAudio() { const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true }); if (!result.canceled) setAudio(result.assets[0]); }

  async function publish() {
    if (!form.tema.trim() || !form.album.trim() || !audio) return setError('Completá título, nombre y seleccioná un audio.');
    setBusy(true);
    try {
      const body = new FormData(); Object.entries(form).forEach(([key, value]) => body.append(key, value));
      body.append('audio', mediaPart(audio, 'audio.mp3')); if (cover) body.append('portada', mediaPart(cover, 'portada.jpg'));
      const created = normalizeReel(await api<Reel>('/api/reels/crear', { method: 'POST', token, body }));
      setReels(items => [created, ...items]); setActive(created.id); setCreating(false); setCover(null); setAudio(null); setForm({ tema: '', album: '', genero: 'rock', descripcion: '', duracion: '0:30' }); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo publicar.'); }
    finally { setBusy(false); }
  }

  const viewability = useCallback(({ viewableItems }: any) => {
    const item = viewableItems[0]?.item as Reel | undefined; if (!item) return; setActive(item.id);
    if (!viewed.current.has(item.id)) { viewed.current.add(item.id); api(`/api/reels/${item.backendId || item.id}/visita`, { method: 'POST', token }).catch(() => null); }
  }, [token]);

  return (
    <Screen>
      <Header title="Descubrir" subtitle="Nuevos sonidos" actions={<><IconButton name="notifications-outline" onPress={() => router.push('/notifications')} /><IconButton name="add" active onPress={() => setCreating(true)} /></>} />
      {loading ? <Loading /> : error && !reels.length ? <View style={{ padding: 16 }}><ErrorNotice message={error} /><Empty title="No pudimos cargar música" /></View> : (
        <FlatList data={reels} keyExtractor={item => String(item.id)} style={[styles.reelsList, { height: reelHeight }]} pagingEnabled snapToInterval={reelHeight} decelerationRate="fast" disableIntervalMomentum getItemLayout={(_, index) => ({ length: reelHeight, offset: reelHeight * index, index })} removeClippedSubviews={false} showsVerticalScrollIndicator={false} onViewableItemsChanged={viewability} viewabilityConfig={{ itemVisiblePercentThreshold: 65 }} ListEmptyComponent={<Empty title="Todavía no hay lanzamientos" text="Sé la primera persona en compartir música." />} renderItem={({ item }) => <ReelCard height={reelHeight} reel={item} active={active === item.id} screenFocused={isFocused} mine={item.creadorId === user?.id} onLike={() => interact(item, 'like')} onSave={() => interact(item, 'guardar')} onComments={() => openComments(item)} onShare={() => share(item)} onFollow={() => toggleFollow(item)} onReport={() => report(item)} />} />
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
        <Screen scroll><Header title="Nuevo lanzamiento" back onBack={() => setCreating(false)} actions={<IconButton name="close" onPress={() => setCreating(false)} />} /><ErrorNotice message={error} />
          <Pressable onPress={pickCover} style={styles.coverPicker}>{cover ? <Image source={{ uri: cover.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <><Ionicons name="disc-outline" size={48} color={palette.orange} /><Text style={ui.muted}>Elegir portada</Text></>}</Pressable>
          <Field label="Título del tema *" value={form.tema} onChangeText={tema => setForm(f => ({ ...f, tema }))} placeholder="Nombre de la canción" />
          <Field label="Álbum / lanzamiento *" value={form.album} onChangeText={album => setForm(f => ({ ...f, album }))} placeholder="Single, EP o álbum" />
          <Text style={styles.label}>Género</Text><View style={styles.genreWrap}>{musicGenres.map(item => <Pressable key={item} style={[styles.genre, form.genero === item && styles.genreActive]} onPress={() => setForm(f => ({ ...f, genero: item }))}><Text style={[styles.genreText, form.genero === item && { color: '#111' }]}>{formatGenre(item)}</Text></Pressable>)}</View>
          <Field label="Descripción" value={form.descripcion} onChangeText={descripcion => setForm(f => ({ ...f, descripcion }))} placeholder="La historia detrás del tema…" multiline />
          <Button kind="secondary" icon="musical-note" onPress={pickAudio}>{audio ? audio.name : 'Seleccionar audio *'}</Button>
          <Button onPress={publish} disabled={busy}>{busy ? 'Subiendo…' : 'Publicar lanzamiento'}</Button>
        </Screen>
      </Modal>
    </Screen>
  );
}

function ReelCard({ height, reel, active, screenFocused, mine, onLike, onSave, onComments, onShare, onFollow, onReport }: { height: number; reel: Reel; active: boolean; screenFocused: boolean; mine: boolean; onLike: () => void; onSave: () => void; onComments: () => void; onShare: () => void; onFollow: () => void; onReport: () => void }) {
  const player = useVideoPlayer(reel.audio || null, instance => { instance.loop = true; instance.timeUpdateEventInterval = .25; });
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, duration: parseDuration(reel.duracion) });
  const [barWidth, setBarWidth] = useState(1);
  const manuallyPaused = useRef(false);
  const playable = Boolean(reel.audio);
  const duration = progress.duration || parseDuration(reel.duracion);
  const percent = duration > 0 ? Math.min(100, Math.max(0, (progress.current / duration) * 100)) : 0;

  useEffect(() => {
    if (!active || !screenFocused || !playable) {
      player.pause();
      setPlaying(false);
      if (!active) manuallyPaused.current = false;
      return;
    }

    if (!manuallyPaused.current) {
      player.play();
      setPlaying(true);
    }
  }, [active, player, playable, screenFocused]);

  useEffect(() => {
    if (!active || !screenFocused || !playable) return;
    const interval = setInterval(() => {
      const nextDuration = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : parseDuration(reel.duracion);
      const nextCurrent = Number.isFinite(player.currentTime) ? player.currentTime : 0;
      setProgress({ current: nextCurrent, duration: nextDuration });
    }, 250);

    return () => clearInterval(interval);
  }, [active, player, playable, reel.duracion, screenFocused]);

  function togglePlay() {
    if (!playable) return;
    if (playing) {
      manuallyPaused.current = true;
      player.pause();
      setPlaying(false);
      return;
    }

    manuallyPaused.current = false;
    player.play();
    setPlaying(true);
  }

  function onProgressLayout(event: LayoutChangeEvent) {
    setBarWidth(Math.max(1, event.nativeEvent.layout.width));
  }

  function seek(event: GestureResponderEvent) {
    if (!playable || duration <= 0) return;
    const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / barWidth));
    const nextTime = ratio * duration;
    player.currentTime = nextTime;
    setProgress(value => ({ ...value, current: nextTime }));
    if (active && screenFocused && !playing) {
      manuallyPaused.current = false;
      player.play();
      setPlaying(true);
    }
  }
  return (
    <View style={[styles.reel, { height }]}>
      {reel.portada ? <Image source={{ uri: reel.portada }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <LinearGradient colors={['#5A2904', '#17100A', '#090A0D']} style={StyleSheet.absoluteFill} />}
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
  reel: { backgroundColor: palette.surface, overflow: 'hidden' }, playArea: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }, play: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#FFFFFFDC', alignItems: 'center', justifyContent: 'center' },
  reelBottom: { position: 'absolute', left: 16, right: 78, bottom: 22, gap: 4 }, artist: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 5 }, artistIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 }, artistName: { color: '#fff', fontSize: 15, fontWeight: '800' }, handle: { color: '#D0D1D5', fontSize: 12 }, follow: { borderRadius: 10, borderWidth: 1, borderColor: palette.amber, paddingVertical: 6, paddingHorizontal: 11 }, following: { backgroundColor: '#FFAE0030' }, followText: { color: palette.text, fontSize: 12, fontWeight: '700' }, song: { color: '#fff', fontSize: 21, fontWeight: '900' }, album: { color: palette.amber, fontSize: 13, fontWeight: '800' }, reelDescription: { color: '#E4E4E6', fontSize: 13, lineHeight: 17, marginTop: 2 },
  progressBox: { gap: 5, paddingTop: 7 },
  progressTrack: { height: 20, justifyContent: 'center' },
  progressBase: { ...StyleSheet.absoluteFillObject, top: 8, bottom: 8, borderRadius: 2, backgroundColor: '#FFFFFF26' },
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
});

