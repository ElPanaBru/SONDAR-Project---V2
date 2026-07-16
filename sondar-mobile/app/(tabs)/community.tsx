import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Empty, ErrorNotice, Field, Header, IconButton, Loading, Screen, ui } from '@/components/sondar-ui';
import { palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';
import { api } from '@/lib/api';
import { normalizeComment, normalizeCommunity, normalizeCommunityPost } from '@/lib/normalizers';

type Community = { id: string; nombre: string; titulo?: string; genero: string; descripcion?: string; miembros: number; publicaciones: number; portada?: string };
type Comment = { id: number; usuario: string; autor?: string; texto: string; tiempo?: string; likes?: number; respuestas?: Comment[] };
type Post = { id: number; comunidadId: string; op: string; usuario: string; tipo: string; titulo: string; texto: string; etiqueta?: string; likes: number; liked?: boolean; guardado?: boolean; comentarios: Comment[]; comentariosTotal: number; tiempo?: string };

export default function CommunityScreen() {
  const { token } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [active, setActive] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState('destacado');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ titulo: '', texto: '', tipo: 'reciente', etiqueta: '' });
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    api<Community[]>('/api/comunidades', { token }).then(data => {
      const normalized = data.map(normalizeCommunity);
      setCommunities(normalized);
      setActive(current => normalized.find(item => item.id === current?.id) || normalized[0] || null);
      setError('');
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [token]);

  const loadPosts = useCallback(async () => {
    if (!active) return; setLoading(true);
    try {
      const data = await api<Post[]>(`/api/comunidades/${active.id}/publicaciones?filtro=${filter}`, { token });
      setPosts(data.map(normalizeCommunityPost));
      setError('');
    }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar las publicaciones.'); }
    finally { setLoading(false); }
  }, [active, filter, token]);
  useEffect(() => { const task = setTimeout(() => void loadPosts(), 0); return () => clearTimeout(task); }, [loadPosts]);

  async function interact(post: Post, kind: 'like' | 'guardar') {
    try { const result = await api<any>(`/api/comunidades/publicaciones/${post.id}/${kind}`, { method: 'POST', token }); setPosts(items => items.map(item => item.id === post.id ? { ...item, ...result } : item)); setOpenPost(item => item?.id === post.id ? { ...item, ...result } : item); }
    catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo completar la acción.'); }
  }

  async function publish() {
    if (!active || !form.titulo.trim() || !form.texto.trim()) return setError('Completá título y texto.');
    try { const created = await api<Post>(`/api/comunidades/${active.id}/publicaciones`, { method: 'POST', token, body: JSON.stringify({ ...form, etiqueta: form.etiqueta || active.genero }) }); setPosts(items => [normalizeCommunityPost(created), ...items]); setCreating(false); setForm({ titulo: '', texto: '', tipo: 'reciente', etiqueta: '' }); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo publicar.'); }
  }

  async function sendComment() {
    if (!openPost || !comment.trim()) return;
    try {
      const created = normalizeComment(await api<Comment>(`/api/comunidades/publicaciones/${openPost.id}/comentarios`, { method: 'POST', token, body: JSON.stringify({ texto: comment.trim() }) }));
      const update = (post: Post) => ({ ...post, comentarios: [...(post.comentarios || []), created], comentariosTotal: Number(post.comentariosTotal || 0) + 1 });
      setPosts(items => items.map(item => item.id === openPost.id ? update(item) : item)); setOpenPost(current => current ? update(current) : current); setComment('');
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo responder.'); }
  }

  return (
    <Screen>
      <Header title="Comunidad" subtitle="Encontrá tu escena" actions={<><IconButton name="notifications-outline" onPress={() => router.push('/notifications')} /><IconButton name="add" active onPress={() => setCreating(true)} /></>} />
      {loading && !communities.length ? <Loading /> : <>
        <FlatList horizontal data={communities} keyExtractor={item => item.id} style={styles.communitiesList} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communities} renderItem={({ item }) => <Pressable onPress={() => setActive(item)} style={[styles.community, active?.id === item.id && styles.communityActive]}>{item.portada ? <Image source={{ uri: item.portada }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}<View style={styles.communityTint} /><Text style={styles.communityTitle}>{item.titulo || item.nombre}</Text><Text style={styles.communityMeta}>{item.miembros} miembros · {item.genero}</Text></Pressable>} />
        {active ? <View style={styles.activeIntro}><View style={{ flex: 1 }}><Text style={ui.h2}>{active.titulo || active.nombre}</Text><Text style={ui.muted} numberOfLines={2}>{active.descripcion}</Text></View><Ionicons name="people-circle" size={42} color={palette.orange} /></View> : null}
        <View style={styles.filters}>{[['destacado', 'Destacado'], ['reciente', 'Recientes'], ['popular', 'Populares'], ['preguntas', 'Preguntas']].map(([id, label]) => <Pressable key={id} onPress={() => setFilter(id)} style={[styles.filter, filter === id && styles.filterActive]}><Text style={[styles.filterText, filter === id && { color: '#111' }]}>{label}</Text></Pressable>)}</View>
        <ErrorNotice message={error} />
        {loading ? <Loading /> : <FlatList data={posts} keyExtractor={item => String(item.id)} contentContainerStyle={styles.posts} refreshing={loading} onRefresh={loadPosts} ListEmptyComponent={<Empty icon="people-outline" title="No hay publicaciones todavía" text="Abrí una conversación en esta comunidad." />} renderItem={({ item }) => <PostCard post={item} onOpen={() => setOpenPost(item)} onLike={() => interact(item, 'like')} onSave={() => interact(item, 'guardar')} />} />}
      </>}

      <Modal visible={creating} animationType="slide" onRequestClose={() => setCreating(false)}><Screen scroll><Header title="Nueva publicación" back onBack={() => setCreating(false)} actions={<IconButton name="close" onPress={() => setCreating(false)} />} /><ErrorNotice message={error} /><Text style={ui.muted}>Publicando en {active?.titulo || active?.nombre}</Text><Field label="Título" value={form.titulo} onChangeText={titulo => setForm(f => ({ ...f, titulo }))} placeholder="Abrí una conversación" maxLength={140} /><Field label="Texto" value={form.texto} onChangeText={texto => setForm(f => ({ ...f, texto }))} placeholder="¿Qué querés compartir?" multiline maxLength={3000} /><Field label="Etiqueta" value={form.etiqueta} onChangeText={etiqueta => setForm(f => ({ ...f, etiqueta }))} placeholder={active?.genero || 'música'} /><Button onPress={publish}>Publicar</Button></Screen></Modal>

      <Modal visible={Boolean(openPost)} animationType="slide" transparent onRequestClose={() => setOpenPost(null)}><View style={styles.backdrop}><View style={styles.thread}><View style={styles.threadTop}><Text style={ui.h2}>Conversación</Text><IconButton name="close" onPress={() => setOpenPost(null)} /></View>{openPost ? <><Text style={styles.postTitle}>{openPost.titulo}</Text><Text style={styles.postText}>{openPost.texto}</Text><View style={styles.postActions}><Button kind="ghost" icon={openPost.liked ? 'heart' : 'heart-outline'} onPress={() => interact(openPost, 'like')}>{openPost.likes}</Button><Button kind="ghost" icon={openPost.guardado ? 'bookmark' : 'bookmark-outline'} onPress={() => interact(openPost, 'guardar')}>Guardar</Button></View><FlatList data={openPost.comentarios || []} keyExtractor={item => String(item.id)} style={{ flex: 1 }} contentContainerStyle={{ gap: 13, paddingVertical: 12 }} ListEmptyComponent={<Empty title="Sin respuestas todavía" />} renderItem={({ item }) => <View style={styles.comment}><View style={styles.commentLine} /><View style={{ flex: 1 }}><Text style={styles.author}>{item.usuario || item.autor} <Text style={ui.muted}>{item.tiempo}</Text></Text><Text style={styles.commentText}>{item.texto}</Text></View></View>} /><View style={styles.composer}><View style={{ flex: 1 }}><Field value={comment} onChangeText={setComment} placeholder="Escribí una respuesta…" /></View><IconButton name="send" active onPress={sendComment} /></View></> : null}</View></View></Modal>
    </Screen>
  );
}

function PostCard({ post, onOpen, onLike, onSave }: { post: Post; onOpen: () => void; onLike: () => void; onSave: () => void }) { return <Pressable onPress={onOpen} style={styles.post}><View style={styles.postHeader}><View><Text style={styles.author}>{post.usuario || `@${post.op}`}</Text><Text style={ui.muted}>{post.tiempo} · {post.etiqueta}</Text></View><IconButton name={post.guardado ? 'bookmark' : 'bookmark-outline'} active={post.guardado} onPress={onSave} /></View><Text style={styles.postTitle}>{post.titulo}</Text><Text style={styles.postText} numberOfLines={4}>{post.texto}</Text><View style={styles.postFooter}><Pressable onPress={onLike} style={styles.metric}><Ionicons name={post.liked ? 'heart' : 'heart-outline'} size={18} color={post.liked ? palette.orange : palette.muted} /><Text style={styles.metricText}>{post.likes || 0}</Text></Pressable><View style={styles.metric}><Ionicons name="chatbubble-outline" size={17} color={palette.muted} /><Text style={styles.metricText}>{post.comentariosTotal || 0} respuestas</Text></View></View></Pressable>; }

const styles = StyleSheet.create({
  communitiesList: { flexGrow: 0, height: 122 }, communities: { paddingHorizontal: 14, paddingVertical: 11, gap: 10 }, community: { width: 184, height: 100, borderRadius: 8, overflow: 'hidden', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, padding: 13, justifyContent: 'flex-end' }, communityActive: { borderColor: palette.amber, borderWidth: 2 }, communityTint: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0505059E' }, communityTitle: { color: palette.text, fontSize: 16, fontWeight: '800' }, communityMeta: { color: '#D0D0D3', fontSize: 11, marginTop: 3 },
  activeIntro: { marginHorizontal: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.surface, borderRadius: 8, borderWidth: 1, borderColor: palette.border }, filters: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 10 }, filter: { flex: 1, minWidth: 0, height: 36, borderRadius: 8, backgroundColor: palette.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border }, filterActive: { backgroundColor: palette.amber, borderColor: palette.orange }, filterText: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  posts: { paddingHorizontal: 14, paddingTop: 3, paddingBottom: 110, gap: 10 }, post: { padding: 14, gap: 9, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 8 }, postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, author: { color: palette.amber, fontWeight: '800' }, postTitle: { color: palette.text, fontSize: 17, fontWeight: '800' }, postText: { color: '#D6D7DA', lineHeight: 20 }, postFooter: { flexDirection: 'row', gap: 17, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 9 }, metric: { flexDirection: 'row', gap: 6, alignItems: 'center' }, metricText: { color: palette.muted, fontSize: 12 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A' }, thread: { height: '84%', padding: 17, backgroundColor: palette.bg, borderTopLeftRadius: 27, borderTopRightRadius: 27 }, threadTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, postActions: { flexDirection: 'row', gap: 5, borderBottomWidth: 1, borderBottomColor: palette.border }, comment: { flexDirection: 'row', gap: 11 }, commentLine: { width: 3, borderRadius: 2, backgroundColor: palette.border }, commentText: { color: palette.text, lineHeight: 20, marginTop: 4 }, composer: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 10 },
});

