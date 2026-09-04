import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Button, ErrorNotice, Field } from '@/components/sondar-ui';
import { palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';

function rawAuthMessage(error: unknown): string {
  if (!error) return '';
  if (error instanceof Error) return rawAuthMessage(error.message);
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed && !['{}', '[]', 'null', 'undefined', '[object Object]'].includes(trimmed) ? trimmed : '';
  }
  if (typeof error === 'object') {
    const candidate =
      rawAuthMessage((error as { message?: unknown }).message) ||
      rawAuthMessage((error as { error_description?: unknown }).error_description) ||
      rawAuthMessage((error as { error?: unknown }).error) ||
      rawAuthMessage((error as { detail?: unknown }).detail) ||
      rawAuthMessage((error as { details?: unknown }).details);
    if (candidate) return candidate;
  }

  return rawAuthMessage(String(error));
}

function authErrorMessage(error: unknown, creatingAccount = false) {
  const fallback = creatingAccount
    ? 'No pudimos crear la cuenta. Verifica email, usuario y contrasena.'
    : 'No pudimos ingresar. Verifica tus datos.';
  const message = rawAuthMessage(error) || fallback;
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) return 'Email o contrasena incorrectos.';
  if (lower.includes('email not confirmed')) return 'Cuenta creada. Revisa tu correo para confirmar el registro.';
  if (lower.includes('already registered') || lower.includes('ya esta registrado')) return 'Ese correo ya esta registrado.';
  if (lower.includes('api key') || lower.includes('supabase')) return 'No pudimos conectar con Supabase. Reinicia Expo y el backend.';

  return message || fallback;
}

export default function AuthScreen() {
  const { configured, user, needsOnboarding, signIn, signUp } = useAuth();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { width } = useWindowDimensions();
  const viewportWidth = width >= 320 ? width : 390;
  const contentWidth = Math.min(Math.max(viewportWidth - 32, 280), 358);
  const logoWidth = Math.min(contentWidth - 40, 285);
  const strong = useMemo(() => password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password), [password]);
  const backgroundPlayer = useVideoPlayer(require('../assets/auth-background.mp4'), player => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  useEffect(() => { if (user) router.replace(needsOnboarding ? '/onboarding' : '/'); }, [needsOnboarding, user]);

  async function submit() {
    setError('');
    if (!email.trim() || !password) return setError('Completá tu email y contraseña.');
    if (register) {
      if (!/^[a-z0-9._-]{3,30}$/.test(username.trim().replace(/^@/, '').toLowerCase())) return setError('El @ debe tener entre 3 y 30 caracteres válidos.');
      if (!strong) return setError('Usá 8 caracteres con mayúscula, minúscula, número y símbolo.');
      if (password !== repeat) return setError('Las contraseñas no coinciden.');
    }
    setBusy(true);
    try {
      if (register) {
        await signUp(email, password, username);
        router.replace('/onboarding');
      } else {
        await signIn(email, password);
        router.replace('/');
      }
    } catch (e) { setError(authErrorMessage(e, register)); }
    finally { setBusy(false); }
  }

  return (
    <View style={styles.page}>
      <View style={styles.backgroundClip}>
        <VideoView player={backgroundPlayer} style={styles.backgroundMedia} contentFit="cover" nativeControls={false} />
        <LinearGradient colors={['#00000045', '#00000018', '#000000A8']} locations={[0, .48, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView style={styles.scroller} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.inner, { width: contentWidth }]}>
            <Image source={require('../assets/sondar-logo-auth-v3.png')} style={[styles.logo, { width: logoWidth }]} contentFit="contain" />
            <Text style={styles.heroTitle}>La música pasa cerca tuyo.</Text>
            <Text style={styles.tagline}>Descubrí artistas, lanzamientos y eventos de tu escena.</Text>
            <View style={styles.card}>
              <View style={styles.switcher}>
                <Pressable onPress={() => setRegister(false)} style={[styles.switch, !register && styles.switchActive]}><Text style={[styles.switchText, !register && styles.switchTextActive]}>Ingresar</Text></Pressable>
                <Pressable onPress={() => setRegister(true)} style={[styles.switch, register && styles.switchActive]}><Text style={[styles.switchText, register && styles.switchTextActive]}>Crear cuenta</Text></Pressable>
              </View>
              {!configured ? <ErrorNotice message="No pudimos cargar la configuracion de acceso. Reinicia Expo desde la terminal del proyecto." /> : null}
              {register ? <Field label="Nombre de usuario" placeholder="@tuusuario" autoCapitalize="none" value={username} onChangeText={setUsername} /> : null}
              <Field label="Email" placeholder="vos@email.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
              <View><Field label="Contraseña" placeholder="••••••••" secureTextEntry={!visible} value={password} onChangeText={setPassword} /><Pressable style={styles.eye} onPress={() => setVisible(v => !v)}><Ionicons name={visible ? 'eye-off' : 'eye'} size={20} color={palette.muted} /></Pressable></View>
              {register ? <Field label="Repetir contraseña" placeholder="••••••••" secureTextEntry={!visible} value={repeat} onChangeText={setRepeat} /> : null}
              <ErrorNotice message={error} />
              <Button onPress={submit} disabled={busy || !configured}>{busy ? 'Procesando…' : register ? 'Crear mi cuenta' : 'Entrar a SONDAR'}</Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, overflow: 'hidden', backgroundColor: palette.bg }, backgroundClip: { ...StyleSheet.absoluteFill, overflow: 'hidden' }, backgroundMedia: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  flex: { flex: 1 }, scroller: { width: '100%' }, content: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 28, justifyContent: 'center', alignItems: 'flex-start' },
  inner: { maxWidth: 358 },
  logo: { height: 84, alignSelf: 'center' }, heroTitle: { color: palette.text, fontSize: 26, lineHeight: 31, fontWeight: '900', textAlign: 'center', marginTop: 4, alignSelf: 'stretch' }, tagline: { color: '#E6E6E6', textAlign: 'center', fontWeight: '600', lineHeight: 20, marginTop: 7, marginBottom: 22, alignSelf: 'stretch' },
  card: { alignSelf: 'stretch', padding: 18, gap: 15, borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF29', backgroundColor: '#080808D9' },
  switcher: { flexDirection: 'row', padding: 4, backgroundColor: '#FFFFFF14', borderWidth: 1, borderColor: '#FFFFFF1F', borderRadius: 12 }, switch: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', borderRadius: 9 }, switchActive: { backgroundColor: palette.amber }, switchText: { color: '#D8D8DC', fontWeight: '800', fontSize: 13 }, switchTextActive: { color: '#080808' },
  eye: { position: 'absolute', right: 13, bottom: 14 },
});


