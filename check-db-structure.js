require('dotenv').config();
const { Pool } = require('pg');

async function checkDatabaseStructure() {
    const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
    
    if (!connectionString) {
        console.log('❌ DATABASE_URL no está configurada');
        return;
    }

    const pool = new Pool({
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false,
            require: true
        },
        connectionTimeoutMillis: 10000,
        query_timeout: 30000
    });

    try {
        console.log('🔍 Verificando estructura de la base de datos...');
        
        // Verificar si las tablas existen
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        console.log('📋 Tablas encontradas:', tablesResult.rows.map(row => row.table_name));
        
        // Verificar estructura de la tabla cards si existe
        const cardsTableExists = tablesResult.rows.some(row => row.table_name === 'cards');
        
        if (cardsTableExists) {
            console.log('\n🔍 Estructura de la tabla "cards":');
            const columnsResult = await pool.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'cards' 
                ORDER BY ordinal_position
            `);
            
            columnsResult.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
            });
            
            // Contar registros
            const countResult = await pool.query('SELECT COUNT(*) as count FROM cards');
            console.log(`\n📊 Total de cartas: ${countResult.rows[0].count}`);
            
            // Mostrar algunas cartas de ejemplo
            if (parseInt(countResult.rows[0].count) > 0) {
                console.log('\n📄 Ejemplo de cartas:');
                const sampleResult = await pool.query('SELECT * FROM cards LIMIT 3');
                sampleResult.rows.forEach((card, index) => {
                    console.log(`  ${index + 1}. ID: ${card.id}, Name: ${card.name || 'N/A'}`);
                });
            }
        } else {
            console.log('❌ La tabla "cards" no existe');
        }
        
        // Verificar estructura de la tabla sets si existe
        const setsTableExists = tablesResult.rows.some(row => row.table_name === 'sets');
        
        if (setsTableExists) {
            console.log('\n🔍 Estructura de la tabla "sets":');
            const columnsResult = await pool.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'sets' 
                ORDER BY ordinal_position
            `);
            
            columnsResult.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
            });
            
            // Contar registros
            const countResult = await pool.query('SELECT COUNT(*) as count FROM sets');
            console.log(`\n📊 Total de sets: ${countResult.rows[0].count}`);
        } else {
            console.log('❌ La tabla "sets" no existe');
        }
        
    } catch (error) {
        console.error('❌ Error verificando estructura:', error.message);
    } finally {
        await pool.end();
    }
}

checkDatabaseStructure();