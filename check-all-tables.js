require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkAllTables() {
    try {
        // Obtener todas las tablas
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('📋 Tablas en la base de datos:');
        tables.rows.forEach(row => {
            console.log(`- ${row.table_name}`);
        });
        
        // Verificar llaves foráneas de sets
        console.log('\n🔗 Llaves foráneas de sets:');
        const foreignKeys = await pool.query(`
            SELECT
                tc.constraint_name,
                tc.table_name, 
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_name = 'sets'
        `);
        
        foreignKeys.rows.forEach(fk => {
            console.log(`- ${fk.constraint_name}: ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
        });
        
        // Verificar si existe la tabla series
        console.log('\n📚 Tabla series:');
        const seriesExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'series'
            )
        `);
        
        console.log('¿Tabla series existe?', seriesExists.rows[0].exists);
        
        if (seriesExists.rows[0].exists) {
            const seriesData = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'series' 
                ORDER BY ordinal_position
            `);
            
            console.log('Columnas de series:');
            seriesData.rows.forEach(row => {
                console.log(`- ${row.column_name}: ${row.data_type}`);
            });
            
            // Mostrar datos existentes
            const seriesRows = await pool.query('SELECT * FROM series LIMIT 5');
            console.log('\nDatos existentes en series:');
            seriesRows.rows.forEach(row => {
                console.log(`- ${JSON.stringify(row)}`);
            });
        }
        
    } catch (error) {
        console.log('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkAllTables();
