const PostgresCardDatabase = require('./postgres-database');

class PostgresSearchEngine {
    constructor() {
        this.db = new PostgresCardDatabase();
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
            console.log('🔍 Motor de búsqueda PostgreSQL inicializado');
        } catch (error) {
            console.error('❌ Error inicializando motor de búsqueda PostgreSQL:', error);
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

            // Realizar búsqueda en base de datos PostgreSQL
            console.log(`🔍 Búsqueda PostgreSQL: "${query}" - Página ${page} - Orden: ${sort} ${direction}`);
            const startTime = Date.now();
            
            const result = await this.db.searchCards(query, page, pageSize, filters, sort, direction);
            
            const searchTime = Date.now() - startTime;
            console.log(`✅ Búsqueda PostgreSQL completada en ${searchTime}ms - ${result.data.length} resultados`);

            // Guardar en cache
            this.saveToCache(cacheKey, result);
            
            return result;
        } catch (error) {
            console.error('❌ Error en búsqueda PostgreSQL:', error);
            throw error;
        }
    }

    // Obtener sets únicos
    async getAllSets() {
        try {
            await this.ensureInitialized();
            return await this.db.getAllSets();
        } catch (error) {
            console.error('❌ Error obteniendo sets:', error);
            return [];
        }
    }

    // Obtener tipos únicos
    async getAllTypes() {
        try {
            await this.ensureInitialized();
            return await this.db.getAllTypes();
        } catch (error) {
            console.error('❌ Error obteniendo tipos:', error);
            return [];
        }
    }

    // Obtener rarezas únicas
    async getAllRarities() {
        try {
            await this.ensureInitialized();
            return await this.db.getAllRarities();
        } catch (error) {
            console.error('❌ Error obteniendo rarezas:', error);
            return [];
        }
    }

    // Obtener subtipos únicos
    async getAllSubtypes() {
        try {
            await this.ensureInitialized();
            return await this.db.getAllSubtypes();
        } catch (error) {
            console.error('❌ Error obteniendo subtipos:', error);
            return [];
        }
    }

    // Obtener idiomas únicos
    async getAllLanguages() {
        try {
            await this.ensureInitialized();
            return await this.db.getAllLanguages();
        } catch (error) {
            console.error('❌ Error obteniendo idiomas:', error);
            return [];
        }
    }

    // Obtener series únicas
    async getAllSeries() {
        try {
            await this.ensureInitialized();
            return await this.db.getAllSeries();
        } catch (error) {
            console.error('❌ Error obteniendo series:', error);
            return [];
        }
    }

    // Obtener estadísticas de búsqueda
    async getSearchStats() {
        try {
            await this.ensureInitialized();
            return await this.db.getStats();
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            return {
                totalCards: 0,
                totalSets: 0,
                lastUpdated: null,
                databaseSize: 'Error'
            };
        }
    }

    // Generar clave de cache
    generateCacheKey(query, page, pageSize, filters, sort, direction) {
        return JSON.stringify({ query, page, pageSize, filters, sort, direction });
    }

    // Obtener resultado del cache
    getFromCache(key) {
        const cached = this.searchCache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    // Guardar resultado en cache
    saveToCache(key, data) {
        this.searchCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    // Limpiar cache
    clearCache() {
        this.searchCache.clear();
        console.log('🗑️ Cache de búsqueda limpiado');
    }

    // Asegurar que esté inicializado
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.init();
        }
    }

    // Cerrar conexión
    async close() {
        try {
            await this.db.close();
            this.clearCache();
        } catch (error) {
            console.error('❌ Error cerrando motor de búsqueda PostgreSQL:', error);
        }
    }
}

module.exports = PostgresSearchEngine;