BEGIN;

CREATE TABLE IF NOT EXISTS public.event_organizers (
    event_id bigint NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    added_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_organizers_user_id_idx
    ON public.event_organizers(user_id);

COMMIT;
