require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function debugImagesRaw() {
    try {
        console.log('🔍 Debug crudo de imágenes...');
        
        const result = await pool.query(`
            SELECT id, name, images
            FROM cards 
            WHERE name ILIKE '%charizard%'
            LIMIT 1
        `);
        
        const card = result.rows[0];
        console.log('📊 Datos crudos:');
        console.log('ID:', card.id);
        console.log('Name:', card.name);
        console.log('Images type:', typeof card.images);
        console.log('Images value:', card.images);
        console.log('Images constructor:', card.images?.constructor?.name);
        
        // Intentar diferentes métodos de acceso
        if (typeof card.images === 'object') {
            console.log('✅ Es objeto');
            console.log('Images.small:', card.images?.small);
            console.log('Images.large:', card.images?.large);
            console.log('JSON.stringify:', JSON.stringify(card.images));
        } else if (typeof card.images === 'string') {
            console.log('📝 Es string');
            try {
                const parsed = JSON.parse(card.images);
                console.log('Parsed.small:', parsed.small);
                console.log('Parsed.large:', parsed.large);
            } catch (e) {
                console.log('❌ Parse error:', e.message);
            }
        }
        
        // Probar actualizar una carta específica
        console.log('\n🔧 Probando actualizar...');
        
        await pool.query(`
            UPDATE cards 
            SET images = '{"small": "https://assets.tcgdex.net/en/pl/pl4/1", "large": "https://assets.tcgdex.net/en/pl/pl4/1"}'
            WHERE id = 'pl4-1'
        `);
        
        console.log('✅ Actualización completada');
        
        // Verificar después de actualizar
        const updated = await pool.query(`
            SELECT id, name, images
            FROM cards 
            WHERE id = 'pl4-1'
        `);
        
        const updatedCard = updated.rows[0];
        console.log('📊 Después de actualizar:');
        console.log('Images type:', typeof updatedCard.images);
        console.log('Images value:', updatedCard.images);
        
        if (typeof updatedCard.images === 'string') {
            const parsed = JSON.parse(updatedCard.images);
            console.log('Parsed.small:', parsed.small);
            console.log('Parsed.large:', parsed.large);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

debugImagesRaw();
