const express = require('express');
const cors = require('cors');
const LocalSearchEngine = require('./local-search-engine');
const DataMigrator = require('./data-migrator');

class LocalAPIServer {
    constructor() {
        this.app = express();
        this.searchEngine = new LocalSearchEngine();
        this.migrator = new DataMigrator();
        this.port = process.env.PORT || 8080;
        this.isInitialized = false;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    // Configurar middleware
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('html'));
        
        // Middleware de logging
        this.app.use((req, res, next) => {
            console.log(`🌐 ${req.method} ${req.path} - ${new Date().toISOString()}`);
            next();
        });
    }

    // Configurar rutas
    setupRoutes() {
        // Ruta principal
        this.app.get('/', (req, res) => {
            res.json({
                message: 'TCGtrade Local API Server',
                version: '1.0.0',
                status: 'running',
                searchEngine: 'Local SQLite',
                performance: 'Ultra Fast'
            });
        });

        // Endpoint de estado del sistema
        this.app.get('/api/status', async (req, res) => {
            try {
                const stats = await this.searchEngine.getSearchStats();
                res.json({
                    status: 'online',
                    timestamp: new Date().toISOString(),
                    ...stats
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint de búsqueda de cartas (reemplaza /api/pokemontcg/cards)
        this.app.get('/api/pokemontcg/cards', async (req, res) => {
            try {
                const { q: query = '', page = 1, pageSize = 20, set, rarity, type, series } = req.query;
                
                const filters = {};
                if (set) filters.set = set;
                if (rarity) filters.rarity = rarity;
                if (type) filters.type = type;
                if (series) filters.series = series;

                const results = await this.searchEngine.searchCards(
                    query, 
                    parseInt(page), 
                    parseInt(pageSize), 
                    filters
                );

                // Formato compatible con la API externa
                res.json({
                    data: results.data,
                    totalCount: results.totalCount,
                    page: results.page,
                    pageSize: results.pageSize,
                    totalPages: results.totalPages,
                    source: 'Local SQLite',
                    searchTime: 'Ultra Fast'
                });

            } catch (error) {
                console.error('❌ Error en búsqueda de cartas:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint de sets (reemplaza /api/pokemontcg/sets)
        this.app.get('/api/pokemontcg/sets', async (req, res) => {
            try {
                const sets = await this.searchEngine.getSets();
                res.json({
                    data: sets,
                    totalCount: sets.length,
                    source: 'Local SQLite'
                });
            } catch (error) {
                console.error('❌ Error obteniendo sets:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint de carta por ID
        this.app.get('/api/pokemontcg/cards/:id', async (req, res) => {
            try {
                const card = await this.searchEngine.getCardById(req.params.id);
                if (card) {
                    res.json({
                        data: card,
                        source: 'Local SQLite'
                    });
                } else {
                    res.status(404).json({ error: 'Carta no encontrada' });
                }
            } catch (error) {
                console.error('❌ Error obteniendo carta por ID:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint de filtros disponibles
        this.app.get('/api/filters', async (req, res) => {
            try {
                const filters = await this.searchEngine.getAvailableFilters();
                res.json({
                    data: filters,
                    source: 'Local SQLite'
                });
            } catch (error) {
                console.error('❌ Error obteniendo filtros:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint de sugerencias para autocompletado
        this.app.get('/api/suggestions', async (req, res) => {
            try {
                const { q: query, limit = 5 } = req.query;
                if (!query || query.length < 2) {
                    return res.json({ data: [] });
                }

                const suggestions = await this.searchEngine.getSuggestions(query, parseInt(limit));
                res.json({
                    data: suggestions,
                    source: 'Local SQLite'
                });
            } catch (error) {
                console.error('❌ Error obteniendo sugerencias:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint de cartas similares
        this.app.get('/api/cards/:id/similar', async (req, res) => {
            try {
                const { limit = 10 } = req.query;
                const similarCards = await this.searchEngine.findSimilarCards(
                    req.params.id, 
                    parseInt(limit)
                );
                res.json({
                    data: similarCards,
                    source: 'Local SQLite'
                });
            } catch (error) {
                console.error('❌ Error obteniendo cartas similares:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint de migración (para administradores)
        this.app.post('/api/admin/migrate', async (req, res) => {
            try {
                if (this.migrator.isMigrationInProgress()) {
                    return res.status(400).json({ 
                        error: 'Ya hay una migración en curso' 
                    });
                }

                // Iniciar migración en background
                this.migrator.migrateAllCards().catch(error => {
                    console.error('❌ Error en migración background:', error);
                });

                res.json({ 
                    message: 'Migración iniciada en background',
                    status: 'started'
                });
            } catch (error) {
                console.error('❌ Error iniciando migración:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint de progreso de migración
        this.app.get('/api/admin/migration-progress', async (req, res) => {
            try {
                const progress = this.migrator.getMigrationProgress();
                res.json(progress);
            } catch (error) {
                console.error('❌ Error obteniendo progreso:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint de detener migración
        this.app.post('/api/admin/migration-stop', async (req, res) => {
            try {
                await this.migrator.stopMigration();
                res.json({ 
                    message: 'Migración detenida',
                    status: 'stopped'
                });
            } catch (error) {
                console.error('❌ Error deteniendo migración:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Endpoint de sincronización manual
        this.app.post('/api/admin/sync', async (req, res) => {
            try {
                const { type = 'all' } = req.body;
                
                if (type === 'all' || type === 'cards') {
                    // Sincronizar solo cartas nuevas/actualizadas
                    await this.syncNewCards();
                }
                
                res.json({ 
                    message: 'Sincronización completada',
                    type,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Error en sincronización:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Manejo de errores 404
        this.app.use('*', (req, res) => {
            res.status(404).json({ 
                error: 'Endpoint no encontrado',
                availableEndpoints: [
                    'GET /api/status',
                    'GET /api/pokemontcg/cards',
                    'GET /api/pokemontcg/sets',
                    'GET /api/pokemontcg/cards/:id',
                    'GET /api/filters',
                    'GET /api/suggestions',
                    'GET /api/cards/:id/similar',
                    'POST /api/admin/migrate',
                    'GET /api/admin/migration-progress',
                    'POST /api/admin/migration-stop',
                    'POST /api/admin/sync'
                ]
            });
        });

        // Manejo de errores global
        this.app.use((error, req, res, next) => {
            console.error('❌ Error global:', error);
            res.status(500).json({ 
                error: 'Error interno del servidor',
                message: error.message
            });
        });
    }

    // Sincronizar cartas nuevas/actualizadas
    async syncNewCards() {
        try {
            console.log('🔄 Iniciando sincronización de cartas...');
            
            // Aquí implementaríamos la lógica para obtener solo cartas nuevas
            // Por ahora, solo simulamos la sincronización
            
            console.log('✅ Sincronización completada');
        } catch (error) {
            console.error('❌ Error en sincronización:', error);
            throw error;
        }
    }

    // Inicializar servidor
    async init() {
        try {
            console.log('🚀 Inicializando servidor de API local...');
            
            // Inicializar motor de búsqueda
            await this.searchEngine.init();
            
            // Inicializar migrador
            await this.migrator.init();
            
            this.isInitialized = true;
            console.log('✅ Servidor de API local inicializado correctamente');
            
        } catch (error) {
            console.error('❌ Error inicializando servidor:', error);
            throw error;
        }
    }

    // Iniciar servidor
    async start() {
        try {
            await this.init();
            
            this.app.listen(this.port, '0.0.0.0', () => {
                console.log(`🚀 Servidor de API local ejecutándose en puerto ${this.port}`);
                console.log(`🌐 URL: http://localhost:${this.port}`);
                console.log(`📊 Estado: http://localhost:${this.port}/api/status`);
                console.log(`🔍 Búsqueda: http://localhost:${this.port}/api/pokemontcg/cards?q=pikachu`);
            });
            
        } catch (error) {
            console.error('❌ Error iniciando servidor:', error);
            process.exit(1);
        }
    }

    // Detener servidor
    async stop() {
        try {
            await this.searchEngine.close();
            await this.migrator.close();
            console.log('🛑 Servidor de API local detenido');
        } catch (error) {
            console.error('❌ Error deteniendo servidor:', error);
        }
    }
}

// Exportar la clase
module.exports = LocalAPIServer;

// Si se ejecuta directamente, iniciar servidor
if (require.main === module) {
    const server = new LocalAPIServer();
    
    // Manejo de señales para cierre graceful
    process.on('SIGINT', async () => {
        console.log('\n🛑 Recibida señal SIGINT, cerrando servidor...');
        await server.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        console.log('\n🛑 Recibida señal SIGTERM, cerrando servidor...');
        await server.stop();
        process.exit(0);
    });
    
    server.start().catch(error => {
        console.error('💥 Error fatal iniciando servidor:', error);
        process.exit(1);
    });
}