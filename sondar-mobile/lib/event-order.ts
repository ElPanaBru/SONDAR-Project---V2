export type Coordinate = { latitude: number; longitude: number };
export type EventSort = 'date' | 'price' | 'distance';
type SortableEvent = { fecha: string; precio?: unknown; latitud?: unknown; longitud?: unknown };

function finiteNumber(value: unknown): number | null {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function eventPrice(value: unknown) {
  const price = finiteNumber(value);
  return price !== null && price >= 0 ? price : null;
}

export function formatEventPrice(value: unknown) {
  const price = eventPrice(value);
  return price === null ? 'Precio a confirmar' : price === 0 ? 'Gratis' : '$ ' + price.toLocaleString('es-AR');
}

export function eventDistance(event: SortableEvent, location: Coordinate | null): number | null {
  if (!location) return null;
  const latitude = finiteNumber(event.latitud), longitude = finiteNumber(event.longitud);
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const radians = Math.PI / 180;
  const a = Math.sin((latitude - location.latitude) * radians / 2) ** 2
    + Math.cos(location.latitude * radians) * Math.cos(latitude * radians)
    * Math.sin((longitude - location.longitude) * radians / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function sortEvents<T extends SortableEvent>(events: T[], sort: EventSort, descending: boolean, location: Coordinate | null): T[] {
  const value = (event: T) => sort === 'price' ? eventPrice(event.precio)
    : sort === 'distance' ? eventDistance(event, location)
    : finiteNumber(new Date(event.fecha).getTime());
  return [...events].sort((a, b) => {
    const left = value(a), right = value(b);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return (left - right) * (descending ? -1 : 1);
  });
}
