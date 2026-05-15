const pool = require('../Pool_DB');

const defaultSettings = (email = '') => ({
  email,
  telefono: '',
  idioma: 'es',
  zonaHoraria: 'America/Argentina/Buenos_Aires',
  loginAlertas: true,
  newsletter: false,
  actividadCuenta: true,
  perfilPrivado: false,
  mostrarEmail: false,
  permitirMensajes: true,
});

const mapSettings = (row) => {
  if (!row) return defaultSettings();

  return {
    email: row.email || '',
    telefono: row.telefono || '',
    idioma: row.idioma || 'es',
    zonaHoraria: row.zona_horaria || 'America/Argentina/Buenos_Aires',
    loginAlertas: row.login_alertas,
    newsletter: row.newsletter,
    actividadCuenta: row.actividad_cuenta,
    perfilPrivado: row.perfil_privado,
    mostrarEmail: row.mostrar_email,
    permitirMensajes: row.permitir_mensajes,
  };
};

const mapProfile = (user, profile) => ({
  nombre: profile?.nombre || user?.username || user?.email?.split('@')[0] || 'Usuario Sondar',
  bio: profile?.bio || '',
  avatar: profile?.avatar || '',
});

const usuariosController = {
  listarUsuarios: async (_req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, email, username, user_type, created_at, last_login FROM users ORDER BY created_at DESC'
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error listando usuarios:', error);
      res.status(500).json({ error: 'No se pudieron obtener los usuarios.' });
    }
  },

  verificarUsuario: async (req, res) => {
    const { uid } = req.params;

    try {
      const result = await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [uid]
      );

      if (!result.rows.length) {
        return res.status(200).json({ existe: false });
      }

      const user = result.rows[0];
      await pool.query(
        `INSERT INTO user_profiles (user_id, nombre)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING`,
        [uid, user.username]
      );
      await pool.query(
        `INSERT INTO user_settings (user_id, email)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING`,
        [uid, user.email]
      );

      res.status(200).json({ existe: true, user });
    } catch (error) {
      console.error('Error en verificacion:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  registrarUsuario: async (req, res) => {
    const { uid, email, username, user_type } = req.body;
    const cleanUsername = username?.trim() || email?.split('@')[0] || uid.slice(0, 8);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO users (id, email, username, user_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             username = EXCLUDED.username,
             user_type = COALESCE(EXCLUDED.user_type, users.user_type)
         RETURNING *`,
        [uid, email, cleanUsername, user_type || 'oyente']
      );

      await client.query(
        `INSERT INTO user_profiles (user_id, nombre)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING`,
        [uid, cleanUsername]
      );
      await client.query(
        `INSERT INTO user_settings (user_id, email)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email`,
        [uid, email]
      );

      await client.query('COMMIT');
      res.status(201).json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') {
        return res.status(400).json({ error: 'El nombre de usuario ya esta en uso.' });
      }
      console.error('Error registrando usuario:', error);
      res.status(500).json({ error: 'Error al crear la cuenta.' });
    } finally {
      client.release();
    }
  },

  obtenerCuenta: async (req, res) => {
    const { uid } = req.params;

    try {
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [uid]);
      if (!userResult.rows.length) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const user = userResult.rows[0];
      const profileResult = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [uid]);
      const settingsResult = await pool.query('SELECT * FROM user_settings WHERE user_id = $1', [uid]);
      const savedResult = await pool.query(
        'SELECT item_type, item_id, item_data, created_at FROM saved_items WHERE user_id = $1 ORDER BY created_at DESC',
        [uid]
      );
      const interactionsResult = await pool.query(
        `SELECT item_type, item_id, interaction_type, active, item_data
         FROM user_interactions WHERE user_id = $1`,
        [uid]
      );

      res.json({
        user,
        perfil: mapProfile(user, profileResult.rows[0]),
        configuracion: mapSettings(settingsResult.rows[0] || { email: user.email }),
        guardados: savedResult.rows,
        interacciones: interactionsResult.rows,
      });
    } catch (error) {
      console.error('Error obteniendo cuenta:', error);
      res.status(500).json({ error: 'No se pudo obtener la cuenta.' });
    }
  },

  obtenerPerfil: async (req, res) => {
    const { uid } = req.params;

    try {
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [uid]);
      if (!userResult.rows.length) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const profileResult = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [uid]);
      res.json(mapProfile(userResult.rows[0], profileResult.rows[0]));
    } catch (error) {
      console.error('Error obteniendo perfil:', error);
      res.status(500).json({ error: 'No se pudo obtener el perfil.' });
    }
  },

  actualizarPerfil: async (req, res) => {
    const { uid } = req.params;
    const { nombre, bio, avatar } = req.body;
    const cleanName = nombre?.trim();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const profileResult = await client.query(
        `INSERT INTO user_profiles (user_id, nombre, bio, avatar, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE
         SET nombre = EXCLUDED.nombre,
             bio = EXCLUDED.bio,
             avatar = EXCLUDED.avatar,
             updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [uid, cleanName, bio || '', avatar || '']
      );

      await client.query('UPDATE users SET username = $1 WHERE id = $2', [cleanName, uid]);
      await client.query('COMMIT');
      res.json(mapProfile({ username: cleanName }, profileResult.rows[0]));
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error actualizando perfil:', error);
      res.status(500).json({ error: 'No se pudo guardar el perfil.' });
    } finally {
      client.release();
    }
  },

  obtenerConfiguracion: async (req, res) => {
    const { uid } = req.params;

    try {
      const result = await pool.query('SELECT * FROM user_settings WHERE user_id = $1', [uid]);
      res.json(mapSettings(result.rows[0]));
    } catch (error) {
      console.error('Error obteniendo configuracion:', error);
      res.status(500).json({ error: 'No se pudo obtener la configuracion.' });
    }
  },

  actualizarConfiguracion: async (req, res) => {
    const { uid } = req.params;
    const settings = { ...defaultSettings(), ...req.body };

    try {
      const result = await pool.query(
        `INSERT INTO user_settings (
            user_id, email, telefono, idioma, zona_horaria, login_alertas,
            newsletter, actividad_cuenta, perfil_privado, mostrar_email,
            permitir_mensajes, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE
         SET email = EXCLUDED.email,
             telefono = EXCLUDED.telefono,
             idioma = EXCLUDED.idioma,
             zona_horaria = EXCLUDED.zona_horaria,
             login_alertas = EXCLUDED.login_alertas,
             newsletter = EXCLUDED.newsletter,
             actividad_cuenta = EXCLUDED.actividad_cuenta,
             perfil_privado = EXCLUDED.perfil_privado,
             mostrar_email = EXCLUDED.mostrar_email,
             permitir_mensajes = EXCLUDED.permitir_mensajes,
             updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          uid,
          settings.email,
          settings.telefono,
          settings.idioma,
          settings.zonaHoraria,
          settings.loginAlertas,
          settings.newsletter,
          settings.actividadCuenta,
          settings.perfilPrivado,
          settings.mostrarEmail,
          settings.permitirMensajes,
        ]
      );

      res.json(mapSettings(result.rows[0]));
    } catch (error) {
      console.error('Error actualizando configuracion:', error);
      res.status(500).json({ error: 'No se pudo guardar la configuracion.' });
    }
  },

  obtenerGuardados: async (req, res) => {
    const { uid } = req.params;

    try {
      const result = await pool.query(
        'SELECT item_type, item_id, item_data, created_at FROM saved_items WHERE user_id = $1 ORDER BY created_at DESC',
        [uid]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error obteniendo guardados:', error);
      res.status(500).json({ error: 'No se pudieron obtener los guardados.' });
    }
  },

  guardarItem: async (req, res) => {
    const { uid } = req.params;
    const { itemType, itemId, itemData } = req.body;

    try {
      const result = await pool.query(
        `INSERT INTO saved_items (user_id, item_type, item_id, item_data)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, item_type, item_id) DO UPDATE
         SET item_data = EXCLUDED.item_data
         RETURNING *`,
        [uid, itemType, String(itemId), itemData || {}]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error guardando item:', error);
      res.status(500).json({ error: 'No se pudo guardar.' });
    }
  },

  eliminarGuardado: async (req, res) => {
    const { uid, itemType, itemId } = req.params;

    try {
      await pool.query(
        'DELETE FROM saved_items WHERE user_id = $1 AND item_type = $2 AND item_id = $3',
        [uid, itemType, itemId]
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Error eliminando guardado:', error);
      res.status(500).json({ error: 'No se pudo quitar el guardado.' });
    }
  },

  guardarInteraccion: async (req, res) => {
    const { uid } = req.params;
    const { itemType, itemId, interactionType, active, itemData } = req.body;

    try {
      const result = await pool.query(
        `INSERT INTO user_interactions (user_id, item_type, item_id, interaction_type, active, item_data, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, item_type, item_id, interaction_type) DO UPDATE
         SET active = EXCLUDED.active,
             item_data = EXCLUDED.item_data,
             updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [uid, itemType, String(itemId), interactionType, active, itemData || {}]
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error guardando interaccion:', error);
      res.status(500).json({ error: 'No se pudo guardar la interaccion.' });
    }
  },

  obtenerPublicaciones: async (req, res) => {
    const { uid } = req.params;

    try {
      const result = await pool.query(
        `SELECT id, nombre, audio_name AS "audioName", miniatura, created_at
         FROM user_publications WHERE user_id = $1 ORDER BY created_at DESC`,
        [uid]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error obteniendo publicaciones:', error);
      res.status(500).json({ error: 'No se pudieron obtener publicaciones.' });
    }
  },

  crearPublicacion: async (req, res) => {
    const { uid } = req.params;
    const { nombre, audioName, miniatura } = req.body;

    try {
      const result = await pool.query(
        `INSERT INTO user_publications (user_id, nombre, audio_name, miniatura)
         VALUES ($1, $2, $3, $4)
         RETURNING id, nombre, audio_name AS "audioName", miniatura, created_at`,
        [uid, nombre, audioName || '', miniatura || '']
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creando publicacion:', error);
      res.status(500).json({ error: 'No se pudo crear la publicacion.' });
    }
  },

  convertirAMusico: async (req, res) => {
    const { uid, genero, bio } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('UPDATE users SET user_type = $1 WHERE id = $2', ['musico', uid]);
      await client.query(
        `INSERT INTO musico_info (user_id, genero_principal, bio)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
         SET genero_principal = EXCLUDED.genero_principal,
             bio = EXCLUDED.bio`,
        [uid, genero, bio]
      );

      await client.query('COMMIT');
      res.json({ success: true, mensaje: 'Perfil de musico activado.' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error convirtiendo a musico:', error);
      res.status(500).json({ error: 'No se pudo procesar la conversion.' });
    } finally {
      client.release();
    }
  },
};

module.exports = usuariosController;
