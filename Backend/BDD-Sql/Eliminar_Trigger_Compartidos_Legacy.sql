-- El contador se deriva de reel_shares; este trigger historico referencia
-- la antigua columna reels.compartidos y debe desaparecer.
BEGIN;
DROP FUNCTION IF EXISTS public.handle_reel_share_counter() CASCADE;
COMMIT;
