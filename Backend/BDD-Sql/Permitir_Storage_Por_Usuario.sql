-- Las claves modernas sb_secret no son JWT. Las cargas usan el JWT del usuario
-- autenticado y quedan restringidas a su carpeta y a los objetos que creo.

DROP POLICY IF EXISTS sondar_reels_insert_own ON storage.objects;
CREATE POLICY sondar_reels_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reels'
    AND (storage.foldername(name))[3] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS sondar_reels_select_own ON storage.objects;
CREATE POLICY sondar_reels_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'reels'
    AND owner_id = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS sondar_reels_delete_own ON storage.objects;
CREATE POLICY sondar_reels_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'reels'
    AND owner_id = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS sondar_perfiles_insert_own ON storage.objects;
CREATE POLICY sondar_perfiles_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'perfiles'
    AND (storage.foldername(name))[2] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS sondar_perfiles_select_own ON storage.objects;
CREATE POLICY sondar_perfiles_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'perfiles'
    AND owner_id = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS sondar_perfiles_delete_own ON storage.objects;
CREATE POLICY sondar_perfiles_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'perfiles'
    AND owner_id = (SELECT auth.uid()::text)
  );
