require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Función para obtener datos de TCGdex
function tcgdexApiGet(endpoint) {
    return new Promise((resolve, reject) => {
        const url = `https://api.tcgdex.net/v2${endpoint}`;
        
        const req = https.get(url, (res) => {
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
        req.setTimeout(10000, () => {
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
        set_id: tcgdexCard.set?.id, // Ahora debería funcionar
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

async function migrateTcgdexFixed() {
    try {
        console.log('🔄 Migración TCGdex corregida - Obteniendo datos completos...');
        
        // 1. Limpiar cartas existentes
        console.log('🧹 Limpiando cartas existentes...');
        await pool.query('DELETE FROM cards');
        console.log('✅ Cartas eliminadas');
        
        // 2. Obtener lista de IDs de cartas
        console.log('📦 Obteniendo lista de cartas...');
        const cardsList = await tcgdexApiGet('/en/cards');
        console.log(`✅ Obtenidos ${cardsList.length} IDs de cartas`);
        
        // 3. Procesar cartas individualmente para obtener datos completos
        console.log('🃏 Procesando cartas individualmente...');
        let processedCards = 0;
        let errors = 0;
        let withSet = 0;
        
        // Procesar en lotes más pequeños para no sobrecargar la API
        const batchSize = 50;
        
        for (let i = 0; i < cardsList.length; i += batchSize) {
            const batch = cardsList.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(cardsList.length / batchSize);
            
            console.log(`📦 Procesando lote ${batchNumber}/${totalBatches}: ${batch.length} cartas`);
            
            for (const cardInfo of batch) {
                try {
                    // Obtener carta completa con set
                    const fullCard = await getCardWithSet(cardInfo.id);
                    const mappedCard = mapTcgdexCard(fullCard);
                    
                    // Insertar carta
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
                    
                    // Verificar algunas cartas
                    if (processedCards <= 5) {
                        console.log(`✅ ${mappedCard.name} -> set: ${mappedCard.set_id}`);
                        console.log(`   Set name: ${fullCard.set?.name}`);
                    }
                    
                    // Pequeña pausa para no sobrecargar la API
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (error) {
                    errors++;
                    if (errors <= 10) {
                        console.log(`❌ Error con carta ${cardInfo.id}: ${error.message}`);
                    }
                }
            }
            
            // Mostrar progreso
            const progress = (processedCards / cardsList.length * 100).toFixed(2);
            console.log(`📈 Progreso: ${processedCards.toLocaleString()}/${cardsList.length.toLocaleString()} (${progress}%) - Con set: ${withSet}`);
            
            // Pausa entre lotes
            if (batchNumber < totalBatches) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`✅ Cartas migradas: ${processedCards.toLocaleString()}`);
        console.log(`❌ Errores: ${errors}`);
        console.log(`📦 Cartas con set: ${withSet}`);
        
        // 4. Verificación final
        console.log('\n📊 Verificación final:');
        
        const verification = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN set_id IS NOT NULL THEN 1 END) as with_set,
                COUNT(DISTINCT set_id) as distinct_sets
            FROM cards
        `);
        
        console.log(`🃏 Cartas totales: ${verification.rows[0].total}`);
        console.log(`🃏 Cartas con set: ${verification.rows[0].with_set}`);
        console.log(`📦 Sets distintos: ${verification.rows[0].distinct_sets}`);
        
        // 5. Probar búsqueda
        console.log('\n🔍 Probando búsqueda de Charizard:');
        const testSearch = await pool.query(`
            SELECT 
                c.name, c.set_id,
                s.name as set_name,
                se.name as series_name
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            WHERE c.name ILIKE '%charizard%'
            LIMIT 3
        `);
        
        console.log('Resultados:');
        testSearch.rows.forEach(row => {
            console.log(`- ${row.name}: ${row.set_name} (${row.series_name})`);
        });
        
        console.log('\n🎉 ¡Migración TCGdex corregida completada!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

migrateTcgdexFixed();
