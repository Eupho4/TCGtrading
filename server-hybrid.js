require('dotenv').config();
var express = require('express');
var cors = require('cors');
var path = require('path');
var https = require('https');

// Handlers globales para evitar crashes
process.on('uncaughtException', function(err) {
    console.error('uncaughtException:', err.message);
});
process.on('unhandledRejection', function(reason) {
    console.error('unhandledRejection:', reason);
});

var POKEMON_API = 'https://api.pokemontcg.io/v2';
var API_KEY = process.env.POKEMON_TCG_API_KEY || '';

// Funcion simple para hacer GET a una URL y devolver JSON
function httpGet(url) {
    return new Promise(function(resolve, reject) {
        var headers = {};
        if (API_KEY) {
            headers['X-Api-Key'] = API_KEY;
        }

        https.get(url, { headers: headers }, function(response) {
            var body = '';
            response.on('data', function(chunk) {
                body += chunk;
            });
            response.on('end', function() {
                try {
                    var json = JSON.parse(body);
                    resolve({ status: response.statusCode, data: json });
                } catch (e) {
                    reject(new Error('JSON parse error'));
                }
            });
            response.on('error', function(err) {
                reject(err);
            });
        }).on('error', function(err) {
            reject(err);
        });
    });
}

var app = express();
var PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('html'));
app.use('/js', express.static('js'));
app.use('/css', express.static('css'));
app.use('/images', express.static('images'));
app.use('/exports', express.static('exported_data'));

// Health
app.get('/api/health', function(req, res) {
    res.json({ status: 'ok', version: 'v10-simple', timestamp: new Date().toISOString() });
});

// Index
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'html', 'index.html'));
});

// Status
app.get('/api/status', function(req, res) {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        searchEngine: 'Pokemon TCG API directa',
        databaseType: 'API directa'
    });
});

// BUSQUEDA DE CARTAS
app.get('/api/pokemontcg/cards', function(req, res) {
    var searchTerm = req.query.q || '';
    var page = req.query.page || 1;
    var pageSize = req.query.pageSize || 20;
    console.log('Busqueda:', searchTerm, 'page:', page);

    var apiQuery = '';
    if (searchTerm && searchTerm.trim()) {
        apiQuery = 'name:' + searchTerm;
    }

    var url = POKEMON_API + '/cards?q=' + encodeURIComponent(apiQuery) + '&page=' + page + '&pageSize=' + pageSize + '&orderBy=name';
    console.log('API URL:', url);

    httpGet(url).then(function(result) {
        if (result.status < 200 || result.status >= 300) {
            console.error('API error status:', result.status);
            return res.status(500).json({ success: false, error: 'API error', message: 'Status ' + result.status });
        }

        var json = result.data;
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
    }).catch(function(err) {
        console.error('Error en busqueda:', err.message);
        res.status(500).json({ success: false, error: 'Error en busqueda', message: err.message });
    });
});

// SETS
app.get('/api/pokemontcg/sets', function(req, res) {
    httpGet(POKEMON_API + '/sets?orderBy=releaseDate').then(function(result) {
        var sets = (result.data.data || []).map(function(s) {
            return { id: s.id, name: s.name, series: s.series || '', cardCount: s.total || 0, source: 'pokemontcg' };
        });
        res.json({ success: true, data: sets, count: sets.length });
    }).catch(function(err) {
        res.status(500).json({ success: false, error: 'Error sets', message: err.message });
    });
});

// TYPES
app.get('/api/pokemontcg/types', function(req, res) {
    httpGet(POKEMON_API + '/types').then(function(result) {
        var types = (result.data.data || []).map(function(t) {
            return { id: t.toLowerCase(), name: t };
        });
        res.json({ success: true, data: types, count: types.length });
    }).catch(function(err) {
        res.status(500).json({ success: false, error: 'Error types', message: err.message });
    });
});

// RARITIES
app.get('/api/pokemontcg/rarities', function(req, res) {
    httpGet(POKEMON_API + '/rarities').then(function(result) {
        var rarities = (result.data.data || []).map(function(r) {
            return { id: r.toLowerCase().replace(/\s+/g, '-'), name: r };
        });
        res.json({ success: true, data: rarities, count: rarities.length });
    }).catch(function(err) {
        res.status(500).json({ success: false, error: 'Error rarities', message: err.message });
    });
});

// SUBTYPES
app.get('/api/pokemontcg/subtypes', function(req, res) {
    httpGet(POKEMON_API + '/subtypes').then(function(result) {
        var subtypes = (result.data.data || []).map(function(s) {
            return { id: s.toLowerCase().replace(/\s+/g, '-'), name: s };
        });
        res.json({ success: true, data: subtypes, count: subtypes.length });
    }).catch(function(err) {
        res.status(500).json({ success: false, error: 'Error subtypes', message: err.message });
    });
});

// LANGUAGES
app.get('/api/pokemontcg/languages', function(req, res) {
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
app.get('/api/pokemontcg/series', function(req, res) {
    httpGet(POKEMON_API + '/sets?orderBy=releaseDate').then(function(result) {
        var seriesMap = {};
        (result.data.data || []).forEach(function(s) {
            if (s.series) {
                if (!seriesMap[s.series]) {
                    seriesMap[s.series] = { name: s.series, cardCount: 0 };
                }
                seriesMap[s.series].cardCount += (s.total || 0);
            }
        });
        var series = Object.values(seriesMap).map(function(s) {
            return { id: s.name.toLowerCase().replace(/\s+/g, '-'), name: s.name, cardCount: s.cardCount };
        });
        res.json({ success: true, data: series, count: series.length });
    }).catch(function(err) {
        res.status(500).json({ success: false, error: 'Error series', message: err.message });
    });
});

// EXPORTS
app.get('/api/exports', function(req, res) {
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
        res.status(500).json({ error: 'Error exports', message: error.message });
    }
});

// Arrancar servidor
app.listen(PORT, '0.0.0.0', function() {
    console.log('Servidor en puerto ' + PORT);
});
