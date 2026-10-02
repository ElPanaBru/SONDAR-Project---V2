import { LeafletMap } from './leaflet-map';
import { validCoordinate, type Coordinate } from '@/lib/leaflet/document';

type EventMapProps = {
  events: any[];
  userLocation?: Coordinate | null;
  locationFocus?: number;
  mapTheme?: 'light' | 'dark';
  initialRegion: Coordinate;
  customMapStyle?: any[];
  onSelect: (event: any) => void;
  style?: any;
};

export function EventMap({ events, initialRegion, userLocation, locationFocus, mapTheme = 'light', onSelect, style }: EventMapProps) {
  const points = events.flatMap(event => {
    if (event.latitud == null || event.longitud == null || String(event.latitud).trim() === '' || String(event.longitud).trim() === '') return [];
    const coordinate = { latitude: Number(event.latitud), longitude: Number(event.longitud) };
    return validCoordinate(coordinate) ? [{ ...coordinate, id: String(event.id), title: String(event.titulo || 'Evento') }] : [];
  });
  return <LeafletMap style={style} theme={mapTheme} state={{ center: initialRegion, events: points, userLocation, locationFocus }} onSelect={id => {
    const event = events.find(item => String(item.id) === id);
    if (event) onSelect(event);
  }} />;
}
