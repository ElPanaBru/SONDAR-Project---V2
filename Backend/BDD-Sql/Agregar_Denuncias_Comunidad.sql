BEGIN;

ALTER TABLE public.content_reports
  DROP CONSTRAINT IF EXISTS content_reports_content_type_check;

ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_content_type_check
  CHECK (content_type IN ('reel', 'evento', 'perfil', 'community_post', 'community_comment'));

COMMIT;
