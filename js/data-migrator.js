const LocalCardDatabase = require('./local-database');

class DataMigrator {
    constructor() {
        this.db = new LocalCardDatabase();
        this.isMigrating = false;
        this.migrationProgress = {
            totalCards: 0,
            processedCards: 0,
            totalSets: 0,
            processedSets: 0,
            currentOperation: '',
            startTime: null,
            estimatedTime: null
        };
    }

    // Inicializar migrador
    async init() {
        await this.db.init();
        console.log('🚀 Migrador de datos inicializado');
    }

    // Migrar todas las cartas desde la API externa
    async migrateAllCards() {
        if (this.isMigrating) {
            throw new Error('Ya hay una migración en curso');
        }

        this.isMigrating = true;
        this.migrationProgress.startTime = Date.now();
        this.migrationProgress.currentOperation = 'Iniciando migración...';

        try {
            console.log('🔄 Iniciando migración completa de cartas...');
            
            // 1. Migrar sets primero
            await this.migrateSets();
            
            // 2. Migrar cartas
            await this.migrateCards();
            
            // 3. Crear índices de búsqueda
            await this.createSearchIndexes();
            
            console.log('✅ Migración completada exitosamente');
            
        } catch (error) {
            console.error('❌ Error en migración:', error);
            throw error;
        } finally {
            this.isMigrating = false;
        }
    }

    // Migrar sets desde la API
    async migrateSets() {
        try {
            this.migrationProgress.currentOperation = 'Migrando sets...';
            console.log('📚 Migrando sets...');

            // Obtener sets desde la API externa
            const sets = await this.fetchSetsFromAPI();
            this.migrationProgress.totalSets = sets.length;

            for (let i = 0; i < sets.length; i++) {
                const set = sets[i];
                this.migrationProgress.processedSets = i + 1;
                
                try {
                    await this.saveSet(set);
                    
                    // Mostrar progreso cada 10 sets
                    if ((i + 1) % 10 === 0) {
                        const progress = ((i + 1) / sets.length * 100).toFixed(1);
                        console.log(`📚 Sets: ${i + 1}/${sets.length} (${progress}%)`);
                    }
                    
                    // Delay respetuoso para no sobrecargar la API
                    await this.delay(100);
                    
                } catch (error) {
                    console.error(`❌ Error migrando set ${set.name}:`, error);
                }
            }

            console.log(`✅ ${sets.length} sets migrados correctamente`);
            
        } catch (error) {
            console.error('❌ Error migrando sets:', error);
            throw error;
        }
    }

    // Migrar cartas desde la API
    async migrateCards() {
        try {
            this.migrationProgress.currentOperation = 'Migrando cartas...';
            console.log('🎴 Migrando cartas...');

            // Obtener cartas desde la API externa
            const cards = await this.fetchCardsFromAPI();
            this.migrationProgress.totalCards = cards.length;

            // Procesar cartas en lotes para mejor rendimiento
            const batchSize = 50;
            const totalBatches = Math.ceil(cards.length / batchSize);

            for (let batch = 0; batch < totalBatches; batch++) {
                const start = batch * batchSize;
                const end = Math.min(start + batchSize, cards.length);
                const batchCards = cards.slice(start, end);

                this.migrationProgress.currentOperation = `Procesando lote ${batch + 1}/${totalBatches}`;
                this.migrationProgress.processedCards = end;

                // Procesar lote de cartas
                await this.processCardBatch(batchCards);

                // Mostrar progreso
                const progress = (end / cards.length * 100).toFixed(1);
                console.log(`🎴 Cartas: ${end}/${cards.length} (${progress}%) - Lote ${batch + 1}/${totalBatches}`);

                // Delay respetuoso entre lotes
                await this.delay(500);
            }

            console.log(`✅ ${cards.length} cartas migradas correctamente`);
            
        } catch (error) {
            console.error('❌ Error migrando cartas:', error);
            throw error;
        }
    }

    // Procesar lote de cartas
    async processCardBatch(cards) {
        const promises = cards.map(card => this.saveCard(card));
        await Promise.allSettled(promises);
    }

    // Obtener sets desde la API externa
    async fetchSetsFromAPI() {
        try {
            console.log('🌐 Obteniendo sets desde API externa...');
            
            // Hacer petición a la API de sets
            const response = await fetch('/api/pokemontcg/sets');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return data.data || [];
            
        } catch (error) {
            console.error('❌ Error obteniendo sets desde API:', error);
            // Fallback: crear sets básicos
            return this.createBasicSets();
        }
    }

    // Obtener cartas desde la API externa
    async fetchCardsFromAPI() {
        try {
            console.log('🌐 Obteniendo cartas desde API externa...');
            
            // Hacer petición a la API de cartas (con límite alto)
            const response = await fetch('/api/pokemontcg/cards?pageSize=1000');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return data.data || [];
            
        } catch (error) {
            console.error('❌ Error obteniendo cartas desde API:', error);
            throw error;
        }
    }

    // Crear sets básicos como fallback
    createBasicSets() {
        return [
            { id: 'base1', name: 'Base Set', series: 'Base' },
            { id: 'base2', name: 'Jungle', series: 'Base' },
            { id: 'base3', name: 'Fossil', series: 'Base' },
            { id: 'base4', name: 'Base Set 2', series: 'Base' },
            { id: 'gym1', name: 'Gym Heroes', series: 'Gym' },
            { id: 'gym2', name: 'Gym Challenge', series: 'Gym' }
        ];
    }

    // Guardar set en la base de datos local
    async saveSet(set) {
        try {
            const setData = {
                id: set.id,
                name: set.name,
                series: set.series || 'Unknown',
                printed_total: set.printed_total || 0,
                total: set.total || 0,
                legalities: JSON.stringify(set.legalities || {}),
                ptcgo_code: set.ptcgo_code || '',
                release_date: set.release_date || '',
                updated_at: set.updated_at || new Date().toISOString(),
                images: JSON.stringify(set.images || {})
            };

            await this.db.run(`
                INSERT OR REPLACE INTO sets 
                (id, name, series, printed_total, total, legalities, ptcgo_code, release_date, updated_at, images)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, Object.values(setData));

        } catch (error) {
            console.error(`❌ Error guardando set ${set.name}:`, error);
            throw error;
        }
    }

    // Guardar carta en la base de datos local
    async saveCard(card) {
        try {
            const cardData = {
                id: card.id,
                name: card.name,
                set_name: card.set?.name || 'Unknown',
                series: card.set?.series || 'Unknown',
                number: card.number || '',
                rarity: card.rarity || '',
                types: (card.types || []).join(','),
                images: JSON.stringify(card.images || {}),
                last_updated: new Date().toISOString()
            };

            await this.db.run(`
                INSERT OR REPLACE INTO cards 
                (id, name, set_name, series, number, rarity, types, images, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, Object.values(cardData));

        } catch (error) {
            console.error(`❌ Error guardando carta ${card.name}:`, error);
            throw error;
        }
    }

    // Crear índices de búsqueda optimizados
    async createSearchIndexes() {
        try {
            this.migrationProgress.currentOperation = 'Creando índices de búsqueda...';
            console.log('🔍 Creando índices de búsqueda...');

            // Crear índice de texto completo para búsquedas rápidas
            await this.db.run(`
                CREATE INDEX IF NOT EXISTS idx_cards_search 
                ON cards(name, set_name, series, number)
            `);

            // Crear índice para búsquedas por tipo
            await this.db.run(`
                CREATE INDEX IF NOT EXISTS idx_cards_types_search 
                ON cards(types)
            `);

            console.log('✅ Índices de búsqueda creados correctamente');
            
        } catch (error) {
            console.error('❌ Error creando índices de búsqueda:', error);
            throw error;
        }
    }

    // Obtener progreso de la migración
    getMigrationProgress() {
        if (!this.isMigrating) {
            return { status: 'idle' };
        }

        const elapsed = Date.now() - this.migrationProgress.startTime;
        const cardsProgress = this.migrationProgress.totalCards > 0 
            ? (this.migrationProgress.processedCards / this.migrationProgress.totalCards * 100).toFixed(1)
            : 0;
        
        const setsProgress = this.migrationProgress.totalSets > 0
            ? (this.migrationProgress.processedSets / this.migrationProgress.totalSets * 100).toFixed(1)
            : 0;

        return {
            status: 'migrating',
            currentOperation: this.migrationProgress.currentOperation,
            cards: {
                processed: this.migrationProgress.processedCards,
                total: this.migrationProgress.totalCards,
                progress: cardsProgress
            },
            sets: {
                processed: this.migrationProgress.processedSets,
                total: this.migrationProgress.totalSets,
                progress: setsProgress
            },
            elapsed: this.formatTime(elapsed),
            estimated: this.estimateRemainingTime()
        };
    }

    // Estimar tiempo restante
    estimateRemainingTime() {
        if (this.migrationProgress.processedCards === 0) return 'Calculando...';
        
        const elapsed = Date.now() - this.migrationProgress.startTime;
        const cardsPerMs = this.migrationProgress.processedCards / elapsed;
        const remainingCards = this.migrationProgress.totalCards - this.migrationProgress.processedCards;
        const remainingMs = remainingCards / cardsPerMs;
        
        return this.formatTime(remainingMs);
    }

    // Formatear tiempo en formato legible
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Delay para no sobrecargar APIs
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Verificar si la migración está en curso
    isMigrationInProgress() {
        return this.isMigrating;
    }

    // Detener migración
    async stopMigration() {
        if (this.isMigrating) {
            this.isMigrating = false;
            console.log('⏹️ Migración detenida por el usuario');
        }
    }

    // Cerrar migrador
    async close() {
        await this.stopMigration();
        await this.db.close();
    }
}

// Exportar la clase
module.exports = DataMigrator;

// Si se ejecuta directamente, ejecutar migración de prueba
if (require.main === module) {
    (async () => {
        try {
            const migrator = new DataMigrator();
            await migrator.init();
            
            console.log('🚀 Iniciando migración de prueba...');
            await migrator.migrateAllCards();
            
            const stats = await migrator.db.getStats();
            console.log('📊 Estadísticas finales:');
            console.log(stats);
            
            await migrator.close();
        } catch (error) {
            console.error('❌ Error en migración de prueba:', error);
        }
    })();
}