const LocalCardDatabase = require('./local-database');

class LiveMigrationMonitor {
    constructor() {
        this.db = new LocalCardDatabase();
        this.lastCardCount = 9528; // Estado actual
        this.lastSetCount = 11;
        this.startTime = new Date();
        this.isMonitoring = true;
    }

    async init() {
        await this.db.init();
    }

    async startLiveMonitoring() {
        console.log('🔍 Iniciando monitoreo EN VIVO de migración...');
        console.log('📊 Presiona Ctrl+C para detener el monitoreo\n');
        
        let iteration = 0;
        
        while (this.isMonitoring) {
            try {
                iteration++;
                const stats = await this.db.getStats();
                const currentTime = new Date();
                const elapsed = Math.floor((currentTime - this.startTime) / 1000);
                
                // Calcular progreso
                const cardsProgress = ((stats.totalCards / 19500) * 100).toFixed(1);
                const setsProgress = ((stats.totalSets / 168) * 100).toFixed(1);
                
                // Calcular velocidad
                const cardsPerSecond = this.lastCardCount > 0 ? 
                    ((stats.totalCards - this.lastCardCount) / 10).toFixed(1) : 0;
                const setsPerSecond = this.lastSetCount > 0 ? 
                    ((stats.totalSets - this.lastSetCount) / 10).toFixed(1) : 0;
                
                // Tiempo estimado restante
                const remainingCards = 19500 - stats.totalCards;
                const remainingSets = 168 - stats.totalSets;
                const etaCards = cardsPerSecond > 0 ? Math.floor(remainingCards / cardsPerSecond) : 0;
                const etaSets = setsPerSecond > 0 ? Math.floor(remainingSets / setsPerSecond) : 0;
                
                // Limpiar pantalla y mostrar estado
                console.clear();
                console.log('🚀 MIGRACIÓN ROBUSTA EN PROGRESO');
                console.log('==================================');
                console.log(`⏱️  Tiempo transcurrido: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
                console.log(`🔄 Iteración: ${iteration}`);
                console.log('');
                console.log('📊 PROGRESO ACTUAL:');
                console.log(`🎴 Cartas: ${stats.totalCards.toLocaleString()} / 19,500 (${cardsProgress}%)`);
                console.log(`📚 Sets: ${stats.totalSets} / 168 (${setsProgress}%)`);
                console.log(`💾 Tamaño DB: ${stats.databaseSize}`);
                console.log('');
                console.log('⚡ VELOCIDAD:');
                console.log(`🎴 Cartas/seg: ${cardsPerSecond}`);
                console.log(`📚 Sets/seg: ${setsPerSecond}`);
                console.log('');
                console.log('⏳ TIEMPO ESTIMADO RESTANTE:');
                console.log(`🎴 Cartas: ${Math.floor(etaCards / 60)}m ${etaCards % 60}s`);
                console.log(`📚 Sets: ${Math.floor(etaSets / 60)}m ${etaSets % 60}s`);
                console.log('');
                console.log('📈 ÚLTIMA ACTUALIZACIÓN:');
                console.log(`🕐 ${stats.lastUpdated}`);
                console.log('');
                console.log('🛡️ MIGRACIÓN ROBUSTA:');
                console.log('   - Manejo de timeouts mejorado');
                console.log('   - Reintentos automáticos');
                console.log('   - Saltado de páginas problemáticas');
                console.log('');
                console.log('💡 Presiona Ctrl+C para detener el monitoreo');
                
                // Actualizar contadores
                this.lastCardCount = stats.totalCards;
                this.lastSetCount = stats.totalSets;
                
                // Verificar si la migración está completa
                if (stats.totalCards >= 19500 && stats.totalSets >= 168) {
                    console.log('\n🎉 ¡MIGRACIÓN COMPLETA FINALIZADA!');
                    console.log('🎯 Objetivo alcanzado: 19,500+ cartas y 168+ sets');
                    break;
                }
                
                // Esperar 10 segundos antes del siguiente check
                await this.delay(10000);
                
            } catch (error) {
                console.error('❌ Error en monitoreo:', error);
                await this.delay(5000);
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async close() {
        this.isMonitoring = false;
        await this.db.close();
    }
}

// Si se ejecuta directamente
if (require.main === module) {
    const monitor = new LiveMigrationMonitor();
    
    // Manejo de señales
    process.on('SIGINT', async () => {
        console.log('\n🛑 Deteniendo monitoreo...');
        await monitor.close();
        process.exit(0);
    });
    
    monitor.init()
        .then(() => monitor.startLiveMonitoring())
        .then(() => monitor.close())
        .catch(error => {
            console.error('💥 Error en monitoreo:', error);
            process.exit(1);
        });
}

module.exports = LiveMigrationMonitor;