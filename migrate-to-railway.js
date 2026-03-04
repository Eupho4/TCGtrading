const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Conexión a Railway (remota, con SSL)
const pool = new Pool({
  connectionString: 'postgresql://postgres:yyHavXPjvNKFLHjltnZjkUUvtDaPjKFf@nozomi.proxy.rlwy.net:50668/railway',
  ssl: { rejectUnauthorized: false }
});

function normalizeStringArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
    }
    return [value];
  }
  return [];
}

function normalizeIntArray(value) {
  return normalizeStringArray(value)
    .map(x => typeof x === 'number' ? x : Number(String(x)))
    .filter(n => Number.isFinite(n));
}

function toJsonb(value) {
  if (value == null) return null;
  return JSON.stringify(value);
}

async function migrate() {
  let client;
  const limitFromEnv = process.env.LIMIT_CARDS ? Number(process.env.LIMIT_CARDS) : undefined;

  try {
    console.log('🚀 Conectando a Railway PostgreSQL...');
    client = await pool.connect();
    console.log('✅ Conectado a Railway');

    // Leer JSON
    const jsonFile = path.join(__dirname, 'tcg_complete_backup_2026-02-19T14-19-35-633Z.json');
    console.log('📁 Leyendo backup JSON...');
    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    console.log(`📊 Cartas en backup: ${data.cards?.length || 0}`);

    // Crear estructura
    console.log('🏗️ Creando estructura de tablas...');
    await client.query('DROP TABLE IF EXISTS cards CASCADE');
    await client.query('DROP TABLE IF EXISTS sets CASCADE');
    await client.query('DROP TABLE IF EXISTS series CASCADE');
    await client.query('DROP TABLE IF EXISTS types CASCADE');
    await client.query('DROP TABLE IF EXISTS rarities CASCADE');

    await client.query(`
      CREATE TABLE cards (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        number VARCHAR(20),
        set_id VARCHAR(50),
        rarity_id VARCHAR(50),
        hp VARCHAR(10),
        types TEXT[],
        subtypes TEXT[],
        rules TEXT[],
        images JSONB,
        tcgplayer JSONB,
        cardmarket JSONB,
        legal JSONB,
        artist VARCHAR(255),
        flavor_text TEXT,
        national_pokedex_numbers INTEGER[],
        attacks JSONB,
        weaknesses JSONB,
        resistances JSONB,
        retreat_cost TEXT[],
        converted_retreat_cost INTEGER
      )
    `);
    await client.query('CREATE INDEX idx_cards_name ON cards(name)');
    await client.query('CREATE INDEX idx_cards_set_id ON cards(set_id)');

    console.log('✅ Tablas creadas');

    // Importar cartas
    const total = (limitFromEnv && Number.isFinite(limitFromEnv))
      ? Math.min(limitFromEnv, data.cards.length)
      : data.cards.length;

    console.log(`🔄 Importando ${total} cartas a Railway...`);

    let imported = 0;
    let errors = 0;

    for (let i = 0; i < total; i++) {
      const card = data.cards[i];
      const types = normalizeStringArray(card.types);
      const subtypes = normalizeStringArray(card.subtypes);
      const rules = normalizeStringArray(card.rules);
      const retreatCost = normalizeStringArray(card.retreat_cost);
      const natDex = normalizeIntArray(card.national_pokedex_numbers);
      const images = toJsonb(card.images);
      const tcgplayer = toJsonb(card.tcgplayer);
      const cardmarket = toJsonb(card.cardmarket);
      const legal = toJsonb(card.legal);
      const attacks = toJsonb(card.attacks);
      const weaknesses = toJsonb(card.weaknesses);
      const resistances = toJsonb(card.resistances);

      try {
        await client.query(`
          INSERT INTO cards (
            id, name, number, set_id, rarity_id, hp, types, subtypes, rules,
            images, tcgplayer, cardmarket, legal, artist, flavor_text,
            national_pokedex_numbers, attacks, weaknesses, resistances,
            retreat_cost, converted_retreat_cost
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
          ) ON CONFLICT (id) DO NOTHING
        `, [
          card.id, card.name, card.number, card.set_id, card.rarity_id,
          card.hp, types, subtypes, rules, images,
          tcgplayer, cardmarket, legal, card.artist,
          card.flavor_text, natDex, attacks,
          weaknesses, resistances, retreatCost,
          card.converted_retreat_cost
        ]);
        imported++;
      } catch (err) {
        errors++;
        if (errors <= 3) {
          console.error(`❌ Error carta ${card.id}: ${err.message}`);
        }
      }

      if ((i + 1) % 1000 === 0) {
        console.log(`✅ Progreso: ${i + 1}/${total} (importadas: ${imported}, errores: ${errors})`);
      }
    }

    // Verificar
    const result = await client.query('SELECT COUNT(*) as total FROM cards');
    console.log(`\n🎉 MIGRACIÓN A RAILWAY COMPLETADA`);
    console.log(`📊 Cartas en Railway: ${result.rows[0].total}`);
    console.log(`✅ Importadas: ${imported}`);
    console.log(`❌ Errores: ${errors}`);

  } catch (error) {
    console.error('❌ Error fatal:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
    console.log('🔚 Conexión cerrada');
  }
}

migrate();
