const pool = require('../Pool_DB');

const usuariosController = {
    // LOGIN & VERIFICACIÓN: Busca al usuario y actualiza su última visita
    verificarUsuario: async (req, res) => {
        const { uid } = req.params;
        try {
            const result = await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
                [uid]
            );

            if (result.rows.length > 0) {
                return res.status(200).json({ existe: true, user: result.rows[0] });
            }
            else{
            res.status(200).json({ existe: false });
            }
        } catch (error) {
            console.error("Error en verificación:", error);
            res.status(500).json({ error: "Error interno del servidor" });
        }
    },

    // REGISTRO: Crea el usuario (oyente por defecto)
    registrarUsuario: async (req, res) => {
        const { uid, email, username, user_type } = req.body;
        try {
            const query = `INSERT INTO users (id, email, username, user_type) 
            VALUES ($1, $2, $3, $4) RETURNING *`;
            const result = await pool.query(query, [uid, email, username, user_type || 'oyente']);
            res.status(201).json(result.rows[0]);
        } catch (error) {
            if (error.code === '23505') {
                return res.status(400).json({ error: "El nombre de usuario ya está en uso." });
            }
            res.status(500).json({ error: "Error al crear la cuenta." });
        }
    },

    // UPGRADE: Convierte oyente a músico usando una transacción segura
    convertirAMusico: async (req, res) => {
        const { uid, genero, bio } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // 1. Cambiamos el rol
            await client.query('UPDATE users SET user_type = $1 WHERE id = $2', ['musico', uid]);
            // 2. Insertamos info extra
            const queryMusico = `
                INSERT INTO musico_info (user_id, genero_principal, bio) 
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id) DO UPDATE 
                SET genero_principal = EXCLUDED.genero_principal, bio = EXCLUDED.bio`;
            await client.query(queryMusico, [uid, genero, bio]);
            
            await client.query('COMMIT');
            res.json({ success: true, mensaje: "Perfil de músico activado." });
        } catch (error) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: "No se pudo procesar la conversión." });
        } finally {
            client.release();
        }
    }
};

module.exports = usuariosController;