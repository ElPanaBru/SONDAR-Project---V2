# Recursos de marca SONDAR — octubre 2026

Adaptaciones del logo proporcionado por el usuario, realizadas con la herramienta integrada image_gen. Se eligieron las versiones con fondo negro por la calidad de sus bordes.

## Archivos activos

- Web: `Frontend/public/sondar-brand-2026.png` y `Frontend/public/sondar-brand-icon-2026.png`.
- Móvil: copias idénticas en `sondar-mobile/assets/`.
- Horizontal: navegación, acceso y soporte web; acceso móvil.
- Icono: favicon, acceso directo, cabecera móvil, tarjetas y detalle de eventos, icono de aplicación y splash.

Los marcadores conservan `Frontend/public/sondar-icon.png` y `sondar-mobile/assets/images/icon.png`. No reemplazar estos archivos al actualizar la marca fuera del mapa.

## Prompts finales

Horizontal:

Create production horizontal version of attached logo on solid uniform black #000 background. Preserve exact musical-note symbol with three sound arcs tilted orbit and sparkle on LEFT and exact original SONDAR wordmark on RIGHT. Match original red orange yellow gradient and original letterforms. Horizontal 4:1 lockup filling canvas with minimal margins. Smooth pristine edges without texture, speckles or noise. No redesign or extra elements. Text exactly SONDAR.

Icono:

Production square app icon: extract exact musical note symbol from reference including its three arcs, orbit, and sparkle. Remove word SONDAR. Preserve original geometry and red-orange-yellow gradient. Center symbol on solid uniform black #000 square canvas with 15% margin on all sides for app icon masking safety. Crisp smooth pristine edges. No texture, no noise, no stray pixels, no other elements. Do not redesign.

## Verificación

- `npm run typecheck --prefix sondar-mobile`: correcto.
- `git diff --check`: correcto.
- Compilación web: bloqueada por resolución de la dependencia existente `@emailjs/browser` en Soporte.jsx y reportarContenido.js.
- Los archivos originales y las referencias de los marcadores del mapa permanecen sin cambios.