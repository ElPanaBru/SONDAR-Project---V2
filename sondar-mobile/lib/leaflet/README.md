# Mapa movil con Leaflet

Android e iOS usan react-native-webview (compatible con Expo Go) y Leaflet 1.9.4
incluido en lib/leaflet/vendor.ts. No requiere Google Maps ni descargar JavaScript
desde un CDN. Las imagenes del mapa si requieren conexion.

## Estilo

Usa exclusivamente CARTO Dark Matter, igual que Frontend/src/paginas/Eventos.jsx.
No usa Stadia ni requiere una clave de Stadia o Google Maps.
Las atribuciones de CARTO y OpenStreetMap permanecen visibles.

## Comprobacion en Expo Go

- Abrir Eventos en Android/iOS: mapa oscuro, zoom y desplazamiento tactil.
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
