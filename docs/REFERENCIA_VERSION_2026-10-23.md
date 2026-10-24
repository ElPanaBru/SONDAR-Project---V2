# Referencia de SONDAR antes de abrir una version anterior

Fecha: 2026-10-23. Solicitud: conservar esta version como referencia para adaptar posteriormente una version mas vieja en este mismo chat.

## Identificacion exacta

- Commit: `4d8826bdabf5e6db81a69ef50bdc52d80cc5a447`.
- Rama observada: `Web_BDD_Local`.
- El arbol de trabajo estaba limpio antes de crear este documento.
- Este commit permite consultar el codigo original con `git show 4d8826bdabf5e6db81a69ef50bdc52d80cc5a447:ruta/del/archivo` y comparar con `git diff <commit-viejo> 4d8826bdabf5e6db81a69ef50bdc52d80cc5a447 -- Backend Frontend shared supabase` si ambos commits siguen disponibles.
- Conservar este documento y el historial del repositorio al cambiar de version. Este resumen no es un respaldo completo del codigo.

## Estructura comprobada

- `Backend`: Node.js CommonJS, Express 5, PostgreSQL mediante pg, Supabase, multer y resend. Entrada `Backend/index.js`; rutas, Controllers, services, middlewares, database, scripts y tests separados.
- `Frontend`: React 19, React Router 7 y Vite; Leaflet y MapLibre para mapas. Entrada de rutas `Frontend/src/App.jsx`.
- `shared/generos.json`: catalogo compartido de generos.
- `supabase/migrations`: cinco migraciones versionadas, desde `20260930151057_remote_schema.sql` hasta `20261022120000_alinear_catalogo_y_contrato.sql`; tambien hay config y seed.
- `sondar-mobile` existe localmente pero en la inspeccion solo contiene dependencias, archivos temporales, configuracion local y logs; no se encontro package.json ni codigo fuente movil en el inventario. No asumir que esta version contiene una aplicacion Expo mantenida.

## Navegacion web comprobada en App.jsx

- `/`: Eventos.
- `/descubrir`: Descubrir.
- `/comunidad`: Comunidad.
- `/buscar`: Buscar.
- `/perfil` y `/perfil/:usuario`: perfil propio y ajeno.
- `/mensajes`, `/configuracion`, `/soporte`, `/auth`.
- Navbar y SidebarNav fuera de autenticacion; PreferenciasProvider, onboarding de perfil y modal global CrearReelModal.
- Sesion Supabase; consulta de perfil a `/api/usuarios/me` para comprobar onboarding.

## API y Descubrir

Backend monta `/api/usuarios`, `/api/eventos`, `/api/reels`, `/api/comunidades`, `/api/comunidad-perfil`, `/api/notificaciones`, `/api/soporte`, `/api/mensajes` y health.

Descubrir web solicita `/api/reels/descubrir`. Esta ruta usa autenticacion opcional y `listarDescubrir`; tambien existe GET `/api/reels/` con `listarReels`.

El controlador importa e invoca `rankCandidates` de `Backend/services/discoverRecommender/recommend.js`. El subsistema contiene config, scoring, diversification, index y recommend. El adaptador construye afinidades con intereses, likes, guardados y creadores seguidos; normaliza los generos, calcula antiguedad y exposicion y llama a scorePreview y diversifyPreviews. Estos son detalles de esta implementacion, no una aprobacion de sus pesos como especificacion futura.

Hay rutas de visita, interaccion de escucha, comentarios y likes de comentarios, compartir, denunciar, like, guardar y eliminar. La escucha usa sessionId y reel_playback_sessions; la actualizacion comprueba que el usuario coincida. No confundir visitas con sesiones de escucha.

Existen componentes de notificaciones, menciones, guardados, compartir, denuncias, confirmacion de eliminacion, perfiles de comunidad y skeletons. Para reproducir detalles visuales o comportamiento exacto, consultar los archivos del commit indicado; no se hizo una revision visual de la app.

## Documentacion y verificaciones disponibles

- `docs/discover-recommender/{current-state,design,mvp,implementation-plan}.md`.
- `docs/BASE_DE_DATOS.md`, `docs/mapas.md`, `docs/LIMPIEZA_2026-10-22.md` y `docs/RETIROS_2026-10-22.csv`.
- La documentacion puede describir estados anteriores: ya existe integracion del recomendador modular en codigo, por lo que hay que contrastarla con el commit.
- Scripts raiz: dev, build, test, lint, verify, db:validar y herramientas manuales de base. dev inicia backend y web en localhost:3001.
- Backend: pruebas node:test, incluidas discoverRecommender y discoverRecommendationAdapter, contratos, interacciones, mensajes, comunidades, eventos y almacenamiento.
- Frontend: prueba audioFragmento; lint ESLint y build Vite.

## Alcance y continuacion

Esta tarea registra una referencia por inspeccion estatica. No se ejecuto la app ni las pruebas, no se comprobo el esquema desplegado y no se conecto a ninguna base. No se abrieron archivos de secretos ni se aplicaron migraciones.

Cuando el usuario abra la version vieja: identificar su commit y cambios locales, comparar con esta referencia y con el codigo del commit conservado, acordar los cambios concretos si no estan indicados y trasladarlos incrementalmente. No sobrescribir trabajo existente ni dar por implementadas las aspiraciones de AGENTS.md. Las modificaciones de esquema requieren revisar dependencias y nuevas migraciones, con validacion local y autorizacion explicita para operaciones remotas.