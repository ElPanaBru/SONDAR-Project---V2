import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type GenreVisual = { icon: ComponentProps<typeof MaterialCommunityIcons>['name']; tint: string; seed: number; angle: number };
const visuals: Record<string, GenreVisual> = {
  pop: { icon: 'star-four-points-outline', tint: '#32200F', seed: 2, angle: -24 },
  rock: { icon: 'guitar-electric', tint: '#302214', seed: 5, angle: 32 },
  urbano: { icon: 'microphone-outline', tint: '#302114', seed: 12, angle: 0 },
  jazz: { icon: 'saxophone', tint: '#30251C', seed: 16, angle: -32 },
  blues: { icon: 'piano', tint: '#172C34', seed: 20, angle: 90 },
  funk: { icon: 'album', tint: '#2E2915', seed: 25, angle: 65 },
  folklore: { icon: 'guitar-acoustic', tint: '#352719', seed: 30, angle: -42 },
};

/** Each forum has a distinct rhythm, pattern and instrument, rendered locally. */
export function GenreArtwork({ genre }: { genre: string }) {
  const visual = visuals[genre.toLowerCase()] || visuals.pop;
  const count = 27;
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <LinearGradient colors={[visual.tint, '#131313']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    <View style={styles.pattern}>{Array.from({ length: 16 }, (_, i) => <View key={i} style={[styles.line, { left: i * 30 - 55, transform: [{ rotate: (visual.angle * Math.PI / 180) + 'rad' }] }]} />)}</View>
    <View style={styles.rhythm}>
      {Array.from({ length: count }, (_, i) => i === Math.floor(count / 2)
        ? <MaterialCommunityIcons key={i} name={visual.icon} color="#EAA51F" size={32} style={styles.icon} />
        : <View key={i} style={[styles.bar, { height: 12 + ((i * 13 + visual.seed * 7 + i * i) % 34), opacity: .25 + (i % 5) * .12 }]} />)}
    </View>
  </View>;
}

export function GenreBadge({ genre }: { genre: string }) {
  return <LinearGradient colors={['#FFB800', '#FF8200']} style={styles.badge}>
    <Text style={styles.initial}>{genre.charAt(0).toUpperCase()}</Text>
  </LinearGradient>;
}

const styles = StyleSheet.create({
  pattern: { ...StyleSheet.absoluteFill, overflow: 'hidden', opacity: .35 },
  line: { position: 'absolute', top: -100, width: 1, height: 360, backgroundColor: '#C9953020' },
  rhythm: { position: 'absolute', left: 12, right: 12, top: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  bar: { flex: 1, maxWidth: 8, borderRadius: 5, backgroundColor: '#D99815' },
  icon: { marginHorizontal: 5, opacity: .8 },
  initial: { color: '#111', fontSize: 22, fontWeight: '900' },
  badge: { width: 42, height: 42, borderRadius: 21, borderWidth: 3, borderColor: '#101010', alignItems: 'center', justifyContent: 'center' },
});
