require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function fixUndefinedImages() {
    try {
        console.log('🔧 Arreglando imágenes undefined...');
        
        // 1. Encontrar cartas con imágenes undefined
        const undefinedImages = await pool.query(`
            SELECT id, name, set_id, images
            FROM cards 
            WHERE images::text LIKE '%undefined%' OR images::text LIKE '%null%'
            LIMIT 10
        `);
        
        console.log(`📊 Cartas con imágenes undefined: ${undefinedImages.rowCount}`);
        
        // 2. Arreglar cada carta
        for (const card of undefinedImages.rows) {
            const parts = card.id.split('-');
            const setId = parts[0];
            const cardNumber = parts[1];
            
            // Construir URL correcta
            const imageUrl = `https://assets.tcgdex.net/en/${setId}/${cardNumber}`;
            
            // Actualizar con JSON válido
            await pool.query(`
                UPDATE cards 
                SET images = '{"small": "' || $1 || '", "large": "' || $1 || '"}'
                WHERE id = $2
            `, [imageUrl, card.id]);
            
            console.log(`✅ ${card.name}: ${imageUrl}`);
        }
        
        // 3. Arreglar sets específicos que faltan
        console.log('\n🔧 Arreglando sets restantes...');
        
        const remainingSets = await pool.query(`
            SELECT id, name
            FROM sets 
            WHERE series_id IS NULL OR series_id = ''
            LIMIT 10
        `);
        
        console.log(`📦 Sets sin series: ${remainingSets.rowCount}`);
        
        // Mapeo específico para sets restantes
        const setFixes = {
            '2011bw': 'bw',
            '2012bw': 'bw', 
            '2014xy': 'xy',
            '2015xy': 'xy',
            '2016xy': 'xy',
            '2017sm': 'sm',
            '2018sm': 'sm',
            '2019sm': 'sm',
            '2021swsh': 'swsh',
            'A1': 'base'  // Genetic Apex -> Base
        };
        
        for (const set of remainingSets.rows) {
            const seriesId = setFixes[set.id];
            if (seriesId) {
                await pool.query(`
                    UPDATE sets 
                    SET series_id = $1
                    WHERE id = $2
                `, [seriesId, set.id]);
                
                console.log(`✅ ${set.name} -> ${seriesId}`);
            }
        }
        
        // 4. Verificación final completa
        console.log('\n🔍 Verificación final completa...');
        
        // Buscar cartas populares
        const popularCards = await pool.query(`
            SELECT 
                c.id,
                c.name,
                c.images,
                s.name as set_name,
                se.name as series_name,
                s.logo as set_logo,
                s.symbol as set_symbol
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            WHERE c.name ILIKE '%charizard%' OR c.name ILIKE '%pikachu%' OR c.name ILIKE '%bulbasaur%'
            LIMIT 5
        `);
        
        console.log('✅ Cartas populares:');
        popularCards.rows.forEach(card => {
            const images = typeof card.images === 'string' ? JSON.parse(card.images) : card.images;
            console.log(`🃏 ${card.name}:`);
            console.log(`  Set: ${card.set_name} (${card.series_name || 'N/A'})`);
            console.log(`  Imagen: ${images.large || images.small || 'SIN IMAGEN'}`);
            console.log(`  Logo: ${card.set_logo || 'SIN LOGO'}`);
            console.log('');
        });
        
        // 5. Verificar cuántas cartas todavía tienen problemas
        console.log('📊 Estadísticas finales...');
        
        const totalCards = await pool.query('SELECT COUNT(*) as total FROM cards');
        const cardsWithImages = await pool.query('SELECT COUNT(*) as count FROM cards WHERE images IS NOT NULL AND images::text NOT LIKE "%undefined%" AND images::text NOT LIKE "%null%"');
        const cardsWithSeries = await pool.query(`
            SELECT COUNT(*) as count 
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            WHERE se.name IS NOT NULL
        `);
        
        console.log(`📈 Total de cartas: ${totalCards.rows[0].total}`);
        console.log(`🖼️ Cartas con imágenes: ${cardsWithImages.rows[0].count}`);
        console.log(`📚 Cartas con series: ${cardsWithSeries.rows[0].count}`);
        
        const imagePercentage = ((cardsWithImages.rows[0].count / totalCards.rows[0].total) * 100).toFixed(1);
        const seriesPercentage = ((cardsWithSeries.rows[0].count / totalCards.rows[0].total) * 100).toFixed(1);
        
        console.log(`📊 Porcentaje con imágenes: ${imagePercentage}%`);
        console.log(`📊 Porcentaje con series: ${seriesPercentage}%`);
        
        // 6. Probar API real
        console.log('\n🌐 Probando API real...');
        
        try {
            const response = await fetch('http://localhost:3000/api/pokemontcg/cards?q=charizard&page=1&pageSize=2');
            const data = await response.json();
            
            if (data.success && data.data.length > 0) {
                console.log('✅ API funcionando:');
                data.data.forEach(card => {
                    console.log(`🃏 ${card.name}:`);
                    console.log(`  Imagen: ${card.images?.large || card.images?.small || 'SIN IMAGEN'}`);
                    console.log(`  Set: ${card.set?.name} (${card.set?.series || 'N/A'})`);
                    console.log('');
                });
            }
        } catch (apiError) {
            console.log('❌ Error al probar API:', apiError.message);
        }
        
        console.log('\n🎉 ¡Arreglo final completado!');
        console.log('📝 Resumen:');
        console.log(`   - ✅ Imágenes arregladas: ${undefinedImages.rowCount} cartas`);
        console.log(`   - ✅ Sets arreglados: ${remainingSets.rowCount} sets`);
        console.log(`   - ✅ ${imagePercentage}% de cartas con imágenes funcionando`);
        console.log(`   - ✅ ${seriesPercentage}% de cartas con series correctas`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixUndefinedImages();
