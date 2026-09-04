const pool = require('../Pool_DB');

let esquemaStorageListo = null;

async function crearPoliticaSiFalta(nombre, sql) {
  const existe = await pool.query(
    `SELECT 1
     FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = $1`,
    [nombre]
  );
  if (existe.rowCount === 0) {
    try {
      await pool.query(sql);
    } catch (error) {
      if (error.code !== '42710') throw error;
    }
  }
}

async function crearEsquemaStorage() {
  await pool.query(`
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES
      ('perfiles', 'perfiles', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
      ('eventos', 'eventos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
      ('reels', 'reels', true, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'])
    ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types
  `);

  await crearPoliticaSiFalta('sondar_perfiles_insert_own', `
    CREATE POLICY sondar_perfiles_insert_own ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'perfiles' AND (storage.foldername(name))[2] = auth.uid()::text)
  `);
  await crearPoliticaSiFalta('sondar_perfiles_select_own', `
    CREATE POLICY sondar_perfiles_select_own ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'perfiles' AND owner_id = auth.uid()::text)
  `);
  await crearPoliticaSiFalta('sondar_perfiles_delete_own', `
    CREATE POLICY sondar_perfiles_delete_own ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'perfiles' AND owner_id = auth.uid()::text)
  `);

  await crearPoliticaSiFalta('sondar_eventos_insert_own', `
    CREATE POLICY sondar_eventos_insert_own ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'eventos' AND (storage.foldername(name))[2] = auth.uid()::text)
  `);
  await crearPoliticaSiFalta('sondar_eventos_select_own', `
    CREATE POLICY sondar_eventos_select_own ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'eventos' AND owner_id = auth.uid()::text)
  `);
  await crearPoliticaSiFalta('sondar_eventos_delete_own', `
    CREATE POLICY sondar_eventos_delete_own ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'eventos' AND owner_id = auth.uid()::text)
  `);

  await crearPoliticaSiFalta('sondar_reels_insert_own', `
    CREATE POLICY sondar_reels_insert_own ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'reels' AND (storage.foldername(name))[3] = auth.uid()::text)
  `);
  await crearPoliticaSiFalta('sondar_reels_select_own', `
    CREATE POLICY sondar_reels_select_own ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'reels' AND owner_id = auth.uid()::text)
  `);
  await crearPoliticaSiFalta('sondar_reels_delete_own', `
    CREATE POLICY sondar_reels_delete_own ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'reels' AND owner_id = auth.uid()::text)
  `);
}

async function asegurarEsquemaStorage() {
  if (!esquemaStorageListo) {
    esquemaStorageListo = crearEsquemaStorage().catch((error) => {
      esquemaStorageListo = null;
      throw error;
    });
  }
  return esquemaStorageListo;
}

module.exports = { asegurarEsquemaStorage };
