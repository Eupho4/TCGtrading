require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Base de datos PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('html'));
app.use('/js', express.static('js'));
app.use('/css', express.static('css'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected'
    });
});

// Búsqueda de cartas - DIRECTO a PostgreSQL
app.get('/api/pokemontcg/cards', async (req, res) => {
    try {
        const {
            q = '',
            page = 1,
            pageSize = 20,
            set,
            series,
            type,
            rarity
        } = req.query;

        const offset = (page - 1) * pageSize;
        
        // Construir WHERE clause
        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        if (q) {
            whereConditions.push(`(c.name ILIKE $${paramIndex} OR c.id ILIKE $${paramIndex})`);
            params.push(`%${q}%`);
            paramIndex++;
        }

        if (set) {
            whereConditions.push(`s.name ILIKE $${paramIndex}`);
            params.push(set);
            paramIndex++;
        }

        if (series) {
            whereConditions.push(`se.name ILIKE $${paramIndex}`);
            params.push(series);
            paramIndex++;
        }

        if (type) {
            if (type.toLowerCase() === 'trainer') {
                whereConditions.push(`(c.hp IS NULL AND NOT (c.name ILIKE $${paramIndex}))`);
                params.push('%Energy%');
                paramIndex++;
            } else if (type.toLowerCase() === 'energy') {
                whereConditions.push(`(c.hp IS NULL AND c.name ILIKE $${paramIndex})`);
                params.push('%Energy%');
                paramIndex++;
            } else {
                whereConditions.push(`$${paramIndex} ILIKE ANY(c.types)`);
                params.push(type);
                paramIndex++;
            }
        }

        if (rarity) {
            whereConditions.push(`r.name ILIKE $${paramIndex}`);
            params.push(`%${rarity}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Query principal
        const query = `
            SELECT 
                c.id, c.name, c.number, c.hp, c.types, c.subtypes, c.rules, c.images,
                c.artist, c.flavor_text, c.national_pokedex_numbers, c.attacks, c.weaknesses,
                c.resistances, c.retreat_cost, c.converted_retreat_cost, c.tcgplayer, c.cardmarket,
                c.set_id, s.name as set_name, s.series_id, s.logo as set_logo, s.symbol as set_symbol,
                se.name as series_name, se.logo as series_logo,
                r.name as rarity_name
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            LEFT JOIN rarities r ON c.rarity_id = r.id
            ${whereClause}
            ORDER BY c.name
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(pageSize, offset);

        // Query para contar total
        const countQuery = `
            SELECT COUNT(*) as total
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            LEFT JOIN rarities r ON c.rarity_id = r.id
            ${whereClause}
        `;

        // Ejecutar queries
        const [cardsResult, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, params.slice(0, -2))
        ]);

        // Formatear respuesta
        const cards = cardsResult.rows.map(card => {
            // Procesar imágenes
            let images = card.images;
            if (typeof images === 'string') {
                try {
                    images = JSON.parse(images);
                } catch (e) {
                    images = { small: null, large: null };
                }
            }

            // Procesar arrays
            const types = Array.isArray(card.types) ? card.types : 
                         typeof card.types === 'string' ? JSON.parse(card.types || '[]') : [];
            
            const attacks = Array.isArray(card.attacks) ? card.attacks : 
                           typeof card.attacks === 'string' ? JSON.parse(card.attacks || '[]') : [];

            return {
                id: card.id,
                name: card.name,
                number: card.number,
                hp: card.hp,
                types: types,
                subtypes: Array.isArray(card.subtypes) ? card.subtypes : [],
                rules: Array.isArray(card.rules) ? card.rules : [],
                images: images,
                artist: card.artist,
                flavorText: card.flavor_text,
                nationalPokedexNumbers: Array.isArray(card.national_pokedex_numbers) ? card.national_pokedex_numbers : [],
                attacks: attacks,
                weaknesses: Array.isArray(card.weaknesses) ? card.weaknesses : [],
                resistances: Array.isArray(card.resistances) ? card.resistances : [],
                retreatCost: Array.isArray(card.retreat_cost) ? card.retreat_cost : [],
                convertedRetreatCost: card.converted_retreat_cost,
                tcgplayer: card.tcgplayer,
                cardmarket: card.cardmarket,
                set: {
                    id: card.set_id,
                    name: card.set_name,
                    series: card.series_name,
                    logo: card.set_logo,
                    symbol: card.set_symbol
                },
                rarity: card.rarity_name
            };
        });

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / pageSize);

        res.json({
            success: true,
            data: cards,
            pagination: {
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                total: total,
                totalPages: totalPages
            }
        });

    } catch (error) {
        console.error('Error en búsqueda:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obtener sets
app.get('/api/pokemontcg/sets', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                s.id, s.name, s.series_id, s.logo, s.symbol,
                se.name as series_name,
                COUNT(c.id) as card_count
            FROM sets s
            LEFT JOIN series se ON s.series_id = se.id
            LEFT JOIN cards c ON s.id = c.set_id
            GROUP BY s.id, s.name, s.series_id, s.logo, s.symbol, se.name
            ORDER BY s.name
        `);

        const sets = result.rows.map(set => ({
            id: set.id,
            name: set.name,
            series: set.series_name,
            logo: set.logo,
            symbol: set.symbol,
            cardCount: parseInt(set.card_count)
        }));

        res.json({
            success: true,
            data: sets
        });

    } catch (error) {
        console.error('Error en sets:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obtener series
app.get('/api/pokemontcg/series', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                se.id, se.name, se.logo,
                COUNT(DISTINCT s.id) as set_count,
                COUNT(c.id) as card_count
            FROM series se
            LEFT JOIN sets s ON se.id = s.series_id
            LEFT JOIN cards c ON s.id = c.set_id
            GROUP BY se.id, se.name, se.logo
            ORDER BY se.name
        `);

        const series = result.rows.map(s => ({
            id: s.id,
            name: s.name,
            logo: s.logo,
            setCount: parseInt(s.set_count),
            cardCount: parseInt(s.card_count)
        }));

        res.json({
            success: true,
            data: series
        });

    } catch (error) {
        console.error('Error en series:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Servir frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor TCGtrade iniciado en puerto ${PORT}`);
    console.log(`📊 Base de datos: PostgreSQL`);
    console.log(`🌐 http://localhost:${PORT}`);
});
