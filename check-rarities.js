require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkRarities() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'rarities' 
            ORDER BY ordinal_position
        `);
        
        console.log('Columnas existentes en tabla rarities:');
        result.rows.forEach(row => {
            console.log(`- ${row.column_name}: ${row.data_type}`);
        });
        
        // Mostrar datos existentes
        const rarityData = await pool.query('SELECT * FROM rarities ORDER BY id');
        console.log('\n📋 Rarezas existentes:');
        rarityData.rows.forEach(row => {
            console.log(`- ${row.id}: ${row.name}`);
        });
        
    } catch (error) {
        console.log('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkRarities();
