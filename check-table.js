require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkTable() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'cards' 
            ORDER BY ordinal_position
        `);
        
        console.log('Columnas existentes en tabla cards:');
        result.rows.forEach(row => {
            console.log(`- ${row.column_name}: ${row.data_type}`);
        });
        
    } catch (error) {
        console.log('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkTable();
