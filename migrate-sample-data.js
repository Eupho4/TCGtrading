require('dotenv').config();
const { Pool } = require('pg');

// Configuración de PostgreSQL local
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Datos de ejemplo para migración
const sampleData = {
    series: [
        { id: "sv1", name: "Scarlet & Violet", logo: "https://assets.pokemontcg.io/logo/logo.png" },
        { id: "swsh", name: "Sword & Shield", logo: "https://assets.pokemontcg.io/logo/swsh.png" },
        { id: "pop", name: "POP", logo: "https://assets.pokemontcg.io/logo/pop.png" }
    ],
    sets: [
        { 
            id: "sv1", 
            name: "Scarlet & Violet", 
            series: "sv1", 
            printedTotal: 258, 
            total: 273, 
            releaseDate: "2023-03-31", 
            logo: "https://assets.pokemontcg.io/swsh1/logo.png", 
            symbol: "https://assets.pokemontcg.io/swsh1/symbol.png" 
        },
        { 
            id: "sv2", 
            name: "Paldea Evolved", 
            series: "sv1", 
            printedTotal: 193, 
            total: 207, 
            releaseDate: "2023-06-09", 
            logo: "https://assets.pokemontcg.io/swsh2/logo.png", 
            symbol: "https://assets.pokemontcg.io/swsh2/symbol.png" 
        },
        { 
            id: "swsh1", 
            name: "Sword & Shield", 
            series: "swsh", 
            printedTotal: 216, 
            total: 216, 
            releaseDate: "2020-02-07", 
            logo: "https://assets.pokemontcg.io/swsh1/logo.png", 
            symbol: "https://assets.pokemontcg.io/swsh1/symbol.png" 
        },
        { 
            id: "swsh2", 
            name: "Rebel Clash", 
            series: "swsh", 
            printedTotal: 192, 
            total: 209, 
            releaseDate: "2020-05-01", 
            logo: "https://assets.pokemontcg.io/swsh2/logo.png", 
            symbol: "https://assets.pokemontcg.io/swsh2/symbol.png" 
        },
        { 
            id: "np", 
            name: "Nintendo Black Star Promos", 
            series: "pop", 
            printedTotal: 40, 
            total: 40, 
            releaseDate: "2003-10-01", 
            logo: "https://assets.pokemontcg.io/np/logo.png", 
            symbol: "https://assets.pokemontcg.io/np/symbol.png" 
        }
    ],
    types: ["Grass", "Fire", "Water", "Lightning", "Psychic", "Fighting"],
    rarities: ["Common", "Uncommon", "Rare", "Rare Holo"],
    cards: [
        {
            id: "sv1-1",
            name: "Sprigatito",
            number: "1",
            rarity: "Common",
            hp: 70,
            types: ["Grass"],
            subtypes: ["Basic"],
            rules: [],
            images: {
                small: "https://images.pokemontcg.io/sv1/1.png",
                large: "https://images.pokemontcg.io/sv1/1_hires.png"
            },
            tcgplayer: {
                url: "https://prices.pokemontcg.io/card/sv1-1",
                updatedAt: "2023-03-31",
                prices: {
                    normal: { low: 0.05, mid: 0.15, high: 1.5, market: 0.12 }
                }
            },
            cardmarket: {
                url: "https://www.cardmarket.com/en/Pokemon/Products/Singles/Sword-Shield/Sprigatito",
                updatedAt: "2023-03-31",
                prices: { averageSellPrice: 0.12, lowPrice: 0.02, trendPrice: 0.1 }
            },
            legal: { standard: true, expanded: true },
            artist: "Ryota Murayama",
            flavorText: "Its photosynthetic energy is stored in the sweet nectar on its head.",
            nationalPokedexNumbers: [906],
            attacks: [{ name: "Scratch", cost: ["Grass"], damage: 10, text: "" }],
            weaknesses: [{ type: "Fire", value: "×2" }],
            resistances: [],
            retreatCost: [],
            convertedRetreatCost: 0,
            set: { id: "sv1", name: "Scarlet & Violet" }
        },
        {
            id: "sv1-2",
            name: "Fuecoco",
            number: "2",
            rarity: "Common",
            hp: 80,
            types: ["Fire"],
            subtypes: ["Basic"],
            rules: [],
            images: {
                small: "https://images.pokemontcg.io/sv1/2.png",
                large: "https://images.pokemontcg.io/sv1/2_hires.png"
            },
            tcgplayer: {
                url: "https://prices.pokemontcg.io/card/sv1-2",
                updatedAt: "2023-03-31",
                prices: {
                    normal: { low: 0.05, mid: 0.15, high: 1.2, market: 0.11 }
                }
            },
            cardmarket: {
                url: "https://www.cardmarket.com/en/Pokemon/Products/Singles/Sword-Shield/Fuecoco",
                updatedAt: "2023-03-31",
                prices: { averageSellPrice: 0.11, lowPrice: 0.02, trendPrice: 0.09 }
            },
            legal: { standard: true, expanded: true },
            artist: "Ryota Murayama",
            flavorText: "It lies on warm rocks and uses the heat absorbed by its square-shaped scales to create fireballs.",
            nationalPokedexNumbers: [909],
            attacks: [{ name: "Live Coal", cost: ["Fire"], damage: 20, text: "" }],
            weaknesses: [{ type: "Water", value: "×2" }],
            resistances: [],
            retreatCost: ["Colorless", "Colorless"],
            convertedRetreatCost: 2,
            set: { id: "sv1", name: "Scarlet & Violet" }
        },
        {
            id: "sv1-3",
            name: "Quaxly",
            number: "3",
            rarity: "Common",
            hp: 70,
            types: ["Water"],
            subtypes: ["Basic"],
            rules: [],
            images: {
                small: "https://images.pokemontcg.io/sv1/3.png",
                large: "https://images.pokemontcg.io/sv1/3_hires.png"
            },
            tcgplayer: {
                url: "https://prices.pokemontcg.io/card/sv1-3",
                updatedAt: "2023-03-31",
                prices: {
                    normal: { low: 0.05, mid: 0.15, high: 1.0, market: 0.1 }
                }
            },
            cardmarket: {
                url: "https://www.cardmarket.com/en/Pokemon/Products/Singles/Sword-Shield/Quaxly",
                updatedAt: "2023-03-31",
                prices: { averageSellPrice: 0.1, lowPrice: 0.02, trendPrice: 0.08 }
            },
            legal: { standard: true, expanded: true },
            artist: "Ryota Murayama",
            flavorText: "This Pokémon is tidy. It dislikes getting its beak dirty, so it always cleans it immediately after eating.",
            nationalPokedexNumbers: [908],
            attacks: [{ name: "Water Gun", cost: ["Water"], damage: 20, text: "" }],
            weaknesses: [{ type: "Lightning", value: "×2" }],
            resistances: [],
            retreatCost: [],
            convertedRetreatCost: 0,
            set: { id: "sv1", name: "Scarlet & Violet" }
        },
        {
            id: "np-2",
            name: "Groudon ex",
            number: "2",
            rarity: "Rare Holo",
            hp: 100,
            types: ["Fighting"],
            subtypes: ["Basic", "EX"],
            rules: ["When Pokémon-EX has been Knocked Out, your opponent takes 2 Prize cards."],
            images: {
                small: "https://images.pokemontcg.io/np/2.png",
                large: "https://images.pokemontcg.io/np/2_hires.png"
            },
            tcgplayer: {
                url: "https://prices.pokemontcg.io/card/np-2",
                updatedAt: "2023-03-31",
                prices: {
                    normal: { low: 15.0, mid: 25.0, high: 50.0, market: 22.0 }
                }
            },
            cardmarket: {
                url: "https://www.cardmarket.com/en/Pokemon/Products/Singles/POP/Groudon-ex",
                updatedAt: "2023-03-31",
                prices: { averageSellPrice: 20.0, lowPrice: 10.0, trendPrice: 18.0 }
            },
            legal: { standard: false, expanded: false },
            artist: "Ken Sugimori",
            flavorText: "Groudon has long been described in mythology as the Pokémon that raised lands and expanded continents.",
            nationalPokedexNumbers: [383],
            attacks: [{ name: "Magma Hammer", cost: ["Fighting", "Fighting", "Colorless"], damage: 50, text: "Discard a Fighting Energy card attached to this Pokémon." }],
            weaknesses: [{ type: "Water", value: "×2" }],
            resistances: [],
            retreatCost: ["Colorless", "Colorless", "Colorless"],
            convertedRetreatCost: 3,
            set: { id: "np", name: "Nintendo Black Star Promos" }
        }
    ]
};

async function migrateSampleData() {
    console.log('🚀 Iniciando migración de datos de ejemplo...');
    
    try {
        // Conectar a BD
        await pool.query('SELECT 1');
        console.log('✅ Conexión a PostgreSQL establecida');
        
        // Limpiar BD existente
        console.log('🧹 Limpiando base de datos existente...');
        await pool.query('DROP TABLE IF EXISTS cards CASCADE');
        await pool.query('DROP TABLE IF EXISTS sets CASCADE');
        await pool.query('DROP TABLE IF EXISTS series CASCADE');
        await pool.query('DROP TABLE IF EXISTS types CASCADE');
        await pool.query('DROP TABLE IF EXISTS rarities CASCADE');
        
        // Crear tablas
        console.log('🏗️ Creando estructura de tablas...');
        
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
        
        console.log('✅ Tablas creadas con índices');
        
        // Migrar series
        console.log('📚 Migrando series...');
        for (const series of sampleData.series) {
            await pool.query(
                'INSERT INTO series (id, name, logo) VALUES ($1, $2, $3)',
                [series.id, series.name, series.logo]
            );
        }
        console.log(`✅ ${sampleData.series.length} series migradas`);
        
        // Migrar sets
        console.log('📦 Migrando sets...');
        for (const set of sampleData.sets) {
            await pool.query(`
                INSERT INTO sets (id, name, series_id, printed_total, total, release_date, logo, symbol)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                set.id, set.name, set.series, set.printedTotal, set.total,
                set.releaseDate, set.logo, set.symbol
            ]);
        }
        console.log(`✅ ${sampleData.sets.length} sets migrados`);
        
        // Migrar tipos
        console.log('🏷️ Migrando tipos...');
        for (const type of sampleData.types) {
            await pool.query(
                'INSERT INTO types (id, name) VALUES ($1, $2)',
                [type.toLowerCase(), type]
            );
        }
        console.log(`✅ ${sampleData.types.length} tipos migrados`);
        
        // Migrar rarezas
        console.log('💎 Migrando rarezas...');
        for (const rarity of sampleData.rarities) {
            const rarityId = rarity.toLowerCase().replace(/\s+/g, '-');
            await pool.query(
                'INSERT INTO rarities (id, name) VALUES ($1, $2)',
                [rarityId, rarity]
            );
        }
        console.log(`✅ ${sampleData.rarities.length} rarezas migradas`);
        
        // Migrar cartas
        console.log('🃏 Migrando cartas...');
        for (const card of sampleData.cards) {
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
                JSON.stringify(card.images), JSON.stringify(card.tcgplayer), JSON.stringify(card.cardmarket), JSON.stringify(card.legal),
                card.artist, card.flavorText, card.nationalPokedexNumbers || [],
                JSON.stringify(card.attacks), JSON.stringify(card.weaknesses), JSON.stringify(card.resistances),
                card.retreatCost || [], card.convertedRetreatCost
            ]);
        }
        console.log(`✅ ${sampleData.cards.length} cartas migradas`);
        
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
        
        console.log('🎉 MIGRACIÓN COMPLETADA CON ÉXITO');
        console.log('📊 Estadísticas finales:');
        console.log(`  - Series: ${s.series_count}`);
        console.log(`  - Sets: ${s.sets_count}`);
        console.log(`  - Tipos: ${s.types_count}`);
        console.log(`  - Rarezas: ${s.rarities_count}`);
        console.log(`  - Cartas: ${s.cards_count}`);
        
        console.log('\n🔍 Ahora puedes probar la búsqueda con:');
        console.log('node server-hybrid.js');
        console.log('Y luego busca cartas en http://localhost:3000');
        
    } catch (error) {
        console.error('❌ Error en migración:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

migrateSampleData().catch(console.error);
