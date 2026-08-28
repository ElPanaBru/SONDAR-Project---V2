# Informe funcional y presentación de SONDAR

## 1. Resumen ejecutivo

SONDAR es una plataforma social orientada a la música en vivo. Reúne en una misma aplicación:

- Descubrimiento y publicación de eventos musicales.
- Reels de música creados por artistas y usuarios.
- Comunidades organizadas por género musical.
- Perfiles sociales, seguidores e interacciones.
- Moderación, denuncias, bloqueos y notificaciones.

La aplicación utiliza React en el frontend, Node.js con Express en el backend y Supabase para autenticación, PostgreSQL y almacenamiento de archivos.

El flujo principal quedó organizado de esta manera:

```text
Usuario → React → cliente API común → backend Node/Express → PostgreSQL/Supabase Storage
                    ↓
             Supabase Auth para sesión
```

Las operaciones de negocio pasan por el backend. El SDK de Supabase permanece en el frontend solamente para administrar autenticación y sesión.

## 2. Lista funcional por pestaña

### Eventos — `/`

**Función principal:** descubrir eventos musicales y ubicarlos geográficamente.

**Qué puede hacer el usuario:**

- Ver eventos publicados.
- Filtrar eventos por género musical.
- Explorar eventos mediante un mapa interactivo.
- Consultar fecha, lugar, descripción, precio, imagen y enlace externo.
- Guardar o quitar eventos de guardados.
- Crear eventos con imagen, ubicación y coorganizadores.
- Buscar y agregar coorganizadores mediante menciones.
- Denunciar eventos ajenos.
- Eliminar eventos propios.

**Backend:** `/api/eventos`.

**Tablas principales:** `eventos`, `event_organizers`, `event_saves`, `content_reports`, `users`.

**Qué revisar antes de producción:**

- Validar límites geográficos de latitud y longitud.
- Confirmar la política para eventos pasados.
- Probar carga de imágenes, precios gratuitos y enlaces externos.
- Probar permisos de creador y coorganizador.

### Descubrir — `/descubrir`

**Función principal:** consumir, descubrir y publicar reels musicales.

**Qué puede hacer el usuario:**

- Reproducir reels y audio.
- Navegar verticalmente entre publicaciones.
- Publicar un reel con portada, audio, género y descripción.
- Dar o quitar like.
- Guardar o quitar de guardados.
- Registrar vistas y compartidos.
- Compartir mediante enlace o redes sociales.
- Crear comentarios y respuestas.
- Dar like a comentarios.
- Eliminar comentarios propios.
- Seguir al creador.
- Abrir el perfil del creador.
- Denunciar reels ajenos.
- Eliminar reels propios.

**Backend:** `/api/reels` y `/api/usuarios`.

**Tablas principales:** `reels`, `reel_views`, `reel_likes`, `reel_saves`, `reel_shares`, `reel_comments`, `reel_comment_likes`, `reel_listen_events`, `follows`.

**Qué revisar antes de producción:**

- Definir si `visitas` representa reproducciones totales o usuarios únicos.
- Impedir que una respuesta use como padre un comentario de otro reel.
- Sincronizar automáticamente likes, guardados y visitas con sus tablas de interacción.
- Probar reproducción, pausa, avance y cambio entre reels en móvil.

### Comunidad — `/comunidad`

**Función principal:** ofrecer espacios de conversación por género musical.

**Qué puede hacer el usuario:**

- Ver comunidades disponibles.
- Entrar a una comunidad musical.
- Filtrar publicaciones por recientes, populares, destacadas o preguntas.
- Buscar publicaciones por texto.
- Crear una publicación o hilo.
- Dar like y guardar publicaciones.
- Comentar y responder con menciones.
- Consultar conversaciones relacionadas con un género.

**Backend:** `/api/comunidades`.

**Tablas principales:** `comunidades`, `comunidad_miembros`, `comunidad_publicaciones`, `comunidad_publicacion_likes`, `comunidad_publicacion_guardados`, `comunidad_comentarios`, `comunidad_comentario_likes`.

**Qué revisar antes de producción:**

- Incorporar denuncia de publicaciones y comentarios de Comunidad.
- Confirmar reglas para fijar publicaciones destacadas.
- Probar paginación y rendimiento con muchas publicaciones.
- Definir herramientas de moderación para administradores.

### Buscar — `/buscar`

**Función principal:** búsqueda global de contenido.

**Qué puede hacer el usuario:**

- Buscar usuarios, reels y eventos desde una sola consulta.
- Filtrar y ordenar visualmente los resultados.
- Abrir perfiles, eventos o reels desde el resultado.

**Backend:** `/api/usuarios`, `/api/reels` y `/api/eventos`.

**Tablas principales:** `users`, `reels`, `eventos`.

**Qué revisar antes de producción:**

- Mover filtrados pesados completamente al backend.
- Agregar paginación y límite de resultados.
- Evaluar búsqueda por texto completo cuando aumente el volumen.

### Mi perfil — `/perfil`

**Función principal:** administrar la identidad pública y consultar la actividad propia.

**Qué puede hacer el usuario:**

- Ver nombre, usuario, biografía, avatar y estadísticas.
- Editar nombre visible, biografía y foto de perfil.
- Compartir el perfil.
- Consultar seguidores y seguidos.
- Navegar por las secciones Publicaciones, Eventos, Likes y Guardados.

**Backend:** `/api/usuarios/me/perfil`.

**Tablas principales:** `users`, `follows`, `reels`, `eventos`, `reel_likes`, `reel_saves`, `event_saves`.

**Qué revisar antes de producción:**

- Unificar visualmente qué nombre tiene prioridad: username, display name o artist name.
- Probar reemplazo y eliminación de avatares en Storage.
- Confirmar que todo el contenido mostrado respete estados de moderación.

### Perfil de otro usuario — `/perfil/:usuario`

**Función principal:** visualizar e interactuar con otro miembro de SONDAR.

**Qué puede hacer el usuario:**

- Ver información pública y contenido del perfil.
- Seguir o dejar de seguir.
- Silenciar notificaciones del perfil.
- Bloquear al usuario.
- Denunciar el perfil.
- Compartir su enlace.

**Backend:** `/api/usuarios/:identificador`.

**Tablas principales:** `users`, `follows`, `notification_mutes`, `user_blocks`, `content_reports`.

**Qué revisar antes de producción:**

- Confirmar si silenciar debe depender obligatoriamente de seguir al usuario.
- Ocultar de manera consistente el contenido entre usuarios bloqueados.
- Probar acceso mediante UUID y username.

### Configuración — `/configuracion`

**Función principal:** controlar cuenta, privacidad, accesibilidad y notificaciones.

**Qué puede hacer el usuario:**

- Editar teléfono y código de país.
- Elegir idioma.
- Activar o desactivar categorías de notificaciones.
- Configurar visibilidad y actividad de cuenta.
- Reducir movimiento para accesibilidad.
- Consultar y desbloquear cuentas bloqueadas.
- Cambiar contraseña.
- Exportar los datos de la cuenta.
- Eliminar definitivamente la cuenta.
- Restablecer preferencias.

**Backend:** `/api/usuarios/me/configuracion`, `/api/usuarios/me/exportar` y `/api/usuarios/me`.

**Tablas principales:** `user_settings`, `settings`, `user_blocks`, `users`.

**Decisión vigente:** las dos estructuras de settings y la estrategia actual de IDs se mantienen por organización interna del proyecto.

**Qué revisar antes de producción:**

- Probar todas las preferencias en los tres idiomas disponibles.
- Confirmar el alcance exacto de la eliminación en cascada.
- Proteger la exportación de datos y evitar descargas repetidas abusivas.

### Notificaciones — panel global

**Función principal:** avisar interacciones relevantes sin abandonar la pantalla actual.

**Qué puede hacer el usuario:**

- Ver notificaciones recientes.
- Consultar la cantidad no leída.
- Marcar una notificación como leída.
- Marcar todas como leídas.
- Eliminar notificaciones ya leídas.
- Navegar hacia el contenido relacionado.

**Backend:** `/api/notificaciones`.

**Tablas principales:** `notifications`, `notification_mutes`, `user_settings`.

**Qué revisar antes de producción:**

- Probar idempotencia mediante `unique_key`.
- Verificar que las preferencias desactivadas impidan crear avisos nuevos.
- Considerar tiempo real o polling controlado para actualización automática.

### Soporte — `/soporte`

**Función principal:** resolver dudas frecuentes y contactar al equipo.

**Qué puede hacer el usuario:**

- Consultar preguntas frecuentes.
- Seleccionar asuntos comunes.
- Enviar un mensaje autenticado al equipo de soporte.

**Backend:** `/api/soporte/mensaje`.

El frontend ya no se comunica directamente con EmailJS. Node valida al usuario, prepara el mensaje y coordina el envío externo.

**Qué revisar antes de producción:**

- Agregar limitación de frecuencia por usuario.
- Mover toda la configuración de EmailJS a variables de entorno de producción.
- Registrar el estado del envío para auditoría, si soporte lo necesita.

### Acceso y registro — `/auth`

**Función principal:** crear cuentas e iniciar sesión.

**Qué puede hacer el usuario:**

- Registrarse con email, contraseña y username único.
- Iniciar sesión.
- Crear o verificar el perfil público asociado.
- Mantener la sesión entre recargas.
- Cerrar sesión.

**Autenticación:** Supabase Auth.

**Backend:** `/api/usuarios/crear-cuenta`, `/api/usuarios/registrar` y `/api/usuarios/me`.

**Tablas principales:** `auth.users` y `public.users`.

**Qué revisar antes de producción:**

- Definir recuperación de contraseña por email.
- Confirmar políticas de verificación de correo.
- Agregar protección frente a intentos repetidos de acceso.

### Navegación global

La barra superior y la barra lateral permiten:

- Ir a Eventos, Descubrir y Comunidad.
- Buscar contenido globalmente.
- Acceder rápidamente a perfiles seguidos.
- Abrir notificaciones.
- Crear un evento, reel o publicación.
- Acceder a perfil, soporte, configuración y cierre de sesión.

## 3. Usuarios objetivo

### Músicos y artistas

- Publican reels y muestran su trabajo.
- Construyen una comunidad de seguidores.
- Difunden presentaciones y eventos.

### Organizadores

- Publican eventos con ubicación, precio e imagen.
- Agregan coorganizadores.
- Alcanzan usuarios interesados en géneros concretos.

### Público general

- Descubre música, eventos y artistas.
- Guarda contenido y participa en comunidades.
- Sigue perfiles y recibe notificaciones.

### Administradores y moderadores

- Revisan contenido denunciado o rechazado.
- Gestionan alertas de moderación.
- Mantienen la seguridad de la comunidad.

## 4. Arquitectura técnica

### Frontend

- React y React Router.
- Interfaz organizada por páginas y componentes.
- Cliente HTTP central `apiRequest`/`apiJson`.
- Leaflet para mapas.
- Supabase SDK únicamente para sesión y autenticación.

### Backend

- Node.js y Express.
- Rutas separadas por usuarios, eventos, reels, comunidades, notificaciones y soporte.
- Middleware que verifica el JWT de Supabase.
- Controladores que aplican reglas y ejecutan operaciones SQL.
- Multer para recibir imágenes y audio.
- Servicios separados para Storage, moderación y notificaciones.

### Supabase

- Auth para cuentas y sesiones.
- PostgreSQL como base relacional.
- Storage para archivos.
- Buckets utilizados: `perfiles`, `eventos` y `reels`.
- El bucket de reels separa portadas y audios.

## 5. Base de datos

El esquema público contiene 29 tablas.

### Identidad, preferencias y relaciones

- `users`: perfil público asociado con `auth.users`.
- `settings`: configuración mantenida por la organización actual del proyecto.
- `user_settings`: preferencias activas de cuenta y notificaciones.
- `user_interests`: intereses musicales del usuario.
- `follows`: relaciones entre seguidores y seguidos.
- `user_blocks`: bloqueos entre usuarios.
- `notification_mutes`: silenciamiento de notificaciones de perfiles seguidos.

### Eventos

- `eventos`: información principal del evento.
- `event_organizers`: creador y coorganizadores.
- `event_saves`: eventos guardados.
- `event_attendance_events`: historial de acciones de asistencia y puntuación.

### Reels

- `reels`: contenido, audio, portada, creador y métricas.
- `reel_views`: vistas únicas registradas.
- `reel_likes`: likes por usuario.
- `reel_saves`: reels guardados.
- `reel_shares`: compartidos únicos por usuario.
- `reel_comments`: comentarios y respuestas.
- `reel_comment_likes`: likes de comentarios.
- `reel_listen_events`: eventos de escucha y puntuación.

### Comunidad

- `comunidades`: comunidades por género.
- `comunidad_miembros`: pertenencia de usuarios.
- `comunidad_publicaciones`: hilos y publicaciones.
- `comunidad_publicacion_likes`: likes de publicaciones.
- `comunidad_publicacion_guardados`: publicaciones guardadas.
- `comunidad_comentarios`: comentarios y respuestas.
- `comunidad_comentario_likes`: likes de comentarios.

### Notificaciones y moderación

- `notifications`: avisos dirigidos a usuarios.
- `content_reports`: denuncias realizadas por usuarios.
- `content_moderation_alerts`: alertas generadas por moderación.

La base real incluye claves primarias, claves foráneas, restricciones únicas, checks e índices. El archivo `database_sondar.sql` enumera correctamente las 29 tablas y sus columnas, pero no es un backup restaurable porque no incluye toda esa lógica relacional.

## 6. Flujo de una acción

Ejemplo: un usuario da like a un reel.

1. React recibe el clic.
2. El cliente API obtiene la sesión y adjunta el token.
3. Node recibe `POST /api/reels/:id/like`.
4. El middleware valida al usuario con Supabase Auth.
5. El controlador actualiza PostgreSQL.
6. El backend devuelve el estado definitivo.
7. React actualiza la interfaz.

Este flujo evita que las reglas de negocio queden dispersas en el navegador.

## 7. Seguridad y moderación

SONDAR incorpora:

- JWT de Supabase para endpoints privados.
- Claves foráneas y eliminación en cascada.
- Username y email únicos.
- Bloqueos y silenciamientos.
- Denuncias de perfiles, reels y eventos.
- Estados de moderación `pending`, `approved` y `rejected`.
- Validación de tamaño y tipo para archivos subidos.
- Eliminación de archivos de Storage al borrar contenido.

## 8. Estado actual verificado

### Correcto

- El frontend compila para producción.
- Los archivos nuevos del backend pasan la validación sintáctica de Node.
- Las acciones HTTP del frontend están centralizadas.
- Los emails de soporte y denuncias pasan por Node.
- Las 29 tablas del archivo coinciden con las 29 tablas reales de Supabase.
- Las operaciones de negocio principales cuentan con endpoint backend.

### Pendiente

- ESLint informa 11 errores y una advertencia preexistentes.
- Debe reforzarse la relación padre/reel en respuestas de comentarios.
- Los contadores de algunas interacciones dependen del backend y podrían desincronizarse.
- Debe definirse si vistas y compartidos son acciones totales o usuarios únicos.
- Los eventos de puntuación admiten repetición y puntos arbitrarios.
- Comunidad todavía no tiene denuncias para publicaciones y comentarios.
- Falta una prueba integral manual de todos los flujos con sesión real.

## 9. Guion breve para presentar SONDAR

### Diapositiva 1 — Problema

La música independiente, los eventos y las comunidades suelen estar separados en distintas plataformas.

### Diapositiva 2 — Solución

SONDAR integra descubrimiento musical, eventos geolocalizados, contenido corto y comunidad.

### Diapositiva 3 — Experiencia

El usuario descubre un reel, entra al perfil del artista, consulta su evento, lo guarda y participa en una comunidad del mismo género.

### Diapositiva 4 — Tecnología

React ofrece la experiencia visual, Node centraliza las reglas y Supabase administra identidad, datos y archivos.

### Diapositiva 5 — Base de datos

El modelo de 29 tablas conecta usuarios, eventos, reels, comunidades, interacciones, notificaciones y moderación.

### Diapositiva 6 — Seguridad

Las acciones privadas requieren autenticación y las relaciones están protegidas mediante claves y restricciones.

### Diapositiva 7 — Valor

SONDAR permite que artistas, organizadores y público se encuentren alrededor de la música local.

### Diapositiva 8 — Próximos pasos

Completar pruebas integrales, reforzar moderación de Comunidad, corregir calidad estática y preparar despliegue productivo.

## 10. Orden recomendado de trabajo

1. Corregir los errores actuales de ESLint.
2. Probar autenticación, registro, recuperación y eliminación de cuenta.
3. Probar cada acción de Eventos, Reels y Comunidad con dos usuarios diferentes.
4. Corregir respuestas cruzadas entre reels.
5. Definir y proteger contadores, vistas, compartidos y puntuación.
6. Agregar denuncias de contenido comunitario.
7. Probar notificaciones, bloqueos y silenciamientos.
8. Ejecutar pruebas de archivos y limpieza de Storage.
9. Incorporar paginación y pruebas de carga.
10. Preparar variables de entorno, monitoreo y despliegue.
