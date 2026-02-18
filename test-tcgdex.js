const https = require('https');

const TCGDEX_API = 'https://api.tcgdex.net/v2';

console.log('🌐 TCGdex API URL:', TCGDEX_API);
console.log('🔍 Probando TCGdex API (alternativa a Pokémon TCG API)');

function testTcgdex(endpoint) {
    return new Promise((resolve, reject) => {
        const url = TCGDEX_API + endpoint;
        console.log('\n📡 Probando:', url);
        
        const options = {
            headers: {
                'User-Agent': 'TCGtrade-Test/1.0'
            }
        };

        const req = https.get(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log('📊 Status:', res.statusCode);
                console.log('📋 Headers:', JSON.stringify(res.headers, null, 2));
                
                if (res.statusCode === 200) {
                    try {
                        const data = JSON.parse(body);
                        console.log('✅ Respuesta OK');
                        console.log('📦 Total items:', data.totalCount || data.data?.length || data.length || 'N/A');
                        if (data.data && data.data.length > 0) {
                            console.log('🎉 Primer item:', JSON.stringify(data.data[0], null, 2).substring(0, 300));
                        } else if (data.length > 0) {
                            console.log('🎉 Primer item:', JSON.stringify(data[0], null, 2).substring(0, 300));
                        }
                        resolve(data);
                    } catch (e) {
                        console.log('❌ Error JSON:', e.message);
                        console.log('📄 Body (primeros 200 chars):', body.substring(0, 200));
                        reject(new Error('JSON parse error'));
                    }
                } else {
                    console.log('❌ Error Body:', body);
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', (e) => {
            console.log('❌ Request error:', e.message);
            reject(e);
        });

        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

async function runTcgdexTests() {
    try {
        console.log('🚀 Iniciando tests de TCGdex API');
        
        // Test 1: Cards (endpoint principal)
        console.log('\n=== Test 1: Cards ===');
        await testTcgdex('/en/cards');
        
        // Test 2: Sets
        console.log('\n=== Test 2: Sets ===');
        await testTcgdex('/en/sets');
        
        // Test 3: Series
        console.log('\n=== Test 3: Series ===');
        await testTcgdex('/en/series');
        
        // Test 4: Single card
        console.log('\n=== Test 4: Single Card (Charizard) ===');
        await testTcgdex('/en/cards/base1-4');
        
        console.log('\n✅ Todos los tests TCGdex completados');
        
    } catch (error) {
        console.log('\n💥 Error en tests TCGdex:', error.message);
    }
}

runTcgdexTests();
