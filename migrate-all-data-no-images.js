require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Configuración
const BATCH_SIZE = 20; // Aumentado para mayor velocidad
const MAX_RETRIES = 3;

// Función para obtener datos de TCGdex API
function tcgdexApiGet(endpoint) {
    return new Promise((resolve, reject) => {
        const url = `https://api.tcgdex.net/v2${endpoint}`;
        
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en,en-US;q=0.9'
            }
        }, (res) => {
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

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

// Obtener carta individual con todos los datos
async function getCardWithSet(cardId) {
    return await tcgdexApiGet(`/en/cards/${cardId}`);
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
        tcgplayer: JSON.stringify(tcgdexCard.pricing?.tcgplayer || {}),
        cardmarket: JSON.stringify(tcgdexCard.pricing?.cardmarket || {}),
        legal: tcgdexCard.legal || {
            unlimited: true,
            expanded: false,
            standard: false
        },
        artist: tcgdexCard.illustrator || tcgdexCard.artist,
        flavor_text: tcgdexCard.description || tcgdexCard.flavorText,
        national_pokedex_numbers: tcgdexCard.dexId || [],
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
        retreat_cost: tcgdexCard.retreat ? Array(tcgdexCard.retreat).fill('Colorless') : [],
        converted_retreat_cost: tcgdexCard.retreat || 0
    };
}

// Mapear rareza
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

// Función principal de migración COMPLETA (solo datos)
async function migrateAllTcgdexDataOnly() {
    try {
        console.log('🚀 Iniciando migración COMPLETA de DATOS de TODAS las cartas TCGdex...');
        console.log('⚠️  NOTA: Sin descarga de imágenes - solo datos de cartas');
        
        // 1. Limpiar base de datos completamente
        console.log('🧹 Limpiando base de datos...');
        await pool.query('DELETE FROM cards');
        console.log('✅ Base de datos limpiada');
        
        // 2. Obtener TODAS las cartas de TCGdex
        console.log('📦 Obteniendo lista COMPLETA de cartas desde TCGdex...');
        const allCardsList = await tcgdexApiGet('/en/cards');
        console.log(`✅ Obtenidos ${allCardsList.length} IDs de cartas TOTALES`);
        
        // 3. Procesar TODAS las cartas individualmente
        console.log('🃏 Procesando TODAS las cartas individualmente...');
        let processedCards = 0;
        let errors = 0;
        let withSet = 0;
        let withAttacks = 0;
        let withWeaknesses = 0;
        
        // Procesar en lotes más grandes para mayor velocidad
        for (let i = 0; i < allCardsList.length; i += BATCH_SIZE) {
            const batch = allCardsList.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(allCardsList.length / BATCH_SIZE);
            
            console.log(`📦 Procesando lote ${batchNumber}/${totalBatches}: ${batch.length} cartas`);
            
            // Procesar lote en serie para no sobrecargar API
            for (const cardInfo of batch) {
                try {
                    // Obtener carta completa con set
                    const fullCard = await getCardWithSet(cardInfo.id);
                    const mappedCard = mapTcgdexCard(fullCard);
                    
                    // Insertar carta en BD
                    const query = `
                        INSERT INTO cards (
                            id, name, number, set_id, rarity_id, hp, types, subtypes, 
                            rules, images, tcgplayer, cardmarket, legal, artist, 
                            flavor_text, national_pokedex_numbers, attacks, weaknesses, 
                            resistances, retreat_cost, converted_retreat_cost
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
                        )
                    `;
                    
                    const values = [
                        mappedCard.id,
                        mappedCard.name,
                        mappedCard.number,
                        mappedCard.set_id,
                        mappedCard.rarity_id,
                        mappedCard.hp,
                        mappedCard.types || [],
                        mappedCard.subtypes || [],
                        mappedCard.rules || [],
                        JSON.stringify(mappedCard.images || {}),
                        mappedCard.tcgplayer,
                        mappedCard.cardmarket,
                        JSON.stringify(mappedCard.legal || {}),
                        mappedCard.artist,
                        mappedCard.flavor_text,
                        mappedCard.national_pokedex_numbers || [],
                        JSON.stringify(mappedCard.attacks || []),
                        JSON.stringify(mappedCard.weaknesses || []),
                        JSON.stringify(mappedCard.resistances || []),
                        mappedCard.retreat_cost || [],
                        mappedCard.converted_retreat_cost
                    ];
                    
                    await pool.query(query, values);
                    processedCards++;
                    
                    if (mappedCard.set_id) {
                        withSet++;
                    }
                    
                    if (mappedCard.attacks && mappedCard.attacks.length > 0) {
                        withAttacks++;
                    }
                    
                    if (mappedCard.weaknesses && mappedCard.weaknesses.length > 0) {
                        withWeaknesses++;
                    }
                    
                    // Mostrar algunas cartas de ejemplo
                    if (processedCards <= 10) {
                        console.log(`✅ ${mappedCard.name} -> set: ${mappedCard.set_id} -> ataques: ${mappedCard.attacks.length}`);
                    }
                    
                    // Pausa más corta entre cartas para mayor velocidad
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                } catch (error) {
                    errors++;
                    if (errors <= 10) {
                        console.log(`❌ Error con carta ${cardInfo.id}: ${error.message}`);
                    }
                }
            }
            
            // Mostrar progreso
            const progress = (processedCards / allCardsList.length * 100).toFixed(2);
            console.log(`📈 Progreso: ${processedCards.toLocaleString()}/${allCardsList.length.toLocaleString()} (${progress}%) - Con set: ${withSet} - Con ataques: ${withAttacks} - Con debilidades: ${withWeaknesses} - Errores: ${errors}`);
            
            // Pausa menor entre lotes para mayor velocidad
            if (batchNumber < totalBatches) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // 4. Resumen final
        console.log(`\n🎉 Migración COMPLETA de DATOS finalizada:`);
        console.log(`🃏 Cartas migradas: ${processedCards.toLocaleString()}/${allCardsList.length.toLocaleString()}`);
        console.log(`❌ Errores: ${errors}`);
        console.log(`📦 Cartas con set: ${withSet}`);
        console.log(`⚔️ Cartas con ataques: ${withAttacks}`);
        console.log(`🛡️ Cartas con debilidades: ${withWeaknesses}`);
        
        // 5. Verificación final
        console.log('\n📊 Verificación final:');
        
        const verification = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN set_id IS NOT NULL THEN 1 END) as with_set,
                COUNT(DISTINCT set_id) as distinct_sets,
                COUNT(CASE WHEN attacks::text != '[]' THEN 1 END) as with_attacks,
                COUNT(CASE WHEN weaknesses::text != '[]' THEN 1 END) as with_weaknesses
            FROM cards
        `);
        
        console.log(`🃏 Cartas totales en BD: ${verification.rows[0].total}`);
        console.log(`🃏 Cartas con set: ${verification.rows[0].with_set}`);
        console.log(`📦 Sets distintos: ${verification.rows[0].distinct_sets}`);
        console.log(`⚔️ Cartas con ataques: ${verification.rows[0].with_attacks}`);
        console.log(`🛡️ Cartas con debilidades: ${verification.rows[0].with_weaknesses}`);
        
        // 6. Estadísticas de datos
        const stats = await pool.query(`
            SELECT 
                COUNT(DISTINCT types) as distinct_types,
                COUNT(DISTINCT rarity_id) as distinct_rarities,
                COUNT(DISTINCT artist) as distinct_artists
            FROM cards
        `);
        
        console.log(`🔥 Tipos distintos: ${stats.rows[0].distinct_types}`);
        console.log(`💎 Rarezas distintas: ${stats.rows[0].distinct_rarities}`);
        console.log(`🎨 Artistas distintos: ${stats.rows[0].distinct_artists}`);
        
        console.log('\n✅ ¡Migración COMPLETA de DATOS de TCGdex finalizada!');
        console.log('📝 NOTA: Las URLs de imágenes se guardaron pero no se descargaron');
        console.log('🔍 Las imágenes se pueden resolver más tarde con otro método');
        
    } catch (error) {
        console.error('❌ Error en migración completa:', error.message);
    } finally {
        await pool.end();
    }
}

// Ejecutar migración completa
migrateAllTcgdexDataOnly();
