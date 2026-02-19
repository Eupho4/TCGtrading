require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Configuración
const BATCH_SIZE = 20;
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

// Función de migración
async function migrateAllTcgdexData() {
    try {
        console.log('🚀 Iniciando migración COMPLETA de DATOS de TODAS las cartas TCGdex...');
        
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
        
        // Procesar en lotes
        for (let i = 0; i < allCardsList.length; i += BATCH_SIZE) {
            const batch = allCardsList.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(allCardsList.length / BATCH_SIZE);
            
            console.log(`📦 Procesando lote ${batchNumber}/${totalBatches}: ${batch.length} cartas`);
            
            // Procesar lote en serie
            for (const cardInfo of batch) {
                try {
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
                    
                    if (mappedCard.set_id) withSet++;
                    if (mappedCard.attacks && mappedCard.attacks.length > 0) withAttacks++;
                    if (mappedCard.weaknesses && mappedCard.weaknesses.length > 0) withWeaknesses++;
                    
                    if (processedCards <= 10) {
                        console.log(`✅ ${mappedCard.name} -> set: ${mappedCard.set_id} -> ataques: ${mappedCard.attacks.length}`);
                    }
                    
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
            
            if (batchNumber < totalBatches) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`\n🎉 Migración COMPLETA de DATOS finalizada:`);
        console.log(`🃏 Cartas migradas: ${processedCards.toLocaleString()}/${allCardsList.length.toLocaleString()}`);
        console.log(`❌ Errores: ${errors}`);
        console.log(`📦 Cartas con set: ${withSet}`);
        console.log(`⚔️ Cartas con ataques: ${withAttacks}`);
        console.log(`🛡️ Cartas con debilidades: ${withWeaknesses}`);
        
        return {
            processedCards,
            errors,
            withSet,
            withAttacks,
            withWeaknesses,
            totalCards: allCardsList.length
        };
        
    } catch (error) {
        console.error('❌ Error en migración completa:', error.message);
        throw error;
    }
}

// Función para crear backup
async function createBackup(migrationStats) {
    try {
        console.log('\n🔄 Creando backup completo de la base de datos...');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(__dirname, `tcg_complete_backup_${timestamp}.sql`);
        
        // Extraer datos de conexión
        const dbUrl = process.env.DATABASE_URL;
        const urlParts = new URL(dbUrl);
        
        const pgDumpCommand = `pg_dump -h ${urlParts.hostname} -p ${urlParts.port || 5432} -U ${urlParts.username} -d ${urlParts.pathname.slice(1)} > "${backupFile}"`;
        
        return new Promise((resolve, reject) => {
            exec(pgDumpCommand, { 
                env: { 
                    ...process.env, 
                    PGPASSWORD: urlParts.password 
                } 
            }, (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ Error en pg_dump:', error);
                    reject(error);
                    return;
                }
                
                if (fs.existsSync(backupFile)) {
                    const stats = fs.statSync(backupFile);
                    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                    
                    console.log('✅ Backup creado exitosamente:');
                    console.log(`📁 Archivo: ${backupFile}`);
                    console.log(`📊 Tamaño: ${fileSizeMB} MB`);
                    console.log(`🃏 Cartas: ${migrationStats.processedCards.toLocaleString()}`);
                    
                    // Crear archivo de instrucciones
                    const instructionsFile = backupFile.replace('.sql', '_INSTRUCTIONS.txt');
                    const instructions = `
INSTRUCCIONES PARA RESTAURAR LA BASE DE DATOS
============================================

1. Instalar PostgreSQL en el nuevo ordenador
2. Crear base de datos vacía:
   CREATE DATABASE pokemon_tcg;

3. Restaurar el backup:
   psql -h localhost -U postgres -d pokemon_tcg < tcg_complete_backup_${timestamp}.sql

4. Actualizar archivo .env con los datos de conexión:
   DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/pokemon_tcg

ESTADÍSTICAS DEL BACKUP:
- Cartas: ${migrationStats.processedCards.toLocaleString()}
- Con set: ${migrationStats.withSet}
- Con ataques: ${migrationStats.withAttacks}
- Con debilidades: ${migrationStats.withWeaknesses}
- Tamaño archivo: ${fileSizeMB} MB

NOTAS:
- Este backup contiene TODAS las cartas de TCGdex
- Las URLs de imágenes están guardadas pero no descargadas
- Puedes subir este archivo a Google Drive, Dropbox, etc.
- Para usar en otro PC, solo necesitas PostgreSQL y seguir estos pasos
`;
                    
                    fs.writeFileSync(instructionsFile, instructions);
                    console.log(`📝 Instrucciones guardadas en: ${instructionsFile}`);
                    
                    resolve({
                        backupFile,
                        instructionsFile,
                        fileSizeMB
                    });
                    
                } else {
                    reject(new Error('No se pudo crear el archivo de backup'));
                }
            });
        });
        
    } catch (error) {
        console.error('❌ Error creando backup:', error.message);
        throw error;
    }
}

// Función principal
async function migrateAndBackup() {
    try {
        console.log('🚀 INICIANDO PROCESO COMPLETO: MIGRACIÓN + BACKUP');
        console.log('=' .repeat(60));
        
        // 1. Ejecutar migración
        const migrationStats = await migrateAllTcgdexData();
        
        // 2. Crear backup
        const backupInfo = await createBackup(migrationStats);
        
        // 3. Resumen final
        console.log('\n🎉 PROCESO COMPLETO FINALIZADO CON ÉXITO');
        console.log('=' .repeat(60));
        console.log('📊 MIGRACIÓN:');
        console.log(`   • Cartas procesadas: ${migrationStats.processedCards.toLocaleString()}/${migrationStats.totalCards.toLocaleString()}`);
        console.log(`   • Errores: ${migrationStats.errors}`);
        console.log(`   • Con set: ${migrationStats.withSet}`);
        console.log(`   • Con ataques: ${migrationStats.withAttacks}`);
        console.log(`   • Con debilidades: ${migrationStats.withWeaknesses}`);
        
        console.log('\n📦 BACKUP:');
        console.log(`   • SQL: ${backupInfo.backupFile}`);
        console.log(`   • Instrucciones: ${backupInfo.instructionsFile}`);
        console.log(`   • Tamaño: ${backupInfo.fileSizeMB} MB`);
        
        console.log('\n📋 PASOS SIGUIENTES:');
        console.log('1. Sube estos archivos a Google Drive/Dropbox');
        console.log('2. Copia toda la carpeta del proyecto');
        console.log('3. En el nuevo PC, instala PostgreSQL');
        console.log('4. Sigue las instrucciones del archivo *_INSTRUCTIONS.txt');
        
        console.log('\n✅ ¡LISTO PARA CAMBIAR DE PC SIN PERDER NADA!');
        
    } catch (error) {
        console.error('❌ Error en proceso completo:', error.message);
    } finally {
        await pool.end();
    }
}

// Ejecutar todo el proceso
migrateAndBackup();
