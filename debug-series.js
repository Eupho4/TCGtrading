require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function debugSeries() {
    try {
        console.log('🔍 Depurando series...');
        
        // 1. Verificar qué series existen
        console.log('\n📚 Series en la base de datos:');
        const series = await pool.query('SELECT id, name FROM series ORDER BY name LIMIT 10');
        series.rows.forEach(s => {
            console.log(`- ${s.id}: ${s.name}`);
        });
        
        // 2. Verificar sets y sus series_id
        console.log('\n📦 Sets y sus series_id:');
        const sets = await pool.query(`
            SELECT id, name, series_id 
            FROM sets 
            WHERE name LIKE '%Arceus%' OR name LIKE '%Gym%' OR name LIKE '%Legendary%'
            ORDER BY name
        `);
        sets.rows.forEach(set => {
            console.log(`- ${set.id}: ${set.name} -> serie: ${set.series_id}`);
        });
        
        // 3. Verificar el JOIN en la búsqueda
        console.log('\n🔍 Verificando JOIN completo:');
        const search = await pool.query(`
            SELECT 
                c.name,
                c.set_id,
                s.name as set_name,
                s.series_id,
                se.id as series_id_db,
                se.name as series_name
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            WHERE c.name ILIKE '%charizard%'
            LIMIT 3
        `);
        
        search.rows.forEach(row => {
            console.log(`🃏 ${row.name}:`);
            console.log(`  Set: ${row.set_name} (${row.set_id})`);
            console.log(`  Series ID: ${row.series_id} -> ${row.series_name}`);
            console.log('');
        });
        
        // 4. Arreglar series si es necesario
        console.log('🔧 Arreglando referencias de series...');
        
        // Mapeo manual de series basado en los IDs de sets
        const seriesMapping = {
            'base1': 'base',
            'base2': 'base', 
            'gym1': 'gym',
            'gym2': 'gym',
            'pl1': 'neo',
            'pl2': 'neo',
            'pl3': 'neo',
            'pl4': 'neo',
            'lc': 'base',
            'dp1': 'dp',
            'dp2': 'dp',
            'dp3': 'dp',
            'bw1': 'bw',
            'bw2': 'bw',
            'xy1': 'xy',
            'xy2': 'xy',
            'xy3': 'xy',
            'xy4': 'xy',
            'xy5': 'xy',
            'xy6': 'xy',
            'xy7': 'xy',
            'xy8': 'xy',
            'xy9': 'xy',
            'sm1': 'sm',
            'sm2': 'sm',
            'sm3': 'sm',
            'sm4': 'sm',
            'sm5': 'sm',
            'sm6': 'sm',
            'sm7': 'sm',
            'sm8': 'sm',
            'sm9': 'sm',
            'sm10': 'sm',
            'sm11': 'sm',
            'sm12': 'sm',
            'swsh1': 'swsh',
            'swsh2': 'swsh',
            'swsh3': 'swsh',
            'swsh4': 'swsh',
            'swsh5': 'swsh',
            'swsh6': 'swsh',
            'swsh7': 'swsh',
            'swsh8': 'swsh',
            'swsh9': 'swsh',
            'swsh10': 'swsh',
            'swsh11': 'swsh',
            'swsh12': 'swsh',
            'sv1': 'sv',
            'sv2': 'sv',
            'sv3': 'sv',
            'sv3.5': 'sv',
            'sv4': 'sv',
            'sv5': 'sv'
        };
        
        let updated = 0;
        for (const [setId, seriesId] of Object.entries(seriesMapping)) {
            try {
                const result = await pool.query(`
                    UPDATE sets 
                    SET series_id = $1 
                    WHERE id = $2 AND (series_id IS NULL OR series_id != $1)
                `, [seriesId, setId]);
                
                if (result.rowCount > 0) {
                    updated += result.rowCount;
                    console.log(`✅ Actualizado set ${setId} -> serie ${seriesId}`);
                }
            } catch (error) {
                console.log(`❌ Error con ${setId}: ${error.message}`);
            }
        }
        
        console.log(`\n✅ Sets actualizados: ${updated}`);
        
        // 5. Verificar resultado final
        console.log('\n🔍 Verificación final:');
        const finalCheck = await pool.query(`
            SELECT 
                c.name,
                s.name as set_name,
                se.name as series_name
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            WHERE c.name ILIKE '%charizard%'
            LIMIT 3
        `);
        
        console.log('Resultados finales:');
        finalCheck.rows.forEach(row => {
            console.log(`- ${row.name}: ${row.set_name} (${row.series_name || 'N/A'})`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

debugSeries();
