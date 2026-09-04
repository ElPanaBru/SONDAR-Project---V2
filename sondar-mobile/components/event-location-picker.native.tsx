import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, MapPressEvent, PROVIDER_GOOGLE } from 'react-native-maps';

import { palette } from '@/constants/sondar';

type Coordinate = { latitude: number; longitude: number };

export function EventLocationPicker({ coordinate, onChange, customMapStyle }: { coordinate: Coordinate; onChange: (coordinate: Coordinate) => void; customMapStyle?: any[] }) {
  function select(event: MapPressEvent) {
    onChange(event.nativeEvent.coordinate);
  }

  return (
    <View style={styles.frame}>
      <MapView
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...coordinate, latitudeDelta: .055, longitudeDelta: .055 }}
        customMapStyle={customMapStyle}
        onPress={select}>
        <Marker
          coordinate={coordinate}
          draggable
          onDragEnd={event => onChange(event.nativeEvent.coordinate)}>
          <View style={styles.pin}><Ionicons name="location" size={27} color="#111" /></View>
        </Marker>
      </MapView>
      <View pointerEvents="none" style={styles.tip}>
        <Ionicons name="hand-left-outline" size={18} color={palette.amber} />
        <Text style={styles.tipText}>Tocá el mapa o arrastrá el pin para ubicar el evento</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 270, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#6A3C0C', backgroundColor: '#17191E' },
  tip: { position: 'absolute', top: 12, left: 12, right: 12, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#080808D9', borderWidth: 1, borderColor: '#FFFFFF1A' },
  tipText: { flex: 1, color: palette.text, fontSize: 12, fontWeight: '700' },
  pin: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.amber, borderWidth: 3, borderColor: '#111' },
});
