require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Configuración
const IMAGES_DIR = path.join(__dirname, 'images', 'cards');
const BATCH_SIZE = 5; // Reducido para no sobrecargar
const MAX_RETRIES = 3;

// Asegurar que el directorio de imágenes exista
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    console.log('📁 Directorio de imágenes creado:', IMAGES_DIR);
}

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

// Función para descargar una imagen con reintentos y múltiples formatos
function downloadImage(url, filepath, retries = 0) {
    return new Promise((resolve, reject) => {
        console.log(`📥 Descargando: ${url} -> ${filepath}`);
        
        const file = fs.createWriteStream(filepath);
        
        // Intentar diferentes formatos
        const formats = [
            '',           // Original
            '.high',      // Alta calidad
            '.low',       // Baja calidad
            '.png.high',  // PNG alta
            '.png.low',   // PNG baja
            '.webp.high', // WebP alta
            '.webp.low'   // WebP baja
        ];
        
        tryNextFormat(formats, 0);
        
        function tryNextFormat(formats, index) {
            if (index >= formats.length) {
                file.close();
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
                reject(new Error('No se encontró un formato válido'));
                return;
            }
            
            const testUrl = url + formats[index];
            const testFile = filepath + formats[index];
            
            const req = https.get(testUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Referer': 'https://tcgdex.net/'
                }
            }, (res) => {
                
                if (res.statusCode === 200 && res.headers['content-type']?.startsWith('image/')) {
                    // Imagen encontrada, descargarla
                    res.pipe(file);
                    
                    file.on('finish', () => {
                        file.close();
                        console.log(`✅ Imagen descargada: ${testFile}`);
                        
                        // Si usamos un formato especial, renombrar al nombre original
                        if (formats[index] !== '') {
                            fs.renameSync(testFile, filepath);
                        }
                        
                        resolve(filepath);
                    });
                    
                } else if (res.statusCode === 200 && res.headers['content-type']?.startsWith('text/html')) {
                    // Es HTML, probar siguiente formato
                    tryNextFormat(formats, index + 1);
                } else {
                    // Error, probar siguiente formato
                    tryNextFormat(formats, index + 1);
                }
                
            }).on('error', (err) => {
                if (retries < MAX_RETRIES) {
                    console.log(`🔄 Reintentando (${retries + 1}/${MAX_RETRIES}): ${testUrl}`);
                    setTimeout(() => {
                        downloadImage(url, filepath, retries + 1).then(resolve).catch(reject);
                    }, 1000 * (retries + 1));
                } else {
                    reject(err);
                }
            });
        }
    });
}

// Función principal de migración COMPLETA
async function migrateAllTcgdexComplete() {
    try {
        console.log('🚀 Iniciando migración COMPLETA de TODAS las cartas TCGdex...');
        
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
        let downloaded = 0;
        
        // Procesar en lotes más pequeños
        for (let i = 0; i < allCardsList.length; i += BATCH_SIZE) {
            const batch = allCardsList.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(allCardsList.length / BATCH_SIZE);
            
            console.log(`📦 Procesando lote ${batchNumber}/${totalBatches}: ${batch.length} cartas`);
            
            // Procesar lote en serie (no paralelo) para no sobrecargar API
            for (const cardInfo of batch) {
                try {
                    // Obtener carta completa con set
                    const fullCard = await getCardWithSet(cardInfo.id);
                    const mappedCard = mapTcgdexCard(fullCard);
                    
                    // Descargar imagen
                    const imageUrl = mappedCard.images.large || mappedCard.images.small;
                    if (imageUrl) {
                        const safeName = mappedCard.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
                        const filename = `${mappedCard.id}_${safeName}.png`;
                        const filepath = path.join(IMAGES_DIR, filename);
                        
                        try {
                            await downloadImage(imageUrl, filepath);
                            
                            // Actualizar con ruta local
                            const localImagePath = `/images/cards/${filename}`;
                            mappedCard.images = {
                                small: localImagePath,
                                large: localImagePath
                            };
                            downloaded++;
                        } catch (imgError) {
                            console.log(`❌ Error descargando imagen ${mappedCard.id}: ${imgError.message}`);
                            // Mantener URLs originales si falla la descarga
                        }
                    }
                    
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
                    
                    // Mostrar algunas cartas de ejemplo
                    if (processedCards <= 5) {
                        console.log(`✅ ${mappedCard.name} -> set: ${mappedCard.set_id}`);
                    }
                    
                    // Pausa entre cartas para no sobrecargar API
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    errors++;
                    if (errors <= 10) {
                        console.log(`❌ Error con carta ${cardInfo.id}: ${error.message}`);
                    }
                }
            }
            
            // Mostrar progreso
            const progress = (processedCards / allCardsList.length * 100).toFixed(2);
            console.log(`📈 Progreso: ${processedCards.toLocaleString()}/${allCardsList.length.toLocaleString()} (${progress}%) - Con set: ${withSet} - Imágenes descargadas: ${downloaded} - Errores: ${errors}`);
            
            // Pausa mayor entre lotes
            if (batchNumber < totalBatches) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        // 4. Resumen final
        console.log(`\n🎉 Migración COMPLETA finalizada:`);
        console.log(`🃏 Cartas migradas: ${processedCards.toLocaleString()}/${allCardsList.length.toLocaleString()}`);
        console.log(`❌ Errores: ${errors}`);
        console.log(`📦 Cartas con set: ${withSet}`);
        console.log(`📥 Imágenes descargadas: ${downloaded.toLocaleString()}`);
        
        // 5. Verificación final
        console.log('\n📊 Verificación final:');
        
        const verification = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN set_id IS NOT NULL THEN 1 END) as with_set,
                COUNT(DISTINCT set_id) as distinct_sets
            FROM cards
        `);
        
        console.log(`🃏 Cartas totales en BD: ${verification.rows[0].total}`);
        console.log(`🃏 Cartas con set: ${verification.rows[0].with_set}`);
        console.log(`📦 Sets distintos: ${verification.rows[0].distinct_sets}`);
        
        // 6. Estadísticas de imágenes
        const imageFiles = fs.readdirSync(IMAGES_DIR);
        console.log(`📁 Archivos de imágenes: ${imageFiles.length}`);
        
        const stats = fs.statSync(IMAGES_DIR);
        console.log(`💾 Espacio utilizado: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
        
        console.log('\n✅ ¡Migración COMPLETA de TCGdex finalizada!');
        
    } catch (error) {
        console.error('❌ Error en migración completa:', error.message);
    } finally {
        await pool.end();
    }
}

// Ejecutar migración completa
migrateAllTcgdexComplete();
