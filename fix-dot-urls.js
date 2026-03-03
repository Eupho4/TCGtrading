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

function httpHead(url) {
  return new Promise((resolve) => {
    https.request(url, { method: 'HEAD' }, (res) => {
      resolve(res.statusCode);
    }).on('error', () => resolve(0)).end();
  });
}

async function fix() {
  const client = await pool.connect();
  
  // Encontrar sets con punto en el ID
  const dotSets = await client.query("SELECT DISTINCT set_id FROM cards WHERE set_id LIKE '%.%' ORDER BY set_id");
  console.log(`📦 Sets con punto en ID: ${dotSets.rows.length}`);
  dotSets.rows.forEach(r => console.log(`  ${r.set_id}`));

  let totalFixed = 0;
  
  for (const row of dotSets.rows) {
    const setId = row.set_id;
    console.log(`\n🔧 Arreglando set: ${setId}`);
    
    try {
      // Obtener info del set desde TCGdex
      const setData = await apiGet(`https://api.tcgdex.net/v2/en/sets/${setId}`);
      const serieId = setData.serie?.id || '';
      
      // El path del set en la URL de assets elimina el punto
      const setPathNoDot = setId.replace(/\./g, '');
      
      // Verificar que la URL sin punto funciona
      const testCard = setData.cards?.[0];
      if (testCard) {
        const testUrl = `https://assets.tcgdex.net/en/${serieId}/${setPathNoDot}/${testCard.localId}/high.webp`;
        const status = await httpHead(testUrl);
        console.log(`  Test URL: ${testUrl} => ${status}`);
        
        if (status !== 200) {
          console.log(`  ⚠️ URL sin punto no funciona, probando otras variantes...`);
          // Probar con el ID del set tal cual
          const testUrl2 = `https://assets.tcgdex.net/en/${serieId}/${setId}/${testCard.localId}/high.webp`;
          const status2 = await httpHead(testUrl2);
          console.log(`  Test URL2: ${testUrl2} => ${status2}`);
          if (status2 !== 200) {
            console.log(`  ❌ No se encontró URL válida para ${setId}`);
            continue;
          }
          // Si funciona con punto, no hay que cambiar nada
          continue;
        }
      }
      
      // Actualizar todas las cartas del set
      const cards = await client.query("SELECT id, images FROM cards WHERE set_id = $1", [setId]);
      
      for (const card of cards.rows) {
        const images = card.images;
        if (images && images.small) {
          // Reemplazar el set path con punto por sin punto
          const newSmall = images.small.replace(`/${setId}/`, `/${setPathNoDot}/`);
          const newLarge = (images.large || images.small).replace(`/${setId}/`, `/${setPathNoDot}/`);
          
          if (newSmall !== images.small) {
            await client.query("UPDATE cards SET images = $1 WHERE id = $2", [
              JSON.stringify({ small: newSmall, large: newLarge }),
              card.id
            ]);
            totalFixed++;
          }
        }
      }
      
      console.log(`  ✅ ${cards.rows.length} cartas actualizadas`);
      
    } catch (e) {
      console.error(`  ❌ Error: ${e.message}`);
    }
  }

  // También buscar cartas cuya URL devuelve 404 (muestreo)
  console.log('\n\n📊 Verificando muestra de URLs...');
  const sample = await client.query("SELECT id, images FROM cards WHERE images->>'small' IS NOT NULL ORDER BY RANDOM() LIMIT 20");
  let ok = 0, fail = 0;
  for (const row of sample.rows) {
    const status = await httpHead(row.images.small);
    if (status === 200) { ok++; }
    else { 
      fail++;
      console.log(`  ❌ ${row.id}: ${row.images.small} => ${status}`);
    }
  }
  console.log(`  OK: ${ok}/20, Fail: ${fail}/20`);

  console.log(`\n🎉 Total cartas arregladas: ${totalFixed}`);
  client.release();
  await pool.end();
}

fix();
