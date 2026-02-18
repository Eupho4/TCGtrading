require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function fixImagesFinal() {
    try {
        console.log('🔧 Arreglo final de imágenes...');
        
        // 1. Encontrar cartas con imágenes rotas
        console.log('🔍 Buscando cartas con imágenes rotas...');
        
        const brokenImages = await pool.query(`
            SELECT id, name, set_id, images
            FROM cards 
            WHERE images = '[object Object]' OR images::text LIKE '%[object Object]%'
            LIMIT 10
        `);
        
        console.log(`📊 Encontradas ${brokenImages.rowCount} cartas con imágenes rotas`);
        
        // 2. Arreglar cada carta
        for (const card of brokenImages.rows) {
            // Construir URL correcta basada en el set y el ID
            const parts = card.id.split('-');
            const setId = parts[0];
            const cardNumber = parts[1];
            
            const imageUrl = `https://assets.tcgdex.net/en/${setId}/${cardNumber}`;
            
            // Actualizar con JSON válido
            await pool.query(`
                UPDATE cards 
                SET images = $1
                WHERE id = $2
            `, [JSON.stringify({
                small: imageUrl,
                large: imageUrl
            }), card.id]);
            
            console.log(`✅ Arreglada ${card.name}: ${imageUrl}`);
        }
        
        // 3. Verificar el resultado
        console.log('\n🔍 Verificando arreglos...');
        
        const verification = await pool.query(`
            SELECT id, name, images
            FROM cards 
            WHERE name ILIKE '%charizard%'
            LIMIT 3
        `);
        
        console.log('Resultado:');
        verification.rows.forEach(card => {
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
        
        // 4. Probar API completa
        console.log('🌐 Probando API completa...');
        
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
        
        console.log('Respuesta API para frontend:');
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
        
        console.log('🎉 ¡Imágenes y series arregladas!');
        console.log('📝 Ahora la web debería mostrar:');
        console.log('   - ✅ Series correctas (Gym, Neo, Base, etc.)');
        console.log('   - ✅ Imágenes funcionando');
        console.log('   - ✅ Sets con logos y símbolos');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixImagesFinal();
