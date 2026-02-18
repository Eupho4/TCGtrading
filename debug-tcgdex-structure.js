const https = require('https');

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

async function debugTcgdexStructure() {
    try {
        console.log('🔍 Analizando estructura de datos TCGdex...');
        
        // 1. Obtener una carta específica
        console.log('\n🃏 Carta específica (base1-4):');
        const specificCard = await tcgdexApiGet('/en/cards/base1-4');
        console.log('Estructura completa:');
        console.log(JSON.stringify(specificCard, null, 2));
        
        // 2. Obtener algunas cartas del listado general
        console.log('\n📦 Cartas del listado general (primeras 3):');
        const cardsList = await tcgdexApiGet('/en/cards?limit=3');
        
        cardsList.forEach((card, index) => {
            console.log(`\n--- Carta ${index + 1} ---`);
            console.log('ID:', card.id);
            console.log('Nombre:', card.name);
            console.log('Set object:', JSON.stringify(card.set, null, 2));
            console.log('Set ID:', card.set?.id);
            console.log('Set Name:', card.set?.name);
        });
        
        // 3. Comparar con sets
        console.log('\n📦 Estructura de sets:');
        const sets = await tcgdexApiGet('/en/sets?limit=3');
        
        sets.forEach((set, index) => {
            console.log(`\n--- Set ${index + 1} ---`);
            console.log('ID:', set.id);
            console.log('Nombre:', set.name);
            console.log('Serie:', JSON.stringify(set.serie, null, 2));
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugTcgdexStructure();
