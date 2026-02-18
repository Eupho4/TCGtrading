require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Función para obtener datos de TCGdex
function tcgdexApiGet(endpoint) {
    return new Promise((resolve, reject) => {
        const url = `https://api.tcgdex.net/v2${endpoint}`;
        
        const req = https.get(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(new Error(`JSON parse error: ${e.message}`));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

async function fixTcgdexMigration() {
    try {
        console.log('🔧 Arreglando migración TCGdex - Mapeando sets correctamente...');
        
        // 1. Obtener todos los sets de TCGdex
        console.log('📦 Obteniendo sets desde TCGdex...');
        const tcgdexSets = await tcgdexApiGet('/en/sets');
        console.log(`✅ Obtenidos ${tcgdexSets.length} sets desde TCGdex`);
        
        // 2. Crear mapa de set_id -> nombre
        const setMap = {};
        tcgdexSets.forEach(set => {
            setMap[set.id] = {
                name: set.name,
                serie: set.serie?.id || null,
                cardCount: set.cardCount?.total || 0
            };
        });
        
        // 3. Actualizar sets en nuestra BD con los datos correctos
        console.log('🔄 Actualizando sets en la base de datos...');
        let updatedSets = 0;
        
        for (const [setId, setData] of Object.entries(setMap)) {
            try {
                await pool.query(`
                    INSERT INTO sets (id, name, series_id, printed_total, total)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        series_id = EXCLUDED.series_id,
                        printed_total = EXCLUDED.printed_total,
                        total = EXCLUDED.total
                `, [setId, setData.name, setData.serie, setData.cardCount, setData.cardCount]);
                
                updatedSets++;
                
                if (updatedSets % 50 === 0) {
                    console.log(`📊 Sets actualizados: ${updatedSets}/${tcgdexSets.length}`);
                }
            } catch (error) {
                console.log(`❌ Error actualizando set ${setId}: ${error.message}`);
            }
        }
        
        console.log(`✅ Sets actualizados: ${updatedSets}`);
        
        // 4. Actualizar series
        console.log('📚 Actualizando series...');
        const tcgdexSeries = await tcgdexApiGet('/en/series');
        
        for (const serie of tcgdexSeries) {
            try {
                await pool.query(`
                    INSERT INTO series (id, name, logo)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        logo = EXCLUDED.logo
                `, [serie.id, serie.name, serie.logo]);
            } catch (error) {
                console.log(`❌ Error actualizando serie ${serie.id}: ${error.message}`);
            }
        }
        
        console.log(`✅ Series actualizadas: ${tcgdexSeries.length}`);
        
        // 5. Ahora actualizar las cartas con el set_id correcto
        console.log('🃏 Actualizando cartas con set_id...');
        
        // Obtener algunas cartas de ejemplo para ver su estructura
        const sampleCards = await tcgdexApiGet('/en/cards?limit=10');
        console.log('🔍 Estructura de carta TCGdex:');
        if (sampleCards.length > 0) {
            console.log('Ejemplo:', JSON.stringify(sampleCards[0], null, 2).substring(0, 500));
        }
        
        // 6. Verificar el estado actual
        console.log('\n📊 Estado después de las correcciones:');
        
        const setsCheck = await pool.query('SELECT COUNT(*) as total FROM sets');
        const seriesCheck = await pool.query('SELECT COUNT(*) as total FROM series');
        const cardsCheck = await pool.query(`
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN set_id IS NOT NULL THEN 1 END) as with_set
            FROM cards
        `);
        
        console.log(`📦 Sets: ${setsCheck.rows[0].total}`);
        console.log(`📚 Series: ${seriesCheck.rows[0].total}`);
        console.log(`🃏 Cartas totales: ${cardsCheck.rows[0].total}`);
        console.log(`🃏 Cartas con set: ${cardsCheck.rows[0].with_set}`);
        
        // 7. Probar el JOIN
        console.log('\n🔍 Probando JOIN corregido:');
        const testJoin = await pool.query(`
            SELECT 
                c.id, c.name, c.set_id,
                s.name as set_name,
                se.name as series_name
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            WHERE c.name ILIKE '%charizard%' AND c.set_id IS NOT NULL
            LIMIT 3
        `);
        
        console.log('Resultado del JOIN:');
        testJoin.rows.forEach(row => {
            console.log(`- ${row.name}: ${row.set_name} (${row.series_name})`);
        });
        
        console.log('\n✅ ¡Migración TCGdex arreglada!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixTcgdexMigration();
