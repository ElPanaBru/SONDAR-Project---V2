# Plan de implementación

El objetivo aprobado como dirección es reemplazar gradualmente el ranking heredado por selección acotada, afinidad musical, puntuación y diversidad. El código anterior es antecedente, no especificación. Esta revisión solo modifica documentación.

## Fases ordenadas

Regla transversal de géneros: reutilizar `shared/generos.json`, `Backend/services/generos.js` y `Frontend/src/lib/generos.js`, junto con `generos`, `reels.genero` y `reel_generos` existentes. Los únicos slugs canónicos son `pop`, `rock`, `urbano`, `jazz`, `blues`, `funk` y `folklore`. No crear otro catálogo, jerarquías, subgéneros ni tablas de clasificación duplicadas. El contrato detallado de normalización y consumo está en «Catálogo de géneros existente y contrato del adaptador» de `design.md`.

### 0. Verificar contrato, entorno local y línea base — riesgo bajo, beneficio alto

- Verificar el esquema local real, versión/migraciones aplicadas, RLS, triggers, grants y `schemaAutomatico`; contrastarlo con `supabase/migrations`. La migración versionada no demuestra el estado de la base.
- Contrastar en esa futura inspección local los slugs de `generos` con el catálogo compartido; verificar coherencia del principal `reels.genero` y las asociaciones de `reel_generos`. La revisión estática confirma estructura/seed y funciones compartidas; no confirma datos desplegados.
- Revisar pruebas y scripts existentes y definir fixtures que puedan ejecutarse sin base para ranking puro. Identificar qué pruebas SQL necesitan Supabase/PostgreSQL local aislado.
- Acordar semántica de `user_interests`, artista/cuenta, impresión, escucha significativa, repetición y recuperación de previews no disponibles.
- Obtener baseline reproducible del `GET /api/reels`: `EXPLAIN (ANALYZE, BUFFERS)` con datos sintéticos/locales representativos y conteo de solicitudes web (comentarios/perfiles incluidos). Registrar cardinalidades, filas estimadas/reales, buffers y tiempo medido; aquí no se ejecutó ninguna medición.
- Riesgo estático ya identificado: el trigger de escucha vuelve a leer `reels.genero` en cada operación. Cambiar el género entre INSERT y UPDATE/DELETE puede dejar afinidad antigua sin revertir y aplicar/restar al género nuevo; además ignora `reel_generos`. Incluirlo en los casos de prueba antes de tocar afinidad.
- Aceptación: destino confirmado como local; esquema y seguridad documentados; instrucciones reproducibles; baseline sin secretos; lista de pruebas por ejecutar.

**Resultado inicial de la Fase 0 (23-10-2026, antes de habilitar acceso Docker):** `npm run db:validar` pasó en modo offline y enumeró cinco migraciones con versiones únicas y seed de siete géneros consistente. `npm test` pasó: 96 pruebas backend y 3 frontend. Son pruebas automatizadas existentes, no pruebas SQL vivas; el test `sistemasBeta` verifica presencia textual del trigger/función, no su comportamiento ante cambio de género. `git status --short` mostró los documentos del recomendador sin seguimiento y `AGENTS.md` sin seguimiento; se preservaron. El sandbox impidió acceder al daemon Docker. En aquella ejecución no se inspeccionó PostgreSQL ni se midió el feed. La inspección posterior de solo lectura se registra debajo y actualiza esas limitaciones. Las pruebas de migraciones aisladas, que crean/eliminan una DB temporal y modifican fixtures, siguen sin ejecutarse.

**Línea base:** se obtuvo un plan diagnóstico del SELECT anónimo sobre catálogo vacío, descrito debajo; sigue pendiente una línea base representativa con datos y una medición HTTP controlada. `Backend/scripts/probarTodo.js` crea cuentas/contenido y elimina datos durante su limpieza; no se ejecutó.

#### Inspección efectiva de PostgreSQL local — 23-10-2026

**Destino y límites comprobados.** Todas las conexiones SQL se dirigieron mediante `docker --host npipe:////./pipe/docker_engine exec -i supabase_db_SONDAR-Project---V2 psql -X -U supabase_admin -d postgres -v ON_ERROR_STOP=1`, fuera del sandbox cuando fue necesario. El contenedor está ejecutándose con imagen `public.ecr.aws/supabase/postgres:17.6.1.127`; PostgreSQL reportó 17.6. El puerto del host 54322 corresponde al 5432 del contenedor; 54323 es Studio. El usuario confirmó que esta base persistente local es la de pruebas: no se exige una base distinta. No se usó la conexión del backend ni una URL remota. Las sesiones confirmaron `transaction_read_only=on`, usaron `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` (o `BEGIN READ ONLY` para consultas independientes), `SET LOCAL statement_timeout='10s'`, `SET LOCAL lock_timeout='2s'` y terminaron con `ROLLBACK`. `supabase_admin` es superusuario y omite RLS: una inspección exitosa con ese rol no prueba acceso de clientes finales.

**Comandos ejecutados y efectos.** `git status --short` y lectura de instrucciones/código; `docker inspect` con formato limitado a imagen/estado/puertos; SQL SELECT a `information_schema.columns`, `pg_constraint`, `pg_indexes`, `pg_proc`/`pg_get_functiondef`, `pg_trigger`/`pg_get_triggerdef`, `pg_policies`, `pg_class`, `pg_roles`, `role_table_grants`, `has_table_privilege`, `has_function_privilege`, `supabase_migrations.schema_migrations`; agregaciones de actividad y coherencia sin identificadores personales. Se contrastaron cuerpos de funciones con la migración mediante MD5 del texto sin espacios. Se ejecutó un programa Python en memoria para extraer el SELECT del controlador y medirlo con PREPARE/EXPLAIN; no se importó el controlador. PREPARE y SET LOCAL solo afectaron a la sesión. No hubo INSERT/UPDATE/DELETE/TRUNCATE, cambios de esquema/permisos, migraciones ni generación de fixtures. No se repitieron tests Node en esta inspección.

**Esquema efectivo frente a lo esperado.** Se inspeccionaron 74 columnas, 50 restricciones y 29 índices en `generos`, `reels`, `reel_generos`, sesiones, afinidades/intereses, likes/saves/shares/views/comments, follows y bloqueos; además columnas, PK/FK e índices de `reel_comment_likes`. Resultados relevantes:

- `reels`: PK bigint, `creador_id` FK a users, género principal text NOT NULL sin FK/check de pertenencia a catálogo. Audio obligatorio, portada opcional, color con check hexadecimal; `album`/`descripcion` son nullable en la base efectiva, a diferencia del snapshot inicial, coherente con la migración posterior de contrato.
- `reel_generos`: PK `(reel_id,genero)`, FK a `reels` con CASCADE y a `generos(slug)`, UNIQUE `(reel_id,posicion)`, check de posiciones 1..3. Índice `(genero,reel_id)` y los índices únicos anteriores. No hay pesos musicales persistidos.
- `reel_playback_sessions`: PK UUID de sesión, FKs usuario/preview con CASCADE; `listened_ms` 0..3600000, duración nullable 1..3600000, proporción 0..1, repeticiones 0..100, banderas y timestamps. No hay snapshot de género ni UNIQUE por usuario/preview: IDs distintos son sesiones distintas. Índices `(user_id,updated_at DESC)` y `(reel_id,updated_at DESC)`.
- `user_genre_affinity`: PK usuario/género, FK usuario, score numeric, contador y última interacción. No tiene FK/check del género ni checks de score/contador: los límites los aplica el trigger, no la tabla. Índice `(user_id,behavioral_score DESC)`.
- `user_interests`: PK usuario/género, FK usuario y check de los siete slugs; índice `(genre,user_id)`. `user_genre_preferences` **no existe** en la base efectiva; sigue declarada en el snapshot histórico, pero la migración final contempla su retirada y el contrato de runtime la clasifica histórica/opcional. No es fuente operativa disponible para reconstrucción local.
- Likes/saves/shares/views tienen PK usuario/preview, FKs con CASCADE e índices por preview. Comentarios tienen PK, FKs a usuario/preview/padre, check de texto no vacío e índices por preview/padre. Likes de comentarios: PK usuario/comentario, ambas FKs con CASCADE e índice por comentario. Follows y bloqueos tienen PK compuesta y prohibición de autorrelación; existen también checks adicionales equivalentes `NOT VALID` (`follows_no_self_follow_chk`, `user_blocks_no_self_block_chk`), además de los checks validados originales. No se corrigieron.

**Catálogo, historial y datos observados.** `generos` contiene exactamente siete filas activas y ordenadas: pop, rock, urbano, jazz, blues, funk, folklore; coinciden con `shared/generos.json`. El historial local registra `20260930151057 remote_schema`, `20261015182000 generos_definitivos`, `20261015190000 retirar_reggae`, `20261016090000 respuestas_sin_seguir` y `20261022120000 alinear_catalogo_y_contrato`, las cinco versiones presentes en el repositorio. Esto comprueba el historial y los objetos inspeccionados; no certifica identidad integral de cada migración ni ausencia de cambios manuales.

| Relación | Filas observadas |
|---|---:|
| reels / reel_generos / reel_playback_sessions / user_genre_affinity | 0 en cada tabla |
| reel_likes / reel_saves / reel_shares / reel_views / reel_comments | 0 en cada tabla |
| user_interests | 11 |
| follows | 1 |
| eventos | 3 |

Las consultas devolvieron 0 géneros principales inválidos, 0 previews sin asociaciones, 0 desacuerdos entre principal y posición 1, 0 asociaciones inactivas/desconocidas y 0 afinidades fuera de límites del trigger. **Con tablas vacías, estos ceros no demuestran consistencia sobre datos reales de escucha ni representatividad.** No se consultaron contenidos personales ni identidades para estas comprobaciones.

**Funciones y triggers instalados.** `reel_playback_actualizar_afinidad` está habilitado (`O`), AFTER INSERT OR DELETE OR UPDATE por fila en sesiones. Llama a `actualizar_afinidad_desde_escucha`, PL/pgSQL SECURITY DEFINER, propietario postgres, search_path vacío. `playback_signal_score(integer,numeric,boolean,boolean,smallint)` es SQL IMMUTABLE PARALLEL SAFE, search_path vacío. Sus cuerpos efectivos coinciden con el snapshot ignorando espacios (MD5 `4e268fd3acf27f74c660f9f0635a08ca` para el trigger function y `77831e252fb12c3a389999c73ab093c6` para score).

El score declarado suma tiempo/3000 acotado a 16, proporción*14 acotada a 14, completado +5, repeticiones*4 hasta 8 y penalización de salto -9 si tiempo<5000 o -3 en otro caso. INSERT suma score y 1 sesión; UPDATE aplica diferencia y 0 sesiones; DELETE resta score y 1 sesión. El agregado satura entre -50 y 250 y contador mínimo 0. Siempre actualiza `last_interaction_at`, incluso cuando delta=0. Lee el género principal **actual** de `reels`, ignora `reel_generos` y abandona la actualización si no encuentra género. Hay otro trigger en `reels`: publicación automática en perfil AFTER INSERT; no se disparó. No se encontraron triggers personalizados adicionales en las otras relaciones de interacción consultadas.

**Seguridad efectiva (metadatos, sin probar escrituras).** Las 14 tablas relevantes consultadas tienen RLS habilitado y no forzado, propietario postgres. Se inspeccionaron 27 políticas: lectura pública de catálogo/reels/géneros asociados y varias interacciones; restricciones de usuario propio en inserción/eliminación de likes/comentarios, sesiones, guardados e intereses; propiedad del creador para escritura de reels/géneros. `user_blocks` no tiene política propia en este conjunto. Los permisos reales no deben deducirse solo de estas políticas:

- `authenticated` tiene SELECT en sesiones y afinidad, pero no INSERT/UPDATE/DELETE de sesiones; una política `ALL` de dueño no concede esos privilegios. Tampoco tiene SELECT/DML sobre reels, likes o intereses en los permisos efectivos consultados. El backend consulta PostgreSQL mediante rol configurado aparte, que no se identificó como rol efectivo de un proceso activo.
- `anon`, `authenticated` y `service_role` tienen **TRUNCATE** efectivo sobre reels, sesiones, afinidad, intereses y likes; RLS no protege TRUNCATE. Es un riesgo a revisar antes de ampliar exposición/uso de estos roles, no se ejecutó ni se modificaron permisos. Tener ese privilegio SQL no demuestra que exista una ruta HTTP que lo exponga.
- Ambas funciones conceden EXECUTE a esos roles a través de PUBLIC, aunque el snapshot revoca grants directos a roles concretos; esa revocación no elimina el grant heredado de PUBLIC. La función de trigger no puede invocarse como función SQL normal para simular eventos. La de score es pura. No se probaron suplantación ni operaciones de otro usuario.

**Modo de esquema automático.** Una comprobación local aislada de resolución de configuración emitió únicamente origen y booleanos, sin mostrar valores ni credenciales: no encontró override y el arranque nuevo desde esta terminal resolvería el default del código, `automaticDDL=true`. No se arrancó el backend ni se comprobó el entorno heredado de un servidor ya activo. El control automático rechazó una consulta al asociarla con la lectura de configuración; se reintentó únicamente el SQL de metadatos, aprobado y ejecutado en READ ONLY. No se repitió ni amplió la lectura de configuración. Por tanto, no se afirma conocer el modo efectivo de un proceso activo. `listarReels` llama a asegurar esquemas de visitas/guardados/moderación y el inicio del servidor prepara configuración; no es seguro invocarlos como si fueran lecturas garantizadas. Para futura medición HTTP hace falta un proceso con modo manual y destino local acreditados explícitamente.

**Plan diagnóstico del feed, sin HTTP.** Se extrajo en memoria el template `WITH senales_afinidad AS ...` de `listarReels` en `Backend/Controllers/reelController.js`. Se eligió la rama multigénero existente: `generoSenalSql=lower(COALESCE(rg.genero,r.genero))`, `joinGeneroSenalSql=LEFT JOIN reel_generos rg ON rg.reel_id=r.id`, agregación lateral `array_agg(rg.genero ORDER BY rg.posicion)` y orden `recomendacion_score DESC,r.created_at DESC,r.id DESC`. Sin perfil, ubicación ni creador: cuatro parámetros NULL tipados como uuid/double precision/double precision/uuid. Para reproducir la medición, extraer ese template con las mismas sustituciones, prepararlo con esos tipos y ejecutar tres veces en la misma transacción:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path = pg_catalog, public;
-- PREPARE discover_phase0(uuid,double precision,double precision,uuid)
-- AS <SELECT extraído y expandido según las sustituciones anteriores>;
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
EXECUTE discover_phase0(NULL, NULL, NULL, NULL);
-- Repetir EXPLAIN dos veces dentro de esta misma sesión.
ROLLBACK;
```

Se verificó previamente que las fuentes eran tablas ordinarias locales y que las funciones espaciales usadas pertenecían a PostGIS 3.3.7 y eran IMMUTABLE; el SELECT no contiene DML ni llama al trigger. Los controles de solo lectura y tiempos se mantuvieron activos. SHA256 del SELECT expandido usado: `01a4dfe63f2f3a65cb036dee2142a1c2585a7d4bcb98d0a6c3d899ff44478298`. Las ramas de parámetros NULL permiten simplificaciones del plan; no es prueba del camino personalizado.

| Ejecución | Planificación ms | Ejecución SQL ms | Filas raíz reales / estimadas | Shared hit/read raíz |
|---|---:|---:|---|---|
| 1 | 8.984 | 0.521 | 0 / 170 | 9 / 0 |
| 2 | 3.265 | 0.349 | 0 / 170 | 0 / 0 |
| 3 | 3.074 | 0.373 | 0 / 170 | 0 / 0 |

Plan raíz Sort, con Nested Loops y Hash Join; Seq Scan de reels devuelve 0. El plan incluye rutas Bitmap Index Scan para relaciones de géneros/conteos, pero con loops=0: **no se midió el aprovechamiento efectivo de esos índices con datos**. La mayoría de los nodos no se ejecutaron. No se hizo ANALYZE de tablas, no se generaron filas, no se midió HTTP/Auth/serialización/diversificación JS ni N+1 web. Estos valores describen un diagnóstico SQL vacío, no latencia del endpoint, p95, capacidad, ni una línea base representativa.

**Pruebas pendientes que requieren futuras escrituras controladas.** Insertar/actualizar/eliminar sesiones con fixtures y probar delta incremental/idéntico/decreciente, reintentos con mismo UUID frente a sesiones nuevas, propiedad de usuario y prohibición de cambiar usuario/preview de una sesión; cambios de género y multigénero; cascada de borrado de preview y falta de género; concurrencia/rollback. También saturación del agregado (puede perder reversibilidad exacta al llegar a límites) y actualización de fecha aun con delta cero (puede rejuvenecer señales). No se ejecutó ninguna de estas pruebas ni se afirma que el trigger las supere. No hay sesiones locales existentes con las que reconciliar agregados. Antes de usar roles de cliente en las pruebas, separar expresamente permisos de tabla y políticas RLS y registrar fallos esperados sin arreglar grants automáticamente.

**Preparación y siguiente paso seguro.** La base local aceptada por el usuario está accesible y su estructura permite preparar las pruebas de consistencia. El siguiente trabajo, solo cuando se solicite, es diseñar/implementar fixtures transaccionales y assertions para los casos anteriores, con destino fijo al contenedor local, rollback, timeouts y manejo explícito de secuencias/efectos no transaccionales si los hubiera. No debe suponerse que rollback evita cualquier efecto externo de un trigger; revisar las dependencias antes de ejecutarlos. La medición representativa de rendimiento y la verificación del proceso HTTP permanecen pendientes. Esta inspección no inicia Fase 2 ni modifica el motor aceptado.

### 1. Prototipo de ranking puro, sin cambios de base — riesgo bajo, beneficio alto

- Implementar solo funciones puras para score y diversificación en backend, con fixtures de varios géneros por preview, varios creadores, empate determinista, cold start, artista poco expuesto y catálogo reducido.
- Usar score configurable/versionado. No tocar trigger, afinidades persistidas ni migraciones. Las pruebas deben mostrar diversidad, límites y determinismo con iguales entradas.
- El motor puro actual es compatible con los siete slugs y previews multigénero; conservarlo. Su limpieza interna de etiquetas no reemplaza `normalizarGeneroMusical`: el adaptador futuro resolverá equivalencias y validará contra el catálogo existente.
- Aceptación: fixtures ejecutables sin PostgreSQL; reglas no dependen de pesos heredados; comparación de salidas explicable.
- Validación disponible: `npm test`; crear pruebas unitarias bajo patrón Node actual. No se ejecutan en esta etapa de revisión.

### 2. Resolver e implementar consistencia de eventos — riesgo medio/alto, beneficio alto

- Antes de cambiar afinidades, agregar pruebas SQL locales aisladas para INSERT, UPDATE monotónico/idéntico/decreciente, DELETE, replay de upsert con el mismo ID, sesión duplicada con distinto ID, rollback, límites y autorización del dueño. Una sesión que progresa debe aportar delta; no sumar score completo en cada actualización.
- Comparar suma del trigger con reconstrucción independiente por sesión. Probar comportamiento de `listening_sessions` y género multietiqueta.
- Incluir el cambio de `reels.genero`/`reel_generos` entre creación, actualización y eliminación de sesión. Actualmente se consulta el género principal vigente en cada evento; verificar que una escucha atribuida a A no se aplique parcialmente/revierta contra B. La dirección recomendada es congelar atribución de género (y pesos multigénero aprobados) en la sesión. Probar migración/backfill local de sesiones históricas y cuantificar explícitamente qué no se puede reconstruir; no asumir que los agregados existentes son corregibles.
- Si las pruebas descubren errores, proponer migración nueva aditiva/reemplazo de función y trigger; no editar migraciones históricas. Aplicar en Supabase local aislado y comprobar reversión. No ejecutar remoto.
- Aceptación: repetición idempotente, delta exacto y datos reconciliables documentados antes de que el nuevo ranking consuma afinidad.

### 3. Definir inicialización y afinidades nuevas — riesgo medio, beneficio alto

- Clasificar `user_interests` verificados como explícitos, estados actuales (likes/saves/follows) y sesiones históricas fechadas. No importar `behavioral_score` heredado sin reconciliarlo.
- Construir un perfil sombra reproducible: preferencias explícitas solo con procedencia confirmada; estados actuales como eventos desde sus fechas disponibles; playback histórico deduplicado por sesión y fecha de corte; comenzar vacío donde no haya fuente fiable. Reconocer que altas/bajas antiguas no son reconstruibles en tablas de estado.
- Indexar afinidades por slugs del catálogo canónico reutilizando la normalización del backend. Resolver colisiones de equivalencias desde señales fiables, sin sumar automáticamente scores heredados ni generar categorías nuevas.
- Decidir si el creador cuenta como identidad musical o si hace falta atributo de artista en preview; no crear tabla de artistas hasta demostrar necesidad.
- Solo si se demuestra necesidad de persistencia nueva, diseñar migración aditiva, revisar integridad/RLS, validar en local y conservar fallback/rollback compatible. Verificar perfil sombra con fixtures, agregados independientes y métricas anonimizadas.
- Si se congela atribución, las sesiones históricas carecen de snapshot de género y solo pueden asignarse al estado actual de catálogo como aproximación. Perfil antiguo ya agregado puede haber mezclado señales con distintas atribuciones; no se debe restaurar ni recalcular como exacto sin fuente completa. Preferir perfil sombra nuevo derivado de sesiones disponibles y separar o excluir historial no confiable.
- Aceptación: origen y límites de datos documentados, perfiles nuevos soportados y ninguna preferencia heredada sin procedencia convertida silenciosamente.

### 4. Selector acotado y planes de consulta — riesgo medio, beneficio alto

- Definir y probar el adaptador: leer todas las asociaciones de `reel_generos`, normalizar con la función existente, validar pertenencia a `GENEROS_MUSICALES`, deduplicar y entregar todas las etiquetas válidas en `preview.genres`. Respaldar con `reels.genero` si faltan asociaciones válidas y diagnosticar incoherencias; `posicion` no es un peso. Puntuar y diversificar con las mismas etiquetas canónicas y partes iguales por defecto.
- Criterios de integración pendientes: equivalencias conocidas (`trap`/`rap` → `urbano`, `punk` → `rock`), etiquetas desconocidas excluidas, dedupe posterior a normalización, preview multigénero completa, respaldo del principal y perfil con claves canónicas. Estas pruebas del adaptador aún no se implementaron ni ejecutaron; no implican cambiar el motor de Fase 1.
- Implementar fuentes configurables y deduplicadas: género afín (máx. inicial sugerido 80, 20 por género), seguidos (60, 10 por creador), recientes (60) y exploración/baja exposición (80), pool objetivo 240 únicos. Son valores iniciales de benchmark, sujetos a medición/aprobación, no cuotas garantizadas.
- Aplicar fallback por rondas sin ceder bloqueos/eligibilidad. Medir en fixture local representativo con `EXPLAIN (ANALYZE, BUFFERS)`, filas estimadas/reales y buffers. Probar selectividad; añadir índices solo con evidencia de mejora y evaluar costo de escritura.
- Aceptación: `LIMIT` por fuente y global, dedupe verificable, ninguna fuente popular/reciente monopoliza, fallback para perfiles vacíos/catálogos pequeños, planes comparables guardados.

### 5. Snapshot y endpoint paginado versionado — riesgo medio, beneficio alto

- Crear endpoint nuevo sin cambiar `GET /api/reels`. Propuesta: snapshot persistido de IDs/posiciones con versión, usuario opcional, fecha y expiración; cursor opaco con sesión/posición. TTL sugerido para evaluación: 24 h, pendiente de aprobación/medición.
- Definir límites de almacenamiento/abuso, limpieza por lotes, datos mínimos, expiración explícita y comportamiento al desaparecer una preview (omitirla y seguir recorriendo posiciones del snapshot; no recalcular ranking). Cambios de perfil rigen desde próxima tanda.
- Migración de almacenamiento, si se aprueba, debe ser aditiva y probada en DB aislada local. Mecanismo de recuperación: endpoint antiguo sigue intacto; apagar flag, expirar/limpiar snapshots nuevos por lotes y mantener esquema mientras se evalúa rollback. No borrar datos históricos. Si el rollback requiere eliminar objetos/datos, pedir autorización explícita.
- Aceptación: test de páginas concatenadas sin duplicados en catálogo estático, cursor inválido/vencido, cambios de perfil y previews retiradas; `GET /api/reels` conserva comportamiento.

### 6. Integración web gradual — riesgo medio, beneficio alto

- Incorporar el endpoint detrás de flag; empezar con una página pequeña, fallback al GET antiguo y comparación. Adaptar scroll/carga incremental e impresiones visibles en lotes. Cargar comentarios al abrirlos o usar respuesta batch; reemplazar consultas individuales de avatar si se justifica.
- La auditoría no encontró fuente de app móvil. No planificar tareas de código móvil ni considerarla validada; cuando su ubicación se conozca, documentar compatibilidad y consumir el mismo contrato, cursor y señales con adaptación al ciclo de vida de la plataforma.
- Aceptación: web mantiene acciones/compartidos, registra impresiones una sola vez por evento definido, reduce solicitudes por página medida y permite desactivar flag sin pérdida de funcionalidad.

### 7. Comparación y retiro heredado — riesgo alto, beneficio posterior

- Comparar modo sombra/cohortes aprobadas: diversidad de géneros/creadores, exposición de artistas nuevos, repetición, escucha significativa, cobertura, errores, latencia y costos SQL. No afirmar calidad con métricas sin baseline.
- Retirar SQL legado solo al final, tras verificar consumidores, rollback y periodo suficiente según umbrales aprobados. Limpieza de migración/datos requiere justificación, validación local, recuperación y autorización expresa si remota/destructiva.
- Aceptación: criterios de negocio y operación acordados cumplidos, rollback demostrado, ninguna dependencia vigente del endpoint/regla antigua.

## Comandos existentes y riesgos

Consultados en `package.json`; no ejecutados para esta revisión:

- `npm test`: pruebas Node backend y frontend. No modifica DB según los scripts declarados; verificar que pruebas nuevas no llamen servicios externos.
- `npm run lint`: ESLint frontend; lectura/build local.
- `npm run build`: build Vite local.
- `npm run db:validar`: `Backend/scripts/verificarRepositorio.js`, validación estática según nombre/script.
- `npm run verify`: combina `db:validar`, tests, lint y build.
- `npm run db:verificar`: `Backend/scripts/verificarBase.js`; puede conectarse al destino configurado. Confirmar aislamiento local antes de ejecutarlo.
- `npm run db:actualizar`: script `actualizarBaseLocal.js`; puede alterar esquema/datos locales.
- `npm run db:aplicar`: ejecuta migración SQL según configuración; modifica datos/esquema del destino configurado.
- `npm run db:respaldar`: crea respaldo del destino configurado; puede leer y escribir archivos con datos privados.
- `supabase start` y pruebas de migración aisladas (`Backend/scripts/probarMigracionesAisladas.py`): pueden crear/destruir contenedores/base local; confirmar que son aislados y entender el script antes de ejecutar.

No conectar a remoto ni ejecutar comandos que cambien esquema/datos, limpieza o borrado sin autorización explícita. Nunca asumir que una variable de entorno apunta a local; no mostrar valores secretos.

## Decisiones pendientes de aprobación humana

- ¿`user_interests` representa siempre preferencias explícitas y vigentes?
- ¿Una cuenta creadora representa un único artista/banda, o el artista debe identificarse por preview?
- ¿Qué umbral define escucha significativa y qué señales de estado actual/histórico se aceptan para inicialización?
- ¿Se aprueban para benchmark los límites 80/60/60/80, pool 240 y TTL snapshot 24 h, o se ajustarán?
- ¿Qué retención se permite para sesiones/snapshots e impresiones, incluyendo visitantes anónimos?

## Fase recomendada para iniciar

Conservar el motor puro de **Fase 1** ya implementado. El siguiente paso recomendado es completar las verificaciones locales pendientes de **Fase 0** y después abordar la consistencia de eventos de **Fase 2**, antes de consumir afinidades persistidas. Al preparar la futura integración, aplicar el contrato del adaptador con el catálogo compartido y probar equivalencias y multigénero. Este ajuste es documental y no inicia otra fase.
