const LocalCardDatabase = require('./local-database');

class MigrationStatusChecker {
    constructor() {
        this.db = new LocalCardDatabase();
        this.apiBaseUrl = 'https://api.pokemontcg.io/v2';
    }

    async init() {
        await this.db.init();
    }

    async checkMigrationStatus() {
        try {
            console.log('🔍 Verificando estado de migración...');
            
            // 1. Verificar estado local
            const localStats = await this.db.getStats();
            console.log('\n📊 Estado Local Actual:');
            console.log(`- Cartas: ${localStats.totalCards}`);
            console.log(`- Sets: ${localStats.totalSets}`);
            console.log(`- Tamaño DB: ${localStats.databaseSize}`);
            
            // 2. Verificar estado de la API externa
            console.log('\n🌐 Verificando API Externa...');
            const apiStats = await this.getAPIStats();
            
            // 3. Calcular diferencias
            const cardsMissing = apiStats.totalCards - localStats.totalCards;
            const setsMissing = apiStats.totalSets - localStats.totalSets;
            
            console.log('\n📈 Comparación:');
            console.log(`- Cartas en API: ${apiStats.totalCards}`);
            console.log(`- Cartas locales: ${localStats.totalCards}`);
            console.log(`- Cartas faltantes: ${cardsMissing}`);
            console.log(`- Progreso cartas: ${((localStats.totalCards / apiStats.totalCards) * 100).toFixed(1)}%`);
            
            console.log(`\n- Sets en API: ${apiStats.totalSets}`);
            console.log(`- Sets locales: ${localStats.totalSets}`);
            console.log(`- Sets faltantes: ${setsMissing}`);
            console.log(`- Progreso sets: ${((localStats.totalSets / apiStats.totalSets) * 100).toFixed(1)}%`);
            
            // 4. Recomendaciones
            console.log('\n💡 Recomendaciones:');
            if (cardsMissing > 0) {
                console.log(`⚠️ Faltan ${cardsMissing} cartas por migrar`);
                console.log('   Ejecuta: node js/continue-migration.js');
            } else {
                console.log('✅ Todas las cartas están migradas');
            }
            
            if (setsMissing > 0) {
                console.log(`⚠️ Faltan ${setsMissing} sets por migrar`);
                console.log('   Ejecuta: node js/migrate-real-api.js');
            } else {
                console.log('✅ Todos los sets están migrados');
            }
            
            // 5. Verificar última página migrada
            const lastMigratedPage = await this.getLastMigratedPage();
            console.log(`\n📄 Última página migrada: ${lastMigratedPage}`);
            
        } catch (error) {
            console.error('❌ Error verificando estado:', error);
        }
    }

    async getAPIStats() {
        try {
            // Obtener estadísticas de cartas
            const cardsResponse = await fetch(`${this.apiBaseUrl}/cards?page=1&pageSize=1`);
            const cardsData = await cardsResponse.json();
            const totalCards = cardsData.totalCount || 0;
            
            // Obtener estadísticas de sets
            const setsResponse = await fetch(`${this.apiBaseUrl}/sets?page=1&pageSize=1`);
            const setsData = await setsResponse.json();
            const totalSets = setsData.totalCount || 0;
            
            return {
                totalCards,
                totalSets
            };
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas de API:', error);
            return {
                totalCards: 0,
                totalSets: 0
            };
        }
    }

    async getLastMigratedPage() {
        try {
            // Calcular página basada en cartas migradas
            const localStats = await this.db.getStats();
            const cardsPerPage = 250;
            const lastPage = Math.ceil(localStats.totalCards / cardsPerPage);
            return lastPage;
        } catch (error) {
            return 0;
        }
    }

    async close() {
        await this.db.close();
    }
}

// Si se ejecuta directamente
if (require.main === module) {
    const checker = new MigrationStatusChecker();
    
    checker.init()
        .then(() => checker.checkMigrationStatus())
        .then(() => checker.close())
        .catch(error => {
            console.error('💥 Error fatal:', error);
            process.exit(1);
        });
}

module.exports = MigrationStatusChecker;