import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, Empty, ErrorNotice, Header, Loading, Screen, ui } from '@/components/sondar-ui';
import { palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';
import { api } from '@/lib/api';

type Notification = { id: number; title: string; body?: string; type?: string; target_url?: string; actor_name?: string; actor_avatar?: string; created_at: string; read_at?: string | null };

export default function NotificationsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); try { const result = await api<{ items: Notification[] }>('/api/notificaciones?limit=80', { token }); setItems(result.items); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar.'); } finally { setLoading(false); } }, [token]);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  async function open(item: Notification) {
    if (!item.read_at) { await api(`/api/notificaciones/${item.id}/leer`, { method: 'POST', token }).catch(() => null); setItems(current => current.map(n => n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)); }
    const target = item.target_url || '';
    if (target.startsWith('/perfil/')) router.push({ pathname: '/profile/[id]', params: { id: target.split('/')[2] } });
    else if (target.startsWith('/descubrir')) router.push('/discover');
    else if (target.startsWith('/comunidad')) router.push('/community');
    else router.push('/');
  }
  async function readAll() { await api('/api/notificaciones/leer-todas', { method: 'POST', token }); setItems(current => current.map(item => ({ ...item, read_at: item.read_at || new Date().toISOString() }))); }
  function clean() { Alert.alert('Limpiar notificaciones', 'Se eliminarán todas las notificaciones ya leídas.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Limpiar', style: 'destructive', onPress: () => api('/api/notificaciones/leidas', { method: 'DELETE', token }).then(() => setItems(current => current.filter(item => !item.read_at))).catch(e => Alert.alert('Error', e.message)) }]); }
  return <Screen><Header title="Notificaciones" subtitle={`${items.filter(x => !x.read_at).length} sin leer`} back /><View style={styles.actions}><Button kind="ghost" icon="checkmark-done" onPress={readAll}>Marcar leídas</Button><Button kind="ghost" icon="trash-outline" onPress={clean}>Limpiar</Button></View><ErrorNotice message={error} />{loading ? <Loading /> : <FlatList data={items} keyExtractor={item => String(item.id)} contentContainerStyle={styles.list} refreshing={loading} onRefresh={load} ListEmptyComponent={<Empty icon="notifications-outline" title="Estás al día" text="Acá vas a ver seguidores, comentarios, menciones y novedades." />} renderItem={({ item }) => <Pressable onPress={() => open(item)} style={[styles.item, !item.read_at && styles.unread]}><Avatar uri={item.actor_avatar} name={item.actor_name || 'S'} size={48} /><View style={{ flex: 1 }}><Text style={styles.title}>{item.title}</Text>{item.body ? <Text style={styles.body}>{item.body}</Text> : null}<Text style={ui.muted}>{new Date(item.created_at).toLocaleString('es-AR')}</Text></View>{!item.read_at ? <View style={styles.dot} /> : <Ionicons name="chevron-forward" color={palette.muted} size={19} />}</Pressable>} />}</Screen>;
}
const styles = StyleSheet.create({ actions: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 10 }, list: { padding: 14, paddingBottom: 50, gap: 9 }, item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 17, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, unread: { borderColor: '#8A4B12', backgroundColor: '#20170F' }, title: { color: palette.text, fontWeight: '800', marginBottom: 4 }, body: { color: '#D2D3D6', lineHeight: 19, marginBottom: 5 }, dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.orange } });
