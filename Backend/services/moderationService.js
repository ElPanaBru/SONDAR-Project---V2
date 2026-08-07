const pool = require('../Pool_DB');

async function asegurarEsquemaModeracion() {
  // El esquema se administra en supabase/migrations. Se conserva la función
  // temporalmente para mantener compatibles los controladores existentes.
  return undefined;
}

async function registrarDenuncia({ reporterId, reportedUserId, contentType, contentId, reason, details }) {
  await asegurarEsquemaModeracion();
  if (reportedUserId === reporterId) {
    const error = new Error('No podes denunciar contenido propio.');
    error.status = 400;
    throw error;
  }
  const result = await pool.query(
    `INSERT INTO content_reports
       (reporter_id, reported_user_id, content_type, content_id, reason, details)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (reporter_id, content_type, content_id) DO NOTHING
     RETURNING id`,
    [
      reporterId,
      reportedUserId,
      contentType,
      String(contentId),
      reason || 'otro',
      String(details || '').trim().slice(0, 500),
    ]
  );
  return { denunciado: true, nuevaDenuncia: result.rowCount > 0 };
}

module.exports = { asegurarEsquemaModeracion, registrarDenuncia };
