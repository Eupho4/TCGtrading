require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const PostgresSearchEngine = require('./js/postgres-search-engine');
const LocalSearchEngine = require('./js/local-search-engine');
const DataMigrator = require('./js/data-migrator');

class HybridAPIServer {
    constructor() {
        this.app = express();

        // Usar PostgreSQL si está disponible, sino SQLite local
        if (process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL) {
            console.log('🗄️ Usando PostgreSQL en Railway');
            this.searchEngine = new PostgresSearchEngine();
        } else {
            console.log('🗄️ Usando SQLite local (fallback)');
            this.searchEngine = new LocalSearchEngine();
        }

        this.migrator = new DataMigrator();
        this.port = process.env.PORT || 3000;
        this.isInitialized = false;


        this.setupMiddleware();
        this.setupRoutes();
    }

    // Función fetch usando https nativo
    async fetch(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve({
                            json: () => Promise.resolve(jsonData),
                            status: res.statusCode,
                            ok: res.statusCode >= 200 && res.statusCode < 300
                        });
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    // Configurar middleware
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('html'));

        // Servir archivos JavaScript desde la raíz
        this.app.use('/js', express.static('js'));

        // Servir archivos CSS desde la raíz
        this.app.use('/css', express.static('css'));

        // Servir imágenes
        this.app.use('/images', express.static('images'));

        // Servir archivos exportados
        this.app.use('/exports', express.static('exported_data'));

        // Middleware de logging
        this.app.use((req, res, next) => {
            console.log(`🌐 ${req.method} ${req.path} - ${new Date().toISOString()}`);
            next();
        });
    }

    // Configurar rutas
    setupRoutes() {
        // Healthcheck simple para Railway (siempre responde OK)
        this.app.get('/api/health', (req, res) => {
            res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Ruta principal - servir index.html
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'html', 'index.html'));
        });

        // Endpoint de estado del sistema
        this.app.get('/api/status', async (req, res) => {
            try {
                const stats = await this.searchEngine.getSearchStats();
                res.json({
                    status: 'online',
                    timestamp: new Date().toISOString(),
                    searchEngine: process.env.DATABASE_URL ? 'PostgreSQL en Railway' : 'Local SQLite',
                    totalCards: stats.totalCards,
                    pokemonApiKey: !!process.env.POKEMON_TCG_API_KEY,
                    databaseType: process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'
                });
            } catch (error) {
                console.error('Error obteniendo estadísticas:', error);
                res.status(500).json({
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        // Endpoint de búsqueda de cartas (usando base de datos local)
        this.app.get('/api/pokemontcg/cards', async (req, res) => {
            try {
                let {
                    q: searchTerm,
                    page = 1,
                    pageSize = 20,
                    series,
                    set,
                    rarity,
                    type,
                    subtype,
                    language,
                    hasImage,
                    hasPrice,
                    sort = 'name',
                    direction = 'asc'
                } = req.query;

                // Si no hay término de búsqueda, usar búsqueda amplia
                if (!searchTerm) {
                    searchTerm = ''; // Búsqueda sin término para obtener todas las cartas
                }

                // Construir filtros
                const filters = {};
                if (series) filters.series = series;
                if (set) filters.set = set;
                if (rarity) filters.rarity = rarity;
                if (type) filters.type = type;
                if (subtype) filters.subtype = subtype;
                if (language) filters.language = language;
                if (hasImage) filters.hasImage = hasImage === 'true';
                if (hasPrice) filters.hasPrice = hasPrice === 'true';

                console.log('🔍 Búsqueda con filtros:', { searchTerm, filters, page, pageSize, sort, direction });

                const results = await this.searchEngine.searchCards(
                    searchTerm,
                    parseInt(page),
                    parseInt(pageSize),
                    filters,
                    sort,
                    direction
                );

                res.json({
                    success: true,
                    ...results
                });
            } catch (error) {
                console.error('⚠️ Error en búsqueda PostgreSQL, intentando fallback a API pública:', error.message);

                // Fallback: usar la API pública de pokemontcg.io
                try {
                    const fallbackResults = await this.fallbackToPublicAPI(req.query);
                    res.json({
                        success: true,
                        fallback: true,
                        ...fallbackResults
                    });
                } catch (fallbackError) {
                    console.error('❌ Fallback también falló:', fallbackError.message);
                    res.status(500).json({
                        success: false,
                        error: 'Error en búsqueda',
                        message: error.message
                    });
                }
            }
        });

        // Endpoint para obtener sets únicos
        this.app.get('/api/pokemontcg/sets', async (req, res) => {
            try {
                console.log('🔍 Obteniendo sets desde PostgreSQL...');
                const sets = await this.searchEngine.getAllSets();
                console.log('✅ Sets obtenidos:', sets.length, 'primer set:', sets[0]);
                res.json({
                    success: true,
                    data: sets,
                    count: sets.length
                });
            } catch (error) {
                console.error('❌ Error obteniendo sets:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo sets',
                    message: error.message
                });
            }
        });

        // Endpoint para obtener tipos únicos
        this.app.get('/api/pokemontcg/types', async (req, res) => {
            try {
                const types = await this.searchEngine.getAllTypes();
                res.json({
                    success: true,
                    data: types,
                    count: types.length
                });
            } catch (error) {
                console.error('❌ Error obteniendo tipos:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo tipos',
                    message: error.message
                });
            }
        });

        // Endpoint para obtener rarezas únicas
        this.app.get('/api/pokemontcg/rarities', async (req, res) => {
            try {
                const rarities = await this.searchEngine.getAllRarities();
                res.json({
                    success: true,
                    data: rarities,
                    count: rarities.length
                });
            } catch (error) {
                console.error('❌ Error obteniendo rarezas:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo rarezas',
                    message: error.message
                });
            }
        });

        // Endpoint para obtener subtipos únicos
        this.app.get('/api/pokemontcg/subtypes', async (req, res) => {
            try {
                const subtypes = await this.searchEngine.getAllSubtypes();
                res.json({
                    success: true,
                    data: subtypes,
                    count: subtypes.length
                });
            } catch (error) {
                console.error('❌ Error obteniendo subtipos:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo subtipos',
                    message: error.message
                });
            }
        });

        // Endpoint para obtener idiomas únicos
        this.app.get('/api/pokemontcg/languages', async (req, res) => {
            try {
                const languages = await this.searchEngine.getAllLanguages();
                res.json({
                    success: true,
                    data: languages,
                    count: languages.length
                });
            } catch (error) {
                console.error('❌ Error obteniendo idiomas:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo idiomas',
                    message: error.message
                });
            }
        });

        // Endpoint para obtener series únicas
        this.app.get('/api/pokemontcg/series', async (req, res) => {
            try {
                const series = await this.searchEngine.getAllSeries();
                res.json({
                    success: true,
                    data: series,
                    count: series.length
                });
            } catch (error) {
                console.error('❌ Error obteniendo series:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo series',
                    message: error.message
                });
            }
        });

        // Endpoint para listar archivos exportados
        this.app.get('/api/exports', (req, res) => {
            const fs = require('fs');
            const path = require('path');

            try {
                const exportsDir = path.join(__dirname, 'exported_data');
                const files = fs.readdirSync(exportsDir);

                const fileInfo = files.map(file => {
                    const filePath = path.join(exportsDir, file);
                    const stats = fs.statSync(filePath);
                    return {
                        name: file,
                        size: stats.size,
                        sizeFormatted: this.formatFileSize(stats.size),
                        lastModified: stats.mtime,
                        downloadUrl: `/exports/${file}`
                    };
                });

                res.json({
                    message: 'Archivos exportados disponibles',
                    totalFiles: files.length,
                    files: fileInfo
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Error al listar archivos exportados',
                    message: error.message
                });
            }
        });

        // Endpoint para descargar archivos específicos
        this.app.get('/api/exports/:filename', (req, res) => {
            const fs = require('fs');
            const path = require('path');

            try {
                const filename = req.params.filename;
                const filePath = path.join(__dirname, 'exported_data', filename);

                if (!fs.existsSync(filePath)) {
                    return res.status(404).json({
                        error: 'Archivo no encontrado',
                        message: `El archivo ${filename} no existe`
                    });
                }

                // Configurar headers para descarga
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Content-Type', 'application/octet-stream');

                // Enviar archivo
                res.sendFile(filePath);
            } catch (error) {
                res.status(500).json({
                    error: 'Error al descargar archivo',
                    message: error.message
                });
            }
        });

    }

    // Función para formatear tamaño de archivo
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }


    // Fallback: buscar en la API pública de pokemontcg.io
    async fallbackToPublicAPI(queryParams) {
        const { q: searchTerm, page = 1, pageSize = 20 } = queryParams;
        const apiKey = process.env.POKEMON_TCG_API_KEY || '';

        // Construir query para la API pública
        let apiQuery = '';
        if (searchTerm && searchTerm.trim()) {
            apiQuery = `name:${searchTerm}*`;
        }

        const apiUrl = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(apiQuery)}&page=${page}&pageSize=${pageSize}&orderBy=name`;
        console.log('🌐 Fallback API URL:', apiUrl);

        return new Promise((resolve, reject) => {
            const headers = { 'Content-Type': 'application/json' };
            if (apiKey) {
                headers['X-Api-Key'] = apiKey;
            }

            const url = new URL(apiUrl);
            const options = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: 'GET',
                headers: headers
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            const cards = (jsonData.data || []).map(card => ({
                                id: card.id,
                                name: card.name,
                                number: card.number || '',
                                rarity: card.rarity || 'Common',
                                types: card.types || [],
                                subtypes: card.subtypes || [],
                                images: card.images || {},
                                tcgplayer: card.tcgplayer || {},
                                cardmarket: card.cardmarket || {},
                                set: {
                                    id: card.set?.id || '',
                                    name: card.set?.name || '',
                                    series: card.set?.series || ''
                                }
                            }));

                            console.log(`✅ Fallback API: ${cards.length} cartas encontradas`);
                            resolve({
                                data: cards,
                                totalCount: jsonData.totalCount || cards.length,
                                page: parseInt(page),
                                pageSize: parseInt(pageSize),
                                totalPages: Math.ceil((jsonData.totalCount || cards.length) / parseInt(pageSize))
                            });
                        } else {
                            reject(new Error(`API responded with ${res.statusCode}: ${jsonData.message || 'Unknown error'}`));
                        }
                    } catch (e) {
                        reject(new Error('Error parsing API response: ' + e.message));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error('Fallback API request failed: ' + error.message));
            });

            req.setTimeout(15000, () => {
                req.destroy();
                reject(new Error('Fallback API timeout'));
            });

            req.end();
        });
    }

    // Inicializar servidor
    async init() {
        if (this.isInitialized) return;

        try {
            console.log('🔄 Inicializando servidor híbrido...');
            await this.migrator.init();
            await this.searchEngine.init();
            this.isInitialized = true;
            console.log('✅ Servidor híbrido inicializado correctamente');
        } catch (error) {
            console.error('⚠️ Error inicializando componentes (el servidor seguirá funcionando):', error.message);
            // No lanzar error - el servidor arranca igualmente
        }
    }

    // Iniciar servidor
    async start() {
        // Primero arrancar el servidor HTTP para que el healthcheck responda
        this.app.listen(this.port, '0.0.0.0', () => {
            console.log(`🚀 Servidor híbrido ejecutándose en puerto ${this.port}`);
            console.log(`🌐 URL: http://localhost:${this.port}`);
            console.log(`📊 Estado: http://localhost:${this.port}/api/status`);
            console.log(`🔍 Búsqueda: http://localhost:${this.port}/api/pokemontcg/cards?q=pikachu`);
        });

        // Luego inicializar BD (sin bloquear el arranque)
        await this.init();
    }

    // Detener servidor
    async stop() {
        console.log('🛑 Deteniendo servidor híbrido...');
        // Aquí podrías agregar lógica de limpieza si es necesario
    }
}

// Inicializar servidor si se ejecuta directamente
if (require.main === module) {
    const server = new HybridAPIServer();

    // Manejar señales de terminación
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

module.exports = HybridAPIServer;