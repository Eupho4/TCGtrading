require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');

// Handlers globales para evitar crashes
process.on('uncaughtException', (err) => {
    console.error('uncaughtException:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('unhandledRejection:', reason?.message || reason);
});

class HybridAPIServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.apiKey = process.env.POKEMON_TCG_API_KEY || '';
        this.setupMiddleware();
        this.setupRoutes();
    }

    // Helper: hacer request HTTPS a la API de pokemontcg.io
    apiRequest(apiPath) {
        return new Promise((resolve, reject) => {
            const headers = {};
            if (this.apiKey) headers['X-Api-Key'] = this.apiKey;

            const options = {
                hostname: 'api.pokemontcg.io',
                path: apiPath,
                method: 'GET',
                headers: headers
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(json);
                        } else {
                            reject(new Error(`API ${res.statusCode}: ${json.message || JSON.stringify(json)}`));
                        }
                    } catch (e) {
                        reject(new Error('Error parsing API response'));
                    }
                });
            });

            req.on('error', (err) => reject(new Error('API request failed: ' + err.message)));
            req.setTimeout(20000, () => { req.destroy(); reject(new Error('API timeout')); });
            req.end();
        });
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('html'));
        this.app.use('/js', express.static('js'));
        this.app.use('/css', express.static('css'));
        this.app.use('/images', express.static('images'));
        this.app.use('/exports', express.static('exported_data'));
    }

    setupRoutes() {
        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ status: 'ok', version: 'v8-direct-api', timestamp: new Date().toISOString() });
        });

        // Servir index.html
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'html', 'index.html'));
        });

        // Estado del sistema
        this.app.get('/api/status', (req, res) => {
            res.json({
                status: 'online',
                timestamp: new Date().toISOString(),
                searchEngine: 'Pokemon TCG API (api.pokemontcg.io)',
                pokemonApiKey: !!this.apiKey,
                databaseType: 'API directa'
            });
        });

        // ==========================================
        // BUSQUEDA DE CARTAS - API publica directa
        // ==========================================
        this.app.get('/api/pokemontcg/cards', async (req, res) => {
            try {
                const { q: searchTerm, page = 1, pageSize = 20 } = req.query;
                console.log('Busqueda recibida:', { searchTerm, page, pageSize });

                let apiQuery = '';
                if (searchTerm && searchTerm.trim()) {
                    apiQuery = `name:${searchTerm}`;
                }

                const apiPath = `/v2/cards?q=${encodeURIComponent(apiQuery)}&page=${page}&pageSize=${pageSize}&orderBy=name`;
                const json = await this.apiRequest(apiPath);

                const cards = (json.data || []).map(card => ({
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

                console.log(`Encontradas ${cards.length} cartas de ${json.totalCount || 0} total`);
                res.json({
                    success: true,
                    data: cards,
                    totalCount: json.totalCount || cards.length,
                    page: parseInt(page),
                    pageSize: parseInt(pageSize),
                    totalPages: Math.ceil((json.totalCount || cards.length) / parseInt(pageSize))
                });
            } catch (error) {
                console.error('Error en busqueda:', error.message);
                res.status(500).json({ success: false, error: 'Error en busqueda', message: error.message });
            }
        });

        // ==========================================
        // SETS - API publica directa
        // ==========================================
        this.app.get('/api/pokemontcg/sets', async (req, res) => {
            try {
                const json = await this.apiRequest('/v2/sets?orderBy=releaseDate');
                const sets = (json.data || []).map(s => ({
                    id: s.id,
                    name: s.name,
                    series: s.series || '',
                    cardCount: s.total || 0,
                    source: 'pokemontcg'
                }));
                res.json({ success: true, data: sets, count: sets.length });
            } catch (error) {
                console.error('Error obteniendo sets:', error.message);
                res.status(500).json({ success: false, error: 'Error obteniendo sets', message: error.message });
            }
        });

        // ==========================================
        // TYPES - API publica directa
        // ==========================================
        this.app.get('/api/pokemontcg/types', async (req, res) => {
            try {
                const json = await this.apiRequest('/v2/types');
                const types = (json.data || []).map(t => ({ id: t.toLowerCase(), name: t }));
                res.json({ success: true, data: types, count: types.length });
            } catch (error) {
                console.error('Error obteniendo tipos:', error.message);
                res.status(500).json({ success: false, error: 'Error obteniendo tipos', message: error.message });
            }
        });

        // ==========================================
        // RARITIES - API publica directa
        // ==========================================
        this.app.get('/api/pokemontcg/rarities', async (req, res) => {
            try {
                const json = await this.apiRequest('/v2/rarities');
                const rarities = (json.data || []).map(r => ({
                    id: r.toLowerCase().replace(/\s+/g, '-'),
                    name: r
                }));
                res.json({ success: true, data: rarities, count: rarities.length });
            } catch (error) {
                console.error('Error obteniendo rarezas:', error.message);
                res.status(500).json({ success: false, error: 'Error obteniendo rarezas', message: error.message });
            }
        });

        // ==========================================
        // SUBTYPES - API publica directa
        // ==========================================
        this.app.get('/api/pokemontcg/subtypes', async (req, res) => {
            try {
                const json = await this.apiRequest('/v2/subtypes');
                const subtypes = (json.data || []).map(s => ({
                    id: s.toLowerCase().replace(/\s+/g, '-'),
                    name: s
                }));
                res.json({ success: true, data: subtypes, count: subtypes.length });
            } catch (error) {
                console.error('Error obteniendo subtipos:', error.message);
                res.status(500).json({ success: false, error: 'Error obteniendo subtipos', message: error.message });
            }
        });

        // ==========================================
        // LANGUAGES - lista estatica
        // ==========================================
        this.app.get('/api/pokemontcg/languages', (req, res) => {
            const languages = [
                { code: 'en', name: 'English', category: 'western', available: true },
                { code: 'es', name: 'Espanol', category: 'western', available: true },
                { code: 'fr', name: 'Francais', category: 'western', available: true },
                { code: 'de', name: 'Deutsch', category: 'western', available: true },
                { code: 'it', name: 'Italiano', category: 'western', available: true },
                { code: 'pt', name: 'Portugues', category: 'western', available: true },
                { code: 'ja', name: 'Japones', category: 'asian', available: true },
                { code: 'ko', name: 'Coreano', category: 'asian', available: true }
            ];
            res.json({ success: true, data: languages, count: languages.length });
        });

        // ==========================================
        // SERIES - extraer de sets
        // ==========================================
        this.app.get('/api/pokemontcg/series', async (req, res) => {
            try {
                const json = await this.apiRequest('/v2/sets?orderBy=releaseDate');
                const seriesMap = new Map();
                (json.data || []).forEach(s => {
                    if (s.series) {
                        if (!seriesMap.has(s.series)) {
                            seriesMap.set(s.series, { name: s.series, cardCount: 0 });
                        }
                        seriesMap.get(s.series).cardCount += (s.total || 0);
                    }
                });
                const series = Array.from(seriesMap.values()).map(s => ({
                    id: s.name.toLowerCase().replace(/\s+/g, '-'),
                    name: s.name,
                    cardCount: s.cardCount
                }));
                res.json({ success: true, data: series, count: series.length });
            } catch (error) {
                console.error('Error obteniendo series:', error.message);
                res.status(500).json({ success: false, error: 'Error obteniendo series', message: error.message });
            }
        });

        // ==========================================
        // EXPORTS
        // ==========================================
        this.app.get('/api/exports', (req, res) => {
            const fs = require('fs');
            try {
                const exportsDir = path.join(__dirname, 'exported_data');
                if (!fs.existsSync(exportsDir)) {
                    return res.json({ message: 'No hay archivos exportados', totalFiles: 0, files: [] });
                }
                const files = fs.readdirSync(exportsDir).map(file => {
                    const stats = fs.statSync(path.join(exportsDir, file));
                    return { name: file, size: stats.size, downloadUrl: `/exports/${file}` };
                });
                res.json({ totalFiles: files.length, files });
            } catch (error) {
                res.status(500).json({ error: 'Error listando exports', message: error.message });
            }
        });
    }

    async start() {
        this.app.listen(this.port, '0.0.0.0', () => {
            console.log(`Servidor en puerto ${this.port}`);
            console.log(`URL: http://localhost:${this.port}`);
            console.log(`Busqueda: http://localhost:${this.port}/api/pokemontcg/cards?q=pikachu`);
        });
    }
}

if (require.main === module) {
    const server = new HybridAPIServer();
    server.start().catch(err => {
        console.error('Error fatal:', err);
        process.exit(1);
    });
}

module.exports = HybridAPIServer;
