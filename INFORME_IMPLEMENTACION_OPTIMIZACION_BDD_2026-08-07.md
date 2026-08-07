# Implementacion y optimizacion integral — 2026-08-07

## Resultado

Se implementaron los cambios funcionales pedidos y una primera etapa amplia de endurecimiento y optimizacion de frontend, backend y base de datos. La migracion fue preparada y verificada estaticamente, pero no se aplico sobre la base remota: hacerlo sin backup, staging y confirmacion seria un riesgo innecesario.

El informe exhaustivo original se conserva en `INFORME_AUDITORIA_EXHAUSTIVA_2026-08-07.md`. Este documento indica que se corrigio, que se mejoro parcialmente y que sigue pendiente.

## Cambios implementados

### Frontend

- Eventos ya no permite subir imagenes y siempre usa el logo local de SONDAR.
- Los textos visibles hablan de invitados o bandas invitadas; los nombres internos se conservaron para no romper la BDD.
- Eventos abre en proximos y ofrece alternar entre Proximos y Pasados.
- Comunidad tiene la estructura Foros | contenido | Reglas y Recursos, reglas comunes con contraste blanco y sin el recurso Publicaciones guardadas.
- Crear post solo se habilita al pertenecer al foro, con la misma regla en backend.
- Membresia usa PUT/DELETE idempotentes; se conserva el POST toggle solo por compatibilidad temporal.
- Los botones de compartir foro/publicacion tienen comportamiento real.
- Un comentario fallido ya no aparece falsamente como publicado: el texto queda disponible para reintentar.
- Descubrir elimino el N+1 de comentarios y perfiles. La lista devuelve avatar y conteo; los comentarios se cargan al abrir el panel.
- Comunidad carga comentarios por publicacion y eventos/reels asociables solo cuando son necesarios.
- Soporte y avisos de denuncia ya no exponen EmailJS en el navegador; todo pasa por el backend.
- Todas las paginas son chunks lazy, existe boundary de errores, pagina 404 y estados de carga.
- Se retiraron los CDN de Bootstrap/Leaflet; los assets salen de dependencias versionadas.
- Se comprobo que no habia clases Bootstrap en uso y se retiro tambien Bootstrap/Bootswatch: el CSS inicial de produccion bajo de 264,74 kB a 28,91 kB (aproximadamente 89%).
- Se corrigieron los errores globales de ESLint y se separo el contexto de preferencias para Fast Refresh.
- `lang` ahora es `es-AR` y se agrego descripcion de la aplicacion.

### Backend

- Se elimino el DDL del arranque y de las peticiones. Los metodos antiguos quedaron como no-op temporal.
- La creacion/eliminacion de Auth usa exclusivamente la API administrativa de Supabase; no escribe `auth.users` ni `auth.identities`.
- Las altas publicas solo aceptan los roles `musico` y `organizador`; un cliente no puede autodeclararse `admin`.
- Health devuelve solamente `ok` y `version`.
- CORS denegado devuelve 403 JSON, existe 404 JSON y handler final con `requestId`.
- Se desactivo `X-Powered-By` y se agregaron cabeceras defensivas.
- Se limito JSON a 512 KiB.
- Hay limites de solicitudes globales y reforzados para alta y soporte.
- TLS de PostgreSQL valida certificados por defecto y admite CA configurada.
- Pool con keepalive, timeouts y nombre de aplicacion; sin conexion lateral al importar el modulo.
- Validacion central de texto, URLs HTTP(S), coordenadas, fechas, precios, duracion y catalogos de genero.
- Las cargas multimedia limitan cantidad, campos y tamano; validan MIME declarado y firma binaria antes de enviar archivos a Storage.
- Eventos, reels, publicaciones y comentarios tienen topes de respuesta.
- Perfiles, bloqueados y seguidos tienen limites defensivos.
- Los comentarios padre se validan contra el reel/publicacion correspondiente.
- Las asociaciones a eventos/reels verifican que el contenido exista.
- La consulta de comunidades ya no multiplica publicaciones por miembros para contar; usa agregados laterales.
- La consulta de reels reutiliza un unico bloque de metricas en lugar de repetir los mismos conteos.
- La eliminacion de cuenta borra Auth antes de Storage y reporta archivos pendientes; evita dejar una cuenta activa sin medios por un fallo previo.
- Se quitaron dependencias de servidor del paquete Frontend y una libreria PostgreSQL no usada del Backend.

### Base de datos

- Se creo `supabase/migrations/202608070001_optimizacion_integral.sql`.
- La migracion agrega las columnas de preferencias faltantes y normaliza usernames una sola vez.
- Crea, si faltan, tablas de likes de comentarios, compartidos, vistas, bloqueos, denuncias y miembros.
- Tipifica asociaciones de Comunidad como `bigint`, limpia identificadores no numericos y agrega FK a eventos/reels con `ON DELETE SET NULL`.
- Agrega checks para coordenadas, URLs, longitudes y generos. Se crean `NOT VALID` para no bloquear por datos historicos; si aplican inmediatamente a escrituras nuevas.
- Agrega indices alineados con filtros, joins, orden y conteos de Eventos, Reels, Comunidad, seguidores, bloqueos, denuncias y notificaciones no leidas.
- Activa RLS en las tablas incorporadas y agrega politicas propias para membresia.
- Revoca INSERT/UPDATE/DELETE a `anon` y `authenticated` sobre las tablas de negocio: el frontend usa Supabase para Auth y toda escritura atraviesa el backend.
- Unifica las nueve comunidades canonicas mediante upsert.
- Se actualizo el esquema limpio para que coincida con validaciones, asociaciones e indices actuales.
- El dump historico invalido ahora esta marcado de forma visible como no ejecutable.
- Se agrego una guia de despliegue, verificacion y validacion de constraints en `Backend/BDD-Sql/README.md`.

## Estado de los hallazgos vitales previos

| Hallazgo | Estado | Resultado actual |
| --- | --- | --- |
| Secretos `.env` | Parcial | Ignorados y ejemplos seguros; las claves presentes en historia deben rotarse y purgarse fuera de este cambio. |
| DDL en arranque/requests | Corregido | Todo el DDL activo paso a migracion versionada. |
| Escritura directa en Auth | Corregido | Solo API administrativa de Supabase. |
| Notificaciones pospersistencia | Parcial | Los helpers absorben fallos; falta outbox durable para garantia total. |
| Rate limiting | Parcial | Implementado por proceso; falta almacenamiento compartido para varias instancias y CAPTCHA. |
| EmailJS en navegador | Corregido | Canal unico desde backend. |
| TLS sin validacion | Corregido en codigo | Produccion debe suministrar una CA valida si su proveedor no usa una CA del sistema. |
| Health/cabeceras/CORS | Corregido | Cubierto por prueba HTTP. |
| Eliminacion de cuenta | Mejorado | Orden seguro y limpieza tolerante; falta flujo `pending_deletion` recuperable. |
| Eventos pasados | Corregido | Proximos por defecto y selector Pasados. |
| Validacion backend | Corregido | Ademas reforzado en BDD. |
| Listados ilimitados | Mejorado | Topes y carga diferida; faltan cursores para crecimiento grande. |
| N+1 en Descubrir | Corregido | Comentarios bajo demanda, avatar/conteo en listado. |
| Build raiz/lint | Corregido | Ambos pasan. |
| Cobertura baja | Mejorado | 14 pruebas; siguen faltando integracion real y E2E. |
| CI ausente | Corregido | Workflow de lint, tests y build en Node 22. |
| Dump no restaurable | Identificado | Marcado como historico; todavia se necesita generar y probar un `pg_dump` real. |
| Migraciones contradictorias | Mejorado | Nueva secuencia Supabase; los SQL historicos siguen archivados para no reescribir historia. |
| Falso comentario offline | Corregido | No se inserta contenido fantasma. |
| Generos desalineados | Corregido para nuevas escrituras | Catalogo compartido backend y checks BDD; datos viejos deben auditarse antes de validar constraints. |
| Toggle de membresia | Corregido | PUT/DELETE idempotentes. |

## Analisis de BDD y decisiones

### Integridad

Las PK compuestas de interacciones impiden duplicar likes, guardados, vistas, membresias y relaciones. Las FK con cascada eliminan interacciones cuando desaparece su contenido o usuario. En asociaciones editoriales se eligio `SET NULL`: borrar un evento/reel no debe borrar la publicacion comunitaria completa.

Los checks de aplicacion se duplican deliberadamente en BDD. El frontend ayuda al usuario, el backend rechaza clientes directos y PostgreSQL evita corrupcion si otra herramienta escribe datos.

### Rendimiento

Los indices agregados responden a patrones observados, no a todas las columnas. En particular: fecha/genero/creador para eventos; fecha/genero/creador y FK inversas para reels; foro-fecha y autor-fecha para publicaciones; FK inversas para conteos; indice parcial para no leidas. Se evitaron indices redundantes sobre el primer campo de una PK existente.

No se recomienda crear tablas de contadores todavia. Primero deben medirse planes con volumen real. Si los conteos siguen dominando, la evolucion correcta es una tabla de estadisticas actualizada transaccionalmente o una vista materializada, con reconciliacion periodica.

### RLS y roles

RLS queda como defensa adicional para acceso directo via Supabase. El backend usa su propia conexion y debe operar con un rol DML sin permisos para crear/alterar objetos. El rol de migraciones debe ser distinto y utilizarse solo durante despliegue.

### Riesgos de migracion

- El indice unico de username fallara si la normalizacion no resuelve un caso legado inesperado.
- Cambiar asociaciones de texto a bigint pone en NULL valores no numericos; se debe revisar el conteo antes y despues.
- Las FK `NOT VALID` aceptan filas historicas huerfanas pero bloquean nuevas; deben validarse tras sanear legado.
- Crear indices normales puede consumir I/O y tomar locks breves. En tablas grandes conviene separar `CREATE INDEX CONCURRENTLY` fuera de la transaccion.
- La migracion presupone el esquema funcional previo; una instalacion vacia debe comenzar con `Esquema_Minimo_SONDAR.sql`.

## Auditoria de dependencias actual

- Backend: npm detecto una vulnerabilidad alta de Multer y una baja de body-parser. `npm audit fix --omit=dev` actualizo ambas; la nueva auditoria de produccion queda en cero.
- Raiz: se eliminaron cuatro dependencias duplicadas, se actualizaron `concurrently`/`shell-quote` y las herramientas de ejecucion/migracion quedaron como dependencias de desarrollo; el arbol productivo queda vacio y la auditoria en cero.
- Frontend: se retiro EmailJS y dependencias de servidor no utilizadas. React Router 7.18.2 corrige las alertas aplicables al SPA, pero npm mantiene alertas nuevas sobre funciones RSC/SSR. SONDAR usa `BrowserRouter` como SPA y no usa RSC, acciones de servidor ni SSR; el riesgo no es alcanzable por la arquitectura actual, aunque debe actualizarse cuando exista una version corregida.

## Pendientes prioritarios

1. Rotar `DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY` y claves de EmailJS que aparecieron en la historia; luego purgar esa historia.
2. Configurar `SUPABASE_ANON_KEY` en el entorno del backend; el fallback actual a service role solo evita romper la validacion durante la transicion.
3. Ensayar la migracion en staging con copia anonimizada y planes `EXPLAIN ANALYZE`.
4. Generar un `pg_dump` real y probar restauracion automatica.
5. Implementar outbox de notificaciones y borrado de cuenta por estados.
6. Reemplazar rate limiting en memoria por Redis/Upstash al desplegar mas de una instancia.
7. Agregar paginacion por cursor, no solo limites, para perfiles, eventos, reels y comunidad.
8. Completar pruebas E2E autenticadas, Storage, RLS, responsive, foco de modales y lectores de pantalla.
9. Completar moderacion/edicion/borrado de publicaciones y comentarios de Comunidad.

## Verificaciones ejecutadas

- ESLint completo: aprobado sin warnings.
- Backend: 14/14 pruebas aprobadas.
- Build de produccion desde raiz: aprobado.
- `git diff --check`: sin errores de whitespace.
- Auditoria npm Backend de produccion: 0 vulnerabilidades luego de actualizar.
- Auditoria npm del paquete raiz: 0 vulnerabilidades luego de actualizar.
- Auditoria npm Frontend de produccion: 2 alertas sobre la misma vulnerabilidad de React Router RSC, no alcanzable en este SPA y sin version 7 corregida publicada al momento del control.
- Migracion: inspeccion estatica y pruebas de presencia de indices, FK, RLS y politicas.

No se probaron mutaciones sobre produccion ni se aplico la migracion remota.
