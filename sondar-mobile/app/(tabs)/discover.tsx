import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
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

export default function DiscoverScreen() {
  const { token, user } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState<number | null>(null);
  const [commentReel, setCommentReel] = useState<Reel | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ tema: '', album: '', genero: 'rock', descripcion: '', duracion: '0:30' });
  const [cover, setCover] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [audio, setAudio] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const viewed = useRef(new Set<number>());
  const insets = useSafeAreaInsets();
  const reelHeight = Dimensions.get('window').height - insets.top - 66 - 72;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await api<Reel[]>('/api/reels', { token })).map(normalizeReel);
      const withCommentCounts = await Promise.all(data.map(async reel => {
        try { return { ...reel, comentarios: countComments((await api<Comment[]>(`/api/reels/${reel.backendId || reel.id}/comentarios`, { token })).map(normalizeComment)) }; }
        catch { return reel; }
      }));
      setReels(withCommentCounts); setActive(withCommentCounts[0]?.id || null); setError('');
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

  async function share(reel: Reel) {
    try { const result = await api<{ compartidos: number }>(`/api/reels/${reel.backendId || reel.id}/compartir`, { method: 'POST', token }); setReels(items => items.map(item => item.id === reel.id ? { ...item, compartidos: result.compartidos } : item)); } catch {}
    await Share.share({ message: `Escucha "${reel.tema}" de ${reel.artista} en SONDAR.` });
  }

  async function toggleCommentLike(target: Comment) {
    try {
      const result = await api<{ id: number; liked: boolean; likes: number }>(`/api/reels/comentarios/${target.id}/like`, { method: 'POST', token });
      setComments(items => updateComment(items, target.id, item => ({ ...item, liked: result.liked, likes: result.likes })));
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo actualizar el me gusta.'); }
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
        <FlatList data={reels} keyExtractor={item => String(item.id)} pagingEnabled snapToInterval={reelHeight} decelerationRate="fast" showsVerticalScrollIndicator={false} onViewableItemsChanged={viewability} viewabilityConfig={{ itemVisiblePercentThreshold: 65 }} ListEmptyComponent={<Empty title="Todavía no hay lanzamientos" text="Sé la primera persona en compartir música." />} renderItem={({ item }) => <ReelCard height={reelHeight} reel={item} active={active === item.id} mine={item.creadorId === user?.id} onLike={() => interact(item, 'like')} onSave={() => interact(item, 'guardar')} onComments={() => openComments(item)} onShare={() => share(item)} onFollow={() => toggleFollow(item)} onReport={() => report(item)} />} />
      )}

      <Modal visible={Boolean(commentReel)} animationType="slide" transparent onRequestClose={() => setCommentReel(null)}>
        <View style={styles.backdrop}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.commentsModal}><View style={styles.modalTop}><Text style={ui.h2}>Comentarios · {countComments(comments)}</Text><IconButton name="close" onPress={() => setCommentReel(null)} /></View>
          <FlatList data={comments} keyExtractor={item => String(item.id)} style={{ flex: 1 }} contentContainerStyle={{ gap: 15, paddingVertical: 12 }} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Empty title="Todavía no hay comentarios" />} renderItem={({ item }) => <CommentRow item={item} onLike={toggleCommentLike} onReply={setReplyTo} />} />
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

function ReelCard({ height, reel, active, mine, onLike, onSave, onComments, onShare, onFollow, onReport }: { height: number; reel: Reel; active: boolean; mine: boolean; onLike: () => void; onSave: () => void; onComments: () => void; onShare: () => void; onFollow: () => void; onReport: () => void }) {
  const player = useVideoPlayer(reel.audio || null, instance => { instance.loop = true; });
  const [playing, setPlaying] = useState(false);
  useEffect(() => { if (!active) { player.pause(); const task = setTimeout(() => setPlaying(false), 0); return () => clearTimeout(task); } }, [active, player]);
  function play() { if (!reel.audio) return; if (playing) player.pause(); else player.play(); setPlaying(!playing); }
  return (
    <View style={[styles.reel, { height }]}>
      {reel.portada ? <Image source={{ uri: reel.portada }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <LinearGradient colors={['#5A2904', '#17100A', '#090A0D']} style={StyleSheet.absoluteFill} />}
      <LinearGradient colors={['#00000010', '#00000025', '#08090CF5']} locations={[0, .48, 1]} style={StyleSheet.absoluteFill} />
      <Pressable onPress={play} style={styles.playArea}>{!playing ? <View style={styles.play}><Ionicons name="play" size={33} color="#111" /></View> : null}</Pressable>
      <View style={styles.reelBottom}>
        <Pressable style={styles.artist} onPress={() => reel.creadorId && router.push({ pathname: '/profile/[id]', params: { id: reel.creadorId } })}><Avatar uri={reel.avatar} name={reel.artista} size={43} /><View style={{ flex: 1 }}><Text style={styles.artistName}>{reel.artista}</Text><Text style={styles.handle}>{reel.usuario}</Text></View>{!mine ? <Pressable onPress={onFollow} style={[styles.follow, reel.siguiendo && styles.following]}><Text style={styles.followText}>{reel.siguiendo ? 'Siguiendo' : 'Seguir'}</Text></Pressable> : null}</Pressable>
        <Text style={styles.song}>{reel.tema}</Text><Text style={styles.album}>{reel.album} · {formatGenre(reel.genero)}</Text>{reel.descripcion ? <Text style={styles.reelDescription} numberOfLines={2}>{reel.descripcion}</Text> : null}
      </View>
      <View style={styles.actions}><ReelAction icon={reel.liked ? 'heart' : 'heart-outline'} active={reel.liked} label={reel.likes} onPress={onLike} /><ReelAction icon="chatbubble-outline" label={Number(reel.comentarios || 0)} onPress={onComments} /><ReelAction icon={reel.guardado ? 'bookmark' : 'bookmark-outline'} active={reel.guardado} label={reel.guardados || 0} onPress={onSave} /><ReelAction icon="share-social-outline" label={reel.compartidos || 0} onPress={onShare} /><ReelAction icon="ellipsis-horizontal" label="" onPress={onReport} /></View>
    </View>
  );
}

function ReelAction({ icon, label, onPress, active }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: number | string; onPress: () => void; active?: boolean }) {
  return <Pressable onPress={onPress} style={styles.reelAction}><View style={[styles.actionCircle, active && styles.actionActive]}><Ionicons name={icon} size={24} color={active ? palette.orange : palette.text} /></View><Text style={styles.actionLabel}>{label === '' ? '' : formatCount(label)}</Text></Pressable>;
}

function CommentRow({ item, onLike, onReply, nested = false, rootId }: { item: Comment; onLike: (item: Comment) => void; onReply: (target: ReplyTarget) => void; nested?: boolean; rootId?: number }) {
  const parentId = rootId || item.id;
  return <View style={nested && styles.nestedComment}><View style={styles.comment}><Avatar uri={item.avatar} name={item.usuario} size={nested ? 30 : 36} /><View style={{ flex: 1 }}><Text style={styles.username}>{item.usuario}{nested && item.respondeA ? <Text style={styles.replyTarget}> para {item.respondeA}</Text> : null} <Text style={styles.time}>{item.tiempo}</Text></Text><Text style={styles.commentText}>{item.texto}</Text><Pressable onPress={() => onReply({ parentId, usuario: item.usuario })} hitSlop={8}><Text style={styles.replyAction}>Responder</Text></Pressable></View><Pressable onPress={() => onLike(item)} hitSlop={10} style={styles.commentLike}><Ionicons name={item.liked ? 'heart' : 'heart-outline'} size={17} color={item.liked ? palette.orange : palette.muted} /><Text style={styles.time}>{formatCount(item.likes || 0)}</Text></Pressable></View>{item.respuestas?.map(reply => <CommentRow key={reply.id} item={reply} onLike={onLike} onReply={onReply} nested rootId={parentId} />)}</View>;
}

function updateComment(items: Comment[], id: number, updater: (item: Comment) => Comment): Comment[] { return items.map(item => item.id === id ? updater(item) : { ...item, respuestas: updateComment(item.respuestas || [], id, updater) }); }
function appendReply(items: Comment[], id: number, reply: Comment): Comment[] { return updateComment(items, id, item => ({ ...item, respuestas: [...(item.respuestas || []), reply] })); }

const styles = StyleSheet.create({
  reel: { backgroundColor: palette.surface, overflow: 'hidden' }, playArea: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }, play: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#FFFFFFDC', alignItems: 'center', justifyContent: 'center' },
  reelBottom: { position: 'absolute', left: 16, right: 76, bottom: 18, gap: 4 }, artist: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 5 }, artistName: { color: '#fff', fontSize: 15, fontWeight: '800' }, handle: { color: '#D0D1D5', fontSize: 12 }, follow: { borderRadius: 10, borderWidth: 1, borderColor: palette.amber, paddingVertical: 6, paddingHorizontal: 11 }, following: { backgroundColor: '#FFAE0030' }, followText: { color: palette.text, fontSize: 12, fontWeight: '700' }, song: { color: '#fff', fontSize: 21, fontWeight: '900' }, album: { color: palette.amber, fontSize: 13, fontWeight: '800' }, reelDescription: { color: '#E4E4E6', fontSize: 13, lineHeight: 17, marginTop: 2 },
  actions: { position: 'absolute', right: 10, bottom: 14, gap: 9 }, reelAction: { alignItems: 'center', gap: 2 }, actionCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101010D9', borderWidth: 1, borderColor: '#FFFFFF22' }, actionActive: { borderColor: palette.amber }, actionLabel: { color: '#fff', fontSize: 10, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A' }, commentsModal: { height: '76%', backgroundColor: palette.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16, paddingBottom: 24 }, modalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, comment: { flexDirection: 'row', gap: 10 }, nestedComment: { marginLeft: 35, marginTop: 12, gap: 12 }, username: { color: palette.text, fontWeight: '700', fontSize: 13 }, replyTarget: { color: palette.amber, fontWeight: '800' }, time: { color: palette.muted, fontSize: 11, fontWeight: '500' }, commentText: { color: palette.text, marginTop: 4, lineHeight: 19 }, commentLike: { alignItems: 'center', gap: 2, padding: 4 }, replyAction: { color: palette.muted, fontSize: 11, fontWeight: '700', marginTop: 6 }, replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 7, backgroundColor: palette.surface }, commentComposer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.border },
  coverPicker: { width: 210, height: 210, alignSelf: 'center', borderRadius: 8, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 8 }, label: { color: palette.muted, fontSize: 12, fontWeight: '700' }, genreWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, genre: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 8, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, genreActive: { backgroundColor: palette.orange, borderColor: palette.orange }, genreText: { color: palette.muted, textTransform: 'capitalize', fontWeight: '600' },
});

