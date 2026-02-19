require('dotenv').config();
const https = require('https');

// Función para probar diferentes formatos de imagen
async function testImageFormats(cardId) {
    console.log(`🔍 Probando formatos para carta: ${cardId}`);
    
    // Obtener carta completa
    function getCard(cardId) {
        return new Promise((resolve, reject) => {
            const url = `https://api.tcgdex.net/v2/en/cards/${cardId}`;
            
            const req = https.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
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
    
    try {
        const card = await getCard(cardId);
        console.log(`📝 Carta: ${card.name}`);
        console.log(`🖼️ Imagen original: ${card.image}`);
        console.log(`🖼️ Imagen HiRes: ${card.imageHiRes || 'No disponible'}`);
        
        const baseUrl = card.imageHiRes || card.image;
        
        // Probar todos los formatos posibles
        const formats = [
            '',
            '.high',
            '.low', 
            '.png',
            '.png.high',
            '.png.low',
            '.webp',
            '.webp.high',
            '.webp.low',
            '.jpg',
            '.jpg.high',
            '.jpg.low'
        ];
        
        console.log(`\n🧪 Probando ${formats.length} formatos diferentes:`);
        
        for (const format of formats) {
            const testUrl = baseUrl + format;
            
            try {
                const result = await testImageUrl(testUrl);
                if (result.success) {
                    console.log(`✅ ${format.padEnd(12)} - ${result.contentType} (${result.size} bytes)`);
                } else {
                    console.log(`❌ ${format.padEnd(12)} - ${result.error}`);
                }
            } catch (error) {
                console.log(`❌ ${format.padEnd(12)} - Error: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error(`❌ Error obteniendo carta ${cardId}:`, error.message);
    }
}

// Función para probar una URL específica
function testImageUrl(url) {
    return new Promise((resolve) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Referer': 'https://tcgdex.net/'
            }
        }, (res) => {
            
            const contentType = res.headers['content-type'] || '';
            const contentLength = res.headers['content-length'] || '0';
            
            if (res.statusCode === 200) {
                if (contentType.startsWith('image/')) {
                    resolve({
                        success: true,
                        contentType: contentType,
                        size: contentLength
                    });
                } else {
                    // Leer el contenido para ver qué es
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        resolve({
                            success: false,
                            error: `Content-Type: ${contentType} - Contenido: ${body.substring(0, 100)}`
                        });
                    });
                }
            } else {
                resolve({
                    success: false,
                    error: `HTTP ${res.statusCode}`
                });
            }
        });

        req.on('error', (error) => {
            resolve({
                success: false,
                error: error.message
            });
        });

        req.setTimeout(10000, () => {
            req.destroy();
            resolve({
                success: false,
                error: 'Timeout'
            });
        });
    });
}

// Probar con varias cartas
async function testMultipleCards() {
    const testCards = [
        'swsh1-1',    // Celebi V
        'dp3-3',      // Charizard
        'swsh12-001', // Hisuian Arcanine
        'ex1-1',      // Venusaur
        'base1-1'     // Bulbasaur
    ];
    
    console.log('🚀 Iniciando pruebas de formatos de imagen...\n');
    
    for (const cardId of testCards) {
        await testImageFormats(cardId);
        console.log('\n' + '='.repeat(80) + '\n');
    }
    
    console.log('✅ Pruebas completadas');
}

// Ejecutar pruebas
testMultipleCards();
