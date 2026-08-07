# Base de datos de SONDAR

## Fuentes vigentes

- Instalacion nueva y vacia: `Esquema_Minimo_SONDAR.sql`.
- Base existente: migraciones numeradas de `../../supabase/migrations/`, en orden ascendente.
- Datos semilla: las comunidades canonicas se insertan de forma idempotente desde la migracion integral.

`database_sondar.sql` en la raiz es un artefacto historico no restaurable. Los demas SQL de esta carpeta documentan etapas anteriores y no deben ejecutarse en bloque ni en orden alfabetico.

## Despliegue seguro de la migracion integral

1. Crear un backup verificable y ensayar su restauracion.
2. Clonar produccion anonimizada en staging.
3. Revisar duplicados de `lower(users.username)`, asociaciones no numericas y filas huerfanas.
4. Ejecutar `supabase/migrations/202608070001_optimizacion_integral.sql` con un rol de migraciones, no con el rol permanente de la API.
5. Verificar conteos, claves foraneas, politicas RLS e indices.
6. Medir las consultas de eventos, reels y comunidad con `EXPLAIN (ANALYZE, BUFFERS)` sobre volumen representativo.
7. Validar las restricciones creadas como `NOT VALID` una vez corregidos los datos historicos.
8. Desplegar el backend y revocar al rol web cualquier permiso DDL.

La migracion usa `lock_timeout = 10s` y `statement_timeout = 120s`. Si vence alguno, no se debe aumentar a ciegas: hay que identificar el bloqueo y reprogramar la ventana.

## Verificaciones posteriores

```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT conrelid::regclass AS tabla, conname, convalidated
FROM pg_constraint
WHERE conname IN (
  'eventos_coordenadas_validas',
  'eventos_link_seguro',
  'eventos_genero_catalogo',
  'reels_genero_catalogo',
  'reels_contenido_longitud',
  'reel_comments_longitud',
  'comunidad_publicaciones_longitud',
  'comunidad_comentarios_longitud',
  'comunidad_publicaciones_evento_fk',
  'comunidad_publicaciones_reel_fk'
)
ORDER BY tabla::text, conname;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'eventos_fecha_id_idx',
    'reels_created_id_idx',
    'reel_comments_reel_created_idx',
    'comunidad_publicaciones_foro_created_idx',
    'notifications_user_unread_created_idx'
  )
ORDER BY indexname;
```

Cuando los datos historicos ya cumplan las reglas:

```sql
ALTER TABLE public.eventos VALIDATE CONSTRAINT eventos_coordenadas_validas;
ALTER TABLE public.eventos VALIDATE CONSTRAINT eventos_link_seguro;
ALTER TABLE public.eventos VALIDATE CONSTRAINT eventos_genero_catalogo;
ALTER TABLE public.reels VALIDATE CONSTRAINT reels_genero_catalogo;
ALTER TABLE public.reels VALIDATE CONSTRAINT reels_contenido_longitud;
ALTER TABLE public.reel_comments VALIDATE CONSTRAINT reel_comments_longitud;
ALTER TABLE public.comunidad_publicaciones VALIDATE CONSTRAINT comunidad_publicaciones_longitud;
ALTER TABLE public.comunidad_publicaciones VALIDATE CONSTRAINT comunidad_publicaciones_evento_fk;
ALTER TABLE public.comunidad_publicaciones VALIDATE CONSTRAINT comunidad_publicaciones_reel_fk;
ALTER TABLE public.comunidad_comentarios VALIDATE CONSTRAINT comunidad_comentarios_longitud;
```

## Responsabilidades por capa

- Frontend: experiencia, feedback inmediato y validacion amistosa; nunca secretos ni reglas de integridad finales.
- Backend: autenticacion, autorizacion, catalogos, limites, transacciones y contratos HTTP.
- BDD: tipos, claves, unicidad, cascadas, checks, indices y RLS como ultima barrera.

El backend no crea ni altera tablas durante el arranque o una peticion. Ese comportamiento esta cubierto por una prueba automatizada.
