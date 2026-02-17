const LocalCardDatabase = require('./local-database');

async function checkDatabaseStatus() {
    const db = new LocalCardDatabase();
    
    try {
        await db.init();
        
        const stats = await db.getStats();
        console.log('📊 Estado actual de la base de datos:');
        console.log(`- Total de cartas: ${stats.totalCards}`);
        console.log(`- Total de sets: ${stats.totalSets}`);
        console.log(`- Tamaño de base de datos: ${stats.databaseSize}`);
        console.log(`- Última actualización: ${stats.lastUpdated}`);
        
        // Verificar algunas cartas de muestra
        const sampleCards = await db.all('SELECT id, name, set_name, rarity FROM cards LIMIT 5');
        console.log('\n🎴 Cartas de muestra:');
        sampleCards.forEach(card => {
            console.log(`- ${card.name} (${card.set_name}) - ${card.rarity}`);
        });
        
        // Verificar sets
        const sets = await db.all('SELECT id, name, series FROM sets LIMIT 5');
        console.log('\n📚 Sets de muestra:');
        sets.forEach(set => {
            console.log(`- ${set.name} (${set.series})`);
        });
        
    } catch (error) {
        console.error('❌ Error verificando base de datos:', error);
    } finally {
        await db.close();
    }
}

checkDatabaseStatus();