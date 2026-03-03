require('dotenv').config();
console.log('🔍 DEBUG RAILWAY - Análisis completo del problema');
console.log('==========================================');

// 1. Verificar variables de entorno
console.log('\n📋 Variables de entorno:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Configurada' : '❌ NO CONFIGURADA');
console.log('NODE_ENV:', process.env.NODE_ENV || '❌ NO CONFIGURADO');
console.log('PORT:', process.env.PORT || '3000 (default)');

// 2. Analizar DATABASE_URL si existe
if (process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL;
    console.log('\n🔗 Análisis DATABASE_URL:');
    console.log('URL completa:', dbUrl.substring(0, 20) + '...');
    console.log('Protocolo:', dbUrl.startsWith('postgresql://') ? '✅ postgresql://' : '❌ Protocolo incorrecto');
    console.log('Contiene @:', dbUrl.includes('@') ? '✅ Sí' : '❌ No');
    console.log('Contiene puerto:', dbUrl.includes(':5432') || dbUrl.match(/:\d+/) ? '✅ Sí' : '❌ No');
    
    // Extraer partes
    try {
        const url = new URL(dbUrl);
        console.log('Host:', url.hostname);
        console.log('Puerto:', url.port);
        console.log('Usuario:', url.username);
        console.log('Database:', url.pathname.substring(1));
        
        // Verificar si es localhost
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            console.log('❌ PROBLEMA: Usando localhost - no funciona en Railway');
        } else {
            console.log('✅ Host externo - correcto para Railway');
        }
    } catch (e) {
        console.log('❌ ERROR: URL inválida:', e.message);
    }
} else {
    console.log('\n❌ PROBLEMA CRÍTICO: DATABASE_URL no está configurada');
}

// 3. Probar conexión a base de datos
const { Pool } = require('pg');

async function testConnection() {
    if (!process.env.DATABASE_URL) {
        console.log('\n❌ No se puede probar conexión - DATABASE_URL no configurada');
        return;
    }
    
    console.log('\n🔌 Probando conexión a PostgreSQL...');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000
    });
    
    try {
        console.log('⏳ Intentando conectar...');
        const client = await pool.connect();
        console.log('✅ Conexión exitosa a PostgreSQL');
        
        // Probar query simple
        const result = await client.query('SELECT NOW() as time, version() as version');
        console.log('📊 Database time:', result.rows[0].time);
        console.log('📊 PostgreSQL version:', result.rows[0].version.substring(0, 50) + '...');
        
        // Verificar si existen las tablas
        const tablesQuery = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('📁 Tablas encontradas:', tablesQuery.rows.map(r => r.table_name).join(', '));
        
        // Verificar si existe la tabla cards
        const cardsExists = tablesQuery.rows.some(r => r.table_name === 'cards');
        if (cardsExists) {
            const countQuery = await client.query('SELECT COUNT(*) as count FROM cards');
            console.log('🎴 Total cartas en BD:', countQuery.rows[0].count);
        } else {
            console.log('❌ Tabla "cards" no existe - necesitas migrar datos');
        }
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.log('❌ ERROR DE CONEXIÓN:', error.message);
        
        // Análisis del error
        if (error.message.includes('ECONNREFUSED')) {
            console.log('🔍 Diagnóstico: Conexión rechazada');
            console.log('   - ¿La base de datos está corriendo?');
            console.log('   - ¿El host es correcto?');
            console.log('   - ¿El puerto es correcto?');
        } else if (error.message.includes('authentication')) {
            console.log('🔍 Diagnóstico: Error de autenticación');
            console.log('   - ¿Usuario y password correctos?');
        } else if (error.message.includes('database') && error.message.includes('does not exist')) {
            console.log('🔍 Diagnóstico: Base de datos no existe');
            console.log('   - ¿Nombre de database correcto?');
        } else if (error.message.includes('timeout')) {
            console.log('🔍 Diagnóstico: Timeout de conexión');
            console.log('   - ¿Problemas de red?');
            console.log('   - ¿Base de datos muy lenta?');
        }
        
        await pool.end();
    }
}

// 4. Verificar estructura del proyecto
console.log('\n📁 Estructura del proyecto:');
const fs = require('fs');
const path = require('path');

const filesToCheck = [
    'server-simple.js',
    'package.json',
    'html/index.html',
    'js/app-ui.js',
    '.env'
];

filesToCheck.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`${exists ? '✅' : '❌'} ${file}`);
});

// 5. Verificar package.json
try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log('\n📦 Package.json:');
    console.log('Main:', packageJson.main);
    console.log('Start script:', packageJson.scripts?.start);
    console.log('Dependencies:', Object.keys(packageJson.dependencies || {}).join(', '));
} catch (e) {
    console.log('\n❌ Error leyendo package.json:', e.message);
}

// 6. Ejecutar prueba de conexión
testConnection().then(() => {
    console.log('\n🎯 RESUMEN DEL PROBLEMA:');
    console.log('========================');
    
    if (!process.env.DATABASE_URL) {
        console.log('❌ PROBLEMA PRINCIPAL: DATABASE_URL no configurada');
        console.log('🔧 SOLUCIÓN: Configurar DATABASE_URL en Railway Variables');
    } else {
        console.log('✅ DATABASE_URL configurada');
        console.log('🔧 Revisa el diagnóstico de conexión arriba');
    }
    
    console.log('\n📋 PASOS A SEGUIR:');
    console.log('1. Configurar DATABASE_URL en Railway');
    console.log('2. Asegurar que la base de datos sea accesible desde Railway');
    console.log('3. Verificar que las tablas existan');
    console.log('4. Probar la API');
    
    console.log('\n🚀 Una vez solucionado, tu aplicación funcionará en:');
    console.log('   https://tu-app.railway.app');
}).catch(console.error);
