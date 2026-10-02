import { KeyboardArea, KeyboardScrollView } from '@/components/keyboard-layout';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, Empty, ErrorNotice, Field, Header, IconButton, NotificationButton, Loading, Screen, ui } from '@/components/sondar-ui';
import { CommunityAttachmentPicker, CommunityAttachments, type CommunityAttachment } from '@/components/community-attachments';
import { ReportModal, type ReportPayload } from '@/components/report-modal';
import { formatCount, palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';
import { api } from '@/lib/api';
import { normalizeComment, normalizeCommunity, normalizeCommunityPost } from '@/lib/normalizers';

type Community = { id: string; nombre: string; titulo?: string; genero: string; descripcion?: string; miembros: number; unido?: boolean; publicaciones: number; portada?: string };
type Comment = { id: number; userId?: string; avatar?: string; parentId?: number | null; usuario: string; autor?: string; texto: string; respondeA?: string; tiempo?: string; likes?: number; liked?: boolean; guardado?: boolean; respuestas?: Comment[] };
type ReplyTarget = { parentId: number; usuario: string };
type Post = { id: number; userId?: string; avatar?: string; comunidadId: string; op: string; usuario: string; tipo: string; titulo: string; texto: string; etiqueta?: string; likes: number; liked?: boolean; guardado?: boolean; adjuntos?: CommunityAttachment[]; comentarios: Comment[]; comentariosTotal: number; tiempo?: string };

const countComments = (items: Comment[]): number => items.reduce((total, item) => total + 1 + countComments(item.respuestas || []), 0);
const removeComment = (items: Comment[], id: number): Comment[] => items
  .filter(item => item.id !== id)
  .map(item => ({ ...item, respuestas: removeComment(item.respuestas || [], id) }));

export default function CommunityScreen() {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const { comunidadId, publicacionId } = useLocalSearchParams<{ comunidadId?: string; publicacionId?: string }>();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [active, setActive] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState('destacado');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState({ titulo: '', texto: '', tipo: 'reciente', etiqueta: '' });
  const [eventAttachment, setEventAttachment] = useState<CommunityAttachment | null>(null);
  const [reelAttachment, setReelAttachment] = useState<CommunityAttachment | null>(null);
  const commentSaveLocks = useRef(new Set<number>());
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [comment, setComment] = useState('');
  const commentLock = useRef(false);
  const publishLock = useRef(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [reportTarget, setReportTarget] = useState<Post | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const membershipLock = useRef(false);
  const [membershipBusy, setMembershipBusy] = useState(false);

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

  useEffect(() => {
    if (!comunidadId || !publicacionId || !communities.length) return;
    let cancelled = false;
    const community = communities.find(item => item.id === comunidadId);
    const task = setTimeout(async () => {
      try {
        if (!community) throw new Error('La comunidad ya no esta disponible.');
        const result = await api<Post[]>('/api/comunidades/' + encodeURIComponent(comunidadId) + '/publicaciones?filtro=destacado', { token });
        if (cancelled) return;
        const normalized = result.map(normalizeCommunityPost);
        const post = normalized.find(item => String(item.id) === publicacionId);
        if (!post) throw new Error('La publicacion ya no esta disponible.');
        setActive(community);
        setFilter('destacado');
        setPosts(normalized);
        setOpenPost(post);
        setReplyTo(null);
        setComment('');
      } catch (e) {
        if (!cancelled) Alert.alert('Comunidad', e instanceof Error ? e.message : 'No se pudo abrir la publicacion.');
      } finally {
        if (!cancelled) router.setParams({ comunidadId: undefined, publicacionId: undefined });
      }
    }, 0);
    return () => { cancelled = true; clearTimeout(task); };
  }, [comunidadId, publicacionId, communities, token]);

  const threadCommunity = communities.find(item => String(item.id) === String(openPost?.comunidadId));

  async function updateMembership(id: string, join: boolean) {
    if (membershipLock.current) return;
    membershipLock.current = true; setMembershipBusy(true);
    try {
      const result = await api<{ unido: boolean; miembros: number }>(`/api/comunidades/${id}/membresia`, { token, method: join ? 'PUT' : 'DELETE' });
      setCommunities(items => items.map(item => item.id === id ? { ...item, ...result } : item));
      setActive(item => item?.id === id ? { ...item, ...result } : item);
    } catch (e) { Alert.alert('Comunidad', e instanceof Error ? e.message : 'No se pudo actualizar.'); }
    finally { membershipLock.current = false; setMembershipBusy(false); }
  }

  async function membership() {
    if (active) await updateMembership(active.id, !active.unido);
  }

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

  function openCommentProfile(item: { userId?: string }) {
    if (!item.userId) return;
    closeThread();
    router.push({ pathname: '/profile/[id]', params: { id: item.userId } });
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
    if (!active?.unido) { setError('Unite a la comunidad para publicar.'); return; }
    if (publishLock.current) return;
    if (!active || !form.titulo.trim() || !form.texto.trim()) {
      setError('Completa titulo y texto.');
      return;
    }
    publishLock.current = true;
    setPublishing(true);
    try {
      const created = await api<Post>(`/api/comunidades/${active.id}/publicaciones`, { method: 'POST', token, body: JSON.stringify({ ...form, eventoId: eventAttachment?.id, reelId: reelAttachment?.id, etiqueta: form.etiqueta || active.genero }) });
      setPosts(items => [normalizeCommunityPost(created), ...items]);
      setCreating(false);
      setForm({ titulo: '', texto: '', tipo: 'reciente', etiqueta: '' });
      setEventAttachment(null); setReelAttachment(null);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo publicar.');
    }
    finally { publishLock.current = false; setPublishing(false); }
  }

  async function sendComment() {
    if (!threadCommunity?.unido) { Alert.alert('Comunidad', 'Unite a la comunidad para responder.'); return; }
    if (commentLock.current) return;
    if (!openPost || !comment.trim()) return;
    commentLock.current = true;
    setSending(true);
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
    finally { commentLock.current = false; setSending(false); }
  }

  async function toggleCommentSave(target: Comment) {
    if (commentSaveLocks.current.has(target.id)) return;
    commentSaveLocks.current.add(target.id);
    try {
      const result = await api<{ guardado: boolean }>('/api/comunidades/comentarios/' + target.id + '/guardar', { token, method: target.guardado ? 'DELETE' : 'PUT' });
      const update = (post: Post) => ({ ...post, comentarios: updateComment(post.comentarios || [], target.id, item => ({ ...item, guardado: result.guardado })) });
      setPosts(items => items.map(update));
      setOpenPost(current => current ? update(current) : current);
    } catch (e) {
      Alert.alert('Guardados', e instanceof Error ? e.message : 'No se pudo guardar el comentario.');
    } finally { commentSaveLocks.current.delete(target.id); }
  }

  function openAttachment(item: CommunityAttachment) {
    closeThread();
    navigateAttachment(item);
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

  async function submitReport(payload: ReportPayload) {
    if (!reportTarget) return;
    setReportBusy(true);
    try {
      await api(`/api/comunidades/publicaciones/${reportTarget.id}/denunciar`, { method: 'POST', token, body: JSON.stringify(payload) });
      setReportTarget(null);
      Alert.alert('Listo', 'Denuncia enviada.');
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar la denuncia.'); }
    finally { setReportBusy(false); }
  }

  return (
    <Screen>
      <Header
        title="Comunidad"
        subtitle="Encontra tu escena"
        actions={<><IconButton name="chatbubbles-outline" onPress={() => router.push('/messages')} /><NotificationButton /></>}
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
            <View style={styles.introTop}>
              <Text style={[ui.h2, { flex: 1 }]}>{active.titulo || active.nombre}</Text>
              <View style={styles.membershipActions}>
                <Pressable accessibilityRole="button" disabled={membershipBusy} onPress={membership} hitSlop={5} style={[styles.membershipButton, !active.unido && styles.membershipPrimary]}>
                  <Text style={[styles.membershipText, !active.unido && styles.membershipPrimaryText]}>{membershipBusy ? 'Guardando...' : active.unido ? 'Salir' : 'Unirse'}</Text>
                </Pressable>
                {active.unido ? <Pressable accessibilityRole="button" onPress={() => setCreating(true)} hitSlop={5} style={[styles.membershipButton, styles.membershipPrimary]}><Ionicons name="add" size={15} color="#111" /><Text style={[styles.membershipText, styles.membershipPrimaryText]}>Crear post</Text></Pressable> : null}
              </View>
            </View>
            <Text style={ui.muted} numberOfLines={2}>{active.descripcion}</Text>
          </View>
        ) : null}
        <View style={styles.filters}>
          {[
            ['destacado', 'Destacado'],
            ['reciente', 'Recientes'],
            ['popular', 'Populares'],
            ['preguntas', 'Preguntas'],
          ].map(([id, label]) => (
            <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: filter === id }} onPress={() => setFilter(id)} style={[styles.filter, filter === id && styles.filterActive]}>
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
            renderItem={({ item }) => <PostCard post={item} own={item.userId === user?.id} onOpen={() => openThread(item)} onProfile={() => openCommentProfile(item)} onLike={() => interact(item, 'like')} onSave={() => interact(item, 'guardar')} onReport={() => setReportTarget(item)} />}
          />
        )}
      </>}

      <Modal visible={creating} animationType="slide" onRequestClose={() => { if (!publishing) setCreating(false); }}>

        <KeyboardArea style={{ flex: 1 }}>
        <KeyboardScrollView style={styles.createScreen} contentContainerStyle={[styles.createContent, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.createHeader}>
            <Text style={styles.createTitle}>Crear post</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar crear post" disabled={publishing} onPress={() => setCreating(false)} style={styles.createClose}><Ionicons name="close" color={palette.text} size={22} /></Pressable>
          </View>
          <Text style={styles.createCommunity}>s/{(active?.titulo || active?.nombre || active?.genero || '').replace(/^@/, '').replace(/^s[/]/, '')}</Text>
          <ErrorNotice message={error} />
          <View style={styles.createSection}>
            <Text style={styles.formLabel}>TÍTULO</Text>
            <Field editable={!publishing} value={form.titulo} onChangeText={titulo => setForm(f => ({ ...f, titulo }))} placeholder="Título de la publicación" maxLength={300} style={styles.createField} />
            <Text style={styles.formCounter}>{form.titulo.length}/300</Text>
          </View>
          <View style={styles.createSection}>
            <Text style={styles.formLabel}>TIPO DE PUBLICACIÓN</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Tipo de publicación" accessibilityState={{ expanded: typeMenuOpen, disabled: publishing }} disabled={publishing} onPress={() => setTypeMenuOpen(value => !value)} style={styles.typeSelect}>
              <Text style={styles.typeSelectText}>{form.tipo === 'preguntas' ? 'Solo preguntas' : 'Publicación general'}</Text>
              <Ionicons name={typeMenuOpen ? 'chevron-up' : 'chevron-down'} size={20} color={palette.text} />
            </Pressable>
            {typeMenuOpen ? <View style={styles.typeOptions}>{[['reciente', 'Publicación general'], ['preguntas', 'Solo preguntas']].map(([id, label]) => <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: form.tipo === id }} disabled={publishing} onPress={() => { setForm(f => ({ ...f, tipo: id })); setTypeMenuOpen(false); }} style={styles.typeOption}><Text style={styles.typeSelectText}>{label}</Text>{form.tipo === id ? <Ionicons name="checkmark" size={20} color={palette.amber} /> : null}</Pressable>)}</View> : null}
          </View>
          {creating ? <>
            <CommunityAttachmentPicker type="evento" token={token} value={eventAttachment} onChange={setEventAttachment} disabled={publishing} />
            <CommunityAttachmentPicker type="reel" token={token} value={reelAttachment} onChange={setReelAttachment} disabled={publishing} />
          </> : null}
          <View style={styles.createSection}>
            <Text style={styles.formLabel}>DESCRIPCIÓN</Text>
            <Field editable={!publishing} value={form.texto} onChangeText={texto => setForm(f => ({ ...f, texto }))} placeholder={'Escribí en ' + (active?.nombre || '@' + active?.genero) + ' o mencioná con @usuario'} multiline maxLength={3000} style={[styles.createField, styles.createDescription]} />
          </View>
          <View style={styles.publishActions}>
            <Pressable accessibilityRole="button" disabled={publishing} onPress={() => setCreating(false)} style={[styles.createAction, styles.createCancel, publishing && styles.createDisabled]}><Text style={styles.createActionText}>Cancelar</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Publicar post" accessibilityState={{ disabled: publishing || !form.titulo.trim() || !form.texto.trim() }} onPress={publish} disabled={publishing || !form.titulo.trim() || !form.texto.trim()} style={[styles.createAction, publishing && styles.createDisabled]}>
              <LinearGradient colors={['#FFAE00', '#FF5E00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.createGradient}><Text style={[styles.createActionText, { color: '#000' }]}>{publishing ? 'Publicando...' : 'Post'}</Text></LinearGradient>
            </Pressable>
          </View>
        </KeyboardScrollView>
        </KeyboardArea>

      </Modal>

      <Modal visible={Boolean(openPost)} animationType="slide" transparent onRequestClose={closeThread}>
        <KeyboardArea style={styles.backdrop}>
          <View style={[styles.thread, { paddingBottom: Math.max(insets.bottom, 17) }]}>
            <View style={styles.threadTop}>
              <Text style={ui.h2}>Conversacion</Text>
              <IconButton name="close" onPress={closeThread} />
            </View>
            {openPost ? <>
              <FlatList
                ListHeaderComponent={<>
              <Pressable accessibilityRole="button" accessibilityLabel="Ver perfil del autor" disabled={!openPost.userId} onPress={() => openCommentProfile(openPost)} style={styles.threadAuthor}>
                <Avatar uri={openPost.avatar} name={(openPost.usuario || openPost.op).replace(/^@/, '')} size={38} />
                <View style={styles.authorInfo}>
                  <Text style={styles.author}>{openPost.usuario || openPost.op}{user?.id && openPost.userId === user.id ? <Text style={styles.youLabel}>  Tú</Text> : null}</Text>
                  <Text style={ui.muted}>{openPost.tiempo}</Text>
                </View>
              </Pressable>
              <Text style={styles.postTitle}>{openPost.titulo}</Text>
              <Text style={styles.postText}>{openPost.texto}</Text>
              <CommunityAttachments items={openPost.adjuntos} onOpen={openAttachment} />
              <View style={styles.postActions}>
                <Button kind="ghost" icon={openPost.liked ? 'heart' : 'heart-outline'} onPress={() => interact(openPost, 'like')}>{formatCount(openPost.likes || 0)}</Button>
                <Button kind="ghost" icon={openPost.guardado ? 'bookmark' : 'bookmark-outline'} onPress={() => interact(openPost, 'guardar')}>Guardar</Button>
                {openPost.userId !== user?.id ? <Button kind="ghost" icon="flag-outline" onPress={() => setReportTarget(openPost)}>Denunciar</Button> : null}
              </View>
                </>}
                data={openPost.comentarios || []}
                keyExtractor={item => String(item.id)}
                style={{ flex: 1 }}
                contentContainerStyle={{ gap: 13, paddingVertical: 12 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Empty title="Sin respuestas todavia" />}
                renderItem={({ item }) => <CommunityComment item={item} currentUserId={user?.id} onLike={toggleCommentLike} onReply={setReplyTo} onDelete={deleteComment} onSave={toggleCommentSave} onProfile={openCommentProfile} />}
              />
              {replyTo ? (
                <View style={styles.replyBanner}>
                  <Text style={styles.replyBannerText}>Respondiendo a {replyTo.usuario}</Text>
                  <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={palette.muted} />
                  </Pressable>
                </View>
              ) : null}
              {!threadCommunity?.unido ? <View style={styles.joinToComment}>
                <Text style={ui.muted}>Unite a esta comunidad para enviar tu comentario.</Text>
                <Button disabled={membershipBusy} onPress={() => void updateMembership(openPost.comunidadId, true)}>
                  {membershipBusy ? 'Uniendo...' : 'Unirme para comentar'}
                </Button>
              </View> : null}
              <View style={styles.composer}>
                <View style={styles.commentInput}>
                  <Field label="Tu comentario" value={comment} onChangeText={setComment} editable={!sending} placeholder={replyTo ? `Responder a ${replyTo.usuario}...` : 'Escribi una respuesta...'} />
                </View>
                <IconButton
                  name={sending ? 'hourglass-outline' : 'send'}
                  accessibilityLabel={sending ? 'Enviando comentario' : 'Enviar comentario'}
                  active
                  disabled={sending || !comment.trim() || !threadCommunity?.unido}
                  onPress={sendComment}
                />
              </View>
            </> : null}
          </View>
        </KeyboardArea>
      </Modal>
      <ReportModal visible={Boolean(reportTarget)} subject={reportTarget?.usuario || reportTarget?.titulo} busy={reportBusy} onClose={() => setReportTarget(null)} onSubmit={submitReport} />
    </Screen>
  );
}

function CommunityComment({ item, currentUserId, onLike, onReply, onDelete, onSave, onProfile, nested = false, rootId }: { item: Comment; currentUserId?: string; onLike: (item: Comment) => void; onReply: (target: ReplyTarget) => void; onDelete: (item: Comment) => void; onSave: (item: Comment) => void; onProfile: (item: Comment) => void; nested?: boolean; rootId?: number }) {
  const parentId = rootId || item.id;
  const displayName = item.usuario || (item.autor ? `@${String(item.autor).replace(/^@/, '')}` : '@usuario');
  const canDelete = Boolean(currentUserId && item.userId === currentUserId);
  return (
    <View style={nested && styles.nestedComment}>
      <View style={styles.comment}>
        <Pressable accessibilityRole="button" accessibilityLabel={'Ver perfil de ' + displayName} disabled={!item.userId} onPress={() => onProfile(item)}>
          <Avatar uri={item.avatar} name={displayName.replace(/^@/, '')} size={nested ? 28 : 34} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={'Ver perfil de ' + displayName} disabled={!item.userId} onPress={() => onProfile(item)}>
            <Text style={styles.author}>{displayName}{canDelete ? <Text style={styles.youLabel}>  Tú</Text> : null}</Text>
          </Pressable>{nested && item.respondeA ? <Text style={styles.replyTarget}>En respuesta a {item.respondeA}</Text> : null}<Text style={ui.muted}>{item.tiempo}</Text>
          <Text style={styles.commentText}>{item.texto}</Text>
          <View style={styles.commentActions}>
            <Pressable onPress={() => onReply({ parentId, usuario: displayName })} hitSlop={8}>
              <Text style={styles.commentActionText}>Responder</Text>
            </Pressable>
            <Pressable onPress={() => onLike(item)} hitSlop={8} style={styles.commentLike}>
              <Ionicons name={item.liked ? 'heart' : 'heart-outline'} size={15} color={item.liked ? palette.orange : palette.muted} />
              <Text style={styles.commentActionText}>{formatCount(item.likes || 0)} me gusta</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={item.guardado ? 'Quitar comentario de guardados' : 'Guardar comentario'} onPress={() => onSave(item)} hitSlop={8} style={styles.commentLike}>
              <Ionicons name={item.guardado ? 'bookmark' : 'bookmark-outline'} size={15} color={item.guardado ? palette.orange : palette.muted} />
              <Text style={styles.commentActionText}>{item.guardado ? 'Guardado' : 'Guardar'}</Text>
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
      {item.respuestas?.map(reply => <CommunityComment key={reply.id} item={reply} currentUserId={currentUserId} onLike={onLike} onReply={onReply} onDelete={onDelete} onSave={onSave} onProfile={onProfile} nested rootId={parentId} />)}
    </View>
  );
}

function PostCard({ post, own, onOpen, onProfile, onLike, onSave, onReport }: { post: Post; own: boolean; onOpen: () => void; onProfile: () => void; onLike: () => void; onSave: () => void; onReport: () => void }) {
  return (
    <View style={styles.post}>
      <View style={styles.postHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Ver perfil del autor" disabled={!post.userId} onPress={onProfile} style={styles.postHeaderInfo}>
          <Avatar uri={post.avatar} name={(post.usuario || post.op).replace(/^@/, '')} size={38} />
          <View style={styles.authorInfo}>
            <Text style={styles.author}>{post.usuario || `@${post.op}`}{own ? <Text style={styles.youLabel}>  Tú</Text> : null}</Text>
            <Text style={ui.muted}>{post.tiempo} · {post.etiqueta}</Text>
          </View>
        </Pressable>
        <View style={styles.postHeaderActions}>{!own ? <IconButton name="flag-outline" onPress={onReport} /> : null}<IconButton name={post.guardado ? 'bookmark' : 'bookmark-outline'} active={post.guardado} onPress={onSave} /></View>
      </View>
      <Pressable onPress={onOpen} style={styles.postBody}>
        <Text style={styles.postTitle}>{post.titulo}</Text>
        <Text style={styles.postText} numberOfLines={4}>{post.texto}</Text>
      </Pressable>
      <CommunityAttachments items={post.adjuntos} onOpen={navigateAttachment} />
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

function navigateAttachment(item: CommunityAttachment) {
  if (item.tipo === 'evento') router.push({ pathname: '/', params: { eventId: String(item.id) } });
  else router.push({ pathname: '/discover', params: { reelId: String(item.id) } });
}

function updateComment(items: Comment[], id: number, updater: (item: Comment) => Comment): Comment[] {
  return items.map(item => item.id === id ? updater(item) : { ...item, respuestas: updateComment(item.respuestas || [], id, updater) });
}

function appendReply(items: Comment[], id: number, reply: Comment): Comment[] {
  return updateComment(items, id, item => ({ ...item, respuestas: [...(item.respuestas || []), reply] }));
}

const styles = StyleSheet.create({
  youLabel: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  createScreen: { flex: 1, backgroundColor: '#101010' },
  createContent: { paddingHorizontal: 16, gap: 22 },
  createHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  createTitle: { color: '#FFF', fontSize: 28, fontWeight: '700' },
  createClose: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#665000', backgroundColor: '#1C1C1C', alignItems: 'center', justifyContent: 'center' },
  createCommunity: { color: '#FFAE00', fontSize: 18, fontWeight: '900' },
  createSection: { gap: 12 },
  createField: { backgroundColor: '#222', borderColor: '#333', borderRadius: 10, minHeight: 54, paddingHorizontal: 14, fontSize: 16 },
  createDescription: { minHeight: 160, textAlignVertical: 'top' },
  typeSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, minHeight: 54, borderRadius: 10, borderWidth: 1, borderColor: '#333', backgroundColor: '#222' },
  typeSelectText: { color: '#FFF', fontSize: 16, flexShrink: 1 },
  typeOptions: { borderRadius: 10, borderWidth: 1, borderColor: '#333', backgroundColor: '#222', overflow: 'hidden' },
  typeOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 16 },
  createAction: { flex: 1, minHeight: 50, borderRadius: 28, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  createCancel: { backgroundColor: '#333' },
  createGradient: { width: '100%', minHeight: 50, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  createActionText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  createDisabled: { opacity: .5 },
  publishContext: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  formLabel: { color: '#C8C8C8', fontSize: 13, fontWeight: '800' },
  postTypes: { flexDirection: 'row', gap: 8 },
  postType: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  postTypeActive: { borderColor: palette.orange, backgroundColor: '#FF790018' },
  postTypeText: { flex: 1, color: palette.text, fontSize: 12, fontWeight: '700' },
  formCounter: { color: palette.muted, textAlign: 'right', fontSize: 11 },
  publishActions: { flexDirection: 'row', gap: 10, paddingTop: 10, paddingBottom: 16 },
  communityRail: { height: 116, flexShrink: 0 },
  communitiesList: { flexGrow: 0, height: 108 },
  communities: { paddingHorizontal: 14, paddingVertical: 8, gap: 10 },
  community: { width: 154, height: 92, borderRadius: 8, overflow: 'hidden', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, padding: 12, justifyContent: 'flex-end' },
  communityActive: { borderColor: palette.amber, borderWidth: 2 },
  communityTint: { ...StyleSheet.absoluteFill, backgroundColor: '#0505059E' },
  communityTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  communityMeta: { color: '#D0D0D3', fontSize: 11, marginTop: 3 },
  introTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  membershipActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  membershipButton: { minHeight: 32, borderRadius: 16, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface2 },
  membershipPrimary: { backgroundColor: palette.orange, borderColor: palette.orange },
  membershipText: { color: palette.text, fontSize: 12, fontWeight: '700' },
  membershipPrimaryText: { color: '#111' },
  activeIntro: { marginHorizontal: 14, padding: 12, gap: 10, backgroundColor: palette.surface, borderRadius: 8, borderWidth: 1, borderColor: palette.border },
  filters: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  filter: { flex: 1, minWidth: 0, height: 36, borderRadius: 8, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: palette.orange },
  filterText: { color: palette.muted, fontSize: 10, fontWeight: '700' },
  posts: { paddingHorizontal: 14, paddingTop: 3, paddingBottom: 110, gap: 10 },
  post: { padding: 14, gap: 9, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 8 },
  postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  postHeaderActions: { flexDirection: 'row', gap: 6 },
  postHeaderInfo: { flex: 1, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 9 },
  authorInfo: { flex: 1, minWidth: 0 },
  threadAuthor: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  postBody: { gap: 9 },
  author: { color: palette.amber, fontWeight: '800' },
  postTitle: { color: palette.text, fontSize: 17, fontWeight: '800' },
  postText: { color: '#D6D7DA', lineHeight: 20 },
  postFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 9 },
  metric: { minHeight: 30, flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 9, borderRadius: 8, backgroundColor: palette.surface2, borderWidth: 1, borderColor: palette.border },
  metricText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A' },
  joinToComment: { gap: 8, paddingVertical: 10 },
  thread: { height: '84%', padding: 17, backgroundColor: palette.bg, borderTopLeftRadius: 27, borderTopRightRadius: 27 },
  threadTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  postActions: { flexDirection: 'row', gap: 5, borderBottomWidth: 1, borderBottomColor: palette.border },
  comment: { flexDirection: 'row', gap: 11 },
  nestedComment: { marginLeft: 22, marginTop: 12, gap: 12 },
  replyTarget: { color: palette.orange, fontWeight: '800' },
  commentText: { color: palette.text, lineHeight: 20, marginTop: 4 },
  commentActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 7 },
  commentActionText: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  commentLike: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 8, marginBottom: 8 },
  replyBannerText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  commentInput: { flex: 1, minWidth: 0 },
  composer: { width: '100%', flexDirection: 'row', flexShrink: 0, alignItems: 'flex-end', gap: 8, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 10 },
});
