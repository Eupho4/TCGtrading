require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');

// Configuración de PostgreSQL local
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Configuración de Pokémon TCG API
const POKEMON_API = 'https://api.pokemontcg.io/v2';
const API_KEY = process.env.POKEMON_TCG_API_KEY;

// Helper para hacer peticiones a Pokémon TCG API
function pokemonApiGet(endpoint) {
    return new Promise((resolve, reject) => {
        const url = POKEMON_API + endpoint;
        const options = {
            headers: {
                'X-Api-Key': API_KEY
            }
        };
        
        const req = https.get(url, options, function(res) {
            let body = '';
            res.on('data', function(c) { body += c; });
            res.on('end', function() { 
                if (res.statusCode === 200) {
                    resolve(JSON.parse(body)); 
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });
        
        req.on('error', function(e) { reject(e); });
        req.setTimeout(30000, function() { 
            req.destroy(); 
            reject(new Error('Timeout after 30s')); 
        });
    });
}

// Función para reintentar peticiones
async function retryApiCall(endpoint, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Espera progresiva
            return await pokemonApiGet(endpoint);
        } catch (error) {
            console.log(`Intento ${i + 1} fallido para ${endpoint}: ${error.message}`);
            if (i === maxRetries - 1) throw error;
        }
    }
}

// Limpiar base de datos
async function cleanDatabase() {
    console.log('🧹 Limpiando base de datos existente...');
    await pool.query('DROP TABLE IF EXISTS cards CASCADE');
    await pool.query('DROP TABLE IF EXISTS sets CASCADE');
    await pool.query('DROP TABLE IF EXISTS series CASCADE');
    await pool.query('DROP TABLE IF EXISTS types CASCADE');
    await pool.query('DROP TABLE IF EXISTS rarities CASCADE');
    console.log('✅ Base de datos limpiada');
}

// Crear estructura de tablas
async function createTables() {
    console.log('🏗️ Creando estructura de tablas...');
    
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
    
    // Índices para mejor rendimiento
    await pool.query('CREATE INDEX idx_cards_name ON cards(name)');
    await pool.query('CREATE INDEX idx_cards_set_id ON cards(set_id)');
    await pool.query('CREATE INDEX idx_cards_types ON cards USING GIN(types)');
    await pool.query('CREATE INDEX idx_sets_series_id ON sets(series_id)');
    
    console.log('✅ Tablas creadas con índices');
}

// Migrar series (desde sets)
async function migrateSeries() {
    console.log('📚 Migrando series...');
    
    try {
        const setsData = await retryApiCall('/sets?page=1&pageSize=1000');
        console.log(`📊 Encontrados ${setsData.data.length} sets`);
        
        // Extraer series únicas de los sets
        const uniqueSeries = new Map();
        for (const set of setsData.data) {
            if (set.series && !uniqueSeries.has(set.series.id)) {
                uniqueSeries.set(set.series.id, {
                    id: set.series.id,
                    name: set.series.name,
                    logo: set.series.logo || ''
                });
            }
        }
        
        // Insertar series
        for (const [id, series] of uniqueSeries) {
            await pool.query(`
                INSERT INTO series (id, name, logo) 
                VALUES ($1, $2, $3)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    logo = EXCLUDED.logo
            `, [series.id, series.name, series.logo]);
        }
        
        console.log(`✅ ${uniqueSeries.size} series migradas`);
        return uniqueSeries.size;
        
    } catch (error) {
        console.error('❌ Error migrando series:', error.message);
        throw error;
    }
}

// Migrar sets
async function migrateSets() {
    console.log('📦 Migrando sets...');
    
    try {
        let allSets = [];
        let page = 1;
        let pageSize = 250;
        let hasMore = true;
        
        while (hasMore) {
            console.log(`📄 Cargando página ${page} de sets...`);
            const setsData = await retryApiCall(`/sets?page=${page}&pageSize=${pageSize}`);
            
            allSets = allSets.concat(setsData.data);
            hasMore = setsData.data.length === pageSize;
            page++;
            
            // Pausa para no sobrecargar la API
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`📊 Total de sets a migrar: ${allSets.length}`);
        
        let setsMigrated = 0;
        for (const set of allSets) {
            await pool.query(`
                INSERT INTO sets (id, name, series_id, printed_total, total, release_date, logo, symbol)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    series_id = EXCLUDED.series_id,
                    printed_total = EXCLUDED.printed_total,
                    total = EXCLUDED.total,
                    release_date = EXCLUDED.release_date,
                    logo = EXCLUDED.logo,
                    symbol = EXCLUDED.symbol
            `, [
                set.id, set.name, set.series.id, set.printedTotal, set.total,
                set.releaseDate, set.logo, set.symbol
            ]);
            
            setsMigrated++;
            if (setsMigrated % 50 === 0) {
                console.log(`📈 Sets migrados: ${setsMigrated}/${allSets.length}`);
            }
        }
        
        console.log(`✅ ${setsMigrated} sets migrados`);
        return setsMigrated;
        
    } catch (error) {
        console.error('❌ Error migrando sets:', error.message);
        throw error;
    }
}

// Migrar tipos
async function migrateTypes() {
    console.log('🏷️ Migrando tipos...');
    
    try {
        const typesData = await retryApiCall('/types');
        console.log(`📊 Encontrados ${typesData.data.length} tipos`);
        
        for (const type of typesData.data) {
            await pool.query(
                'INSERT INTO types (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name',
                [type.toLowerCase(), type]
            );
        }
        
        console.log(`✅ ${typesData.data.length} tipos migrados`);
        return typesData.data.length;
        
    } catch (error) {
        console.error('❌ Error migrando tipos:', error.message);
        throw error;
    }
}

// Migrar rarezas
async function migrateRarities() {
    console.log('💎 Migrando rarezas...');
    
    try {
        const raritiesData = await retryApiCall('/rarities');
        console.log(`📊 Encontrados ${raritiesData.data.length} rarezas`);
        
        for (const rarity of raritiesData.data) {
            const rarityId = rarity.toLowerCase().replace(/\s+/g, '-');
            await pool.query(
                'INSERT INTO rarities (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name',
                [rarityId, rarity]
            );
        }
        
        console.log(`✅ ${raritiesData.data.length} rarezas migradas`);
        return raritiesData.data.length;
        
    } catch (error) {
        console.error('❌ Error migrando rarezas:', error.message);
        throw error;
    }
}

// Migrar cartas
async function migrateCards() {
    console.log('🃏 Migrando cartas...');
    
    try {
        let totalCards = 0;
        let page = 1;
        let pageSize = 250;
        let hasMore = true;
        let errors = 0;
        
        while (hasMore) {
            try {
                console.log(`📄 Cargando página ${page} de cartas...`);
                const cardsData = await retryApiCall(`/cards?page=${page}&pageSize=${pageSize}`);
                
                console.log(`📊 Procesando ${cardsData.data.length} cartas de la página ${page}`);
                
                for (const card of cardsData.data) {
                    try {
                        const rarityId = card.rarity ? card.rarity.toLowerCase().replace(/\s+/g, '-') : null;
                        
                        // Procesar imágenes - asegurarse que existan
                        let images = {};
                        if (card.images) {
                            images = {
                                small: card.images.small || '',
                                large: card.images.large || ''
                            };
                        }
                        
                        await pool.query(`
                            INSERT INTO cards (
                                id, name, number, set_id, rarity_id, hp, types, subtypes,
                                rules, images, tcgplayer, cardmarket, legal, artist,
                                flavor_text, national_pokedex_numbers, attacks, weaknesses,
                                resistances, retreat_cost, converted_retreat_cost
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                            ON CONFLICT (id) DO UPDATE SET
                                name = EXCLUDED.name,
                                number = EXCLUDED.number,
                                set_id = EXCLUDED.set_id,
                                rarity_id = EXCLUDED.rarity_id,
                                hp = EXCLUDED.hp,
                                types = EXCLUDED.types,
                                subtypes = EXCLUDED.subtypes,
                                rules = EXCLUDED.rules,
                                images = EXCLUDED.images,
                                tcgplayer = EXCLUDED.tcgplayer,
                                cardmarket = EXCLUDED.cardmarket,
                                legal = EXCLUDED.legal,
                                artist = EXCLUDED.artist,
                                flavor_text = EXCLUDED.flavor_text,
                                national_pokedex_numbers = EXCLUDED.national_pokedex_numbers,
                                attacks = EXCLUDED.attacks,
                                weaknesses = EXCLUDED.weaknesses,
                                resistances = EXCLUDED.resistances,
                                retreat_cost = EXCLUDED.retreat_cost,
                                converted_retreat_cost = EXCLUDED.converted_retreat_cost
                        `, [
                            card.id, card.name, card.number, card.set.id, rarityId, card.hp,
                            card.types || [], card.subtypes || [], card.rules || [],
                            JSON.stringify(images), JSON.stringify(card.tcgplayer || {}), JSON.stringify(card.cardmarket || {}), JSON.stringify(card.legal || {}),
                            card.artist, card.flavorText || '', card.nationalPokedexNumbers || [],
                            JSON.stringify(card.attacks || []), JSON.stringify(card.weaknesses || []), JSON.stringify(card.resistances || []),
                            card.retreatCost || [], card.convertedRetreatCost
                        ]);
                        
                        totalCards++;
                        
                        if (totalCards % 100 === 0) {
                            console.log(`📈 Cartas migradas: ${totalCards}`);
                        }
                        
                    } catch (cardError) {
                        errors++;
                        if (errors <= 10) {
                            console.log(`⚠️ Error en carta ${card.id}: ${cardError.message}`);
                        }
                    }
                }
                
                hasMore = cardsData.data.length === pageSize;
                page++;
                
                // Pausa más larga para no sobrecargar la API
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (pageError) {
                console.error(`❌ Error en página ${page}: ${pageError.message}`);
                // Reintentar la página
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        console.log(`✅ ${totalCards} cartas migradas (${errors} errores)`);
        return totalCards;
        
    } catch (error) {
        console.error('❌ Error migrando cartas:', error.message);
        throw error;
    }
}

// Función principal de migración
async function fullMigration() {
    console.log('🚀 Iniciando migración COMPLETA de Pokémon TCG a PostgreSQL');
    console.log('📅 Fecha:', new Date().toISOString());
    
    try {
        // Verificar API Key
        if (!API_KEY) {
            throw new Error('❌ POKEMON_TCG_API_KEY no está configurada en .env');
        }
        
        console.log('✅ API Key configurada');
        
        // Probar conexión a API
        console.log('🔍 Probando conexión a Pokémon TCG API...');
        await retryApiCall('/types');
        console.log('✅ Conexión a API funcionando');
        
        // Conectar a BD
        await pool.query('SELECT 1');
        console.log('✅ Conexión a PostgreSQL establecida');
        
        // Limpiar y crear estructura
        await cleanDatabase();
        await createTables();
        
        // Migrar en orden
        console.log('\n📋 Iniciando migración secuencial...');
        const seriesCount = await migrateSeries();
        const setsCount = await migrateSets();
        const typesCount = await migrateTypes();
        const raritiesCount = await migrateRarities();
        const cardsCount = await migrateCards();
        
        // Estadísticas finales
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM series) as series_count,
                (SELECT COUNT(*) FROM sets) as sets_count,
                (SELECT COUNT(*) FROM types) as types_count,
                (SELECT COUNT(*) FROM rarities) as rarities_count,
                (SELECT COUNT(*) FROM cards) as cards_count
        `);
        
        const s = stats.rows[0];
        
        console.log('\n🎉 MIGRACIÓN COMPLETA FINALIZADA');
        console.log('📊 Estadísticas finales:');
        console.log(`  - Series: ${s.series_count}`);
        console.log(`  - Sets: ${s.sets_count}`);
        console.log(`  - Tipos: ${s.types_count}`);
        console.log(`  - Rarezas: ${s.rarities_count}`);
        console.log(`  - Cartas: ${s.cards_count}`);
        
        console.log('\n🌐 Ahora puedes:');
        console.log('1. Iniciar el servidor: node server-hybrid.js');
        console.log('2. Abrir http://localhost:3000');
        console.log('3. Buscar cualquier carta de Pokémon TCG');
        console.log('\n🔍 Búsquedas de ejemplo:');
        console.log('- "pikachu" → Todas las variantes de Pikachu');
        console.log('- "charizard" → Todos los Charizard');
        console.log('- "fire" → Todas las cartas de tipo Fuego');
        console.log('- "scarlet" → Todas las cartas de Scarlet & Violet');
        
    } catch (error) {
        console.error('❌ ERROR EN MIGRACIÓN:', error.message);
        if (error.message.includes('HTTP 429')) {
            console.log('💡 La API ha alcanzado el límite de peticiones. Espera unos minutos y vuelve a intentar.');
        }
        throw error;
    } finally {
        await pool.end();
    }
}

// Ejecutar migración
fullMigration().catch(console.error);
