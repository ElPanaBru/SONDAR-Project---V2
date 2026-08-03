import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StatusBar as RNStatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/constants/sondar';

export function Screen({ children, scroll = false, refreshing, onRefresh }: PropsWithChildren<{ scroll?: boolean; refreshing?: boolean; onRefresh?: () => void }>) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scroll}
      stickyHeaderIndices={[0]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={palette.orange} /> : undefined}>
      {children}
    </ScrollView>
  ) : children;
  return <View style={styles.screen}>{body}</View>;
}

export function Header({ title, subtitle, back = false, onBack, actions }: { title: string; subtitle?: string; back?: boolean; onBack?: () => void; actions?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const fallbackTop = Platform.OS === 'ios' ? 44 : RNStatusBar.currentHeight || 0;
  const topInset = Math.max(insets.top, fallbackTop);
  return (
    <View style={[styles.header, { minHeight: 58 + topInset, paddingTop: topInset }]}>
      {back ? <IconButton name="arrow-back" onPress={onBack || (() => router.back())} /> : <View style={styles.brand}><Text style={styles.brandS}>S</Text></View>}
      <View style={styles.headerText}><Text style={styles.title} numberOfLines={1}>{title}</Text>{subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}</View>
      <View style={styles.headerActions}>{actions}</View>
    </View>
  );
}

export function IconButton({ name, onPress, active, badge, danger }: { name: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void; active?: boolean; badge?: number; danger?: boolean }) {
  return (
    <Pressable hitSlop={10} onPress={onPress} style={({ pressed }) => [styles.iconButton, active && styles.iconButtonActive, pressed && styles.pressed]}>
      <Ionicons name={name} size={22} color={danger ? palette.danger : active ? palette.orange : palette.text} />
      {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
    </Pressable>
  );
}

export function Button({ children, onPress, kind = 'primary', disabled, icon }: PropsWithChildren<{ onPress: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; disabled?: boolean; icon?: React.ComponentProps<typeof Ionicons>['name'] }>) {
  const content = <>{icon ? <Ionicons name={icon} size={18} color={kind === 'primary' ? '#080808' : kind === 'danger' ? palette.danger : palette.text} /> : null}<Text style={[styles.buttonText, kind === 'primary' && styles.buttonTextPrimary, kind === 'danger' && { color: palette.danger }]}>{children}</Text></>;
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, styles[`button_${kind}`], disabled && styles.disabled, pressed && styles.pressed]}>
      {kind === 'primary' ? <LinearGradient colors={[palette.amber, palette.orange]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>{content}</LinearGradient> : content}
    </Pressable>
  );
}

export function Field(props: React.ComponentProps<typeof TextInput> & { label?: string }) {
  const { label, multiline, style, ...rest } = props;
  return <View style={styles.fieldWrap}>{label ? <Text style={styles.label}>{label}</Text> : null}<TextInput placeholderTextColor={palette.muted} multiline={multiline} style={[styles.field, multiline && styles.multiline, style]} {...rest} /></View>;
}

export function Avatar({ uri, name, size = 44 }: { uri?: string | null; name?: string; size?: number }) {
  return uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.surface2 }} /> : (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}><Text style={[styles.avatarLetter, { fontSize: size * .4 }]}>{name?.trim().charAt(0).toUpperCase() || 'S'}</Text></View>
  );
}

export function Empty({ icon = 'musical-notes-outline', title, text }: { icon?: React.ComponentProps<typeof Ionicons>['name']; title: string; text?: string }) {
  return <View style={styles.empty}><Ionicons name={icon} size={38} color={palette.orange} /><Text style={styles.emptyTitle}>{title}</Text>{text ? <Text style={styles.emptyText}>{text}</Text> : null}</View>;
}

export function Loading() { return <View style={styles.loading}><ActivityIndicator color={palette.orange} size="large" /></View>; }
export function ErrorNotice({ message }: { message?: string }) { return message ? <View style={styles.error}><Ionicons name="alert-circle" size={18} color={palette.danger} /><Text style={styles.errorText}>{message}</Text></View> : null; }

export const ui = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 8, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: palette.text, fontSize: 24, fontWeight: '800' },
  h2: { color: palette.text, fontSize: 18, fontWeight: '700' },
  text: { color: palette.text, fontSize: 15 },
  muted: { color: palette.muted, fontSize: 13 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 110, gap: 12 },
  header: { minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border, backgroundColor: palette.bg, zIndex: 20 },
  brand: { width: 36, height: 36, borderRadius: 8, backgroundColor: palette.orange, alignItems: 'center', justifyContent: 'center' },
  brandS: { color: '#111', fontSize: 23, fontWeight: '900' },
  headerText: { flex: 1 }, headerActions: { flexDirection: 'row', gap: 6 },
  title: { color: palette.text, fontSize: 21, fontWeight: '800' }, subtitle: { color: palette.muted, fontSize: 11, marginTop: 1 },
  iconButton: { width: 40, height: 40, borderRadius: 8, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border },
  iconButtonActive: { borderColor: palette.orange, backgroundColor: '#24140A' },
  badge: { position: 'absolute', right: -3, top: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: palette.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  button: { minHeight: 44, borderRadius: 8, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden' },
  buttonGradient: { width: '100%', minHeight: 46, paddingHorizontal: 17, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  button_primary: { backgroundColor: palette.orange, borderColor: palette.amber }, button_secondary: { paddingHorizontal: 17, backgroundColor: palette.surface2, borderColor: palette.border }, button_ghost: { paddingHorizontal: 17, backgroundColor: 'transparent', borderColor: 'transparent' }, button_danger: { paddingHorizontal: 17, backgroundColor: '#261216', borderColor: '#55202A' },
  buttonText: { color: palette.text, fontSize: 15, fontWeight: '700', textAlign: 'center', flexShrink: 1 }, buttonTextPrimary: { color: '#121212' },
  disabled: { opacity: .45 }, pressed: { opacity: .7 },
  fieldWrap: { gap: 7 }, label: { color: palette.muted, fontWeight: '600', fontSize: 12 },
  field: { minHeight: 46, color: palette.text, backgroundColor: palette.surface2, borderColor: palette.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 13, fontSize: 15 }, multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: 13 },
  avatarFallback: { backgroundColor: '#42250B', borderWidth: 1, borderColor: palette.orange, alignItems: 'center', justifyContent: 'center' }, avatarLetter: { color: palette.orange, fontWeight: '900' },
  empty: { minHeight: 230, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 }, emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }, emptyText: { color: palette.muted, textAlign: 'center', lineHeight: 20 },
  loading: { flex: 1, minHeight: 250, alignItems: 'center', justifyContent: 'center' },
  error: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 8, backgroundColor: '#251216', borderWidth: 1, borderColor: '#54212B', alignItems: 'center' }, errorText: { color: '#FFBBC3', flex: 1 },
});

