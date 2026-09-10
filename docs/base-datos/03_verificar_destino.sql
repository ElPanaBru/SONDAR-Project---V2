-- Solo lectura. Ejecutar en destino despues de restaurar/optimizar.

-- Las primeras consultas deben devolver cero diferencias. Los conteos se comparan con el respaldo final, no con la foto de esta auditoria.

BEGIN READ ONLY;

WITH esperado(nombre) AS (VALUES ('comunidad_comentario_likes'),('comunidad_comentarios'),('comunidad_miembros'),('comunidad_publicacion_guardados'),('comunidad_publicacion_likes'),('comunidad_publicaciones'),('comunidades'),('content_reports'),('conversation_members'),('conversations'),('event_organizers'),('event_saves'),('evento_generos'),('eventos'),('follows'),('generos'),('messages'),('notification_mutes'),('notifications'),('perfil_comunidad_publicaciones'),('perfil_comunidad_respuestas'),('reel_comment_likes'),('reel_comments'),('reel_generos'),('reel_likes'),('reel_playback_sessions'),('reel_shares'),('reel_views'),('reels'),('user_blocks'),('user_genre_affinity'),('user_interests'),('user_settings'),('users'))
   SELECT 'tabla_faltante' AS problema,nombre FROM esperado WHERE to_regclass('public.'||quote_ident(nombre)) IS NULL
   UNION ALL SELECT 'tabla_extra',tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN (SELECT nombre FROM esperado);

WITH esperado(tabla,columna,tipo,no_nulo) AS (VALUES ('comunidad_comentario_likes','user_id','uuid',true),('comunidad_comentario_likes','comentario_id','bigint',true),('comunidad_comentario_likes','created_at','timestamp with time zone',false),('comunidad_comentarios','id','bigint',true),('comunidad_comentarios','publicacion_id','bigint',true),('comunidad_comentarios','user_id','uuid',true),('comunidad_comentarios','parent_id','bigint',false),('comunidad_comentarios','texto','text',true),('comunidad_comentarios','created_at','timestamp with time zone',false),('comunidad_comentarios','likes','integer',true),('comunidad_comentarios','responde_a','text',false),('comunidad_miembros','comunidad_id','text',true),('comunidad_miembros','user_id','uuid',true),('comunidad_miembros','nivel_notificaciones','text',true),('comunidad_miembros','created_at','timestamp with time zone',false),('comunidad_publicacion_guardados','user_id','uuid',true),('comunidad_publicacion_guardados','publicacion_id','bigint',true),('comunidad_publicacion_guardados','created_at','timestamp with time zone',false),('comunidad_publicacion_likes','user_id','uuid',true),('comunidad_publicacion_likes','publicacion_id','bigint',true),('comunidad_publicacion_likes','created_at','timestamp with time zone',false),('comunidad_publicaciones','id','bigint',true),('comunidad_publicaciones','comunidad_id','text',true),('comunidad_publicaciones','user_id','uuid',true),('comunidad_publicaciones','tipo','text',true),('comunidad_publicaciones','titulo','text',true),('comunidad_publicaciones','texto','text',true),('comunidad_publicaciones','etiqueta','text',false),('comunidad_publicaciones','fijada','boolean',true),('comunidad_publicaciones','created_at','timestamp with time zone',false),('comunidad_publicaciones','evento_asociado_id','text',false),('comunidad_publicaciones','reel_asociado_id','text',false),('comunidad_publicaciones','likes','integer',true),('comunidad_publicaciones','guardados','integer',true),('comunidad_publicaciones','updated_at','timestamp with time zone',false),('comunidades','id','text',true),('comunidades','nombre','text',true),('comunidades','titulo','text',true),('comunidades','genero','text',true),('comunidades','descripcion','text',true),('comunidades','portada_url','text',false),('comunidades','activa','boolean',true),('comunidades','created_at','timestamp with time zone',false),('content_reports','id','bigint',true),('content_reports','reporter_id','uuid',true),('content_reports','reported_user_id','uuid',false),('content_reports','content_type','text',true),('content_reports','content_id','text',true),('content_reports','reason','text',true),('content_reports','status','text',true),('content_reports','created_at','timestamp with time zone',true),('content_reports','details','text',true),('conversation_members','conversation_id','uuid',true),('conversation_members','user_id','uuid',true),('conversation_members','joined_at','timestamp with time zone',true),('conversation_members','last_read_at','timestamp with time zone',true),('conversation_members','muted','boolean',true),('conversation_members','archived_at','timestamp with time zone',false),('conversation_members','last_delivered_at','timestamp with time zone',true),('conversations','id','uuid',true),('conversations','kind','text',true),('conversations','direct_key','text',true),('conversations','created_by','uuid',false),('conversations','created_at','timestamp with time zone',true),('conversations','updated_at','timestamp with time zone',true),('conversations','last_message_at','timestamp with time zone',true),('event_organizers','event_id','bigint',true),('event_organizers','user_id','uuid',true),('event_organizers','added_by','uuid',true),('event_organizers','created_at','timestamp with time zone',true),('event_saves','user_id','uuid',true),('event_saves','event_id','bigint',true),('event_saves','created_at','timestamp with time zone',false),('evento_generos','event_id','bigint',true),('evento_generos','genero','text',true),('evento_generos','posicion','smallint',true),('evento_generos','created_at','timestamp with time zone',true),('eventos','id','bigint',true),('eventos','genero','text',true),('eventos','lugar','text',false),('eventos','fecha','timestamp with time zone',true),('eventos','img_url','text',false),('eventos','link','text',false),('eventos','creador_id','uuid',true),('eventos','latitud','double precision',false),('eventos','longitud','double precision',false),('eventos','created_at','timestamp with time zone',false),('eventos','precio','numeric(12,2)',false),('eventos','img_path','text',false),('eventos','ubicacion_geog','gis.geography(Point,4326)',false),('eventos','descripcion','text',false),('eventos','titulo','text',true),('follows','follower_id','uuid',true),('follows','following_id','uuid',true),('follows','created_at','timestamp with time zone',false),('generos','slug','text',true),('generos','nombre','text',true),('generos','activo','boolean',true),('generos','orden','smallint',true),('generos','created_at','timestamp with time zone',true),('messages','id','bigint',true),('messages','conversation_id','uuid',true),('messages','sender_id','uuid',false),('messages','body','text',true),('messages','reply_to_id','bigint',false),('messages','created_at','timestamp with time zone',true),('messages','edited_at','timestamp with time zone',false),('messages','deleted_at','timestamp with time zone',false),('notification_mutes','user_id','uuid',true),('notification_mutes','muted_user_id','uuid',true),('notification_mutes','created_at','timestamp with time zone',true),('notifications','id','bigint',true),('notifications','user_id','uuid',true),('notifications','actor_id','uuid',false),('notifications','type','text',true),('notifications','title','text',true),('notifications','body','text',true),('notifications','target_url','text',true),('notifications','unique_key','text',false),('notifications','read_at','timestamp with time zone',false),('notifications','created_at','timestamp with time zone',true),('notifications','entity_type','text',false),('notifications','entity_id','text',false),('notifications','metadata','jsonb',true),('perfil_comunidad_publicaciones','id','bigint',true),('perfil_comunidad_publicaciones','user_id','uuid',true),('perfil_comunidad_publicaciones','origen','text',true),('perfil_comunidad_publicaciones','texto','text',true),('perfil_comunidad_publicaciones','reel_id','bigint',false),('perfil_comunidad_publicaciones','evento_id','bigint',false),('perfil_comunidad_publicaciones','created_at','timestamp with time zone',true),('perfil_comunidad_publicaciones','updated_at','timestamp with time zone',true),('perfil_comunidad_respuestas','id','bigint',true),('perfil_comunidad_respuestas','publicacion_id','bigint',true),('perfil_comunidad_respuestas','user_id','uuid',true),('perfil_comunidad_respuestas','parent_id','bigint',false),('perfil_comunidad_respuestas','texto','text',true),('perfil_comunidad_respuestas','created_at','timestamp with time zone',true),('reel_comment_likes','user_id','uuid',true),('reel_comment_likes','comment_id','bigint',true),('reel_comment_likes','created_at','timestamp with time zone',false),('reel_comments','id','bigint',true),('reel_comments','reel_id','bigint',true),('reel_comments','user_id','uuid',true),('reel_comments','parent_id','bigint',false),('reel_comments','texto','text',true),('reel_comments','created_at','timestamp with time zone',false),('reel_comments','responde_a','text',false),('reel_comments','likes','integer',true),('reel_generos','reel_id','bigint',true),('reel_generos','genero','text',true),('reel_generos','posicion','smallint',true),('reel_generos','created_at','timestamp with time zone',true),('reel_likes','user_id','uuid',true),('reel_likes','reel_id','bigint',true),('reel_likes','created_at','timestamp with time zone',false),('reel_playback_sessions','id','uuid',true),('reel_playback_sessions','user_id','uuid',true),('reel_playback_sessions','reel_id','bigint',true),('reel_playback_sessions','listened_ms','integer',true),('reel_playback_sessions','duration_ms','integer',false),('reel_playback_sessions','completion_ratio','numeric(5,4)',true),('reel_playback_sessions','completed','boolean',true),('reel_playback_sessions','skipped','boolean',true),('reel_playback_sessions','replay_count','smallint',true),('reel_playback_sessions','started_at','timestamp with time zone',true),('reel_playback_sessions','updated_at','timestamp with time zone',true),('reel_shares','user_id','uuid',true),('reel_shares','reel_id','bigint',true),('reel_shares','created_at','timestamp with time zone',false),('reel_views','user_id','uuid',true),('reel_views','reel_id','bigint',true),('reel_views','created_at','timestamp with time zone',true),('reels','id','bigint',true),('reels','titulo','text',true),('reels','genero','text',true),('reels','duracion','text',false),('reels','portada_url','text',false),('reels','portada_path','text',false),('reels','audio_url','text',true),('reels','audio_path','text',true),('reels','creador_id','uuid',true),('reels','created_at','timestamp with time zone',false),('reels','color_principal','text',false),('reels','likes','integer',true),('reels','guardados','integer',true),('reels','compartidos','integer',true),('reels','visitas','integer',true),('reels','color_ambiente','text',true),('reels','fragment_start','numeric(8,2)',true),('reels','fragment_end','numeric(8,2)',false),('reels','album','text',true),('reels','descripcion','text',true),('user_blocks','blocker_id','uuid',true),('user_blocks','blocked_id','uuid',true),('user_blocks','created_at','timestamp with time zone',true),('user_genre_affinity','user_id','uuid',true),('user_genre_affinity','genre','text',true),('user_genre_affinity','behavioral_score','numeric(10,3)',true),('user_genre_affinity','listening_sessions','integer',true),('user_genre_affinity','last_interaction_at','timestamp with time zone',true),('user_interests','user_id','uuid',true),('user_interests','genre','text',true),('user_interests','created_at','timestamp with time zone',true),('user_settings','user_id','uuid',true),('user_settings','telefono','text',true),('user_settings','idioma','text',true),('user_settings','actividad_cuenta','boolean',true),('user_settings','mostrar_email','boolean',true),('user_settings','updated_at','timestamp with time zone',true),('user_settings','codigo_pais','text',true),('user_settings','notificar_interacciones','boolean',true),('user_settings','notificar_comentarios','boolean',true),('user_settings','notificar_seguidores','boolean',true),('user_settings','notificar_publicaciones','boolean',true),('user_settings','notificar_menciones','boolean',true),('user_settings','reducir_movimiento','boolean',true),('user_settings','notificar_mensajes','boolean',true),('users','id','uuid',true),('users','email','text',true),('users','username','text',true),('users','created_at','timestamp with time zone',false),('users','profile_img_url','text',false),('users','bio','text',true),('users','updated_at','timestamp with time zone',false),('users','profile_img_path','text',false),('users','display_name','text',false),('users','birth_date','date',false),('users','user_type','text',true),('users','full_name','text',false),('users','artist_name','text',false),('users','artist_bio','text',false),('users','banner_url','text',false),('users','instagram_url','text',false),('users','verified','boolean',false),('users','onboarding_completed','boolean',true))
   SELECT e.* FROM esperado e LEFT JOIN pg_namespace n ON n.nspname='public'
   LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.tabla
   LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname=e.columna AND NOT a.attisdropped
   WHERE a.attnum IS NULL OR format_type(a.atttypid,a.atttypmod)<>e.tipo OR a.attnotnull<>e.no_nulo;

SELECT tablename FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity;

SELECT 'comunidad_comentario_likes' AS tabla,count(*) AS filas FROM public."comunidad_comentario_likes";

SELECT 'comunidad_comentarios' AS tabla,count(*) AS filas FROM public."comunidad_comentarios";

SELECT 'comunidad_miembros' AS tabla,count(*) AS filas FROM public."comunidad_miembros";

SELECT 'comunidad_publicacion_guardados' AS tabla,count(*) AS filas FROM public."comunidad_publicacion_guardados";

SELECT 'comunidad_publicacion_likes' AS tabla,count(*) AS filas FROM public."comunidad_publicacion_likes";

SELECT 'comunidad_publicaciones' AS tabla,count(*) AS filas FROM public."comunidad_publicaciones";

SELECT 'comunidades' AS tabla,count(*) AS filas FROM public."comunidades";

SELECT 'content_reports' AS tabla,count(*) AS filas FROM public."content_reports";

SELECT 'conversation_members' AS tabla,count(*) AS filas FROM public."conversation_members";

SELECT 'conversations' AS tabla,count(*) AS filas FROM public."conversations";

SELECT 'event_organizers' AS tabla,count(*) AS filas FROM public."event_organizers";

SELECT 'event_saves' AS tabla,count(*) AS filas FROM public."event_saves";

SELECT 'evento_generos' AS tabla,count(*) AS filas FROM public."evento_generos";

SELECT 'eventos' AS tabla,count(*) AS filas FROM public."eventos";

SELECT 'follows' AS tabla,count(*) AS filas FROM public."follows";

SELECT 'generos' AS tabla,count(*) AS filas FROM public."generos";

SELECT 'messages' AS tabla,count(*) AS filas FROM public."messages";

SELECT 'notification_mutes' AS tabla,count(*) AS filas FROM public."notification_mutes";

SELECT 'notifications' AS tabla,count(*) AS filas FROM public."notifications";

SELECT 'perfil_comunidad_publicaciones' AS tabla,count(*) AS filas FROM public."perfil_comunidad_publicaciones";

SELECT 'perfil_comunidad_respuestas' AS tabla,count(*) AS filas FROM public."perfil_comunidad_respuestas";

SELECT 'reel_comment_likes' AS tabla,count(*) AS filas FROM public."reel_comment_likes";

SELECT 'reel_comments' AS tabla,count(*) AS filas FROM public."reel_comments";

SELECT 'reel_generos' AS tabla,count(*) AS filas FROM public."reel_generos";

SELECT 'reel_likes' AS tabla,count(*) AS filas FROM public."reel_likes";

SELECT 'reel_playback_sessions' AS tabla,count(*) AS filas FROM public."reel_playback_sessions";

SELECT 'reel_shares' AS tabla,count(*) AS filas FROM public."reel_shares";

SELECT 'reel_views' AS tabla,count(*) AS filas FROM public."reel_views";

SELECT 'reels' AS tabla,count(*) AS filas FROM public."reels";

SELECT 'user_blocks' AS tabla,count(*) AS filas FROM public."user_blocks";

SELECT 'user_genre_affinity' AS tabla,count(*) AS filas FROM public."user_genre_affinity";

SELECT 'user_interests' AS tabla,count(*) AS filas FROM public."user_interests";

SELECT 'user_settings' AS tabla,count(*) AS filas FROM public."user_settings";

SELECT 'users' AS tabla,count(*) AS filas FROM public."users";

SELECT p.oid::regprocedure AS funcion FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') ORDER BY 1;

SELECT n.nspname,c.relname,t.tgname,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND (n.nspname='public' OR (n.nspname='auth' AND c.relname='users')) ORDER BY 1,2,3;

SELECT policyname,schemaname,tablename,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','storage','realtime') ORDER BY 2,3,1;

SELECT count(*) AS perfiles_sin_auth FROM public.users u LEFT JOIN auth.users a ON a.id=u.id WHERE a.id IS NULL;

SELECT count(*) AS conversaciones_sin_dos_miembros FROM public.conversations c WHERE (SELECT count(*) FROM public.conversation_members cm WHERE cm.conversation_id=c.id)<>2;

-- Una membresia sin perfil puede ser historial de usuario eliminado, no borrarla.

SELECT count(*) AS mensajes_respuesta_otra_conversacion FROM public.messages m JOIN public.messages p ON p.id=m.reply_to_id WHERE m.conversation_id<>p.conversation_id;

SELECT 'eventos_id_seq' AS secuencia,last_value,is_called,(SELECT max("id") FROM public."eventos") AS id_maximo FROM public."eventos_id_seq";

SELECT 'reel_comments_id_seq' AS secuencia,last_value,is_called,(SELECT max("id") FROM public."reel_comments") AS id_maximo FROM public."reel_comments_id_seq";

SELECT 'messages_id_seq' AS secuencia,last_value,is_called,(SELECT max("id") FROM public."messages") AS id_maximo FROM public."messages_id_seq";

SELECT 'comunidad_comentarios_id_seq' AS secuencia,last_value,is_called,(SELECT max("id") FROM public."comunidad_comentarios") AS id_maximo FROM public."comunidad_comentarios_id_seq";

SELECT 'reels_id_seq' AS secuencia,last_value,is_called,(SELECT max("id") FROM public."reels") AS id_maximo FROM public."reels_id_seq";

SELECT 'content_reports_id_seq' AS secuencia,last_value,is_called,(SELECT max("id") FROM public."content_reports") AS id_maximo FROM public."content_reports_id_seq";

SELECT 'notifications_id_seq' AS secuencia,last_value,is_called,(SELECT max("id") FROM public."notifications") AS id_maximo FROM public."notifications_id_seq";

SELECT 'perfil_comunidad_publicaciones_id_seq' AS secuencia,last_value,is_called,(SELECT max("id") FROM public."perfil_comunidad_publicaciones") AS id_maximo FROM public."perfil_comunidad_publicaciones_id_seq";

SELECT 'perfil_comunidad_respuestas_id_seq' AS secuencia,last_value,is_called,(SELECT max("id") FROM public."perfil_comunidad_respuestas") AS id_maximo FROM public."perfil_comunidad_respuestas_id_seq";

SELECT 'comunidad_publicaciones_id_seq' AS secuencia,last_value,is_called,(SELECT max("id") FROM public."comunidad_publicaciones") AS id_maximo FROM public."comunidad_publicaciones_id_seq";

SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets ORDER BY id;

ROLLBACK;
