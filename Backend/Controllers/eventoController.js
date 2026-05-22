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
    // 1. Extraemos los campos de texto de req.body
    console.log("--- DEBUG START ---");
    console.log("¿Existe req.body?", req.body !== undefined);
    console.log("req.body:", req.body);
    console.log("¿Existe req.file?", req.file !== undefined);
    console.log("req.file:", req.file);
    console.log("--- DEBUG END ---");
    const { titulo, genero, ubicacion, fecha, link, creador, latitud, longitud } = req.body;
    
    // 2. Extraemos la ruta de la imagen desde req.file (generada por multer)
    // Esto guardará algo como 'uploads/nombre_archivo.jpg' en tu base de datos
    const imgPath = req.file ? req.file.path : null; 

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
            imgPath, // Usamos la ruta del archivo
            link, 
            creador, 
            latitud, // Recibido como campo separado
            longitud // Recibido como campo separado
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