# Plan de implementación

El objetivo aprobado como dirección es reemplazar gradualmente el ranking heredado por selección acotada, afinidad musical, puntuación y diversidad. El código anterior es antecedente, no especificación. Esta revisión solo modifica documentación.

## Fases ordenadas

### 0. Verificar contrato, entorno local y línea base — riesgo bajo, beneficio alto

- Verificar el esquema local real, versión/migraciones aplicadas, RLS, triggers, grants y `schemaAutomatico`; contrastarlo con `supabase/migrations`. La migración versionada no demuestra el estado de la base.
- Revisar pruebas y scripts existentes y definir fixtures que puedan ejecutarse sin base para ranking puro. Identificar qué pruebas SQL necesitan Supabase/PostgreSQL local aislado.
- Acordar semántica de `user_interests`, artista/cuenta, impresión, escucha significativa, repetición y recuperación de previews no disponibles.
- Obtener baseline reproducible del `GET /api/reels`: `EXPLAIN (ANALYZE, BUFFERS)` con datos sintéticos/locales representativos y conteo de solicitudes web (comentarios/perfiles incluidos). Registrar cardinalidades, filas estimadas/reales, buffers y tiempo medido; aquí no se ejecutó ninguna medición.
- Riesgo estático ya identificado: el trigger de escucha vuelve a leer `reels.genero` en cada operación. Cambiar el género entre INSERT y UPDATE/DELETE puede dejar afinidad antigua sin revertir y aplicar/restar al género nuevo; además ignora `reel_generos`. Incluirlo en los casos de prueba antes de tocar afinidad.
- Aceptación: destino confirmado como local; esquema y seguridad documentados; instrucciones reproducibles; baseline sin secretos; lista de pruebas por ejecutar.

**Resultado de la Fase 0 (23-10-2026):** `npm run db:validar` pasó en modo offline y enumeró cinco migraciones con versiones únicas y seed de siete géneros consistente. `npm test` pasó: 96 pruebas backend y 3 frontend. Son pruebas automatizadas existentes, no pruebas SQL vivas; el test `sistemasBeta` verifica presencia textual del trigger/función, no su comportamiento ante cambio de género. `git status --short` mostró los documentos del recomendador sin seguimiento y `AGENTS.md` sin seguimiento; se preservaron. `docker ps` no pudo acceder al daemon por permisos de Windows, así que no se acreditó un contenedor local. No se ejecutó `db:verificar`, ni inspección de DB/RLS/grants/config efectiva, ni EXPLAIN, ni baseline del endpoint. No se registraron tiempos/cardinalidades/planes. El modo de esquema en código tiene default `compatible`, que habilita DDL automático en ciertos controladores; valor efectivo no verificado. La prueba de migraciones aisladas crea y elimina una DB temporal dentro de Docker y modifica filas de fixture; no se ejecutó porque el daemon no era accesible y no se pudo verificar aislamiento.

**Línea base:** pendiente. Se necesita acceso a Supabase local aislado verificable y dataset sintético representativo; además, arrancar API/frontend con configuración local no secreta y contar solicitudes HTTP. El smoke test `Backend/scripts/probarTodo.js` no es apto como baseline: crea cuentas, previews, eventos y mensajes y hace eliminaciones de limpieza; no se ejecutó.

### 1. Prototipo de ranking puro, sin cambios de base — riesgo bajo, beneficio alto

- Implementar solo funciones puras para score y diversificación en backend, con fixtures de varios géneros por preview, varios creadores, empate determinista, cold start, artista poco expuesto y catálogo reducido.
- Usar score configurable/versionado. No tocar trigger, afinidades persistidas ni migraciones. Las pruebas deben mostrar diversidad, límites y determinismo con iguales entradas.
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
- Decidir si el creador cuenta como identidad musical o si hace falta atributo de artista en preview; no crear tabla de artistas hasta demostrar necesidad.
- Solo si se demuestra necesidad de persistencia nueva, diseñar migración aditiva, revisar integridad/RLS, validar en local y conservar fallback/rollback compatible. Verificar perfil sombra con fixtures, agregados independientes y métricas anonimizadas.
- Si se congela atribución, las sesiones históricas carecen de snapshot de género y solo pueden asignarse al estado actual de catálogo como aproximación. Perfil antiguo ya agregado puede haber mezclado señales con distintas atribuciones; no se debe restaurar ni recalcular como exacto sin fuente completa. Preferir perfil sombra nuevo derivado de sesiones disponibles y separar o excluir historial no confiable.
- Aceptación: origen y límites de datos documentados, perfiles nuevos soportados y ninguna preferencia heredada sin procedencia convertida silenciosamente.

### 4. Selector acotado y planes de consulta — riesgo medio, beneficio alto

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

Iniciar por la **Fase 0**. Primero confirmar que las pruebas y la inspección apuntan a un entorno local aislado, documentar procedencia de datos y obtener baseline reproducible. La Fase 1 de ranking puro puede seguir sin tocar base una vez cerrado ese marco. Esta revisión termina aquí; no inicia la fase siguiente.
