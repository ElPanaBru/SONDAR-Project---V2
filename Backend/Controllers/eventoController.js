const pool = require('../Pool_DB'); // Ajusta la ruta si es necesario

const eventoController = {
    // Listar todos los eventos
    listarEventos: async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM eventos ORDER BY id DESC');
            res.json(result.rows);
        } catch (error) {
            console.error("Error al listar eventos:", error);
            res.status(500).json({ error: "Error al obtener los eventos" });
        }
    },

    // Crear un nuevo evento
    crearEvento: async (req, res) => {
        const { titulo, genero, ubicacion, fecha, img, link, creador, coords } = req.body;
        
        try {
            const query = `
                INSERT INTO eventos (titulo, genero, lugar, fecha, img, link, creador, latitud, longitud) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
                RETURNING *`;
            
            const values = [
                titulo, 
                genero, 
                ubicacion, 
                fecha, 
                img, 
                link, 
                creador, 
                coords[0], // Latitud
                coords[1]  // Longitud
            ];

            const result = await pool.query(query, values);
            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error("Error al crear evento:", error);
            res.status(500).json({ error: "Error al guardar el evento en la base de datos" });
        }
    }
};

module.exports = eventoController;