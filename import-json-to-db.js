require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuración de PostgreSQL
const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL no está configurada');
    process.exit(1);
}

const isLocalConnection = /(^|\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/i.test(connectionString);
const sslFromEnv = process.env.PG_SSL;

const ssl = sslFromEnv != null
    ? (sslFromEnv.toLowerCase() === 'true' ? { rejectUnauthorized: false } : false)
    : (isLocalConnection ? false : { rejectUnauthorized: false });

const pool = new Pool({
    connectionString,
    ssl
});

async function importJsonToDatabase(jsonFilePath) {
    console.log('🚀 Iniciando importación desde JSON a PostgreSQL...');
    console.log('📁 Archivo:', jsonFilePath);
    
    try {
        // Leer archivo JSON
        const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
        console.log('📊 Estadísticas del archivo:', jsonData.stats);
        
        // Conectar a BD
        await pool.query('SELECT 1');
        console.log('✅ Conexión a PostgreSQL establecida');
        
        // Limpiar BD existente
        console.log('🧹 Limpiando base de datos...');
        await pool.query('DROP TABLE IF EXISTS cards CASCADE');
        await pool.query('DROP TABLE IF EXISTS sets CASCADE');
        await pool.query('DROP TABLE IF EXISTS series CASCADE');
        await pool.query('DROP TABLE IF EXISTS types CASCADE');
        await pool.query('DROP TABLE IF EXISTS rarities CASCADE');
        
        // Crear tablas
        console.log('🏗️ Creando tablas...');
        
        await pool.query(`
            CREATE TABLE series (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                logo VARCHAR(255)
            )
        `);
        
        await pool.query(`
            CREATE TABLE sets (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                series_id VARCHAR(50) REFERENCES series(id),
                printed_total INTEGER,
                total INTEGER,
                release_date DATE,
                logo VARCHAR(255),
                symbol VARCHAR(255)
            )
        `);
        
        await pool.query(`
            CREATE TABLE types (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(50) NOT NULL
            )
        `);
        
        await pool.query(`
            CREATE TABLE rarities (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(50) NOT NULL
            )
        `);
        
        await pool.query(`
            CREATE TABLE cards (
                id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                number VARCHAR(20),
                set_id VARCHAR(50) REFERENCES sets(id),
                rarity_id VARCHAR(50) REFERENCES rarities(id),
                hp INTEGER,
                types TEXT[],
                subtypes TEXT[],
                rules TEXT[],
                images JSONB,
                tcgplayer JSONB,
                cardmarket JSONB,
                legal JSONB,
                artist VARCHAR(100),
                flavor_text TEXT,
                national_pokedex_numbers INTEGER[],
                attacks JSONB,
                weaknesses JSONB,
                resistances JSONB,
                retreat_cost TEXT[],
                converted_retreat_cost INTEGER
            )
        `);
        
        // Índices
        await pool.query('CREATE INDEX idx_cards_name ON cards(name)');
        await pool.query('CREATE INDEX idx_cards_set_id ON cards(set_id)');
        await pool.query('CREATE INDEX idx_cards_types ON cards USING GIN(types)');
        await pool.query('CREATE INDEX idx_sets_series_id ON sets(series_id)');
        
        // Importar series
        console.log('📚 Importando series...');
        for (const series of jsonData.data.series) {
            await pool.query(
                'INSERT INTO series (id, name, logo) VALUES ($1, $2, $3)',
                [series.id, series.name, series.logo]
            );
        }
        
        // Importar sets
        console.log('📦 Importando sets...');
        for (const set of jsonData.data.sets) {
            await pool.query(`
                INSERT INTO sets (id, name, series_id, printed_total, total, release_date, logo, symbol)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                set.id, set.name, set.series.id, set.printedTotal, set.total,
                set.releaseDate, set.logo, set.symbol
            ]);
        }
        
        // Importar tipos
        console.log('🏷️ Importando tipos...');
        for (const type of jsonData.data.types) {
            await pool.query(
                'INSERT INTO types (id, name) VALUES ($1, $2)',
                [type.toLowerCase(), type]
            );
        }
        
        // Importar rarezas
        console.log('💎 Importando rarezas...');
        for (const rarity of jsonData.data.rarities) {
            const rarityId = rarity.toLowerCase().replace(/\s+/g, '-');
            await pool.query(
                'INSERT INTO rarities (id, name) VALUES ($1, $2)',
                [rarityId, rarity]
            );
        }
        
        // Importar cartas
        console.log('🃏 Importando cartas...');
        let cardsImported = 0;
        for (const card of jsonData.data.cards) {
            const rarityId = card.rarity ? card.rarity.toLowerCase().replace(/\s+/g, '-') : null;
            
            await pool.query(`
                INSERT INTO cards (
                    id, name, number, set_id, rarity_id, hp, types, subtypes,
                    rules, images, tcgplayer, cardmarket, legal, artist,
                    flavor_text, national_pokedex_numbers, attacks, weaknesses,
                    resistances, retreat_cost, converted_retreat_cost
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
            `, [
                card.id, card.name, card.number, card.set.id, rarityId, card.hp,
                card.types || [], card.subtypes || [], card.rules || [],
                card.images, card.tcgplayer, card.cardmarket, card.legal,
                card.artist, card.flavorText, card.nationalPokedexNumbers || [],
                card.attacks, card.weaknesses, card.resistances,
                card.retreatCost || [], card.convertedRetreatCost
            ]);
            
            cardsImported++;
            if (cardsImported % 100 === 0) {
                console.log(`📈 Progreso cartas: ${cardsImported}/${jsonData.data.cards.length}`);
            }
        }
        
        // Estadísticas finales
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM series) as series_count,
                (SELECT COUNT(*) FROM sets) as sets_count,
                (SELECT COUNT(*) FROM types) as types_count,
                (SELECT COUNT(*) FROM rarities) as rarities_count,
                (SELECT COUNT(*) FROM cards) as cards_count
        `);
        
        const s = stats.rows[0];
        
        console.log('🎉 IMPORTACIÓN COMPLETADA CON ÉXITO');
        console.log('📊 Estadísticas finales:');
        console.log(`  - Series: ${s.series_count}`);
        console.log(`  - Sets: ${s.sets_count}`);
        console.log(`  - Tipos: ${s.types_count}`);
        console.log(`  - Rarezas: ${s.rarities_count}`);
        console.log(`  - Cartas: ${s.cards_count}`);
        
    } catch (error) {
        console.error('❌ Error en importación:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// Uso: node import-json-to-db.js archivo.json
const jsonFile = process.argv[2];
if (!jsonFile) {
    console.log('❌ Uso: node import-json-to-db.js <archivo.json>');
    console.log('📁 Ejemplo: node import-json-to-db.js pokemon-tcg-migration-2024-02-18.json');
    process.exit(1);
}

if (!fs.existsSync(jsonFile)) {
    console.log('❌ El archivo no existe:', jsonFile);
    process.exit(1);
}

importJsonToDatabase(jsonFile).catch(console.error);
