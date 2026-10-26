# Migracion a Expo SDK 58 — 2026-10-26

Se actualizo SONDAR Mobile de Expo 57.0.19 a 58.0.19 para abrir el proyecto con Expo Go SDK 58 en un iPhone fisico.

- React 19.3.0 y React Native 0.88.0, con modulos nativos y herramientas de desarrollo alineados mediante el catalogo de Expo.
- Expo de la raiz actualizado a la misma version para evitar SDK mezclados.
- Referencias de TextInput y ScrollView adaptadas a los tipos de instancia publicos de React Native.
- Compatibilidad de listas vacias, color de iconos y generic explicito de WebView 14.0.1. El generic evita que el valor por defecto undefined de la declaracion de WebView convierta sus props en never.
- No se modifico el recomendador, el catalogo de generos, los archivos de entorno ni la base de datos.

La resolucion inicial encontro un conflicto con la dependencia opcional react-native-windows del selector de fechas. Se resolvio desde un arbol limpio y se comprobo con npm ci normal; no se agregaron flags force ni legacy-peer-deps.

Validacion completada:

- Instalacion reproducible de la app con npm ci.
- expo install --check: dependencias actualizadas.
- Expo Doctor: 20 de 20 comprobaciones aprobadas.
- TypeScript y ESLint: sin errores ni advertencias.
- Las cuatro pruebas de normalizacion y catalogo movil aprobadas.
- Bundles Hermes de iOS y Android exportados correctamente, usando valores publicos ficticios y sin cargar los archivos de entorno.
- git diff --check correcto.

Las herramientas se ejecutaron con Node 24.22.1 preparado en tmp/expo-sdk58-tools. La instalacion de Node de Windows no se reemplazo: sigue siendo Node 25.9.0, que no esta admitido por SDK 58. La raiz y la app declaran el requisito de Node y .nvmrc recomienda Node 24. Usar Node 24 LTS para las instalaciones y el arranque habituales.

Cerrar el servidor Expo anterior, ejecutar npm run dev:mobile:clear desde la raiz y escanear el QR nuevo. La comprobacion final en el iPhone real sigue siendo necesaria; generar bundles no equivale a ejecutar todas las funciones en el dispositivo.

Fuentes oficiales: [actualizacion del SDK](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/), [notas SDK 58](https://expo.dev/changelog/sdk-58), [migracion de Router](https://docs.expo.dev/router/migrate/sdk-57-to-58/).
