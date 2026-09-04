import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

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
type ProjectedCluster = EventCluster & { x: number; y: number };

const CLUSTER_RADIUS = 62;

function eventPoints(events: any[]): EventPoint[] {
  return events.flatMap(event => {
    const latitude = Number(event.latitud), longitude = Number(event.longitud);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [{ event, latitude, longitude }];
  });
}

function clusterEvents(points: EventPoint[], region: Region, width: number, height: number): EventCluster[] {
  const longitudeDelta = Math.max(region.longitudeDelta, 0.00001);
  const latitudeDelta = Math.max(region.latitudeDelta, 0.00001);
  const groups: ProjectedCluster[] = [];

  for (const point of points) {
    const x = ((point.longitude - region.longitude) / longitudeDelta) * width;
    const y = ((region.latitude - point.latitude) / latitudeDelta) * height;
    let closest: ProjectedCluster | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const group of groups) {
      const distance = Math.hypot(x - group.x, y - group.y);
      if (distance <= CLUSTER_RADIUS && distance < closestDistance) {
        closest = group;
        closestDistance = distance;
      }
    }

    if (!closest) {
      groups.push({
        id: String(point.event.id),
        items: [point],
        latitude: point.latitude,
        longitude: point.longitude,
        x,
        y,
      });
      continue;
    }

    const nextCount = closest.items.length + 1;
    closest.items.push(point);
    closest.latitude += (point.latitude - closest.latitude) / nextCount;
    closest.longitude += (point.longitude - closest.longitude) / nextCount;
    closest.x += (x - closest.x) / nextCount;
    closest.y += (y - closest.y) / nextCount;
    closest.id = closest.items.map(item => String(item.event.id)).sort().join(':');
  }

  return groups.map(({ x: _x, y: _y, ...cluster }) => cluster);
}

export function EventMap({ events, initialRegion, customMapStyle, onSelect, style }: EventMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState<Region>(initialRegion);
  const [viewport, setViewport] = useState({ width: 390, height: 480 });
  const points = useMemo(() => eventPoints(events), [events]);
  const clusters = useMemo(() => clusterEvents(points, region, viewport.width, viewport.height), [points, region, viewport.height, viewport.width]);
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

    const coordinates = cluster.items.map(item => ({ latitude: item.latitude, longitude: item.longitude }));
    const latitudes = cluster.items.map(item => item.latitude);
    const longitudes = cluster.items.map(item => item.longitude);
    const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
    const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);

    if (latitudeSpan < 0.0001 && longitudeSpan < 0.0001) {
      mapRef.current?.animateToRegion({
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        latitudeDelta: Math.max(0.008, region.latitudeDelta * 0.4),
        longitudeDelta: Math.max(0.008, region.longitudeDelta * 0.4),
      }, 280);
      return;
    }

    mapRef.current?.fitToCoordinates(coordinates, {
      edgePadding: { top: 90, right: 65, bottom: 190, left: 65 },
      animated: true,
    });
  }

  return (
    <MapView
      ref={mapRef}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      style={style}
      initialRegion={initialRegion}
      customMapStyle={customMapStyle}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setViewport(current => current.width === width && current.height === height ? current : { width, height });
      }}
      onRegionChangeComplete={setRegion}>
      {clusters.map(cluster => {
        const first = cluster.items[0].event;
        const clustered = cluster.items.length > 1;
        return (
          <Marker key={cluster.id} coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }} title={clustered ? `${cluster.items.length} eventos` : first.titulo} description={clustered ? 'Toca para acercar' : first.lugar || first.ubicacion} onPress={() => focusCluster(cluster)} anchor={{ x: .5, y: 1 }}>
            <View style={[styles.marker, clustered && styles.clusterMarker]}>{clustered ? <Text style={styles.clusterText}>{cluster.items.length}</Text> : <Image source={require('../assets/images/icon.png')} style={styles.markerImage} contentFit="cover" />}</View>
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
  markerImage: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#080808' },
  markerTip: { width: 0, height: 0, alignSelf: 'center', borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#080808', marginTop: -2 },
});
