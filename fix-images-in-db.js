const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:yyHavXPjvNKFLHjltnZjkUUvtDaPjKFf@nozomi.proxy.rlwy.net:50668/railway',
  ssl: { rejectUnauthorized: false }
});

async function fixImages() {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Conectado a Railway');

    // Obtener todas las cartas con imágenes
    const result = await client.query('SELECT id, images FROM cards WHERE images IS NOT NULL LIMIT 5');
    console.log(`📊 Ejemplo de ${result.rows.length} cartas:`);
    
    result.rows.forEach(row => {
      console.log(`  ${row.id}: ${JSON.stringify(row.images)}`);
    });

    // Actualizar todas las URLs de imágenes añadiendo /high.webp
    console.log('\n🔧 Actualizando URLs de imágenes...');
    
    const updateResult = await client.query(`
      UPDATE cards
      SET images = jsonb_set(
        jsonb_set(
          images,
          '{small}',
          to_jsonb(images->>'small' || '/high.webp')
        ),
        '{large}',
        to_jsonb(COALESCE(images->>'large', images->>'small') || '/high.webp')
      )
      WHERE images IS NOT NULL
        AND images->>'small' IS NOT NULL
        AND images->>'small' NOT LIKE '%/high.webp'
    `);

    console.log(`✅ ${updateResult.rowCount} cartas actualizadas`);

    // Verificar resultado
    const verify = await client.query('SELECT id, images FROM cards WHERE images IS NOT NULL LIMIT 5');
    console.log(`\n📊 Verificación (${verify.rows.length} cartas):`);
    verify.rows.forEach(row => {
      console.log(`  ${row.id}: ${JSON.stringify(row.images)}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
    console.log('🔚 Conexión cerrada');
  }
}

fixImages();
