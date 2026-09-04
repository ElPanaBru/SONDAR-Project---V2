import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';
import { api, mediaPart } from '@/lib/api';
import { ReportModal, type ReportPayload } from './report-modal';
import { Avatar, Button, Empty, ErrorNotice, Field, Header, IconButton, Loading, Screen, ui } from './sondar-ui';

type CommunityAttachment = { tipo: 'reel' | 'evento'; id: number; titulo: string; detalle?: string; imagen?: string };
type CommunityComment = { id: number; userId?: string; usuario: string; nombre?: string; avatar?: string; texto: string; tiempo?: string };
type CommunityPost = { id: number; userId?: string; usuario: string; nombre?: string; avatar?: string; texto: string; tipo: string; tiempo?: string; adjunto?: CommunityAttachment | null; comentarios?: CommunityComment[] };
type ProfileData = { perfil: any; publicaciones: any[]; eventos: any[]; favoritos: any[]; guardados: any[]; comunidad: CommunityPost[]; seguidores: any[]; seguidos: any[]; stats: { publicaciones: number; seguidores: number; seguidos: number }; siguiendo?: boolean; silenciado?: boolean };
const blank: ProfileData = { perfil: {}, publicaciones: [], eventos: [], favoritos: [], guardados: [], comunidad: [], seguidores: [], seguidos: [], stats: { publicaciones: 0, seguidores: 0, seguidos: 0 } };

function openProfileContent(item: { id?: number | string; backendId?: number | string; backend_id?: number | string; tipo?: string; guardadoTipo?: string }) {
  const id = item.backendId ?? item.backend_id ?? item.id;
  if (id === undefined || id === null || id === '') return;

  if ((item.guardadoTipo || item.tipo) === 'evento') {
    router.push({ pathname: '/', params: { eventId: String(id) } });
    return;
  }

  router.push({ pathname: '/discover', params: { reelId: String(id) } });
}

export function ProfileView({ identifier, own = false }: { identifier?: string; own?: boolean }) {
  const { token, user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const loadedOnce = useRef(false);
  const [data, setData] = useState<ProfileData>(blank);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'publicaciones' | 'eventos' | 'favoritos' | 'guardados' | 'comunidad'>('publicaciones');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nombre: '', bio: '' });
  const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [social, setSocial] = useState<'seguidores' | 'seguidos' | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [communityText, setCommunityText] = useState('');
  const [communityAttachment, setCommunityAttachment] = useState<CommunityAttachment | null>(null);
  const [attachmentPicker, setAttachmentPicker] = useState<'reel' | 'evento' | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [communityBusy, setCommunityBusy] = useState(false);
  const [communityReport, setCommunityReport] = useState<CommunityPost | null>(null);
  const [accountMenu, setAccountMenu] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { const result = await api<ProfileData>(own ? '/api/usuarios/me/perfil' : `/api/usuarios/${identifier}/perfil`, { token }); setData({ ...blank, ...result }); setForm({ nombre: result.perfil?.nombre || '', bio: result.perfil?.bio || '' }); setAvatarFailed(false); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el perfil.'); }
    finally { loadedOnce.current = true; setLoading(false); }
  }, [identifier, own, token]);
  useFocusEffect(useCallback(() => {
    const task = setTimeout(() => void load(loadedOnce.current), 0);
    return () => clearTimeout(task);
  }, [load]));

  function closeAccountMenu() { setAccountMenu(false); }
  function openAccountRoute(path: '/support' | '/settings') {
    closeAccountMenu();
    router.push(path);
  }
  async function logOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      closeAccountMenu();
      router.replace('/auth');
    } catch (e) {
      Alert.alert('No se pudo cerrar la sesión', e instanceof Error ? e.message : 'Intentá nuevamente.');
    } finally {
      setSigningOut(false);
    }
  }

  async function pickAvatar() { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .8, allowsEditing: true, aspect: [1, 1] }); if (!result.canceled) setAvatar(result.assets[0]); }
  async function save() {
    try {
      const body = new FormData(); body.append('nombre', form.nombre.trim()); body.append('bio', form.bio.trim()); if (avatar) body.append('avatar', mediaPart(avatar, 'avatar.jpg'));
      const profile = await api<any>('/api/usuarios/me/perfil', { method: 'PUT', token, body }); setData(current => ({ ...current, perfil: profile })); setAvatarFailed(false); setEditing(false); setAvatar(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
  }

  async function follow() { if (!identifier) return; try { const result = await api<any>(`/api/usuarios/${identifier}/seguir`, { method: 'POST', token }); const siguiendo = Boolean(result.siguiendo ?? result.following); const seguidores = Number(result.seguidores); setData(current => ({ ...current, siguiendo, stats: { ...current.stats, seguidores: Number.isFinite(seguidores) ? seguidores : Math.max(0, current.stats.seguidores + (siguiendo ? 1 : -1)) } })); } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo seguir.'); } }
  async function mute() { if (!identifier) return; try { const result = await api<any>(`/api/usuarios/${identifier}/silenciar-notificaciones`, { method: 'POST', token }); setData(current => ({ ...current, silenciado: result.silenciado ?? result.muted })); } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo actualizar.'); } }
  function block() { if (!identifier) return; Alert.alert('Bloquear cuenta', 'Dejarán de verse mutuamente en SONDAR.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Bloquear', style: 'destructive', onPress: () => api(`/api/usuarios/${identifier}/bloquear`, { method: 'POST', token }).then(() => router.replace('/')).catch(e => Alert.alert('Error', e.message)) }]); }
  function openMessages() {
    const recipient = profile.id || identifier;
    if (!recipient) return;
    router.push({ pathname: '/messages', params: { recipient, name: profile.nombre || 'Usuario SONDAR', handle: profile.usuario || '', avatar: profile.avatar || '' } });
  }
  async function report(payload: ReportPayload) {
    if (!identifier) return;
    setReportBusy(true);
    try {
      await api(`/api/usuarios/${identifier}/denunciar`, { method: 'POST', token, body: JSON.stringify(payload) });
      setReporting(false);
      Alert.alert('Listo', 'Denuncia enviada.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar la denuncia.');
    } finally {
      setReportBusy(false);
    }
  }

  async function publishCommunity() {
    if (!communityText.trim() && !communityAttachment) return;
    setCommunityBusy(true);
    try {
      const created = await api<CommunityPost>('/api/usuarios/me/comunidad', {
        method: 'POST', token,
        body: JSON.stringify({ texto: communityText.trim(), attachmentType: communityAttachment?.tipo, attachmentId: communityAttachment?.id }),
      });
      setData(current => ({ ...current, comunidad: [created, ...(current.comunidad || []).filter(item => item.id !== created.id)] }));
      setCommunityText(''); setCommunityAttachment(null); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo publicar la actualización.'); }
    finally { setCommunityBusy(false); }
  }

  async function commentCommunity(post: CommunityPost) {
    const texto = String(commentDrafts[post.id] || '').trim();
    if (!texto) return;
    try {
      const comment = await api<CommunityComment>(`/api/usuarios/comunidad/${post.id}/comentarios`, { method: 'POST', token, body: JSON.stringify({ texto }) });
      setData(current => ({ ...current, comunidad: current.comunidad.map(item => item.id === post.id ? { ...item, comentarios: [...(item.comentarios || []), comment] } : item) }));
      setCommentDrafts(current => ({ ...current, [post.id]: '' }));
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar la respuesta.'); }
  }

  function deleteCommunity(post: CommunityPost) {
    Alert.alert('Eliminar actualización', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => api(`/api/usuarios/comunidad/${post.id}`, { method: 'DELETE', token }).then(() => setData(current => ({ ...current, comunidad: current.comunidad.filter(item => item.id !== post.id) }))).catch(e => Alert.alert('Error', e.message)) },
    ]);
  }

  async function reportCommunity(payload: ReportPayload) {
    if (!communityReport) return;
    setReportBusy(true);
    try {
      await api(`/api/usuarios/comunidad/${communityReport.id}/denunciar`, { method: 'POST', token, body: JSON.stringify(payload) });
      setCommunityReport(null);
      Alert.alert('Listo', 'Denuncia enviada.');
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar la denuncia.'); }
    finally { setReportBusy(false); }
  }

  function chooseAttachment(type: 'reel' | 'evento', item: any) {
    setCommunityAttachment({
      tipo: type,
      id: Number(item.backendId || item.id),
      titulo: item.album || item.tema || item.titulo || item.nombre || (type === 'reel' ? 'Preview' : 'Evento'),
      detalle: item.genero || item.detalle || '',
      imagen: item.portada || item.imagen || item.img || item.img_url || '',
    });
    setAttachmentPicker(null);
  }

  const profile = data.perfil || {};
  const content = data[tab] || [];
  const isCommunity = tab === 'comunidad';
  const profileTabs = own
    ? ([['publicaciones', 'Previews', 'grid-outline'], ['eventos', 'Eventos', 'calendar-outline'], ['favoritos', 'Likes', 'heart-outline'], ['guardados', 'Guardados', 'bookmark-outline'], ['comunidad', 'Comunidad', 'people-outline']] as const)
    : ([['publicaciones', 'Previews', 'grid-outline'], ['eventos', 'Eventos', 'calendar-outline'], ['comunidad', 'Comunidad', 'people-outline']] as const);
  return (
    <Screen>
      <Header title={own ? 'Mi perfil' : profile.nombre || 'Perfil'} subtitle={profile.usuario} back={!own} actions={own ? <><IconButton name="chatbubbles-outline" onPress={() => router.push('/messages')} /><IconButton name="notifications-outline" onPress={() => router.push('/notifications')} /><Pressable accessibilityRole="button" accessibilityLabel="Abrir menú de cuenta" hitSlop={8} onPress={() => setAccountMenu(true)} style={({ pressed }) => [styles.accountTrigger, accountMenu && styles.accountTriggerActive, pressed && styles.pressed]}><Avatar uri={profile.avatar} name={profile.nombre || user?.email} size={30} /><Ionicons name="chevron-down" size={13} color={accountMenu ? palette.orange : palette.muted} /></Pressable></> : <><IconButton name="chatbubble-outline" onPress={openMessages} /><IconButton name="flag-outline" onPress={() => setReporting(true)} /><IconButton name="ellipsis-horizontal" onPress={() => Alert.alert('Opciones', undefined, [{ text: data.silenciado ? 'Activar notificaciones' : 'Silenciar notificaciones', onPress: mute }, { text: 'Bloquear', style: 'destructive', onPress: block }, { text: 'Cancelar', style: 'cancel' }])} /></>} />
      {loading ? <Loading /> : <FlatList key={`profile-${tab}`} data={content} keyExtractor={(item, index) => `${item.tipo}-${item.id}-${index}`} numColumns={isCommunity ? 1 : 2} contentContainerStyle={styles.content} columnWrapperStyle={!isCommunity && content.length > 1 ? styles.columns : undefined} ListHeaderComponent={<>
        <ErrorNotice message={error} />
        <View style={styles.profileTop}><Pressable disabled={!own} onPress={() => setEditing(true)} style={styles.profileAvatar}><Avatar uri={profile.avatar} name={profile.nombre} size={92} onError={() => setAvatarFailed(true)} />{own ? <View style={styles.profileCamera}><Ionicons name="camera" color="#111" size={16} /></View> : null}</Pressable><View style={{ flex: 1 }}><Text style={styles.name}>{profile.nombre || user?.email?.split('@')[0]}</Text><Text style={styles.handle}>{profile.usuario || `@${user?.user_metadata?.username || 'usuario'}`}</Text><Text style={styles.bio}>{profile.bio || 'Artista en SONDAR.'}</Text>{own && (!profile.avatar || avatarFailed) ? <Pressable onPress={() => setEditing(true)}><Text style={styles.avatarHelp}>Agregar nuevamente la foto</Text></Pressable> : null}</View></View>
        <View style={styles.stats}><Stat value={data.stats?.publicaciones || 0} label="Previews y eventos" /><Pressable onPress={() => setSocial('seguidores')}><Stat value={data.stats?.seguidores || 0} label="Seguidores" /></Pressable><Pressable onPress={() => setSocial('seguidos')}><Stat value={data.stats?.seguidos || 0} label="Seguidos" /></Pressable></View>
        <View style={styles.buttons}>{own ? <><View style={{ flex: 1 }}><Button onPress={() => setEditing(true)}>Editar perfil</Button></View><IconButton name="share-social-outline" onPress={() => Share.share({ message: `Encontrame en SONDAR como ${profile.usuario || profile.nombre}` })} /></> : <><View style={{ flex: 1 }}><Button onPress={follow}>{data.siguiendo ? 'Siguiendo' : 'Seguir'}</Button></View><IconButton name={data.silenciado ? 'notifications-off' : 'notifications-outline'} active={data.silenciado} onPress={mute} /></>}</View>
        <View style={styles.tabs}>{profileTabs.map(([id, label, icon]) => <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabActive]}><Ionicons name={icon} size={19} color={tab === id ? palette.orange : palette.muted} /><Text style={[styles.tabText, tab === id && { color: palette.orange }]}>{label}</Text></Pressable>)}</View>
        {own && isCommunity ? <View style={styles.communityComposer}>
          <View style={styles.composerTop}><Avatar uri={profile.avatar} name={profile.nombre} size={42} /><View style={{ flex: 1 }}><Field value={communityText} onChangeText={setCommunityText} placeholder="Compartir una actualización…" multiline maxLength={1000} /></View></View>
          {communityAttachment ? <View style={styles.selectedAttachment}><Ionicons name={communityAttachment.tipo === 'reel' ? 'musical-note' : 'calendar'} size={20} color={palette.amber} /><View style={{ flex: 1 }}><Text style={styles.attachmentTitle} numberOfLines={1}>{communityAttachment.titulo}</Text><Text style={ui.muted} numberOfLines={1}>{communityAttachment.detalle}</Text></View><Pressable onPress={() => setCommunityAttachment(null)}><Ionicons name="close-circle" size={22} color={palette.muted} /></Pressable></View> : null}
          <View style={styles.composerActions}><View style={styles.attachActions}><Pressable style={styles.attachButton} onPress={() => setAttachmentPicker('reel')}><Ionicons name="musical-note" size={18} color={palette.text} /><Text style={styles.attachButtonText}>Preview</Text></Pressable><Pressable style={styles.attachButton} onPress={() => setAttachmentPicker('evento')}><Ionicons name="calendar" size={18} color={palette.text} /><Text style={styles.attachButtonText}>Evento</Text></Pressable></View><Pressable disabled={communityBusy || (!communityText.trim() && !communityAttachment)} onPress={publishCommunity} style={[styles.publishCommunity, (communityBusy || (!communityText.trim() && !communityAttachment)) && styles.publishDisabled]}><Ionicons name="send" size={18} color="#111" /><Text style={styles.publishCommunityText}>{communityBusy ? 'Publicando…' : 'Publicar'}</Text></Pressable></View>
        </View> : null}
      </>} ListEmptyComponent={<Empty icon={isCommunity ? 'people-outline' : undefined} title={isCommunity ? 'Todavía no hay actividad' : `No hay ${tab} todavía`} text={isCommunity ? 'Las previews, eventos y actualizaciones aparecerán acá.' : undefined} />} renderItem={({ item }) => isCommunity ? <CommunityCard item={item as CommunityPost} currentUserId={user?.id} draft={commentDrafts[item.id] || ''} onDraft={value => setCommentDrafts(current => ({ ...current, [item.id]: value }))} onComment={() => commentCommunity(item)} onDelete={() => deleteCommunity(item)} onReport={() => setCommunityReport(item)} /> : <ContentCard item={item} />} />}

      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}><Screen scroll><Header title="Editar perfil" back onBack={() => setEditing(false)} actions={<IconButton name="close" onPress={() => setEditing(false)} />} /><ErrorNotice message={error} /><Pressable onPress={pickAvatar} style={styles.avatarEdit}><Avatar uri={avatar?.uri || profile.avatar} name={form.nombre} size={112} /><View style={styles.camera}><Ionicons name="camera" color="#111" size={20} /></View></Pressable><Text style={styles.avatarEditHint}>Tocá la foto para elegir una nueva</Text><Field label="Nombre visible" value={form.nombre} onChangeText={nombre => setForm(f => ({ ...f, nombre }))} maxLength={80} /><Field label="Biografía" value={form.bio} onChangeText={bio => setForm(f => ({ ...f, bio }))} multiline maxLength={300} /><Button onPress={save}>Guardar cambios</Button></Screen></Modal>

      <Modal visible={accountMenu} transparent animationType="fade" statusBarTranslucent onRequestClose={closeAccountMenu}>
        <View style={styles.accountOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú de cuenta" style={StyleSheet.absoluteFill} onPress={closeAccountMenu} />
          <View style={[styles.accountMenu, { top: Math.max(insets.top, 24) + 58 }]}>
            <AccountMenuItem icon="person-outline" label="Mi perfil" active onPress={() => { closeAccountMenu(); setTab('publicaciones'); }} />
            <AccountMenuItem icon="help-circle-outline" label="Soporte" onPress={() => openAccountRoute('/support')} />
            <AccountMenuItem icon="settings-outline" label="Configuración" onPress={() => openAccountRoute('/settings')} />
            <View style={styles.accountDivider} />
            <AccountMenuItem icon="log-out-outline" label={signingOut ? 'Cerrando…' : 'Cerrar sesión'} danger disabled={signingOut} onPress={() => void logOut()} />
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(social)} animationType="slide" transparent onRequestClose={() => setSocial(null)}><View style={styles.backdrop}><View style={styles.socialModal}><View style={styles.modalTop}><Text style={ui.h2}>{social === 'seguidores' ? 'Seguidores' : 'Seguidos'}</Text><IconButton name="close" onPress={() => setSocial(null)} /></View><FlatList data={social ? data[social] || [] : []} keyExtractor={item => item.id} ListEmptyComponent={<Empty title="La lista está vacía" />} renderItem={({ item }) => <Pressable style={styles.person} onPress={() => { setSocial(null); if (item.id !== user?.id) router.push({ pathname: '/profile/[id]', params: { id: item.id } }); }}><Avatar uri={item.avatar} name={item.nombre || item.username} /><View style={{ flex: 1 }}><Text style={ui.text}>{item.nombre || item.username}</Text><Text style={ui.muted}>@{String(item.usuario || item.username).replace(/^@/, '')}</Text></View><Ionicons name="chevron-forward" color={palette.muted} size={20} /></Pressable>} /></View></View></Modal>

      <Modal visible={Boolean(attachmentPicker)} animationType="slide" transparent onRequestClose={() => setAttachmentPicker(null)}><View style={styles.backdrop}><View style={styles.attachmentModal}><View style={styles.modalTop}><View><Text style={styles.modalKicker}>ADJUNTAR</Text><Text style={ui.h2}>{attachmentPicker === 'reel' ? 'Elegí una preview' : 'Elegí un evento'}</Text></View><IconButton name="close" onPress={() => setAttachmentPicker(null)} /></View><FlatList data={attachmentPicker === 'reel' ? data.publicaciones : data.eventos} keyExtractor={item => String(item.id)} contentContainerStyle={{ gap: 9 }} ListEmptyComponent={<Empty title={attachmentPicker === 'reel' ? 'Todavía no publicaste previews' : 'Todavía no creaste eventos'} />} renderItem={({ item }) => <Pressable style={styles.attachmentOption} onPress={() => chooseAttachment(attachmentPicker || 'reel', item)}>{item.portada || item.imagen || item.img || item.img_url ? <Image source={{ uri: item.portada || item.imagen || item.img || item.img_url }} style={styles.attachmentImage} contentFit="cover" /> : <View style={[styles.attachmentImage, styles.contentFallback]}><Ionicons name={attachmentPicker === 'reel' ? 'musical-note' : 'calendar'} size={24} color={palette.orange} /></View>}<View style={{ flex: 1 }}><Text style={styles.attachmentTitle}>{item.album || item.tema || item.titulo || item.nombre}</Text><Text style={ui.muted}>{item.genero || item.detalle}</Text></View><Ionicons name="add-circle" size={25} color={palette.orange} /></Pressable>} /></View></View></Modal>
      <ReportModal visible={reporting} subject={profile.usuario || profile.nombre} busy={reportBusy} onClose={() => setReporting(false)} onSubmit={report} />
      <ReportModal visible={Boolean(communityReport)} subject={communityReport?.nombre || communityReport?.usuario} busy={reportBusy} onClose={() => setCommunityReport(null)} onSubmit={reportCommunity} />
    </Screen>
  );
}

function AccountMenuItem({ icon, label, onPress, active = false, danger = false, disabled = false }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; active?: boolean; danger?: boolean; disabled?: boolean }) {
  const color = danger ? palette.danger : active ? palette.orange : palette.text;
  return <Pressable accessibilityRole="menuitem" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.accountMenuItem, active && styles.accountMenuItemActive, disabled && styles.accountMenuItemDisabled, pressed && styles.pressed]}><Ionicons name={icon} size={21} color={color} /><Text style={[styles.accountMenuLabel, { color }]}>{label}</Text>{active ? <Ionicons name="checkmark" size={18} color={palette.orange} /> : null}</Pressable>;
}

function CommunityCard({ item, currentUserId, draft, onDraft, onComment, onDelete, onReport }: { item: CommunityPost; currentUserId?: string; draft: string; onDraft: (value: string) => void; onComment: () => void; onDelete: () => void; onReport: () => void }) {
  const ownPost = Boolean(currentUserId && item.userId === currentUserId);
  return <View style={styles.communityPost}>
    <View style={styles.communityPostHeader}><Avatar uri={item.avatar} name={item.nombre || item.usuario} size={42} /><View style={{ flex: 1 }}><View style={styles.communityIdentity}><Text style={styles.communityName}>{item.nombre || String(item.usuario || '').replace(/^@/, '')}</Text><Text style={styles.communityBadge}>ACTIVIDAD</Text></View><Text style={styles.communityMeta}>{item.usuario} · {item.tiempo || 'ahora'}</Text></View>{ownPost && !item.adjunto ? <IconButton name="trash-outline" danger onPress={onDelete} /> : !ownPost ? <IconButton name="flag-outline" onPress={onReport} /> : null}</View>
    {item.texto ? <Text style={styles.communityText}>{item.texto}</Text> : null}
    {item.adjunto ? <Pressable style={styles.communityAttachment} onPress={() => item.adjunto && openProfileContent(item.adjunto)}>{item.adjunto.imagen ? <Image source={{ uri: item.adjunto.imagen }} style={styles.communityAttachmentImage} contentFit="cover" /> : <View style={[styles.communityAttachmentImage, styles.contentFallback]}><Ionicons name={item.adjunto.tipo === 'evento' ? 'calendar' : 'musical-note'} size={25} color={palette.orange} /></View>}<View style={{ flex: 1 }}><Text style={styles.communityAttachmentType}>{item.adjunto.tipo === 'evento' ? 'EVENTO' : 'PREVIEW'}</Text><Text style={styles.attachmentTitle} numberOfLines={1}>{item.adjunto.titulo}</Text><Text style={ui.muted} numberOfLines={1}>{item.adjunto.detalle}</Text></View><Ionicons name="arrow-forward" size={22} color={palette.text} /></Pressable> : null}
    {(item.comentarios || []).map(comment => <View key={comment.id} style={styles.communityComment}><Avatar uri={comment.avatar} name={comment.nombre || comment.usuario} size={30} /><View style={{ flex: 1 }}><Text style={styles.commentAuthor}>{comment.nombre || comment.usuario} <Text style={styles.commentTime}>{comment.tiempo}</Text></Text><Text style={styles.commentText}>{comment.texto}</Text></View></View>)}
    <View style={styles.communityReply}><View style={{ flex: 1 }}><Field value={draft} onChangeText={onDraft} placeholder="Responder…" maxLength={500} /></View><IconButton name="send" active onPress={onComment} /></View>
  </View>;
}

function Stat({ value, label }: { value: number; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{new Intl.NumberFormat('es-AR', { notation: 'compact' }).format(value)}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function ContentCard({ item }: { item: any }) { const image = item.imagen || item.portada || item.img; return <Pressable style={styles.contentCard} onPress={() => openProfileContent(item)}>{image ? <Image source={{ uri: image }} style={styles.contentImage} contentFit="cover" /> : <View style={[styles.contentImage, styles.contentFallback]}><Ionicons name={item.tipo === 'evento' ? 'calendar' : 'musical-note'} color={palette.orange} size={28} /></View>}<Text style={styles.contentTitle} numberOfLines={1}>{item.nombre || item.titulo || item.tema}</Text><Text style={ui.muted} numberOfLines={1}>{item.detalle || item.genero || item.tipo}</Text></Pressable>; }

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 110, gap: 12 }, columns: { gap: 11 }, profileTop: { flexDirection: 'row', alignItems: 'center', gap: 17, paddingVertical: 10 }, name: { color: palette.text, fontSize: 23, fontWeight: '900' }, handle: { color: palette.orange, fontWeight: '700', marginTop: 2 }, bio: { color: '#D4D5D9', lineHeight: 19, marginTop: 7 },
  accountTrigger: { minWidth: 50, height: 40, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 8, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, accountTriggerActive: { borderColor: palette.orange, backgroundColor: '#24140A' }, pressed: { opacity: .72 },
  accountOverlay: { flex: 1, backgroundColor: '#0004' }, accountMenu: { position: 'absolute', right: 14, width: 225, padding: 7, borderRadius: 12, backgroundColor: '#111113', borderWidth: 1, borderColor: '#3A3A3E', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: .42, shadowRadius: 16, elevation: 14 }, accountMenuItem: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 8 }, accountMenuItemActive: { backgroundColor: '#261607' }, accountMenuItemDisabled: { opacity: .55 }, accountMenuLabel: { flex: 1, fontSize: 15, fontWeight: '700' }, accountDivider: { height: StyleSheet.hairlineWidth, marginVertical: 5, marginHorizontal: 7, backgroundColor: palette.border },
  stats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, backgroundColor: palette.surface, borderRadius: 17, borderWidth: 1, borderColor: palette.border }, stat: { alignItems: 'center', minWidth: 80 }, statValue: { color: palette.text, fontSize: 19, fontWeight: '900' }, statLabel: { color: palette.muted, fontSize: 11, marginTop: 3 }, buttons: { flexDirection: 'row', gap: 9, marginVertical: 13 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: palette.border, marginBottom: 13 }, tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 11 }, tabActive: { borderBottomWidth: 2, borderBottomColor: palette.orange }, tabText: { color: palette.muted, fontSize: 10, fontWeight: '700' },
  contentCard: { flex: 1, maxWidth: '49%', padding: 9, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, contentImage: { width: '100%', aspectRatio: 1, borderRadius: 12, marginBottom: 8 }, contentFallback: { backgroundColor: palette.surface2, alignItems: 'center', justifyContent: 'center' }, contentTitle: { color: palette.text, fontWeight: '800', marginBottom: 3 },
  profileAvatar: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }, profileCamera: { position: 'absolute', right: 1, bottom: 1, width: 30, height: 30, borderRadius: 15, backgroundColor: palette.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: palette.bg }, avatarHelp: { color: palette.orange, fontSize: 12, fontWeight: '800', marginTop: 8 },
  avatarEdit: { alignSelf: 'center', marginTop: 10 }, avatarEditHint: { color: palette.orange, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: -4, marginBottom: 6 }, camera: { position: 'absolute', right: 0, bottom: 0, width: 37, height: 37, borderRadius: 19, backgroundColor: palette.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: palette.bg },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A' }, socialModal: { height: '70%', padding: 17, backgroundColor: palette.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26 }, modalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, person: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: palette.border },
  communityComposer: { gap: 12, padding: 13, marginBottom: 5, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, composerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, composerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, attachActions: { flexDirection: 'row', gap: 8 }, attachButton: { minHeight: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, backgroundColor: palette.surface2, borderWidth: 1, borderColor: palette.border }, attachButtonText: { color: palette.text, fontSize: 12, fontWeight: '800' }, publishCommunity: { minHeight: 42, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 8, backgroundColor: palette.amber }, publishCommunityText: { color: '#111', fontWeight: '900' }, publishDisabled: { opacity: .4 }, selectedAttachment: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, backgroundColor: '#241506', borderWidth: 1, borderColor: '#6A3B08' },
  communityPost: { width: '100%', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: palette.border }, communityPostHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, communityIdentity: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, communityName: { color: palette.text, fontWeight: '900' }, communityBadge: { color: palette.orange, fontSize: 9, fontWeight: '900' }, communityMeta: { color: palette.muted, fontSize: 11, marginTop: 2 }, communityText: { color: palette.text, fontSize: 15, lineHeight: 21 }, communityAttachment: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 10, borderRadius: 10, backgroundColor: palette.surface, borderWidth: 1, borderColor: '#68400C' }, communityAttachmentImage: { width: 60, height: 60, borderRadius: 7 }, communityAttachmentType: { color: palette.muted, fontSize: 9, fontWeight: '900' }, communityComment: { flexDirection: 'row', gap: 8, marginLeft: 14 }, commentAuthor: { color: palette.text, fontSize: 12, fontWeight: '800' }, commentTime: { color: palette.muted, fontSize: 10, fontWeight: '500' }, commentText: { color: '#E5E5E7', fontSize: 13, lineHeight: 18, marginTop: 2 }, communityReply: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attachmentModal: { height: '72%', padding: 17, backgroundColor: palette.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26 }, modalKicker: { color: palette.orange, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 3 }, attachmentOption: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 10, borderRadius: 9, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, attachmentImage: { width: 52, height: 52, borderRadius: 7 }, attachmentTitle: { color: palette.text, fontWeight: '900' },
});
