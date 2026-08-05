import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { palette } from '@/constants/sondar';

type EventMapProps = {
  events: any[];
  initialRegion: any;
  customMapStyle: any[];
  onSelect: (event: any) => void;
  style?: any;
};

type EventPoint = { event: any; latitude: number; longitude: number };
type EventCluster = { id: string; latitude: number; longitude: number; items: EventPoint[] };

const CLUSTER_GRID_SIZE = 0.0035;

function eventPoints(events: any[]): EventPoint[] {
  return events.flatMap(event => {
    const latitude = Number(event.latitud), longitude = Number(event.longitud);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [{ event, latitude, longitude }];
  });
}

function clusterEvents(points: EventPoint[]): EventCluster[] {
  const groups = new Map<string, EventPoint[]>();
  points.forEach(point => {
    const key = `${Math.round(point.latitude / CLUSTER_GRID_SIZE)}:${Math.round(point.longitude / CLUSTER_GRID_SIZE)}`;
    groups.set(key, [...(groups.get(key) || []), point]);
  });

  return [...groups.entries()].map(([id, items]) => ({
    id,
    items,
    latitude: items.reduce((total, item) => total + item.latitude, 0) / items.length,
    longitude: items.reduce((total, item) => total + item.longitude, 0) / items.length,
  }));
}

export function EventMap({ events, initialRegion, customMapStyle, onSelect, style }: EventMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const points = useMemo(() => eventPoints(events), [events]);
  const clusters = useMemo(() => clusterEvents(points), [points]);
  const focusKey = points.map(point => `${point.event.id}:${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`).join('|');

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const timeout = setTimeout(() => {
      if (points.length === 0) {
        map.animateToRegion(initialRegion, 350);
        return;
      }

      if (points.length === 1) {
        map.animateToRegion({
          latitude: points[0].latitude,
          longitude: points[0].longitude,
          latitudeDelta: 0.045,
          longitudeDelta: 0.045,
        }, 350);
        return;
      }

      map.fitToCoordinates(
        points.map(point => ({ latitude: point.latitude, longitude: point.longitude })),
        { edgePadding: { top: 90, right: 70, bottom: 190, left: 70 }, animated: true }
      );
    }, 120);

    return () => clearTimeout(timeout);
  }, [focusKey, initialRegion, points]);

  function focusCluster(cluster: EventCluster) {
    if (cluster.items.length === 1) {
      onSelect(cluster.items[0].event);
      return;
    }

    mapRef.current?.animateToRegion({
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      latitudeDelta: 0.018,
      longitudeDelta: 0.018,
    }, 280);
  }

  return (
    <MapView ref={mapRef} provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined} style={style} initialRegion={initialRegion} customMapStyle={customMapStyle}>
      {clusters.map(cluster => {
        const first = cluster.items[0].event;
        const markerImage = first.img || first.img_url || first.avatar;
        const clustered = cluster.items.length > 1;
        return (
          <Marker key={cluster.id} coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }} title={clustered ? `${cluster.items.length} eventos` : first.titulo} description={clustered ? 'Toca para acercar' : first.lugar || first.ubicacion} onPress={() => focusCluster(cluster)} anchor={{ x: .5, y: 1 }}>
            <View style={[styles.marker, clustered && styles.clusterMarker]}>{clustered ? <Text style={styles.clusterText}>{cluster.items.length}</Text> : markerImage ? <Image source={{ uri: markerImage }} style={styles.markerImage} contentFit="cover" /> : <Ionicons name="musical-note" size={18} color="#080808" />}</View>
            <View style={styles.markerTip} />
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  marker: { width: 48, height: 48, borderRadius: 24, padding: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: palette.amber, borderWidth: 3, borderColor: '#080808' },
  clusterMarker: { backgroundColor: palette.orange },
  clusterText: { color: '#080808', fontSize: 17, fontWeight: '900' },
  markerImage: { width: 38, height: 38, borderRadius: 19 },
  markerTip: { width: 0, height: 0, alignSelf: 'center', borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#080808', marginTop: -2 },
});
