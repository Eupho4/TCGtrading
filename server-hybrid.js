require('dotenv').config();
var express = require('express');
var cors = require('cors');
var path = require('path');
var https = require('https');

process.on('uncaughtException', function(err) {
    console.error('uncaughtException:', err.message);
});
process.on('unhandledRejection', function(reason) {
    console.error('unhandledRejection:', reason);
});

// Helper: GET request a cualquier URL HTTPS y devolver body como string
function httpsGet(url) {
    return new Promise(function(resolve, reject) {
        https.get(url, function(res) {
            var body = '';
            res.on('data', function(c) { body += c; });
            res.on('end', function() { resolve({ status: res.statusCode, body: body }); });
        }).on('error', function(e) { reject(e); });
    });
}

// Cache para sets y series (se carga al inicio)
var setsCache = null;
var seriesCache = null;

function loadSetsAndSeries() {
    return Promise.all([
        httpsGet('https://api.tcgdex.net/v2/en/sets'),
        httpsGet('https://api.tcgdex.net/v2/en/series')
    ]).then(function(results) {
        var setsData = JSON.parse(results[0].body);
        var seriesData = JSON.parse(results[1].body);
        
        // Crear mapa de set -> serie
        setsCache = {};
        seriesCache = {};
        
        if (Array.isArray(seriesData)) {
            seriesData.forEach(function(s) {
                seriesCache[s.id] = s.name || '';
            });
        }
        
        if (Array.isArray(setsData)) {
            setsData.forEach(function(set) {
                setsCache[set.id] = {
                    name: set.name || '',
                    series: (set.serie && set.serie.name) || ''
                };
            });
        }
        
        console.log('Sets cargados:', Object.keys(setsCache).length);
        console.log('Series cargadas:', Object.keys(seriesCache).length);
    });
}

// Inicializar cache al arrancar
loadSetsAndSeries();

var app = express();
var PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('html'));
app.use('/js', express.static('js'));
app.use('/css', express.static('css'));
app.use('/images', express.static('images'));
app.use('/exports', express.static('exported_data'));

app.get('/api/health', function(req, res) {
    res.json({ status: 'ok', version: 'v12-tcgdex', timestamp: new Date().toISOString() });
});

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'html', 'index.html'));
});

app.get('/api/status', function(req, res) {
    res.json({ status: 'online', timestamp: new Date().toISOString(), searchEngine: 'TCGdex API' });
});

// =============================================
// BUSQUEDA DE CARTAS via TCGdex
// =============================================
app.get('/api/pokemontcg/cards', function(req, res) {
    var searchTerm = req.query.q || '';
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 20;
    console.log('Busqueda:', searchTerm, 'page:', page, 'pageSize:', pageSize);

    // Esperar a que el cache esté listo
    if (!setsCache) {
        return res.status(503).json({ success: false, error: 'Loading sets cache, please retry' });
    }

    // TCGdex: buscar por nombre
    var tcgdexUrl = 'https://api.tcgdex.net/v2/en/cards';
    if (searchTerm && searchTerm.trim()) {
        // Si es una query tipo set.id:xxx, buscar por set
        if (searchTerm.indexOf('set.id:') === 0) {
            var setId = searchTerm.replace('set.id:', '');
            tcgdexUrl = 'https://api.tcgdex.net/v2/en/sets/' + setId;
        } else {
            tcgdexUrl = 'https://api.tcgdex.net/v2/en/cards?name=' + encodeURIComponent(searchTerm);
        }
    }

    console.log('TCGdex URL:', tcgdexUrl);

    httpsGet(tcgdexUrl).then(function(result) {
        if (result.status !== 200) {
            console.error('TCGdex error:', result.status, result.body.substring(0, 200));
            return res.status(500).json({ success: false, error: 'TCGdex error ' + result.status });
        }

        var json;
        try { json = JSON.parse(result.body); } catch(e) {
            return res.status(500).json({ success: false, error: 'JSON parse error' });
        }

        // TCGdex devuelve array de cartas o un set con cards
        var rawCards = [];
        if (Array.isArray(json)) {
            rawCards = json;
        } else if (json.cards) {
            rawCards = json.cards;
        }

        var totalCount = rawCards.length;

        // Paginacion manual
        var startIdx = (page - 1) * pageSize;
        var pagedCards = rawCards.slice(startIdx, startIdx + pageSize);

        // Obtener sets únicos para no repetir peticiones
        var uniqueSetIds = [];
        pagedCards.forEach(function(card) {
            if (card.set && card.set.id && uniqueSetIds.indexOf(card.set.id) === -1) {
                uniqueSetIds.push(card.set.id);
            }
        });
        var setPromises = uniqueSetIds.map(function(setId) {
            return httpsGet('https://api.tcgdex.net/v2/en/sets/' + setId).then(function(result) {
                if (result.status === 200) {
                    var setInfo = JSON.parse(result.body);
                    return {
                        id: setId,
                        name: setInfo.name || '',
                        series: (setInfo.serie && setInfo.serie.name) || ''
                    };
                }
                return { id: setId, name: '', series: '' };
            }).catch(function() {
                return { id: setId, name: '', series: '' };
            });
        });

        // Esperar a que todos los sets se carguen
        return Promise.all(setPromises).then(function(setsInfo) {
            var setsMap = {};
            setsInfo.forEach(function(set) {
                setsMap[set.id] = set;
            });

            // Ahora obtener detalles de cada carta
            var cardPromises = pagedCards.map(function(card) {
                return httpsGet('https://api.tcgdex.net/v2/en/cards/' + card.id).then(function(detailResult) {
                    if (detailResult.status !== 200) {
                        // Fallback a datos basicos
                        var imageUrl = card.image || '';
                        if (imageUrl && imageUrl.indexOf('/high') === -1) {
                            imageUrl = imageUrl + '/high.webp';
                        }
                        return {
                            id: card.id || '',
                            name: card.name || '',
                            number: card.localId || '',
                            rarity: 'Unknown',
                            types: [],
                            subtypes: [],
                            images: {
                                small: imageUrl.replace('/high.webp', '/low.webp'),
                                large: imageUrl
                            },
                            tcgplayer: {},
                            cardmarket: {},
                            set: { id: '', name: '', series: '' }
                        };
                    }
                    
                    var detail = JSON.parse(detailResult.body);
                    var imageUrl = detail.image || '';
                    if (imageUrl && imageUrl.indexOf('/high') === -1) {
                        imageUrl = imageUrl + '/high.webp';
                    }
                    
                    var setId = (detail.set && detail.set.id) || '';
                    var setInfo = setsMap[setId] || {};
                    
                    console.log('Card:', detail.name, 'SetId:', setId, 'Series:', setInfo.series);
                    
                    return {
                        id: detail.id || '',
                        name: detail.name || '',
                        number: detail.localId || '',
                        rarity: detail.rarity || 'Unknown',
                        types: detail.types || [],
                        subtypes: detail.subtypes || [],
                        images: {
                            small: imageUrl.replace('/high.webp', '/low.webp'),
                            large: imageUrl
                        },
                        tcgplayer: detail.pricing && detail.pricing.tcgplayer || {},
                        cardmarket: detail.pricing && detail.pricing.cardmarket || {},
                        set: {
                            id: setId,
                            name: setInfo.name || (detail.set && detail.set.name) || '',
                            series: setInfo.series
                        }
                    };
                }).catch(function(err) {
                    console.error('Error detalle carta', card.id, err.message);
                    // Devolver carta basica
                    var imageUrl = card.image || '';
                    if (imageUrl && imageUrl.indexOf('/high') === -1) {
                        imageUrl = imageUrl + '/high.webp';
                    }
                    return {
                        id: card.id || '',
                        name: card.name || '',
                        number: card.localId || '',
                        rarity: 'Unknown',
                        types: [],
                        subtypes: [],
                        images: {
                            small: imageUrl.replace('/high.webp', '/low.webp'),
                            large: imageUrl
                        },
                        tcgplayer: {},
                        cardmarket: {},
                        set: { id: '', name: '', series: '' }
                    };
                });
            });

            return Promise.all(cardPromises).then(function(cards) {
            console.log('Encontradas', cards.length, 'de', totalCount, 'total');
            res.json({
                success: true,
                data: cards,
                totalCount: totalCount,
                page: page,
                pageSize: pageSize,
                totalPages: Math.ceil(totalCount / pageSize)
            });
        });

    }).catch(function(err) {
        console.error('Error busqueda:', err.message);
        res.status(500).json({ success: false, error: err.message });
    });
});

// =============================================
// SETS via TCGdex
// =============================================
app.get('/api/pokemontcg/sets', function(req, res) {
    httpsGet('https://api.tcgdex.net/v2/en/sets').then(function(result) {
        var json = JSON.parse(result.body);
        var sets = (Array.isArray(json) ? json : []).map(function(s) {
            return {
                id: s.id || '',
                name: s.name || '',
                series: s.serie ? s.serie.name || '' : '',
                cardCount: (s.cardCount && s.cardCount.total) || 0,
                releaseDate: '',
                logo: s.logo || ''
            };
        });
        res.json({ success: true, data: sets, count: sets.length });
    }).catch(function(err) {
        res.status(500).json({ success: false, error: err.message });
    });
});

// =============================================
// TYPES via TCGdex
// =============================================
app.get('/api/pokemontcg/types', function(req, res) {
    httpsGet('https://api.tcgdex.net/v2/en/types').then(function(result) {
        var json = JSON.parse(result.body);
        var types = (Array.isArray(json) ? json : []).map(function(t) {
            return { id: (typeof t === 'string' ? t.toLowerCase() : t), name: (typeof t === 'string' ? t : t.name || '') };
        });
        res.json({ success: true, data: types, count: types.length });
    }).catch(function(err) {
        res.status(500).json({ success: false, error: err.message });
    });
});

// =============================================
// RARITIES via TCGdex
// =============================================
app.get('/api/pokemontcg/rarities', function(req, res) {
    httpsGet('https://api.tcgdex.net/v2/en/rarities').then(function(result) {
        var json = JSON.parse(result.body);
        var rarities = (Array.isArray(json) ? json : []).map(function(r) {
            return { id: (typeof r === 'string' ? r.toLowerCase().replace(/\s+/g, '-') : r), name: (typeof r === 'string' ? r : r.name || '') };
        });
        res.json({ success: true, data: rarities, count: rarities.length });
    }).catch(function(err) {
        res.status(500).json({ success: false, error: err.message });
    });
});

// SUBTYPES
app.get('/api/pokemontcg/subtypes', function(req, res) {
    res.json({ success: true, data: [], count: 0 });
});

// LANGUAGES
app.get('/api/pokemontcg/languages', function(req, res) {
    res.json({
        success: true,
        data: [
            { code: 'en', name: 'English' }, { code: 'es', name: 'Espanol' },
            { code: 'fr', name: 'Francais' }, { code: 'de', name: 'Deutsch' },
            { code: 'it', name: 'Italiano' }, { code: 'pt', name: 'Portugues' },
            { code: 'ja', name: 'Japones' }, { code: 'ko', name: 'Coreano' }
        ],
        count: 8
    });
});

// =============================================
// SERIES via TCGdex
// =============================================
app.get('/api/pokemontcg/series', function(req, res) {
    httpsGet('https://api.tcgdex.net/v2/en/series').then(function(result) {
        var json = JSON.parse(result.body);
        var series = (Array.isArray(json) ? json : []).map(function(s) {
            return { id: s.id || '', name: s.name || '', logo: s.logo || '' };
        });
        res.json({ success: true, data: series, count: series.length });
    }).catch(function(err) {
        res.status(500).json({ success: false, error: err.message });
    });
});

// EXPORTS
app.get('/api/exports', function(req, res) {
    var fs = require('fs');
    try {
        var dir = path.join(__dirname, 'exported_data');
        if (!fs.existsSync(dir)) return res.json({ totalFiles: 0, files: [] });
        var files = fs.readdirSync(dir).map(function(f) {
            return { name: f, size: fs.statSync(path.join(dir, f)).size, downloadUrl: '/exports/' + f };
        });
        res.json({ totalFiles: files.length, files: files });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Test de conexion
app.get('/api/test-connection', function(req, res) {
    httpsGet('https://api.tcgdex.net/v2/en/cards?name=pikachu').then(function(result) {
        res.json({ ok: result.status === 200, status: result.status, bodyLength: result.body.length, preview: result.body.substring(0, 200) });
    }).catch(function(err) {
        res.json({ ok: false, error: err.message });
    });
});

app.listen(PORT, '0.0.0.0', function() {
    console.log('Servidor TCGdex proxy en puerto ' + PORT);
});
