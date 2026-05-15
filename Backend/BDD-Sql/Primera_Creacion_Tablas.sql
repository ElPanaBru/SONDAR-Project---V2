-- 1. Creamos la tabla de usuarios
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY, -- Aquí se guardará el UID de Firebase
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    user_type VARCHAR(20) DEFAULT 'oyente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Creamos la tabla de músicos (para el futuro 'upgrade')
CREATE TABLE musico_info (
    user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    genero_principal VARCHAR(50),
    bio TEXT
);