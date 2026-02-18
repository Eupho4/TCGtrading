// Script para agregar health check al server-hybrid.js

const fs = require('fs');

// Leer el archivo actual
const serverContent = fs.readFileSync('server-hybrid.js', 'utf8');

// Buscar dónde agregar el health check (antes del listen)
const listenIndex = serverContent.indexOf('app.listen');

if (listenIndex === -1) {
    console.log('❌ No se encontró app.listen en server-hybrid.js');
    process.exit(1);
}

// Health check endpoint
const healthCheck = `
// Health check endpoint para Railway
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: 'connected'
    });
});

`;

// Insertar el health check antes del listen
const newContent = serverContent.slice(0, listenIndex) + 
                   healthCheck + 
                   serverContent.slice(listenIndex);

// Escribir el nuevo contenido
fs.writeFileSync('server-hybrid.js', newContent);

console.log('✅ Health check agregado a server-hybrid.js');
console.log('🌐 Endpoint disponible: /api/health');
