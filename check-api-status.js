require('dotenv').config();
const https = require('https');

const POKEMON_API = 'https://api.pokemontcg.io/v2';
const API_KEY = process.env.POKEMON_TCG_API_KEY;

// Colores para consola
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

// Test rápido de API
async function quickApiTest() {
    return new Promise((resolve) => {
        const url = POKEMON_API + '/types';
        
        const options = {
            headers: {
                'User-Agent': 'TCGtrade-Monitor/1.0'
            },
            timeout: 5000
        };

        const req = https.get(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const data = JSON.parse(body);
                        resolve({
                            status: 'success',
                            statusCode: res.statusCode,
                            data: data,
                            responseTime: Date.now() - req.startTime
                        });
                    } catch (e) {
                        resolve({
                            status: 'json_error',
                            statusCode: res.statusCode,
                            error: 'JSON parse error'
                        });
                    }
                } else {
                    resolve({
                        status: 'http_error',
                        statusCode: res.statusCode,
                        error: `HTTP ${res.statusCode}`
                    });
                }
            });
        });

        req.startTime = Date.now();
        
        req.on('error', (e) => {
            resolve({
                status: 'connection_error',
                error: e.message
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                status: 'timeout',
                error: 'Timeout after 5s'
            });
        });

        req.setTimeout(5000);
    });
}

// Test completo con diferentes endpoints
async function fullApiTest() {
    const endpoints = [
        { name: 'Types', path: '/types' },
        { name: 'Sets', path: '/sets?page=1&pageSize=5' },
        { name: 'Cards', path: '/cards?page=1&pageSize=5' }
    ];

    const results = [];

    for (const endpoint of endpoints) {
        log(`📡 Testeando ${endpoint.name}...`, 'blue');
        
        const result = await new Promise((resolve) => {
            const url = POKEMON_API + endpoint.path;
            
            const options = {
                headers: {
                    'X-Api-Key': API_KEY,
                    'User-Agent': 'TCGtrade-Monitor/1.0'
                },
                timeout: 10000
            };

            const req = https.get(url, options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const data = JSON.parse(body);
                            resolve({
                                name: endpoint.name,
                                status: 'success',
                                statusCode: res.statusCode,
                                count: data.data?.length || data.totalCount || 0,
                                responseTime: Date.now() - req.startTime
                            });
                        } catch (e) {
                            resolve({
                                name: endpoint.name,
                                status: 'json_error',
                                statusCode: res.statusCode,
                                error: 'JSON parse error'
                            });
                        }
                    } else {
                        resolve({
                            name: endpoint.name,
                            status: 'http_error',
                            statusCode: res.statusCode,
                            error: `HTTP ${res.statusCode}`
                        });
                    }
                });
            });

            req.startTime = Date.now();
            
            req.on('error', (e) => {
                resolve({
                    name: endpoint.name,
                    status: 'connection_error',
                    error: e.message
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    name: endpoint.name,
                    status: 'timeout',
                    error: 'Timeout'
                });
            });

            req.setTimeout(10000);
        });

        results.push(result);
        
        // Mostrar resultado
        if (result.status === 'success') {
            log(`✅ ${endpoint.name}: ${result.statusCode} (${result.count} items, ${result.responseTime}ms)`, 'green');
        } else {
            log(`❌ ${endpoint.name}: ${result.error}`, 'red');
        }
    }

    return results;
}

// Monitoreo continuo
async function continuousMonitor(intervalSeconds = 30) {
    log('🔍 Iniciando monitoreo continuo de API Pokémon TCG', 'cyan');
    log(`⏰ Intervalo: ${intervalSeconds} segundos`, 'blue');
    log('🛑 Presiona Ctrl+C para detener', 'yellow');
    console.log('');

    let consecutiveSuccesses = 0;
    let consecutiveFailures = 0;

    while (true) {
        const result = await quickApiTest();
        
        if (result.status === 'success') {
            consecutiveSuccesses++;
            consecutiveFailures = 0;
            
            log(`🟢 API FUNCIONA - ${result.statusCode} (${result.responseTime}ms) - Consecutivo: ${consecutiveSuccesses}`, 'green');
            
            if (consecutiveSuccesses >= 3) {
                log('🎉 ¡API ESTÁ ESTABLE! Listo para migración completa.', 'green');
                log('\n💡 Ahora puedes ejecutar: node migrate-robust.js', 'cyan');
                break;
            }
        } else {
            consecutiveFailures++;
            consecutiveSuccesses = 0;
            
            log(`🔴 API CAÍDA - ${result.error} - Consecutivo: ${consecutiveFailures}`, 'red');
            
            if (consecutiveFailures >= 5) {
                log('⚠️ Lleva 5 fallos consecutivos. La API sigue con problemas.', 'yellow');
            }
        }
        
        // Esperar para el siguiente check
        await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
    }
}

// Menú interactivo
async function showMenu() {
    console.log('\n🔍 Monitoreo de API Pokémon TCG\n');
    console.log('1. Test rápido (5 segundos)');
    console.log('2. Test completo (todos los endpoints)');
    console.log('3. Monitoreo continuo');
    console.log('4. Salir\n');
    
    // Para uso automático, seleccionamos opción 1
    const choice = process.argv[2] || '1';
    
    switch (choice) {
        case '1':
            log('🚀 Ejecutando test rápido...', 'blue');
            const result = await quickApiTest();
            
            if (result.status === 'success') {
                log(`✅ API FUNCIONA - Status: ${result.statusCode}`, 'green');
                log(`📊 Respuesta: ${result.responseTime}ms`, 'blue');
                log(`📦 Datos: ${result.data.data?.length || 0} items`, 'blue');
                log('\n💡 La API está funcionando. Puedes ejecutar migrate-robust.js', 'green');
            } else {
                log(`❌ API CAÍDA - Error: ${result.error}`, 'red');
                log('\n💡 La API sigue con problemas. Usa migrate-offline.js para desarrollo', 'yellow');
            }
            break;
            
        case '2':
            log('🚀 Ejecutando test completo...', 'blue');
            await fullApiTest();
            break;
            
        case '3':
            const interval = parseInt(process.argv[3]) || 30;
            await continuousMonitor(interval);
            break;
            
        default:
            log('👋 Saliendo...', 'blue');
    }
}

// Ejecutar
if (require.main === module) {
    showMenu().catch(console.error);
}

module.exports = { quickApiTest, fullApiTest, continuousMonitor };
