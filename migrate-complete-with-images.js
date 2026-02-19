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
const BATCH_SIZE = 10; // Procesar 10 imágenes a la vez para no sobrecargar
const MAX_RETRIES = 3;

// Asegurar que el directorio de imágenes exista
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    console.log('📁 Directorio de imágenes creado:', IMAGES_DIR);
}

// Función para descargar una imagen con reintentos
function downloadImage(url, filepath, retries = 0) {
    return new Promise((resolve, reject) => {
        console.log(`📥 Descargando: ${url} -> ${filepath}`);
        
        const file = fs.createWriteStream(filepath);
        
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Referer': 'https://tcgdex.net/'
            }
        }, (res) => {
            
            // Si es un redirect o HTML, intentar con diferentes formatos
            if (res.statusCode === 200 && res.headers['content-type']?.startsWith('text/html')) {
                file.close();
                fs.unlinkSync(filepath); // Eliminar archivo vacío
                
                // Intentar diferentes formatos
                const formats = ['.high', '.low', '.png.high', '.png.low', '.webp.high', '.webp.low'];
                tryNextFormat(formats, 0);
                return;
            }
            
            if (res.statusCode !== 200) {
                file.close();
                fs.unlinkSync(filepath);
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            
            res.pipe(file);
            
            file.on('finish', () => {
                file.close();
                console.log(`✅ Imagen descargada: ${filepath}`);
                resolve(filepath);
            });
            
        }).on('error', (err) => {
            file.close();
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
            }
            
            if (retries < MAX_RETRIES) {
                console.log(`🔄 Reintentando (${retries + 1}/${MAX_RETRIES}): ${url}`);
                setTimeout(() => {
                    downloadImage(url, filepath, retries + 1).then(resolve).catch(reject);
                }, 1000 * (retries + 1));
            } else {
                reject(err);
            }
        });
        
        function tryNextFormat(formats, index) {
            if (index >= formats.length) {
                reject(new Error('No se encontró un formato válido'));
                return;
            }
            
            const testUrl = url + formats[index];
            const testFile = filepath + formats[index];
            
            https.get(testUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Referer': 'https://tcgdex.net/'
                }
            }, (res) => {
                if (res.statusCode === 200 && res.headers['content-type']?.startsWith('image/')) {
                    // Función encontrada, descargar con este formato
                    downloadImage(testUrl, testFile).then((finalPath) => {
                        // Renombrar al nombre original
                        fs.renameSync(finalPath, filepath);
                        resolve(filepath);
                    }).catch(reject);
                } else {
                    // Probar siguiente formato
                    tryNextFormat(formats, index + 1);
                }
            }).on('error', () => {
                tryNextFormat(formats, index + 1);
            });
        }
    });
}

// Función principal de migración completa
async function migrateCompleteWithImages() {
    try {
        console.log('🚀 Iniciando migración COMPLETA con imágenes...');
        
        // 1. Obtener todas las cartas de la BD
        console.log('📊 Obteniendo todas las cartas de la BD...');
        const cardsResult = await pool.query('SELECT id, name, images FROM cards ORDER BY id');
        const cards = cardsResult.rows;
        
        console.log(`✅ Se encontraron ${cards.length} cartas para procesar`);
        
        // 2. Procesar cada carta
        let processed = 0;
        let errors = 0;
        let downloaded = 0;
        
        for (let i = 0; i < cards.length; i += BATCH_SIZE) {
            const batch = cards.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(cards.length / BATCH_SIZE);
            
            console.log(`📦 Procesando lote ${batchNumber}/${totalBatches}: ${batch.length} cartas`);
            
            // Procesar lote en paralelo
            const batchPromises = batch.map(async (card) => {
                try {
                    let images;
                    
                    // Manejar diferentes formatos de imágenes en la BD
                    if (typeof card.images === 'string') {
                        try {
                            images = JSON.parse(card.images);
                        } catch (e) {
                            console.log(`⚠️ Carta ${card.id} tiene images como string no JSON: ${card.images}`);
                            return { success: false, card: card.id, error: 'Invalid JSON in images' };
                        }
                    } else if (typeof card.images === 'object') {
                        images = card.images;
                    } else {
                        console.log(`⚠️ Carta ${card.id} no tiene imágenes válidas`);
                        return { success: false, card: card.id, error: 'No valid images object' };
                    }
                    
                    const imageUrl = images.large || images.small;
                    
                    if (!imageUrl) {
                        console.log(`⚠️ Carta ${card.id} no tiene imagen URL`);
                        return { success: false, card: card.id, error: 'No image URL' };
                    }
                    
                    // Crear nombre de archivo seguro
                    const safeName = card.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
                    const filename = `${card.id}_${safeName}.png`;
                    const filepath = path.join(IMAGES_DIR, filename);
                    
                    // Si el archivo ya existe, saltar
                    if (fs.existsSync(filepath)) {
                        console.log(`⏭️ Imagen ya existe: ${filename}`);
                        return { success: true, card: card.id, filepath };
                    }
                    
                    // Descargar imagen
                    const downloadedPath = await downloadImage(imageUrl, filepath);
                    
                    // Actualizar BD con ruta local
                    const localImagePath = `/images/cards/${filename}`;
                    await pool.query(
                        'UPDATE cards SET images = $1 WHERE id = $2',
                        [JSON.stringify({
                            small: localImagePath,
                            large: localImagePath
                        }), card.id]
                    );
                    
                    downloaded++;
                    return { success: true, card: card.id, filepath: downloadedPath };
                    
                } catch (error) {
                    console.error(`❌ Error procesando carta ${card.id}: ${error.message}`);
                    errors++;
                    return { success: false, card: card.id, error: error.message };
                }
            });
            
            // Esperar a que termine el lote
            const batchResults = await Promise.all(batchPromises);
            
            // Contar resultados
            batchResults.forEach(result => {
                if (result.success) processed++;
            });
            
            // Mostrar progreso
            const progress = (processed / cards.length * 100).toFixed(2);
            console.log(`📈 Progreso: ${processed.toLocaleString()}/${cards.length.toLocaleString()} (${progress}%) - Descargadas: ${downloaded} - Errores: ${errors}`);
            
            // Pausa entre lotes para no sobrecargar el servidor
            if (batchNumber < totalBatches) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // 3. Resumen final
        console.log('\n🎉 Migración completa finalizada:');
        console.log(`📊 Total cartas procesadas: ${processed.toLocaleString()}/${cards.length.toLocaleString()}`);
        console.log(`📥 Imágenes descargadas: ${downloaded.toLocaleString()}`);
        console.log(`❌ Errores: ${errors.toLocaleString()}`);
        console.log(`📁 Directorio de imágenes: ${IMAGES_DIR}`);
        
        // 4. Verificación
        const imageFiles = fs.readdirSync(IMAGES_DIR);
        console.log(`📁 Archivos de imágenes en disco: ${imageFiles.length}`);
        
        // 5. Estadísticas de espacio
        const stats = fs.statSync(IMAGES_DIR);
        console.log(`💾 Espacio utilizado: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
        
    } catch (error) {
        console.error('❌ Error en migración completa:', error.message);
    } finally {
        await pool.end();
    }
}

// Ejecutar migración
migrateCompleteWithImages();
