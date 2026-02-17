const { Pool } = require('pg');

class PostgresCardDatabase {
    constructor() {
        // Usar DATABASE_PUBLIC_URL para conexiones externas
        this.connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
        
        if (!this.connectionString) {
            throw new Error('DATABASE_URL no está configurada en las variables de entorno');
        }

        this.pool = new Pool({
            connectionString: this.connectionString,
            ssl: {
                rejectUnauthorized: false // Necesario para Railway
            }
        });
        
        this.isInitialized = false;
    }

    // Inicializar base de datos
    async init() {
        if (this.isInitialized) return;
        
        try {
            console.log('🗄️ Conectando a PostgreSQL en Railway...');
            
            // Probar conexión
            const client = await this.pool.connect();
            console.log('✅ Conectado a PostgreSQL exitosamente');
            client.release();
            
            // Verificar si las tablas existen
            await this.ensureTablesExist();
            
            this.isInitialized = true;
            console.log('✅ Base de datos PostgreSQL inicializada correctamente');
        } catch (error) {
            console.error('❌ Error conectando a PostgreSQL:', error);
            throw error;
        }
    }

    // Asegurar que las tablas existan
    async ensureTablesExist() {
        try {
            // La tabla cards ya existe con la estructura migrada
            // No necesitamos crearla, solo verificar que existe
            console.log('✅ Tabla cards ya existe con estructura migrada');

            // Crear tabla de sets si no existe
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS sets (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    series TEXT,
                    printed_total INTEGER,
                    total INTEGER,
                    legalities TEXT,
                    ptcgo_code TEXT,
                    release_date TEXT,
                    updated_at TEXT,
                    images TEXT
                )
            `);

            // Crear índices para búsquedas rápidas
            await this.createIndexes();
            
            console.log('✅ Tablas y índices verificados/creados');
        } catch (error) {
            console.error('❌ Error creando tablas:', error);
            throw error;
        }
    }

    // Crear índices para búsquedas rápidas
    async createIndexes() {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name)',
            'CREATE INDEX IF NOT EXISTS idx_cards_set ON cards(set_name)',
            'CREATE INDEX IF NOT EXISTS idx_cards_series ON cards(series)',
            'CREATE INDEX IF NOT EXISTS idx_cards_number ON cards(number)',
            'CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity)',
            'CREATE INDEX IF NOT EXISTS idx_cards_types ON cards(types)',
            'CREATE INDEX IF NOT EXISTS idx_cards_updated ON cards(last_updated)',
            'CREATE INDEX IF NOT EXISTS idx_sets_name ON sets(name)',
            'CREATE INDEX IF NOT EXISTS idx_sets_series ON sets(series)'
        ];

        for (const indexSQL of indexes) {
            try {
                await this.pool.query(indexSQL);
            } catch (error) {
                console.warn(`⚠️ Error creando índice: ${error.message}`);
            }
        }
    }

    // Búsqueda de cartas optimizada
    async searchCards(query, page = 1, pageSize = 20, filters = {}, sort = 'name', direction = 'asc') {
        try {
            await this.ensureInitialized();
            
            const queryStr = String(query || '').toLowerCase();
            const queryLower = `%${queryStr}%`;
            const pageNum = parseInt(page) || 1;
            const pageSizeNum = parseInt(pageSize) || 20;
            const offset = (pageNum - 1) * pageSizeNum;
            
            let whereClause = '';
            let params = [];
            let paramCount = 1;
            
            // Mapeo de categorías especiales a subtipos
            const categoryMapping = {
                'trainer': ['Item', 'Supporter', 'Stadium', 'Pokémon Tool', 'Technical Machine'],
                'trainers': ['Item', 'Supporter', 'Stadium', 'Pokémon Tool', 'Technical Machine'],
                'energy': ['Special'],
                'energies': ['Special'],
                'energia': ['Special'],
                'energias': ['Special']
            };
            
            // Si es búsqueda aleatoria (pokemon sin filtros específicos)
            const hasFilters = filters.series || filters.set || filters.rarity || filters.type || filters.subtype || filters.language || filters.hasImage || filters.hasPrice;
            const isRandomSearch = queryStr === 'pokemon' && !hasFilters;
            
            // Verificar si es una búsqueda por categoría especial
            const isCategorySearch = categoryMapping[queryStr];
            
            if (isRandomSearch) {
                // Búsqueda aleatoria - no usar WHERE clause
                whereClause = '';
            } else if (queryStr === 'pokemon' && hasFilters) {
                // Búsqueda aleatoria con filtros - solo aplicar filtros, no búsqueda de texto
                whereClause = '';
            } else if (isCategorySearch) {
                // Búsqueda por categoría especial (trainers, energies, etc.)
                const subtypes = categoryMapping[queryStr];
                const subtypeConditions = subtypes.map(() => `subtypes LIKE $${paramCount++}`).join(' OR ');
                whereClause = `WHERE (${subtypeConditions})`;
                params = subtypes.map(subtype => `%${subtype}%`);
            } else if (queryStr) {
                // Búsqueda normal - usar WHERE clause para búsquedas específicas
                whereClause = `WHERE (name ILIKE $${paramCount++} OR set_name ILIKE $${paramCount++} OR set_series ILIKE $${paramCount++} OR subtypes::text ILIKE $${paramCount++})`;
                params = [queryLower, queryLower, queryLower, queryLower];
            }
            
            // Aplicar filtros adicionales
            if (filters.series) {
                // Para el filtro de serie, necesitamos usar una subconsulta o lógica más compleja
                // ya que la serie se extrae del nombre del set, no de una columna directa
                const seriesCondition = this.buildSeriesFilterCondition(filters.series, paramCount);
                if (whereClause) {
                    whereClause += ` AND ${seriesCondition}`;
                } else {
                    whereClause = `WHERE ${seriesCondition}`;
                }
                // Agregar los parámetros para los nombres de sets
                const setsInSeries = this.getSetsForSeries(filters.series);
                setsInSeries.forEach(setName => {
                    params.push(setName);
                });
                paramCount += setsInSeries.length;
            }
            
            if (filters.set) {
                if (whereClause) {
                    whereClause += ` AND set_name = $${paramCount++}`;
                } else {
                    whereClause = `WHERE set_name = $${paramCount++}`;
                }
                params.push(String(filters.set));
            }
            
            if (filters.rarity) {
                if (whereClause) {
                    whereClause += ` AND rarity = $${paramCount++}`;
                } else {
                    whereClause = `WHERE rarity = $${paramCount++}`;
                }
                params.push(String(filters.rarity));
            }
            
            if (filters.type) {
                if (whereClause) {
                    whereClause += ` AND types::text ILIKE $${paramCount++}`;
                } else {
                    whereClause = `WHERE types::text ILIKE $${paramCount++}`;
                }
                params.push(`%${String(filters.type)}%`);
            }
            
            if (filters.language) {
                if (whereClause) {
                    whereClause += ` AND id ILIKE $${paramCount++}`;
                } else {
                    whereClause = `WHERE id ILIKE $${paramCount++}`;
                }
                params.push(`%-${String(filters.language)}`);
            }
            
            if (filters.subtype) {
                if (whereClause) {
                    whereClause += ` AND subtypes::text ILIKE $${paramCount++}`;
                } else {
                    whereClause = `WHERE subtypes::text ILIKE $${paramCount++}`;
                }
                params.push(`%${String(filters.subtype)}%`);
            }
            
            if (filters.hasImage !== undefined) {
                if (whereClause) {
                    whereClause += filters.hasImage ? ' AND image_url IS NOT NULL AND image_url != \'null\' AND image_url != \'\'' : ' AND (image_url IS NULL OR image_url = \'null\' OR image_url = \'\')';
                } else {
                    whereClause = filters.hasImage ? 'WHERE image_url IS NOT NULL AND image_url != \'null\' AND image_url != \'\'' : 'WHERE (image_url IS NULL OR image_url = \'null\' OR image_url = \'\')';
                }
            }
            
            // hasPrice no está disponible en la estructura migrada, omitir

            // Construir cláusula de ordenamiento
            let orderClause = '';
            if (isRandomSearch) {
                orderClause = 'ORDER BY RANDOM()';
            } else {
                // Mapear campos de ordenamiento
                const sortField = {
                    'name': 'name',
                    'rarity': 'rarity',
                    'number': 'number',
                    'random': 'RANDOM()'
                }[sort] || 'name';
                
                const sortDirection = direction === 'desc' ? 'DESC' : 'ASC';
                
                if (sort === 'random') {
                    orderClause = 'ORDER BY RANDOM()';
                } else {
                    orderClause = `ORDER BY ${sortField} ${sortDirection}`;
                }
            }
            
            // Ejecutar consulta principal
            const cardsQuery = `
                SELECT * FROM cards 
                ${whereClause}
                ${orderClause}
                LIMIT $${paramCount++} OFFSET $${paramCount++}
            `;
            
            const cardsResult = await this.pool.query(cardsQuery, [...params, pageSizeNum, offset]);

            // Obtener total de resultados
            const countQuery = `
                SELECT COUNT(*) as count FROM cards 
                ${whereClause}
            `;
            const countResult = await this.pool.query(countQuery, params);

            // Procesar resultados y formatear para compatibilidad con API externa
            const processedCards = cardsResult.rows.map(card => {
                // Procesar tipos y subtipos (son arrays en PostgreSQL)
                const types = Array.isArray(card.types) ? card.types : [];
                const subtypes = Array.isArray(card.subtypes) ? card.subtypes : [];
                
                // Generar URL de imagen usando la API de Pokemon TCG
                // Formato: https://images.pokemontcg.io/{set_id}/{number}.png
                const setId = card.id.split('-').slice(0, -1).join('-');
                const cardNumber = card.number || card.id.split('-').pop();
                const imageUrl = `https://images.pokemontcg.io/${setId}/${cardNumber}.png`;
                
                const images = {
                    small: imageUrl,
                    large: imageUrl
                };
                
                return {
                    id: card.id,
                    name: card.name || 'Carta sin nombre',
                    number: card.number || '',
                    rarity: card.rarity || 'Common',
                    types: types,
                    subtypes: subtypes,
                    images: images,
                    tcgplayer: {}, // No disponible en la estructura migrada
                    cardmarket: {}, // No disponible en la estructura migrada
                    set: {
                        id: card.id.split('-').slice(0, -1).join('-') || '',
                        name: card.set_name || 'Set desconocido',
                        series: this.extractSeriesFromSetName(card.set_name) || ''
                    }
                };
            });

            return {
                data: processedCards,
                totalCount: parseInt(countResult.rows[0].count),
                page,
                pageSize,
                totalPages: Math.ceil(parseInt(countResult.rows[0].count) / pageSize)
            };
        } catch (error) {
            console.error('❌ Error en búsqueda PostgreSQL:', error);
            throw error;
        }
    }

    // Agregar carta a la base de datos (no necesario - tabla ya migrada)
    async addCard(cardData) {
        console.log('⚠️ addCard no implementado - tabla ya migrada');
        return false;
    }

    // Obtener carta por ID
    async getCardById(id) {
        try {
            const result = await this.pool.query('SELECT * FROM cards WHERE id = $1', [id]);
            if (result.rows.length > 0) {
                const card = result.rows[0];
                return {
                    ...card,
                    images: card.images ? JSON.parse(card.images) : null,
                    types: card.types ? card.types.split(',') : []
                };
            }
            return null;
        } catch (error) {
            console.error('❌ Error obteniendo carta por ID:', error);
            throw error;
        }
    }

    // Obtener sets disponibles
    async getSets() {
        try {
            const result = await this.pool.query('SELECT * FROM sets ORDER BY name');
            return result.rows.map(set => ({
                ...set,
                images: set.images ? JSON.parse(set.images) : null
            }));
        } catch (error) {
            console.error('❌ Error obteniendo sets:', error);
            throw error;
        }
    }

    // Obtener estadísticas de la base de datos
    async getStats() {
        try {
            const cardCountResult = await this.pool.query('SELECT COUNT(*) as count FROM cards');
            const setCountResult = await this.pool.query('SELECT COUNT(*) as count FROM sets');
            const lastUpdateResult = await this.pool.query('SELECT MAX(last_updated) as last FROM cards');
            
            return {
                totalCards: parseInt(cardCountResult.rows[0].count),
                totalSets: parseInt(setCountResult.rows[0].count),
                lastUpdated: lastUpdateResult.rows[0].last,
                databaseSize: 'PostgreSQL en Railway'
            };
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            throw error;
        }
    }

    // Obtener todas las series únicas
    async getAllSets() {
        try {
            const result = await this.pool.query(`
                SELECT DISTINCT set_name, 
                       COUNT(*) as card_count,
                       MIN(id) as first_card_id
                FROM cards 
                WHERE set_name IS NOT NULL AND set_name != '' 
                GROUP BY set_name 
                ORDER BY set_name
            `);
            return result.rows.map(row => ({
                id: row.first_card_id.split('-').slice(0, -1).join('-') || row.set_name.toLowerCase().replace(/\s+/g, '-'),
                name: row.set_name,
                series: this.extractSeriesFromSetName(row.set_name),
                cardCount: parseInt(row.card_count),
                source: 'pokemontcg'
            }));
        } catch (error) {
            console.error('❌ Error obteniendo sets:', error);
            return [];
        }
    }

    // Obtener todos los tipos únicos
    async getAllTypes() {
        try {
            const result = await this.pool.query(`
                SELECT unnest(types) as type, COUNT(*) as card_count
                FROM cards 
                WHERE types IS NOT NULL AND array_length(types, 1) > 0
                GROUP BY unnest(types)
                ORDER BY type
            `);
            return result.rows
                .filter(row => row.type && row.type.trim())
                .map(row => ({
                    id: row.type.toLowerCase(),
                    name: row.type,
                    cardCount: parseInt(row.card_count)
                }));
        } catch (error) {
            console.error('❌ Error obteniendo tipos:', error);
            return [];
        }
    }

    // Obtener todas las rarezas únicas
    async getAllRarities() {
        try {
            const result = await this.pool.query(`
                SELECT rarity, COUNT(*) as card_count
                FROM cards 
                WHERE rarity IS NOT NULL AND rarity != '' 
                GROUP BY rarity 
                ORDER BY rarity
            `);
            return result.rows.map(row => ({
                id: row.rarity.toLowerCase().replace(/\s+/g, '-'),
                name: row.rarity,
                cardCount: parseInt(row.card_count)
            }));
        } catch (error) {
            console.error('❌ Error obteniendo rarezas:', error);
            return [];
        }
    }

    // Obtener todos los subtipos únicos
    async getAllSubtypes() {
        try {
            const result = await this.pool.query(`
                SELECT unnest(subtypes) as subtype, COUNT(*) as card_count
                FROM cards 
                WHERE subtypes IS NOT NULL AND array_length(subtypes, 1) > 0
                GROUP BY unnest(subtypes)
                ORDER BY subtype
            `);
            return result.rows
                .filter(row => row.subtype && row.subtype.trim())
                .map(row => ({
                    id: row.subtype.toLowerCase().replace(/\s+/g, '-'),
                    name: row.subtype,
                    cardCount: parseInt(row.card_count)
                }));
        } catch (error) {
            console.error('❌ Error obteniendo subtipos:', error);
            return [];
        }
    }

    // Obtener todos los idiomas únicos
    async getAllLanguages() {
        try {
            // Idiomas disponibles en los datos
            const result = await this.pool.query('SELECT DISTINCT id FROM cards WHERE id LIKE \'%-%\'');
            const dataLanguages = new Set();
            result.rows.forEach(row => {
                const parts = row.id.split('-');
                if (parts.length > 1) {
                    dataLanguages.add(parts[parts.length - 1]);
                }
            });
            
            // Lista completa de idiomas de Pokémon TCG
            const allLanguages = [
                { code: 'en', name: 'English', category: 'western' },
                { code: 'es', name: 'Español', category: 'western' },
                { code: 'fr', name: 'Français', category: 'western' },
                { code: 'de', name: 'Deutsch', category: 'western' },
                { code: 'it', name: 'Italiano', category: 'western' },
                { code: 'pt', name: 'Português', category: 'western' },
                { code: 'ja', name: 'Japonés', category: 'asian' },
                { code: 'ko', name: 'Coreano', category: 'asian' },
                { code: 'zh-cn', name: 'Chino (Simplificado)', category: 'asian' },
                { code: 'zh-tw', name: 'Chino (Tradicional)', category: 'asian' }
            ];
            
            // Marcar qué idiomas están disponibles
            const languagesWithAvailability = allLanguages.map(lang => ({
                ...lang,
                available: lang.category === 'western' || dataLanguages.has(lang.code)
            }));
            
            return languagesWithAvailability;
        } catch (error) {
            console.error('❌ Error obteniendo idiomas:', error);
            return [];
        }
    }

    // Obtener todas las series únicas
    async getAllSeries() {
        try {
            const result = await this.pool.query(`
                SELECT DISTINCT set_name, COUNT(*) as card_count
                FROM cards 
                WHERE set_name IS NOT NULL AND set_name != '' 
                GROUP BY set_name 
                ORDER BY set_name
            `);
            
            // Extraer series únicas de los nombres de sets
            const seriesMap = new Map();
            result.rows.forEach(row => {
                const series = this.extractSeriesFromSetName(row.set_name);
                if (series && series !== '') {
                    if (seriesMap.has(series)) {
                        seriesMap.set(series, seriesMap.get(series) + parseInt(row.card_count));
                    } else {
                        seriesMap.set(series, parseInt(row.card_count));
                    }
                }
            });
            
            return Array.from(seriesMap.entries())
                .map(([series, cardCount]) => ({
                    id: series.toLowerCase().replace(/\s+/g, '-'),
                    name: series,
                    cardCount: cardCount
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('❌ Error obteniendo series:', error);
            return [];
        }
    }

    // Construir condición de filtro para series
    buildSeriesFilterCondition(seriesName, paramCount) {
        // Obtener todos los sets que pertenecen a esta serie
        const setsInSeries = this.getSetsForSeries(seriesName);
        
        if (setsInSeries.length === 0) {
            return '1=0'; // No hay sets, devolver condición que nunca se cumple
        }
        
        // Crear condición IN con los nombres de sets
        const placeholders = setsInSeries.map((_, index) => `$${paramCount + index}`).join(', ');
        return `set_name IN (${placeholders})`;
    }
    
    // Obtener número de parámetros para el filtro de serie
    getSeriesFilterParamCount(seriesName) {
        return this.getSetsForSeries(seriesName).length;
    }
    
    // Obtener todos los sets que pertenecen a una serie específica
    getSetsForSeries(seriesName) {
        // Mapeo de series a sets (basado en la función extractSeriesFromSetName)
        const seriesToSetsMap = {
            'Base': ['Base', 'Base Set', 'Base Set 2', 'Expedition Base Set'],
            'Jungle': ['Jungle'],
            'Fossil': ['Fossil'],
            'Team Rocket': ['Team Rocket'],
            'Gym': ['Gym Heroes', 'Gym Challenge'],
            'Neo': ['Neo Genesis', 'Neo Discovery', 'Neo Revelation', 'Neo Destiny'],
            'e-Card': ['Expedition', 'Aquapolis', 'Skyridge'],
            'EX': ['Ruby & Sapphire', 'Sandstorm', 'Dragon', 'Team Magma vs Team Aqua', 'Hidden Legends', 'FireRed & LeafGreen', 'Team Rocket Returns', 'Deoxys', 'Emerald', 'Unseen Forces', 'Delta Species', 'Legend Maker', 'Holon Phantoms', 'Crystal Guardians', 'Dragon Frontiers', 'Power Keepers'],
            'Diamond & Pearl': ['Diamond & Pearl', 'Mysterious Treasures', 'Secret Wonders', 'Great Encounters', 'Majestic Dawn', 'Legends Awakened', 'Stormfront'],
            'Platinum': ['Platinum', 'Rising Rivals', 'Supreme Victors', 'Arceus'],
            'HeartGold & SoulSilver': ['HeartGold & SoulSilver', 'Unleashed', 'Undaunted', 'Triumphant', 'Call of Legends'],
            'Black & White': ['Black & White', 'Emerging Powers', 'Noble Victories', 'Next Destinies', 'Dark Explorers', 'Dragons Exalted', 'Boundaries Crossed', 'Plasma Storm', 'Plasma Freeze', 'Plasma Blast', 'Legendary Treasures', 'BW Black Star Promos', 'DP Black Star Promos', 'HGSS Black Star Promos', 'SM Black Star Promos', 'SWSH Black Star Promos', 'Nintendo Black Star Promos', 'Wizards Black Star Promos'],
            'XY': ['XY', 'Flashfire', 'Furious Fists', 'Phantom Forces', 'Primal Clash', 'Roaring Skies', 'Ancient Origins', 'BREAKthrough', 'BREAKpoint', 'Fates Collide', 'Steam Siege', 'Evolutions', 'XY Black Star Promos'],
            'Sun & Moon': ['Sun & Moon', 'Guardians Rising', 'Burning Shadows', 'Crimson Invasion', 'Ultra Prism', 'Forbidden Light', 'Celestial Storm', 'Lost Thunder', 'Team Up', 'Detective Pikachu', 'Unbroken Bonds', 'Unified Minds', 'Hidden Fates', 'Cosmic Eclipse'],
            'Sword & Shield': ['Sword & Shield', 'Rebel Clash', 'Darkness Ablaze', 'Champion\'s Path', 'Vivid Voltage', 'Battle Styles', 'Chilling Reign', 'Evolving Skies', 'Celebrations', 'Fusion Strike', 'Brilliant Stars', 'Astral Radiance', 'Lost Origin', 'Silver Tempest', 'Crown Zenith'],
            'Scarlet & Violet': ['Scarlet & Violet', 'Paldea Evolved', 'Obsidian Flames', '151', 'Paradox Rift', 'Paldean Fates', 'Temporal Forces', 'Twilight Masquerade', 'Shrouded Fable', 'Ancient Roar', 'Future Flash', 'Shining Treasure ex', 'Wild Force', 'Cyber Judge', 'Peach Moon', 'Mask of Change', 'Stellar Crown', 'Scarlet & Violet Black Star Promos', 'Scarlet & Violet Energies', 'Scarlet & Violet Promos']
        };
        
        return seriesToSetsMap[seriesName] || [];
    }

    // Extraer serie del nombre del set
    extractSeriesFromSetName(setName) {
        if (!setName) return '';
        
        // Mapeo de sets conocidos a sus series
        const setToSeriesMap = {
            // Base Set
            'Base': 'Base',
            'Base Set': 'Base',
            'Base Set 2': 'Base',
            'Base Set 2': 'Base',
            
            // Jungle
            'Jungle': 'Jungle',
            
            // Fossil
            'Fossil': 'Fossil',
            
            // Team Rocket
            'Team Rocket': 'Team Rocket',
            
            // Gym Series
            'Gym Heroes': 'Gym',
            'Gym Challenge': 'Gym',
            
            // Neo Series
            'Neo Genesis': 'Neo',
            'Neo Discovery': 'Neo',
            'Neo Revelation': 'Neo',
            'Neo Destiny': 'Neo',
            
            // e-Card Series
            'Expedition': 'e-Card',
            'Aquapolis': 'e-Card',
            'Skyridge': 'e-Card',
            
            // EX Series
            'Ruby & Sapphire': 'EX',
            'Sandstorm': 'EX',
            'Dragon': 'EX',
            'Team Magma vs Team Aqua': 'EX',
            'Hidden Legends': 'EX',
            'FireRed & LeafGreen': 'EX',
            'Team Rocket Returns': 'EX',
            'Deoxys': 'EX',
            'Emerald': 'EX',
            'Unseen Forces': 'EX',
            'Delta Species': 'EX',
            'Legend Maker': 'EX',
            'Holon Phantoms': 'EX',
            'Crystal Guardians': 'EX',
            'Dragon Frontiers': 'EX',
            'Power Keepers': 'EX',
            
            // Diamond & Pearl Series
            'Diamond & Pearl': 'Diamond & Pearl',
            'Mysterious Treasures': 'Diamond & Pearl',
            'Secret Wonders': 'Diamond & Pearl',
            'Great Encounters': 'Diamond & Pearl',
            'Majestic Dawn': 'Diamond & Pearl',
            'Legends Awakened': 'Diamond & Pearl',
            'Stormfront': 'Diamond & Pearl',
            
            // Platinum Series
            'Platinum': 'Platinum',
            'Rising Rivals': 'Platinum',
            'Supreme Victors': 'Platinum',
            'Arceus': 'Platinum',
            
            // HeartGold & SoulSilver Series
            'HeartGold & SoulSilver': 'HeartGold & SoulSilver',
            'Unleashed': 'HeartGold & SoulSilver',
            'Undaunted': 'HeartGold & SoulSilver',
            'Triumphant': 'HeartGold & SoulSilver',
            'Call of Legends': 'HeartGold & SoulSilver',
            
            // Black & White Series
            'Black & White': 'Black & White',
            'Emerging Powers': 'Black & White',
            'Noble Victories': 'Black & White',
            'Next Destinies': 'Black & White',
            'Dark Explorers': 'Black & White',
            'Dragons Exalted': 'Black & White',
            'Boundaries Crossed': 'Black & White',
            'Plasma Storm': 'Black & White',
            'Plasma Freeze': 'Black & White',
            'Plasma Blast': 'Black & White',
            'Legendary Treasures': 'Black & White',
            
            // XY Series
            'XY': 'XY',
            'Flashfire': 'XY',
            'Furious Fists': 'XY',
            'Phantom Forces': 'XY',
            'Primal Clash': 'XY',
            'Roaring Skies': 'XY',
            'Ancient Origins': 'XY',
            'BREAKthrough': 'XY',
            'BREAKpoint': 'XY',
            'Fates Collide': 'XY',
            'Steam Siege': 'XY',
            'Evolutions': 'XY',
            
            // Sun & Moon Series
            'Sun & Moon': 'Sun & Moon',
            'Guardians Rising': 'Sun & Moon',
            'Burning Shadows': 'Sun & Moon',
            'Crimson Invasion': 'Sun & Moon',
            'Ultra Prism': 'Sun & Moon',
            'Forbidden Light': 'Sun & Moon',
            'Celestial Storm': 'Sun & Moon',
            'Lost Thunder': 'Sun & Moon',
            'Team Up': 'Sun & Moon',
            'Detective Pikachu': 'Sun & Moon',
            'Unbroken Bonds': 'Sun & Moon',
            'Unified Minds': 'Sun & Moon',
            'Hidden Fates': 'Sun & Moon',
            'Cosmic Eclipse': 'Sun & Moon',
            
            // Sword & Shield Series
            'Sword & Shield': 'Sword & Shield',
            'Rebel Clash': 'Sword & Shield',
            'Darkness Ablaze': 'Sword & Shield',
            'Champion\'s Path': 'Sword & Shield',
            'Vivid Voltage': 'Sword & Shield',
            'Battle Styles': 'Sword & Shield',
            'Chilling Reign': 'Sword & Shield',
            'Evolving Skies': 'Sword & Shield',
            'Celebrations': 'Sword & Shield',
            'Fusion Strike': 'Sword & Shield',
            'Brilliant Stars': 'Sword & Shield',
            'Astral Radiance': 'Sword & Shield',
            'Lost Origin': 'Sword & Shield',
            'Silver Tempest': 'Sword & Shield',
            'Crown Zenith': 'Sword & Shield',
            
            // Scarlet & Violet Series
            'Scarlet & Violet': 'Scarlet & Violet',
            'Paldea Evolved': 'Scarlet & Violet',
            'Obsidian Flames': 'Scarlet & Violet',
            '151': 'Scarlet & Violet',
            'Paradox Rift': 'Scarlet & Violet',
            'Paldean Fates': 'Scarlet & Violet',
            'Temporal Forces': 'Scarlet & Violet',
            'Twilight Masquerade': 'Scarlet & Violet',
            'Shrouded Fable': 'Scarlet & Violet',
            'Ancient Roar': 'Scarlet & Violet',
            'Future Flash': 'Scarlet & Violet',
            'Shining Treasure ex': 'Scarlet & Violet',
            'Wild Force': 'Scarlet & Violet',
            'Cyber Judge': 'Scarlet & Violet',
            'Peach Moon': 'Scarlet & Violet',
            'Mask of Change': 'Scarlet & Violet',
            'Stellar Crown': 'Scarlet & Violet',
            'Shrouded Fable': 'Scarlet & Violet',
            'Ancient Roar': 'Scarlet & Violet',
            'Future Flash': 'Scarlet & Violet',
            'Shining Treasure ex': 'Scarlet & Violet',
            'Wild Force': 'Scarlet & Violet',
            'Cyber Judge': 'Scarlet & Violet',
            'Peach Moon': 'Scarlet & Violet',
            'Mask of Change': 'Scarlet & Violet',
            'Stellar Crown': 'Scarlet & Violet'
        };
        
        // Buscar coincidencia exacta
        if (setToSeriesMap[setName]) {
            return setToSeriesMap[setName];
        }
        
        // Buscar coincidencia parcial para sets con variaciones
        for (const [set, series] of Object.entries(setToSeriesMap)) {
            if (setName.includes(set) || set.includes(setName)) {
                return series;
            }
        }
        
        // Si no se encuentra, intentar extraer del nombre
        if (setName.includes('Base')) return 'Base';
        if (setName.includes('Jungle')) return 'Jungle';
        if (setName.includes('Fossil')) return 'Fossil';
        if (setName.includes('Team Rocket')) return 'Team Rocket';
        if (setName.includes('Gym')) return 'Gym';
        if (setName.includes('Neo')) return 'Neo';
        if (setName.includes('Expedition') || setName.includes('Aquapolis') || setName.includes('Skyridge')) return 'e-Card';
        if (setName.includes('Ruby') || setName.includes('Sapphire') || setName.includes('EX')) return 'EX';
        if (setName.includes('Diamond') || setName.includes('Pearl')) return 'Diamond & Pearl';
        if (setName.includes('Platinum')) return 'Platinum';
        if (setName.includes('HeartGold') || setName.includes('SoulSilver')) return 'HeartGold & SoulSilver';
        if (setName.includes('Black') || setName.includes('White')) return 'Black & White';
        if (setName.includes('XY')) return 'XY';
        if (setName.includes('Sun') || setName.includes('Moon')) return 'Sun & Moon';
        if (setName.includes('Sword') || setName.includes('Shield')) return 'Sword & Shield';
        if (setName.includes('Scarlet') || setName.includes('Violet')) return 'Scarlet & Violet';
        
        return '';
    }

    // Asegurar que esté inicializado
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.init();
        }
    }

    // Cerrar conexión
    async close() {
        try {
            await this.pool.end();
            console.log('✅ Conexión PostgreSQL cerrada correctamente');
        } catch (error) {
            console.error('❌ Error cerrando conexión PostgreSQL:', error);
        }
    }
}

module.exports = PostgresCardDatabase;