-- Ejecutar en Supabase SQL Editor.
-- Estas tablas hacen que seguidores, favoritos y guardados vivan en Supabase.

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT follows_pkey PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_no_self CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS public.reel_likes (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reel_id bigint NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT reel_likes_pkey PRIMARY KEY (user_id, reel_id)
);

CREATE TABLE IF NOT EXISTS public.reel_saves (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reel_id bigint NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT reel_saves_pkey PRIMARY KEY (user_id, reel_id)
);

CREATE TABLE IF NOT EXISTS public.event_saves (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id bigint NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT event_saves_pkey PRIMARY KEY (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS public.reel_comments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  reel_id bigint NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_id bigint REFERENCES public.reel_comments(id) ON DELETE CASCADE,
  texto text NOT NULL CHECK (length(trim(texto)) > 0),
  likes integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT reel_comments_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_reel_likes_reel_id ON public.reel_likes(reel_id);
CREATE INDEX IF NOT EXISTS idx_reel_saves_reel_id ON public.reel_saves(reel_id);
CREATE INDEX IF NOT EXISTS idx_event_saves_event_id ON public.event_saves(event_id);
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel_id ON public.reel_comments(reel_id);
CREATE INDEX IF NOT EXISTS idx_reel_comments_parent_id ON public.reel_comments(parent_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'follows' AND policyname = 'follows_select_public'
  ) THEN
    CREATE POLICY follows_select_public ON public.follows
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'follows' AND policyname = 'follows_insert_own'
  ) THEN
    CREATE POLICY follows_insert_own ON public.follows
      FOR INSERT WITH CHECK (auth.uid() = follower_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'follows' AND policyname = 'follows_delete_own'
  ) THEN
    CREATE POLICY follows_delete_own ON public.follows
      FOR DELETE USING (auth.uid() = follower_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reel_likes' AND policyname = 'reel_likes_select_public'
  ) THEN
    CREATE POLICY reel_likes_select_public ON public.reel_likes
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reel_likes' AND policyname = 'reel_likes_insert_own'
  ) THEN
    CREATE POLICY reel_likes_insert_own ON public.reel_likes
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reel_likes' AND policyname = 'reel_likes_delete_own'
  ) THEN
    CREATE POLICY reel_likes_delete_own ON public.reel_likes
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reel_saves' AND policyname = 'reel_saves_select_own'
  ) THEN
    CREATE POLICY reel_saves_select_own ON public.reel_saves
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reel_saves' AND policyname = 'reel_saves_insert_own'
  ) THEN
    CREATE POLICY reel_saves_insert_own ON public.reel_saves
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reel_saves' AND policyname = 'reel_saves_delete_own'
  ) THEN
    CREATE POLICY reel_saves_delete_own ON public.reel_saves
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'event_saves' AND policyname = 'event_saves_select_own'
  ) THEN
    CREATE POLICY event_saves_select_own ON public.event_saves
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'event_saves' AND policyname = 'event_saves_insert_own'
  ) THEN
    CREATE POLICY event_saves_insert_own ON public.event_saves
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'event_saves' AND policyname = 'event_saves_delete_own'
  ) THEN
    CREATE POLICY event_saves_delete_own ON public.event_saves
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reel_comments' AND policyname = 'reel_comments_select_public'
  ) THEN
    CREATE POLICY reel_comments_select_public ON public.reel_comments
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reel_comments' AND policyname = 'reel_comments_insert_own'
  ) THEN
    CREATE POLICY reel_comments_insert_own ON public.reel_comments
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reel_comments' AND policyname = 'reel_comments_delete_own'
  ) THEN
    CREATE POLICY reel_comments_delete_own ON public.reel_comments
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
