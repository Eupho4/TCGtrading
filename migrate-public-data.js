require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');
const fs = require('fs');

// Configuración de PostgreSQL local
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Helper para descargar JSON desde URLs públicas
function downloadJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, function(res) {
            let body = '';
            res.on('data', function(c) { body += c; });
            res.on('end', function() { 
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(body)); 
                    } catch (e) {
                        reject(new Error('Invalid JSON'));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        }).on('error', function(e) { reject(e); });
    });
}

// Datos de ejemplo ampliados con más cartas reales
const expandedData = {
    series: [
        { id: "sv1", name: "Scarlet & Violet", logo: "https://assets.pokemontcg.io/logo/logo.png" },
        { id: "swsh", name: "Sword & Shield", logo: "https://assets.pokemontcg.io/logo/swsh.png" },
        { id: "pop", name: "POP", logo: "https://assets.pokemontcg.io/logo/pop.png" },
        { id: "xy", name: "XY", logo: "https://assets.pokemontcg.io/logo/xy.png" },
        { id: "bw", name: "Black & White", logo: "https://assets.pokemontcg.io/logo/bw.png" }
    ],
    sets: [
        { id: "sv1", name: "Scarlet & Violet", series: "sv1", printedTotal: 258, total: 273, releaseDate: "2023-03-31", logo: "https://assets.pokemontcg.io/sv1/logo.png", symbol: "https://assets.pokemontcg.io/sv1/symbol.png" },
        { id: "sv2", name: "Paldea Evolved", series: "sv1", printedTotal: 193, total: 207, releaseDate: "2023-06-09", logo: "https://assets.pokemontcg.io/sv2/logo.png", symbol: "https://assets.pokemontcg.io/sv2/symbol.png" },
        { id: "sv3", name: "Obsidian Flames", series: "sv1", printedTotal: 197, total: 230, releaseDate: "2023-08-11", logo: "https://assets.pokemontcg.io/sv3/logo.png", symbol: "https://assets.pokemontcg.io/sv3/symbol.png" },
        { id: "swsh1", name: "Sword & Shield", series: "swsh", printedTotal: 216, total: 216, releaseDate: "2020-02-07", logo: "https://assets.pokemontcg.io/swsh1/logo.png", symbol: "https://assets.pokemontcg.io/swsh1/symbol.png" },
        { id: "swsh2", name: "Rebel Clash", series: "swsh", printedTotal: 192, total: 209, releaseDate: "2020-05-01", logo: "https://assets.pokemontcg.io/swsh2/logo.png", symbol: "https://assets.pokemontcg.io/swsh2/symbol.png" },
        { id: "swsh3", name: "Darkness Ablaze", series: "swsh", printedTotal: 189, total: 201, releaseDate: "2020-08-07", logo: "https://assets.pokemontcg.io/swsh3/logo.png", symbol: "https://assets.pokemontcg.io/swsh3/symbol.png" },
        { id: "swsh4", name: "Vivid Voltage", series: "swsh", printedTotal: 185, total: 203, releaseDate: "2020-11-20", logo: "https://assets.pokemontcg.io/swsh4/logo.png", symbol: "https://assets.pokemontcg.io/swsh4/symbol.png" },
        { id: "swsh5", name: "Shining Fates", series: "swsh", printedTotal: 72, total: 100, releaseDate: "2021-02-19", logo: "https://assets.pokemontcg.io/swsh5/logo.png", symbol: "https://assets.pokemontcg.io/swsh5/symbol.png" },
        { id: "xy1", name: "XY", series: "xy", printedTotal: 146, total: 146, releaseDate: "2014-02-05", logo: "https://assets.pokemontcg.io/xy1/logo.png", symbol: "https://assets.pokemontcg.io/xy1/symbol.png" },
        { id: "xy2", name: "Flashfire", series: "xy", printedTotal: 106, total: 106, releaseDate: "2014-05-07", logo: "https://assets.pokemontcg.io/xy2/logo.png", symbol: "https://assets.pokemontcg.io/xy2/symbol.png" },
        { id: "bw1", name: "Black & White", series: "bw", printedTotal: 114, total: 114, releaseDate: "2011-04-06", logo: "https://assets.pokemontcg.io/bw1/logo.png", symbol: "https://assets.pokemontcg.io/bw1/symbol.png" },
        { id: "np", name: "Nintendo Black Star Promos", series: "pop", printedTotal: 40, total: 40, releaseDate: "2003-10-01", logo: "https://assets.pokemontcg.io/np/logo.png", symbol: "https://assets.pokemontcg.io/np/symbol.png" }
    ],
    types: ["Grass", "Fire", "Water", "Lightning", "Psychic", "Fighting", "Darkness", "Metal", "Colorless", "Dragon", "Fairy", "Normal"],
    rarities: ["Common", "Uncommon", "Rare", "Rare Holo", "Rare Ultra", "Rare Secret", "Promo", "Amazing", "Full Art", "Special", "Legendary"],
    cards: [
        // Scarlet & Violet
        { id: "sv1-1", name: "Sprigatito", number: "1", rarity: "Common", hp: 70, types: ["Grass"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/sv1/1.png", large: "https://images.pokemontcg.io/sv1/1_hires.png" }, attacks: [{ name: "Scratch", cost: ["Grass"], damage: 10 }], weaknesses: [{ type: "Fire", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "sv1", name: "Scarlet & Violet" }, artist: "Ryota Murayama" },
        { id: "sv1-2", name: "Fuecoco", number: "2", rarity: "Common", hp: 80, types: ["Fire"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/sv1/2.png", large: "https://images.pokemontcg.io/sv1/2_hires.png" }, attacks: [{ name: "Live Coal", cost: ["Fire"], damage: 20 }], weaknesses: [{ type: "Water", value: "×2" }], retreatCost: ["Colorless", "Colorless"], convertedRetreatCost: 2, set: { id: "sv1", name: "Scarlet & Violet" }, artist: "Ryota Murayama" },
        { id: "sv1-3", name: "Quaxly", number: "3", rarity: "Common", hp: 70, types: ["Water"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/sv1/3.png", large: "https://images.pokemontcg.io/sv1/3_hires.png" }, attacks: [{ name: "Water Gun", cost: ["Water"], damage: 20 }], weaknesses: [{ type: "Lightning", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "sv1", name: "Scarlet & Violet" }, artist: "Ryota Murayama" },
        { id: "sv1-4", name: "Lechonk", number: "4", rarity: "Common", hp: 70, types: ["Normal"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/sv1/4.png", large: "https://images.pokemontcg.io/sv1/4_hires.png" }, attacks: [{ name: "Tackle", cost: ["Colorless"], damage: 10 }], weaknesses: [{ type: "Fighting", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "sv1", name: "Scarlet & Violet" }, artist: "Saya Tsuruta" },
        { id: "sv1-5", name: "Tarountula", number: "5", rarity: "Common", hp: 60, types: ["Grass"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/sv1/5.png", large: "https://images.pokemontcg.io/sv1/5_hires.png" }, attacks: [{ name: "String Shot", cost: ["Grass"], damage: 10, text: "Flip a coin. If heads, your opponent's Active Pokémon is now Paralyzed." }], weaknesses: [{ type: "Fire", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "sv1", name: "Scarlet & Violet" }, artist: "Kouki Saitou" },
        { id: "sv1-6", name: "Nymble", number: "6", rarity: "Common", hp: 40, types: ["Grass"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/sv1/6.png", large: "https://images.pokemontcg.io/sv1/6_hires.png" }, attacks: [{ name: "Peck", cost: ["Grass"], damage: 30 }], weaknesses: [{ type: "Fire", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "sv1", name: "Scarlet & Violet" }, artist: "Mina Nakai" },
        { id: "sv1-7", name: "Scovillain", number: "7", rarity: "Uncommon", hp: 90, types: ["Grass"], subtypes: ["Stage 1"], images: { small: "https://images.pokemontcg.io/sv1/7.png", large: "https://images.pokemontcg.io/sv1/7_hires.png" }, attacks: [{ name: "Spicy Shot", cost: ["Grass"], damage: 30 }, { name: "Heat Blast", cost: ["Grass", "Grass", "Colorless"], damage: 80 }], weaknesses: [{ type: "Fire", value: "×2" }], retreatCost: ["Colorless"], convertedRetreatCost: 1, set: { id: "sv1", name: "Scarlet & Violet" }, artist: "Anesaki Dynamic" },
        { id: "sv1-8", name: "Pawmi", number: "8", rarity: "Common", hp: 60, types: ["Lightning"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/sv1/8.png", large: "https://images.pokemontcg.io/sv1/8_hires.png" }, attacks: [{ name: "Thunder Shock", cost: ["Lightning"], damage: 10, text: "Flip a coin. If heads, your opponent's Active Pokémon is now Paralyzed." }], retreatCost: [], convertedRetreatCost: 0, set: { id: "sv1", name: "Scarlet & Violet" }, artist: "Pani Kobayashi" },
        { id: "sv1-9", name: "Tandemaus", number: "9", rarity: "Common", hp: 60, types: ["Colorless"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/sv1/9.png", large: "https://images.pokemontcg.io/sv1/9_hires.png" }, attacks: [{ name: "Tackle", cost: ["Colorless"], damage: 10 }], weaknesses: [{ type: "Fighting", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "sv1", name: "Scarlet & Violet" }, artist: "Mina Nakai" },
        { id: "sv1-10", name: "Maushold", number: "10", rarity: "Uncommon", hp: 90, types: ["Colorless"], subtypes: ["Stage 1"], images: { small: "https://images.pokemontcg.io/sv1/10.png", large: "https://images.pokemontcg.io/sv1/10_hires.png" }, attacks: [{ name: "Collect", cost: ["Colorless"], damage: 30, text: "Draw 2 cards." }, { name: "Bite", cost: ["Colorless", "Colorless"], damage: 50 }], weaknesses: [{ type: "Fighting", value: "×2" }], retreatCost: ["Colorless"], convertedRetreatCost: 1, set: { id: "sv1", name: "Scarlet & Violet" }, artist: "Mina Nakai" },
        
        // Paldea Evolved
        { id: "sv2-1", name: "Meowscarada", number: "1", rarity: "Rare Holo", hp: 170, types: ["Grass"], subtypes: ["Stage 2"], images: { small: "https://images.pokemontcg.io/sv2/1.png", large: "https://images.pokemontcg.io/sv2/1_hires.png" }, attacks: [{ name: "Magic Trick", cost: ["Grass"], damage: 60, text: "Choose up to 2 of your opponent's Benched Pokémon and put 1 damage counter on each of them." }, { name: "Miracle Bloom", cost: ["Grass", "Grass"], damage: 120, text: "Heal 30 damage from this Pokémon." }], weaknesses: [{ type: "Fire", value: "×2" }], retreatCost: ["Colorless"], convertedRetreatCost: 1, set: { id: "sv2", name: "Paldea Evolved" }, artist: "Ryota Murayama" },
        { id: "sv2-2", name: "Skeledirge", number: "2", rarity: "Rare Holo", hp: 200, types: ["Fire"], subtypes: ["Stage 2"], images: { small: "https://images.pokemontcg.io/sv2/2.png", large: "https://images.pokemontcg.io/sv2/2_hires.png" }, attacks: [{ name: "Pyro Ball", cost: ["Fire", "Fire"], damage: 100, text: "Discard a Fire Energy from this Pokémon." }, { name: "Infernal Voice", cost: ["Fire", "Fire", "Colorless"], damage: 160 }], weaknesses: [{ type: "Water", value: "×2" }], retreatCost: ["Colorless", "Colorless", "Colorless"], convertedRetreatCost: 3, set: { id: "sv2", name: "Paldea Evolved" }, artist: "Ryota Murayama" },
        { id: "sv2-3", name: "Quaquaval", number: "3", rarity: "Rare Holo", hp: 180, types: ["Water"], subtypes: ["Stage 2"], images: { small: "https://images.pokemontcg.io/sv2/3.png", large: "https://images.pokemontcg.io/sv2/3_hires.png" }, attacks: [{ name: "Mega Kick", cost: ["Water"], damage: 50 }, { name: "Torrential Pump", cost: ["Water", "Water", "Colorless"], damage: 140 }], weaknesses: [{ type: "Lightning", value: "×2" }], retreatCost: ["Colorless", "Colorless"], convertedRetreatCost: 2, set: { id: "sv2", name: "Paldea Evolved" }, artist: "Ryota Murayama" },
        
        // Sword & Shield
        { id: "swsh1-1", name: "Grookey", number: "1", rarity: "Common", hp: 60, types: ["Grass"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/swsh1/1.png", large: "https://images.pokemontcg.io/swsh1/1_hires.png" }, attacks: [{ name: "Scratch", cost: ["Grass"], damage: 10 }], weaknesses: [{ type: "Fire", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "swsh1", name: "Sword & Shield" }, artist: "Ken Sugimori" },
        { id: "swsh1-2", name: "Scorbunny", number: "2", rarity: "Common", hp: 60, types: ["Fire"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/swsh1/2.png", large: "https://images.pokemontcg.io/swsh1/2_hires.png" }, attacks: [{ name: "Tackle", cost: ["Colorless"], damage: 10 }, { name: "Live Coal", cost: ["Fire"], damage: 20 }], weaknesses: [{ type: "Water", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "swsh1", name: "Sword & Shield" }, artist: "Ken Sugimori" },
        { id: "swsh1-3", name: "Sobble", number: "3", rarity: "Common", hp: 60, types: ["Water"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/swsh1/3.png", large: "https://images.pokemontcg.io/swsh1/3_hires.png" }, attacks: [{ name: "Water Gun", cost: ["Water"], damage: 20 }], weaknesses: [{ type: "Lightning", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "swsh1", name: "Sword & Shield" }, artist: "Ken Sugimori" },
        
        // XY Series
        { id: "xy1-1", name: "Chespin", number: "1", rarity: "Common", hp: 60, types: ["Grass"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/xy1/1.png", large: "https://images.pokemontcg.io/xy1/1_hires.png" }, attacks: [{ name: "Tackle", cost: ["Colorless"], damage: 10 }, { name: "Vine Whip", cost: ["Grass"], damage: 20 }], weaknesses: [{ type: "Fire", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "xy1", name: "XY" }, artist: "Ken Sugimori" },
        { id: "xy1-2", name: "Fennekin", number: "2", rarity: "Common", hp: 60, types: ["Fire"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/xy1/2.png", large: "https://images.pokemontcg.io/xy1/2_hires.png" }, attacks: [{ name: "Flare", cost: ["Fire"], damage: 20 }], weaknesses: [{ type: "Water", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "xy1", name: "XY" }, artist: "Ken Sugimori" },
        { id: "xy1-3", name: "Froakie", number: "3", rarity: "Common", hp: 60, types: ["Water"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/xy1/3.png", large: "https://images.pokemontcg.io/xy1/3_hires.png" }, attacks: [{ name: "Bubble", cost: ["Water"], damage: 10 }, { name: "Frog Kick", cost: ["Water", "Colorless"], damage: 30 }], weaknesses: [{ type: "Lightning", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "xy1", name: "XY" }, artist: "Ken Sugimori" },
        
        // Black & White
        { id: "bw1-1", name: "Snivy", number: "1", rarity: "Common", hp: 60, types: ["Grass"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/bw1/1.png", large: "https://images.pokemontcg.io/bw1/1_hires.png" }, attacks: [{ name: "Tackle", cost: ["Colorless"], damage: 10 }, { name: "Vine Whip", cost: ["Grass"], damage: 20 }], weaknesses: [{ type: "Fire", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "bw1", name: "Black & White" }, artist: "Ken Sugimori" },
        { id: "bw1-2", name: "Tepig", number: "2", rarity: "Common", hp: 60, types: ["Fire"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/bw1/2.png", large: "https://images.pokemontcg.io/bw1/2_hires.png" }, attacks: [{ name: "Tackle", cost: ["Colorless"], damage: 10 }, { name: "Ember", cost: ["Fire"], damage: 30 }], weaknesses: [{ type: "Water", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "bw1", name: "Black & White" }, artist: "Ken Sugimori" },
        { id: "bw1-3", name: "Oshawott", number: "3", rarity: "Common", hp: 60, types: ["Water"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/bw1/3.png", large: "https://images.pokemontcg.io/bw1/3_hires.png" }, attacks: [{ name: "Tackle", cost: ["Colorless"], damage: 10 }, { name: "Water Gun", cost: ["Water"], damage: 20 }], weaknesses: [{ type: "Lightning", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "bw1", name: "Black & White" }, artist: "Ken Sugimori" },
        
        // Promos y cartas especiales
        { id: "np-1", name: "Pikachu", number: "1", rarity: "Promo", hp: 60, types: ["Lightning"], subtypes: ["Basic"], images: { small: "https://images.pokemontcg.io/np/1.png", large: "https://images.pokemontcg.io/np/1_hires.png" }, attacks: [{ name: "Thunder Shock", cost: ["Lightning"], damage: 10, text: "Flip a coin. If heads, your opponent's Active Pokémon is now Paralyzed." }], weaknesses: [{ type: "Fighting", value: "×2" }], retreatCost: [], convertedRetreatCost: 0, set: { id: "np", name: "Nintendo Black Star Promos" }, artist: "Ken Sugimori" },
        { id: "np-2", name: "Groudon ex", number: "2", rarity: "Rare Ultra", hp: 100, types: ["Fighting"], subtypes: ["Basic", "EX"], rules: ["When Pokémon-EX has been Knocked Out, your opponent takes 2 Prize cards."], images: { small: "https://images.pokemontcg.io/np/2.png", large: "https://images.pokemontcg.io/np/2_hires.png" }, attacks: [{ name: "Magma Hammer", cost: ["Fighting", "Fighting", "Colorless"], damage: 50, text: "Discard a Fighting Energy card attached to this Pokémon." }], weaknesses: [{ type: "Water", value: "×2" }], retreatCost: ["Colorless", "Colorless", "Colorless"], convertedRetreatCost: 3, set: { id: "np", name: "Nintendo Black Star Promos" }, artist: "Ken Sugimori" },
        { id: "np-3", name: "Kyogre ex", number: "3", rarity: "Rare Ultra", hp: 100, types: ["Water"], subtypes: ["Basic", "EX"], rules: ["When Pokémon-EX has been Knocked Out, your opponent takes 2 Prize cards."], images: { small: "https://images.pokemontcg.io/np/3.png", large: "https://images.pokemontcg.io/np/3_hires.png" }, attacks: [{ name: "Water Arrow", cost: ["Water"], damage: 20, text: "This attack does 20 damage to 1 of your opponent's Benched Pokémon. (Don't apply Weakness and Resistance for Benched Pokémon.)" }, { name: "Tidal Storm", cost: ["Water", "Water", "Colorless"], damage: 70, text: "Flip a coin. If heads, this attack does 40 more damage." }], weaknesses: [{ type: "Lightning", value: "×2" }], retreatCost: ["Colorless", "Colorless"], convertedRetreatCost: 2, set: { id: "np", name: "Nintendo Black Star Promos" }, artist: "Ken Sugimori" }
    ]
};

async function migrateExpandedData() {
    console.log('🚀 Iniciando migración de datos expandidos...');
    console.log(`📊 Datos a migrar: ${expandedData.cards.length} cartas, ${expandedData.sets.length} sets, ${expandedData.series.length} series`);
    
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
        for (const series of expandedData.series) {
            await pool.query(
                'INSERT INTO series (id, name, logo) VALUES ($1, $2, $3)',
                [series.id, series.name, series.logo]
            );
        }
        console.log(`✅ ${expandedData.series.length} series migradas`);
        
        // Migrar sets
        console.log('📦 Migrando sets...');
        for (const set of expandedData.sets) {
            await pool.query(`
                INSERT INTO sets (id, name, series_id, printed_total, total, release_date, logo, symbol)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                set.id, set.name, set.series, set.printedTotal, set.total,
                set.releaseDate, set.logo, set.symbol
            ]);
        }
        console.log(`✅ ${expandedData.sets.length} sets migrados`);
        
        // Migrar tipos
        console.log('🏷️ Migrando tipos...');
        for (const type of expandedData.types) {
            await pool.query(
                'INSERT INTO types (id, name) VALUES ($1, $2)',
                [type.toLowerCase(), type]
            );
        }
        console.log(`✅ ${expandedData.types.length} tipos migrados`);
        
        // Migrar rarezas
        console.log('💎 Migrando rarezas...');
        for (const rarity of expandedData.rarities) {
            const rarityId = rarity.toLowerCase().replace(/\s+/g, '-');
            await pool.query(
                'INSERT INTO rarities (id, name) VALUES ($1, $2)',
                [rarityId, rarity]
            );
        }
        console.log(`✅ ${expandedData.rarities.length} rarezas migradas`);
        
        // Migrar cartas
        console.log('🃏 Migrando cartas...');
        for (const card of expandedData.cards) {
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
                JSON.stringify(card.images), JSON.stringify(card.tcgplayer || {}), JSON.stringify(card.cardmarket || {}), JSON.stringify(card.legal || {}),
                card.artist, card.flavorText || '', card.nationalPokedexNumbers || [],
                JSON.stringify(card.attacks || []), JSON.stringify(card.weaknesses || []), JSON.stringify(card.resistances || []),
                card.retreatCost || [], card.convertedRetreatCost
            ]);
        }
        console.log(`✅ ${expandedData.cards.length} cartas migradas`);
        
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
        
        console.log('\n🎉 MIGRACIÓN EXPANDIDA COMPLETADA');
        console.log('📊 Estadísticas finales:');
        console.log(`  - Series: ${s.series_count}`);
        console.log(`  - Sets: ${s.sets_count}`);
        console.log(`  - Tipos: ${s.types_count}`);
        console.log(`  - Rarezas: ${s.rarities_count}`);
        console.log(`  - Cartas: ${s.cards_count}`);
        
        console.log('\n🌐 Ahora puedes:');
        console.log('1. Iniciar el servidor: node server-hybrid.js');
        console.log('2. Abrir http://localhost:3000');
        console.log('3. Buscar cartas como: sprigatito, pikachu, charizard, etc.');
        
        console.log('\n🔍 Búsquedas de ejemplo:');
        console.log('- "sprigatito" → Encontrará Sprigatito de Scarlet & Violet');
        console.log('- "pikachu" → Encontrará Pikachu de Promos');
        console.log('- "charizard" → Buscará todas las variantes');
        console.log('- "fire" → Todas las cartas de tipo Fuego');
        console.log('- "scarlet" → Todas las cartas de Scarlet & Violet');
        
    } catch (error) {
        console.error('❌ Error en migración:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

migrateExpandedData().catch(console.error);
