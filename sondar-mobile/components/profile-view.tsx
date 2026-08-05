import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';
import { api, mediaPart } from '@/lib/api';
import { Avatar, Button, Empty, ErrorNotice, Field, Header, IconButton, Loading, Screen, ui } from './sondar-ui';

type ProfileData = { perfil: any; publicaciones: any[]; eventos: any[]; favoritos: any[]; guardados: any[]; seguidores: any[]; seguidos: any[]; stats: { publicaciones: number; seguidores: number; seguidos: number }; siguiendo?: boolean; silenciado?: boolean };
const blank: ProfileData = { perfil: {}, publicaciones: [], eventos: [], favoritos: [], guardados: [], seguidores: [], seguidos: [], stats: { publicaciones: 0, seguidores: 0, seguidos: 0 } };

export function ProfileView({ identifier, own = false }: { identifier?: string; own?: boolean }) {
  const { token, user } = useAuth();
  const [data, setData] = useState<ProfileData>(blank);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'publicaciones' | 'eventos' | 'favoritos' | 'guardados'>('publicaciones');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nombre: '', bio: '' });
  const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [social, setSocial] = useState<'seguidores' | 'seguidos' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await api<ProfileData>(own ? '/api/usuarios/me/perfil' : `/api/usuarios/${identifier}/perfil`, { token }); setData({ ...blank, ...result }); setForm({ nombre: result.perfil?.nombre || '', bio: result.perfil?.bio || '' }); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el perfil.'); }
    finally { setLoading(false); }
  }, [identifier, own, token]);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  async function pickAvatar() { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .8, allowsEditing: true, aspect: [1, 1] }); if (!result.canceled) setAvatar(result.assets[0]); }
  async function save() {
    try {
      const body = new FormData(); body.append('nombre', form.nombre.trim()); body.append('bio', form.bio.trim()); if (avatar) body.append('avatar', mediaPart(avatar, 'avatar.jpg'));
      const profile = await api<any>('/api/usuarios/me/perfil', { method: 'PUT', token, body }); setData(current => ({ ...current, perfil: profile })); setEditing(false); setAvatar(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
  }

  async function follow() { if (!identifier) return; try { const result = await api<any>(`/api/usuarios/${identifier}/seguir`, { method: 'POST', token }); const siguiendo = Boolean(result.siguiendo ?? result.following); const seguidores = Number(result.seguidores); setData(current => ({ ...current, siguiendo, stats: { ...current.stats, seguidores: Number.isFinite(seguidores) ? seguidores : Math.max(0, current.stats.seguidores + (siguiendo ? 1 : -1)) } })); } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo seguir.'); } }
  async function mute() { if (!identifier) return; try { const result = await api<any>(`/api/usuarios/${identifier}/silenciar-notificaciones`, { method: 'POST', token }); setData(current => ({ ...current, silenciado: result.silenciado ?? result.muted })); } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo actualizar.'); } }
  function block() { if (!identifier) return; Alert.alert('Bloquear cuenta', 'Dejarán de verse mutuamente en SONDAR.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Bloquear', style: 'destructive', onPress: () => api(`/api/usuarios/${identifier}/bloquear`, { method: 'POST', token }).then(() => router.replace('/')).catch(e => Alert.alert('Error', e.message)) }]); }
  function report() { if (!identifier) return; Alert.alert('Denunciar perfil', 'El equipo de moderación revisará esta cuenta.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Denunciar', style: 'destructive', onPress: () => api(`/api/usuarios/${identifier}/denunciar`, { method: 'POST', token, body: JSON.stringify({ reason: 'perfil_inapropiado', detail: 'Denuncia desde móvil' }) }).then(() => Alert.alert('Listo', 'Denuncia enviada.')).catch(e => Alert.alert('Error', e.message)) }]); }

  const profile = data.perfil || {};
  const content = data[tab] || [];
  return (
    <Screen>
      <Header title={own ? 'Mi perfil' : profile.nombre || 'Perfil'} subtitle={profile.usuario} back={!own} actions={own ? <><IconButton name="notifications-outline" onPress={() => router.push('/notifications')} /><IconButton name="settings-outline" onPress={() => router.push('/settings')} /></> : <IconButton name="ellipsis-horizontal" onPress={() => Alert.alert('Opciones', undefined, [{ text: data.silenciado ? 'Activar notificaciones' : 'Silenciar notificaciones', onPress: mute }, { text: 'Denunciar', onPress: report }, { text: 'Bloquear', style: 'destructive', onPress: block }, { text: 'Cancelar', style: 'cancel' }])} /> } />
      {loading ? <Loading /> : <FlatList data={content} keyExtractor={(item, index) => `${item.tipo}-${item.id}-${index}`} numColumns={2} contentContainerStyle={styles.content} columnWrapperStyle={content.length > 1 ? styles.columns : undefined} ListHeaderComponent={<>
        <ErrorNotice message={error} />
        <View style={styles.profileTop}><Avatar uri={profile.avatar} name={profile.nombre} size={92} /><View style={{ flex: 1 }}><Text style={styles.name}>{profile.nombre || user?.email?.split('@')[0]}</Text><Text style={styles.handle}>{profile.usuario || `@${user?.user_metadata?.username || 'usuario'}`}</Text><Text style={styles.bio}>{profile.bio || 'Artista en SONDAR.'}</Text></View></View>
        <View style={styles.stats}><Stat value={data.stats?.publicaciones || 0} label="Publicaciones" /><Pressable onPress={() => setSocial('seguidores')}><Stat value={data.stats?.seguidores || 0} label="Seguidores" /></Pressable><Pressable onPress={() => setSocial('seguidos')}><Stat value={data.stats?.seguidos || 0} label="Seguidos" /></Pressable></View>
        <View style={styles.buttons}>{own ? <><View style={{ flex: 1 }}><Button onPress={() => setEditing(true)}>Editar perfil</Button></View><IconButton name="share-social-outline" onPress={() => Share.share({ message: `Encontrame en SONDAR como ${profile.usuario || profile.nombre}` })} /></> : <><View style={{ flex: 1 }}><Button onPress={follow}>{data.siguiendo ? 'Siguiendo' : 'Seguir'}</Button></View><IconButton name={data.silenciado ? 'notifications-off' : 'notifications-outline'} active={data.silenciado} onPress={mute} /></>}</View>
        <View style={styles.tabs}>{([['publicaciones', 'Música', 'grid-outline'], ['eventos', 'Eventos', 'calendar-outline'], ['favoritos', 'Favoritos', 'heart-outline'], ['guardados', 'Guardado', 'bookmark-outline']] as const).map(([id, label, icon]) => <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabActive]}><Ionicons name={icon} size={19} color={tab === id ? palette.orange : palette.muted} /><Text style={[styles.tabText, tab === id && { color: palette.orange }]}>{label}</Text></Pressable>)}</View>
      </>} ListEmptyComponent={<Empty title={`No hay ${tab} todavía`} />} renderItem={({ item }) => <ContentCard item={item} />} />}

      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}><Screen scroll><Header title="Editar perfil" back onBack={() => setEditing(false)} actions={<IconButton name="close" onPress={() => setEditing(false)} />} /><ErrorNotice message={error} /><Pressable onPress={pickAvatar} style={styles.avatarEdit}><Avatar uri={avatar?.uri || profile.avatar} name={form.nombre} size={112} /><View style={styles.camera}><Ionicons name="camera" color="#111" size={20} /></View></Pressable><Field label="Nombre visible" value={form.nombre} onChangeText={nombre => setForm(f => ({ ...f, nombre }))} maxLength={80} /><Field label="Biografía" value={form.bio} onChangeText={bio => setForm(f => ({ ...f, bio }))} multiline maxLength={300} /><Button onPress={save}>Guardar cambios</Button></Screen></Modal>

      <Modal visible={Boolean(social)} animationType="slide" transparent onRequestClose={() => setSocial(null)}><View style={styles.backdrop}><View style={styles.socialModal}><View style={styles.modalTop}><Text style={ui.h2}>{social === 'seguidores' ? 'Seguidores' : 'Seguidos'}</Text><IconButton name="close" onPress={() => setSocial(null)} /></View><FlatList data={social ? data[social] || [] : []} keyExtractor={item => item.id} ListEmptyComponent={<Empty title="La lista está vacía" />} renderItem={({ item }) => <Pressable style={styles.person} onPress={() => { setSocial(null); if (item.id !== user?.id) router.push({ pathname: '/profile/[id]', params: { id: item.id } }); }}><Avatar uri={item.avatar} name={item.nombre || item.username} /><View style={{ flex: 1 }}><Text style={ui.text}>{item.nombre || item.username}</Text><Text style={ui.muted}>@{String(item.usuario || item.username).replace(/^@/, '')}</Text></View><Ionicons name="chevron-forward" color={palette.muted} size={20} /></Pressable>} /></View></View></Modal>
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{new Intl.NumberFormat('es-AR', { notation: 'compact' }).format(value)}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function ContentCard({ item }: { item: any }) { const image = item.imagen || item.portada || item.img; return <Pressable style={styles.contentCard} onPress={() => item.tipo === 'evento' ? router.push('/') : router.push('/discover')}>{image ? <Image source={{ uri: image }} style={styles.contentImage} contentFit="cover" /> : <View style={[styles.contentImage, styles.contentFallback]}><Ionicons name={item.tipo === 'evento' ? 'calendar' : 'musical-note'} color={palette.orange} size={28} /></View>}<Text style={styles.contentTitle} numberOfLines={1}>{item.nombre || item.titulo || item.tema}</Text><Text style={ui.muted} numberOfLines={1}>{item.detalle || item.genero || item.tipo}</Text></Pressable>; }

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 110, gap: 12 }, columns: { gap: 11 }, profileTop: { flexDirection: 'row', alignItems: 'center', gap: 17, paddingVertical: 10 }, name: { color: palette.text, fontSize: 23, fontWeight: '900' }, handle: { color: palette.orange, fontWeight: '700', marginTop: 2 }, bio: { color: '#D4D5D9', lineHeight: 19, marginTop: 7 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, backgroundColor: palette.surface, borderRadius: 17, borderWidth: 1, borderColor: palette.border }, stat: { alignItems: 'center', minWidth: 80 }, statValue: { color: palette.text, fontSize: 19, fontWeight: '900' }, statLabel: { color: palette.muted, fontSize: 11, marginTop: 3 }, buttons: { flexDirection: 'row', gap: 9, marginVertical: 13 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: palette.border, marginBottom: 13 }, tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 11 }, tabActive: { borderBottomWidth: 2, borderBottomColor: palette.orange }, tabText: { color: palette.muted, fontSize: 10, fontWeight: '700' },
  contentCard: { flex: 1, maxWidth: '49%', padding: 9, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, contentImage: { width: '100%', aspectRatio: 1, borderRadius: 12, marginBottom: 8 }, contentFallback: { backgroundColor: palette.surface2, alignItems: 'center', justifyContent: 'center' }, contentTitle: { color: palette.text, fontWeight: '800', marginBottom: 3 },
  avatarEdit: { alignSelf: 'center', marginVertical: 10 }, camera: { position: 'absolute', right: 0, bottom: 0, width: 37, height: 37, borderRadius: 19, backgroundColor: palette.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: palette.bg },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A' }, socialModal: { height: '70%', padding: 17, backgroundColor: palette.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26 }, modalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, person: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: palette.border },
});
