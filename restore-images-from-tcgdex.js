const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  connectionString: 'postgresql://postgres:yyHavXPjvNKFLHjltnZjkUUvtDaPjKFf@nozomi.proxy.rlwy.net:50668/railway',
  ssl: { rejectUnauthorized: false }
});

function apiGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'TCGtrade/1.0' } }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(body));
        else reject(new Error(`HTTP ${res.statusCode}`));
      });
    }).on('error', reject);
  });
}

async function restoreImages() {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Conectado a Railway');

    // Obtener todos los sets únicos
    const setsResult = await client.query('SELECT DISTINCT set_id FROM cards WHERE set_id IS NOT NULL ORDER BY set_id');
    const sets = setsResult.rows.map(r => r.set_id);
    console.log(`📦 ${sets.length} sets encontrados`);

    let totalUpdated = 0;
    let errors = 0;

    for (const setId of sets) {
      try {
        console.log(`\n🔍 Procesando set: ${setId}`);
        
        // Obtener cartas del set desde TCGdex
        const setData = await apiGet(`https://api.tcgdex.net/v2/en/sets/${setId}`);
        
        if (!setData.cards || setData.cards.length === 0) {
          console.log(`  ⚠️ No hay cartas en TCGdex para ${setId}`);
          continue;
        }

        console.log(`  📊 ${setData.cards.length} cartas en TCGdex`);

        // Actualizar cada carta
        for (const tcgCard of setData.cards) {
          const cardId = `${setId}-${tcgCard.localId}`;
          
          const images = {
            small: `https://assets.tcgdex.net/en/${setData.serie.id}/${setId}/${tcgCard.localId}/high.webp`,
            large: `https://assets.tcgdex.net/en/${setData.serie.id}/${setId}/${tcgCard.localId}/high.webp`
          };

          await client.query(
            'UPDATE cards SET images = $1 WHERE id = $2',
            [JSON.stringify(images), cardId]
          );
          totalUpdated++;
        }

        console.log(`  ✅ Set ${setId} actualizado`);
        
        // Pequeña pausa para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (e) {
        console.error(`  ❌ Error en set ${setId}:`, e.message);
        errors++;
      }

      // Mostrar progreso cada 10 sets
      if ((sets.indexOf(setId) + 1) % 10 === 0) {
        console.log(`\n📊 Progreso: ${sets.indexOf(setId) + 1}/${sets.length} sets procesados`);
        console.log(`   ✅ ${totalUpdated} cartas actualizadas`);
        console.log(`   ❌ ${errors} errores`);
      }
    }

    console.log(`\n🎉 COMPLETADO:`);
    console.log(`   ✅ ${totalUpdated} cartas actualizadas`);
    console.log(`   ❌ ${errors} errores`);

  } catch (error) {
    console.error('❌ Error fatal:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
    console.log('🔚 Conexión cerrada');
  }
}

restoreImages();
