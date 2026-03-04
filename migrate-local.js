const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configuración directa para PostgreSQL local sin SSL
const pool = new Pool({
  connectionString: 'postgresql://postgres:Badalona.17@localhost:5432/Pokemon%20TCG',
  ssl: false
});

function normalizePgArrayLiteral(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return value;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  // muy simple: soporta elementos entrecomillados sin comas escapadas
  return inner.split(',').map((part) => part.trim().replace(/^"|"$/g, ''));
}

function normalizeStringArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  const maybe = normalizePgArrayLiteral(value);
  if (Array.isArray(maybe)) return maybe;
  if (typeof maybe === 'string') return [maybe];
  return [];
}

function normalizeIntArray(value) {
  const arr = normalizeStringArray(value);
  return arr
    .map((x) => (typeof x === 'number' ? x : Number(String(x))))
    .filter((n) => Number.isFinite(n));
}

function toJsonb(value) {
  if (value == null) return null;
  return JSON.stringify(value);
}

async function importJsonToDatabase() {
  let client;
  const limitFromEnv = process.env.LIMIT_CARDS ? Number(process.env.LIMIT_CARDS) : undefined;
  try {
    console.log('🚀 Iniciando importación desde JSON a PostgreSQL...');
    
    // Leer archivo JSON
    const jsonFile = path.join(__dirname, 'tcg_complete_backup_2026-02-19T14-19-35-633Z.json');
    console.log(`📁 Archivo: ${jsonFile}`);
    
    if (!fs.existsSync(jsonFile)) {
      throw new Error(`❌ Archivo no encontrado: ${jsonFile}`);
    }
    
    const rawData = fs.readFileSync(jsonFile);
    const data = JSON.parse(rawData);
    
    console.log(`📊 Estadísticas del archivo:`);
    console.log(`   - Cartas: ${data.cards?.length || 0}`);
    console.log(`   - Sets: ${data.sets?.length || 0}`);
    console.log(`   - Series: ${data.series?.length || 0}`);
    
    // Conectar a la base de datos
    client = await pool.connect();
    console.log('✅ Conectado a PostgreSQL');

    // Asegurar estructura mínima
    await client.query('DROP TABLE IF EXISTS cards');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cards (
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
    
    // Importar cartas
    if (data.cards && data.cards.length > 0) {
      const total = limitFromEnv && Number.isFinite(limitFromEnv)
        ? Math.min(limitFromEnv, data.cards.length)
        : data.cards.length;

      console.log(`🔄 Importando ${total} cartas...`);

      let firstErrorShown = false;

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
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
            )
            ON CONFLICT (id) DO NOTHING
          `, [
            card.id, card.name, card.number, card.set_id, card.rarity_id, 
            card.hp, types, subtypes, rules, images,
            tcgplayer, cardmarket, legal, card.artist,
            card.flavor_text, natDex, attacks,
            weaknesses, resistances, retreatCost,
            card.converted_retreat_cost
          ]);
          
          if ((i + 1) % 1000 === 0) {
            console.log(`✅ Importadas ${i + 1}/${total} cartas`);
          }
        } catch (err) {
          if (!firstErrorShown) {
            firstErrorShown = true;
            console.error(`❌ PRIMER error en carta ${card.id}: ${err.message}`);
            if (err && typeof err === 'object') {
              console.error('   code:', err.code);
              console.error('   detail:', err.detail);
              console.error('   hint:', err.hint);
              console.error('   where:', err.where);
            }
            console.error('   card.name:', card.name);
          } else {
            console.error(`❌ Error en carta ${card.id}: ${err.message}`);
          }
        }
      }

      console.log('✅ ¡Cartas importadas correctamente!');
    }
    
    // Verificar importación
    const result = await client.query('SELECT COUNT(*) as total FROM cards');
    console.log(`📊 Total de cartas en BD: ${result.rows[0].total}`);
    
  } catch (error) {
    console.error('❌ Error en importación:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
    console.log('🔚 Conexión cerrada');
  }
}

importJsonToDatabase();
