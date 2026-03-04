const { execSync } = require('child_process');

const RAILWAY_TOKEN = '2129ae78-2ad0-4e6e-abc1-a8147fa7a4d8';
const DATABASE_URL = 'postgresql://postgres:yyHavXPjvNKFLHjltnZjkUUvtDaPjKFf@nozomi.proxy.rlwy.net:50668/railway';

console.log('🚀 Configurando Railway...');

// Configurar token
process.env.RAILWAY_TOKEN = RAILWAY_TOKEN;

try {
  // Verificar autenticación
  console.log('✅ Verificando autenticación...');
  const whoami = execSync('railway whoami', { encoding: 'utf8' });
  console.log('Usuario:', whoami.trim());

  // Configurar DATABASE_URL
  console.log('🔧 Configurando DATABASE_URL...');
  execSync(`railway variables set DATABASE_URL="${DATABASE_URL}"`, { stdio: 'inherit' });
  console.log('✅ Variable configurada');

  // Desplegar
  console.log('🚀 Desplegando a Railway...');
  execSync('railway up', { stdio: 'inherit' });
  console.log('✅ Deploy completado');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
