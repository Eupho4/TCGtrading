require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

// Handlers globales para evitar crashes
process.on('uncaughtException', (err) => {
    console.error('uncaughtException:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('unhandledRejection:', reason && reason.message ? reason.message : reason);
});

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';

class HybridAPIServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.apiKey = process.env.POKEMON_TCG_API_KEY || '';
        this.setupMiddleware();
        this.setupRoutes();
    }

    // Helper: hacer request a la API de pokemontcg.io usando node-fetch
    async apiRequest(endpoint) {
        const headers = {};
        if (this.apiKey) headers['X-Api-Key'] = this.apiKey;

        const url = POKEMON_TCG_API + endpoint;
        console.log('API Request:', url);

        const response = await fetch(url, { headers, timeout: 20000 });
        if (!response.ok) {
            const text = await response.text();
            throw new Error('API ' + response.status + ': ' + text.substring(0, 200));
        }
        return await response.json();
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
        this.app.get('/api/health', function(req, res) {
            res.json({ status: 'ok', version: 'v9-fetch', timestamp: new Date().toISOString() });
        });

        // Servir index.html
        this.app.get('/', function(req, res) {
            res.sendFile(path.join(__dirname, 'html', 'index.html'));
        });

        // Estado del sistema
        this.app.get('/api/status', function(req, res) {
            res.json({
                status: 'online',
                timestamp: new Date().toISOString(),
                searchEngine: 'Pokemon TCG API directa',
                databaseType: 'API directa'
            });
        });

        // BUSQUEDA DE CARTAS
        var self = this;
        this.app.get('/api/pokemontcg/cards', async function(req, res) {
            try {
                var searchTerm = req.query.q || '';
                var page = req.query.page || 1;
                var pageSize = req.query.pageSize || 20;
                console.log('Busqueda:', searchTerm, 'page:', page);

                var apiQuery = '';
                if (searchTerm && searchTerm.trim()) {
                    apiQuery = 'name:' + searchTerm;
                }

                var endpoint = '/cards?q=' + encodeURIComponent(apiQuery) + '&page=' + page + '&pageSize=' + pageSize + '&orderBy=name';
                var json = await self.apiRequest(endpoint);

                var cards = (json.data || []).map(function(card) {
                    return {
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
                            id: (card.set && card.set.id) || '',
                            name: (card.set && card.set.name) || '',
                            series: (card.set && card.set.series) || ''
                        }
                    };
                });

                var totalCount = json.totalCount || cards.length;
                console.log('Encontradas ' + cards.length + ' cartas de ' + totalCount);
                res.json({
                    success: true,
                    data: cards,
                    totalCount: totalCount,
                    page: parseInt(page),
                    pageSize: parseInt(pageSize),
                    totalPages: Math.ceil(totalCount / parseInt(pageSize))
                });
            } catch (error) {
                console.error('Error en busqueda:', error.message);
                res.status(500).json({ success: false, error: 'Error en busqueda', message: error.message });
            }
        });

        // SETS
        this.app.get('/api/pokemontcg/sets', async function(req, res) {
            try {
                var json = await self.apiRequest('/sets?orderBy=releaseDate');
                var sets = (json.data || []).map(function(s) {
                    return {
                        id: s.id,
                        name: s.name,
                        series: s.series || '',
                        cardCount: s.total || 0,
                        source: 'pokemontcg'
                    };
                });
                res.json({ success: true, data: sets, count: sets.length });
            } catch (error) {
                console.error('Error sets:', error.message);
                res.status(500).json({ success: false, error: 'Error obteniendo sets', message: error.message });
            }
        });

        // TYPES
        this.app.get('/api/pokemontcg/types', async function(req, res) {
            try {
                var json = await self.apiRequest('/types');
                var types = (json.data || []).map(function(t) {
                    return { id: t.toLowerCase(), name: t };
                });
                res.json({ success: true, data: types, count: types.length });
            } catch (error) {
                console.error('Error types:', error.message);
                res.status(500).json({ success: false, error: 'Error obteniendo tipos', message: error.message });
            }
        });

        // RARITIES
        this.app.get('/api/pokemontcg/rarities', async function(req, res) {
            try {
                var json = await self.apiRequest('/rarities');
                var rarities = (json.data || []).map(function(r) {
                    return { id: r.toLowerCase().replace(/\s+/g, '-'), name: r };
                });
                res.json({ success: true, data: rarities, count: rarities.length });
            } catch (error) {
                console.error('Error rarities:', error.message);
                res.status(500).json({ success: false, error: 'Error obteniendo rarezas', message: error.message });
            }
        });

        // SUBTYPES
        this.app.get('/api/pokemontcg/subtypes', async function(req, res) {
            try {
                var json = await self.apiRequest('/subtypes');
                var subtypes = (json.data || []).map(function(s) {
                    return { id: s.toLowerCase().replace(/\s+/g, '-'), name: s };
                });
                res.json({ success: true, data: subtypes, count: subtypes.length });
            } catch (error) {
                console.error('Error subtypes:', error.message);
                res.status(500).json({ success: false, error: 'Error obteniendo subtipos', message: error.message });
            }
        });

        // LANGUAGES
        this.app.get('/api/pokemontcg/languages', function(req, res) {
            res.json({
                success: true,
                data: [
                    { code: 'en', name: 'English', available: true },
                    { code: 'es', name: 'Espanol', available: true },
                    { code: 'fr', name: 'Francais', available: true },
                    { code: 'de', name: 'Deutsch', available: true },
                    { code: 'it', name: 'Italiano', available: true },
                    { code: 'pt', name: 'Portugues', available: true },
                    { code: 'ja', name: 'Japones', available: true },
                    { code: 'ko', name: 'Coreano', available: true }
                ],
                count: 8
            });
        });

        // SERIES
        this.app.get('/api/pokemontcg/series', async function(req, res) {
            try {
                var json = await self.apiRequest('/sets?orderBy=releaseDate');
                var seriesMap = {};
                (json.data || []).forEach(function(s) {
                    if (s.series) {
                        if (!seriesMap[s.series]) {
                            seriesMap[s.series] = { name: s.series, cardCount: 0 };
                        }
                        seriesMap[s.series].cardCount += (s.total || 0);
                    }
                });
                var series = Object.values(seriesMap).map(function(s) {
                    return {
                        id: s.name.toLowerCase().replace(/\s+/g, '-'),
                        name: s.name,
                        cardCount: s.cardCount
                    };
                });
                res.json({ success: true, data: series, count: series.length });
            } catch (error) {
                console.error('Error series:', error.message);
                res.status(500).json({ success: false, error: 'Error obteniendo series', message: error.message });
            }
        });

        // EXPORTS
        this.app.get('/api/exports', function(req, res) {
            var fs = require('fs');
            try {
                var exportsDir = path.join(__dirname, 'exported_data');
                if (!fs.existsSync(exportsDir)) {
                    return res.json({ totalFiles: 0, files: [] });
                }
                var files = fs.readdirSync(exportsDir).map(function(file) {
                    var stats = fs.statSync(path.join(exportsDir, file));
                    return { name: file, size: stats.size, downloadUrl: '/exports/' + file };
                });
                res.json({ totalFiles: files.length, files: files });
            } catch (error) {
                res.status(500).json({ error: 'Error listando exports', message: error.message });
            }
        });
    }

    async start() {
        var self = this;
        this.app.listen(this.port, '0.0.0.0', function() {
            console.log('Servidor en puerto ' + self.port);
        });
    }
}

if (require.main === module) {
    var server = new HybridAPIServer();
    server.start().catch(function(err) {
        console.error('Error fatal:', err);
        process.exit(1);
    });
}

module.exports = HybridAPIServer;
