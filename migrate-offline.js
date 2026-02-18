require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuración de PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Datos estáticos de ejemplo (basados en sets populares de Pokémon TCG)
const STATIC_DATA = {
    cards: [
        {
            id: "base1-1",
            name: "Charizard",
            number: "4",
            set_id: "base1",
            rarity_id: "rare-holo",
            hp: 120,
            types: ["Fire"],
            subtypes: ["Stage 2"],
            rules: [],
            images: {
                small: "https://images.pokemontcg.io/base1/4.png",
                large: "https://images.pokemontcg.io/base1/4_hires.png"
            },
            tcgplayer: {
                url: "https://www.tcgplayer.com/product/3307/charizard-base-set",
                updatedAt: "2023-01-01",
                prices: {
                    normal: { low: 150.00, mid: 250.00, high: 500.00, market: 200.00 },
                    holofoil: { low: 200.00, mid: 350.00, high: 800.00, market: 300.00 }
                }
            },
            cardmarket: {
                url: "https://www.cardmarket.com/en/Pokemon/Products/Singles/Base-Set/Charizard",
                updatedAt: "2023-01-01",
                prices: {
                    averageSellPrice: 180.00,
                    lowPrice: 120.00,
                    trendPrice: 190.00,
                    germanProLow: 0.00,
                    suggestedPrice: 0.00,
                    reverseHoloSell: 0.00,
                    reverseHoloLow: 0.00,
                    reverseHoloTrend: 0.00,
                    lowPriceExcluding: 0.00,
                    avg1: 175.00,
                    avg7: 185.00,
                    avg30: 190.00,
                    reverseHoloAvg1: 0.00,
                    reverseHoloAvg7: 0.00,
                    reverseHoloAvg30: 0.00
                }
            },
            legal: {
                unlimited: true,
                expanded: false,
                standard: false
            },
            artist: "Ken Sugimori",
            flavor_text: "Spits fire that is hot enough to melt boulders. Known to unintentionally cause forest fires.",
            national_pokedex_numbers: [6],
            attacks: [
                {
                    name: "Slash",
                    cost: ["Colorless", "Colorless", "Colorless"],
                    convertedEnergyCost: 3,
                    damage: "30",
                    text: ""
                },
                {
                    name: "Fire Spin",
                    cost: ["Fire", "Fire", "Fire", "Fire"],
                    convertedEnergyCost: 4,
                    damage: "100",
                    text: "Discard 2 Energy cards attached to Charizard in order to use this attack."
                }
            ],
            weaknesses: [
                {
                    type: "Water",
                    value: "×2"
                }
            ],
            resistances: [
                {
                    type: "Fighting",
                    value: "-30"
                }
            ],
            retreat_cost: ["Colorless", "Colorless", "Colorless"],
            converted_retreat_cost: 3
        },
        {
            id: "base1-58",
            name: "Blastoise",
            number: "9",
            set_id: "base1",
            rarity_id: "rare-holo",
            hp: 100,
            types: ["Water"],
            subtypes: ["Stage 2"],
            rules: [],
            images: {
                small: "https://images.pokemontcg.io/base1/9.png",
                large: "https://images.pokemontcg.io/base1/9_hires.png"
            },
            tcgplayer: {
                url: "https://www.tcgplayer.com/product/3312/blastoise-base-set",
                updatedAt: "2023-01-01",
                prices: {
                    normal: { low: 80.00, mid: 150.00, high: 300.00, market: 120.00 },
                    holofoil: { low: 100.00, mid: 200.00, high: 400.00, market: 180.00 }
                }
            },
            cardmarket: {
                url: "https://www.cardmarket.com/en/Pokemon/Products/Singles/Base-Set/Blastoise",
                updatedAt: "2023-01-01",
                prices: {
                    averageSellPrice: 90.00,
                    lowPrice: 60.00,
                    trendPrice: 95.00,
                    germanProLow: 0.00,
                    suggestedPrice: 0.00,
                    reverseHoloSell: 0.00,
                    reverseHoloLow: 0.00,
                    reverseHoloTrend: 0.00,
                    lowPriceExcluding: 0.00,
                    avg1: 85.00,
                    avg7: 90.00,
                    avg30: 95.00,
                    reverseHoloAvg1: 0.00,
                    reverseHoloAvg7: 0.00,
                    reverseHoloAvg30: 0.00
                }
            },
            legal: {
                unlimited: true,
                expanded: false,
                standard: false
            },
            artist: "Ken Sugimori",
            flavor_text: "A brutal Pokémon with pressurized water jets on its shell. They are used for high-speed tackles.",
            national_pokedex_numbers: [9],
            attacks: [
                {
                    name: "Rain Dance",
                    cost: ["Water", "Water", "Water"],
                    convertedEnergyCost: 3,
                    damage: "",
                    text: "Search your deck for up to 2 Water Energy cards and attach them to 1 of your Pokémon. Shuffle your deck afterward."
                },
                {
                    name: "Hydro Pump",
                    cost: ["Water", "Water", "Water", "Water"],
                    convertedEnergyCost: 4,
                    damage: "40+",
                    text: "Does 40 damage plus 10 more damage for each Water Energy attached to Blastoise but not used to pay for this attack's Energy cost. You can't add more than 20 damage in this way."
                }
            ],
            weaknesses: [
                {
                    type: "Lightning",
                    value: "×2"
                }
            ],
            resistances: [],
            retreat_cost: ["Colorless", "Colorless", "Colorless"],
            converted_retreat_cost: 3
        },
        {
            id: "base1-73",
            name: "Venusaur",
            number: "15",
            set_id: "base1",
            rarity_id: "rare-holo",
            hp: 100,
            types: ["Grass"],
            subtypes: ["Stage 2"],
            rules: [],
            images: {
                small: "https://images.pokemontcg.io/base1/15.png",
                large: "https://images.pokemontcg.io/base1/15_hires.png"
            },
            tcgplayer: {
                url: "https://www.tcgplayer.com/product/3317/venusaur-base-set",
                updatedAt: "2023-01-01",
                prices: {
                    normal: { low: 60.00, mid: 120.00, high: 250.00, market: 90.00 },
                    holofoil: { low: 80.00, mid: 150.00, high: 300.00, market: 130.00 }
                }
            },
            cardmarket: {
                url: "https://www.cardmarket.com/en/Pokemon/Products/Singles/Base-Set/Venusaur",
                updatedAt: "2023-01-01",
                prices: {
                    averageSellPrice: 75.00,
                    lowPrice: 50.00,
                    trendPrice: 80.00,
                    germanProLow: 0.00,
                    suggestedPrice: 0.00,
                    reverseHoloSell: 0.00,
                    reverseHoloLow: 0.00,
                    reverseHoloTrend: 0.00,
                    lowPriceExcluding: 0.00,
                    avg1: 70.00,
                    avg7: 75.00,
                    avg30: 80.00,
                    reverseHoloAvg1: 0.00,
                    reverseHoloAvg7: 0.00,
                    reverseHoloAvg30: 0.00
                }
            },
            legal: {
                unlimited: true,
                expanded: false,
                standard: false
            },
            artist: "Ken Sugimori",
            flavor_text: "Its plant blooms when it is absorbing solar energy. It stays on the move to seek sunlight.",
            national_pokedex_numbers: [3],
            attacks: [
                {
                    name: "Solar Power",
                    cost: ["Grass"],
                    convertedEnergyCost: 1,
                    damage: "",
                    text: "Flip a coin. If heads, choose a Grass Energy card attached to 1 of your opponent's Pokémon and attach it to 1 of your Pokémon."
                },
                {
                    name: "Mega Drain",
                    cost: ["Grass", "Grass", "Grass", "Grass"],
                    convertedEnergyCost: 4,
                    damage: "40",
                    text: "Remove a number of damage counters from Venusaur equal to half the damage done to the Defending Pokémon (after applying Weakness and Resistance) (rounded up to the nearest 10)."
                }
            ],
            weaknesses: [
                {
                    type: "Fire",
                    value: "×2"
                }
            ],
            resistances: [
                {
                    type: "Water",
                    value: "-30"
                }
            ],
            retreat_cost: ["Colorless", "Colorless"],
            converted_retreat_cost: 2
        },
        {
            id: "swsh1-1",
            name: "Pikachu V",
            number: "1",
            set_id: "swsh1",
            rarity_id: "rare-holo-v",
            hp: 188,
            types: ["Lightning"],
            subtypes: ["Basic", "V"],
            rules: ["When your Pokémon V is Knocked Out, your opponent takes 2 Prize cards."],
            images: {
                small: "https://images.pokemontcg.io/swsh1/1.png",
                large: "https://images.pokemontcg.io/swsh1/1_hires.png"
            },
            tcgplayer: {
                url: "https://www.tcgplayer.com/product/150000/pikachu-v-rebel-clash",
                updatedAt: "2023-01-01",
                prices: {
                    normal: { low: 2.00, mid: 4.00, high: 15.00, market: 3.50 },
                    holofoil: { low: 3.00, mid: 6.00, high: 20.00, market: 5.50 }
                }
            },
            cardmarket: {
                url: "https://www.cardmarket.com/en/Pokemon/Products/Singles/Rebel-Clash/Pikachu-V",
                updatedAt: "2023-01-01",
                prices: {
                    averageSellPrice: 2.50,
                    lowPrice: 1.50,
                    trendPrice: 2.80,
                    germanProLow: 0.00,
                    suggestedPrice: 0.00,
                    reverseHoloSell: 0.00,
                    reverseHoloLow: 0.00,
                    reverseHoloTrend: 0.00,
                    lowPriceExcluding: 0.00,
                    avg1: 2.40,
                    avg7: 2.50,
                    avg30: 2.60,
                    reverseHoloAvg1: 0.00,
                    reverseHoloAvg7: 0.00,
                    reverseHoloAvg30: 0.00
                }
            },
            legal: {
                unlimited: true,
                expanded: true,
                standard: false
            },
            artist: "Saya Tsuruta",
            flavor_text: "",
            national_pokedex_numbers: [25],
            attacks: [
                {
                    name: "Pika Bolt",
                    cost: ["Lightning"],
                    convertedEnergyCost: 1,
                    damage: "30",
                    text: ""
                },
                {
                    name: "Thunder",
                    cost: ["Lightning", "Lightning", "Lightning"],
                    convertedEnergyCost: 3,
                    damage: "120",
                    text: "This Pokémon also does 30 damage to itself."
                }
            ],
            weaknesses: [
                {
                    type: "Fighting",
                    value: "×2"
                }
            ],
            resistances: [],
            retreat_cost: ["Colorless"],
            converted_retreat_cost: 1
        },
        {
            id: "swsh1-30",
            name: "Cinderace V",
            number: "30",
            set_id: "swsh1",
            rarity_id: "rare-holo-v",
            hp: 210,
            types: ["Fire"],
            subtypes: ["Basic", "V"],
            rules: ["When your Pokémon V is Knocked Out, your opponent takes 2 Prize cards."],
            images: {
                small: "https://images.pokemontcg.io/swsh1/30.png",
                large: "https://images.pokemontcg.io/swsh1/30_hires.png"
            },
            tcgplayer: {
                url: "https://www.tcgplayer.com/product/150029/cinderace-v-rebel-clash",
                updatedAt: "2023-01-01",
                prices: {
                    normal: { low: 3.00, mid: 6.00, high: 20.00, market: 5.00 },
                    holofoil: { low: 4.00, mid: 8.00, high: 25.00, market: 7.00 }
                }
            },
            cardmarket: {
                url: "https://www.cardmarket.com/en/Pokemon/Products/Singles/Rebel-Clash/Cinderace-V",
                updatedAt: "2023-01-01",
                prices: {
                    averageSellPrice: 4.50,
                    lowPrice: 3.00,
                    trendPrice: 4.80,
                    germanProLow: 0.00,
                    suggestedPrice: 0.00,
                    reverseHoloSell: 0.00,
                    reverseHoloLow: 0.00,
                    reverseHoloTrend: 0.00,
                    lowPriceExcluding: 0.00,
                    avg1: 4.40,
                    avg7: 4.50,
                    avg30: 4.60,
                    reverseHoloAvg1: 0.00,
                    reverseHoloAvg7: 0.00,
                    reverseHoloAvg30: 0.00
                }
            },
            legal: {
                unlimited: true,
                expanded: true,
                standard: false
            },
            artist: "Ryota Murayama",
            flavor_text: "",
            national_pokedex_numbers: [815],
            attacks: [
                {
                    name: "Flame Charge",
                    cost: ["Fire"],
                    convertedEnergyCost: 1,
                    damage: "30",
                    text: "Search your deck for a Fire Energy card and attach it to this Pokémon. Then, shuffle your deck."
                },
                {
                    name: "Cannonball",
                    cost: ["Fire", "Fire", "Fire"],
                    convertedEnergyCost: 3,
                    damage: "180",
                    text: "During your next turn, this Pokémon can't use Cannonball."
                }
            ],
            weaknesses: [
                {
                    type: "Water",
                    value: "×2"
                }
            ],
            resistances: [],
            retreat_cost: ["Colorless", "Colorless"],
            converted_retreat_cost: 2
        }
    ],
    
    sets: [
        {
            id: "base1",
            name: "Base Set",
            series_id: "base", // Serie base
            printed_total: 102,
            total: 102,
            release_date: "1999/01/09",
            images: {
                symbol: "https://images.pokemontcg.io/base1/symbol.png",
                logo: "https://images.pokemontcg.io/base1/logo.png"
            }
        },
        {
            id: "swsh1",
            name: "Rebel Clash",
            series_id: "swsh", // Serie Sword & Shield
            printed_total: 192,
            total: 209,
            release_date: "2020/05/01",
            images: {
                symbol: "https://images.pokemontcg.io/swsh1/symbol.png",
                logo: "https://images.pokemontcg.io/swsh1/logo.png"
            }
        }
    ],
    
    series: [
        {
            id: "base",
            name: "Base",
            logo: "https://assets.pokemontcg.io/logo/base.png"
        },
        {
            id: "swsh",
            name: "Sword & Shield",
            logo: "https://assets.pokemontcg.io/logo/swsh.png"
        }
    ],
    
    rarities: [
        {
            id: "rare-holo",
            name: "Rare Holo"
        },
        {
            id: "rare-holo-v",
            name: "Rare Holo V"
        }
    ]
};

// Logger con timestamps
function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
}

// Crear tabla de cards si no existe
async function ensureCardsTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS cards (
            id VARCHAR(100) PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            number VARCHAR(20),
            set_id VARCHAR(50),
            rarity_id VARCHAR(50),
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
    `;
    
    await pool.query(query);
    
    // Crear índices para mejor rendimiento
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cards_set_id ON cards(set_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cards_types ON cards USING GIN(types)');
    
    log('✅ Tabla cards verificada/creada');
}

// Crear tabla de rarities si no existe
async function ensureRaritiesTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS rarities (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(50) NOT NULL
        )
    `;
    
    await pool.query(query);
    
    // Crear índices
    await pool.query('CREATE INDEX IF NOT EXISTS idx_rarities_name ON rarities(name)');
    
    log('✅ Tabla rarities verificada/creada');
}

// Insertar rareza en base de datos
async function insertRarity(rarity) {
    const query = `
        INSERT INTO rarities (id, name)
        VALUES ($1, $2)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name
    `;
    
    const values = [rarity.id, rarity.name];
    await pool.query(query, values);
}
async function ensureSeriesTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS series (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            logo VARCHAR(255)
        )
    `;
    
    await pool.query(query);
    
    // Crear índices
    await pool.query('CREATE INDEX IF NOT EXISTS idx_series_name ON series(name)');
    
    log('✅ Tabla series verificada/creada');
}

// Crear tabla de sets si no existe
async function ensureSetsTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS sets (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            series_id VARCHAR(50) REFERENCES series(id),
            printed_total INTEGER,
            total INTEGER,
            release_date DATE,
            logo VARCHAR(255),
            symbol VARCHAR(255)
        )
    `;
    
    await pool.query(query);
    
    // Crear índices
    await pool.query('CREATE INDEX IF NOT EXISTS idx_sets_name ON sets(name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_sets_series_id ON sets(series_id)');
    
    log('✅ Tabla sets verificada/creada');
}

// Insertar carta en base de datos
async function insertCard(card) {
    const query = `
        INSERT INTO cards (
            id, name, number, set_id, rarity_id, hp, types, subtypes, 
            rules, images, tcgplayer, cardmarket, legal, artist, 
            flavor_text, national_pokedex_numbers, attacks, weaknesses, 
            resistances, retreat_cost, converted_retreat_cost
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            number = EXCLUDED.number,
            set_id = EXCLUDED.set_id,
            rarity_id = EXCLUDED.rarity_id,
            hp = EXCLUDED.hp,
            types = EXCLUDED.types,
            subtypes = EXCLUDED.subtypes,
            rules = EXCLUDED.rules,
            images = EXCLUDED.images,
            tcgplayer = EXCLUDED.tcgplayer,
            cardmarket = EXCLUDED.cardmarket,
            legal = EXCLUDED.legal,
            artist = EXCLUDED.artist,
            flavor_text = EXCLUDED.flavor_text,
            national_pokedex_numbers = EXCLUDED.national_pokedex_numbers,
            attacks = EXCLUDED.attacks,
            weaknesses = EXCLUDED.weaknesses,
            resistances = EXCLUDED.resistances,
            retreat_cost = EXCLUDED.retreat_cost,
            converted_retreat_cost = EXCLUDED.converted_retreat_cost
    `;
    
    const values = [
        card.id,
        card.name,
        card.number,
        card.set_id,
        card.rarity_id,
        card.hp,
        card.types || [],
        card.subtypes || [],
        card.rules || [],
        JSON.stringify(card.images || {}),
        JSON.stringify(card.tcgplayer || {}),
        JSON.stringify(card.cardmarket || {}),
        JSON.stringify(card.legal || {}),
        card.artist,
        card.flavor_text,
        card.national_pokedex_numbers || [],
        JSON.stringify(card.attacks || []),
        JSON.stringify(card.weaknesses || []),
        JSON.stringify(card.resistances || []),
        card.retreat_cost || [],
        card.converted_retreat_cost
    ];
    
    await pool.query(query, values);
}

// Insertar serie en base de datos
async function insertSeries(series) {
    const query = `
        INSERT INTO series (id, name, logo)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            logo = EXCLUDED.logo
    `;
    
    const values = [
        series.id,
        series.name,
        series.logo || null
    ];
    
    await pool.query(query, values);
}

// Insertar set en base de datos
async function insertSet(set) {
    const query = `
        INSERT INTO sets (
            id, name, series_id, printed_total, total, 
            release_date, logo, symbol
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            series_id = EXCLUDED.series_id,
            printed_total = EXCLUDED.printed_total,
            total = EXCLUDED.total,
            release_date = EXCLUDED.release_date,
            logo = EXCLUDED.logo,
            symbol = EXCLUDED.symbol
    `;
    
    const values = [
        set.id,
        set.name,
        set.series_id, // Usar el series_id correcto
        set.printed_total,
        set.total,
        set.release_date,
        set.images?.logo || null,
        set.images?.symbol || null
    ];
    
    await pool.query(query, values);
}

// Función principal de migración offline
async function migrateOfflineData() {
    try {
        log('🚀 Iniciando migración offline de datos Pokémon TCG', 'START');
        const startTime = Date.now();
        
        // Verificar/crear tablas
        await ensureCardsTable();
        await ensureRaritiesTable();
        await ensureSeriesTable();
        await ensureSetsTable();
        
        // Migrar rarezas primero
        log('💎 Migrando rarezas...');
        for (const rarity of STATIC_DATA.rarities) {
            await insertRarity(rarity);
            log(`✅ Rareza insertada: ${rarity.name}`);
        }
        
        // Migrar series
        log('📚 Migrando series...');
        for (const series of STATIC_DATA.series) {
            await insertSeries(series);
            log(`✅ Serie insertada: ${series.name}`);
        }
        
        // Migrar sets
        log('📦 Migrando sets...');
        for (const set of STATIC_DATA.sets) {
            await insertSet(set);
            log(`✅ Set insertado: ${set.name}`);
        }
        
        // Migrar cartas
        log('🃏 Migrando cartas...');
        let processedCards = 0;
        
        for (const card of STATIC_DATA.cards) {
            try {
                await insertCard(card);
                processedCards++;
                log(`✅ Carta insertada: ${card.name} (${card.id})`);
            } catch (error) {
                log(`❌ Error insertando carta ${card.id}: ${error.message}`, 'ERROR');
            }
        }
        
        // Estadísticas finales
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        log('🎉 MIGRACIÓN OFFLINE COMPLETADA', 'SUCCESS');
        log(`📊 Estadísticas finales:`);
        log(`   - Sets procesados: ${STATIC_DATA.sets.length}`);
        log(`   - Cartas procesadas: ${processedCards}`);
        log(`   - Duración: ${duration.toFixed(2)} segundos`);
        log(`   - Velocidad: ${(processedCards / duration).toFixed(2)} cartas/segundo`);
        
        log('\n💡 Nota: Esta es una migración con datos de ejemplo.');
        log('   Cuando la API externa esté disponible, ejecuta migrate-robust.js');
        log('   para obtener todos los datos completos de Pokémon TCG.');
        
    } catch (error) {
        log(`💥 Error fatal en migración offline: ${error.message}`, 'FATAL');
        throw error;
    }
}

// Ejecutar migración offline
if (require.main === module) {
    migrateOfflineData()
        .then(() => {
            log('✅ Migración offline finalizada exitosamente', 'SUCCESS');
            process.exit(0);
        })
        .catch((error) => {
            log(`❌ Migración offline fallida: ${error.message}`, 'FATAL');
            process.exit(1);
        });
}

module.exports = { migrateOfflineData };
