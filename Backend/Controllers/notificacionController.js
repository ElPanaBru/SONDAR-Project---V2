const pool = require('../Pool_DB');

const notificacionController = {
  listar: async (req, res) => {
    const limite = Math.min(80, Math.max(1, Number(req.query.limit) || 40));
    try {
      const [items, count] = await Promise.all([
        pool.query(
          `SELECT
             n.*,
             COALESCE(a.display_name, a.username, 'SONDAR') AS actor_name,
             COALESCE(a.profile_img_url, '') AS actor_avatar
           FROM notifications n
           LEFT JOIN users a ON a.id = n.actor_id
           WHERE n.user_id = $1
           ORDER BY n.created_at DESC, n.id DESC
           LIMIT $2`,
          [req.user.id, limite]
        ),
        pool.query(
          'SELECT COUNT(*)::int AS total FROM notifications WHERE user_id = $1 AND read_at IS NULL',
          [req.user.id]
        ),
      ]);

      res.json({
        items: items.rows,
        noLeidas: Number(count.rows[0]?.total || 0),
      });
    } catch (error) {
      console.error('Error al listar notificaciones:', error);
      res.status(500).json({ error: 'No se pudieron cargar las notificaciones.' });
    }
  },

  contarNoLeidas: async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT COUNT(*)::int AS total FROM notifications WHERE user_id = $1 AND read_at IS NULL',
        [req.user.id]
      );
      res.json({ noLeidas: Number(result.rows[0]?.total || 0) });
    } catch (error) {
      console.error('Error al contar notificaciones:', error);
      res.status(500).json({ error: 'No se pudo obtener el contador.' });
    }
  },

  marcarLeida: async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE notifications
         SET read_at = COALESCE(read_at, timezone('utc'::text, now()))
         WHERE id = $1 AND user_id = $2
         RETURNING id, read_at`,
        [req.params.id, req.user.id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Notificacion no encontrada.' });
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error al marcar notificacion:', error);
      res.status(500).json({ error: 'No se pudo actualizar la notificacion.' });
    }
  },

  marcarTodasLeidas: async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE notifications
         SET read_at = timezone('utc'::text, now())
         WHERE user_id = $1 AND read_at IS NULL`,
        [req.user.id]
      );
      res.json({ ok: true, actualizadas: result.rowCount });
    } catch (error) {
      console.error('Error al marcar todas:', error);
      res.status(500).json({ error: 'No se pudieron actualizar las notificaciones.' });
    }
  },

  eliminarLeidas: async (req, res) => {
    try {
      const result = await pool.query(
        'DELETE FROM notifications WHERE user_id = $1 AND read_at IS NOT NULL',
        [req.user.id]
      );
      res.json({ ok: true, eliminadas: result.rowCount });
    } catch (error) {
      console.error('Error al limpiar notificaciones:', error);
      res.status(500).json({ error: 'No se pudieron eliminar las notificaciones.' });
    }
  },
};

module.exports = notificacionController;
