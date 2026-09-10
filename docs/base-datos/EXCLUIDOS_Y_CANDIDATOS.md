# Elementos excluidos y candidatos conservados

Excluido significa omitido del modelo propuesto. No se borro ningun objeto ni fila de la base de origen.

## Tablas excluidas

| Tabla | Filas al auditar | Evidencia / motivo |
|---|---:|---|
| profile_community_comments | 0 | Sin referencias en backend/frontend actuales. El modulo vigente usa perfil_comunidad_respuestas. |
| profile_community_posts | 5 | Sin referencias en backend/frontend actuales. El modulo vigente usa perfil_comunidad_publicaciones. No fusionar automaticamente: son IDs e historiales distintos. |
| user_genre_preferences | 6 | Sin referencias actuales. El onboarding usa user_interests y el aprendizaje usa user_genre_affinity; peso no es equivalente al score aprendido. |
| reel_saves | 2 | Sin consultas ni rutas actuales. Los guardados de perfil se obtienen de reel_likes y event_saves. Conserva politicas de una interfaz historica; comprobar clientes externos antes de retirar. |

Las 13 filas historicas deben permanecer en el backup completo externo al modelo activo. No se trasladan automaticamente a tablas con nombres parecidos. La ausencia de referencias se limita al codigo disponible, no demuestra ausencia de clientes externos.

## Atributo excluido

`user_settings.created_at`: la configuracion se proyecta por mapearConfiguracion, incluso en la exportacion; este atributo no sale en el contrato de respuesta ni se usa en consultas/triggers.

## Restricciones excluidas

- `follows_no_self_follow_chk`: Duplica follows_no_self, con la misma expresion; se conserva la restriccion validada.
- `user_blocks_no_self_block_chk`: Duplica user_blocks_different_users, con la misma expresion; se conserva la restriccion validada.

## Objetos dependientes excluidos

Al excluir una tabla se excluyen tambien todos sus atributos, PK/FK, indices, politicas, grants y secuencias propias. Inventario exacto:

| Tabla | Atributos |
|---|---|
| profile_community_comments | id, post_id, user_id, texto, created_at |
| profile_community_posts | id, user_id, texto, attachment_type, reel_id, event_id, created_at |
| user_genre_preferences | user_id, genero, peso, created_at, updated_at |
| reel_saves | user_id, reel_id, created_at |

- Restriccion `profile_community_comments_pkey`: PRIMARY KEY (id)
- Restriccion `profile_community_comments_post_id_fkey`: FOREIGN KEY (post_id) REFERENCES profile_community_posts(id) ON DELETE CASCADE
- Restriccion `profile_community_comments_texto_check`: CHECK ((length(TRIM(BOTH FROM texto)) > 0))
- Restriccion `profile_community_comments_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
- Restriccion `profile_community_posts_attachment`: CHECK ((((attachment_type IS NULL) AND (reel_id IS NULL) AND (event_id IS NULL)) OR ((attachment_type = 'reel'::text) AND (reel_id IS NOT NULL) AND (event_id IS NULL)) OR ((attachment_type = 'evento'::text) AND (event_id IS NOT NULL) AND (reel_id IS NULL))))
- Restriccion `profile_community_posts_attachment_type_check`: CHECK ((attachment_type = ANY (ARRAY['reel'::text, 'evento'::text])))
- Restriccion `profile_community_posts_event_id_fkey`: FOREIGN KEY (event_id) REFERENCES eventos(id) ON DELETE CASCADE
- Restriccion `profile_community_posts_pkey`: PRIMARY KEY (id)
- Restriccion `profile_community_posts_reel_id_fkey`: FOREIGN KEY (reel_id) REFERENCES reels(id) ON DELETE CASCADE
- Restriccion `profile_community_posts_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
- Restriccion `reel_saves_pkey`: PRIMARY KEY (user_id, reel_id)
- Restriccion `reel_saves_reel_id_fkey`: FOREIGN KEY (reel_id) REFERENCES reels(id) ON DELETE CASCADE
- Restriccion `reel_saves_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
- Restriccion `user_genre_preferences_genero_valido`: CHECK ((genero = ANY (ARRAY['pop'::text, 'rock'::text, 'edm'::text, 'jazz'::text, 'blues'::text, 'cumbia'::text, 'trap'::text, 'metal'::text, 'folklore'::text, 'otros'::text])))
- Restriccion `user_genre_preferences_pkey`: PRIMARY KEY (user_id, genero)
- Restriccion `user_genre_preferences_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
- Indice `profile_community_comments_pkey`.
- Indice `profile_community_comments_post_date_idx`.
- Indice `profile_community_posts_event_unique`.
- Indice `profile_community_posts_pkey`.
- Indice `profile_community_posts_reel_unique`.
- Indice `profile_community_posts_user_date_idx`.
- Indice `idx_reel_saves_reel_id`.
- Indice `reel_saves_pkey`.
- Indice `idx_user_genre_preferences_genero`.
- Indice `user_genre_preferences_pkey`.
- Politica `reel_saves_delete_own`.
- Politica `reel_saves_insert_own`.
- Politica `reel_saves_select_own`.
- Secuencia `profile_community_posts_id_seq`.
- Secuencia `profile_community_comments_id_seq`.

## 27 atributos candidatos que NO se excluyen

No son necesarios para las pantallas principales, pero los devuelve SELECT * en exportarDatosActuales (usuarioController.js:971–989); notifications tambien los devuelve por n.*. Quitarlos cambia respuestas y datos exportados. Se mantienen para cumplir la compatibilidad solicitada. Las observaciones siguientes describen su consumo funcional, no ausencia absoluta de uso.

| Atributo | Observacion |
|---|---|
| users.full_name | Sin consumo actual; el perfil usa display_name y username. Archivar, no sobrescribir display_name. |
| users.artist_name | Sin consumo actual; el perfil usa display_name y username. |
| users.artist_bio | Sin consumo actual; el perfil usa bio. |
| users.banner_url | Sin lectura/escritura actual; no eliminar archivos asociados durante esta migracion. |
| users.instagram_url | Sin lectura/escritura actual. |
| users.verified | Sin lectura/escritura actual. No confundir con email_verified de Supabase Auth. |
| users.onboarding_completed | Sin lectura/escritura actual; completarOnboarding persiste datos e intereses, no este flag. |
| reels.likes | Feed calcula COUNT(reel_likes); las altas devuelven cero con fallback. Exportacion cruda cambia. |
| reels.guardados | Sin consumo funcional actual; no existe guardado de reels en las rutas vigentes. |
| reels.compartidos | Feed calcula COUNT(reel_shares); no hay trigger de contador en el catalogo real. |
| reels.visitas | Feed/perfiles calculan COUNT(reel_views). |
| reels.color_ambiente | Sin referencias; la presentacion usa color_principal y colores derivados. |
| reels.fragment_start | Sin referencias; el frontend genera el fragmento de audio antes de subirlo. |
| reels.fragment_end | Sin referencias; el frontend genera el fragmento de audio antes de subirlo. |
| reels.album | Solo compatibilidad de insercion si existe y es obligatorio sin default. No forma parte del modelo visible. |
| reels.descripcion | Solo compatibilidad de insercion si existe y es obligatorio sin default. No forma parte del modelo visible. |
| eventos.titulo | mapearEvento elimina el campo; alta y trigger automatico usan lugar. La exportacion cruda cambia. |
| eventos.descripcion | mapearEvento elimina el campo; no se persiste desde el formulario actual. |
| notifications.entity_type | crearNotificacion no persiste este parametro; la navegacion usa target_url y la deduplicacion unique_key. |
| notifications.entity_id | No se persiste/consulta; no confundir con entityId usado para construir unique_key en JavaScript. |
| notifications.metadata | No se persiste/consulta; distinto de raw_user_meta_data de Auth, que se conserva. |
| reel_comments.likes | Las consultas de comentarios calculan COUNT(reel_comment_likes). |
| comunidad_comentarios.likes | Las consultas calculan COUNT(comunidad_comentario_likes). |
| comunidad_comentarios.responde_a | Sin consumo en este modulo: usa parent_id. Se conserva reel_comments.responde_a, que SI se utiliza. |
| comunidad_publicaciones.likes | Las consultas calculan COUNT(comunidad_publicacion_likes). |
| comunidad_publicaciones.guardados | La condicion de guardado y los totales salen de comunidad_publicacion_guardados. |
| comunidad_publicaciones.updated_at | No leido ni escrito por el modulo actual. |

## Indices candidatos, sin eliminar

`conversation_members_user_id_idx` y `messages_sender_id_idx` comparten prefijo con indices compuestos. No son duplicados exactos: sin planes, tamanos y carga representativa no se afirma que retirarlos mejore rendimiento. `users_username_key` se conserva junto al indice lower(username): no se cambia el contrato de errores de unicidad.

## Objetos historicos ausentes del origen

`settings`, `event_attendance_events`, `reel_listen_events`, `content_moderation_alerts` y `handle_reel_share_counter` aparecen en scripts antiguos, pero no en el catalogo observado. No se contabilizan como eliminaciones nuevas ni se reintroducen.
