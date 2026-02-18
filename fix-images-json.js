require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function fixImagesJson() {
    try {
        console.log('🔧 Arreglando JSON de imágenes...');
        
        // 1. Verificar el problema
        console.log('🔍 Analizando problema de JSON...');
        
        const problematicCards = await pool.query(`
            SELECT id, name, images
            FROM cards 
            WHERE name ILIKE '%charizard%'
            LIMIT 3
        `);
        
        console.log('Cartas con problemas:');
        problematicCards.rows.forEach(card => {
            console.log(`🃏 ${card.name} (${card.id}):`);
            console.log(`  Images (raw): ${card.images}`);
            console.log(`  Images type: ${typeof card.images}`);
            
            // Intentar parsear
            try {
                if (typeof card.images === 'string') {
                    const parsed = JSON.parse(card.images);
                    console.log(`  ✅ Parse OK: ${parsed.small || 'N/A'}`);
                } else if (typeof card.images === 'object') {
                    console.log(`  ✅ Already object: ${card.images.small || 'N/A'}`);
                } else {
                    console.log(`  ❌ Invalid type: ${typeof card.images}`);
                }
            } catch (e) {
                console.log(`  ❌ Parse error: ${e.message}`);
            }
            console.log('');
        });
        
        // 2. Arreglar las imágenes que tienen "[object Object]"
        console.log('🔧 Arreglando imágenes con "[object Object]"...');
        
        const updateResult = await pool.query(`
            UPDATE cards 
            SET images = '{"small": null, "large": null}'
            WHERE images = '[object Object]' OR images = '[object Object]'
            RETURNING id, name
        `);
        
        console.log(`✅ Actualizadas ${updateResult.rowCount} cartas`);
        
        // 3. Verificar algunas cartas específicas y arreglarlas manualmente
        console.log('🔧 Arreglando cartas específicas...');
        
        // Obtener algunas cartas de ejemplo con sus IDs correctos
        const specificCards = await pool.query(`
            SELECT id, name, set_id
            FROM cards 
            WHERE name ILIKE '%charizard%'
            LIMIT 3
        `);
        
        for (const card of specificCards.rows) {
            // Construir URLs de imágenes basadas en el set_id y número
            const imageUrl = `https://assets.tcgdex.net/en/${card.set_id}/${card.id}`;
            
            await pool.query(`
                UPDATE cards 
                SET images = $1
                WHERE id = $2
            `, [JSON.stringify({
                small: imageUrl,
                large: imageUrl
            }), card.id]);
            
            console.log(`✅ Actualizada ${card.name}: ${imageUrl}`);
        }
        
        // 4. Verificación final
        console.log('\n🔍 Verificación final:');
        
        const finalCheck = await pool.query(`
            SELECT id, name, images
            FROM cards 
            WHERE name ILIKE '%charizard%'
            LIMIT 3
        `);
        
        console.log('Resultado final:');
        finalCheck.rows.forEach(card => {
            try {
                const images = typeof card.images === 'string' ? JSON.parse(card.images) : card.images;
                console.log(`🃏 ${card.name}:`);
                console.log(`  Small: ${images.small}`);
                console.log(`  Large: ${images.large}`);
                console.log('');
            } catch (e) {
                console.log(`❌ Error con ${card.name}: ${e.message}`);
            }
        });
        
        // 5. Probar respuesta de API
        console.log('🌐 Probando respuesta de API...');
        
        const apiTest = await pool.query(`
            SELECT 
                c.id,
                c.name,
                c.number,
                c.hp,
                c.types,
                c.rarity_id as rarity,
                c.images,
                c.artist,
                c.set_id,
                s.name as set_name,
                s.series_id,
                se.name as series_name,
                s.logo as set_logo,
                s.symbol as set_symbol
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            WHERE c.name ILIKE '%charizard%'
            LIMIT 2
        `);
        
        console.log('Respuesta para frontend:');
        apiTest.rows.forEach(card => {
            const images = typeof card.images === 'string' ? JSON.parse(card.images) : card.images;
            const formattedCard = {
                id: card.id,
                name: card.name,
                number: card.number,
                hp: card.hp,
                types: card.types,
                rarity: card.rarity,
                image: images.large || images.small,
                images: images,
                artist: card.artist,
                set: {
                    id: card.set_id,
                    name: card.set_name,
                    series: card.series_name,
                    logo: card.set_logo,
                    symbol: card.set_symbol
                }
            };
            
            console.log(`🎴 ${formattedCard.name}:`);
            console.log(`  ✅ Imagen: ${formattedCard.image}`);
            console.log(`  ✅ Set: ${formattedCard.set.name} (${formattedCard.set.series})`);
            console.log(`  ✅ Logo: ${formattedCard.set.logo}`);
            console.log('');
        });
        
        console.log('🎉 ¡Imágenes arregladas!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixImagesJson();
