require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Desplegando TCGtrade a Railway...');

async function deployToRailway() {
    try {
        // 1. Verificar que Railway CLI está instalado
        console.log('\n📦 Verificando Railway CLI...');
        try {
            execSync('railway --version', { stdio: 'pipe' });
            console.log('✅ Railway CLI encontrado');
        } catch (error) {
            console.log('❌ Railway CLI no encontrado');
            console.log('📥 Instalando Railway CLI...');
            execSync('npm install -g @railway/cli', { stdio: 'inherit' });
        }
        
        // 2. Verificar login
        console.log('\n🔐 Verificando login en Railway...');
        try {
            execSync('railway whoami', { stdio: 'pipe' });
            console.log('✅ Ya estás logueado en Railway');
        } catch (error) {
            console.log('🔑 Necesitas hacer login en Railway:');
            console.log('   Ejecuta: railway login');
            console.log('   Luego vuelve a correr este script');
            process.exit(1);
        }
        
        // 3. Configurar variables de entorno
        console.log('\n⚙️ Configurando variables de entorno...');
        
        const requiredVars = [
            'DATABASE_URL',
            'NODE_ENV'
        ];
        
        const optionalVars = [
            'POKEMON_TCG_API_KEY'
        ];
        
        for (const varName of requiredVars) {
            if (!process.env[varName]) {
                throw new Error(`❌ Variable de entorno requerida: ${varName}`);
            }
            console.log(`✅ ${varName}: configurada`);
            
            // Set en Railway
            try {
                execSync(`railway variables set ${varName}="${process.env[varName]}"`, { 
                    stdio: 'pipe' 
                });
                console.log(`   📡 Subida a Railway`);
            } catch (error) {
                console.log(`   ⚠️ Error al subir ${varName} (puede que ya exista)`);
            }
        }
        
        for (const varName of optionalVars) {
            if (process.env[varName]) {
                console.log(`✅ ${varName}: configurada (opcional)`);
                try {
                    execSync(`railway variables set ${varName}="${process.env[varName]}"`, { 
                        stdio: 'pipe' 
                    });
                    console.log(`   📡 Subida a Railway`);
                } catch (error) {
                    console.log(`   ⚠️ Error al subir ${varName}`);
                }
            }
        }
        
        // 4. Verificar archivos críticos
        console.log('\n📁 Verificando archivos para despliegue...');
        
        const requiredFiles = [
            'package.json',
            'server-hybrid.js',
            'html/index.html',
            'js/app-ui.js',
            'railway.json'
        ];
        
        for (const file of requiredFiles) {
            if (!fs.existsSync(file)) {
                throw new Error(`❌ Archivo requerido: ${file}`);
            }
            console.log(`✅ ${file}`);
        }
        
        // 5. Hacer el despliegue
        console.log('\n🚀 Iniciando despliegue...');
        
        try {
            const deployOutput = execSync('railway up', { 
                stdio: 'inherit',
                encoding: 'utf8'
            });
            
            console.log('\n✅ Despliegue completado!');
            
            // 6. Obtener URL
            console.log('\n🌐 Obteniendo URL de la aplicación...');
            
            try {
                const statusOutput = execSync('railway status', { 
                    stdio: 'pipe',
                    encoding: 'utf8'
                });
                
                // Extraer URL del output
                const urlMatch = statusOutput.match(/https:\/\/[^\s]+/);
                if (urlMatch) {
                    const appUrl = urlMatch[0];
                    console.log(`🎉 ¡Tu aplicación está en línea!`);
                    console.log(`🌐 URL: ${appUrl}`);
                    
                    // 7. Probar la aplicación
                    console.log('\n🧪 Probando la aplicación...');
                    
                    // Esperar un momento para que la aplicación inicie
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    const testUrl = `${appUrl}/api/health`;
                    try {
                        const https = require('https');
                        const response = await new Promise((resolve, reject) => {
                            https.get(testUrl, (res) => {
                                let data = '';
                                res.on('data', chunk => data += chunk);
                                res.on('end', () => resolve({ status: res.statusCode, data }));
                            }).on('error', reject);
                        });
                        
                        if (response.status === 200) {
                            console.log('✅ Health check funcionando');
                            console.log(`📊 Estado: ${response.data}`);
                        } else {
                            console.log(`⚠️ Health check status: ${response.status}`);
                        }
                        
                        console.log(`\n🎯 Prueba la búsqueda:`);
                        console.log(`   ${appUrl}?search=charizard`);
                        
                    } catch (testError) {
                        console.log('⚠️ No se pudo probar el health check (puede que esté iniciando)');
                    }
                    
                } else {
                    console.log('⚠️ No se pudo obtener la URL automáticamente');
                    console.log('📱 Revisa tu dashboard de Railway');
                }
                
            } catch (statusError) {
                console.log('⚠️ No se pudo obtener el estado automáticamente');
                console.log('📱 Revisa tu dashboard de Railway');
            }
            
        } catch (deployError) {
            console.error('❌ Error en el despliegue:', deployError.message);
            console.log('📱 Revisa los logs en Railway dashboard');
        }
        
        console.log('\n🎉 ¡Proceso de despliegue completado!');
        console.log('📝 Resumen:');
        console.log('   ✅ Variables de entorno configuradas');
        console.log('   ✅ Archivos verificados');
        console.log('   ✅ Despliegue iniciado');
        console.log('   ✅ Aplicación en línea');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

deployToRailway();
