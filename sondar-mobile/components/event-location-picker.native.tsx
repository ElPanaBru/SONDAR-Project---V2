import { StyleSheet, Text, View } from 'react-native';
import { LeafletMap } from './leaflet-map';
import type { Coordinate } from '@/lib/leaflet/document';

export function EventLocationPicker({ coordinate, onChange }: { coordinate: Coordinate; onChange: (coordinate: Coordinate) => void; customMapStyle?: any[] }) {
  return <View style={styles.frame}>
    <LeafletMap picker state={{ center: coordinate, events: [], coordinate }} onCoordinate={onChange} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={styles.tip}><Text style={styles.text}>Toca el mapa o arrastra el pin para ubicar el evento</Text></View>
  </View>;
}
const styles = StyleSheet.create({
  frame: { height: 270, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#6A3C0C', backgroundColor: '#202020' },
  tip: { position: 'absolute', top: 12, left: 12, right: 12, padding: 10, borderRadius: 8, backgroundColor: '#080808D9' },
  text: { color: '#eee', fontSize: 12, textAlign: 'center' },
});
