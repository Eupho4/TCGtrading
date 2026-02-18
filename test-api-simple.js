const https = require('https');

const POKEMON_API = 'https://api.pokemontcg.io/v2';

console.log('🌐 API URL:', POKEMON_API);
console.log('🔑 Probando SIN API Key (límites más bajos pero debería funcionar)');

function testApi(endpoint, useApiKey = false) {
    return new Promise((resolve, reject) => {
        const url = POKEMON_API + endpoint;
        console.log('\n📡 Probando:', url);
        console.log('🔑 Usando API Key:', useApiKey ? 'Sí' : 'No');
        
        const options = {};
        
        if (useApiKey) {
            options.headers = {
                'X-Api-Key': '429f84ae-37f3-4a87-86da-c1d5f2be797b',
                'User-Agent': 'TCGtrade-Test/1.0'
            };
        } else {
            options.headers = {
                'User-Agent': 'TCGtrade-Test/1.0'
            };
        }

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
                        console.log('📦 Total items:', data.totalCount || data.data?.length || 'N/A');
                        if (data.data && data.data.length > 0) {
                            console.log('🎉 Primer item:', JSON.stringify(data.data[0], null, 2).substring(0, 300));
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

async function runTests() {
    try {
        console.log('🚀 Iniciando tests de API Pokémon TCG');
        
        // Test 1: Types sin API key
        console.log('\n=== Test 1: Types SIN API Key ===');
        await testApi('/types', false);
        
        // Test 2: Types con API key
        console.log('\n=== Test 2: Types CON API Key ===');
        await testApi('/types', true);
        
        console.log('\n✅ Tests completados');
        
    } catch (error) {
        console.log('\n💥 Error en tests:', error.message);
    }
}

runTests();
