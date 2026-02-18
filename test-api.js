require('dotenv').config();
const https = require('https');

const POKEMON_API = 'https://api.pokemontcg.io/v2';
const API_KEY = process.env.POKEMON_TCG_API_KEY;

console.log('🔑 API Key:', API_KEY ? 'Configurada' : 'No configurada');
console.log('🌐 API URL:', POKEMON_API);

function testApi(endpoint) {
    return new Promise((resolve, reject) => {
        const url = POKEMON_API + endpoint;
        console.log('\n📡 Probando:', url);
        
        const options = {
            headers: {
                'X-Api-Key': API_KEY,
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
                        console.log('📦 Total items:', data.totalCount || data.data?.length || 'N/A');
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

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

async function runTests() {
    try {
        console.log('🚀 Iniciando tests de API Pokémon TCG');
        
        // Test 1: Types (endpoint simple)
        console.log('\n=== Test 1: Types ===');
        await testApi('/types');
        
        // Test 2: Cards (el que falla)
        console.log('\n=== Test 2: Cards ===');
        await testApi('/cards?page=1&pageSize=5');
        
        // Test 3: Sets
        console.log('\n=== Test 3: Sets ===');
        await testApi('/sets?page=1&pageSize=5');
        
        console.log('\n✅ Todos los tests completados');
        
    } catch (error) {
        console.log('\n💥 Error en tests:', error.message);
    }
}

runTests();
