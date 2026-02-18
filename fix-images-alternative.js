require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function fixImagesAlternative() {
    try {
        console.log('🔧 Arreglo alternativo de imágenes...');
        
        // 1. Obtener cartas con imágenes nulas
        const nullImages = await pool.query(`
            SELECT id, name, set_id
            FROM cards 
            WHERE images IS NULL
            LIMIT 5
        `);
        
        console.log(`📊 Cartas con imágenes nulas: ${nullImages.rowCount}`);
        
        // 2. Arreglar con formato directo
        for (const card of nullImages.rows) {
            const parts = card.id.split('-');
            const setId = parts[0];
            const cardNumber = parts[1];
            
            const imageUrl = `https://assets.tcgdex.net/en/${setId}/${cardNumber}`;
            
            // Usar formato JSON directo
            await pool.query(`
                UPDATE cards 
                SET images = '{"small": "' || $1 || '", "large": "' || $1 || '"}'
                WHERE id = $2
            `, [imageUrl, card.id]);
            
            console.log(`✅ ${card.name}: ${imageUrl}`);
        }
        
        // 3. Verificar series N/A restantes
        console.log('\n📚 Verificando series N/A restantes...');
        
        const naCheck = await pool.query(`
            SELECT DISTINCT s.id, s.name, s.series_id
            FROM sets s
            WHERE s.series_id IS NULL OR s.series_id = ''
            LIMIT 10
        `);
        
        console.log(`📦 Sets sin series: ${naCheck.rowCount}`);
        naCheck.rows.forEach(set => {
            console.log(`❌ ${set.name} (${set.id})`);
        });
        
        // 4. Arreglar sets específicos que faltan
        console.log('\n🔧 Arreglando sets específicos...');
        
        const specificFixes = [
            { id: 'southern', series: 'base' },
            { id: 'neo1', series: 'neo' },
            { id: 'neo2', series: 'neo' },
            { id: 'neo3', series: 'neo' },
            { id: 'dc1', series: 'bw' },
            { id: 'xy11', series: 'xy' },
            { id: 'xy12', series: 'xy' },
            { id: 'svp', series: 'sv' }
        ];
        
        for (const fix of specificFixes) {
            await pool.query(`
                UPDATE sets 
                SET series_id = $1
                WHERE id LIKE $2
            `, [fix.series, `%${fix.id}%`]);
            
            console.log(`✅ Set ${fix.id} -> serie ${fix.series}`);
        }
        
        // 5. Verificación final
        console.log('\n🔍 Verificación final...');
        
        const finalTest = await pool.query(`
            SELECT 
                c.id,
                c.name,
                c.images,
                s.name as set_name,
                se.name as series_name
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            WHERE c.name ILIKE '%charizard%' OR c.name ILIKE '%pikachu%'
            LIMIT 3
        `);
        
        console.log('✅ Resultado final:');
        finalTest.rows.forEach(card => {
            const images = typeof card.images === 'string' ? JSON.parse(card.images) : card.images;
            console.log(`🃏 ${card.name}:`);
            console.log(`  Set: ${card.set_name} (${card.series_name || 'N/A'})`);
            console.log(`  Imagen: ${images.large || images.small}`);
            console.log('');
        });
        
        // 6. Probar API
        console.log('🌐 Probando API...');
        
        const apiResult = await pool.query(`
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
            LIMIT 1
        `);
        
        const card = apiResult.rows[0];
        if (card) {
            const images = typeof card.images === 'string' ? JSON.parse(card.images) : card.images;
            console.log(`🎴 Ejemplo API:`);
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

fixImagesAlternative();
