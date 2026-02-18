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
// BUSQUEDA DE CARTAS via PostgreSQL database
// =============================================
app.get('/api/pokemontcg/cards', async function(req, res) {
    var searchTerm = req.query.q || '';
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 20;
    console.log('Busqueda:', searchTerm, 'page:', page, 'pageSize:', pageSize);

    const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });
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

            // Simplificar: devolver datos básicos de carta con set name (sin series por ahora)
            var cards = pagedCards.map(function(card) {
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
                    set: {
                        id: (card.set && card.set.id) || '',
                        name: (card.set && card.set.name) || '',
                        series: '' // Temporalmente vacío hasta arreglar
                    }
                };
            });

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

// Endpoint de diagnóstico
app.get('/api/pokemontcg/test-connection', function(req, res) {
    res.json({
        success: true,
        message: 'Servidor funcionando correctamente',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: process.env.DATABASE_URL ? 'Configurada' : 'No configurada',
        pokemonApi: process.env.POKEMON_TCG_API_KEY ? 'Configurada' : 'No configurada'
    });
});

// Endpoint de migración (temporal - eliminar después de usar)
app.post('/api/pokemontcg/migrate', async function(req, res) {
    console.log('🚀 Iniciando migración desde Railway...');
    
    try {
        // Importar funciones de migración
        const { Pool } = require('pg');
        const https = require('https');
        
        // Usar variable personalizada que Railway no controle
        const customDbUrl = process.env.CUSTOM_DATABASE_URL || process.env.DATABASE_URL;
        console.log('🔍 CUSTOM_DATABASE_URL:', process.env.CUSTOM_DATABASE_URL ? 'Configurada' : 'No configurada');
        console.log('🔍 DATABASE_URL:', process.env.DATABASE_URL ? 'Configurada' : 'No configurada');
        console.log('🔍 URL que se usará:', customDbUrl);
        
        const pool = new Pool({
            connectionString: customDbUrl,
            ssl: { rejectUnauthorized: false }
        });
        
        // Helper para API
        function pokemonApiGet(endpoint) {
            return new Promise((resolve, reject) => {
                const url = 'https://api.pokemontcg.io/v2' + endpoint;
                const options = {
                    headers: {
                        'X-Api-Key': process.env.POKEMON_TCG_API_KEY,
                        'User-Agent': 'TCGtrade-Migration/1.0'
                    }
                };
                
                const req = https.get(url, options, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            try {
                                resolve(JSON.parse(body));
                            } catch (e) {
                                reject(new Error('JSON parse error'));
                            }
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}`));
                        }
                    });
                });
                
                req.on('error', reject);
                req.setTimeout(30000, () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
            });
        }
        
        // Limpiar BD
        await pool.query('DROP TABLE IF EXISTS cards CASCADE');
        await pool.query('DROP TABLE IF EXISTS sets CASCADE');
        await pool.query('DROP TABLE IF EXISTS series CASCADE');
        await pool.query('DROP TABLE IF EXISTS types CASCADE');
        await pool.query('DROP TABLE IF EXISTS rarities CASCADE');
        
        // Crear tablas
        await pool.query(`
            CREATE TABLE series (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                logo VARCHAR(255)
            )
        `);
        
        await pool.query(`
            CREATE TABLE sets (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                series_id VARCHAR(50) REFERENCES series(id),
                printed_total INTEGER,
                total INTEGER,
                release_date DATE,
                logo VARCHAR(255),
                symbol VARCHAR(255)
            )
        `);
        
        await pool.query(`
            CREATE TABLE types (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(50) NOT NULL
            )
        `);
        
        await pool.query(`
            CREATE TABLE rarities (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(50) NOT NULL
            )
        `);
        
        await pool.query(`
            CREATE TABLE cards (
                id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                number VARCHAR(20),
                set_id VARCHAR(50) REFERENCES sets(id),
                rarity_id VARCHAR(50) REFERENCES rarities(id),
                hp INTEGER,
                types TEXT[],
                subtypes TEXT[],
                rules TEXT[],
                images JSONB,
                tcgplayer JSONB,
                cardmarket JSONB,
                legal JSONB,
                artist VARCHAR(100),
                flavor_text TEXT,
                national_pokedex_numbers INTEGER[],
                attacks JSONB,
                weaknesses JSONB,
                resistances JSONB,
                retreat_cost TEXT[],
                converted_retreat_cost INTEGER
            )
        `);
        
        // Migrar series
        console.log('📚 Migrando series...');
        const seriesData = await pokemonApiGet('/series');
        for (const series of seriesData.data) {
            await pool.query(
                'INSERT INTO series (id, name, logo) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [series.id, series.name, series.logo]
            );
        }
        
        // Migrar sets
        console.log('📦 Migrando sets...');
        let allSets = [];
        let page = 1;
        let pageSize = 250;
        let hasMore = true;
        
        while (hasMore) {
            const setsData = await pokemonApiGet(`/sets?page=${page}&pageSize=${pageSize}`);
            allSets = allSets.concat(setsData.data);
            hasMore = setsData.data.length === pageSize;
            page++;
            if (hasMore) await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        for (const set of allSets) {
            await pool.query(`
                INSERT INTO sets (id, name, series_id, printed_total, total, release_date, logo, symbol)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING
            `, [set.id, set.name, set.series.id, set.printedTotal, set.total, set.releaseDate, set.logo, set.symbol]);
        }
        
        // Migrar tipos y rarezas
        console.log('🏷️ Migrando tipos y rarezas...');
        const typesData = await pokemonApiGet('/types');
        for (const type of typesData.data) {
            await pool.query('INSERT INTO types (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [type.toLowerCase(), type]);
        }
        
        const raritiesData = await pokemonApiGet('/rarities');
        for (const rarity of raritiesData.data) {
            const rarityId = rarity.toLowerCase().replace(/\s+/g, '-');
            await pool.query('INSERT INTO rarities (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [rarityId, rarity]);
        }
        
        // Migrar cartas (limitado a 100 por tiempo para evitar timeout)
        console.log('🃏 Migrando primeras 100 cartas...');
        const cardsData = await pokemonApiGet('/cards?pageSize=100');
        let cardsMigrated = 0;
        
        // Preparar todos los inserts en batch para mayor eficiencia
        const cardValues = cardsData.data.map(card => {
            const types = card.types || [];
            const subtypes = card.subtypes || [];
            const rules = card.rules || [];
            const nationalPokedexNumbers = card.nationalPokedexNumbers || [];
            const retreatCost = card.retreatCost || [];
            const rarityId = card.rarity ? card.rarity.toLowerCase().replace(/\s+/g, '-') : null;
            
            return [
                card.id, card.name, card.number, card.set.id, rarityId, card.hp,
                JSON.stringify(types), JSON.stringify(subtypes), JSON.stringify(rules),
                JSON.stringify(card.images), JSON.stringify(card.tcgplayer), JSON.stringify(card.cardmarket),
                JSON.stringify(card.legal), card.artist, card.flavorText, JSON.stringify(nationalPokedexNumbers),
                JSON.stringify(card.attacks), JSON.stringify(card.weaknesses), JSON.stringify(card.resistances),
                JSON.stringify(retreatCost), card.convertedRetreatCost
            ];
        });
        
        // Insertar en batch
        for (const values of cardValues) {
            await pool.query(`
                INSERT INTO cards (
                    id, name, number, set_id, rarity_id, hp, types, subtypes,
                    rules, images, tcgplayer, cardmarket, legal, artist,
                    flavor_text, national_pokedex_numbers, attacks, weaknesses,
                    resistances, retreat_cost, converted_retreat_cost
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14, $15, $16::jsonb, $17::jsonb, $18::jsonb, $19::jsonb, $20::jsonb, $21)
                ON CONFLICT DO NOTHING
            `, values);
            
            cardsMigrated++;
        }
        
        // Estadísticas
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM series) as series_count,
                (SELECT COUNT(*) FROM sets) as sets_count,
                (SELECT COUNT(*) FROM types) as types_count,
                (SELECT COUNT(*) FROM rarities) as rarities_count,
                (SELECT COUNT(*) FROM cards) as cards_count
        `);
        
        const s = stats.rows[0];
        
        await pool.end();
        
        res.json({
            success: true,
            message: 'Migración completada',
            stats: {
                series: s.series_count,
                sets: s.sets_count,
                types: s.types_count,
                rarities: s.rarities_count,
                cards: s.cards_count
            },
            note: 'Solo se migraron las primeras 100 cartas por tiempo. Ejecutar nuevamente para más.'
        });
        
    } catch (error) {
        console.error('❌ Error en migración:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
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
