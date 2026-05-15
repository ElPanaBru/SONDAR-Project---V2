const pool = require('../Pool_DB');

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      username VARCHAR(50) UNIQUE NOT NULL,
      user_type VARCHAR(20) DEFAULT 'oyente',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      nombre VARCHAR(80),
      bio TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS musico_info (
      user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      genero_principal VARCHAR(50),
      bio TEXT
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      email VARCHAR(255),
      telefono VARCHAR(40) DEFAULT '',
      idioma VARCHAR(10) DEFAULT 'es',
      zona_horaria VARCHAR(80) DEFAULT 'America/Argentina/Buenos_Aires',
      login_alertas BOOLEAN DEFAULT true,
      newsletter BOOLEAN DEFAULT false,
      actividad_cuenta BOOLEAN DEFAULT true,
      perfil_privado BOOLEAN DEFAULT false,
      mostrar_email BOOLEAN DEFAULT false,
      permitir_mensajes BOOLEAN DEFAULT true,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS saved_items (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
      item_type VARCHAR(40) NOT NULL,
      item_id VARCHAR(255) NOT NULL,
      item_data JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, item_type, item_id)
    );

    CREATE TABLE IF NOT EXISTS user_interactions (
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
      item_type VARCHAR(40) NOT NULL,
      item_id VARCHAR(255) NOT NULL,
      interaction_type VARCHAR(40) NOT NULL,
      active BOOLEAN DEFAULT true,
      item_data JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, item_type, item_id, interaction_type)
    );

    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title VARCHAR(120) NOT NULL,
      place TEXT NOT NULL,
      event_date TIMESTAMP,
      genre VARCHAR(50) DEFAULT 'otros',
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      image TEXT,
      ticket_link TEXT,
      created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_publications (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
      nombre VARCHAR(120) NOT NULL,
      audio_name TEXT,
      miniatura TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS community_threads (
      id SERIAL PRIMARY KEY,
      community_id VARCHAR(120) NOT NULL,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      op VARCHAR(120),
      username VARCHAR(120),
      type VARCHAR(40) DEFAULT 'destacado',
      title VARCHAR(180) NOT NULL,
      body TEXT NOT NULL,
      tag VARCHAR(80),
      votes INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS community_comments (
      id SERIAL PRIMARY KEY,
      thread_id INTEGER REFERENCES community_threads(id) ON DELETE CASCADE,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      author VARCHAR(120),
      username VARCHAR(120),
      body TEXT NOT NULL,
      votes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

module.exports = initSchema;
