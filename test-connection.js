require('dotenv').config();
const { Pool } = require('pg');

async function testConnection() {
    console.log('🔍 Probando conexión a PostgreSQL...');
    console.log('📡 URL:', process.env.DATABASE_URL ? 'Configurada' : 'No configurada');
    
    if (!process.env.DATABASE_URL) {
        console.log('❌ DATABASE_URL no está configurada');
        return;
    }
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
    
    try {
        console.log('⏳ Intentando conectar...');
        const client = await pool.connect();
        console.log('✅ Conexión exitosa');
        
        const result = await client.query('SELECT version()');
        console.log('📊 Versión PostgreSQL:', result.rows[0].version);
        
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('📋 Tablas encontradas:', tables.rows.map(r => r.table_name));
        
        client.release();
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        console.error('🔍 Código:', error.code);
        console.error('📍 Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

testConnection();
