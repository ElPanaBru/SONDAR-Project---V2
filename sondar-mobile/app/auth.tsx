import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorNotice, Field } from '@/components/sondar-ui';
import { palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';

export default function AuthScreen() {
  const { configured, user, signIn, signUp } = useAuth();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const strong = useMemo(() => password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password), [password]);
  const backgroundPlayer = useVideoPlayer(require('../assets/auth-background.mp4'), player => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  useEffect(() => { if (user) router.replace('/'); }, [user]);

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
      if (register) await signUp(email, password, username);
      else await signIn(email, password);
      router.replace('/');
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos ingresar.'); }
    finally { setBusy(false); }
  }

  return (
    <View style={styles.page}>
      <VideoView player={backgroundPlayer} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <LinearGradient colors={['#00000045', '#00000018', '#000000A8']} locations={[0, .48, 1]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image source={require('../assets/sondar-logo.png')} style={styles.logo} contentFit="contain" />
          <Text style={styles.heroTitle}>La música pasa cerca tuyo.</Text>
          <Text style={styles.tagline}>Descubrí artistas, lanzamientos y eventos de tu escena.</Text>
          <View style={styles.card}>
            <View style={styles.switcher}>
              <Pressable onPress={() => setRegister(false)} style={[styles.switch, !register && styles.switchActive]}><Text style={[styles.switchText, !register && styles.switchTextActive]}>Ingresar</Text></Pressable>
              <Pressable onPress={() => setRegister(true)} style={[styles.switch, register && styles.switchActive]}><Text style={[styles.switchText, register && styles.switchTextActive]}>Crear cuenta</Text></Pressable>
            </View>
            {!configured ? <ErrorNotice message="Copiá .env.example a .env y completá las variables EXPO_PUBLIC de Supabase." /> : null}
            {register ? <Field label="Nombre de usuario" placeholder="@tuusuario" autoCapitalize="none" value={username} onChangeText={setUsername} /> : null}
            <Field label="Email" placeholder="vos@email.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            <View><Field label="Contraseña" placeholder="••••••••" secureTextEntry={!visible} value={password} onChangeText={setPassword} /><Pressable style={styles.eye} onPress={() => setVisible(v => !v)}><Ionicons name={visible ? 'eye-off' : 'eye'} size={20} color={palette.muted} /></Pressable></View>
            {register ? <Field label="Repetir contraseña" placeholder="••••••••" secureTextEntry={!visible} value={repeat} onChangeText={setRepeat} /> : null}
            <ErrorNotice message={error} />
            <Button onPress={submit} disabled={busy || !configured}>{busy ? 'Procesando…' : register ? 'Crear mi cuenta' : 'Entrar a SONDAR'}</Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 }, flex: { flex: 1 }, content: { flexGrow: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  logo: { width: 285, height: 84 }, heroTitle: { color: palette.text, fontSize: 29, fontWeight: '900', textAlign: 'center', textShadowColor: '#000', textShadowRadius: 12, marginTop: 4 }, tagline: { color: '#E6E6E6', textAlign: 'center', fontWeight: '600', lineHeight: 20, marginTop: 7, marginBottom: 22, textShadowColor: '#000', textShadowRadius: 8 },
  card: { width: '100%', maxWidth: 430, padding: 18, gap: 15, borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF29', backgroundColor: '#080808D9' },
  switcher: { flexDirection: 'row', padding: 4, backgroundColor: '#FFFFFF14', borderWidth: 1, borderColor: '#FFFFFF1F', borderRadius: 12 }, switch: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 9 }, switchActive: { backgroundColor: palette.amber }, switchText: { color: '#D8D8DC', fontWeight: '800' }, switchTextActive: { color: '#080808' },
  eye: { position: 'absolute', right: 13, bottom: 14 },
});


