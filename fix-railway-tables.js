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
        else reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 200)}`));
      });
    }).on('error', reject);
  });
}

async function fix() {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Conectado a Railway');

    // 1. Crear tabla series
    console.log('📚 Creando tabla series...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS series (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        logo VARCHAR(500)
      )
    `);

    // 2. Crear tabla sets
    console.log('📦 Creando tabla sets...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS sets (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        series_id VARCHAR(50),
        printed_total INTEGER,
        total INTEGER,
        release_date VARCHAR(20),
        logo VARCHAR(500),
        symbol VARCHAR(500)
      )
    `);

    // 3. Crear tabla types
    console.log('🏷️ Creando tabla types...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS types (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(50) NOT NULL
      )
    `);

    // 4. Crear tabla rarities
    console.log('💎 Creando tabla rarities...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS rarities (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL
      )
    `);

    // 5. Poblar series desde TCGdex
    console.log('📚 Obteniendo series de TCGdex...');
    const seriesData = await apiGet('https://api.tcgdex.net/v2/en/series');
    let seriesCount = 0;
    for (const s of seriesData) {
      await client.query(
        'INSERT INTO series (id, name, logo) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [s.id, s.name || '', s.logo || null]
      );
      seriesCount++;
    }
    console.log(`✅ ${seriesCount} series insertadas`);

    // 6. Poblar sets desde TCGdex
    console.log('📦 Obteniendo sets de TCGdex...');
    const setsData = await apiGet('https://api.tcgdex.net/v2/en/sets');
    let setsCount = 0;
    for (const set of setsData) {
      // Obtener detalle de cada set para tener serie, logo, etc.
      let detail;
      try {
        detail = await apiGet(`https://api.tcgdex.net/v2/en/sets/${set.id}`);
      } catch (e) {
        detail = set;
      }
      const seriesId = (detail.serie && detail.serie.id) || null;
      await client.query(
        `INSERT INTO sets (id, name, series_id, printed_total, total, release_date, logo, symbol)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
        [
          set.id, set.name || '',
          seriesId,
          detail.cardCount && detail.cardCount.official || null,
          detail.cardCount && detail.cardCount.total || null,
          detail.releaseDate || null,
          detail.logo || set.logo || null,
          detail.symbol || null
        ]
      );
      setsCount++;
      if (setsCount % 50 === 0) console.log(`   Sets: ${setsCount}...`);
    }
    console.log(`✅ ${setsCount} sets insertados`);

    // 7. Poblar types
    console.log('🏷️ Insertando tipos...');
    const typeNames = ['Colorless','Darkness','Dragon','Fairy','Fighting','Fire','Grass','Lightning','Metal','Psychic','Water'];
    for (const t of typeNames) {
      await client.query('INSERT INTO types (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [t.toLowerCase(), t]);
    }
    console.log(`✅ ${typeNames.length} tipos insertados`);

    // 8. Poblar rarities desde los datos de cards
    console.log('💎 Extrayendo rarezas de las cartas...');
    const raritiesResult = await client.query(
      `SELECT DISTINCT rarity_id FROM cards WHERE rarity_id IS NOT NULL AND rarity_id != ''`
    );
    let rarCount = 0;
    for (const row of raritiesResult.rows) {
      const rid = row.rarity_id;
      const name = rid.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      await client.query('INSERT INTO rarities (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [rid, name]);
      rarCount++;
    }
    console.log(`✅ ${rarCount} rarezas insertadas`);

    // 9. Verificar todo
    const stats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM cards) as cards,
        (SELECT COUNT(*) FROM series) as series,
        (SELECT COUNT(*) FROM sets) as sets,
        (SELECT COUNT(*) FROM types) as types,
        (SELECT COUNT(*) FROM rarities) as rarities
    `);
    const s = stats.rows[0];
    console.log(`\n🎉 BASE DE DATOS RAILWAY COMPLETA:`);
    console.log(`   📊 Cards: ${s.cards}`);
    console.log(`   📚 Series: ${s.series}`);
    console.log(`   📦 Sets: ${s.sets}`);
    console.log(`   🏷️ Types: ${s.types}`);
    console.log(`   💎 Rarities: ${s.rarities}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
    console.log('🔚 Conexión cerrada');
  }
}

fix();
