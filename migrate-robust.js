require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuración de PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Configuración de Pokémon TCG API
const POKEMON_API = 'https://api.pokemontcg.io/v2';
const API_KEY = process.env.POKEMON_TCG_API_KEY;

// Configuración de migración
const CONFIG = {
    maxRetries: 5,
    baseDelay: 2000,        // 2 segundos base
    maxDelay: 30000,        // 30 segundos máximo
    batchSize: 50,          // 50 cartas por lote
    requestDelay: 1000,     // 1 segundo entre requests
    timeout: 60000,         // 60 segundos timeout
    checkpointInterval: 100, // Guardar progreso cada 100 cartas
    rateLimitDelay: 5000    // 5 segundos extra si hay rate limit
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
    console.log(`[${timestamp}] [${level}] ${message}`);
}

// Guardar checkpoint
function saveCheckpoint() {
    const checkpointFile = path.join(__dirname, 'migration-checkpoint.json');
    fs.writeFileSync(checkpointFile, JSON.stringify(migrationState, null, 2));
    log(`💾 Checkpoint guardado: ${migrationState.processedCards}/${migrationState.totalCards} cartas`);
}

// Cargar checkpoint si existe
function loadCheckpoint() {
    const checkpointFile = path.join(__dirname, 'migration-checkpoint.json');
    if (fs.existsSync(checkpointFile)) {
        migrationState = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
        log(`📂 Checkpoint cargado: ${migrationState.processedCards}/${migrationState.totalCards} cartas procesadas`);
        return true;
    }
    return false;
}

// Helper mejorado para peticiones API con reintentos exponenciales
async function pokemonApiGet(endpoint, retryCount = 0) {
    return new Promise((resolve, reject) => {
        const url = POKEMON_API + endpoint;
        log(`📡 API GET: ${endpoint} (intento ${retryCount + 1})`);

        const options = {
            headers: {
                'X-Api-Key': API_KEY,
                'User-Agent': 'TCGtrade-Robust-Migration/1.0',
                'Accept': 'application/json'
            }
        };

        const req = https.get(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                // Manejar diferentes códigos de estado
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(new Error(`JSON parse error: ${e.message}`));
                    }
                } else if (res.statusCode === 429) {
                    // Rate limit - esperar y reintentar
                    const retryAfter = res.headers['retry-after'] || CONFIG.rateLimitDelay / 1000;
                    log(`⏰ Rate limit detected, esperando ${retryAfter}s...`, 'WARN');
                    reject(new Error(`Rate limit: retry after ${retryAfter}s`));
                } else if (res.statusCode >= 500) {
                    // Error del servidor - reintentar
                    reject(new Error(`Server error: HTTP ${res.statusCode}`));
                } else {
                    // Error del cliente - no reintentar
                    reject(new Error(`Client error: HTTP ${res.statusCode}: ${body}`));
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

// Sistema de reintentos con backoff exponencial
async function retryApiCall(endpoint, maxRetries = CONFIG.maxRetries) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await pokemonApiGet(endpoint, i);
            
            // Éxito - resetear contador de errores
            if (i > 0) {
                log(`✅ Éxito en intento ${i + 1} para ${endpoint}`, 'SUCCESS');
            }
            
            // Esperar entre requests para evitar rate limits
            if (endpoint.includes('/cards')) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.requestDelay));
            }
            
            return result;
            
        } catch (error) {
            const isLastRetry = i === maxRetries - 1;
            
            log(`❌ Intento ${i + 1}/${maxRetries} fallido para ${endpoint}: ${error.message}`, 
                isLastRetry ? 'ERROR' : 'WARN');
            
            if (isLastRetry) {
                throw error;
            }
            
            // Calcular delay con backoff exponencial
            let delay = CONFIG.baseDelay * Math.pow(2, i);
            
            // Si es rate limit, usar delay específico
            if (error.message.includes('Rate limit')) {
                const match = error.message.match(/retry after (\d+)s/);
                if (match) {
                    delay = parseInt(match[1]) * 1000;
                } else {
                    delay = CONFIG.rateLimitDelay;
                }
            }
            
            // Limitar delay máximo
            delay = Math.min(delay, CONFIG.maxDelay);
            
            log(`⏳ Esperando ${delay/1000}s antes del siguiente intento...`, 'WAIT');
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Obtener conteo total de cartas
async function getTotalCardsCount() {
    try {
        log('🔍 Obteniendo conteo total de cartas...');
        const result = await retryApiCall('/cards?page=1&pageSize=1');
        const totalCount = result.totalCount;
        migrationState.totalCards = totalCount;
        log(`📊 Total de cartas a migrar: ${totalCount.toLocaleString()}`);
        return totalCount;
    } catch (error) {
        log(`❌ Error obteniendo conteo: ${error.message}`, 'ERROR');
        throw error;
    }
}

// Migrar cartas por lotes
async function migrateCardsBatch(page = 1, pageSize = CONFIG.batchSize) {
    try {
        const endpoint = `/cards?page=${page}&pageSize=${pageSize}`;
        const data = await retryApiCall(endpoint);
        
        const cards = data.data;
        log(`📦 Procesando lote ${page}: ${cards.length} cartas`);
        
        // Insertar cartas en lote
        for (const card of cards) {
            try {
                await insertCard(card);
                migrationState.processedCards++;
                
                // Checkpoint cada N cartas
                if (migrationState.processedCards % CONFIG.checkpointInterval === 0) {
                    saveCheckpoint();
                }
                
                // Mostrar progreso
                if (migrationState.processedCards % 10 === 0) {
                    const progress = (migrationState.processedCards / migrationState.totalCards * 100).toFixed(2);
                    const elapsed = Date.now() - migrationState.startTime;
                    const rate = (migrationState.processedCards / (elapsed / 1000)).toFixed(2);
                    log(`📈 Progreso: ${migrationState.processedCards.toLocaleString()}/${migrationState.totalCards.toLocaleString()} (${progress}%) - ${rate} cartas/s`);
                }
                
            } catch (error) {
                log(`❌ Error insertando carta ${card.id}: ${error.message}`, 'ERROR');
                migrationState.failedCards.push({
                    id: card.id,
                    name: card.name,
                    error: error.message
                });
            }
        }
        
        return cards.length;
        
    } catch (error) {
        log(`❌ Error en lote ${page}: ${error.message}`, 'ERROR');
        throw error;
    }
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
        card.set?.id,
        card.rarity,
        card.hp,
        card.types || [],
        card.subtypes || [],
        card.rules || [],
        JSON.stringify(card.images || {}),
        JSON.stringify(card.tcgplayer || {}),
        JSON.stringify(card.cardmarket || {}),
        JSON.stringify(card.legal || {}),
        card.artist,
        card.flavorText,
        card.nationalPokedexNumbers || [],
        JSON.stringify(card.attacks || []),
        JSON.stringify(card.weaknesses || []),
        JSON.stringify(card.resistances || []),
        card.retreatCost || [],
        card.convertedRetreatCost
    ];
    
    await pool.query(query, values);
}

// Crear tabla de cards si no existe
async function ensureCardsTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS cards (
            id VARCHAR(100) PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            number VARCHAR(20),
            set_id VARCHAR(50),
            rarity_id VARCHAR(50),
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
    `;
    
    await pool.query(query);
    
    // Crear índices para mejor rendimiento
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cards_set_id ON cards(set_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cards_types ON cards USING GIN(types)');
    
    log('✅ Tabla cards verificada/creada');
}

// Función principal de migración
async function migrateAllCards() {
    try {
        log('🚀 Iniciando migración robusta de todas las cartas Pokémon', 'START');
        migrationState.startTime = Date.now();
        
        // Cargar checkpoint si existe
        const hasCheckpoint = loadCheckpoint();
        
        // Verificar/crear tabla
        await ensureCardsTable();
        
        // Obtener conteo total si es nueva migración
        if (!hasCheckpoint || migrationState.totalCards === 0) {
            await getTotalCardsCount();
        }
        
        // Calcular página de inicio
        const startPage = Math.floor(migrationState.processedCards / CONFIG.batchSize) + 1;
        const totalPages = Math.ceil(migrationState.totalCards / CONFIG.batchSize);
        
        log(`📋 Iniciando desde página ${startPage} de ${totalPages}`);
        
        // Migrar página por página
        for (let page = startPage; page <= totalPages; page++) {
            try {
                const cardsInBatch = await migrateCardsBatch(page, CONFIG.batchSize);
                
                if (cardsInBatch === 0) {
                    log('🏁 No hay más cartas, migración completada', 'SUCCESS');
                    break;
                }
                
            } catch (error) {
                log(`❌ Error en página ${page}: ${error.message}`, 'ERROR');
                
                // Guardar checkpoint antes de fallar
                saveCheckpoint();
                
                // Si es error de servidor, podemos continuar
                if (error.message.includes('Server error') || error.message.includes('Rate limit')) {
                    log('⏳ Esperando 10 segundos antes de continuar...', 'WAIT');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    continue; // Reintentar misma página
                } else {
                    throw error; // Error crítico, detener
                }
            }
        }
        
        // Finalización
        const endTime = Date.now();
        const duration = (endTime - migrationState.startTime) / 1000;
        const rate = migrationState.processedCards / duration;
        
        log('🎉 MIGRACIÓN COMPLETADA', 'SUCCESS');
        log(`📊 Estadísticas finales:`);
        log(`   - Cartas procesadas: ${migrationState.processedCards.toLocaleString()}`);
        log(`   - Cartas fallidas: ${migrationState.failedCards.length}`);
        log(`   - Duración: ${duration.toFixed(2)} segundos`);
        log(`   - Velocidad: ${rate.toFixed(2)} cartas/segundo`);
        
        if (migrationState.failedCards.length > 0) {
            log(`❌ Cartas con errores:`, 'ERROR');
            migrationState.failedCards.forEach(card => {
                log(`   - ${card.id}: ${card.name} - ${card.error}`, 'ERROR');
            });
        }
        
        // Limpiar checkpoint
        const checkpointFile = path.join(__dirname, 'migration-checkpoint.json');
        if (fs.existsSync(checkpointFile)) {
            fs.unlinkSync(checkpointFile);
        }
        
    } catch (error) {
        log(`💥 Error fatal en migración: ${error.message}`, 'FATAL');
        saveCheckpoint(); // Guardar estado actual
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
    migrateAllCards()
        .then(() => {
            log('✅ Migración finalizada exitosamente', 'SUCCESS');
            process.exit(0);
        })
        .catch((error) => {
            log(`❌ Migración fallida: ${error.message}`, 'FATAL');
            process.exit(1);
        });
}

module.exports = { migrateAllCards, retryApiCall, saveCheckpoint, loadCheckpoint };
