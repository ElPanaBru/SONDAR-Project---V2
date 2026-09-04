import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, ErrorNotice, Field, Header, IconButton, Screen, ui } from '@/components/sondar-ui';
import { formatGenre, musicGenres, palette } from '@/constants/sondar';
import { useAuth } from '@/contexts/auth';
import { api, mediaPart } from '@/lib/api';

const minBirthDate = new Date(1900, 0, 1);
const defaultBirthDate = new Date(2000, 0, 1);

function maxBirthDate() {
  const today = new Date();
  return new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function dateToApi(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function dateToLabel(value: Date) {
  return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`;
}

export default function OnboardingScreen() {
  const { token, user, completeOnboarding, signOut } = useAuth();
  const initialName = useMemo(() => {
    const metadataName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.user_metadata?.username;
    return String(metadataName || user?.email?.split('@')[0] || '').replace(/^@/, '');
  }, [user]);
  const selectableGenres = useMemo(() => musicGenres.filter((genre) => genre !== 'otros'), []);
  const [nombre, setNombre] = useState<string | undefined>(undefined);
  const [bio, setBio] = useState('');
  const [birthDate, setBirthDate] = useState(defaultBirthDate);
  const [showPicker, setShowPicker] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const visibleName = nombre ?? initialName;

  useEffect(() => {
    if (!user) router.replace('/auth');
  }, [user]);

  async function pickAvatar() {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      setError('Necesitamos permiso para elegir una foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: .85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) setAvatar(result.assets[0]);
  }

  function toggleGenre(genre: string) {
    setGenres((current) => current.includes(genre)
      ? current.filter((item) => item !== genre)
      : [...current, genre]);
  }

  async function submit() {
    const cleanName = visibleName.trim();
    if (!cleanName) return setError('Completa tu nombre visible.');
    if (genres.length < 3) return setError('Elegi al menos 3 generos para tus recomendaciones.');
    if (!token) return setError('Tu sesion vencio. Inicia sesion de nuevo.');

    setSaving(true);
    setError('');
    try {
      const body = new FormData();
      body.append('nombre', cleanName);
      body.append('bio', bio.trim());
      body.append('birthDate', dateToApi(birthDate));
      body.append('genres', JSON.stringify(genres));
      if (avatar) body.append('avatar', mediaPart(avatar, 'avatar.jpg'));

      await api('/api/usuarios/me/onboarding', { method: 'PUT', token, body });
      await completeOnboarding();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar el perfil.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll>
      <Header
        title="Ultimo paso"
        subtitle="Perfil y recomendaciones"
        actions={<IconButton name="log-out-outline" onPress={async () => { await signOut(); router.replace('/auth'); }} />}
      />
      <View style={styles.hero}>
        <Text style={styles.kicker}>SONDAR</Text>
        <Text style={styles.title}>Dale identidad a tu perfil</Text>
        <Text style={styles.subtitle}>Tu fecha no sera publica. Tus generos ordenan lo que ves primero.</Text>
      </View>

      <View style={styles.avatarRow}>
        <Pressable onPress={pickAvatar} style={styles.avatarPicker}>
          {avatar ? <Image source={{ uri: avatar.uri }} style={styles.avatarImage} contentFit="cover" /> : <Avatar name={visibleName || user?.email || 'S'} size={94} />}
          <View style={styles.addBadge}><Ionicons name="add" size={22} color="#101010" /></View>
        </Pressable>
        <View style={styles.avatarText}>
          <Text style={ui.h2}>Anadir foto</Text>
          <Text style={ui.muted}>JPG, PNG, WebP o GIF. Maximo 5 MB.</Text>
        </View>
      </View>

      <Field label="Nombre visible" value={visibleName} onChangeText={setNombre} placeholder="Ej: Martina Lopez" maxLength={80} />
      <View>
        <Field label="Bio" value={bio} onChangeText={setBio} placeholder="Conta que haces, que escuchas o que estas creando." multiline maxLength={180} />
        <Text style={styles.counter}>{bio.length}/180</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Fecha de nacimiento</Text>
        <Pressable onPress={() => setShowPicker(true)} style={styles.dateButton}>
          <Text style={styles.dateText}>{dateToLabel(birthDate)}</Text>
          <Ionicons name="calendar-outline" size={22} color={palette.text} />
        </Pressable>
        <Text style={ui.muted}>Debes tener al menos 13 anos.</Text>
        {showPicker ? (
          <DateTimePicker
            value={birthDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minBirthDate}
            maximumDate={maxBirthDate()}
            onChange={(_, selectedDate) => {
              if (Platform.OS !== 'ios') setShowPicker(false);
              if (selectedDate) setBirthDate(selectedDate);
            }}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.genreHeader}>
          <Text style={styles.label}>Generos que queres descubrir</Text>
          <Text style={styles.genreCount}>{Math.min(genres.length, 3)}/3</Text>
        </View>
        <Text style={ui.muted}>Elegi al menos 3. Los usamos para ordenar recomendaciones.</Text>
        <View style={styles.genreGrid}>
          {selectableGenres.map((genre) => {
            const active = genres.includes(genre);
            return (
              <Pressable key={genre} onPress={() => toggleGenre(genre)} style={[styles.genreChip, active && styles.genreChipActive]}>
                <Text style={[styles.genreText, active && styles.genreTextActive]}>{formatGenre(genre)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ErrorNotice message={error} />
      <Button onPress={submit} disabled={saving}>{saving ? 'Guardando...' : `Entrar a SONDAR (${Math.min(genres.length, 3)}/3)`}</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8, paddingTop: 4, paddingBottom: 4 },
  kicker: { color: palette.amber, fontSize: 12, fontWeight: '900', letterSpacing: 0 },
  title: { color: palette.text, fontSize: 29, lineHeight: 34, fontWeight: '900' },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  avatarRow: { minHeight: 118, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 14, borderRadius: 8, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  avatarPicker: { width: 102, height: 102, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 94, height: 94, borderRadius: 47, backgroundColor: palette.surface2 },
  addBadge: { position: 'absolute', right: 2, bottom: 2, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.amber, borderWidth: 3, borderColor: palette.surface },
  avatarText: { flex: 1, gap: 4 },
  counter: { alignSelf: 'flex-end', marginTop: 5, color: palette.muted, fontSize: 12, fontWeight: '700' },
  section: { gap: 10, padding: 14, borderRadius: 8, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  label: { color: palette.text, fontSize: 15, fontWeight: '800' },
  dateButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: 8, backgroundColor: palette.surface2, borderWidth: 1, borderColor: palette.border },
  dateText: { color: palette.text, fontSize: 18, fontWeight: '900' },
  genreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  genreCount: { color: palette.amber, fontSize: 13, fontWeight: '900' },
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 },
  genreChip: { width: '48%', minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: palette.surface2, borderWidth: 1, borderColor: palette.border },
  genreChipActive: { backgroundColor: palette.orange, borderColor: palette.amber },
  genreText: { color: palette.text, fontSize: 14, fontWeight: '800' },
  genreTextActive: { color: '#101010' },
});
