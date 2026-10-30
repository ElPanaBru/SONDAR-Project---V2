# Comparación previa: web, móvil, Docker y Supabase

Fecha: 30 de octubre de 2026. Fuente de verdad: `Web_BDD_Local`, por decisión del propietario. Este informe conserva la comparación previa; la implementación del entorno está en [DOCKER_LOCAL_UNIFICADO.md](DOCKER_LOCAL_UNIFICADO.md).

## Resultado y decisión de arquitectura

Es viable trabajar con ambos clientes sobre una misma PC y una misma instancia local de Supabase. La integración requiere adaptar el móvil a la API y al esquema web. Docker por sí mismo no resuelve sus diferencias funcionales.

La arquitectura implementada es una API web compartida, un servicio Vite y un servicio Metro, más los servicios de Supabase administrados por su CLI. Un script coordina CLI y Compose. El teléfono o emulador ejecuta la aplicación nativa; Metro ejecuta el servidor de desarrollo dentro del contenedor.

No conectar el backend móvil actual a la base compartida: contiene escrituras y creación de estructuras antiguas. La alternativa de dos APIs compartiendo una base queda descartada para esta integración inicial. No aplicar `20261030120000_compatibilidad_mobile.sql`.

## Alcance y método

- Se leyó `AGENTS.md`, los manifests, los scripts y el código real. El árbol Git estaba limpio al comenzar.
- Se actualizaron las referencias con `git fetch --all --quiet`; no se cambiaron ramas ni se hicieron merges, commits o pushes.
- Se compararon web `e9c8709`, móvil local `7426490` y la referencia móvil remota `ac9091b`.
- `Web_BDD_Local` y `TheMovile` coincidían con sus respectivos remotos después del fetch. `Mobile-Local` es una rama local sin upstream configurado; no confundirla con `TheMovile`.
- Las ramas web y móvil local tienen 90 y 32 commits exclusivos, respectivamente. Un merge global tendría un alcance mucho mayor que esta tarea.
- Se extrajeron copias temporales de código y recursos sin copiar archivos de entorno, respaldos ni datos de aplicación versionados.
- Los dos volúmenes PostgreSQL existentes se montaron exclusivamente en lectura para copiarlos. Las copias se iniciaron sin red y sin puertos publicados; las consultas de inspección usaron lectura por defecto. No se leyeron filas personales.
- Las migraciones y las solicitudes funcionales se probaron en bases temporales con datos ficticios. Ninguna prueba se conectó a producción ni aplicó migraciones a los volúmenes originales.

Los resultados estructurados, las rutas con archivo/línea y las referencias HTTP del cliente están en [comparacion-2026-10-30.json](docker-preflight/comparacion-2026-10-30.json). La extracción de referencias HTTP es estática y heurística: no representa cobertura completa de todos los valores dinámicos.

## Equipo y herramientas

| Elemento | Observación | Consecuencia |
|---|---|---|
| Sistema | Windows, repositorio dentro de OneDrive | Medir recarga y acceso a archivos; preferir un checkout de desarrollo fuera de sincronización, o en WSL |
| RAM física | Aproximadamente 15,3 GiB | Usar una sola instancia Supabase para integración |
| Memoria visible para Docker | Aproximadamente 7,4 GiB | Evitar levantar dos stacks completos y un emulador pesado simultáneamente sin medir |
| Disco al inicio | Aproximadamente 92,9 GiB libres | Suficiente para las pruebas realizadas; imágenes y paquetes consumen espacio |
| Docker Engine / Compose | 29.8.1 / 5.5.1 | Se verificó ejecución de contenedores Linux |
| Node del host | 25.9.0 | No satisface `engines` del móvil y Metro; npm emite `EBADENGINE` |
| Node probado en Docker | 24.22.2, imagen `node:24-bookworm-slim` | Instalación, pruebas y builds comprobados; fijar versión/digest en la implementación |
| Supabase CLI del proyecto | 2.119.0 | Utilizar la instalación y el lockfile del proyecto; no actualizar durante la integración sin validación |
| Red Wi-Fi | Perfil Windows `Public` | Comprobar acceso LAN con reglas acotadas antes de probar el teléfono; no cambiar perfiles ni abrir puertos globalmente desde el arranque |
| Android SDK | No apareció `adb.exe` en la ubicación estándar | No se verificó un dispositivo o emulador; esto no demuestra que el SDK no exista en otra ubicación |

Docker recomienda el filesystem Linux para bind mounts y notificaciones de cambios en WSL. No se movió el checkout actual: esa ubicación debe elegirse al preparar el entorno. [Prácticas oficiales de WSL](https://docs.docker.com/desktop/features/wsl/best-practices/).

## Base de datos: repositorio frente a volúmenes reales

Se contrastaron las copias offline de `supabase_db_SONDAR-Project---V2` y `supabase_db_sondar-mobile-local`. Esto describe el contenido local persistido al momento de la copia; no certifica ningún despliegue remoto.

| Objeto inspeccionado | Web | Móvil |
|---|---:|---:|
| Tablas públicas | 36 | 39 |
| Columnas públicas | 246 | 261 |
| Restricciones públicas | 148 | 161 |
| Políticas de public y storage | 88 | 92 |
| Índices públicos | 94 | 102 |
| Registros de triggers inspeccionados en public/auth | 15 | 15 |
| Funciones públicas | 11 | 11 |
| Migraciones registradas | 5 | 6 |
| Buckets | 3 | 3 |

Los registros de triggers se cuentan por evento; no equivalen necesariamente al número de nombres únicos de trigger. Las funciones se inventariaron por nombre y firma, sin afirmar equivalencia completa de todos sus cuerpos.

Las primeras cinco migraciones son idénticas entre ambas ramas. El volumen web registra exactamente ese historial y pasa `verificarContrato`: no faltan tablas o columnas requeridas y el catálogo activo tiene los siete géneros esperados.

La base móvil agrega:

- `profile_community_posts`.
- `profile_community_comments`.
- `user_genre_preferences`.

La web utiliza `perfil_comunidad_publicaciones`, `perfil_comunidad_respuestas` y `user_interests`. El onboarding web guarda la identidad visible en `users.display_name`; no debe reemplazarse por los contratos históricos de `artist_name`/`full_name` del backend móvil.

En los objetos comunes coinciden tipos y nulabilidad de columnas, definiciones de restricciones, políticas, índices y acciones de los triggers inspeccionados. La diferencia de 15 columnas totales se explica por las 17 columnas de las tablas móviles adicionales y dos columnas presentes solamente en la web.

**Diferencia real respecto a instalación nueva:** el volumen web tiene `users.deletion_requested_at` y `users.deletion_scheduled_at`, ausentes del resultado de las cinco migraciones aplicadas desde cero. El contrato actual permite estas columnas adicionales. Conservarlas y revisar sus dependencias antes de decidir si constituyen una personalización o un cambio que deba versionarse. No eliminarlas ni agregarlas automáticamente al móvil.

Los buckets `perfiles` y `eventos` aceptan imágenes de hasta 5 MiB; `reels`, archivos de hasta 20 MiB. La implementación conserva la configuración de Storage de la rama web, incluidos sus tipos MIME.

El inventario de publicaciones Realtime difiere entre volúmenes, pero no prueba por sí solo un fallo: la mensajería web usa broadcast privado mediante triggers, no una suscripción `postgres_changes` a `public.messages`. El broadcast se comprobó funcionalmente en el stack temporal.

## Matriz de incompatibilidades del cliente móvil

Se inventariaron 72 rutas web y 65 rutas del backend móvil: 51 coinciden por método y ruta normalizada, 14 existen sólo en móvil y 21 sólo en web. Una ruta coincidente no implica igualdad de payload, permisos o respuesta.

| Área | Comportamiento móvil actual | Contrato web / adaptación necesaria | Evidencia |
|---|---|---|---|
| Registro y Auth | Registro por API y login Supabase | Compatible en el caso probado; mantener validación de identidad del servidor | HTTP 201 y login correcto |
| Onboarding | Multipart con `nombre`, `bio`, `birthDate`, `genres`, avatar opcional | Compatible sin avatar en la prueba, con al menos tres géneros válidos; usar `user_interests` de la web | HTTP 200 |
| Perfil | Espera `comunidad` con `adjunto`/`comentarios` históricos y colección `favoritos` | La respuesta web no incluye `comunidad` y devuelve `likes`. Cargar la comunidad por `/api/comunidad-perfil/:identificador`; adaptar `reel`, `evento`, `autor`, `respuestas` y colecciones según el contrato web | Código y respuesta real de perfil |
| Publicar en perfil | `POST /api/usuarios/me/comunidad`, `attachmentType`, `attachmentId` | `POST /api/comunidad-perfil/publicaciones`, con `texto` y `reelId` o `eventoId`; adjuntos deben pertenecer al usuario | Ruta móvil 404; web 201 |
| Responder en perfil | `/api/usuarios/comunidad/:id/comentarios` | `/api/comunidad-perfil/publicaciones/:id/respuestas`, con árbol `parentId` | Comparación de rutas/controladores |
| Denunciar publicación de perfil | Ruta histórica de usuarios | No se identificó equivalente directo en las rutas web; decidir comportamiento sin confundir una denuncia de publicación con una de perfil | Inventario |
| Membresías | `PUT` para unirse y `DELETE` para salir | Web usa `POST` alternante. Adaptar estado y bloquear doble toque; no reintentar automáticamente un toggle | PUT 404; POST 200 |
| Guardar comentario de foro | `PUT`/`DELETE` | Web usa `POST` alternante | Comparación de rutas |
| Eliminar comentario de foro | `DELETE /api/comunidades/comentarios/:id` | No existe en la API web actual; resolver la diferencia funcional antes de habilitar el control móvil | Inventario |
| Mensajes | `/api/mensajes` y `/api/mensajes/:id`; `recipientId`/`text` | `/api/mensajes/conversaciones`, `/conversaciones/:id/mensajes`; `userId`/`texto`; lectura por `PATCH` | Ruta móvil 404; creación/envío web 201 |
| Respuestas de mensajes | `person`, `lastMessage`, `updatedAt`, `unread`, `text`, `mine` | Adaptar `usuario`, `ultimoMensaje`, `ultimaActividad`, `noLeidos`, `texto`, `propio`, `creadoEn` | Mapeadores reales |
| Eventos | Envía `FormData` aunque no adjunte imagen | API web espera JSON; enviar lista `generos`, lugar, fecha, precio, link, coordenadas y organizadores | Multipart 400; JSON 201 |
| Presentación de eventos | Espera título/descripción | La web elimina explícitamente esos campos de la respuesta; adaptar presentación al creador, lugar y fecha | Respuesta real y `mapearEvento` |
| Previews de varios géneros | Envía `genero: 'rock / funk'` | Enviar `generos` como lista JSON dentro del multipart, preservando orden | Concatenado 400; lista 201 |
| Fragmento de audio | El selector móvil no recorta físicamente el archivo | API web no procesa offsets. La integración publica el audio completo y lo informa claramente; para publicar un fragmento hay que recortarlo antes de seleccionar el archivo | Adaptación en código; reproducción nativa pendiente |
| Aprendizaje de escucha | Móvil registra `/visita` al mostrar una tarjeta | Integrar `/interaccion` con sesión de escucha y tiempos reales; conservar distinción entre exposición y reproducción. No portar pesos del algoritmo móvil | Endpoint web responde 202 y persiste sesión |
| Borrado de cuenta | Revalida contraseña en Supabase, pero manda DELETE sin cuerpo | Web exige además `{password}` en esa solicitud | HTTP 400 sin cuerpo |
| Borrado de eventos/previews | DELETE sin contraseña | Web exige `{password}` mediante middleware | Evento: HTTP 400 |
| Soporte | Abre un `mailto:` | No depende de la API de soporte móvil; mantener la diferencia documentada | Código de pantalla |

No remover validaciones, RLS, confirmaciones de contraseña ni control de pertenencia del servidor para hacer pasar el móvil. La adaptación se realiza en sus llamadas y modelos; cualquier nueva capacidad de la API web debe conservar su contrato y sus pruebas.

## Redes, URLs y configuración

Las ramas hoy usan identificadores y puertos Supabase distintos:

| Servicio | Web | Móvil local |
|---|---:|---:|
| API Express | 3000 | 3000 |
| Vite | 3001 en arranque principal | También contiene frontend web |
| Metro | — | 8081 |
| API Supabase | 54321 | 55321 |
| PostgreSQL | 55432 | 55322 |
| Studio | 54323 | 55323 |

Que Supabase use puertos diferentes permite dos instancias, pero las APIs siguen colisionando en 3000 si se inician juntas. El entorno integrado usa una sola API y conserva los puertos de Supabase web.

Entre servicios Compose se usarán nombres DNS como `api:3000`. Para acceder desde un contenedor a servicios publicados por Docker Desktop se puede utilizar `host.docker.internal`. El navegador y el teléfono requieren direcciones accesibles desde su propia red: `localhost` en el teléfono apunta al teléfono. [Redes de Compose](https://docs.docker.com/compose/how-tos/networking/) y [acceso al host](https://docs.docker.com/desktop/features/networking/networking-how-tos/).

**Separar URL interna y pública:** la implementación configura `SUPABASE_PUBLIC_URL` para que los enlaces nuevos de Storage usen `localhost:54321`; el cliente móvil los envía por Metro a la dirección LAN de la PC. Las referencias históricas deben revisarse por separado; no hacer reemplazos masivos sin inventario y respaldo.

Metro reenvía HTTP de `/api` y `/supabase` usando `SONDAR_LOCAL_API_URL` y `SONDAR_LOCAL_SUPABASE_URL`, y el proxy implementa el upgrade WebSocket de `/supabase/realtime/v1/websocket`. La integración en ejecución, incluida la conexión Realtime desde un teléfono, queda pendiente de validar.

El teléfono recibe el host LAN de Metro en el QR; el gateway de Supabase y la API permanecen sin publicación directa en la LAN. No se agrega Nginx ni otro proxy adicional.

La API ahora acepta los orígenes de desarrollo local en el puerto 8081 además de 3001/5173, y conserva `PATCH` para mensajería. Las llamadas nativas de API se enrutan por Metro.

Revisar redirects de Auth para web, LAN y `sondar://`, usando destinos de desarrollo concretos. No transportar indiscriminadamente los patrones amplios de la configuración móvil al entorno compartido.

## Scripts y archivos que no se pueden trasladar directamente

- `scripts/local-supabase.cjs` del móvil ejecuta `migration up --local` al arrancar y genera archivos locales de entorno. No usarlo en la integración: aplicaría su historial móvil.
- `scripts/dev-mobile.ps1` puede detener procesos por puerto y reemplazar variables del proceso. El flujo integrado usa `dev-docker.ps1` y no termina procesos ajenos.
- La raíz móvil contiene scripts PowerShell y un arranque con `&` que no es una base portable para el contenedor Linux. Metro se inicia con un wrapper Node dentro del contenedor.
- El backend se ejecuta con `SONDAR_SCHEMA_MODE=manual` para impedir DDL automático; Supabase CLI aplica al iniciar únicamente el historial de migraciones web.
- La herramienta web `db:actualizar` acepta sólo hosts loopback; desde un contenedor `host.docker.internal` no cumple esa guarda. Mantener su ejecución local/controlada o usar el flujo CLI local previsto. No debilitar la guarda para aceptar cualquier servidor.
- Las ramas difieren en selección de `.env` y `.env.local`. Compose genera configuración local explícita y monta archivos vacíos sobre los entornos de desarrollo personales para evitar fallback a servicios remotos.
- Los `.env` versionados de Mobile-Local se conservaron; `.dockerignore` los excluye del contexto y los bind mounts los enmascaran dentro de los contenedores.
- `.dockerignore` excluye `.git`, entornos, `node_modules`, respaldos, uploads y resultados temporales del contexto Docker.
- `shared` está montado en Metro; `lib/genres.ts` importa `../../shared/generos.json`. Los catálogos web/móvil son idénticos. Web y móvil conservan `node_modules` separados por sus dependencias distintas.
- El README móvil de esta integración quedó alineado con Expo SDK 58 y con el arranque Docker coordinado desde la raíz.
- El controlador de soporte web instancia Resend durante la carga. La prueba utilizó una clave ficticia local y no envió correo; el arranque compartido debe definir y probar el comportamiento cuando soporte no esté configurado.

Las variables `EXPO_PUBLIC_*` se integran en el bundle y no son un lugar para claves privilegiadas. [Variables de Expo](https://docs.expo.dev/guides/environment-variables/).

## Verificaciones ejecutadas antes de la integración

Los siguientes resultados corresponden a la auditoría temporal previa y no validan el traslado de los cambios a Mobile-Local.

| Comprobación | Resultado |
|---|---|
| Validación SQL/catálogo offline web | Correcta |
| Pruebas web, host | 114 backend + 3 frontend correctas |
| Lint web, host | Correcto |
| Build web, instalación actual | Falla: faltan MapLibre y su integración Leaflet; Vite instalado también difiere del lockfile |
| `npm ci` y build web en copia limpia Windows | Correctos, con Vite 8.3.5 del lockfile |
| `npm ci`, 114 pruebas backend y build web en Docker/Node 24 | Correctos |
| `npm ci`, 20 pruebas móvil, typecheck y lint en copia Windows | Correctos; advertencias de engines por Node 25 |
| `npm ci` y 20 pruebas móvil en Docker/Node 24 | Correctos |
| Exportación Expo Android en Docker | Correcta: 1770 módulos, bundle Hermes y assets. No es compilación APK ni prueba en dispositivo |
| Contrato de base sobre copia del volumen web | Correcto; cinco versiones registradas y siete géneros |
| Pruebas SQL aisladas | 12 comprobaciones correctas, incluyendo cinco migraciones, seed, reaplicación, normalización, preservación de tabla personal y RLS |
| Stack temporal Supabase + API web en Docker | Inició correctamente con esquema manual y migraciones exclusivamente web |
| Solicitudes funcionales de integración | 30 comprobaciones concordaron con los resultados esperados; incluyen reproducciones deliberadas de incompatibilidades 400/404/500 |
| Storage | Carga de WAV ficticio mediante API con JWT de usuario y entrega pública HTTP 206 por Range |
| Realtime | Suscripción privada y recepción del broadcast de mensaje real entre dos usuarios ficticios, directamente contra Supabase |

Las inspecciones de volúmenes usaron PostgreSQL 17.6. El stack desechable iniciado por CLI descargó PostgreSQL 17.11 y Storage v1.79.28; las pruebas funcionales corresponden a esa combinación. La reproducción estable debe registrar y fijar las versiones efectivas, además de conservar `major_version=17`.

El fallo inicial de build no requiere modificar imports ni actualizar dependencias: la instalación limpia del lockfile compiló en Windows y Linux. Reinstalar con `npm ci` en el checkout de desarrollo elegido después de preservar cualquier necesidad local; esta auditoría no reemplazó los paquetes del checkout original.

## Plan original y estado actual

1. Completado: backend, frontend y migraciones web trasladados al worktree existente Mobile-Local; cliente Expo adaptado para consumir esa API.
2. Completado: Node 24 fijado en Docker, contextos acotados y volúmenes de dependencias separados para API, web y móvil.
3. Completado: URLs internas y públicas configuradas; backend en modo manual y CLI de Supabase usa el historial SQL web.
4. Completado en código: adaptaciones móviles de perfil, comunidad, mensajes, eventos, previews, escucha, guardados y confirmación de borrado.
5. Pendiente: validar en ejecución las interacciones, los contratos, RLS y reintentos en el entorno combinado.
6. Completado: Compose levanta `api`, `web` y `mobile`; un script PowerShell coordina Supabase CLI y Compose sin montar el socket Docker en los servicios de aplicación.
7. Pendiente: recorrido real simultáneo con navegador y teléfono, incluido QR LAN, Media Range, Realtime y persistencia tras reinicio.
8. Completado: arranque y parada documentados en `DOCKER_LOCAL_UNIFICADO.md`; la parada conserva los datos.

Supabase CLI administra múltiples servicios Docker; un PostgreSQL aislado no sustituye Auth, Storage y Realtime. Mantener el flujo de desarrollo existente reduce el trabajo respecto de adoptar ahora todo el stack autohospedado. [Desarrollo local de Supabase](https://supabase.com/docs/guides/local-development), [autohospedaje](https://supabase.com/docs/guides/self-hosting/docker) y [Expo CLI](https://docs.expo.dev/more/expo-cli/).

## Límites pendientes

- En el arranque de `Mobile-Local`, Docker Desktop publicó PostgreSQL y Kong con `HostIp=0.0.0.0` pese a crear la red con `host_binding_ipv4=127.0.0.1`. En esta PC, la regla administrada de `com.docker.backend.exe` permite tráfico entrante; el script detiene Supabase y conserva los volúmenes antes de iniciar Compose. El recorrido combinado queda bloqueado hasta disponer de un bind de loopback efectivo.
- No se probó una sesión gráfica completa de la web ni un teléfono/emulador. Las pruebas HTTP no garantizan comportamiento visual, permisos nativos ni reproducción real.
- La revisión previa no pudo iniciar Metro en Docker. Mobile-Local incluye el servicio y sus proxies HTTP/WebSocket, pero no se inició al trasladar los cambios; QR LAN, Realtime móvil y el recorrido visual siguen pendientes de validar.
- La API temporal se verificó con configuración y usuarios ficticios, sin correo externo ni proveedores OAuth reales. Confirmar recuperación de contraseña, OAuth y redirects cuando correspondan.
- La comparación de metadata detecta diferencias estructurales, pero no certifica igualdad de datos ni todas las definiciones internas de funciones. No se inspeccionaron secretos ni proyectos remotos.
- El esquema de la copia web es válido, pero conserva dos columnas adicionales a una instalación nueva. Su intención y dependencias requieren una decisión antes de convertir cualquier diferencia en migración.
- Los seis volúmenes originales se conservaron y no hay contenedores en ejecución al finalizar. La API y el stack temporal se detuvieron; los contenedores de las dos copias PostgreSQL se retiraron. La revisión automática rechazó el borrado de los siete volúmenes temporales restantes y de la carpeta temporal con el motivo genérico `blocked by policy`; no se reintentó. Sus nombres y la carpeta se registran en `cleanup` del JSON. Esos recursos quedan pendientes de limpieza y las imágenes descargadas permanecen como caché. La carpeta temporal contiene únicamente las copias de auditoría y configuración generada para el stack ficticio; no se incorporó a Git.

La comparación previa confirmó el backend web y sus migraciones en un stack temporal. La adaptación del contrato móvil está implementada en esta rama; falta validar el recorrido integrado con web, API, Supabase y un teléfono en la LAN.
