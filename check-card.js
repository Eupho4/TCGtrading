const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:yyHavXPjvNKFLHjltnZjkUUvtDaPjKFf@nozomi.proxy.rlwy.net:50668/railway',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  
  const r = await client.query("SELECT id, name, set_id, images FROM cards WHERE name ILIKE '%Shining Rayquaza%'");
  r.rows.forEach(row => {
    console.log('ID:', row.id);
    console.log('Name:', row.name);
    console.log('Set:', row.set_id);
    console.log('Images:', JSON.stringify(row.images));
    console.log('---');
  });

  client.release();
  await pool.end();
}

check();
