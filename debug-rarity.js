require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function debugRarity() {
    try {
        console.log('🔍 Verificando rarezas existentes:');
        const existingRarities = await pool.query('SELECT * FROM rarities ORDER BY id');
        existingRarities.rows.forEach(row => {
            console.log(`- "${row.id}": "${row.name}"`);
        });
        
        console.log('\n🃏 Rarezas que necesitan las cartas:');
        const neededRarities = [
            "Rare Holo",
            "Rare Holo V"
        ];
        
        neededRarities.forEach(rarity => {
            const found = existingRarities.rows.find(row => row.name === rarity);
            console.log(`- "${rarity}": ${found ? '✅ Existe' : '❌ No existe'}`);
            if (found) {
                console.log(`  ID en BD: "${found.id}"`);
            }
        });
        
        console.log('\n🔧 Probando insertar con IDs correctos:');
        // Probar insertar una carta con rarity_id correcto
        const testCard = {
            id: "test-1",
            name: "Test Card",
            rarity_id: "rare-holo" // Usar el ID que existe
        };
        
        try {
            await pool.query(`
                INSERT INTO cards (id, name, rarity_id) 
                VALUES ($1, $2, $3)
                ON CONFLICT (id) DO NOTHING
            `, [testCard.id, testCard.name, testCard.rarity_id]);
            console.log('✅ Test de inserción exitoso');
            
            // Limpiar test
            await pool.query('DELETE FROM cards WHERE id = $1', [testCard.id]);
            console.log('🧹 Test card eliminada');
            
        } catch (error) {
            console.log('❌ Error en test:', error.message);
        }
        
    } catch (error) {
        console.log('Error:', error.message);
    } finally {
        await pool.end();
    }
}

debugRarity();
