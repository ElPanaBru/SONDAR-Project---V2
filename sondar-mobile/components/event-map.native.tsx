import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { palette } from '@/constants/sondar';

type EventMapProps = {
  events: any[];
  initialRegion: any;
  customMapStyle: any[];
  onSelect: (event: any) => void;
  style?: any;
};

export function EventMap({ events, initialRegion, customMapStyle, onSelect, style }: EventMapProps) {
  return (
    <MapView provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined} style={style} initialRegion={initialRegion} customMapStyle={customMapStyle}>
      {events.map(event => {
        const latitude = Number(event.latitud), longitude = Number(event.longitud);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        const markerImage = event.img || event.img_url;
        return (
          <Marker key={event.id} coordinate={{ latitude, longitude }} title={event.titulo} description={event.lugar || event.ubicacion} onPress={() => onSelect(event)} anchor={{ x: .5, y: 1 }}>
            <View style={styles.marker}>{markerImage ? <Image source={{ uri: markerImage }} style={styles.markerImage} contentFit="cover" /> : <Ionicons name="musical-note" size={18} color="#080808" />}</View>
            <View style={styles.markerTip} />
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  marker: { width: 48, height: 48, borderRadius: 24, padding: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: palette.amber, borderWidth: 3, borderColor: '#080808' },
  markerImage: { width: 38, height: 38, borderRadius: 19 },
  markerTip: { width: 0, height: 0, alignSelf: 'center', borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#080808', marginTop: -2 },
});
