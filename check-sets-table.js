require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkSetsTable() {
    try {
        // Verificar si existe la tabla sets
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'sets'
            )
        `);
        
        console.log('¿Tabla sets existe?', tableExists.rows[0].exists);
        
        if (tableExists.rows[0].exists) {
            const result = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'sets' 
                ORDER BY ordinal_position
            `);
            
            console.log('\nColumnas existentes en tabla sets:');
            result.rows.forEach(row => {
                console.log(`- ${row.column_name}: ${row.data_type}`);
            });
        } else {
            console.log('La tabla sets no existe. Se creará con la migración.');
        }
        
    } catch (error) {
        console.log('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkSetsTable();
