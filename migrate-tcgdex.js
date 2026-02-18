require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuración de PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Configuración de TCGdex API
const TCGDEX_API = 'https://api.tcgdex.net/v2';

// Configuración de migración
const CONFIG = {
    batchSize: 100,           // 100 cartas por lote
    requestDelay: 500,       // 0.5 segundos entre requests
    timeout: 30000,          // 30 segundos timeout
    checkpointInterval: 500, // Guardar progreso cada 500 cartas
    maxRetries: 3            // 3 reintentos
};

// Estado de la migración
let migrationState = {
    totalCards: 0,
    processedCards: 0,
    failedCards: [],
    startTime: null,
    lastCheckpoint: null
};

// Logger con timestamps
function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const colors = {
        INFO: '\x1b[36m',
        SUCCESS: '\x1b[32m',
        WARN: '\x1b[33m',
        ERROR: '\x1b[31m',
        FATAL: '\x1b[35m',
        RESET: '\x1b[0m'
    };
    console.log(`${colors[level]}[${timestamp}] [${level}] ${message}${colors.RESET}`);
}

// Guardar checkpoint
function saveCheckpoint() {
    const checkpointFile = path.join(__dirname, 'tcgdex-migration-checkpoint.json');
    fs.writeFileSync(checkpointFile, JSON.stringify(migrationState, null, 2));
    log(`💾 Checkpoint guardado: ${migrationState.processedCards.toLocaleString()}/${migrationState.totalCards.toLocaleString()} cartas`);
}

// Cargar checkpoint si existe
function loadCheckpoint() {
    const checkpointFile = path.join(__dirname, 'tcgdex-migration-checkpoint.json');
    if (fs.existsSync(checkpointFile)) {
        migrationState = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
        log(`📂 Checkpoint cargado: ${migrationState.processedCards.toLocaleString()}/${migrationState.totalCards.toLocaleString()} cartas procesadas`);
        return true;
    }
    return false;
}

// Helper para peticiones a TCGdex API
function tcgdexApiGet(endpoint) {
    return new Promise((resolve, reject) => {
        const url = TCGDEX_API + endpoint;
        log(`📡 TCGdex GET: ${endpoint}`);

        const options = {
            headers: {
                'User-Agent': 'TCGtrade-TCGdex-Migration/1.0',
                'Accept': 'application/json'
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
                        reject(new Error(`JSON parse error: ${e.message}`));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', (e) => {
            reject(new Error(`Request error: ${e.message}`));
        });

        req.setTimeout(CONFIG.timeout, () => {
            req.destroy();
            reject(new Error(`Timeout after ${CONFIG.timeout/1000}s`));
        });
    });
}

// Sistema de reintentos
async function retryApiCall(endpoint, maxRetries = CONFIG.maxRetries) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await tcgdexApiGet(endpoint);
            
            if (i > 0) {
                log(`✅ Éxito en intento ${i + 1} para ${endpoint}`, 'SUCCESS');
            }
            
            // Esperar entre requests
            await new Promise(resolve => setTimeout(resolve, CONFIG.requestDelay));
            
            return result;
            
        } catch (error) {
            const isLastRetry = i === maxRetries - 1;
            
            log(`❌ Intento ${i + 1}/${maxRetries} fallido para ${endpoint}: ${error.message}`, 
                isLastRetry ? 'ERROR' : 'WARN');
            
            if (isLastRetry) {
                throw error;
            }
            
            // Esperar antes de reintentar
            const delay = 1000 * (i + 1);
            log(`⏳ Esperando ${delay/1000}s antes del siguiente intento...`, 'WAIT');
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Mapear carta de TCGdex a nuestro formato
function mapTcgdexCard(tcgdexCard) {
    return {
        id: tcgdexCard.id,
        name: tcgdexCard.name,
        number: tcgdexCard.localId,
        set_id: tcgdexCard.set?.id,
        rarity_id: mapRarity(tcgdexCard.rarity),
        hp: tcgdexCard.hp ? parseInt(tcgdexCard.hp) : null,
        types: tcgdexCard.types || [],
        subtypes: tcgdexCard.subtypes || [],
        rules: tcgdexCard.rules || [],
        images: {
            small: tcgdexCard.image,
            large: tcgdexCard.imageHiRes || tcgdexCard.image
        },
        tcgplayer: null, // TCGdex no tiene precios de tcgplayer
        cardmarket: null, // TCGdex no tiene precios de cardmarket
        legal: {
            unlimited: true, // Asumir legalidad ilimitada
            expanded: false,
            standard: false
        },
        artist: tcgdexCard.illustrator || tcgdexCard.artist,
        flavor_text: tcgdexCard.description || tcgdexCard.flavorText,
        national_pokedex_numbers: tcgdexCard.pokedexId ? [parseInt(tcgdexCard.pokedexId)] : [],
        attacks: (tcgdexCard.attacks || []).map(attack => ({
            name: attack.name,
            cost: attack.cost || [],
            convertedEnergyCost: attack.cost?.length || 0,
            damage: attack.damage || '',
            text: attack.effect || ''
        })),
        weaknesses: (tcgdexCard.weaknesses || []).map(weak => ({
            type: weak.type,
            value: weak.value || '×2'
        })),
        resistances: (tcgdexCard.resistances || []).map(res => ({
            type: res.type,
            value: res.value || '-20'
        })),
        retreat_cost: tcgdexCard.retreat || [],
        converted_retreat_cost: tcgdexCard.retreat?.length || 0
    };
}

// Mapear rareza de TCGdex a nuestro formato
function mapRarity(tcgdexRarity) {
    const rarityMap = {
        'Common': 'common',
        'Uncommon': 'uncommon', 
        'Rare': 'rare',
        'Rare Holo': 'rare-holo',
        'Rare Holo V': 'rare-holo-v',
        'Rare Ultra': 'rare-ultra',
        'Rare Secret': 'rare-secret',
        'Promo': 'promo',
        'Full Art': 'full-art',
        'Amazing': 'amazing',
        'Legendary': 'legendary',
        'Special': 'special'
    };
    
    return rarityMap[tcgdexRarity] || 'common';
}

// Mapear set de TCGdex a nuestro formato
function mapTcgdexSet(tcgdexSet) {
    return {
        id: tcgdexSet.id,
        name: tcgdexSet.name,
        series_id: tcgdexSet.serie?.id,
        printed_total: tcgdexSet.cardCount?.total || tcgdexSet.cardCount?.official || 0,
        total: tcgdexSet.cardCount?.total || tcgdexSet.cardCount?.official || 0,
        release_date: tcgdexSet.releaseDate || null,
        logo: tcgdexSet.logo,
        symbol: tcgdexSet.symbol
    };
}

// Mapear serie de TCGdex a nuestro formato
function mapTcgdexSerie(tcgdexSerie) {
    return {
        id: tcgdexSerie.id,
        name: tcgdexSerie.name,
        logo: tcgdexSerie.logo
    };
}

// Verificar/crear tablas
async function ensureTables() {
    log('🏗️ Verificando estructura de tablas...');
    
    // Tablas ya existen, solo verificar
    await pool.query('SELECT 1 FROM cards LIMIT 1');
    await pool.query('SELECT 1 FROM sets LIMIT 1');
    await pool.query('SELECT 1 FROM series LIMIT 1');
    await pool.query('SELECT 1 FROM rarities LIMIT 1');
    
    log('✅ Tablas verificadas');
}

// Insertar carta en base de datos
async function insertCard(card) {
    const query = `
        INSERT INTO cards (
            id, name, number, set_id, rarity_id, hp, types, subtypes, 
            rules, images, tcgplayer, cardmarket, legal, artist, 
            flavor_text, national_pokedex_numbers, attacks, weaknesses, 
            resistances, retreat_cost, converted_retreat_cost
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        )
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
    `;
    
    const values = [
        card.id,
        card.name,
        card.number,
        card.set_id,
        card.rarity_id,
        card.hp,
        card.types || [],
        card.subtypes || [],
        card.rules || [],
        JSON.stringify(card.images || {}),
        JSON.stringify(card.tcgplayer || {}),
        JSON.stringify(card.cardmarket || {}),
        JSON.stringify(card.legal || {}),
        card.artist,
        card.flavor_text,
        card.national_pokedex_numbers || [],
        JSON.stringify(card.attacks || []),
        JSON.stringify(card.weaknesses || []),
        JSON.stringify(card.resistances || []),
        card.retreat_cost || [],
        card.converted_retreat_cost
    ];
    
    await pool.query(query, values);
}

// Insertar set en base de datos
async function insertSet(set) {
    const query = `
        INSERT INTO sets (
            id, name, series_id, printed_total, total, 
            release_date, logo, symbol
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            series_id = EXCLUDED.series_id,
            printed_total = EXCLUDED.printed_total,
            total = EXCLUDED.total,
            release_date = EXCLUDED.release_date,
            logo = EXCLUDED.logo,
            symbol = EXCLUDED.symbol
    `;
    
    const values = [
        set.id,
        set.name,
        set.series_id,
        set.printed_total,
        set.total,
        set.release_date,
        set.logo,
        set.symbol
    ];
    
    await pool.query(query, values);
}

// Insertar serie en base de datos
async function insertSerie(serie) {
    const query = `
        INSERT INTO series (id, name, logo)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            logo = EXCLUDED.logo
    `;
    
    const values = [serie.id, serie.name, serie.logo];
    await pool.query(query, values);
}

// Migrar series
async function migrateSeries() {
    log('📚 Migrando series desde TCGdex...');
    
    try {
        const seriesData = await retryApiCall('/en/series');
        log(`📊 Encontradas ${seriesData.length} series`);
        
        for (const serie of seriesData) {
            try {
                const mappedSerie = mapTcgdexSerie(serie);
                await insertSerie(mappedSerie);
                log(`✅ Serie insertada: ${mappedSerie.name}`);
            } catch (error) {
                log(`❌ Error insertando serie ${serie.id}: ${error.message}`, 'ERROR');
            }
        }
        
        log(`✅ Series migradas: ${seriesData.length}`);
        
    } catch (error) {
        log(`❌ Error migrando series: ${error.message}`, 'ERROR');
        throw error;
    }
}

// Migrar sets
async function migrateSets() {
    log('📦 Migrando sets desde TCGdex...');
    
    try {
        const setsData = await retryApiCall('/en/sets');
        log(`📊 Encontrados ${setsData.length} sets`);
        
        for (const set of setsData) {
            try {
                const mappedSet = mapTcgdexSet(set);
                await insertSet(mappedSet);
                log(`✅ Set insertado: ${mappedSet.name}`);
            } catch (error) {
                log(`❌ Error insertando set ${set.id}: ${error.message}`, 'ERROR');
            }
        }
        
        log(`✅ Sets migrados: ${setsData.length}`);
        
    } catch (error) {
        log(`❌ Error migrando sets: ${error.message}`, 'ERROR');
        throw error;
    }
}

// Migrar cartas
async function migrateCards() {
    log('🃏 Migrando cartas desde TCGdex...');
    
    try {
        // Obtener todas las cartas
        const cardsData = await retryApiCall('/en/cards');
        migrationState.totalCards = cardsData.length;
        log(`📊 Total de cartas a migrar: ${migrationState.totalCards.toLocaleString()}`);
        
        // Procesar en lotes
        for (let i = 0; i < cardsData.length; i += CONFIG.batchSize) {
            const batch = cardsData.slice(i, i + CONFIG.batchSize);
            const batchNumber = Math.floor(i / CONFIG.batchSize) + 1;
            const totalBatches = Math.ceil(cardsData.length / CONFIG.batchSize);
            
            log(`📦 Procesando lote ${batchNumber}/${totalBatches}: ${batch.length} cartas`);
            
            for (const tcgdexCard of batch) {
                try {
                    const mappedCard = mapTcgdexCard(tcgdexCard);
                    await insertCard(mappedCard);
                    migrationState.processedCards++;
                    
                    // Checkpoint cada N cartas
                    if (migrationState.processedCards % CONFIG.checkpointInterval === 0) {
                        saveCheckpoint();
                    }
                    
                    // Mostrar progreso
                    if (migrationState.processedCards % 50 === 0) {
                        const progress = (migrationState.processedCards / migrationState.totalCards * 100).toFixed(2);
                        const elapsed = Date.now() - migrationState.startTime;
                        const rate = (migrationState.processedCards / (elapsed / 1000)).toFixed(2);
                        log(`📈 Progreso: ${migrationState.processedCards.toLocaleString()}/${migrationState.totalCards.toLocaleString()} (${progress}%) - ${rate} cartas/s`);
                    }
                    
                } catch (error) {
                    log(`❌ Error insertando carta ${tcgdexCard.id}: ${error.message}`, 'ERROR');
                    migrationState.failedCards.push({
                        id: tcgdexCard.id,
                        name: tcgdexCard.name,
                        error: error.message
                    });
                }
            }
        }
        
        log(`✅ Cartas migradas: ${migrationState.processedCards.toLocaleString()}`);
        
    } catch (error) {
        log(`❌ Error migrando cartas: ${error.message}`, 'ERROR');
        throw error;
    }
}

// Función principal de migración TCGdex
async function migrateFromTcgdex() {
    try {
        log('🚀 Iniciando migración desde TCGdex API', 'START');
        migrationState.startTime = Date.now();
        
        // Cargar checkpoint si existe
        const hasCheckpoint = loadCheckpoint();
        
        // Verificar tablas
        await ensureTables();
        
        // Si es nueva migración, migrar todo
        if (!hasCheckpoint || migrationState.processedCards === 0) {
            await migrateSeries();
            await migrateSets();
            await migrateCards();
        } else {
            // Reanudar desde checkpoint
            log('🔄 Reanudando migración desde checkpoint...');
            await migrateCards();
        }
        
        // Finalización
        const endTime = Date.now();
        const duration = (endTime - migrationState.startTime) / 1000;
        const rate = migrationState.processedCards / duration;
        
        log('🎉 MIGRACIÓN TCGDEX COMPLETADA', 'SUCCESS');
        log(`📊 Estadísticas finales:`);
        log(`   - Cartas procesadas: ${migrationState.processedCards.toLocaleString()}`);
        log(`   - Cartas fallidas: ${migrationState.failedCards.length}`);
        log(`   - Duración: ${duration.toFixed(2)} segundos`);
        log(`   - Velocidad: ${rate.toFixed(2)} cartas/segundo`);
        
        if (migrationState.failedCards.length > 0) {
            log(`❌ Cartas con errores:`, 'ERROR');
            migrationState.failedCards.slice(0, 10).forEach(card => {
                log(`   - ${card.id}: ${card.name} - ${card.error}`, 'ERROR');
            });
            if (migrationState.failedCards.length > 10) {
                log(`   ... y ${migrationState.failedCards.length - 10} más`, 'ERROR');
            }
        }
        
        // Limpiar checkpoint
        const checkpointFile = path.join(__dirname, 'tcgdex-migration-checkpoint.json');
        if (fs.existsSync(checkpointFile)) {
            fs.unlinkSync(checkpointFile);
        }
        
    } catch (error) {
        log(`💥 Error fatal en migración TCGdex: ${error.message}`, 'FATAL');
        saveCheckpoint();
        throw error;
    }
}

// Manejo de señales (Ctrl+C)
process.on('SIGINT', () => {
    log('\n🛑 Interrupción detectada, guardando progreso...', 'INTERRUPT');
    saveCheckpoint();
    process.exit(0);
});

// Ejecutar migración
if (require.main === module) {
    migrateFromTcgdex()
        .then(() => {
            log('✅ Migración TCGdex finalizada exitosamente', 'SUCCESS');
            process.exit(0);
        })
        .catch((error) => {
            log(`❌ Migración TCGdex fallida: ${error.message}`, 'FATAL');
            process.exit(1);
        });
}

module.exports = { migrateFromTcgdex, retryApiCall, saveCheckpoint, loadCheckpoint };
