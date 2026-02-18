require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

console.log('🚀 Preparando despliegue a producción...');

async function prepareProduction() {
    try {
        // 1. Verificar que la base de datos está lista
        console.log('\n📊 Verificando base de datos...');
        
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total_cards,
                COUNT(CASE WHEN images IS NOT NULL AND images != '{}' THEN 1 END) as with_images,
                COUNT(CASE WHEN se.name IS NOT NULL THEN 1 END) as with_series
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
        `);
        
        const data = stats.rows[0];
        console.log(`✅ Base de datos lista:`);
        console.log(`   📚 Total cartas: ${data.total_cards}`);
        console.log(`   🖼️ Con imágenes: ${data.with_images} (${((data.with_images/data.total_cards)*100).toFixed(1)}%)`);
        console.log(`   📦 Con series: ${data.with_series} (${((data.with_series/data.total_cards)*100).toFixed(1)}%)`);
        
        await pool.end();
        
        // 2. Verificar archivos críticos
        console.log('\n📁 Verificando archivos críticos...');
        
        const criticalFiles = [
            'server-hybrid.js',
            'package.json',
            'html/index.html',
            'js/app-ui.js',
            '.env',
            'firebase.json'
        ];
        
        let allFilesExist = true;
        for (const file of criticalFiles) {
            if (fs.existsSync(file)) {
                console.log(`✅ ${file}`);
            } else {
                console.log(`❌ ${file} - NO EXISTE`);
                allFilesExist = false;
            }
        }
        
        if (!allFilesExist) {
            throw new Error('Faltan archivos críticos');
        }
        
        // 3. Actualizar configuración para producción
        console.log('\n⚙️ Configurando para producción...');
        
        // Actualizar package.json para producción
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        packageJson.scripts = {
            ...packageJson.scripts,
            "start": "node server-hybrid.js",
            "prod": "NODE_ENV=production node server-hybrid.js"
        };
        
        fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
        console.log('✅ package.json actualizado');
        
        // 4. Crear .env.production si no existe
        const envProduction = `# Producción
NODE_ENV=production
DATABASE_URL=${process.env.DATABASE_URL}
POKEMON_TCG_API_KEY=${process.env.POKEMON_TCG_API_KEY || ''}
`;
        
        if (!fs.existsSync('.env.production')) {
            fs.writeFileSync('.env.production', envProduction);
            console.log('✅ .env.production creado');
        } else {
            console.log('ℹ️ .env.production ya existe');
        }
        
        // 5. Optimizar firebase.json para producción
        const firebaseConfig = {
            "firestore": {
                "rules": "firestore.rules",
                "indexes": "firestore.indexes.json"
            },
            "database": {
                "rules": "database.rules.json"
            },
            "hosting": {
                "public": ".",
                "ignore": [
                    "firebase.json",
                    "**/.*",
                    "**/node_modules/**",
                    "migrate-*.js",
                    "check-*.js",
                    "debug-*.js",
                    "fix-*.js",
                    "test-*.js",
                    "*.md"
                ],
                "rewrites": [
                    {
                        "source": "/api/**",
                        "function": "api"
                    },
                    {
                        "source": "**",
                        "destination": "/index.html"
                    }
                ],
                "headers": [
                    {
                        "source": "**/*.@(js|css)",
                        "headers": [
                            {
                                "key": "Cache-Control",
                                "value": "public, max-age=31536000"
                            }
                        ]
                    }
                ]
            },
            "functions": {
                "source": ".",
                "runtime": "nodejs18"
            }
        };
        
        fs.writeFileSync('firebase.json', JSON.stringify(firebaseConfig, null, 2));
        console.log('✅ firebase.json optimizado para producción');
        
        // 6. Crear README para producción
        const readmeProd = `# TCGtrade - Producción

## 🚀 Despliegue

### Opción 1: Firebase Hosting + Functions
\`\`\`bash
# 1. Instalar Firebase CLI
npm install -g firebase-tools

# 2. Login en Firebase
firebase login

# 3. Desplegar
firebase deploy --only hosting,functions
\`\`\`

### Opción 2: Railway/Heroku
\`\`\`bash
# 1. Configurar variables de entorno
# DATABASE_URL, POKEMON_TCG_API_KEY

# 2. Desplegar
git push heroku main
# o
railway up
\`\`\`

## 📊 Estadísticas Actuales
- Total cartas: ${data.total_cards}
- Con imágenes: ${data.with_images} (${((data.with_images/data.total_cards)*100).toFixed(1)}%)
- Con series: ${data.with_series} (${((data.with_series/data.total_cards)*100).toFixed(1)}%)

## 🔧 Configuración
- Base de datos: PostgreSQL
- API: TCGdex + PostgreSQL híbrido
- Frontend: HTML/CSS/JavaScript vanilla
- Hosting: Firebase Hosting
- Functions: Node.js 18
`;
        
        fs.writeFileSync('README-PRODUCTION.md', readmeProd);
        console.log('✅ README-PRODUCTION.md creado');
        
        // 7. Crear script de despliegue rápido
        const deployScript = `#!/bin/bash
echo "🚀 Desplegando TCGtrade a producción..."

# Verificar que estamos en la rama correcta
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
    echo "⚠️ Cambia a la rama main: git checkout main"
    exit 1
fi

# Limpiar cache
npm cache clean --force

# Instalar dependencias
npm install --production

# Desplegar a Firebase
firebase deploy --only hosting,functions

echo "✅ Despliegue completado!"
echo "🌐 Tu web está en: https://tcgtrade.web.app"
`;
        
        fs.writeFileSync('deploy.sh', deployScript);
        fs.chmodSync('deploy.sh', '755');
        console.log('✅ deploy.sh creado');
        
        console.log('\n🎉 ¡Preparación completada!');
        console.log('\n📋 Pasos para desplegar:');
        console.log('1️⃣ Opción A - Firebase:');
        console.log('   npm install -g firebase-tools');
        console.log('   firebase login');
        console.log('   firebase deploy --only hosting,functions');
        console.log('\n2️⃣ Opción B - Railway:');
        console.log('   railway up');
        console.log('   Configurar DATABASE_URL en variables de entorno');
        console.log('\n3️⃣ Opción C - Script rápido:');
        console.log('   ./deploy.sh');
        
        console.log('\n🌐 Tu aplicación estará disponible en:');
        console.log('   - Firebase: https://tcgtrade.web.app');
        console.log('   - O tu dominio personalizado');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

prepareProduction();
