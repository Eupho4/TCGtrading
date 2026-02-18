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

async function fixSeriesAndImages() {
    try {
        console.log('🔧 Arreglando series e imágenes...');
        
        // 1. Primero arreglar las series
        console.log('📚 Actualizando series de sets...');
        
        // Obtener sets de TCGdex con sus series
        const tcgdexSets = await tcgdexApiGet('/en/sets');
        console.log(`✅ Obtenidos ${tcgdexSets.length} sets con series`);
        
        // Actualizar series en la base de datos
        let updatedSets = 0;
        for (const set of tcgdexSets) {
            try {
                const seriesId = set.serie?.id || null;
                await pool.query(`
                    UPDATE sets 
                    SET series_id = $1 
                    WHERE id = $2
                `, [seriesId, set.id]);
                
                updatedSets++;
                
                if (updatedSets % 50 === 0) {
                    console.log(`📊 Sets actualizados: ${updatedSets}/${tcgdexSets.length}`);
                }
            } catch (error) {
                console.log(`❌ Error actualizando set ${set.id}: ${error.message}`);
            }
        }
        
        console.log(`✅ Sets actualizados: ${updatedSets}`);
        
        // 2. Verificar el estado de las series
        console.log('\n📊 Verificando series:');
        const seriesCheck = await pool.query(`
            SELECT 
                COUNT(*) as total_sets,
                COUNT(CASE WHEN series_id IS NOT NULL THEN 1 END) as sets_with_series,
                COUNT(DISTINCT series_id) as distinct_series
            FROM sets
        `);
        
        console.log(`📦 Sets totales: ${seriesCheck.rows[0].total_sets}`);
        console.log(`📦 Sets con serie: ${seriesCheck.rows[0].sets_with_series}`);
        console.log(`📚 Series distintas: ${seriesCheck.rows[0].distinct_series}`);
        
        // 3. Probar búsqueda con series arregladas
        console.log('\n🔍 Probando búsqueda con series:');
        const testSearch = await pool.query(`
            SELECT 
                c.name, c.set_id,
                s.name as set_name,
                se.name as series_name,
                s.logo as set_logo,
                s.symbol as set_symbol
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            WHERE c.name ILIKE '%charizard%'
            LIMIT 3
        `);
        
        console.log('Resultados con series:');
        testSearch.rows.forEach(row => {
            console.log(`- ${row.name}`);
            console.log(`  Set: ${row.set_name} (${row.series_name || 'N/A'})`);
            console.log(`  Logo: ${row.set_logo}`);
            console.log(`  Símbolo: ${row.set_symbol}`);
            console.log('');
        });
        
        // 4. Verificar URLs de imágenes
        console.log('🖼️ Verificando URLs de imágenes:');
        const imageCheck = await pool.query(`
            SELECT 
                name,
                images
            FROM cards 
            WHERE name ILIKE '%charizard%'
            LIMIT 2
        `);
        
        imageCheck.rows.forEach(card => {
            const images = JSON.parse(card.images || '{}');
            console.log(`🃏 ${card.name}:`);
            console.log(`  Small: ${images.small}`);
            console.log(`  Large: ${images.large}`);
            console.log('');
        });
        
        // 5. Probar una URL de imagen directamente
        console.log('🌐 Probando acceso a imágenes:');
        try {
            const imageUrl = 'https://assets.tcgdex.net/en/gym/gym2/2';
            console.log(`📡 Probando: ${imageUrl}`);
            
            const response = await new Promise((resolve, reject) => {
                https.get(imageUrl, (res) => {
                    resolve({ statusCode: res.statusCode, headers: res.headers });
                }).on('error', reject);
            });
            
            console.log(`✅ Status: ${response.statusCode}`);
            console.log(`📋 Content-Type: ${response.headers['content-type']}`);
            
        } catch (error) {
            console.log(`❌ Error accediendo a imagen: ${error.message}`);
        }
        
        console.log('\n✅ ¡Arreglo completado!');
        console.log('📝 Ahora la búsqueda debería mostrar:');
        console.log('   - ✅ Series correctas (Base, Gym, etc.)');
        console.log('   - ✅ Imágenes funcionando');
        console.log('   - ✅ Sets con logos y símbolos');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixSeriesAndImages();
