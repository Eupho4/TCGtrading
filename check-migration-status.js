require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkMigrationStatus() {
    try {
        console.log('🔍 Verificando estado actual de la migración...\n');
        
        // Contar cartas
        const cardsResult = await pool.query('SELECT COUNT(*) as total FROM cards');
        const cardsCount = parseInt(cardsResult.rows[0].total);
        
        // Contar sets
        const setsResult = await pool.query('SELECT COUNT(*) as total FROM sets');
        const setsCount = parseInt(setsResult.rows[0].total);
        
        // Contar series
        const seriesResult = await pool.query('SELECT COUNT(*) as total FROM series');
        const seriesCount = parseInt(seriesResult.rows[0].total);
        
        // Contar rarezas
        const raritiesResult = await pool.query('SELECT COUNT(*) as total FROM rarities');
        const raritiesCount = parseInt(raritiesResult.rows[0].total);
        
        // Mostrar estadísticas
        console.log('📊 ESTADÍSTICAS DE MIGRACIÓN:');
        console.log('='.repeat(40));
        console.log(`🃏 Cartas: ${cardsCount.toLocaleString()}`);
        console.log(`📦 Sets: ${setsCount.toLocaleString()}`);
        console.log(`📚 Series: ${seriesCount.toLocaleString()}`);
        console.log(`💎 Rarezas: ${raritiesCount.toLocaleString()}`);
        console.log('='.repeat(40));
        
        // Verificar si está completo
        const expectedCards = 22755; // TCGdex total
        const expectedSets = 200;
        const expectedSeries = 21;
        
        const isComplete = cardsCount >= expectedCards && 
                          setsCount >= expectedSets && 
                          seriesCount >= expectedSeries;
        
        if (isComplete) {
            console.log('\n🎉 ¡MIGRACIÓN COMPLETADA CON ÉXITO!');
            console.log('✅ Todos los datos de TCGdex han sido migrados');
            console.log('🚀 El proyecto está listo para usar');
        } else {
            console.log('\n⚠️ Migración incompleta:');
            console.log(`   - Cartas: ${cardsCount}/${expectedCards}`);
            console.log(`   - Sets: ${setsCount}/${expectedSets}`);
            console.log(`   - Series: ${seriesCount}/${expectedSeries}`);
        }
        
        // Mostrar algunas cartas de ejemplo
        console.log('\n🎴 EJEMPLOS DE CARTAS MIGRADAS:');
        const sampleCards = await pool.query(`
            SELECT id, name, set_id, rarity_id 
            FROM cards 
            ORDER BY name 
            LIMIT 10
        `);
        
        sampleCards.rows.forEach(card => {
            console.log(`   - ${card.name} (${card.id}) - Set: ${card.set_id} - Rareza: ${card.rarity_id}`);
        });
        
        // Verificar sets populares
        console.log('\n📦 SETS MIGRADOS:');
        const sampleSets = await pool.query(`
            SELECT id, name, printed_total 
            FROM sets 
            ORDER BY name 
            LIMIT 10
        `);
        
        sampleSets.rows.forEach(set => {
            console.log(`   - ${set.name} (${set.id}) - ${set.printed_total} cartas`);
        });
        
    } catch (error) {
        console.error('❌ Error verificando migración:', error.message);
    } finally {
        await pool.end();
    }
}

checkMigrationStatus();
