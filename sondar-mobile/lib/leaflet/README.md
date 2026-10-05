# Mapa movil con Leaflet

Android e iOS usan react-native-webview (compatible con Expo Go) y Leaflet 1.9.4
incluido en lib/leaflet/vendor.ts. No requiere Google Maps ni descargar JavaScript
desde un CDN. Las imagenes del mapa si requieren conexion.

## Estilo

El mapa usa OpenStreetMap en modo claro y OpenFreeMap Dark en modo oscuro.
OpenFreeMap se dibuja con MapLibre GL JS dentro de la misma vista Leaflet en
Android e iOS. No utiliza Stadia ni CARTO y no requiere una API key.
Las atribuciones permanecen visibles. El modo oscuro requiere WebGL.

## Comprobacion en Expo Go

- Abrir Eventos en Android/iOS: mismo mapa, zoom y desplazamiento tactil.
- Boton circular arriba a la izquierda: luna para activar oscuro, sol para volver a claro.
- Cambiar genero: mismos eventos en mapa y lista; cambiar orden no recentra.
- Tocar un pin: abre el evento. Grupos: acercamiento o lista para pines coincidentes.
- Mi ubicacion: pedir permiso, pin naranja y centrado. Repetir para actualizar.
- Crear evento: tocar mapa o arrastrar pin actualiza las coordenadas.
- Usar mi ubicacion al crear: mueve pin y centra el mapa.
- Sin conexion: aviso con Reintentar; al reconectar se recupera el mapa.

## Actualizar Leaflet incluido

vendor.ts contiene leafletJS y leafletCSS exportados como cadenas JSON desde
leaflet/dist/leaflet.js y leaflet/dist/leaflet.css. Conservar LICENSE (BSD-2-Clause)
y actualizar ambos archivos juntos. Version actual: 1.9.4.

MapLibre GL JS 5.6.2 y MapLibre GL Leaflet 0.1.3 estan incluidos en
maplibre-vendor.ts; sus licencias se conservan en esta carpeta.
