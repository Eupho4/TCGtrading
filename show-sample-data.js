require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function showSampleData() {
    try {
        console.log('🎴 EJEMPLO DE DATOS EN LA BASE DE DATOS:');
        console.log('='.repeat(50));
        
        // Mostrar algunas cartas
        console.log('\n🃏 CARTAS (primeras 5):');
        const cards = await pool.query(`
            SELECT id, name, set_id, rarity_id, types 
            FROM cards 
            ORDER BY name 
            LIMIT 5
        `);
        
        cards.rows.forEach(card => {
            console.log(`- ${card.name} (${card.id})`);
            console.log(`  Set: ${card.set_id} | Rareza: ${card.rarity_id}`);
            console.log(`  Tipos: ${card.types?.join(', ') || 'N/A'}`);
            console.log('');
        });
        
        // Mostrar sets
        console.log('📦 SETS (primeros 5):');
        const sets = await pool.query(`
            SELECT id, name, printed_total, series_id 
            FROM sets 
            ORDER BY name 
            LIMIT 5
        `);
        
        sets.rows.forEach(set => {
            console.log(`- ${set.name} (${set.id})`);
            console.log(`  Cartas: ${set.printed_total} | Serie: ${set.series_id}`);
            console.log('');
        });
        
        // Mostrar series
        console.log('📚 SERIES (primeras 5):');
        const series = await pool.query(`
            SELECT id, name 
            FROM series 
            ORDER BY name 
            LIMIT 5
        `);
        
        series.rows.forEach(serie => {
            console.log(`- ${serie.name} (${serie.id})`);
        });
        
        console.log('\n💾 ESTOS DATOS ESTÁN GUARDADOS EN:');
        console.log('📍 PostgreSQL Database: pokemon_tcg');
        console.log('🌐 Host: localhost:5432');
        console.log('📁 Tablas: cards, sets, series, rarities');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

showSampleData();
