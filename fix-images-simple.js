require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function fixImagesSimple() {
    try {
        console.log('🔧 Arreglo simple de imágenes...');
        
        // 1. Obtener cartas Charizard como ejemplo
        const charizardCards = await pool.query(`
            SELECT id, name, set_id, images
            FROM cards 
            WHERE name ILIKE '%charizard%'
            LIMIT 3
        `);
        
        console.log('Arreglando cartas Charizard:');
        
        for (const card of charizardCards.rows) {
            // Construir URL basada en el ID de la carta
            const parts = card.id.split('-');
            const setId = parts[0];
            const cardNumber = parts[1];
            
            const imageUrl = `https://assets.tcgdex.net/en/${setId}/${cardNumber}`;
            
            // Crear JSON válido
            const validImages = {
                small: imageUrl,
                large: imageUrl
            };
            
            // Actualizar directamente
            await pool.query(`
                UPDATE cards 
                SET images = $1
                WHERE id = $2
            `, [JSON.stringify(validImages), card.id]);
            
            console.log(`✅ ${card.name}: ${imageUrl}`);
        }
        
        // 2. Verificar resultado
        console.log('\n🔍 Verificación:');
        
        const verification = await pool.query(`
            SELECT id, name, images
            FROM cards 
            WHERE name ILIKE '%charizard%'
            LIMIT 3
        `);
        
        verification.rows.forEach(card => {
            try {
                const images = JSON.parse(card.images);
                console.log(`🃏 ${card.name}:`);
                console.log(`  Small: ${images.small}`);
                console.log(`  Large: ${images.large}`);
                console.log('');
            } catch (e) {
                console.log(`❌ Error: ${card.images}`);
            }
        });
        
        // 3. Probar API
        console.log('🌐 Probando API:');
        
        const apiResult = await pool.query(`
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
            LIMIT 1
        `);
        
        const card = apiResult.rows[0];
        if (card) {
            const images = JSON.parse(card.images);
            console.log(`🎴 Ejemplo para frontend:`);
            console.log(`  Nombre: ${card.name}`);
            console.log(`  Imagen: ${images.large}`);
            console.log(`  Set: ${card.set_name} (${card.series_name})`);
            console.log(`  Logo: ${card.set_logo}`);
        }
        
        console.log('\n🎉 ¡Arreglo completado!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixImagesSimple();
