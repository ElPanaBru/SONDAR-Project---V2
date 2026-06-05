const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');

const usuariosController = {
  crearCuenta: async (req, res) => {
    const { email, password, username, user_type } = req.body;
    const cleanEmail = email?.trim().toLowerCase();
    const cleanUsername = username?.trim();
    const cleanPassword = password?.trim();
    const tipoUsuario = user_type || process.env.DEFAULT_USER_TYPE || 'musico';
    let authUserId = null;

    if (!cleanEmail || !cleanPassword || !cleanUsername) {
      return res.status(400).json({ error: 'Email, contrasena y nombre de usuario son obligatorios.' });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres.' });
    }

    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: cleanPassword,
        email_confirm: true,
        user_metadata: {
          username: cleanUsername
        }
      });

      if (error) {
        throw error;
      }

      authUserId = data.user.id;

      const query = `
        INSERT INTO users (id, email, username, user_type)
        VALUES ($1, $2, $3, $4)
        RETURNING *`;

      const result = await pool.query(query, [
        authUserId,
        cleanEmail,
        cleanUsername,
        tipoUsuario
      ]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (authUserId) {
        await supabase.auth.admin.deleteUser(authUserId).catch(() => null);
      }

      if (error.code === '23505') {
        return res.status(400).json({ error: 'El email o nombre de usuario ya esta en uso.' });
      }

      if (error.code === '23514') {
        return res.status(400).json({ error: 'El tipo de usuario no es valido para la base de datos.' });
      }

      if (error.message?.includes('already been registered')) {
        return res.status(400).json({ error: 'El correo ya esta registrado.' });
      }

      console.error('Error al crear cuenta:', error);
      res.status(500).json({ error: 'Error al crear la cuenta.' });
    }
  },

  verificarUsuario: async (req, res) => {
    const userId = req.user.id;

    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length > 0) {
        return res.status(200).json({ existe: true, user: result.rows[0] });
      }

      res.status(200).json({ existe: false });
    } catch (error) {
      console.error('Error en verificacion:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  },

  registrarUsuario: async (req, res) => {
    const userId = req.user.id;
    const email = req.user.email;
    const { username, user_type } = req.body;
    const tipoUsuario = user_type || process.env.DEFAULT_USER_TYPE || 'musico';

    if (!username) {
      return res.status(400).json({ error: 'El nombre de usuario es obligatorio.' });
    }

    try {
      const query = `
        INSERT INTO users (id, email, username, user_type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            username = EXCLUDED.username,
            user_type = EXCLUDED.user_type
        RETURNING *`;

      const result = await pool.query(query, [
        userId,
        email,
        username,
        tipoUsuario
      ]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'El email o nombre de usuario ya esta en uso.' });
      }

      if (error.code === '23514') {
        return res.status(400).json({ error: 'El tipo de usuario no es valido para la base de datos.' });
      }

      console.error('Error al registrar usuario:', error);
      res.status(500).json({ error: 'Error al crear la cuenta.' });
    }
  },

  convertirAMusico: async (req, res) => {
    const userId = req.user.id;
    const { genero, bio } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('UPDATE users SET user_type = $1 WHERE id = $2', ['musico', userId]);
      await client.query('COMMIT');

      res.json({
        success: true,
        mensaje: 'Perfil de musico activado.',
        perfil: { genero, bio }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error al convertir usuario a musico:', error);
      res.status(500).json({ error: 'No se pudo procesar la conversion.' });
    } finally {
      client.release();
    }
  },

  eliminarCuentaActual: async (req, res) => {
    const userId = req.user.id;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM users WHERE id = $1', [userId]);

      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) {
        throw new Error(error.message);
      }

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error al eliminar cuenta:', error);
      res.status(500).json({ error: 'No se pudo eliminar la cuenta.' });
    } finally {
      client.release();
    }
  }
};

module.exports = usuariosController;
