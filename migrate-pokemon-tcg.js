require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');

// Configuración de PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Configuración de Pokémon TCG API
const POKEMON_API = 'https://api.pokemontcg.io/v2';
const API_KEY = process.env.POKEMON_TCG_API_KEY;

// Helper para hacer peticiones a Pokémon TCG API
function pokemonApiGet(endpoint) {
    return new Promise((resolve, reject) => {
        const url = POKEMON_API + endpoint;
        console.log('📡 API GET:', url);

        const options = {
            headers: {
                'X-Api-Key': API_KEY,
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
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
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

// Limpiar base de datos existente
async function cleanDatabase() {
    console.log('🧹 Limpiando base de datos existente...');
    
    try {
        // Eliminar tablas en orden correcto (por foreign keys)
        await pool.query('DROP TABLE IF EXISTS cards CASCADE');
        await pool.query('DROP TABLE IF EXISTS sets CASCADE');
        await pool.query('DROP TABLE IF EXISTS series CASCADE');
        await pool.query('DROP TABLE IF EXISTS types CASCADE');
        await pool.query('DROP TABLE IF EXISTS rarities CASCADE');
        
        console.log('✅ Base de datos limpiada');
    } catch (error) {
        console.error('❌ Error limpiando BD:', error.message);
        throw error;
    }
}

// Crear estructura de tablas
async function createTables() {
    console.log('🏗️ Creando estructura de tablas...');
    
    try {
        // Tabla de series
        await pool.query(`
            CREATE TABLE series (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                logo VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabla de sets
        await pool.query(`
            CREATE TABLE sets (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                series_id VARCHAR(50) REFERENCES series(id),
                printed_total INTEGER,
                total INTEGER,
                release_date DATE,
                logo VARCHAR(255),
                symbol VARCHAR(255),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabla de tipos
        await pool.query(`
            CREATE TABLE types (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabla de rarezas
        await pool.query(`
            CREATE TABLE rarities (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabla de cartas (la principal)
        await pool.query(`
            CREATE TABLE cards (
                id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                number VARCHAR(20),
                set_id VARCHAR(50) REFERENCES sets(id),
                rarity_id VARCHAR(50) REFERENCES rarities(id),
                hp INTEGER,
                types TEXT[], -- Array de tipos
                subtypes TEXT[], -- Array de subtipos
                rules TEXT[], -- Array de reglas
                images JSONB, -- {small: "", large: ""}
                tcgplayer JSONB, -- Datos de precios tcgplayer
                cardmarket JSONB, -- Datos de precios cardmarket
                legal JSONB, -- {standard: boolean, expanded: boolean}
                artist VARCHAR(100),
                flavor_text TEXT,
                national_pokedex_numbers INTEGER[], -- Array de números de pokédex
                attacks JSONB, -- Array de ataques
                weaknesses JSONB, -- Array de debilidades
                resistances JSONB, -- Array de resistencias
                retreat_cost TEXT[], -- Array de costos de retirada
                converted_retreat_cost INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Índices para rendimiento
        await pool.query('CREATE INDEX idx_cards_name ON cards(name)');
        await pool.query('CREATE INDEX idx_cards_set_id ON cards(set_id)');
        await pool.query('CREATE INDEX idx_cards_types ON cards USING GIN(types)');
        await pool.query('CREATE INDEX idx_sets_series_id ON sets(series_id)');
        
        console.log('✅ Tablas creadas con índices');
    } catch (error) {
        console.error('❌ Error creando tablas:', error.message);
        throw error;
    }
}

// Migrar series
async function migrateSeries() {
    console.log('📚 Migrando series...');
    
    try {
        const seriesData = await pokemonApiGet('/series');
        console.log(`📊 Encontradas ${seriesData.data.length} series`);
        
        for (const series of seriesData.data) {
            await pool.query(`
                INSERT INTO series (id, name, logo) 
                VALUES ($1, $2, $3)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    logo = EXCLUDED.logo
            `, [series.id, series.name, series.logo]);
        }
        
        console.log('✅ Series migradas');
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
            const setsData = await pokemonApiGet(`/sets?page=${page}&pageSize=${pageSize}`);
            console.log(`📊 Página ${page}: ${setsData.data.length} sets`);
            
            allSets = allSets.concat(setsData.data);
            hasMore = setsData.data.length === pageSize;
            page++;
            
            // Pequeña pausa para no sobrecargar la API
            if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        console.log(`📊 Total sets a migrar: ${allSets.length}`);
        
        for (const set of allSets) {
            await pool.query(`
                INSERT INTO sets (
                    id, name, series_id, printed_total, total, 
                    release_date, logo, symbol
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    series_id = EXCLUDED.series_id,
                    printed_total = EXCLUDED.printed_total,
                    total = EXCLUDED.total,
                    release_date = EXCLUDED.release_date,
                    logo = EXCLUDED.logo,
                    symbol = EXCLUDED.symbol,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                set.id, set.name, set.series.id, set.printedTotal, set.total,
                set.releaseDate, set.logo, set.symbol
            ]);
            
            if (allSets.indexOf(set) % 50 === 0) {
                console.log(`📈 Progreso sets: ${allSets.indexOf(set) + 1}/${allSets.length}`);
            }
        }
        
        console.log('✅ Sets migrados');
    } catch (error) {
        console.error('❌ Error migrando sets:', error.message);
        throw error;
    }
}

// Migrar tipos y rarezas
async function migrateTypesAndRarities() {
    console.log('🏷️ Migrando tipos y rarezas...');
    
    try {
        // Migrar tipos
        const typesData = await pokemonApiGet('/types');
        for (const type of typesData.data) {
            await pool.query(`
                INSERT INTO types (id, name) VALUES ($1, $2)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            `, [type.toLowerCase(), type]);
        }
        
        // Migrar rarezas
        const raritiesData = await pokemonApiGet('/rarities');
        for (const rarity of raritiesData.data) {
            const rarityId = rarity.toLowerCase().replace(/\s+/g, '-');
            await pool.query(`
                INSERT INTO rarities (id, name) VALUES ($1, $2)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            `, [rarityId, rarity]);
        }
        
        console.log('✅ Tipos y rarezas migrados');
    } catch (error) {
        console.error('❌ Error migrando tipos/rarezas:', error.message);
        throw error;
    }
}

// Migrar cartas (la parte más grande)
async function migrateCards() {
    console.log('🃏 Migrando cartas...');
    
    try {
        let totalCards = 0;
        let page = 1;
        let pageSize = 100;
        let hasMore = true;
        
        while (hasMore) {
            const cardsData = await pokemonApiGet(`/cards?page=${page}&pageSize=${pageSize}`);
            const cards = cardsData.data;
            
            console.log(`📊 Página ${page}: ${cards.length} cartas`);
            
            for (const card of cards) {
                // Preparar arrays para PostgreSQL
                const types = card.types || [];
                const subtypes = card.subtypes || [];
                const rules = card.rules || [];
                const nationalPokedexNumbers = card.nationalPokedexNumbers || [];
                const retreatCost = card.retreatCost || [];
                
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
                        converted_retreat_cost = EXCLUDED.converted_retreat_cost,
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    card.id, card.name, card.number, card.set.id, card.rarity,
                    card.hp, types, subtypes, rules, card.images,
                    card.tcgplayer, card.cardmarket, card.legal, card.artist,
                    card.flavorText, nationalPokedexNumbers, card.attacks,
                    card.weaknesses, card.resistances, retreatCost, card.convertedRetreatCost
                ]);
                
                totalCards++;
                
                if (totalCards % 1000 === 0) {
                    console.log(`📈 Progreso cartas: ${totalCards}`);
                }
            }
            
            hasMore = cards.length === pageSize;
            page++;
            
            // Pausa para no sobrecargar la API
            if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        console.log(`✅ Cartas migradas: ${totalCards} total`);
    } catch (error) {
        console.error('❌ Error migrando cartas:', error.message);
        throw error;
    }
}

// Función principal de migración
async function main() {
    console.log('🚀 Iniciando migración completa de Pokémon TCG a PostgreSQL');
    console.log('📅 Fecha:', new Date().toISOString());
    
    try {
        // Verificar conexión a BD
        await pool.query('SELECT 1');
        console.log('✅ Conexión a PostgreSQL establecida');
        
        // Verificar API key
        if (!API_KEY) {
            throw new Error('❌ POKEMON_TCG_API_KEY no está configurada');
        }
        console.log('✅ API Key configurada');
        
        // Ejecutar migración paso a paso
        await cleanDatabase();
        await createTables();
        await migrateSeries();
        await migrateSets();
        await migrateTypesAndRarities();
        await migrateCards();
        
        console.log('🎉 MIGRACIÓN COMPLETADA CON ÉXITO');
        
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
        console.log('📊 Estadísticas finales:');
        console.log(`  - Series: ${s.series_count}`);
        console.log(`  - Sets: ${s.sets_count}`);
        console.log(`  - Tipos: ${s.types_count}`);
        console.log(`  - Rarezas: ${s.rarities_count}`);
        console.log(`  - Cartas: ${s.cards_count}`);
        
    } catch (error) {
        console.error('❌ ERROR EN MIGRACIÓN:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main();
}

module.exports = { main, cleanDatabase, createTables };
