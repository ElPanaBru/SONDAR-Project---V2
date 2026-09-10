# SONDAR — base de datos optimizada y migracion compatible

Fecha del analisis: 9 de septiembre de 2026. Alcance: codigo disponible de frontend/backend y catalogo de la base PostgreSQL configurada por la app, consultado en una transaccion de solo lectura. La fecha exacta de la captura esta en `catalogo-observado.json`.

La propuesta conserva el comportamiento observable de la app disponible y reduce el esquema activo de **38 tablas / 257 columnas a 34 tablas / 236 columnas**. Se excluyen cuatro tablas sin referencias en esta version, sus 20 atributos y objetos dependientes, un atributo de configuracion sin consumo y dos checks duplicados. No se modifico la base de origen ni la logica de la aplicacion.

No se afirma equivalencia de clientes externos desconocidos ni una restauracion probada: no se proporciono un proyecto destino. El SQL es una propuesta revisable basada en el estado real, con validaciones estructurales y una guia de comprobacion. La migracion real incluye autenticacion y archivos; crear tablas solamente no alcanza.

## Archivos y como usarlos

| Archivo | Proposito |
|---|---|
| [01_instalacion_compatible.sql](01_instalacion_compatible.sql) | Un unico SQL para un proyecto Supabase inicializado con `public` vacio. Incluye modelo optimizado, claves, indices, funciones, triggers, RLS, permisos, catalogos y buckets. No contiene cuentas, contrasenas ni contenido privado. |
| [02_optimizar_copia_restaurada.sql](02_optimizar_copia_restaurada.sql) | Una transaccion para optimizar una copia completa del origen, conservando los datos de las tablas activas. Retira las tablas historicas y sus filas de esa copia: exige respaldo previo. |
| [03_verificar_destino.sql](03_verificar_destino.sql) | Consultas de solo lectura para comprobar estructura, conteos, seguridad, secuencias y algunas inconsistencias. |
| [DICCIONARIO.md](DICCIONARIO.md) | Todas las tablas y columnas conservadas, con tipos exactos, defaults, nulabilidad, restricciones, indices y referencias al codigo. |
| [EXCLUIDOS_Y_CANDIDATOS.md](EXCLUIDOS_Y_CANDIDATOS.md) | Inventario separado de todo lo excluido y de lo que parece obsoleto pero debe conservarse por compatibilidad. |
| [manifiesto-compatible.json](manifiesto-compatible.json) | Lista procesable del modelo destino y decisiones de exclusion. |
| [catalogo-observado.json](catalogo-observado.json) | Evidencia del esquema original, ACL, secuencias, funciones, conteos y catalogos publicos. Es una captura de metadatos, no un backup. |
| [referencias-tablas.json](referencias-tablas.json) | Ubicaciones de referencias por tabla en controladores, servicios, rutas, middlewares y frontend. |
| [VALIDACION_GENERACION.json](VALIDACION_GENERACION.json) | Resultado de las verificaciones estructurales offline. |

**01 y 02 son caminos alternativos.** No ejecutar 01 sobre una base restaurada ni cargar un dump del esquema original encima de 01. Para trasladar la app existente con datos, usar la restauracion completa y despues 02.

## Que usa realmente la app

El frontend React consume la API Express para los datos. Supabase se usa ademas para Auth, Storage y canales privados de Realtime. El backend accede a PostgreSQL con `pg` (`Backend/Pool_DB.js`) y mantiene validaciones y permisos de negocio en JavaScript. Por eso un PostgreSQL aislado sin esos servicios no es un destino equivalente.

| Modulo / entrada | Tablas conservadas | Comportamiento que depende de ellas |
|---|---|---|
| Usuarios, perfil y onboarding — `usuarioController.js` | `users`, `user_settings`, `user_interests` | UUID compartido con Auth; perfil, edad, gustos, idioma, privacidad y preferencias de notificacion. |
| Relaciones — `usuarioController.js`, `moderationService.js` | `follows`, `notification_mutes`, `user_blocks` | Seguir, silenciar, bloquear; condiciona contenido, notificaciones y mensajes. |
| Eventos — `eventoController.js` | `eventos`, `generos`, `evento_generos`, `event_organizers`, `event_saves` | Generos ordenados, coorganizadores, guardados, proximidad y recomendaciones por edad/gustos. |
| Previews — `reelController.js` | `reels`, `reel_generos`, `reel_views`, `reel_likes`, `reel_shares`, `reel_comments`, `reel_comment_likes` | Audio, portada, hasta tres generos, visitas unicas, likes, compartidos y comentarios anidados. |
| Aprendizaje del feed — `reelController.js` y triggers | `reel_playback_sessions`, `user_genre_affinity` | Tiempo escuchado, completitud, saltos y repeticiones; puntuacion acumulada y decaimiento temporal. |
| Foros — `comunidadController.js` | `comunidades`, `comunidad_miembros`, `comunidad_publicaciones`, `comunidad_publicacion_likes`, `comunidad_publicacion_guardados`, `comunidad_comentarios`, `comunidad_comentario_likes` | Membresia, publicaciones, respuestas, likes, guardados y notificaciones relevantes. |
| Comunidad de perfil — `perfilComunidadController.js` | `perfil_comunidad_publicaciones`, `perfil_comunidad_respuestas` | Publicaciones propias/manuales/automaticas, adjuntos y respuestas de seguidores. Convive con los foros. |
| Mensajeria — `mensajeController.js` | `conversations`, `conversation_members`, `messages` | Chats privados, respuestas, edicion/borrado, no leidos, entrega, historial de usuarios eliminados. |
| Notificaciones y denuncias | `notifications`, `content_reports` | Bandeja, lectura, deduplicacion y denuncias persistidas. |

Soporte envia mensajes por EmailJS (`soporteController.js`); no hay una tabla de tickets que deba inventarse. `Backend/data/local-db.json` no es consumido por los modulos actuales. La carpeta `sondar-mobile` disponible contiene configuracion/cache de Expo, sin codigo de aplicacion adicional auditable. No se infiere el comportamiento de una version movil externa.

## Decisiones para no alterar comportamiento

Se reproducen **140 restricciones, 90 indices, 10 funciones, 9 triggers y 87 politicas** entre los esquemas de aplicacion, Storage y Realtime. Se conserva la nulabilidad real: el esquema historico minimo impone algunos NOT NULL y checks que el origen no tiene. Agregarlos durante una migracion podria rechazar datos existentes o escrituras que hoy funcionan.

El origen es PostgreSQL 17.6, zona UTC, con PostGIS 3.3.7 en `gis`. `pgcrypto` esta en `extensions`. El destino debe mantener esas capacidades y el `search_path` necesario para `crypt`/`gen_salt`: existe un fallback de registro que escribe `auth.users` y `auth.identities` por SQL (`usuarioController.js:215`). No se exportan definiciones internas de Auth como si fueran tablas propias.

- `users.id -> auth.users.id ON DELETE CASCADE` conserva la identidad. No regenerar UUID al migrar usuarios.
- `messages.sender_id` y `conversations.created_by` admiten NULL y usan `ON DELETE SET NULL`. `conversation_members.user_id` conserva un UUID historico sin FK al perfil. Agregar esa FK o borrar esas membresias romperia el historial de usuarios eliminados.
- `reels.genero` y `eventos.genero` se mantienen junto a las tablas de multiples generos. Son el genero principal y todavia intervienen en consultas, fallbacks y aprendizaje. Las posiciones 1–3 son significativas.
- `user_genre_affinity` se transfiere con sus valores. No recalcularla simplemente sumando sesiones: la funcion limita la puntuacion a cada paso y las recomendaciones usan `last_interaction_at`.
- Las metricas visibles de previews y foros se calculan desde las tablas de interaccion. Las PK compuestas conservan la unicidad de vistas/likes/compartidos por usuario.
- `img_path`, `audio_path`, `portada_path` y `profile_img_path` son usados para eliminar archivos. La URL publica no reemplaza el path ni la propiedad del objeto en Storage.
- `reel_comments.responde_a` se usa. No confundirlo con el campo del mismo nombre en comentarios de foros, que aun se conserva por exportacion.
- Se mantienen `eventos.img_url/img_path` para contenido historico y limpieza, aunque el creador actual de eventos no suba imagenes.
- `content_reports`, `notification_mutes` y `user_settings` pueden estar vacias y seguir siendo necesarias. Cero filas no significa desuso.
- No se reactiva `on_auth_user_created`: el backend crea el perfil. Se mantiene el trigger de sincronizacion de email.
- No se cambia RLS por las politicas de otro archivo historico. El backend y el cliente directo tienen privilegios distintos; una politica de INSERT no implica permiso de INSERT si el GRANT esta revocado.

**27 columnas candidatas se conservan deliberadamente.** La exportacion de cuenta (`usuarioController.js:971`) devuelve filas crudas con `SELECT *`; la bandeja devuelve `n.*` (`notificacionController.js:10`). Borrar esas columnas cambia las respuestas. Para una segunda etapa mas agresiva habria que versionar ese contrato o implementar una proyeccion explicita y decidir que hacer con los valores historicos. No es una optimizacion transparente de base de datos.

El unico atributo excluido de una tabla conservada es `user_settings.created_at`: la configuracion se transforma mediante `mapearConfiguracion`, incluso en la exportacion. Se mantiene `updated_at`.

## Migracion con el menor numero de etapas

### Camino recomendado: trasladar cuentas y datos existentes

1. **Crear respaldo y restaurar una copia del proyecto.** Detener escrituras durante el respaldo final y el cambio de destino; incluir API, sesiones de clientes y cargas a Storage. Conservar un respaldo completo anterior a la optimizacion, incluidas las tablas excluidas. Usar la restauracion a un proyecto nuevo de Supabase cuando este disponible, o el procedimiento oficial de backup/restauracion CLI. La restauracion administrada incluye datos de Auth, pero los objetos y ajustes de Storage requieren traslado separado. [Restauracion a nuevo proyecto](https://supabase.com/docs/guides/platform/clone-project).
2. **Optimizar y completar los servicios en esa copia.** Revisar las exclusiones, ejecutar una vez `02_optimizar_copia_restaurada.sql`, copiar los archivos reales y verificar las personalizaciones de Auth/Storage/Realtime. Las 13 filas historicas de las tablas retiradas quedan en el respaldo externo. No usar el instalador 01 en este camino.
3. **Verificar y cambiar la conexion.** Ejecutar 03, comparar resultados con el respaldo final, realizar pruebas funcionales con usuarios del destino, configurar las variables y habilitar escrituras. Mantener el origen disponible para rollback hasta aceptar el cambio.

Desde la raiz del repositorio, con `psql` instalado y un servicio `sondar_destino` configurado localmente para la copia:

```powershell
psql "service=sondar_destino" -X -v ON_ERROR_STOP=1 -f docs/base-datos/02_optimizar_copia_restaurada.sql
psql "service=sondar_destino" -X -v ON_ERROR_STOP=1 -f docs/base-datos/03_verificar_destino.sql
```

La conexion del servicio debe ser del destino, con el rol de administracion autorizado. No guardar contrasenas en este informe. La sintaxis y el control de errores de restauracion estan documentados por [PostgreSQL](https://www.postgresql.org/docs/17/app-pgrestore.html).

Si se usa CLI en vez de una restauracion administrada, conservar roles, esquema y datos; revisar las modificaciones de `auth` y `storage` que deben restaurarse aparte. Usar conexion directa o pooler de sesion. Durante la carga de datos, seguir el tratamiento de triggers de la guia oficial: disparar publicaciones automaticas o recalcular afinidad durante la importacion duplicaria efectos. Reactivar el funcionamiento normal y comprobar integridad despues. No ejecutar la app sobre una carga parcial. [Guia oficial de backup y restauracion](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

No hay una unica sentencia SQL que copie tambien los binarios de Storage, configure proveedores de Auth y cambie las variables del despliegue. Los backups de base incluyen metadatos de objetos, no sus archivos. [Alcance del backup de Supabase](https://supabase.com/docs/guides/platform/backups).

### Camino alternativo: instalacion nueva sin datos de usuarios

Crear un proyecto Supabase inicializado, sin tablas de aplicacion en `public`, y ejecutar:

```powershell
psql "service=sondar_destino" -X -v ON_ERROR_STOP=1 -f docs/base-datos/01_instalacion_compatible.sql
```

El archivo aborta si `public` ya contiene tablas. Crea catalogos de 14 generos, 13 comunidades y tres buckets con la configuracion observada. No crea usuarios. Para sumar datos existentes despues haria falta un proceso de carga que preserve IDs, orden, secuencias y triggers; no mezclar directamente un dump que contiene las tablas retiradas. El camino de copia completa mas 02 evita esa transformacion.

## Servicios y configuracion que deben viajar

| Componente | Requisito |
|---|---|
| Auth | Conservar usuarios, identidades y hashes mediante restauracion soportada; revisar proveedores, SMTP, URLs de redireccion y ajustes del proyecto. La continuidad de sesiones/JWT requiere comprobacion independiente; no se promete que tokens del origen funcionen en el destino. |
| Storage | Buckets `perfiles`, `eventos`, `reels`; archivos, rutas, MIME, visibilidad y `owner_id`. Una carga administrativa que cambie el propietario puede impedir luego el borrado con JWT del usuario. |
| URLs historicas | La app almacena URLs absolutas. Copiar el mismo path a otro proyecto no actualiza esas URLs. Reescribir solo el prefijo del proyecto anterior en las columnas de Storage identificadas, sin alterar URLs externas; comprobar tambien adjuntos o URLs guardadas en contenido. |
| Realtime | Conservar funciones `broadcast_message_change`, `broadcast_conversation_read_change`, triggers y politicas `sondar_conversation_realtime_*`. El frontend se suscribe a `conversation:<uuid>`, incluyendo presencia y estados de entrega/lectura. No se observaron tablas de `public` en publicaciones; eso no significa que Realtime este sin uso. |
| Backend | Actualizar `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_ANON_KEY`. Revisar overrides `SUPABASE_EVENTOS_BUCKET`, `SUPABASE_REELS_BUCKET`, `SUPABASE_PERFILES_BUCKET`. Conservar permisos de SQL, Auth y Storage requeridos. |
| Frontend | Actualizar `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_API_URL`; reconstruir Vite y comprobar CORS/`FRONTEND_URL`. Las claves de administracion se configuran exclusivamente en backend. |
| Fallback de registro | Comprobar `auth.users`, `auth.identities`, `crypt`, `gen_salt` y permisos del rol backend. Es una dependencia de la version actual que una migracion de `public` sola no cubre. |

Para restauraciones manuales que usen Vault/cifrado, seguir tambien las instrucciones especificas del proveedor sobre claves: no inferir que la sola presencia de la extension prueba uso de secretos cifrados. Esta auditoria no lee secretos de Vault.

## Hallazgos en el material de migracion existente

`dump-db.js` no es un respaldo fiel: construye columnas con `data_type`, pierde detalles de tipo, no exporta PK/FK/checks/indices/politicas/secuencias y consulta triggers sin guardar sus definiciones. Serializa objetos de JavaScript genericos, lo que tampoco garantiza fidelidad para todos los tipos de PostgreSQL. Ademas contiene una credencial literal: no reutilizarla ni incluirla en el paquete; corresponde retirarla del codigo y rotarla por separado.

`transform-db.js` reemplaza `CREATE TABLE` por `ALTER TABLE` sin construir una sentencia ALTER valida y elimina INSERT. No es un migrador de esquema ni de datos.

`Esquema_Minimo_SONDAR.sql` no representa por si solo la base de esta version: faltan los sistemas beta y columnas incorporadas por DDL de runtime. `aplicarEsquemaMinimo.js` tiene una lista historica de tablas esperadas que trataria como extras tablas activas recientes. `Migrar_A_Esquema_Minimo.sql` contiene operaciones destructivas, incluida recreacion de intereses. No ejecutar todos los SQL historicos en orden alfabetico: existen scripts que vuelven a crear campos previamente retirados.

Los controladores crean algunos objetos automaticamente (`asegurarEsquemaModeracion`, comentarios/interacciones y comunidades), y el arranque normaliza usernames y modifica configuracion. El instalador conserva nombres de indices actuales para no generar duplicados con esos `CREATE INDEX IF NOT EXISTS`. Las futuras migraciones deberian tener una secuencia versionada y una sola fuente de verdad; eso se documenta como mejora posterior, sin modificar el arranque ahora.

Se observaron 78 conversaciones y solo cuatro membresias en total. Eso merece investigar historiales incompletos; no se eliminan conversaciones por esa razon ni se reconstruyen participantes automaticamente. 03 permite medir el problema en origen y destino. Copiar el estado actual y corregir datos son tareas distintas.

## Validacion y criterios de aceptacion

Se consultaron metadatos/conteos del origen en `REPEATABLE READ READ ONLY`; no se exportaron filas privadas. Se cruzaron referencias de las tablas retiradas con runtime, relaciones, funciones, triggers y politicas del catalogo. Se genero el diccionario por columna desde tipos reales, evitando inferirlo de formularios. Las comprobaciones offline detectan FK a tablas retiradas, secuencias faltantes y cambios de inventario.

Pruebas existentes: `npm test --prefix Backend`: **80 aprobadas, 0 fallidas**. Son pruebas de codigo/mocks y comprobaciones estaticas; no prueban el SQL generado contra Supabase. Los tres SQL pasaron el analizador `pgsql-parser` 18.2.6; resultado y hashes en `VALIDACION_SQL.json`. Eso comprueba sintaxis, no permisos, resolucion de dependencias, cuerpos PL/pgSQL ni compatibilidad de ejecucion con PostgreSQL 17. No se realizo una restauracion ni prueba funcional en un destino real.

Antes del cambio de conexion, verificar:

- Igualdad de filas e IDs de cada tabla conservada respecto del respaldo final, y contenido mediante comparacion determinista o checksums. Los conteos solos no prueban igualdad de datos. Los valores de esta auditoria son una foto, no el baseline del dia de migracion.
- PK, FK, restricciones, indices, defaults, identities, RLS y grants contra el catalogo ajustado por el manifiesto. 03 es una ayuda, no una certificacion automatica completa.
- Las secuencias deben permitir el siguiente INSERT sin colision y conservar el avance del origen. No reiniciarlas ciegamente a `max(id)` si el origen ya estaba mas adelantado. El valor `is_called` tambien importa.
- Registro, login, perfil, onboarding, preferencias y descarga de cuenta con las mismas claves y valores historicos.
- Crear preview con uno/tres generos, reproducir fragmento, registrar escucha, confirmar aprendizaje, visitas/likes/compartidos y comentar/responder.
- Crear/listar evento, distancia PostGIS, orden de generos, guardados y coorganizadores.
- Foros y comunidad de perfil: membresia, adjuntos, publicaciones automaticas, respuestas de seguidores y menciones.
- Chat entre dos usuarios, recibido/leido, edicion/borrado, historial tras baja de cuenta y acceso denegado para un tercero. Hacer bajas solo con cuentas de prueba del destino.
- Notificaciones/preferencias, denuncias y bloqueos, incluyendo el comportamiento con tablas vacias.
- Acceso publico a multimedia y eliminacion de portada/audio/avatar con el JWT del propietario del destino. Un enlace que aun funciona gracias al bucket del origen no prueba una copia exitosa.

Si algo falla antes del corte, descartar la copia y repetir desde respaldo. Si se habilitaron escrituras nuevas, volver al origen sin reconciliarlas perderia cambios: detener escrituras y decidir como preservarlas antes del rollback.

## Reproducir esta documentacion

Desde el repositorio, con las dependencias de backend instaladas:

```powershell
node Backend/scripts/auditarMigracion.js
node Backend/scripts/generarInformeMigracion.js
```

El primer script usa la conexion de `Backend/.env` y solo consulta; el segundo trabaja offline. Revisar el catalogo nuevo y el manifiesto de candidatos antes de regenerar para otra version. Los scripts no sustituyen `pg_dump`, un respaldo administrado ni el ensayo de restauracion.
