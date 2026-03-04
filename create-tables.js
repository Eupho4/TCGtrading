const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:Badalona.17@localhost:5432/Pokemon TCG',
  ssl: false
});

async function createTables() {
  try {
    console.log('🔧 Creando estructura de tablas...');
    
    await pool.connect();
    
    // Crear tabla series
    await pool.query(`
      CREATE TABLE IF NOT EXISTS series (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      )
    `);
    
    // Crear tabla sets
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sets (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        series_id VARCHAR(50) REFERENCES series(id),
        printed_total INTEGER,
        total INTEGER,
        legalities JSONB,
        release_date VARCHAR(20),
        images JSONB
      )
    `);
    
    // Crear tabla cards
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cards (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        number VARCHAR(20),
        set_id VARCHAR(50) REFERENCES sets(id),
        rarity_id VARCHAR(50),
        hp VARCHAR(10),
        types JSONB,
        subtypes JSONB,
        rules JSONB,
        images JSONB,
        tcgplayer JSONB,
        cardmarket JSONB,
        legal JSONB,
        artist VARCHAR(255),
        flavor_text TEXT,
        national_pokedex_numbers JSONB,
        attacks JSONB,
        weaknesses JSONB,
        resistances JSONB,
        retreat_cost JSONB,
        converted_retreat_cost INTEGER
      )
    `);
    
    console.log('✅ Tablas creadas correctamente');
    
  } catch (error) {
    console.error('❌ Error creando tablas:', error.message);
  } finally {
    await pool.end();
  }
}

createTables();
