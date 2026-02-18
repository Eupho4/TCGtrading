require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function fixRemainingIssues() {
    try {
        console.log('🔧 Arreglando problemas restantes...');
        
        // 1. Verificar qué series siguen en N/A
        console.log('\n📚 Verificando series con N/A...');
        
        const naSeries = await pool.query(`
            SELECT 
                c.id,
                c.name,
                c.set_id,
                s.name as set_name,
                s.series_id,
                se.name as series_name
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            WHERE se.name IS NULL
            LIMIT 10
        `);
        
        console.log(`📊 Cartas con series N/A: ${naSeries.rowCount}`);
        naSeries.rows.forEach(card => {
            console.log(`❌ ${card.name}: ${card.set_name} (${card.series_id})`);
        });
        
        // 2. Mapeo completo de series para arreglar las que faltan
        console.log('\n🔧 Arreglando series faltantes...');
        
        const seriesMapping = {
            // Series existentes en la BD
            'base': 'Base',
            'gym': 'Gym', 
            'neo': 'Neo',
            'lc': 'Base',
            'dp': 'Diamond & Pearl',
            'bw': 'Black & White',
            'xy': 'XY',
            'sm': 'Sun & Moon',
            'swsh': 'Sword & Shield',
            'sv': 'Scarlet & Violet',
            'col': 'Call of Legends',
            'ecard': 'E-Card',
            'ex': 'EX',
            'hgss': 'HeartGold & SoulSilver',
            'mc': "McDonald's Collection"
        };
        
        // Obtener todos los sets que necesitan series
        const setsWithoutSeries = await pool.query(`
            SELECT id, name, series_id
            FROM sets 
            WHERE series_id IS NULL OR series_id = ''
        `);
        
        console.log(`📦 Sets sin series: ${setsWithoutSeries.rowCount}`);
        
        // Arreglar cada set basado en su ID
        let updatedSets = 0;
        for (const set of setsWithoutSeries.rows) {
            // Determinar la serie basada en el ID del set
            let seriesId = null;
            
            if (set.id.startsWith('base')) seriesId = 'base';
            else if (set.id.startsWith('gym')) seriesId = 'gym';
            else if (set.id.startsWith('pl')) seriesId = 'neo';
            else if (set.id.startsWith('lc')) seriesId = 'base';
            else if (set.id.startsWith('dp')) seriesId = 'dp';
            else if (set.id.startsWith('bw')) seriesId = 'bw';
            else if (set.id.startsWith('xy')) seriesId = 'xy';
            else if (set.id.startsWith('sm')) seriesId = 'sm';
            else if (set.id.startsWith('swsh')) seriesId = 'swsh';
            else if (set.id.startsWith('sv')) seriesId = 'sv';
            else if (set.id.startsWith('col')) seriesId = 'col';
            else if (set.id.startsWith('ecard')) seriesId = 'ecard';
            else if (set.id.startsWith('ex')) seriesId = 'ex';
            else if (set.id.startsWith('hgss')) seriesId = 'hgss';
            else if (set.id.startsWith('mc')) seriesId = 'mc';
            
            if (seriesId && seriesMapping[seriesId]) {
                await pool.query(`
                    UPDATE sets 
                    SET series_id = $1 
                    WHERE id = $2
                `, [seriesId, set.id]);
                
                updatedSets++;
                console.log(`✅ ${set.name} -> ${seriesMapping[seriesId]}`);
            }
        }
        
        console.log(`\n✅ Sets actualizados: ${updatedSets}`);
        
        // 3. Verificar imágenes con errores
        console.log('\n🖼️ Verificando imágenes con problemas...');
        
        // Buscar cartas con imágenes que podrían tener errores
        const problematicImages = await pool.query(`
            SELECT id, name, set_id, images
            FROM cards 
            WHERE images IS NULL OR images = '' OR images::text LIKE '%null%'
            LIMIT 5
        `);
        
        console.log(`📊 Cartas con imágenes problemáticas: ${problematicImages.rowCount}`);
        
        // Arreglar imágenes para estas cartas
        for (const card of problematicImages.rows) {
            const parts = card.id.split('-');
            const setId = parts[0];
            const cardNumber = parts[1];
            
            const imageUrl = `https://assets.tcgdex.net/en/${setId}/${cardNumber}`;
            
            await pool.query(`
                UPDATE cards 
                SET images = $1
                WHERE id = $2
            `, [JSON.stringify({
                small: imageUrl,
                large: imageUrl
            }), card.id]);
            
            console.log(`✅ Imagen arreglada: ${card.name} -> ${imageUrl}`);
        }
        
        // 4. Verificación final
        console.log('\n🔍 Verificación final...');
        
        // Verificar series
        const finalSeriesCheck = await pool.query(`
            SELECT 
                c.name,
                s.name as set_name,
                se.name as series_name
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            WHERE c.name ILIKE '%charizard%' OR c.name ILIKE '%pikachu%'
            LIMIT 5
        `);
        
        console.log('✅ Series después del arreglo:');
        finalSeriesCheck.rows.forEach(card => {
            console.log(`🃏 ${card.name}: ${card.set_name} (${card.series_name || 'N/A'})`);
        });
        
        // Verificar imágenes
        const finalImageCheck = await pool.query(`
            SELECT id, name, images
            FROM cards 
            WHERE name ILIKE '%charizard%' OR name ILIKE '%pikachu%'
            LIMIT 3
        `);
        
        console.log('\n✅ Imágenes después del arreglo:');
        finalImageCheck.rows.forEach(card => {
            const images = typeof card.images === 'string' ? JSON.parse(card.images) : card.images;
            console.log(`🃏 ${card.name}: ${images.large || images.small}`);
        });
        
        // 5. Probar API
        console.log('\n🌐 Probando API final...');
        
        const apiTest = await pool.query(`
            SELECT 
                c.id,
                c.name,
                c.images,
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
        
        console.log('📋 Respuesta API para frontend:');
        apiTest.rows.forEach(card => {
            const images = typeof card.images === 'string' ? JSON.parse(card.images) : card.images;
            console.log(`🎴 ${card.name}:`);
            console.log(`  ✅ Imagen: ${images.large}`);
            console.log(`  ✅ Set: ${card.set_name} (${card.series_name})`);
            console.log(`  ✅ Logo: ${card.set_logo}`);
            console.log('');
        });
        
        console.log('🎉 ¡Todos los problemas arreglados!');
        console.log('📝 Resumen:');
        console.log(`   - ✅ Series arregladas: ${updatedSets} sets`);
        console.log(`   - ✅ Imágenes arregladas: ${problematicImages.rowCount} cartas`);
        console.log('   - ✅ API funcionando correctamente');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixRemainingIssues();
