# Estado actual de Descubrir

Auditoría del repositorio al 23-10-2026. Describe el esquema versionado, no certifica el estado de ninguna base desplegada.

## Flujo de pantalla y solicitudes

- `Frontend/src/paginas/Descubrir.jsx` carga `GET /api/reels` al montar o cambiar usuario, filtro de creador o ubicación. Adjunta latitud/longitud cuando están disponibles y el token de Supabase cuando hay sesión.
- La API responde una lista completa; no recibe `limit`, `offset` ni cursor. La pantalla transforma los identificadores a `db-<id>`.
- Si se abre una preview compartida que no vino en la lista, se pide `GET /api/reels/:id` aparte.
- Para cada preview cargada se piden comentarios mediante `GET /api/reels/:id/comentarios` en paralelo. Si faltan avatares y hay token, pide el perfil de cada creador distinto: solicitudes paralelas adicionales.
- Al comenzar la reproducción autenticada, se envía `POST /api/reels/:id/visita` una vez por preview en la sesión del componente. En la reproducción también se reportan sesiones mediante `POST /api/reels/:id/interaccion`, con `sessionId`, duración escuchada, duración total, proporción, completado, salto y repeticiones.
- Likes, guardados, comentarios y compartidos se registran por endpoints separados. La autenticación web usa Supabase Auth; el frontend llama a la API propia con `apiRequest`.

## Backend y recomendación existente

`Backend/index.js` monta `Backend/routes/reels.js` en `/api/reels`; las rutas llaman a `Backend/Controllers/reelController.js`. El controlador consulta PostgreSQL mediante `Backend/Pool_DB.js` y utiliza el cliente Supabase para validar tokens y Storage.

`listarReels` construye una consulta SQL extensa. Para usuario autenticado combina intereses (`user_interests`), likes, compartidos, comentarios, visitas y `user_genre_affinity`. El SQL contiene ponderaciones explícitas (interés 30, like 6, compartido 8, comentario 4, visita 1), decaimiento exponencial de afinidad aprendida, límites, seguimiento de artistas, actividad de catálogo, novedad, popularidad, exploración determinista diaria del 15%, cercanía a eventos y penalización de previews vistas y propias. Son reglas heredadas observadas en código, no una especificación adoptada para el nuevo diseño.

El catálogo se ordena por score, fecha e ID y después se reordena con `diversificarReels`, que intenta evitar tres previews consecutivas con el mismo género principal o creador. Esta diversificación ocurre después de leer y puntuar todas las filas. `creador` reemplaza el orden por fecha descendente. La ruta no filtra `ya_visto`; solo resta score.

La selección usa el máximo puntaje de afinidad entre los géneros vinculados; la señal directa de interacciones en el CTE se genera por género de cada reel. `mapearReel` expone razones heredadas y marcas de recomendación. No encontré un modelo de artistas como entidad en el contrato consultado: las previews se asocian al creador de la cuenta.

## Persistencia encontrada en migraciones

La migración `supabase/migrations/20260930151057_remote_schema.sql` declara:

- `reels`, `reel_generos` (máximo tres posiciones, PK `(reel_id, genero)`), `reel_likes`, `reel_saves`, `reel_shares`, `reel_views` y `reel_comments`.
- `reel_playback_sessions`: UUID, usuario, preview, milisegundos, proporción, banderas completado/salto, repeticiones y marcas de inicio/actualización; ID es la clave primaria.
- `user_interests`, `user_genre_preferences` y `user_genre_affinity` (una fila por usuario/género con puntaje conductual, sesiones y fecha reciente).
- `playback_signal_score(...)` y trigger `reel_playback_actualizar_afinidad`, conectado a inserción, actualización y eliminación de sesiones. El cálculo está acotado y distingue escucha breve, proporción, completado, repetición y salto.
- Índices por reel en interacciones; índice `(genero, reel_id)` para `reel_generos`; índices de sesiones por `(reel_id, updated_at DESC)` y `(user_id, updated_at DESC)`; afinidad `(user_id, behavioral_score DESC)`; catálogo por creador y fecha.

La migración base muestra RLS habilitado en las tablas de actividad relevantes. El backend opera con PostgreSQL y un rol configurado fuera del repositorio; no se inspeccionaron políticas completas ni permisos efectivos. Las tablas no exponen una tabla de artista independiente en el esquema consultado.

### Cómo se pueblan los perfiles

- **Hecho verificado:** `user_genre_affinity` recibe cambios desde `reel_playback_actualizar_afinidad`, trigger de `reel_playback_sessions` para INSERT, UPDATE y DELETE. El trigger toma únicamente `lower(reels.genero)` (género principal), calcula score nuevo menos score anterior en UPDATE, score positivo en INSERT y negativo en DELETE. Mantiene `behavioral_score` entre -50 y 250 y `listening_sessions` no menor que cero.
- **Hecho verificado:** `playback_signal_score` suma tiempo escuchado (hasta 16 puntos), proporción (hasta 14), completado (+5), repeticiones (hasta 8) y resta por skip (hasta 9/3). El trigger reemplaza esa contribución por delta en UPDATE, en vez de sumar el score completo en cada actualización.
- **Hecho verificado:** `user_genre_preferences` tiene esquema y es tratada como tabla histórica por `Backend/database/verificarContrato.js`. Las migraciones de géneros y catálogo renombran/unen filas por equivalencia de género y suman `peso`, conservando límites de fechas. No encontré código de aplicación que la escriba en las búsquedas de Backend y Frontend; no se puede identificar su productor original con los archivos actuales.
- **Hecho verificado:** `user_interests` es consultada como señal de interés explícito por el recomendador heredado y por recomendaciones de eventos. El snapshot y migraciones muestran su tabla, checks y normalización de slugs, pero no se encontró en el código actual un flujo que inserte/actualice estos intereses. No está verificado qué UI o proceso los generó ni si todos los registros fueron elegidos explícitamente por usuarios.
- **Limitación crítica:** likes, guardados, compartidos, comentarios y `reel_views` son estado/eventos disponibles, pero las tablas de interacción mostradas guardan un único estado por usuario-preview (PK compuesta) y no siempre conservan cada alta/baja histórica. `reel_views` es una visita única, no impresiones ni reproducciones. `reel_playback_sessions` sí conserva sesiones identificables, pero solo desde que existe y usa género principal en el trigger. Por tanto, no se puede reconstruir una serie completa de eventos históricos ni atribuir fiabilidad/fecha a todos los agregados heredados.

### Identidad en el catálogo

`reels.creador_id` es FK a `users.id`; `crearReel` exige una cuenta autenticada y el backend usa ese ID para autorización, follows, reportes y perfil. La UI muestra el nombre/usuario de esa cuenta bajo la etiqueta de artista. El modelo no contiene un campo independiente de artista por preview ni una entidad artista/banda. Esto verifica que el publicador es una cuenta, pero **no** prueba que la cuenta siempre sea el artista que interpreta el audio ni que una cuenta no pueda publicar previews de proyectos distintos. La cardinalidad real es dato pendiente.

`20261022120000_alinear_catalogo_y_contrato.sql` normaliza el catálogo y contrato de eventos/reels, toca relaciones multigénero y afinidad heredada, y contiene operaciones de limpieza de datos. No se ejecutó. No se modificaron migraciones históricas.

Hay compatibilidad dinámica en el controlador: consulta `to_regclass` para `reel_generos`, `information_schema` para columnas antiguas y puede crear automáticamente tablas/índices de visitas, guardados y comentarios cuando `schemaAutomatico()` está habilitado. Esto significa que el comportamiento puede depender de configuración y esquema real.

## Costos observables y medición

- El GET calcula afinidad, popularidad y conteos correlacionados (likes, compartidos, guardados, visitas) para las filas de `reels`, ejecuta subconsultas de señales por candidato, score, motivo, edad, bloqueos y eventos próximos. Ordena el conjunto completo. Su costo crece con el catálogo y los historiales consultados.
- Después realiza tres consultas adicionales para likes, guardados y follows del viewer, en paralelo.
- En web, al menos una solicitud de comentarios por preview provoca patrón de consultas HTTP N+1 respecto del tamaño del catálogo. La búsqueda de avatares produce otra solicitud por creador sin avatar.
- Las acciones de like/guardado hacen varias consultas secuenciales (comprobar, insertar/eliminar, contar); el endpoint de visita también cuenta después del insert. La escucha se informa separadamente.
- No hay medición segura ni reproducible de latencia o planes: no se conectó a base local/remota ni se ejecutaron EXPLAIN/ANALYZE. No se afirman tiempos ni cardinalidades.

## Pruebas, clientes e incertidumbres

Hay pruebas Node integradas: `Backend/tests/*.test.js` (incluye compatibilidad de reels y contrato de sistema beta) y `Frontend/tests/audioFragmento.test.js`. Comandos declarados: `npm test`, `npm run lint`, `npm run build`, `npm run db:validar`; `npm run verify` los combina con pruebas. No se ejecutaron en esta auditoría.

El repositorio contiene web React/Vite y backend Node, pero no aparece una aplicación móvil ni código Expo/React Native fuera de dependencias instaladas. No se pudo verificar integración móvil, ni contrato cliente móvil.

Incertidumbres: no está comprobado que la base activa coincida con las migraciones; el SQL de snapshot puede no reflejar despliegues; no se revisó RLS completo ni configuración efectiva de `schemaAutomatico`; no se determinó el volumen real del catálogo, cardinalidades, planes o tráfico; ubicación y funciones espaciales dependen de datos disponibles; no hay suficiente historial de Git en este análisis para atribuir autoría o antigüedad a cada regla heredada.
