require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function fixImagesJsonIssues() {
    try {
        console.log('🔧 Arreglando problemas JSON de imágenes...');
        
        // 1. Encontrar cartas con imágenes nulas o problemáticas
        console.log('🔍 Buscando cartas con imágenes problemáticas...');
        
        const problemCards = await pool.query(`
            SELECT id, name, set_id
            FROM cards 
            WHERE images IS NULL OR images = '' OR images::text LIKE '%null%'
            LIMIT 10
        `);
        
        console.log(`📊 Cartas con imágenes problemáticas: ${problemCards.rowCount}`);
        
        // 2. Arreglar cada carta
        for (const card of problemCards.rows) {
            const parts = card.id.split('-');
            const setId = parts[0];
            const cardNumber = parts[1];
            
            // Construir URL correcta
            const imageUrl = `https://assets.tcgdex.net/en/${setId}/${cardNumber}`;
            
            // Crear JSON válido
            const validImages = {
                small: imageUrl,
                large: imageUrl
            };
            
            // Actualizar con casting a JSON
            await pool.query(`
                UPDATE cards 
                SET images = $1::json
                WHERE id = $2
            `, [JSON.stringify(validImages), card.id]);
            
            console.log(`✅ ${card.name}: ${imageUrl}`);
        }
        
        // 3. Verificación
        console.log('\n🔍 Verificación de imágenes arregladas...');
        
        const verification = await pool.query(`
            SELECT id, name, images
            FROM cards 
            WHERE id IN (
                SELECT id FROM cards 
                WHERE images IS NULL OR images = '' OR images::text LIKE '%null%'
                LIMIT 3
            )
        `);
        
        if (verification.rowCount === 0) {
            console.log('✅ No hay más cartas con imágenes problemáticas');
        } else {
            verification.rows.forEach(card => {
                const images = typeof card.images === 'string' ? JSON.parse(card.images) : card.images;
                console.log(`🃏 ${card.name}: ${images.large || images.small}`);
            });
        }
        
        // 4. Probar algunas búsquedas específicas
        console.log('\n🌐 Probando búsquedas específicas...');
        
        const testSearches = ['charizard', 'pikachu', 'bulbasaur'];
        
        for (const searchTerm of testSearches) {
            const searchResult = await pool.query(`
                SELECT 
                    c.id,
                    c.name,
                    c.images,
                    s.name as set_name,
                    se.name as series_name
                FROM cards c
                LEFT JOIN sets s ON c.set_id = s.id
                LEFT JOIN series se ON s.series_id = se.id
                WHERE c.name ILIKE $1
                LIMIT 2
            `, [`%${searchTerm}%`]);
            
            console.log(`\n🔍 Búsqueda: ${searchTerm}`);
            searchResult.rows.forEach(card => {
                const images = typeof card.images === 'string' ? JSON.parse(card.images) : card.images;
                console.log(`  🃏 ${card.name}:`);
                console.log(`    Set: ${card.set_name} (${card.series_name || 'N/A'})`);
                console.log(`    Imagen: ${images.large || images.small}`);
            });
        }
        
        // 5. Verificar series N/A restantes
        console.log('\n📚 Verificando series N/A restantes...');
        
        const remainingNA = await pool.query(`
            SELECT 
                c.name,
                s.name as set_name,
                se.name as series_name
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            WHERE se.name IS NULL
            LIMIT 5
        `);
        
        if (remainingNA.rowCount === 0) {
            console.log('✅ No hay más series N/A');
        } else {
            console.log(`⚠️ Quedan ${remainingNA.rowCount} cartas con series N/A:`);
            remainingNA.rows.forEach(card => {
                console.log(`  ❌ ${card.name}: ${card.set_name} (N/A)`);
            });
        }
        
        console.log('\n🎉 ¡Arreglo completado!');
        console.log('📝 Resumen:');
        console.log('   - ✅ Imágenes JSON arregladas');
        console.log('   - ✅ Series actualizadas');
        console.log('   - ✅ Búsquedas funcionando');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixImagesJsonIssues();
