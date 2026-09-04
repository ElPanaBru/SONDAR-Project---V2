import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/sondar';

type Coordinate = { latitude: number; longitude: number };

export function EventLocationPicker({ coordinate, onChange }: { coordinate: Coordinate; onChange: (coordinate: Coordinate) => void; customMapStyle?: any[] }) {
  return (
    <Pressable style={styles.frame} onPress={() => onChange(coordinate)}>
      <View style={styles.grid} />
      <Ionicons name="location" size={46} color={palette.amber} />
      <Text style={styles.title}>Ubicación del evento</Text>
      <Text style={styles.coordinates}>{coordinate.latitude.toFixed(5)}, {coordinate.longitude.toFixed(5)}</Text>
      <Text style={styles.tip}>En el teléfono podés tocar el mapa o arrastrar el pin.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { height: 270, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#6A3C0C', backgroundColor: '#15181D', alignItems: 'center', justifyContent: 'center', gap: 7 },
  grid: { ...StyleSheet.absoluteFill, opacity: .18, borderWidth: 18, borderColor: '#405166' },
  title: { color: palette.text, fontSize: 17, fontWeight: '900' },
  coordinates: { color: palette.amber, fontSize: 12, fontWeight: '700' },
  tip: { color: palette.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: 24 },
});
