# Auditoría de altas y acciones de escritura — SONDAR

Fecha: 7 de octubre de 2026. Alcance: app móvil, frontend web, rutas Express, controladores, servicios de Auth/Storage y esquema PostgreSQL conectado al backend local.

## Resultado

**No está todo correcto.** Se identificaron fallos reproducibles de autorización de roles, validación, persistencia y respuesta al cliente. Esta entrega es una auditoría: no se modificó la lógica de negocio ni se aplicaron migraciones. Los cambios visuales previos se conservaron.

| Comprobación ejecutada | Resultado | Qué demuestra |
|---|---|---|
| Salud del backend con consulta de DB | HTTP 200, database ready | Conectividad con PostgreSQL en ese momento |
| 45 rutas de escritura sin sesión | 45/45 devuelven 401 | Protección de entrada sin autenticación; no demuestra autorización entre usuarios |
| Registro inválido y token inválido | 4/4 rechazos correctos | Tres validaciones tempranas de registro y un token inválido |
| Controladores y handler web con dependencias aisladas | **67 casos: 47 pasan y 20 fallan** | Ejecución del código real con DB/Auth/Storage simulados; los 20 casos se agrupan en varios defectos |
| Esquema real, transacción READ ONLY | 39 tablas, 263 columnas, 161 restricciones, 103 índices, 14 entradas de triggers, 88 políticas | Metadatos actuales, incluyendo políticas de storage; las entradas de triggers pueden repetir un trigger por evento |
| 12 consultas de integridad agregadas | Todas devuelven cero inconsistencias buscadas | No se detectan esos problemas en los registros actuales; no prueba que futuros envíos sean correctos |
| TypeScript móvil | Pasa, sin emitir archivos | Coherencia de tipos; no valida comportamiento visual ni persistencia |
| Build web | **Falla** | Vite no resuelve @emailjs/browser en Soporte.jsx y reportarContenido.js en este entorno |

No se crearon cuentas, publicaciones, comentarios, mensajes ni archivos de prueba en los servicios reales. No se enviaron correos ni notificaciones a personas. Las solicitudes reales de escritura fueron deliberadamente inválidas o sin sesión y fueron rechazadas. Los casos exitosos se ejecutaron con dobles aislados, no contra PostgreSQL real.

## Hallazgos prioritarios

### A01 — Alta: el cliente puede asignarse el rol admin

- Backend/Controllers/usuarioController.js:906–985 y 1646–1672.
- crearCuenta y registrarUsuario usan directamente user_type del cuerpo. La segunda ruta hace UPSERT y actualiza user_type de una cuenta existente.
- Reproducido: ambos controladores devuelven un usuario con user_type=admin al recibir ese valor. La restricción real users_user_type_check acepta admin.
- No se verificó la existencia de funciones administrativas explotables ni se convirtió ninguna cuenta real. El defecto confirmado es la asignación no autorizada del rol persistido.
- Corrección: decidir el rol público en el servidor y excluir roles privilegiados del registro y del UPSERT. Gestionar cambios privilegiados en un flujo separado y autorizado.

### A02 — Alta: un reel puede quedar guardado con sus archivos borrados

- Backend/Controllers/reelController.js:635–695.
- El INSERT se confirma sin transacción. Después se consulta el avatar del usuario. Si esa consulta falla, el catch borra portada y audio aunque la fila del reel ya exista.
- Reproducido mediante fallo inyectado en esa lectura: un INSERT, HTTP 500, eliminación de ambos archivos y ningún rollback.
- Corrección: distinguir los fallos anteriores y posteriores a la persistencia; nunca limpiar archivos ya referenciados por un reel confirmado. Evitar que una lectura auxiliar invalide el alta.

### A03 — Alta: respuestas vinculadas a un comentario de otro contenido

- Backend/Controllers/reelController.js:519–557; Backend/Controllers/comunidadController.js:619–660.
- parentId se inserta sin verificar que pertenezca al mismo reel o publicación. La consulta posterior del padre tampoco establece esa relación.
- Ambos casos fueron aceptados por los controladores aislados. En la DB real las FK de estas tablas sólo verifican existencia del padre; no hay un trigger que compruebe coincidencia de contenido. El trigger de perfil_comunidad_respuestas pertenece a otra tabla y no protege estos endpoints.
- Impacto: respuestas fuera del hilo, notificación al usuario equivocado y eliminación en cascada vinculada a otro contenido.
- Corrección: comprobar padre y contenido juntos, idealmente con una garantía equivalente en PostgreSQL.

### A04 — Alta: Comunidad web muestra comentarios que no se guardaron

- Frontend/src/paginas/Comunidad.jsx:542–599.
- Cuando falla fetch, el catch agrega un comentario local y luego vacía el borrador. No hay cola persistente ni mecanismo de reenvío en ese handler.
- Reproducido ejecutando el handler con error de red: aparece un comentario y el borrador queda vacío.
- Corrección: mantener el texto y mostrar error; agregar el comentario sólo después de una respuesta exitosa o implementar explícitamente una cola con estado pendiente.

### A05 — Media: ID y fecha incorrectos al comentar en un perfil

- Backend/services/profileCommunityService.js:206–226, mapComment:83–92.
- La mezcla de la fila del comentario con SELECT * FROM users sobreescribe id y created_at con los del usuario.
- Reproducido: un comentario cuyo ID es 21 se devuelve con el UUID del autor y con una antigüedad calculada desde la creación de su cuenta.
- Impacto: claves repetidas al comentar varias veces, fecha incorrecta y discrepancia entre la respuesta de creación y la recarga del listado.
- Corrección: seleccionar únicamente columnas de presentación del autor o usar alias sin sobreescribir columnas del comentario.

### A06 — Media: validaciones de eventos incompletas y distintas entre web y móvil

- Backend/Controllers/eventoController.js:325–395; sondar-mobile/app/(tabs)/index.tsx:150–162; Frontend/src/paginas/Eventos.jsx:650–681.
- El servidor permite llegar al INSERT con título en blanco tras trim, coordenadas fuera de rango y fecha inválida o pasada. No valida el género contra el catálogo ni el esquema del enlace.
- Cero numérico en latitud/longitud se rechaza como dato faltante; la cadena "0" enviada por FormData sí pasa. Es una inconsistencia del contrato, no un fallo que necesariamente aparezca desde los formularios actuales.
- La web impide eventos pasados y a más de dos meses; la app y el backend no aplican la misma regla.
- Las pruebas aisladas confirman ausencia de validación antes del INSERT. **No afirman que PostgreSQL acepte una fecha imposible**: el tipo timestamp puede rechazarla con un 500. Existe además un trigger geográfico que transforma las coordenadas, pero no una validación de rango en el controlador.
- Precio negativo/no numérico, descripción >1000 y organizadores inválidos o más de ocho sí se rechazan en los casos probados.

### A07 — Media: validación de fechas y límites del perfil inconsistente

- Backend/Controllers/usuarioController.js:137–153, 1048–1145, 1335–1378.
- La fecha 2000-02-31 supera la validación JavaScript de onboarding porque Date normaliza el día. La fecha original inválida se envía al UPDATE; PostgreSQL puede rechazarla posteriormente. Caso reproducido con DB simulada.
- Onboarding exige nombre de 2–80 y bio de hasta 180; editar perfil acepta nombre >80 y bio >180. Ambos casos fueron reproducidos.
- Borrar bio no borra artist_bio. mapearUsuarioPerfil usa bio || artist_bio y puede restaurar la biografía anterior en la respuesta. Reproducido.
- Corrección: compartir validaciones y sincronizar las columnas equivalentes; comprobar que la fecha reconstruida coincida exactamente con la recibida.

### A08 — Media: validación de reels y errores de archivos

- Backend/Controllers/reelController.js:618–655; Backend/services/storageService.js:40–82; Backend/routes/reels.js:7–26.
- El texto del error promete fragmentos de 1–30 segundos, pero se aceptan 0,5 segundos. También se aceptan títulos formados por espacios. Casos reproducidos.
- No se comprueba en el servidor que el fragmento exista dentro de la duración real del archivo. La UI y la metadata del cliente no reemplazan esa validación.
- Storage rechaza MIME no admitido e imagen >5 MB/audio >20 MB: probado en aislamiento. Los errores se convierten generalmente en 500 en los controladores, aunque sean errores de entrada. Los errores de Multer no tienen un manejador JSON propio en index.js.
- Corrección: validar texto, duración y archivos antes del alta; devolver errores 400/413 adecuados y homogéneos.

### A09 — Media: tipos de entrada incorrectos provocan excepciones

- Backend/Controllers/reelController.js:521–523; Backend/Controllers/comunidadController.js:621–623; existen patrones similares en registro y perfil.
- texto:123 lanza una excepción en trim antes del try del controlador. Reproducido en los dos tipos de comentario.
- Corrección: validar estructura y tipos antes de usar métodos de string, y centralizar respuestas de error. No confundir body JSON bien formado con campos válidos.

### A10 — Media: protección contra doble envío y concurrencia desigual

- Crear evento móvil no tiene lock síncrono como publishLock de reels/comunidad; depende del estado busy y del botón deshabilitado. Onboarding y envío de mensajes tampoco tienen la misma protección con ref. Es un riesgo de invocación rápida; no se reprodujo tocando un dispositivo.
- Comunidad web crearHilo y responder carecen de bloqueo de envío; Descubrir web comentar/responder tampoco bloquea solicitudes simultáneas.
- Backend: follows, event_saves, likes de comentarios y toggles de Comunidad consultan existencia y luego insertan sin serializar esa decisión. Las PK evitan duplicados pero una carrera puede dar 23505/500; en contadores incrementales, dos bajas concurrentes pueden desajustar el total. Revisado por código y restricciones, no bajo carga real.
- Likes/guardados del reel sí bloquean la fila del reel con FOR UPDATE y recalculan desde la tabla fuente. Compartidos/visitas usan ON CONFLICT para la relación, pero su recálculo concurrente del contador merece prueba de carga específica.
- Corrección: estado deseado idempotente, protección por acción y transacciones/locks donde corresponda. Un lock visual no resuelve reintentos de red.

### A11 — Media: bloqueos no se aplican uniformemente a las escrituras

- Mensajes y seguir consultan user_blocks. buscarAccesoReel, buscarAccesoEvento y las altas de comentarios comprueban principalmente existencia; el servicio del muro del perfil tampoco consulta bloqueos antes de insertar un comentario.
- El acceso por ID conocido puede eludir la intención de ocultar cuentas entre sí. Es una revisión de autorización por código, no una prueba contra dos cuentas reales.
- Las políticas RLS no bastan para concluir que estos endpoints están protegidos: el backend conecta mediante pg y no establece la identidad Supabase por solicitud. Varias políticas de inserción directa sólo verifican user_id=auth.uid(), sin membresía o bloqueo.
- Corrección: aplicar una regla de acceso común en cada escritura y revisar las políticas de acceso directo junto con sus grants.

### A12 — Media: recuperación de perfil y actividad automática incongruentes

- authMiddleware.js exige que users ya contenga el usuario. Por eso /usuarios/registrar no puede reparar un perfil faltante, aunque el flujo de login web intente usarlo para ese fin. Se comprobó el rechazo 403 del middleware aislado.
- profileCommunityService.js:50–67 recrea publicaciones automáticas al leer el perfil. Eliminar una de esas publicaciones puede hacer que reaparezca en la siguiente lectura mientras el reel/evento siga existiendo.
- El trigger real crea actividad en perfil_comunidad_publicaciones, mientras la API utiliza profile_community_posts. Son dos modelos paralelos; no se afirmó que dupliquen visualmente el feed actual.
- createProfileCommunityPost devuelve posts[0] de una nueva consulta, en vez del ID insertado. Una publicación concurrente puede hacer que devuelva otra fila. Riesgo revisado por código.

### A13 — Bloqueo del entorno web y cobertura externa pendiente

- npm run build en Frontend falla al resolver @emailjs/browser. La dependencia está declarada; esta auditoría no determinó si la causa es instalación incompleta o resolución del entorno.
- Soporte web envía por EmailJS y Soporte móvil abre mailto: no crean un ticket en la BDD de SONDAR. Compartir perfil tampoco crea registros.
- Algunas denuncias web guardan en la API y además envían un aviso por correo; no se ejecutó ese envío externo.
- Cambio de contraseña usa Supabase Auth directamente. Se revisó el enlace desde UI, pero no se cambió ninguna contraseña ni se validó una sesión real después de ese cambio. La validación cliente del cambio no exige todas las condiciones que exige el registro.

## Cobertura por flujo

Leyenda: HTTP = rechazo real sin sesión; aislado = código ejecutado con dobles; esquema = restricciones reales; código = revisión del flujo, no prueba de extremo a extremo.

| Acción / botón | Destino persistente | Cobertura y resultado |
|---|---|---|
| Crear cuenta web/móvil | auth.users, auth.identities, users, bienvenida | Registro inválido HTTP; rol y validadores aislados; A01 |
| Registrar perfil / recuperación | users | HTTP, middleware y rol aislados; A01/A12 |
| Completar perfil inicial + géneros | users, user_genre_preferences, avatar | HTTP, transacción y validaciones aisladas; A07 |
| Editar perfil / foto, incluido Navbar web | users, Storage perfiles | HTTP, contratos y casos aislados; A07/A08 |
| Convertir a músico | users.user_type | HTTP y código; genero/bio se devuelven pero no se persisten en ese handler; no se halló botón activo que lo use |
| Crear evento | eventos, Storage eventos | HTTP, validadores y alta aislada; A06/A10 |
| Añadir coorganizadores | event_organizers | Código, límites y JSON aislados; PK/FK reales; misma transacción del evento |
| Guardar evento | event_saves | HTTP, esquema y código; carrera A10 |
| Publicar reel / portada / audio | reels, Storage reels | HTTP, alta y fallos aislados; A02/A08 |
| Comentar reel | reel_comments | HTTP, vacío/válido/tipo aislados; A09/A11 |
| Responder comentario del reel | reel_comments.parent_id | HTTP, aislado y esquema; A03 |
| Like reel / guardar reel | reel_likes, reel_saves, contadores | HTTP, esquema y código; FOR UPDATE comprobado, no carga real |
| Like comentario del reel | reel_comment_likes | HTTP, esquema y código; A10/A11 |
| Compartir reel | reel_shares, reels.compartidos | HTTP, código y UNIQUE; relación idempotente, entrega externa pendiente |
| Registrar visualización | reel_views, reels.visitas | HTTP, código y UNIQUE; la app llama al entrar en visibilidad, no certifica escucha |
| Unirse / salir de comunidad | comunidad_miembros | HTTP, aislado y esquema; ON CONFLICT, PUT/DELETE |
| Publicar en comunidad | comunidad_publicaciones | HTTP, pertenencia y adjunto inexistente aislados; A10 |
| Adjuntar reel/evento a publicación | adjuntos JSON de comunidad_publicaciones | Comprueba existencia y ID; revisión de contrato y esquema; no FK de los IDs embebidos en JSON |
| Comentar/responder comunidad | comunidad_comentarios | HTTP, aislado, esquema y handler web; A03/A04/A09 |
| Like / guardar publicación | tablas de interacciones de Comunidad | HTTP, esquema y código; A10/A11 |
| Like / guardar comentario | comunidad_comentario_likes/guardados | HTTP, esquema y código; guardar por PUT es idempotente |
| Publicar actualización de perfil | profile_community_posts | HTTP, código y esquema; A12 |
| Adjuntar contenido propio al perfil | profile_community_posts | Rechazo de adjunto ajeno aislado; UPSERT de adjunto existente |
| Responder publicación de perfil | profile_community_comments | HTTP y aislado; A05/A11 |
| Seguir / dejar de seguir | follows | HTTP, esquema y código; valida bloqueo y self-follow, carrera A10 |
| Silenciar notificaciones | notification_mutes | HTTP, esquema y código; toggle con patrón de carrera similar |
| Bloquear / desbloquear | user_blocks y limpieza de follows/mutes | HTTP, esquema y código; inserción idempotente y transacción |
| Denunciar perfil/evento/reel/posts | content_reports | HTTP, self-report y repetición aislados; UNIQUE evita repetir el mismo reporte |
| Abrir conversación | conversations, conversation_members | HTTP, destinatario/self inválidos aislados; código/UNIQUE para chat único |
| Enviar mensaje | messages, conversations, notificación | HTTP, vacío/largo/ajeno/bloqueado aislados; envío real pendiente |
| Guardar preferencias | user_settings y metadata Auth | HTTP, valores válidos/idioma/booleanos aislados; UPSERT y transacción |
| Leer notificación / leer todas / limpiar | notifications | HTTP, control de dueño aislado y código |
| Notificaciones automáticas / menciones | notifications | Código y esquema; unique_key, preferencias y silencios; no envío real |
| Contraseña / soporte / compartir perfil | Supabase Auth / email / sistema operativo | Código; no son altas de tablas públicas por la API de SONDAR |
| Borrar contenido/cuenta | tablas y cascadas / Storage / Auth | HTTP sin sesión y revisión de propietarios/cascadas relacionada con altas; sin eliminación real |

Todas las rutas de escritura declaradas en los seis routers con mutaciones están enumeradas en el anexo. /api/posts sólo expone GET /muro y devuelve []; no se encontró una creación persistente en ese router. Registro.jsx contiene un registro antiguo directo en Supabase; el flujo activo de App.jsx usa Auth.jsx.

## Estado de la BDD actual

Las 12 consultas guardadas en inspect-schema.cjs no encontraron: padres cruzados en comentarios de reels/comunidad, títulos o coordenadas inválidas dentro del filtro consultado, fragmentos de reels inválidos dentro del filtro consultado, diferencias en los cuatro contadores de reels ni en likes/guardados de publicaciones de comunidad, audio referenciado sin objeto de Storage o avatar referenciado sin objeto de Storage.

Estas comprobaciones son agregadas y tienen límites: no verifican todos los campos ni cada archivo descargándolo; no detectan duplicados semánticos de contenido ni prueban que el audio se reproduzca. RLS está habilitado en las 39 tablas inventariadas, pero eso no certifica que sus políticas reflejen todas las reglas de negocio.

## Reproducción y evidencia

Desde la raíz del repositorio:

~~~powershell
node docs/auditoria-altas/isolated-checks.cjs
node docs/auditoria-altas/http-checks.cjs
node docs/auditoria-altas/inspect-schema.cjs
~~~

- isolated-checks.cjs: no usa red ni módulos reales de DB/Auth/Storage. Termina con código 1 mientras existan fallos. Algunos validadores se comparan con reglas ya expresadas por el producto (por ejemplo, fecha futura y mínimo de un segundo).
- http-checks.cjs: requiere backend en localhost:3000. Sólo prueba rechazos; no constituye una prueba de altas autenticadas.
- inspect-schema.cjs: usa Backend/.env sin imprimir credenciales y ejecuta SELECT dentro de BEGIN READ ONLY. Guarda metadatos y totales, no contenido de usuarios.
- isolated-results.json, http-results.json y schema-evidence.json contienen los resultados exactos. Los IDs usados en pruebas aisladas son ficticios.
- TypeScript se ejecutó en sondar-mobile con node node_modules/typescript/bin/tsc --noEmit.
- Build web se ejecutó con npm run build en Frontend y quedó bloqueado por resolución de @emailjs/browser.

Para certificar extremo a extremo aún faltan una cuenta de prueba controlada, altas autenticadas con recarga y comprobación de persistencia, pruebas Android/iOS de selectores y cargas, concurrencia real, expiración de sesión durante subida y recuperación de cortes de red. La auditoría no presenta esas pruebas como realizadas.

Orden sugerido de corrección: rol del registro; persistencia y limpieza de archivos; relación padre/contenido; comentario ficticio web; ID/fecha del comentario de perfil; validadores compartidos; protección contra duplicados y bloqueos; reconciliar los dos modelos de actividad del perfil.

## Anexo — rutas protegidas comprobadas por HTTP

| Método | Ruta | Sin sesión |
|---|---|---|
| PUT | /api/usuarios/me/configuracion | 401 |
| PUT | /api/usuarios/me/perfil | 401 |
| PUT | /api/usuarios/me/onboarding | 401 |
| POST | /api/usuarios/me/comunidad | 401 |
| POST | /api/usuarios/comunidad/:id/comentarios | 401 |
| POST | /api/usuarios/comunidad/:id/denunciar | 401 |
| DELETE | /api/usuarios/comunidad/:id | 401 |
| POST | /api/usuarios/registrar | 401 |
| POST | /api/usuarios/convertir-a-musico | 401 |
| DELETE | /api/usuarios/me | 401 |
| POST | /api/usuarios/:identificador/seguir | 401 |
| POST | /api/usuarios/:identificador/bloquear | 401 |
| DELETE | /api/usuarios/:identificador/bloquear | 401 |
| POST | /api/usuarios/:identificador/denunciar | 401 |
| POST | /api/usuarios/:identificador/silenciar-notificaciones | 401 |
| POST | /api/eventos/crear | 401 |
| POST | /api/eventos/:id/guardar | 401 |
| POST | /api/eventos/:id/denunciar | 401 |
| DELETE | /api/eventos/:id | 401 |
| POST | /api/reels/:id/visita | 401 |
| POST | /api/reels/comentarios/:comentarioId/like | 401 |
| DELETE | /api/reels/comentarios/:comentarioId | 401 |
| POST | /api/reels/crear | 401 |
| POST | /api/reels/:id/comentarios | 401 |
| POST | /api/reels/:id/compartir | 401 |
| POST | /api/reels/:id/denunciar | 401 |
| POST | /api/reels/:id/like | 401 |
| POST | /api/reels/:id/guardar | 401 |
| DELETE | /api/reels/:id | 401 |
| PUT | /api/comunidades/:comunidadId/membresia | 401 |
| DELETE | /api/comunidades/:comunidadId/membresia | 401 |
| POST | /api/comunidades/:comunidadId/publicaciones | 401 |
| POST | /api/comunidades/publicaciones/:publicacionId/comentarios | 401 |
| POST | /api/comunidades/publicaciones/:publicacionId/like | 401 |
| POST | /api/comunidades/publicaciones/:publicacionId/guardar | 401 |
| POST | /api/comunidades/publicaciones/:publicacionId/denunciar | 401 |
| POST | /api/comunidades/comentarios/:comentarioId/like | 401 |
| PUT | /api/comunidades/comentarios/:comentarioId/guardar | 401 |
| DELETE | /api/comunidades/comentarios/:comentarioId/guardar | 401 |
| DELETE | /api/comunidades/comentarios/:comentarioId | 401 |
| POST | /api/mensajes/ | 401 |
| POST | /api/mensajes/:id | 401 |
| POST | /api/notificaciones/leer-todas | 401 |
| POST | /api/notificaciones/:id/leer | 401 |
| DELETE | /api/notificaciones/leidas | 401 |
