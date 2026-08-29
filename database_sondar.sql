-- SONDAR Database Dump
-- Generated at 2026-07-01T16:09:28.477Z

ALTER TABLE "comunidad_comentario_likes" (
  "user_id" uuid NOT NULL,
  "comentario_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE "comunidad_comentarios" (
  "id" bigint NOT NULL,
  "publicacion_id" bigint NOT NULL,
  "user_id" uuid NOT NULL,
  "parent_id" bigint,
  "texto" text NOT NULL,
  "likes" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE "comunidad_miembros" (
  "comunidad_id" text NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE "comunidad_publicacion_guardados" (
  "user_id" uuid NOT NULL,
  "publicacion_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE "comunidad_publicacion_likes" (
  "user_id" uuid NOT NULL,
  "publicacion_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE "comunidad_publicaciones" (
  "id" bigint NOT NULL,
  "comunidad_id" text NOT NULL,
  "user_id" uuid NOT NULL,
  "tipo" text DEFAULT 'reciente'::text NOT NULL,
  "titulo" text NOT NULL,
  "texto" text NOT NULL,
  "etiqueta" text,
  "evento_asociado_id" text,
  "reel_asociado_id" text,
  "likes" integer DEFAULT 0 NOT NULL,
  "guardados" integer DEFAULT 0 NOT NULL,
  "fijada" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE "comunidades" (
  "id" text NOT NULL,
  "nombre" text NOT NULL,
  "titulo" text NOT NULL,
  "genero" text NOT NULL,
  "descripcion" text NOT NULL,
  "portada_url" text,
  "activa" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE "content_moderation_alerts" (
  "id" bigint NOT NULL,
  "content_type" text NOT NULL,
  "content_id" text NOT NULL,
  "user_id" uuid,
  "provider" text DEFAULT 'simulated_ai_moderation'::text NOT NULL,
  "reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE "content_reports" (
  "id" bigint NOT NULL,
  "reporter_id" uuid NOT NULL,
  "reported_user_id" uuid,
  "content_type" text NOT NULL,
  "content_id" text NOT NULL,
  "reason" text DEFAULT 'contenido_inapropiado'::text NOT NULL,
  "status" text DEFAULT 'pendiente'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "details" text DEFAULT ''::text NOT NULL
);

ALTER TABLE "event_attendance_events" (
  "id" bigint NOT NULL,
  "user_id" uuid NOT NULL,
  "event_id" bigint NOT NULL,
  "action" text NOT NULL,
  "points" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE "event_organizers" (
  "event_id" bigint NOT NULL,
  "user_id" uuid NOT NULL,
  "added_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE "event_saves" (
  "user_id" uuid NOT NULL,
  "event_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE "eventos" (
  "id" bigint NOT NULL,
  "genero" text,
  "lugar" text,
  "fecha" timestamp with time zone NOT NULL,
  "img_url" text,
  "link" text,
  "creador_id" uuid NOT NULL,
  "latitud" double precision,
  "longitud" double precision,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
  "precio" numeric,
  "img_path" text,
  "status" USER-DEFINED DEFAULT 'pending'::content_moderation_status NOT NULL
);

ALTER TABLE "follows" (
  "follower_id" uuid NOT NULL,
  "following_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE "notification_mutes" (
  "user_id" uuid NOT NULL,
  "muted_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE "notifications" (
  "id" bigint NOT NULL,
  "user_id" uuid NOT NULL,
  "actor_id" uuid,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text DEFAULT ''::text NOT NULL,
  "target_url" text DEFAULT ''::text NOT NULL,
  "entity_type" text,
  "entity_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "unique_key" text,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE "reel_comment_likes" (
  "user_id" uuid NOT NULL,
  "comment_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE "reel_comments" (
  "id" bigint NOT NULL,
  "reel_id" bigint NOT NULL,
  "user_id" uuid NOT NULL,
  "parent_id" bigint,
  "texto" text NOT NULL,
  "likes" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
  "responde_a" text
);

ALTER TABLE "reel_likes" (
  "user_id" uuid NOT NULL,
  "reel_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE "reel_listen_events" (
  "id" bigint NOT NULL,
  "user_id" uuid NOT NULL,
  "reel_id" bigint NOT NULL,
  "action" text NOT NULL,
  "points" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE "reel_saves" (
  "user_id" uuid NOT NULL,
  "reel_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE "reel_shares" (
  "user_id" uuid NOT NULL,
  "reel_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE "reel_views" (
  "user_id" uuid NOT NULL,
  "reel_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE "reels" (
  "id" bigint NOT NULL,
  "titulo" text NOT NULL,
  "album" text,
  "genero" text NOT NULL,
  "descripcion" text,
  "duracion" text,
  "portada_url" text,
  "portada_path" text,
  "audio_url" text NOT NULL,
  "audio_path" text NOT NULL,
  "color_principal" text,
  "likes" integer DEFAULT 0 NOT NULL,
  "compartidos" integer DEFAULT 0 NOT NULL,
  "guardados" integer DEFAULT 0 NOT NULL,
  "creador_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
  "visitas" integer DEFAULT 0 NOT NULL,
  "status" USER-DEFINED DEFAULT 'pending'::content_moderation_status NOT NULL,
  "external_url" text
);

ALTER TABLE "settings" (
  "user_id_" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "lang" text DEFAULT 'Español'::text NOT NULL,
  "timezone" text DEFAULT 'Buenos Aires'::text NOT NULL,
  "login_notif" boolean DEFAULT true NOT NULL,
  "data_notifs" boolean DEFAULT true NOT NULL,
  "req_notifs" boolean DEFAULT false NOT NULL,
  "private_acc" boolean DEFAULT false NOT NULL,
  "show_email" boolean DEFAULT false NOT NULL,
  "priv_chat" boolean DEFAULT true NOT NULL,
  "download_data" ARRAY,
  "delete_acc" boolean DEFAULT false
);

ALTER TABLE "user_blocks" (
  "blocker_id" uuid NOT NULL,
  "blocked_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE "user_interests" (
  "user_id" uuid NOT NULL,
  "tag_name" text NOT NULL,
  "tag" text,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE "user_settings" (
  "user_id" uuid NOT NULL,
  "telefono" text DEFAULT ''::text NOT NULL,
  "idioma" text DEFAULT 'es'::text NOT NULL,
  "actividad_cuenta" boolean DEFAULT true NOT NULL,
  "mostrar_email" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "codigo_pais" text DEFAULT '+54'::text NOT NULL,
  "notificar_interacciones" boolean DEFAULT true NOT NULL,
  "notificar_comentarios" boolean DEFAULT true NOT NULL,
  "notificar_seguidores" boolean DEFAULT true NOT NULL,
  "notificar_publicaciones" boolean DEFAULT true NOT NULL,
  "notificar_menciones" boolean DEFAULT true NOT NULL,
  "notificar_mensajes" boolean DEFAULT true NOT NULL,
  "reducir_movimiento" boolean DEFAULT false NOT NULL
);

ALTER TABLE "users" (
  "id" uuid NOT NULL,
  "email" text NOT NULL,
  "username" text NOT NULL,
  "user_type" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
  "profile_img_url" text,
  "bio" text,
  "full_name" text,
  "artist_name" text,
  "artist_bio" text,
  "banner_url" text,
  "instagram_url" text,
  "verified" boolean DEFAULT false,
  "updated_at" timestamp with time zone,
  "profile_img_path" text,
  "profile_picture_status" USER-DEFINED DEFAULT 'pending'::content_moderation_status NOT NULL,
  "display_name" text,
  "profile_picture_url" text DEFAULT '/profile-placeholder.svg'::text,
  "telefono" text DEFAULT ''::text NOT NULL
);

