BEGIN;
DROP POLICY IF EXISTS perfil_comunidad_respuestas_insert_follower ON public.perfil_comunidad_respuestas;
DROP POLICY IF EXISTS perfil_comunidad_respuestas_insert_authenticated ON public.perfil_comunidad_respuestas;
CREATE POLICY perfil_comunidad_respuestas_insert_authenticated
  ON public.perfil_comunidad_respuestas FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.perfil_comunidad_publicaciones p
      WHERE p.id = perfil_comunidad_respuestas.publicacion_id
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.user_id)
             OR (b.blocker_id = p.user_id AND b.blocked_id = auth.uid())
        )
    )
  );
COMMIT;
