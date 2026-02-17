const LocalCardDatabase = require('./local-database');

class LocalSearchEngine {
    constructor() {
        this.db = new LocalCardDatabase();
        this.searchCache = new Map(); // Cache para resultados de búsqueda
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
        this.isInitialized = false;
    }

    // Inicializar motor de búsqueda
    async init() {
        if (this.isInitialized) return;
        
        try {
            await this.db.init();
            this.isInitialized = true;
            console.log('🔍 Motor de búsqueda local inicializado');
        } catch (error) {
            console.error('❌ Error inicializando motor de búsqueda:', error);
            throw error;
        }
    }

    // Búsqueda principal de cartas
    async searchCards(query, page = 1, pageSize = 20, filters = {}, sort = 'name', direction = 'asc') {
        try {
            await this.ensureInitialized();
            
            // Verificar cache primero
            const cacheKey = this.generateCacheKey(query, page, pageSize, filters, sort, direction);
            const cachedResult = this.getFromCache(cacheKey);
            
            if (cachedResult) {
                console.log('⚡ Resultado obtenido desde cache');
                return cachedResult;
            }

            // Realizar búsqueda en base de datos local
            console.log(`🔍 Búsqueda local: "${query}" - Página ${page} - Orden: ${sort} ${direction}`);
            const startTime = Date.now();
            
            const result = await this.db.searchCards(query, page, pageSize, filters, sort, direction);
            
            const searchTime = Date.now() - startTime;
            console.log(`✅ Búsqueda completada en ${searchTime}ms - ${result.data.length} resultados`);

            // Guardar en cache
            this.saveToCache(cacheKey, result);
            
            return result;
            
        } catch (error) {
            console.error('❌ Error en búsqueda local:', error);
            throw error;
        }
    }

    // Búsqueda rápida (para autocompletado)
    async quickSearch(query, limit = 10) {
        try {
            await this.ensureInitialized();
            
            if (query.length < 2) {
                return { data: [], totalCount: 0 };
            }

            const result = await this.db.searchCards(query, 1, limit, {});
            return {
                data: result.data,
                totalCount: result.totalCount,
                isQuickSearch: true
            };
            
        } catch (error) {
            console.error('❌ Error en búsqueda rápida:', error);
            return { data: [], totalCount: 0 };
        }
    }

    // Búsqueda avanzada con múltiples filtros
    async advancedSearch(criteria) {
        try {
            await this.ensureInitialized();
            
            const {
                query = '',
                set = '',
                rarity = '',
                type = '',
                series = '',
                page = 1,
                pageSize = 20
            } = criteria;

            const filters = {};
            if (set) filters.set = set;
            if (rarity) filters.rarity = rarity;
            if (type) filters.type = type;
            if (series) filters.series = series;

            return await this.searchCards(query, page, pageSize, filters);
            
        } catch (error) {
            console.error('❌ Error en búsqueda avanzada:', error);
            throw error;
        }
    }

    // Obtener carta por ID
    async getCardById(id) {
        try {
            await this.ensureInitialized();
            
            // Verificar cache
            const cacheKey = `card_${id}`;
            const cachedCard = this.getFromCache(cacheKey);
            
            if (cachedCard) {
                return cachedCard;
            }

            const card = await this.db.getCardById(id);
            
            if (card) {
                // Guardar en cache
                this.saveToCache(cacheKey, card);
            }
            
            return card;
            
        } catch (error) {
            console.error('❌ Error obteniendo carta por ID:', error);
            return null;
        }
    }

    // Obtener sets disponibles
    async getSets() {
        try {
            await this.ensureInitialized();
            
            // Verificar cache
            const cacheKey = 'sets_all';
            const cachedSets = this.getFromCache(cacheKey);
            
            if (cachedSets) {
                return cachedSets;
            }

            const sets = await this.db.getSets();
            
            // Guardar en cache
            this.saveToCache(cacheKey, sets);
            
            return sets;
            
        } catch (error) {
            console.error('❌ Error obteniendo sets:', error);
            return [];
        }
    }

    // Obtener filtros disponibles
    async getAvailableFilters() {
        try {
            await this.ensureInitialized();
            
            const cacheKey = 'filters_available';
            const cachedFilters = this.getFromCache(cacheKey);
            
            if (cachedFilters) {
                return cachedFilters;
            }

            // Obtener filtros únicos desde la base de datos
            const [rarities, types, series] = await Promise.all([
                this.db.all('SELECT DISTINCT rarity FROM cards WHERE rarity IS NOT NULL AND rarity != "" ORDER BY rarity'),
                this.db.all('SELECT DISTINCT types FROM cards WHERE types IS NOT NULL AND types != ""'),
                this.db.all('SELECT DISTINCT series FROM cards WHERE series IS NOT NULL AND series != "" ORDER BY series')
            ]);

            // Procesar tipos (están separados por comas)
            const allTypes = new Set();
            types.forEach(type => {
                if (type.types) {
                    type.types.split(',').forEach(t => allTypes.add(t.trim()));
                }
            });

            const filters = {
                rarities: rarities.map(r => r.rarity),
                types: Array.from(allTypes).sort(),
                series: series.map(s => s.series)
            };

            // Guardar en cache
            this.saveToCache(cacheKey, filters);
            
            return filters;
            
        } catch (error) {
            console.error('❌ Error obteniendo filtros disponibles:', error);
            return { rarities: [], types: [], series: [] };
        }
    }

    // Búsqueda de sugerencias (para autocompletado)
    async getSuggestions(query, limit = 5) {
        try {
            await this.ensureInitialized();
            
            if (query.length < 2) {
                return [];
            }

            const suggestions = await this.db.all(`
                SELECT DISTINCT name, set_name, series 
                FROM cards 
                WHERE name LIKE ? OR set_name LIKE ? OR series LIKE ?
                ORDER BY 
                    CASE 
                        WHEN name LIKE ? THEN 1
                        WHEN name LIKE ? THEN 2
                        ELSE 3
                    END,
                    name
                LIMIT ?
            `, [
                `${query}%`,           // Exacto al inicio
                `%${query}%`,          // Contiene en cualquier lugar
                `%${query}%`,          // Contiene en cualquier lugar
                `${query}%`,           // Para ordenamiento
                `${query}%`,           // Para ordenamiento
                limit
            ]);

            return suggestions.map(s => ({
                text: s.name,
                set: s.set_name,
                series: s.series,
                display: `${s.name} (${s.set_name})`
            }));
            
        } catch (error) {
            console.error('❌ Error obteniendo sugerencias:', error);
            return [];
        }
    }

    // Búsqueda por similitud (para cartas similares)
    async findSimilarCards(cardId, limit = 10) {
        try {
            await this.ensureInitialized();
            
            const card = await this.getCardById(cardId);
            if (!card) return [];

            // Buscar cartas con características similares
            const similarCards = await this.db.all(`
                SELECT * FROM cards 
                WHERE id != ? 
                AND (
                    set_name = ? OR 
                    series = ? OR 
                    types LIKE ? OR
                    rarity = ?
                )
                ORDER BY 
                    CASE 
                        WHEN set_name = ? THEN 1
                        WHEN series = ? THEN 2
                        WHEN types LIKE ? THEN 3
                        ELSE 4
                    END,
                    name
                LIMIT ?
            `, [
                cardId,
                card.set_name,
                card.series,
                `%${card.types ? card.types[0] : ''}%`,
                card.rarity,
                card.set_name,
                card.series,
                `%${card.types ? card.types[0] : ''}%`,
                limit
            ]);

            return similarCards.map(c => ({
                ...c,
                images: c.images ? JSON.parse(c.images) : null,
                types: c.types ? c.types.split(',') : []
            }));
            
        } catch (error) {
            console.error('❌ Error buscando cartas similares:', error);
            return [];
        }
    }

    // Obtener estadísticas de búsqueda
    async getSearchStats() {
        try {
            await this.ensureInitialized();
            
            const stats = await this.db.getStats();
            const cacheStats = this.getCacheStats();
            
            return {
                ...stats,
                cache: cacheStats,
                searchEngine: 'Local SQLite',
                performance: 'Ultra Fast'
            };
            
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas de búsqueda:', error);
            return {};
        }
    }

    // Limpiar cache
    clearCache() {
        this.searchCache.clear();
        console.log('🧹 Cache de búsqueda limpiado');
    }

    // Generar clave de cache
    generateCacheKey(query, page, pageSize, filters, sort = 'name', direction = 'asc') {
        const filterString = JSON.stringify(filters);
        return `search_${query}_${page}_${pageSize}_${sort}_${direction}_${filterString}`;
    }

    // Obtener resultado desde cache
    getFromCache(key) {
        const cached = this.searchCache.get(key);
        if (!cached) return null;

        // Verificar si el cache ha expirado
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.searchCache.delete(key);
            return null;
        }

        return cached.data;
    }

    // Guardar resultado en cache
    saveToCache(key, data) {
        this.searchCache.set(key, {
            data,
            timestamp: Date.now()
        });

        // Limpiar cache si es muy grande
        if (this.searchCache.size > 100) {
            const firstKey = this.searchCache.keys().next().value;
            this.searchCache.delete(firstKey);
        }
    }

    // Obtener estadísticas del cache
    getCacheStats() {
        return {
            size: this.searchCache.size,
            maxSize: 100,
            hitRate: 'N/A' // Podríamos implementar métricas de hit rate
        };
    }

    // Asegurar que el motor esté inicializado
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.init();
        }
    }

    // Cerrar motor de búsqueda
    // Obtener todos los sets únicos
    async getAllSets() {
        try {
            await this.ensureInitialized();
            return await this.db.getAllSets();
        } catch (error) {
            console.error('❌ Error obteniendo sets:', error);
            return [];
        }
    }

    // Obtener todos los tipos únicos
    async getAllTypes() {
        try {
            await this.ensureInitialized();
            return await this.db.getAllTypes();
        } catch (error) {
            console.error('❌ Error obteniendo tipos:', error);
            return [];
        }
    }

    // Obtener todas las rarezas únicas
    async getAllRarities() {
        try {
            await this.ensureInitialized();
            return await this.db.getAllRarities();
        } catch (error) {
            console.error('❌ Error obteniendo rarezas:', error);
            return [];
        }
    }

    // Obtener todos los subtipos únicos
    async getAllSubtypes() {
        try {
            await this.ensureInitialized();
            return await this.db.getAllSubtypes();
        } catch (error) {
            console.error('❌ Error obteniendo subtipos:', error);
            return [];
        }
    }

    // Obtener todos los idiomas únicos
    async getAllLanguages() {
        try {
            await this.ensureInitialized();
            return await this.db.getAllLanguages();
        } catch (error) {
            console.error('❌ Error obteniendo idiomas:', error);
            return [];
        }
    }

    // Obtener todas las series únicas
    async getAllSeries() {
        try {
            await this.ensureInitialized();
            return await this.db.getAllSeries();
        } catch (error) {
            console.error('❌ Error obteniendo series:', error);
            return [];
        }
    }

    async close() {
        this.clearCache();
        await this.db.close();
        console.log('🔍 Motor de búsqueda local cerrado');
    }
}

// Exportar la clase
module.exports = LocalSearchEngine;

// Si se ejecuta directamente, ejecutar prueba
if (require.main === module) {
    (async () => {
        try {
            const searchEngine = new LocalSearchEngine();
            await searchEngine.init();
            
            console.log('🔍 Probando motor de búsqueda local...');
            
            // Prueba de búsqueda
            const results = await searchEngine.searchCards('pikachu', 1, 5);
            console.log('📊 Resultados de búsqueda:');
            console.log(`- Total encontrado: ${results.totalCount}`);
            console.log(`- Resultados en página: ${results.data.length}`);
            
            // Prueba de sugerencias
            const suggestions = await searchEngine.getSuggestions('pika');
            console.log('💡 Sugerencias:');
            suggestions.forEach(s => console.log(`- ${s.display}`));
            
            await searchEngine.close();
        } catch (error) {
            console.error('❌ Error en prueba del motor de búsqueda:', error);
        }
    })();
}