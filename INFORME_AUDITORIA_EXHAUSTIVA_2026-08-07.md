# Auditoría funcional y técnica de SONDAR

Fecha: 7 de agosto de 2026

## Resumen ejecutivo

Los cambios pedidos para Eventos y Comunidad quedaron implementados y cuentan con seis pruebas automatizadas específicas. El frontend compila para producción y los archivos modificados pasan ESLint. Durante la revisión se detectaron y corrigieron dos regresiones de integración antes de la entrega: el formulario de eventos todavía enviaba `multipart/form-data` después de retirar el parser de imágenes, y una migración antigua seguía eliminando la nueva tabla de membresías.

La aplicación, sin embargo, todavía tiene riesgos importantes fuera de ese alcance. Los más urgentes son la presencia de credenciales en archivos `.env` versionados, escrituras destructivas de esquema durante el arranque, ausencia de rate limiting, una ruta de creación de cuentas que puede escribir directamente en el esquema interno de Auth, y operaciones que mezclan persistencia con notificaciones de manera que pueden responder con error después de haber guardado los datos.

## Cambios realizados en esta entrega

### Eventos

- Se cambió el texto visible de “organizadores/coorganizadores” a “invitados” o “bandas invitadas”. Los nombres internos de columnas, variables y tipos de notificación se conservaron para no romper contratos existentes, tal como se pidió al aclarar que el cambio era solamente textual.
- Se eliminó el campo de archivo del formulario, el middleware de carga de imagen de la ruta, la subida a Storage y las columnas de imagen del `INSERT` de nuevos eventos.
- La creación de eventos ahora envía JSON, consistente con `express.json`, en lugar del antiguo formulario multipart.
- El logo `/sondar-logo.png` se usa como imagen predeterminada en mapa, resumen, búsqueda y tarjetas de eventos en perfiles.
- Se mantuvo únicamente la eliminación de archivos históricos al borrar eventos o cuentas para poder limpiar imágenes creadas antes de este cambio.

### Comunidad

- Se unificaron las reglas de todos los géneros en una sola lista y se aumentó su contraste a blanco.
- Recursos conserva sólo las redirecciones a Eventos y Reels; se retiró “Publicaciones guardadas”.
- La estructura de escritorio es `Foros | foro activo | Reglas y luego Recursos`.
- Se eliminó el primer panel redundante “Unirse al foro” de la columna derecha.
- En pantallas angostas, Foros queda accesible como una franja horizontal; Reglas y Recursos ya no desaparecen en móvil.
- Se eliminó “Community highlights”.
- “Destacado” ahora se presenta como `Filtrar por: Más relevantes`, con opciones y descripciones que dejan claro si ordenan o filtran.
- Se implementó membresía persistente de foros con un contador real y acciones `Unirse`/`Salir del foro`.
- Crear post está deshabilitado hasta iniciar sesión y unirse al foro. La restricción existe tanto en frontend como en backend, por lo que no se puede omitir llamando directamente a la API.
- Los botones sin comportamiento de compartir foro/publicación ahora copian enlaces profundos.
- Se retiró el botón ficticio “Cargar imagen” del modal y se añadió una selección real entre publicación general y pregunta.
- Los filtros “recientes” y “populares” ahora ordenan el contenido; “sólo preguntas” es el único que restringe por tipo.

## Verificaciones ejecutadas

| Verificación | Resultado |
| --- | --- |
| `npm test` en Backend | 6/6 pruebas aprobadas |
| ESLint sobre Comunidad, Eventos, Buscar y Soporte modificados | Aprobado |
| `npm run build` en Frontend | Aprobado; advertencia por bundle mayor a 500 kB |
| `node --check` sobre backend modificado | Aprobado |
| `git diff --check` | Aprobado; sólo avisos de futura conversión LF/CRLF |
| Endpoints públicos del backend local ya activo | Health, eventos, reels y comunidades respondieron HTTP 200 |
| Auditoría npm offline, Frontend y Backend | 0 vulnerabilidades conocidas en la caché local; no equivale a una consulta online actualizada |
| Lint completo del frontend | Falló con 11 errores y 1 advertencia preexistentes |
| Build desde la raíz | Falló porque el script intenta ejecutar un Vite no instalado en la raíz |

### Límites de esta auditoría

- No estuvo disponible el controlador de navegador requerido por el entorno, por lo que no se pudo completar una sesión automatizada de clics, foco, screenshots y responsive real.
- No se ejecutaron mutaciones contra la base remota. El backend modifica esquema y datos al arrancar, y el entorno bloqueó correctamente esa operación sin autorización explícita.
- Por lo anterior, las altas reales con Supabase, envíos de correo, subidas a Storage, RLS remoto y flujo autenticado completo requieren una pasada E2E en un entorno de staging aislado.
- Las verificaciones HTTP de lectura se hicieron contra un servidor local que ya estaba ejecutándose; sirven para evaluar contratos públicos y cabeceras, no para demostrar el código nuevo de membresía que ese proceso anterior aún no había cargado.

## Hallazgos vitales

### V-01 — P0 — Credenciales y configuración sensible versionadas

**Evidencia:** Git rastrea `Backend/.env`, `Frontend/.env` y `sondar-mobile/.env`. El archivo del backend contiene nombres de variables de contraseña de base y clave `service_role`. `.gitignore` no excluye `.env`.

**Impacto:** cualquier persona con acceso al repositorio o a una copia histórica puede obtener privilegios de base de datos o administración de Supabase. Eliminar el archivo en un commit nuevo no revoca lo ya expuesto.

**Recomendación:** rotar inmediatamente contraseña de DB y `service_role`, revisar logs de uso, añadir `.env` a `.gitignore`, conservar sólo `.env.example` sin valores y purgar los secretos de toda la historia con una herramienta apropiada. Invalidar las claves antes de reescribir la historia.

### V-02 — P0 — El arranque de la aplicación ejecuta migraciones destructivas

**Evidencia:** `Backend/services/settingsSchema.js` normaliza y reescribe usernames, crea índices/constraints, añade columnas y ejecuta `DROP COLUMN IF EXISTS` cada vez que inicia el servidor.

**Impacto:** un despliegue o reinicio puede alterar datos productivos, bloquear tablas, requerir privilegios DDL y dejar la aplicación sin iniciar si una migración falla. No hay rollback de despliegue ni versión de migración.

**Recomendación:** sacar todo DDL del proceso web, convertirlo en migraciones versionadas y aplicarlas una única vez durante el despliegue, primero en staging y con backup verificado.

### V-03 — P0 — Escritura directa en tablas internas de Supabase Auth

**Evidencia:** `crearUsuarioAuthPorSql` inserta directamente en `auth.users` y `auth.identities`; se usa como fallback ante clave inválida o timeout de Supabase.

**Impacto:** depende de detalles internos no garantizados, puede omitir triggers e invariantes de Auth, crear identidades inconsistentes o dejar cuentas imposibles de recuperar. Un timeout no prueba que la primera operación haya fallado: puede producir duplicados o estados ambiguos.

**Recomendación:** usar exclusivamente las APIs administrativas oficiales. Ante timeout, consultar de forma idempotente el estado y reintentar con una clave de operación, nunca escribir el esquema `auth` manualmente.

### V-04 — P0 — Notificaciones dentro del camino crítico después de persistir

**Evidencia:** la creación de eventos hace `COMMIT` y luego espera notificaciones dentro del mismo `try`. Reels inserta la fila y después notifica; si eso falla, el `catch` borra archivos pero deja la fila. Comentarios y publicaciones siguen patrones similares.

**Impacto:** el cliente puede recibir HTTP 500 aunque el contenido ya exista. En Reels puede quedar una fila apuntando a audio/portada borrados. Un reintento puede duplicar contenido cuando venza la deduplicación de cinco segundos.

**Recomendación:** confirmar y responder la operación principal independientemente; publicar notificaciones mediante outbox/cola con reintentos. Nunca compensar borrando archivos si la fila ya quedó confirmada.

### V-05 — P0 — Ausencia de rate limiting y controles antiabuso

**Evidencia:** no hay `express-rate-limit`, CAPTCHA, cuotas por usuario/IP ni throttling en creación de cuentas, comentarios, likes, compartidos, soporte o denuncias.

**Impacto:** spam, fuerza bruta, consumo de EmailJS/Storage, crecimiento artificial de métricas y agotamiento de conexiones/recursos.

**Recomendación:** límites diferenciados por ruta e identidad, protección más estricta en alta/login/soporte, cuotas de carga y una política de bloqueo progresivo. Respaldarlo con métricas y alertas.

### V-06 — P0 — Canal EmailJS invocable desde el navegador

**Evidencia:** Soporte y denuncias importan `emailjs-com` y contienen IDs/claves públicas en el bundle. Existe un endpoint backend protegido para soporte, pero el frontend no lo usa.

**Impacto:** el flujo puede ser automatizado fuera de SONDAR, consumir la cuota o enviar spam. Además hay dos fuentes de configuración diferentes entre frontend y backend.

**Recomendación:** enviar todo por `/api/soporte/mensaje`, aplicar rate limit, registrar intentos y mantener la configuración sólo en variables del servidor. El reporte de contenido debería quedar guardado aunque el correo falle.

### V-07 — P1 — TLS de PostgreSQL no valida el certificado

**Evidencia:** `Backend/Pool_DB.js` usa `ssl: { rejectUnauthorized: false }` salvo que se desactive SSL por completo.

**Impacto:** la conexión está cifrada pero no autentica de forma estricta al servidor, facilitando ataques de intermediario en redes comprometidas.

**Recomendación:** instalar la CA correcta del proveedor y activar `rejectUnauthorized: true`. Tratar un error de certificado como fallo de despliegue.

### V-08 — P1 — Health público expone infraestructura y faltan cabeceras de seguridad

**Evidencia:** `/api/health` devuelve URL de Supabase, host, nombre y usuario de DB. La respuesta observada expone `X-Powered-By` y no incluyó cabeceras típicas de Helmet.

**Impacto:** facilita reconocimiento de infraestructura y reduce defensa en profundidad.

**Recomendación:** responder sólo `{ ok, version }`, desactivar `x-powered-by`, añadir Helmet, una política CSP adecuada para frontend y cabeceras HSTS en el proxy HTTPS.

### V-09 — P1 — CORS rechazado se convierte en HTTP 500

**Evidencia:** un preflight con origen no permitido respondió 500. No hay middleware final de errores ni manejador JSON de 404 en `Backend/index.js`.

**Impacto:** un rechazo esperado parece una caída interna, contamina alertas y devuelve formatos inconsistentes a clientes.

**Recomendación:** transformar errores CORS en 403 controlado, añadir 404 JSON y un handler final que oculte detalles internos y asigne un ID de correlación.

### V-10 — P1 — DDL también se ejecuta durante requests

**Evidencia:** controladores de Comunidad/Reels y el servicio de moderación crean tablas, columnas, índices y políticas en tiempo de ejecución.

**Impacto:** la primera petición puede ser lenta o fallar por permisos; varias instancias pueden competir por locks. El proceso web necesita permisos mucho mayores de los necesarios.

**Recomendación:** consolidar todo en migraciones; el rol del backend productivo debe tener sólo permisos DML mínimos.

### V-11 — P1 — Eliminación de cuenta no es atómica ni recuperable

**Evidencia:** primero elimina avatar/audio/portadas en Storage y después intenta eliminar el usuario Auth.

**Impacto:** si Auth falla, la cuenta sigue existiendo pero pierde definitivamente sus medios. DB y Storage no comparten transacción.

**Recomendación:** marcar cuenta como `pending_deletion`, revocar acceso, encolar limpieza idempotente y conservar un período de recuperación. Borrar Storage al final y auditar cada paso.

### V-12 — P1 — Eventos vencidos siguen siendo el contenido principal

**Evidencia:** los tres eventos devueltos por el backend local tenían fecha pasada. La consulta sólo baja su puntaje; no los archiva ni separa. La pantalla los sigue mostrando.

**Impacto:** el mapa puede parecer abandonado y dirigir a ventas/ubicaciones ya inválidas.

**Recomendación:** por defecto devolver próximos eventos, ofrecer una pestaña “Pasados” y archivar automáticamente. Definir claramente zona horaria y hora de cierre.

### V-13 — P1 — Validación de eventos insuficiente en el backend

**Evidencia:** fecha máxima/pasada y lista de géneros se validan sólo en UI. La API no restringe longitud de título/lugar, rango de latitud/longitud ni esquema `http/https` del enlace de compra.

**Impacto:** un cliente directo puede crear datos incoherentes, enlaces peligrosos o coordenadas imposibles.

**Recomendación:** esquema de validación del servidor con límites, enum compartido, fecha futura dentro de la regla de negocio, latitud `[-90,90]`, longitud `[-180,180]` y URL `https`/`http` explícita.

### V-14 — P1 — Listados públicos sin paginación

**Evidencia:** eventos, reels, publicaciones y comentarios pueden devolver el conjunto completo. Sólo notificaciones y algunas búsquedas tienen límites visibles.

**Impacto:** tiempo de respuesta, memoria, transferencia y consultas correlacionadas crecen sin límite.

**Recomendación:** paginación por cursor estable, límites máximos y respuestas con `nextCursor`. Cargar comentarios bajo demanda.

### V-15 — P1 — Patrón N+1 en Descubrir

**Evidencia:** después de pedir reels, el frontend solicita comentarios por cada reel y perfiles adicionales por creador.

**Impacto:** decenas de requests al abrir la página, mayor latencia, presión sobre Auth/DB y experiencia muy sensible a una única respuesta lenta.

**Recomendación:** devolver resumen de creador y conteo/comentarios iniciales en el listado o crear un endpoint batch; diferir comentarios hasta abrir el reel.

### V-16 — P1 — El build oficial de raíz está roto

**Evidencia:** `npm run build` en raíz ejecuta primero `vite build`, pero Vite no es dependencia del paquete raíz. El build correcto de `Frontend` sí termina.

**Impacto:** CI o despliegues que sigan la convención de raíz fallan aunque el frontend sea compilable.

**Recomendación:** cambiar el script raíz a `npm run build --prefix Frontend` o estructurar workspaces formales.

### V-17 — P1 — La calidad global no puede pasar CI

**Evidencia:** el lint completo arroja 11 errores y 1 warning en `DenunciaModal`, `Navbar`, `PreferenciasContext` y `Descubrir`. Backend no tiene configuración ESLint de Node; aplicar la configuración browser produce numerosos falsos positivos.

**Impacto:** no hay una señal automática confiable para impedir regresiones.

**Recomendación:** corregir los 12 hallazgos frontend, añadir configuración Node para Backend y hacer obligatorios lint, tests y build en CI.

### V-18 — P1 — Cobertura automatizada extremadamente baja

**Evidencia:** antes de esta entrega no había un comando de tests funcional. Ahora existen seis pruebas focalizadas, pero no hay tests de frontend, accesibilidad, contratos de API, Auth/Storage ni E2E.

**Impacto:** cambios en archivos de más de mil líneas pueden romper recorridos centrales sin detección.

**Recomendación:** pirámide de tests: unidades de validadores, integración con PostgreSQL/Supabase local, componentes con Testing Library y E2E de los diez recorridos críticos.

### V-19 — P1 — No hay CI visible en el repositorio

**Evidencia:** no se encontró `.github/workflows` ni otra configuración equivalente.

**Impacto:** build, lint, tests y escaneo de secretos dependen de ejecución manual.

**Recomendación:** pipeline por pull request con instalación reproducible, lint, tests, build, secret scanning, auditoría de dependencias y migraciones en DB efímera.

### V-20 — P1 — El dump principal de DB no es restaurable

**Evidencia:** `database_sondar.sql` usa construcciones como `ALTER TABLE "tabla" (` seguidas de definiciones de columnas, sintaxis que no crea ni altera una tabla válidamente.

**Impacto:** falsa sensación de backup. Ante pérdida o al crear staging, no hay camino reproducible garantizado.

**Recomendación:** generar un dump real con `pg_dump`, probar restauración automática y separar schema, datos semilla y migraciones.

### V-21 — P1 — Migraciones manuales y contradictorias

**Evidencia:** hay varios SQL solapados, `supabase/config.toml` no declara rutas de esquema y no existe `supabase/migrations`. Durante este trabajo una migración todavía marcaba `comunidad_miembros` como tabla a borrar; quedó corregido y cubierto por test.

**Impacto:** el resultado depende del orden manual de ejecución y puede divergir entre desarrolladores/producción.

**Recomendación:** una sola secuencia incremental, numerada e inmutable; prueba de migración desde cero y desde la versión productiva anterior.

### V-22 — P1 — Comentario local simula éxito después de un fallo

**Evidencia:** si falla guardar un comentario de Comunidad, el frontend agrega uno con ID local, limpia el campo y muestra “Comentario local hasta reconectar”, pero no existe cola de sincronización.

**Impacto:** el usuario cree que publicó; al recargar desaparece. Puede perder contenido importante y duplicarlo al reintentar.

**Recomendación:** conservar el texto, marcar el comentario claramente como fallido y ofrecer Reintentar/Descartar; sólo usar modo offline si hay una cola persistente real.

### V-23 — P1 — Géneros desalineados entre módulos y datos

**Evidencia:** la API local tiene comunidades activas adicionales (`otros`, `electronica`, `urbano`) que no coinciden con el conjunto fijo de Eventos. Un recurso desde esos foros produce un filtro que Eventos no reconoce y termina mostrando todo.

**Impacto:** redirecciones aparentemente incorrectas y comunidades duplicadas conceptualmente (`edm`/`electronica`, `trap`/`urbano`).

**Recomendación:** catálogo canónico con ID, alias y nombre visible, usado por DB, backend y frontend. Migrar/desactivar duplicados de manera explícita.

### V-24 — P1 — Membresía implementada como toggle no idempotente

**Evidencia:** un único `POST /membresia` alterna entre unido/no unido.

**Impacto:** reintentos de red, doble clic desde pestañas distintas o reenvío pueden dejar el estado opuesto al pretendido. Dos altas concurrentes pueden chocar contra la PK y responder 500.

**Recomendación:** `PUT` para unirse y `DELETE` para salir, ambos idempotentes; usar `ON CONFLICT DO NOTHING` y devolver el estado final.

### V-25 — P1 — Comunidad soporta datos que la UI no permite gestionar

**Evidencia:** backend modela comentarios anidados y likes de comentarios; la UI sólo muestra comentarios de primer nivel como texto y no ofrece responder, votar, editar, borrar o denunciar publicaciones/comentarios.

**Impacto:** funcionalidades parciales y contenido sin herramientas de autocorrección/moderación.

**Recomendación:** completar el contrato UI o simplificar el backend hasta que exista moderación. Priorizar borrar/editar contenido propio y denunciar.

### V-26 — P2 — Límites de contenido inconsistentes

**Evidencia:** Comunidad limita título a 300 sólo en HTML, pero el backend no limita título/texto/comentario. Reels tampoco fija límites de texto equivalentes en servidor. `express.json` acepta hasta 8 MB.

**Impacto:** abuso de almacenamiento, tarjetas rotas y respuestas muy pesadas mediante clientes directos.

**Recomendación:** límites compartidos y validados en backend; bajar el límite global JSON y ampliar sólo rutas que realmente lo necesiten.

### V-27 — P2 — Deduplicación sólo en memoria y por cinco segundos

**Evidencia:** `evitarCreacionDuplicada` guarda promesas en un `Map` del proceso durante 5 s.

**Impacto:** no funciona entre múltiples instancias ni tras reinicio; no protege reintentos tardíos. Puede guardar temporalmente respuestas 500 como si fueran resultado idempotente.

**Recomendación:** clave idempotente persistida con resultado/estado en DB o Redis, TTL razonable y semántica explícita por operación.

### V-28 — P2 — Respuestas `SELECT *` acoplan y pueden exponer columnas nuevas

**Evidencia:** varios controladores y la exportación usan `SELECT *`.

**Impacto:** añadir una columna sensible puede incorporarla accidentalmente a una respuesta; los clientes quedan acoplados al esquema físico.

**Recomendación:** listas explícitas de campos y DTOs de salida validados.

### V-29 — P2 — Dependencia de servicios/CDN externos para render básico

**Evidencia:** `Frontend/index.html` carga Bootswatch, Bootstrap y Leaflet desde CDN, mientras Leaflet también está instalado/importado localmente.

**Impacto:** duplicación, versiones potencialmente distintas, bloqueo por CSP/offline y dependencia de terceros para estilos/scripts centrales.

**Recomendación:** empaquetar una sola copia local, fijar versión y retirar dependencias duplicadas.

### V-30 — P2 — Auditoría de dependencias no fue online

**Evidencia:** `npm audit --offline` encontró cero vulnerabilidades sólo en la caché disponible.

**Impacto:** no descarta avisos publicados después de la última actualización local.

**Recomendación:** ejecutar auditoría online y un scanner de lockfile en CI; revisar especialmente paquetes de carga, servidor, Auth y EmailJS.

## Hallazgos estéticos, UX y accesibilidad

### E-01 — Idioma del documento incorrecto

`Frontend/index.html` declara `lang="en"` aunque la interfaz está en español. Cambiar a `es-AR` mejora pronunciación de lectores de pantalla, traducción y SEO.

### E-02 — Ortografía y acentuación inconsistentes

Hay muchos textos sin tildes (`Más`, `música`, `género`, `publicación`, `sesión`, `todavía`) junto a otros correctamente acentuados. Conviene una pasada editorial y evitar usar ASCII como solución de encoding.

### E-03 — Singular/plural incorrecto

La interfaz muestra expresiones como `1 publicaciones`. Crear un helper de pluralización para miembros, publicaciones, respuestas, seguidores, visitas y eventos.

### E-04 — Mezcla de español e inglés

Persisten `post`, `Play`, nombres técnicos y algunos mensajes en inglés. Definir si “post” es parte del tono de marca; de lo contrario usar “publicación” consistentemente.

### E-05 — Modales sin gestión completa de foco

El modal de Comunidad no declara `role="dialog"`, `aria-modal`, título asociado ni focus trap. Escape sólo cierra el filtro, no necesariamente todos los modales. Añadir restauración de foco al botón que abrió el diálogo.

### E-06 — Foco visible insuficiente

Varios inputs usan `outline: none` y muchos botones dependen sólo de `hover`. Incorporar `:focus-visible` uniforme con contraste suficiente.

### E-07 — Iconos basados en caracteres

Controles usan `v`, `^`, `x`, `II` y `Play`. Su tamaño/alineación varía por tipografía y pueden leerse de forma extraña. Usar el sistema SVG existente y textos accesibles.

### E-08 — El logo horizontal se adapta a espacios cuadrados

Se corrigió con `object-fit: contain`, fondo y padding, pero el logo adjunto es ancho y puede verse pequeño en pines circulares. Sería útil derivar una variante cuadrada oficial del mismo logo, sin volver a permitir imágenes por evento.

### E-09 — Portadas de foros remotas

Las cabeceras dependen de URLs de Unsplash. Pueden cambiar, fallar, ralentizar el primer render o transmitir datos de usuarios a un tercero. Optimizar y servir copias autorizadas desde assets propios.

### E-10 — Falta de dimensiones/reserva de espacio para imágenes

Varias imágenes no declaran dimensiones intrínsecas/aspect ratio, lo que puede causar saltos al cargar. Añadir `aspect-ratio`, `width/height` o contenedores reservados.

### E-11 — Estados de carga básicos

La mayoría de pantallas muestra sólo texto “Cargando…”. Skeletons pequeños para tarjetas, mapa y perfil harían la navegación más estable sin exagerar animaciones.

### E-12 — Reglas/Recursos quedan lejos en móvil

Ya no desaparecen, pero se apilan después de todo el feed. Una solución móvil mejor sería un acordeón o pestaña “Info del foro” próxima al encabezado.

### E-13 — Lista horizontal de foros necesita señal visual

En responsive ahora se puede desplazar, pero conviene añadir degradado/flecha o `scroll-snap` para indicar que hay más foros fuera de pantalla.

### E-14 — Estados disabled dependen mucho de opacidad

“Unite para publicar” se entiende mejor que antes, pero el bajo contraste puede parecer texto roto. Mantener contraste legible y comunicar el requisito cerca del control.

### E-15 — Toasts demasiado breves para algunos mensajes

Comunidad limpia avisos a los 2,4 segundos. Errores largos o instrucciones de sesión pueden no alcanzar a leerse. Diferenciar duración por severidad y permitir cerrar.

### E-16 — Clases CSS muertas

Después de retirar bloques quedan reglas como `.highlight-toggle`, `.comunidad-media-fake`, `.comunidad-panel-acento`, `.subreddit-stats` y `.comunidad-unirse-panel` sin uso actual. Eliminarlas reduce ruido y falsas dependencias.

### E-17 — No hay página 404 visual

React Router no tiene ruta `*`; una URL inválida conserva el shell sin una explicación clara. Añadir página 404 con regreso a Eventos/Descubrir.

### E-18 — Metadata social mínima

Faltan descripción, Open Graph/Twitter cards y previews por evento/reel/foro. Los enlaces copiados funcionan, pero su presentación al compartir será pobre.

### E-19 — Movimiento reducido no es global

Eventos contempla `prefers-reduced-motion`, pero no todo el sistema de modales, navegación y video de Auth. La preferencia de cuenta debe reflejarse en todos los componentes y detener el video decorativo.

### E-20 — Formularios con ayuda dependiente de placeholder

Algunos campos dependen del placeholder o `aria-label` en vez de una etiqueta visible persistente. Usar `label`, texto de ayuda y errores asociados mediante `aria-describedby`.

## Sugerencias generales de arquitectura y proceso

### G-01 — Dividir componentes monolíticos

`Descubrir.jsx` ronda 2.700 líneas; Eventos y Comunidad superan ampliamente mil, y algunos CSS pasan dos mil. Separar por dominio: hooks de datos, mapa, feed, modal, reproductor, comentarios y tarjetas. La división debe seguir responsabilidades, no sólo cantidad de líneas.

### G-02 — Contratos compartidos y validación de esquema

Definir DTOs/esquemas para Evento, Reel, Comunidad, Perfil y errores. Zod/Valibot o JSON Schema permitirían validar entrada y salida, además de generar documentación.

### G-03 — Catálogo canónico de géneros

Hoy se duplica en frontend, backend y SQL. Centralizar IDs, alias, nombre, color y estado; la DB debería validar FK en vez de varios enums divergentes.

### G-04 — Migraciones formales

Adoptar Supabase migrations, node-pg-migrate, Prisma, Knex o equivalente. Regla esencial: una migración aplicada nunca se edita; se agrega otra.

### G-05 — Entorno de staging aislado

La prueba completa no debe apuntar a la base productiva. Crear Supabase local o proyecto staging con datos semilla y Storage separado.

### G-06 — Suite de recorridos críticos

Automatizar: registro/login, onboarding, editar perfil, seguir/bloquear, publicar/eliminar reel, comentar/responder, crear/guardar/borrar evento, unirse/salir/publicar en foro, soporte, denuncia, exportar y eliminar cuenta.

### G-07 — Accesibilidad automatizada y manual

Añadir axe en componentes/E2E y una matriz manual de teclado, lector de pantalla, zoom 200 %, contraste, movimiento reducido y móvil.

### G-08 — Capa de datos frontend

Hay `fetch` y estados repetidos en cada página. React Query/SWR o una capa propia pequeña aportaría caché, deduplicación, cancelación, reintentos controlados e invalidación.

### G-09 — Evitar autenticación innecesaria en GET públicos

`apiRequest` usa `auth=true` por defecto y consulta la sesión incluso para muchos GET públicos. Usar `auth:false` explícito o dos clientes (`apiPublica`, `apiAutenticada`) para reducir trabajo y dependencia de Supabase.

### G-10 — Búsqueda en servidor

Buscar descarga todos los reels/eventos y filtra en el navegador. Crear un endpoint global paginado con búsqueda normalizada/full-text y tipos de resultado.

### G-11 — Code splitting por rutas

El bundle actual es de unos 793 kB minificados (225 kB gzip) y Vite advierte que supera 500 kB. Usar `React.lazy`/imports dinámicos para mapa, Descubrir, perfiles y configuración.

### G-12 — Limpiar dependencias

Frontend declara `express`, `pg` y `cors` sin uso de navegador; Bootstrap/Bootswatch están instalados pero también llegan por CDN. Retirar paquetes no usados reduce superficie y tamaño.

### G-13 — Workspaces y scripts coherentes

Convertir raíz/Frontend/Backend en npm workspaces o mantener scripts proxy simples. Corregir nombres como `dev,server` y eliminar scripts sin función productiva.

### G-14 — Documentación real del proyecto

README sigue siendo la plantilla Vite y TODO describe un trabajo ya completado. Documentar arquitectura, requisitos, variables sin secretos, instalación, migraciones, comandos, staging y recuperación.

### G-15 — Actualizar el informe funcional existente

`INFORME_FUNCIONAL_SONDAR.md` todavía afirma que eventos aceptan imagen/coorganizadores y que soporte usa backend. Actualizarlo junto con cada entrega para no convertirlo en fuente de errores.

### G-16 — Error boundary y errores consistentes

Añadir Error Boundary por ruta y un formato API `{ error, code, requestId, details? }`. No mostrar mensajes crudos del proveedor a usuarios.

### G-17 — Observabilidad

Logs estructurados sin datos sensibles, métricas de latencia/error, trazas de DB/Storage/Email y alertas por tasa. Un ID de request debe viajar de frontend a backend.

### G-18 — Política de retries y timeouts

Definir qué operaciones se pueden reintentar y cuáles requieren idempotency key. Auth, creación de contenido y borrado necesitan tratamientos diferentes.

### G-19 — Separar datos de dominio de presentación

El backend no debería devolver textos de actividad ya pluralizados ni el frontend inferir semántica desde IDs como `db-42`. Devolver datos tipados y formatear en la capa de presentación.

### G-20 — Retirar código fantasma

`Registro.jsx` y `Usuarios.jsx` no están en rutas; `/api/posts/muro` devuelve siempre `[]`; `sondar-mobile` sólo contiene caché Expo y `.env`. Eliminar, completar o documentar para no confundir mantenimiento.

### G-21 — Políticas de backup y restauración probadas

Programar backup de DB y metadatos de Storage, cifrado, retención y prueba periódica de restore. Un backup no verificado no debe considerarse recuperable.

### G-22 — Revisión de privacidad

Documentar retención de denuncias, exportación, eliminación, proveedores externos (Supabase, EmailJS, Unsplash/CDN) y datos enviados. Añadir términos y privacidad accesibles desde Auth/Configuración.

### G-23 — Normalizar estado de publicación

En Comunidad, `tipo` mezclaba antiguamente orden (`reciente`, `popular`, `destacado`) con categoría (`preguntas`). La UI nueva reduce el problema, pero el esquema debería separar `tipo` de flags como `fijada` y métricas calculadas.

### G-24 — Optimizar consultas agregadas

Conteos correlacionados por publicación/reel funcionarán al inicio pero necesitan índices y análisis con volumen. Medir `EXPLAIN ANALYZE`, evitar `COUNT DISTINCT` sobre joins grandes y considerar vistas/resúmenes si realmente hace falta.

## Posibles nuevas funciones o formas alternativas de resolver lo existente

### N-01 — Invitaciones con aceptación

En vez de añadir una banda/persona inmediatamente, crear invitación `pendiente/aceptada/rechazada`. Sólo mostrar como participante después de aceptar; enviar recordatorio y permitir retirar invitación.

### N-02 — Perfiles de banda como entidad propia

Separar banda de usuario individual, con miembros, roles, discografía y eventos. Así “banda invitada” no depende de que una cuenta personal se presente como banda.

### N-03 — RSVP y lista de espera

Acciones `Voy`, `Me interesa`, cupo y lista de espera. Servirían para estimar asistencia sin reemplazar el enlace de entradas.

### N-04 — Recordatorios y calendario

Exportar `.ics`, agregar a Google/Outlook y notificar 24 h/2 h antes según preferencia.

### N-05 — Archivo de eventos pasados

Separar próximos/pasados, permitir recap y asociar reels publicados después del evento.

### N-06 — Rutas y accesibilidad del lugar

Abrir indicaciones, transporte, accesibilidad, edad mínima y horarios. Mantener coordenadas verificadas por backend.

### N-07 — Feed de foros unidos

Una vista “Mis foros” agregada por relevancia/recencia, manteniendo cada foro individual como fuente y filtro.

### N-08 — Preferencias de notificación por foro

Al unirse: ninguna, destacados, todas o resumen diario/semanal. Evita que membresía implique ruido automáticamente.

### N-09 — Roles de moderación comunitaria

Moderador/administrador por foro con fijar, cerrar, mover, ocultar, advertir y suspender, todo con historial auditable.

### N-10 — Edición e historial

Editar publicaciones/comentarios propios, mostrar “editado” y conservar versiones para moderación.

### N-11 — Borradores y autoguardado

Guardar localmente o en servidor título/texto/asociaciones. Recuperar después de cerrar modal o perder conexión.

### N-12 — Reintento offline honesto

Si se desea modo offline, usar cola persistente con estados `pendiente/enviado/fallido`, botón de reintento y reconciliación; no insertar contenido efímero sin seguimiento.

### N-13 — Búsqueda y etiquetas dentro del foro

Búsqueda paginada, etiquetas controladas, filtros por autor/pregunta/evento/reel y posibilidad de guardar una consulta, no una publicación individual si esa función ya no se desea en Recursos.

### N-14 — Recomendaciones explicables

“Te mostramos esto porque seguís Rock y a esta banda”, con opción de reducir un género/autor. Evitar ranking opaco basado sólo en likes.

### N-15 — Tiempo real selectivo

Nuevos comentarios, contador de miembros y notificaciones vía Realtime, pero sin reordenar el feed mientras el usuario lee. Mostrar una pastilla “Hay 3 publicaciones nuevas”.

### N-16 — Moderación previa asistida

Detección de spam/enlaces maliciosos y aviso antes de publicar; decisiones finales humanas, razones claras y apelación.

### N-17 — Vista de organizador/invitado del evento

Panel con estado de invitaciones, asistentes, enlaces, recordatorios y posibilidad de duplicar un evento recurrente.

### N-18 — Verificación de enlaces de entradas

Lista de dominios confiables, aviso de salida, detección de enlace roto y reporte de fraude. No bloquear productores pequeños: permitir enlace nuevo con revisión.

### N-19 — Analítica útil para artistas

Tendencia de reproducciones, conversión reel→perfil→evento y guardados, con privacidad y agregación mínima. Evitar métricas vanidosas sin contexto.

### N-20 — Panel operativo de administración

Cola de denuncias, estados, evidencias, historial de acciones, apelaciones, búsqueda de cuentas y health real sin exponer infraestructura.

### N-21 — Compartir enriquecido

Además de copiar enlace, usar Web Share cuando esté disponible y generar páginas con Open Graph por evento, reel y publicación.

### N-22 — Seguimiento de enlaces profundos

Validar que `?evento=`, `?lanzamiento=`, `?comunidad=` y `?publicacion=` siempre abran el objeto exacto; si fue borrado, mostrar un estado 404 específico y sugerencias relacionadas.

### N-23 — Variante oficial cuadrada del logo

Crear un asset de marca cuadrado para pines/cards y mantener el logo ancho en cabeceras. Sigue cumpliendo el uso de imagen predeterminada única sin permitir uploads.

### N-24 — Instalación/PWA opcional

Cachear shell, assets y lecturas recientes; no prometer publicaciones offline sin la cola descrita. Útil para mapas/listas en conectividad inestable.

## Orden recomendado de ejecución

1. Rotar secretos y purgar la historia; cerrar leaks de health/TLS.
2. Sacar DDL del runtime y eliminar el fallback SQL de Auth.
3. Separar persistencia de notificaciones y corregir flujos de borrado.
4. Incorporar rate limiting, validación server-side y paginación.
5. Crear staging, migraciones formales y CI con tests E2E.
6. Corregir lint/build raíz, N+1 y code splitting.
7. Completar moderación/edición de Comunidad y la pasada de accesibilidad/UX.

