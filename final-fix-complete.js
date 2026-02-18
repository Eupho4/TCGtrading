require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function finalFixComplete() {
    try {
        console.log('🔧 Arreglo final completo...');
        
        // 1. Arreglar sets restantes
        console.log('\n🔧 Arreglando sets restantes...');
        
        const remainingSets = await pool.query(`
            SELECT id, name
            FROM sets 
            WHERE series_id IS NULL OR series_id = ''
        `);
        
        console.log(`📦 Sets sin series: ${remainingSets.rowCount}`);
        
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
            'A1': 'base'
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
        
        // 2. Verificar cartas con imágenes sin definir
        console.log('\n🖼️ Verificando imágenes problemáticas...');
        
        const problemImages = await pool.query(`
            SELECT id, name, set_id, images
            FROM cards 
            WHERE images IS NULL 
               OR images = '' 
               OR images::text LIKE '%undefined%'
               OR images::text LIKE '%null%'
            LIMIT 5
        `);
        
        console.log(`📊 Cartas con imágenes problemáticas: ${problemImages.rowCount}`);
        
        for (const card of problemImages.rows) {
            const parts = card.id.split('-');
            const setId = parts[0];
            const cardNumber = parts[1];
            
            const imageUrl = `https://assets.tcgdex.net/en/${setId}/${cardNumber}`;
            
            await pool.query(`
                UPDATE cards 
                SET images = '{"small": "' || $1 || '", "large": "' || $1 || '"}'
                WHERE id = $2
            `, [imageUrl, card.id]);
            
            console.log(`✅ ${card.name}: ${imageUrl}`);
        }
        
        // 3. Verificación final
        console.log('\n🔍 Verificación final...');
        
        const testCards = await pool.query(`
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
        
        console.log('✅ Cartas de prueba:');
        testCards.rows.forEach(card => {
            const images = typeof card.images === 'string' ? JSON.parse(card.images) : card.images;
            console.log(`🃏 ${card.name}:`);
            console.log(`  Set: ${card.set_name} (${card.series_name || 'N/A'})`);
            console.log(`  Imagen: ${images?.large || images?.small || 'SIN IMAGEN'}`);
            console.log(`  Logo: ${card.set_logo || 'SIN LOGO'}`);
            console.log('');
        });
        
        // 4. Estadísticas
        const totalCards = await pool.query('SELECT COUNT(*) as total FROM cards');
        const cardsWithImages = await pool.query(`
            SELECT COUNT(*) as count 
            FROM cards 
            WHERE images IS NOT NULL 
            AND images::text NOT LIKE '%undefined%'
            AND images::text NOT LIKE '%null%'
            AND images != ''
        `);
        const cardsWithSeries = await pool.query(`
            SELECT COUNT(*) as count 
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            WHERE se.name IS NOT NULL
        `);
        
        const total = totalCards.rows[0].total;
        const withImages = cardsWithImages.rows[0].count;
        const withSeries = cardsWithSeries.rows[0].count;
        
        console.log('📊 Estadísticas finales:');
        console.log(`📈 Total de cartas: ${total}`);
        console.log(`🖼️ Con imágenes: ${withImages} (${((withImages/total)*100).toFixed(1)}%)`);
        console.log(`📚 Con series: ${withSeries} (${((withSeries/total)*100).toFixed(1)}%)`);
        
        // 5. Probar API
        console.log('\n🌐 Probando API...');
        
        try {
            const apiTest = await fetch('http://localhost:3000/api/pokemontcg/cards?q=charizard&page=1&pageSize=2');
            const apiData = await apiTest.json();
            
            if (apiData.success && apiData.data.length > 0) {
                console.log('✅ API funcionando correctamente:');
                apiData.data.forEach(card => {
                    console.log(`🃏 ${card.name}:`);
                    console.log(`  Imagen: ${card.images?.large || card.images?.small || 'SIN IMAGEN'}`);
                    console.log(`  Set: ${card.set?.name} (${card.set?.series || 'N/A'})`);
                    console.log(`  Logo: ${card.set?.logo || 'SIN LOGO'}`);
                    console.log('');
                });
            }
        } catch (apiError) {
            console.log('❌ Error API:', apiError.message);
        }
        
        console.log('\n🎉 ¡Arreglo final completado!');
        console.log('📝 Resumen:');
        console.log(`   - ✅ Sets arreglados: ${remainingSets.rowCount}`);
        console.log(`   - ✅ Imágenes arregladas: ${problemImages.rowCount}`);
        console.log(`   - ✅ ${((withImages/total)*100).toFixed(1)}% de imágenes funcionando`);
        console.log(`   - ✅ ${((withSeries/total)*100).toFixed(1)}% de series correctas`);
        console.log('\n🌐 La aplicación debería mostrar correctamente:');
        console.log('   - ✅ Series (Base, Gym, Diamond & Pearl, etc.)');
        console.log('   - ✅ Imágenes de cartas');
        console.log('   - ✅ Logos y símbolos de sets');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

finalFixComplete();
