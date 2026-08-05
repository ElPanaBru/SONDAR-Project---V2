import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Empty, ErrorNotice, Field, Header, IconButton, Loading, Screen, ui } from '@/components/sondar-ui';
import { formatCount, palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';
import { api } from '@/lib/api';
import { normalizeComment, normalizeCommunity, normalizeCommunityPost } from '@/lib/normalizers';

type Community = { id: string; nombre: string; titulo?: string; genero: string; descripcion?: string; miembros: number; publicaciones: number; portada?: string };
type Comment = { id: number; userId?: string; parentId?: number | null; usuario: string; autor?: string; texto: string; respondeA?: string; tiempo?: string; likes?: number; liked?: boolean; respuestas?: Comment[] };
type ReplyTarget = { parentId: number; usuario: string };
type Post = { id: number; comunidadId: string; op: string; usuario: string; tipo: string; titulo: string; texto: string; etiqueta?: string; likes: number; liked?: boolean; guardado?: boolean; comentarios: Comment[]; comentariosTotal: number; tiempo?: string };

const countComments = (items: Comment[]): number => items.reduce((total, item) => total + 1 + countComments(item.respuestas || []), 0);
const removeComment = (items: Comment[], id: number): Comment[] => items
  .filter(item => item.id !== id)
  .map(item => ({ ...item, respuestas: removeComment(item.respuestas || [], id) }));

export default function CommunityScreen() {
  const { token, user } = useAuth();
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
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);

  useEffect(() => {
    api<Community[]>('/api/comunidades', { token }).then(data => {
      const normalized = data.map(normalizeCommunity);
      setCommunities(normalized);
      setActive(current => normalized.find(item => item.id === current?.id) || normalized[0] || null);
      setError('');
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [token]);

  const loadPosts = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      const data = await api<Post[]>(`/api/comunidades/${active.id}/publicaciones?filtro=${filter}`, { token });
      setPosts(data.map(normalizeCommunityPost));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las publicaciones.');
    } finally {
      setLoading(false);
    }
  }, [active, filter, token]);

  useEffect(() => {
    const task = setTimeout(() => void loadPosts(), 0);
    return () => clearTimeout(task);
  }, [loadPosts]);

  function openThread(post: Post) {
    setOpenPost(post);
    setReplyTo(null);
    setComment('');
  }

  function closeThread() {
    setOpenPost(null);
    setReplyTo(null);
    setComment('');
  }

  async function interact(post: Post, kind: 'like' | 'guardar') {
    try {
      const result = await api<any>(`/api/comunidades/publicaciones/${post.id}/${kind}`, { method: 'POST', token });
      setPosts(items => items.map(item => item.id === post.id ? { ...item, ...result } : item));
      setOpenPost(item => item?.id === post.id ? { ...item, ...result } : item);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo completar la accion.');
    }
  }

  async function publish() {
    if (!active || !form.titulo.trim() || !form.texto.trim()) {
      setError('Completa titulo y texto.');
      return;
    }
    try {
      const created = await api<Post>(`/api/comunidades/${active.id}/publicaciones`, { method: 'POST', token, body: JSON.stringify({ ...form, etiqueta: form.etiqueta || active.genero }) });
      setPosts(items => [normalizeCommunityPost(created), ...items]);
      setCreating(false);
      setForm({ titulo: '', texto: '', tipo: 'reciente', etiqueta: '' });
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo publicar.');
    }
  }

  async function sendComment() {
    if (!openPost || !comment.trim()) return;
    try {
      const created = normalizeComment(await api<Comment>(`/api/comunidades/publicaciones/${openPost.id}/comentarios`, {
        method: 'POST',
        token,
        body: JSON.stringify({ texto: comment.trim(), parentId: replyTo?.parentId, respondeA: replyTo?.usuario }),
      }));
      const update = (post: Post) => ({
        ...post,
        comentarios: replyTo ? appendReply(post.comentarios || [], replyTo.parentId, created) : [...(post.comentarios || []), created],
        comentariosTotal: countComments(replyTo ? appendReply(post.comentarios || [], replyTo.parentId, created) : [...(post.comentarios || []), created]),
      });
      setPosts(items => items.map(item => item.id === openPost.id ? update(item) : item));
      setOpenPost(current => current ? update(current) : current);
      setComment('');
      setReplyTo(null);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo responder.');
    }
  }

  async function toggleCommentLike(target: Comment) {
    try {
      const result = await api<{ id: number; liked: boolean; likes: number; votos?: number }>(`/api/comunidades/comentarios/${target.id}/like`, { method: 'POST', token });
      const update = (post: Post) => ({
        ...post,
        comentarios: updateComment(post.comentarios || [], target.id, item => ({ ...item, liked: result.liked, likes: result.likes ?? result.votos ?? item.likes })),
      });
      setPosts(items => items.map(item => item.id === openPost?.id ? update(item) : item));
      setOpenPost(current => current ? update(current) : current);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo actualizar el me gusta.');
    }
  }

  function deleteComment(target: Comment) {
    if (!openPost) return;
    if (!token) {
      Alert.alert('SONDAR', 'Inicia sesion para eliminar comentarios.');
      return;
    }

    const postId = openPost.id;
    Alert.alert('Eliminar comentario', 'Esta accion no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/comunidades/comentarios/${target.id}`, { method: 'DELETE', token });
            const update = (post: Post) => {
              const comentarios = removeComment(post.comentarios || [], target.id);
              return { ...post, comentarios, comentariosTotal: countComments(comentarios) };
            };
            setPosts(items => items.map(item => item.id === postId ? update(item) : item));
            setOpenPost(current => current ? update(current) : current);
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar el comentario.');
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <Header
        title="Comunidad"
        subtitle="Encontra tu escena"
        actions={<><IconButton name="notifications-outline" onPress={() => router.push('/notifications')} /><IconButton name="add" active onPress={() => setCreating(true)} /></>}
      />
      {loading && !communities.length ? <Loading /> : <>
        <View style={styles.communityRail}>
        <FlatList
          horizontal
          data={communities}
          keyExtractor={item => item.id}
          style={styles.communitiesList}
          bounces={false}
          directionalLockEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.communities}
          renderItem={({ item }) => (
            <Pressable onPress={() => setActive(item)} style={[styles.community, active?.id === item.id && styles.communityActive]}>
              {item.portada ? <Image source={{ uri: item.portada }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              <View style={styles.communityTint} />
              <Text style={styles.communityTitle}>{item.titulo || item.nombre}</Text>
              <Text style={styles.communityMeta}>{formatCount(item.miembros)} miembros · {item.genero}</Text>
            </Pressable>
          )}
        />
        </View>
        {active ? (
          <View style={styles.activeIntro}>
            <View style={{ flex: 1 }}>
              <Text style={ui.h2}>{active.titulo || active.nombre}</Text>
              <Text style={ui.muted} numberOfLines={2}>{active.descripcion}</Text>
            </View>
            <Ionicons name="people-circle" size={42} color={palette.orange} />
          </View>
        ) : null}
        <View style={styles.filters}>
          {[
            ['destacado', 'Destacado'],
            ['reciente', 'Recientes'],
            ['popular', 'Populares'],
            ['preguntas', 'Preguntas'],
          ].map(([id, label]) => (
            <Pressable key={id} onPress={() => setFilter(id)} style={[styles.filter, filter === id && styles.filterActive]}>
              <Text style={[styles.filterText, filter === id && { color: '#111' }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <ErrorNotice message={error} />
        {loading ? <Loading /> : (
          <FlatList
            data={posts}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.posts}
            refreshing={loading}
            onRefresh={loadPosts}
            ListEmptyComponent={<Empty icon="people-outline" title="No hay publicaciones todavia" text="Abri una conversacion en esta comunidad." />}
            renderItem={({ item }) => <PostCard post={item} onOpen={() => openThread(item)} onLike={() => interact(item, 'like')} onSave={() => interact(item, 'guardar')} />}
          />
        )}
      </>}

      <Modal visible={creating} animationType="slide" onRequestClose={() => setCreating(false)}>
        <Screen scroll>
          <Header title="Nueva publicacion" back onBack={() => setCreating(false)} actions={<IconButton name="close" onPress={() => setCreating(false)} />} />
          <ErrorNotice message={error} />
          <Text style={ui.muted}>Publicando en {active?.titulo || active?.nombre}</Text>
          <Field label="Titulo" value={form.titulo} onChangeText={titulo => setForm(f => ({ ...f, titulo }))} placeholder="Abri una conversacion" maxLength={140} />
          <Field label="Texto" value={form.texto} onChangeText={texto => setForm(f => ({ ...f, texto }))} placeholder="Que queres compartir?" multiline maxLength={3000} />
          <Field label="Etiqueta" value={form.etiqueta} onChangeText={etiqueta => setForm(f => ({ ...f, etiqueta }))} placeholder={active?.genero || 'musica'} />
          <Button onPress={publish}>Publicar</Button>
        </Screen>
      </Modal>

      <Modal visible={Boolean(openPost)} animationType="slide" transparent onRequestClose={closeThread}>
        <View style={styles.backdrop}>
          <View style={styles.thread}>
            <View style={styles.threadTop}>
              <Text style={ui.h2}>Conversacion</Text>
              <IconButton name="close" onPress={closeThread} />
            </View>
            {openPost ? <>
              <Text style={styles.postTitle}>{openPost.titulo}</Text>
              <Text style={styles.postText}>{openPost.texto}</Text>
              <View style={styles.postActions}>
                <Button kind="ghost" icon={openPost.liked ? 'heart' : 'heart-outline'} onPress={() => interact(openPost, 'like')}>{formatCount(openPost.likes || 0)}</Button>
                <Button kind="ghost" icon={openPost.guardado ? 'bookmark' : 'bookmark-outline'} onPress={() => interact(openPost, 'guardar')}>Guardar</Button>
              </View>
              <FlatList
                data={openPost.comentarios || []}
                keyExtractor={item => String(item.id)}
                style={{ flex: 1 }}
                contentContainerStyle={{ gap: 13, paddingVertical: 12 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Empty title="Sin respuestas todavia" />}
                renderItem={({ item }) => <CommunityComment item={item} currentUserId={user?.id} onLike={toggleCommentLike} onReply={setReplyTo} onDelete={deleteComment} />}
              />
              {replyTo ? (
                <View style={styles.replyBanner}>
                  <Text style={styles.replyBannerText}>Respondiendo a {replyTo.usuario}</Text>
                  <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={palette.muted} />
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.composer}>
                <View style={{ flex: 1 }}>
                  <Field value={comment} onChangeText={setComment} placeholder={replyTo ? `Responder a ${replyTo.usuario}...` : 'Escribi una respuesta...'} />
                </View>
                <IconButton name="send" active onPress={sendComment} />
              </View>
            </> : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function CommunityComment({ item, currentUserId, onLike, onReply, onDelete, nested = false, rootId }: { item: Comment; currentUserId?: string; onLike: (item: Comment) => void; onReply: (target: ReplyTarget) => void; onDelete: (item: Comment) => void; nested?: boolean; rootId?: number }) {
  const parentId = rootId || item.id;
  const displayName = item.usuario || (item.autor ? `@${String(item.autor).replace(/^@/, '')}` : '@usuario');
  const canDelete = Boolean(currentUserId && item.userId === currentUserId);
  return (
    <View style={nested && styles.nestedComment}>
      <View style={styles.comment}>
        <View style={styles.commentLine} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author}>{displayName}{nested && item.respondeA ? <Text style={styles.replyTarget}> para {item.respondeA}</Text> : null} <Text style={ui.muted}>{item.tiempo}</Text></Text>
          <Text style={styles.commentText}>{item.texto}</Text>
          <View style={styles.commentActions}>
            <Pressable onPress={() => onReply({ parentId, usuario: displayName })} hitSlop={8}>
              <Text style={styles.commentActionText}>Responder</Text>
            </Pressable>
            <Pressable onPress={() => onLike(item)} hitSlop={8} style={styles.commentLike}>
              <Ionicons name={item.liked ? 'heart' : 'heart-outline'} size={15} color={item.liked ? palette.orange : palette.muted} />
              <Text style={styles.commentActionText}>{formatCount(item.likes || 0)} me gusta</Text>
            </Pressable>
            {canDelete ? (
              <Pressable onPress={() => onDelete(item)} hitSlop={8} style={styles.commentLike}>
                <Ionicons name="trash-outline" size={15} color={palette.muted} />
                <Text style={styles.commentActionText}>Eliminar</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
      {item.respuestas?.map(reply => <CommunityComment key={reply.id} item={reply} currentUserId={currentUserId} onLike={onLike} onReply={onReply} onDelete={onDelete} nested rootId={parentId} />)}
    </View>
  );
}

function PostCard({ post, onOpen, onLike, onSave }: { post: Post; onOpen: () => void; onLike: () => void; onSave: () => void }) {
  return (
    <View style={styles.post}>
      <View style={styles.postHeader}>
        <Pressable onPress={onOpen} style={styles.postHeaderInfo}>
          <Text style={styles.author}>{post.usuario || `@${post.op}`}</Text>
          <Text style={ui.muted}>{post.tiempo} · {post.etiqueta}</Text>
        </Pressable>
        <IconButton name={post.guardado ? 'bookmark' : 'bookmark-outline'} active={post.guardado} onPress={onSave} />
      </View>
      <Pressable onPress={onOpen} style={styles.postBody}>
        <Text style={styles.postTitle}>{post.titulo}</Text>
        <Text style={styles.postText} numberOfLines={4}>{post.texto}</Text>
      </Pressable>
      <View style={styles.postFooter}>
        <Pressable onPress={onLike} style={styles.metric}>
          <Ionicons name={post.liked ? 'heart' : 'heart-outline'} size={18} color={post.liked ? palette.orange : palette.muted} />
          <Text style={styles.metricText}>{formatCount(post.likes || 0)} me gusta</Text>
        </Pressable>
        <Pressable onPress={onOpen} style={styles.metric}>
          <Ionicons name="chatbubble-outline" size={17} color={palette.muted} />
          <Text style={styles.metricText}>{formatCount(post.comentariosTotal || 0)} respuestas</Text>
        </Pressable>
        <Pressable onPress={onSave} style={styles.metric}>
          <Ionicons name={post.guardado ? 'bookmark' : 'bookmark-outline'} size={17} color={post.guardado ? palette.orange : palette.muted} />
          <Text style={styles.metricText}>{post.guardado ? 'Guardado' : 'Guardar'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function updateComment(items: Comment[], id: number, updater: (item: Comment) => Comment): Comment[] {
  return items.map(item => item.id === id ? updater(item) : { ...item, respuestas: updateComment(item.respuestas || [], id, updater) });
}

function appendReply(items: Comment[], id: number, reply: Comment): Comment[] {
  return updateComment(items, id, item => ({ ...item, respuestas: [...(item.respuestas || []), reply] }));
}

const styles = StyleSheet.create({
  communityRail: { height: 116, flexShrink: 0 },
  communitiesList: { flexGrow: 0, height: 108 },
  communities: { paddingHorizontal: 14, paddingVertical: 8, gap: 10 },
  community: { width: 154, height: 92, borderRadius: 8, overflow: 'hidden', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, padding: 12, justifyContent: 'flex-end' },
  communityActive: { borderColor: palette.amber, borderWidth: 2 },
  communityTint: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0505059E' },
  communityTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  communityMeta: { color: '#D0D0D3', fontSize: 11, marginTop: 3 },
  activeIntro: { marginHorizontal: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.surface, borderRadius: 8, borderWidth: 1, borderColor: palette.border },
  filters: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  filter: { flex: 1, minWidth: 0, height: 36, borderRadius: 8, backgroundColor: palette.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border },
  filterActive: { backgroundColor: palette.amber, borderColor: palette.orange },
  filterText: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  posts: { paddingHorizontal: 14, paddingTop: 3, paddingBottom: 110, gap: 10 },
  post: { padding: 14, gap: 9, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 8 },
  postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  postHeaderInfo: { flex: 1, paddingVertical: 2 },
  postBody: { gap: 9 },
  author: { color: palette.amber, fontWeight: '800' },
  postTitle: { color: palette.text, fontSize: 17, fontWeight: '800' },
  postText: { color: '#D6D7DA', lineHeight: 20 },
  postFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 9 },
  metric: { minHeight: 30, flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 9, borderRadius: 8, backgroundColor: palette.surface2, borderWidth: 1, borderColor: palette.border },
  metricText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A' },
  thread: { height: '84%', padding: 17, backgroundColor: palette.bg, borderTopLeftRadius: 27, borderTopRightRadius: 27 },
  threadTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  postActions: { flexDirection: 'row', gap: 5, borderBottomWidth: 1, borderBottomColor: palette.border },
  comment: { flexDirection: 'row', gap: 11 },
  nestedComment: { marginLeft: 22, marginTop: 12, gap: 12 },
  commentLine: { width: 3, borderRadius: 2, backgroundColor: palette.border },
  replyTarget: { color: palette.orange, fontWeight: '800' },
  commentText: { color: palette.text, lineHeight: 20, marginTop: 4 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 7 },
  commentActionText: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  commentLike: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 8, marginBottom: 8 },
  replyBannerText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 10 },
});
