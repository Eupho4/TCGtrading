const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:yyHavXPjvNKFLHjltnZjkUUvtDaPjKFf@nozomi.proxy.rlwy.net:50668/railway',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  
  const r1 = await client.query("SELECT COUNT(*) as total FROM cards WHERE images IS NULL OR images = '{}'::jsonb OR images->>'small' IS NULL");
  console.log('Sin imagen:', r1.rows[0].total);
  
  const r2 = await client.query("SELECT COUNT(*) as total FROM cards WHERE images->>'small' IS NOT NULL AND images->>'small' != ''");
  console.log('Con imagen:', r2.rows[0].total);
  
  const r3 = await client.query("SELECT id, name, set_id, images FROM cards WHERE images IS NULL OR images = '{}'::jsonb OR images->>'small' IS NULL LIMIT 15");
  console.log('\nEjemplos sin imagen:');
  r3.rows.forEach(r => console.log(`  ${r.id} | ${r.name} | set: ${r.set_id} | images: ${JSON.stringify(r.images)}`));
  
  // Cartas con imagen que contiene /high.webp pero no funciona (URL rota)
  const r4 = await client.query("SELECT COUNT(*) as total FROM cards WHERE images->>'small' LIKE '%/high.webp/high.webp'");
  console.log('\nCon doble /high.webp:', r4.rows[0].total);

  client.release();
  await pool.end();
}

check();
