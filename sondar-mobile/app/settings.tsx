import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';

import { Avatar, Button, ErrorNotice, Field, Header, IconButton, Loading, Screen, ui } from '@/components/sondar-ui';
import { palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const defaults: Record<string, any> = { telefono: '', codigoPais: '+54', idioma: 'es', actividadCuenta: true, notificarInteracciones: true, notificarComentarios: true, notificarSeguidores: true, notificarPublicaciones: true, notificarMenciones: true, reducirMovimiento: false, mostrarEmail: false };

export default function SettingsScreen() {
  const { token, user, signOut } = useAuth();
  const [settings, setSettings] = useState(defaults);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [accountProfile, setAccountProfile] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [configResult, blockedResult, profileResult] = await Promise.allSettled([
      api<Record<string, any>>('/api/usuarios/me/configuracion', { token }),
      api<any[]>('/api/usuarios/me/bloqueados', { token }),
      api<{ perfil?: any }>('/api/usuarios/me/perfil', { token }),
    ]);

    if (configResult.status === 'fulfilled') setSettings({ ...defaults, ...configResult.value });
    if (blockedResult.status === 'fulfilled') setBlocked(blockedResult.value);
    if (profileResult.status === 'fulfilled') setAccountProfile(profileResult.value.perfil || {});

    const primaryError = configResult.status === 'rejected'
      ? configResult.reason
      : profileResult.status === 'rejected'
        ? profileResult.reason
        : null;
    setError(primaryError instanceof Error ? primaryError.message : primaryError ? 'Algunos datos no se pudieron cargar.' : '');
    setLoading(false);
  }, [token]);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);
  async function save() { setSaving(true); try { const result = await api('/api/usuarios/me/configuracion', { method: 'PUT', token, body: JSON.stringify(settings) }); setSettings({ ...defaults, ...result }); Alert.alert('Listo', 'Configuración guardada.'); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); } finally { setSaving(false); } }
  async function changePassword() { if (password.length < 8 || password !== repeat) return setError('La contraseña debe tener al menos 8 caracteres y ambas deben coincidir.'); const { error: authError } = await supabase.auth.updateUser({ password }); if (authError) return setError(authError.message); setPassword(''); setRepeat(''); Alert.alert('Listo', 'Contraseña actualizada.'); }
  async function exportData() { try { const data = await api('/api/usuarios/me/exportar', { token }); await Share.share({ title: 'Mis datos de SONDAR', message: JSON.stringify(data, null, 2) }); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron exportar los datos.'); } }
  async function confirmDeleteAccount() {
    if (!deletePassword) {
      setError('Ingresá tu contraseña actual para confirmar.');
      return;
    }
    setDeleting(true);
    try {
      const email = user?.email;
      if (!email) throw new Error('No pudimos identificar el email de la cuenta.');
      const { error: verificationError } = await supabase.auth.signInWithPassword({ email, password: deletePassword });
      if (verificationError) throw new Error('La contraseña ingresada no es correcta.');
      await api('/api/usuarios/me', { method: 'DELETE', token });
      setDeleteOpen(false);
      setDeletePassword('');
      await signOut();
      router.replace('/auth');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar la cuenta.');
    } finally {
      setDeleting(false);
    }
  }
  function deleteAccount() { setError(''); setDeletePassword(''); setDeleteOpen(true); }
  async function unblock(item: any) { try { await api(`/api/usuarios/${item.id}/bloquear`, { method: 'DELETE', token }); setBlocked(current => current.filter(x => x.id !== item.id)); } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo desbloquear.'); } }
  if (loading) return <Screen><Header title="Configuración" back /><Loading /></Screen>;
  return <Screen scroll><Header title="Configuración" subtitle="Cuenta, privacidad y experiencia" back /><ErrorNotice message={error} />
    <View style={styles.account}><Avatar uri={accountProfile.avatar} name={accountProfile.nombre || settings.username || user?.email} size={58} /><View style={{ flex: 1 }}><Text style={ui.h2}>{accountProfile.usuario || `@${settings.username || user?.user_metadata?.username || 'usuario'}`}</Text><Text style={ui.muted}>{user?.email}</Text></View></View>
    <Section icon="person-outline" title="Datos de la cuenta"><Field label="Teléfono" keyboardType="phone-pad" value={settings.telefono} onChangeText={telefono => setSettings((s: any) => ({ ...s, telefono: telefono.replace(/\D/g, '').slice(0, 18) }))} placeholder="11 1234 5678" /><Text style={styles.label}>Idioma</Text><View style={styles.choices}>{[['es', 'Español'], ['en', 'English'], ['pt', 'Português']].map(([id, label]) => <Pressable key={id} onPress={() => setSettings((s: any) => ({ ...s, idioma: id }))} style={[styles.choice, settings.idioma === id && styles.choiceActive]}><Text style={[styles.choiceText, settings.idioma === id && { color: '#111' }]}>{label}</Text></Pressable>)}</View></Section>
    <Section icon="notifications-outline" title="Notificaciones"><Toggle title="Actividad en la cuenta" value={settings.actividadCuenta} onChange={value => setSettings((s: any) => ({ ...s, actividadCuenta: value }))} /><Toggle title="Me gusta y reacciones" value={settings.notificarInteracciones} onChange={value => setSettings((s: any) => ({ ...s, notificarInteracciones: value }))} /><Toggle title="Comentarios y respuestas" value={settings.notificarComentarios} onChange={value => setSettings((s: any) => ({ ...s, notificarComentarios: value }))} /><Toggle title="Nuevos seguidores" value={settings.notificarSeguidores} onChange={value => setSettings((s: any) => ({ ...s, notificarSeguidores: value }))} /><Toggle title="Publicaciones de seguidos" value={settings.notificarPublicaciones} onChange={value => setSettings((s: any) => ({ ...s, notificarPublicaciones: value }))} /><Toggle title="Menciones e invitaciones" value={settings.notificarMenciones} onChange={value => setSettings((s: any) => ({ ...s, notificarMenciones: value }))} /></Section>
    <Section icon="shield-checkmark-outline" title="Privacidad"><Toggle title="Mostrar email de contacto" value={settings.mostrarEmail} onChange={value => setSettings((s: any) => ({ ...s, mostrarEmail: value }))} /><Toggle title="Reducir movimiento" value={settings.reducirMovimiento} onChange={value => setSettings((s: any) => ({ ...s, reducirMovimiento: value }))} />{blocked.length ? <><Text style={styles.label}>Cuentas bloqueadas</Text>{blocked.map(item => <View key={item.id} style={styles.blocked}><Avatar uri={item.avatar} name={item.nombre} size={38} /><Text style={[ui.text, { flex: 1 }]}>{item.nombre || item.username}</Text><Button kind="ghost" onPress={() => unblock(item)}>Desbloquear</Button></View>)}</> : <Text style={ui.muted}>No bloqueaste ninguna cuenta.</Text>}</Section>
    <Button onPress={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar configuración'}</Button>
    <Section icon="key-outline" title="Seguridad"><Field label="Nueva contraseña" secureTextEntry value={password} onChangeText={setPassword} /><Field label="Repetir contraseña" secureTextEntry value={repeat} onChangeText={setRepeat} /><Button kind="secondary" onPress={changePassword}>Cambiar contraseña</Button></Section>
    <Section icon="folder-outline" title="Tus datos"><Button kind="secondary" icon="share-outline" onPress={exportData}>Exportar mis datos</Button><Button kind="secondary" icon="help-circle-outline" onPress={() => router.push('/support')}>Centro de soporte</Button></Section>
    <Section icon="warning-outline" title="Zona de cuenta"><Button kind="secondary" icon="log-out-outline" onPress={async () => { await signOut(); router.replace('/auth'); }}>Cerrar sesión</Button><Button kind="danger" icon="trash-outline" onPress={deleteAccount} disabled={deleting}>{deleting ? 'Eliminando...' : 'Eliminar cuenta'}</Button></Section>
    <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.deleteBackdrop}>
        <View style={styles.deleteCard}>
          <View style={styles.deleteTop}><View style={{ flex: 1 }}><Text style={styles.deleteKicker}>ZONA DE CUENTA</Text><Text style={styles.deleteTitle}>Eliminar cuenta permanentemente</Text></View><IconButton name="close" onPress={() => setDeleteOpen(false)} /></View>
          <Text style={styles.deleteCopy}>Esta acción no se puede deshacer. Se eliminarán tu perfil, previews, eventos, comentarios, guardados y archivos publicados.</Text>
          <Field label="Ingresá tu contraseña para confirmar" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry placeholder="Contraseña actual" />
          <View style={styles.deleteActions}><View style={{ flex: 1 }}><Button kind="secondary" onPress={() => setDeleteOpen(false)}>Cancelar</Button></View><View style={{ flex: 1.35 }}><Button kind="danger" icon="trash-outline" onPress={() => void confirmDeleteAccount()} disabled={!deletePassword || deleting}>{deleting ? 'Eliminando…' : 'Eliminar definitivamente'}</Button></View></View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </Screen>;
}

function Section({ icon, title, children }: React.PropsWithChildren<{ icon: React.ComponentProps<typeof Ionicons>['name']; title: string }>) { return <View style={styles.section}><View style={styles.sectionTitle}><Ionicons name={icon} color={palette.orange} size={22} /><Text style={ui.h2}>{title}</Text></View>{children}</View>; }
function Toggle({ title, value, onChange }: { title: string; value: boolean; onChange: (value: boolean) => void }) { return <View style={styles.toggle}><Text style={[ui.text, { flex: 1 }]}>{title}</Text><Switch value={value} onValueChange={onChange} trackColor={{ false: palette.border, true: '#A8520A' }} thumbColor={value ? palette.orange : palette.muted} /></View>; }
const styles = StyleSheet.create({ account: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, borderRadius: 18, backgroundColor: palette.surface }, section: { gap: 13, padding: 16, borderRadius: 19, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 4 }, toggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, label: { color: palette.muted, fontSize: 12, fontWeight: '700' }, choices: { flexDirection: 'row', gap: 7 }, choice: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: palette.surface2 }, choiceActive: { backgroundColor: palette.orange }, choiceText: { color: palette.muted, fontSize: 12, fontWeight: '700' }, blocked: { flexDirection: 'row', alignItems: 'center', gap: 9 }, deleteBackdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: '#000D' }, deleteCard: { width: '100%', maxWidth: 540, alignSelf: 'center', gap: 16, padding: 18, borderRadius: 14, backgroundColor: '#111214', borderWidth: 1, borderColor: '#7C252C' }, deleteTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, deleteKicker: { color: palette.danger, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 5 }, deleteTitle: { color: palette.text, fontSize: 23, lineHeight: 28, fontWeight: '900' }, deleteCopy: { color: palette.muted, fontSize: 14, lineHeight: 21 }, deleteActions: { flexDirection: 'row', gap: 9 } });
