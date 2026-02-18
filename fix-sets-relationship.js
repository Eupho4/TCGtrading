require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function fixSetsRelationship() {
    try {
        console.log('🔧 Verificando y arreglando relaciones de sets...');
        
        // 1. Verificar si las cartas tienen set_id
        const cardsWithSets = await pool.query(`
            SELECT DISTINCT set_id, COUNT(*) as count 
            FROM cards 
            WHERE set_id IS NOT NULL 
            GROUP BY set_id 
            LIMIT 10
        `);
        
        console.log('📊 Cartas con set_id:');
        cardsWithSets.rows.forEach(row => {
            console.log(`- Set ${row.set_id}: ${row.count} cartas`);
        });
        
        // 2. Verificar si existen los sets
        const existingSets = await pool.query(`
            SELECT id, name, series_id 
            FROM sets 
            LIMIT 10
        `);
        
        console.log('\n📦 Sets existentes:');
        existingSets.rows.forEach(row => {
            console.log(`- ${row.id}: ${row.name} (serie: ${row.series_id})`);
        });
        
        // 3. Verificar el problema del JOIN
        console.log('\n🔍 Probando JOIN:');
        const testJoin = await pool.query(`
            SELECT 
                c.id, c.name, c.set_id,
                s.id as set_id_db, s.name as set_name,
                se.id as series_id, se.name as series_name
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            WHERE c.name ILIKE '%charizard%'
            LIMIT 3
        `);
        
        console.log('Resultado del JOIN:');
        testJoin.rows.forEach(row => {
            console.log(`- ${row.name}: set=${row.set_id}→${row.set_name} (${row.series_name})`);
        });
        
        // 4. Contar cartas sin set válido
        const orphanCards = await pool.query(`
            SELECT COUNT(*) as count
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            WHERE s.id IS NULL
        `);
        
        console.log(`\n⚠️ Cartas sin set válido: ${orphanCards.rows[0].count}`);
        
        // 5. Si hay problemas, mostrar sets que faltan
        if (orphanCards.rows[0].count > 0) {
            const missingSets = await pool.query(`
                SELECT DISTINCT c.set_id, COUNT(*) as count
                FROM cards c
                LEFT JOIN sets s ON c.set_id = s.id
                WHERE s.id IS NULL AND c.set_id IS NOT NULL
                GROUP BY c.set_id
                LIMIT 10
            `);
            
            console.log('\n❌ Sets que faltan en la tabla sets:');
            missingSets.rows.forEach(row => {
                console.log(`- ${row.set_id}: ${row.count} cartas huérfanas`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixSetsRelationship();
