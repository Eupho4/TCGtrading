const LocalCardDatabase = require('../local-database.js');

class AdvancedSearch {
    constructor() {
        this.db = new LocalCardDatabase();
        this.filters = {
            series: null,
            set: null,
            rarity: null,
            type: null,
            subtype: null,
            language: null,
            priceRange: { min: null, max: null },
            releaseDate: { from: null, to: null },
            hasImage: null,
            hasPrice: null
        };
        this.sortOptions = {
            name: 'name',
            rarity: 'rarity',
            number: 'number',
            price: 'price',
            releaseDate: 'release_date',
            random: 'random'
        };
        this.currentSort = 'name';
        this.sortDirection = 'asc';
    }

    // Obtener opciones disponibles para filtros
    async getFilterOptions() {
        try {
            console.log('🔍 Obteniendo opciones de filtros...');
            
            const options = await Promise.all([
                this.getSeriesOptions(),
                this.getSetOptions(),
                this.getRarityOptions(),
                this.getTypeOptions(),
                this.getSubtypeOptions(),
                this.getLanguageOptions()
            ]);

            return {
                series: options[0],
                sets: options[1],
                rarities: options[2],
                types: options[3],
                subtypes: options[4],
                languages: options[5]
            };
        } catch (error) {
            console.error('❌ Error obteniendo opciones de filtros:', error);
            throw error;
        }
    }

    // Obtener series disponibles
    async getSeriesOptions() {
        try {
            const series = await this.db.all(`
                SELECT DISTINCT series, COUNT(*) as count 
                FROM cards 
                WHERE series IS NOT NULL AND series != '' 
                ORDER BY series
            `);
            return series.map(s => ({ value: s.series, label: s.series, count: s.count }));
        } catch (error) {
            console.error('❌ Error obteniendo series:', error);
            return [];
        }
    }

    // Obtener sets disponibles
    async getSetOptions() {
        try {
            const sets = await this.db.all(`
                SELECT DISTINCT set_name, set_id, COUNT(*) as count 
                FROM cards 
                WHERE set_name IS NOT NULL AND set_name != '' 
                ORDER BY set_name
            `);
            return sets.map(s => ({ 
                value: s.set_name, 
                label: s.set_name, 
                setId: s.set_id,
                count: s.count 
            }));
        } catch (error) {
            console.error('❌ Error obteniendo sets:', error);
            return [];
        }
    }

    // Obtener rarezas disponibles
    async getRarityOptions() {
        try {
            const rarities = await this.db.all(`
                SELECT DISTINCT rarity, COUNT(*) as count 
                FROM cards 
                WHERE rarity IS NOT NULL AND rarity != '' 
                ORDER BY 
                    CASE rarity
                        WHEN 'Common' THEN 1
                        WHEN 'Uncommon' THEN 2
                        WHEN 'Rare' THEN 3
                        WHEN 'Rare Holo' THEN 4
                        WHEN 'Rare Ultra' THEN 5
                        WHEN 'Rare Secret' THEN 6
                        WHEN 'Rare Rainbow' THEN 7
                        WHEN 'Rare Shiny' THEN 8
                        ELSE 9
                    END
            `);
            return rarities.map(r => ({ value: r.rarity, label: r.rarity, count: r.count }));
        } catch (error) {
            console.error('❌ Error obteniendo rarezas:', error);
            return [];
        }
    }

    // Obtener tipos disponibles
    async getTypeOptions() {
        try {
            const types = await this.db.all(`
                SELECT DISTINCT types, COUNT(*) as count 
                FROM cards 
                WHERE types IS NOT NULL AND types != '' 
                ORDER BY types
            `);
            
            // Procesar tipos (pueden estar separados por comas)
            const typeMap = new Map();
            types.forEach(t => {
                const typeList = t.types.split(',').map(type => type.trim());
                typeList.forEach(type => {
                    if (type && type !== '') {
                        const current = typeMap.get(type) || 0;
                        typeMap.set(type, current + t.count);
                    }
                });
            });

            return Array.from(typeMap.entries())
                .map(([type, count]) => ({ value: type, label: type, count }))
                .sort((a, b) => a.label.localeCompare(b.label));
        } catch (error) {
            console.error('❌ Error obteniendo tipos:', error);
            return [];
        }
    }

    // Obtener subtipos disponibles
    async getSubtypeOptions() {
        try {
            const subtypes = await this.db.all(`
                SELECT DISTINCT subtypes, COUNT(*) as count 
                FROM cards 
                WHERE subtypes IS NOT NULL AND subtypes != '' 
                ORDER BY subtypes
            `);
            
            // Procesar subtipos (pueden estar separados por comas)
            const subtypeMap = new Map();
            subtypes.forEach(s => {
                const subtypeList = s.subtypes.split(',').map(subtype => subtype.trim());
                subtypeList.forEach(subtype => {
                    if (subtype && subtype !== '') {
                        const current = subtypeMap.get(subtype) || 0;
                        subtypeMap.set(subtype, current + s.count);
                    }
                });
            });

            return Array.from(subtypeMap.entries())
                .map(([subtype, count]) => ({ value: subtype, label: subtype, count }))
                .sort((a, b) => a.label.localeCompare(b.label));
        } catch (error) {
            console.error('❌ Error obteniendo subtipos:', error);
            return [];
        }
    }

    // Obtener idiomas disponibles
    async getLanguageOptions() {
        try {
            const languages = await this.db.all(`
                SELECT 
                    CASE 
                        WHEN id LIKE '%-ja' THEN 'Japonés'
                        WHEN id LIKE '%-zh-cn' THEN 'Chino Simplificado'
                        WHEN id LIKE '%-zh-tw' THEN 'Chino Tradicional'
                        WHEN id LIKE '%-ko' THEN 'Coreano'
                        WHEN id LIKE '%-fr' THEN 'Francés'
                        WHEN id LIKE '%-de' THEN 'Alemán'
                        WHEN id LIKE '%-it' THEN 'Italiano'
                        WHEN id LIKE '%-pt' THEN 'Portugués'
                        WHEN id LIKE '%-ru' THEN 'Ruso'
                        WHEN id LIKE '%-es' THEN 'Español'
                        ELSE 'Inglés'
                    END as language,
                    COUNT(*) as count
                FROM cards 
                GROUP BY language
                ORDER BY count DESC
            `);
            return languages.map(l => ({ value: l.language, label: l.language, count: l.count }));
        } catch (error) {
            console.error('❌ Error obteniendo idiomas:', error);
            return [];
        }
    }

    // Búsqueda avanzada con múltiples filtros
    async advancedSearch(query = '', filters = {}, sort = 'name', direction = 'asc', page = 1, pageSize = 20) {
        try {
            console.log('🔍 Ejecutando búsqueda avanzada...', { query, filters, sort, direction, page, pageSize });
            
            const queryStr = String(query || '').toLowerCase();
            const queryLower = `%${queryStr}%`;
            const pageNum = parseInt(page) || 1;
            const pageSizeNum = parseInt(pageSize) || 20;
            const offset = (pageNum - 1) * pageSizeNum;
            
            let whereClause = '';
            let params = [];
            
            // Construir WHERE clause dinámicamente
            const conditions = [];
            
            // Búsqueda de texto
            if (queryStr && queryStr !== '') {
                conditions.push('(name LIKE ? OR set_name LIKE ? OR series LIKE ? OR subtypes LIKE ? OR types LIKE ?)');
                params.push(queryLower, queryLower, queryLower, queryLower, queryLower);
            }
            
            // Filtro por serie
            if (filters.series) {
                conditions.push('series = ?');
                params.push(String(filters.series));
            }
            
            // Filtro por set
            if (filters.set) {
                conditions.push('set_name = ?');
                params.push(String(filters.set));
            }
            
            // Filtro por rareza
            if (filters.rarity) {
                conditions.push('rarity = ?');
                params.push(String(filters.rarity));
            }
            
            // Filtro por tipo
            if (filters.type) {
                conditions.push('types LIKE ?');
                params.push(`%${String(filters.type)}%`);
            }
            
            // Filtro por subtipo
            if (filters.subtype) {
                conditions.push('subtypes LIKE ?');
                params.push(`%${String(filters.subtype)}%`);
            }
            
            // Filtro por idioma
            if (filters.language) {
                const languageCode = this.getLanguageCode(filters.language);
                if (languageCode) {
                    conditions.push('id LIKE ?');
                    params.push(`%-${languageCode}`);
                }
            }
            
            // Filtro por rango de precios (si hay datos de precios)
            if (filters.priceRange && (filters.priceRange.min || filters.priceRange.max)) {
                // Nota: Esto requeriría parsear los datos de tcgplayer/cardmarket
                // Por ahora, lo dejamos como placeholder
                console.log('💰 Filtro de precios no implementado aún');
            }
            
            // Filtro por fecha de lanzamiento
            if (filters.releaseDate && (filters.releaseDate.from || filters.releaseDate.to)) {
                // Nota: Esto requeriría datos de fecha en la tabla
                console.log('📅 Filtro de fecha no implementado aún');
            }
            
            // Filtro por disponibilidad de imagen
            if (filters.hasImage === true) {
                conditions.push('images IS NOT NULL AND images != ""');
            } else if (filters.hasImage === false) {
                conditions.push('(images IS NULL OR images = "")');
            }
            
            // Filtro por disponibilidad de precio
            if (filters.hasPrice === true) {
                conditions.push('(tcgplayer IS NOT NULL AND tcgplayer != "" AND tcgplayer != "{}")');
            } else if (filters.hasPrice === false) {
                conditions.push('(tcgplayer IS NULL OR tcgplayer = "" OR tcgplayer = "{}")');
            }
            
            // Construir WHERE clause final
            if (conditions.length > 0) {
                whereClause = `WHERE ${conditions.join(' AND ')}`;
            }
            
            // Construir ORDER BY clause
            let orderClause = this.buildOrderClause(sort, direction);
            
            // Ejecutar búsqueda
            const cards = await this.db.all(`
                SELECT * FROM cards 
                ${whereClause}
                ${orderClause}
                LIMIT ? OFFSET ?
            `, [...params, pageSizeNum, offset]);

            // Obtener total de resultados
            const totalResult = await this.db.get(`
                SELECT COUNT(*) as count FROM cards 
                ${whereClause}
            `, params);

            // Procesar resultados
            const processedCards = cards.map(card => this.processCard(card));

            return {
                data: processedCards,
                totalCount: totalResult.count,
                page: pageNum,
                pageSize: pageSizeNum,
                totalPages: Math.ceil(totalResult.count / pageSizeNum),
                filters: filters,
                sort: sort,
                direction: direction,
                query: query
            };
        } catch (error) {
            console.error('❌ Error en búsqueda avanzada:', error);
            throw error;
        }
    }

    // Construir ORDER BY clause
    buildOrderClause(sort, direction) {
        const dir = direction === 'desc' ? 'DESC' : 'ASC';
        
        switch (sort) {
            case 'name':
                return `ORDER BY name ${dir}`;
            case 'rarity':
                return `ORDER BY 
                    CASE rarity
                        WHEN 'Common' THEN 1
                        WHEN 'Uncommon' THEN 2
                        WHEN 'Rare' THEN 3
                        WHEN 'Rare Holo' THEN 4
                        WHEN 'Rare Ultra' THEN 5
                        WHEN 'Rare Secret' THEN 6
                        WHEN 'Rare Rainbow' THEN 7
                        WHEN 'Rare Shiny' THEN 8
                        ELSE 9
                    END ${dir}`;
            case 'number':
                return `ORDER BY CAST(number AS INTEGER) ${dir}`;
            case 'price':
                // Nota: Esto requeriría parsear precios
                return `ORDER BY name ${dir}`;
            case 'releaseDate':
                // Nota: Esto requeriría datos de fecha
                return `ORDER BY name ${dir}`;
            case 'random':
                return `ORDER BY RANDOM()`;
            default:
                return `ORDER BY name ${dir}`;
        }
    }

    // Procesar carta individual
    processCard(card) {
        // Procesar imágenes
        let images = null;
        try {
            images = card.images ? JSON.parse(card.images) : null;
        } catch (e) {
            images = null;
        }
        
        // Procesar set_id
        let setId = card.set_id;
        if (setId && setId.includes('undefined')) {
            setId = card.id.split('-').slice(0, -1).join('-');
        }
        
        return {
            id: card.id,
            name: card.name || 'Carta sin nombre',
            number: card.number || '',
            rarity: card.rarity || 'Common',
            types: card.types ? card.types.split(',').filter(t => t.trim()) : [],
            subtypes: card.subtypes ? card.subtypes.split(',').filter(t => t.trim()) : [],
            images: images && images.small ? images : { 
                small: '/images/card-placeholder.svg', 
                large: '/images/card-placeholder.svg' 
            },
            tcgplayer: card.tcgplayer ? JSON.parse(card.tcgplayer) : {},
            cardmarket: card.cardmarket ? JSON.parse(card.cardmarket) : {},
            set: {
                id: setId || '',
                name: card.set_name || 'Set desconocido',
                series: card.series || ''
            }
        };
    }

    // Obtener código de idioma
    getLanguageCode(language) {
        const languageMap = {
            'Japonés': 'ja',
            'Chino Simplificado': 'zh-cn',
            'Chino Tradicional': 'zh-tw',
            'Coreano': 'ko',
            'Francés': 'fr',
            'Alemán': 'de',
            'Italiano': 'it',
            'Portugués': 'pt',
            'Ruso': 'ru',
            'Español': 'es',
            'Inglés': 'en'
        };
        return languageMap[language] || null;
    }

    // Búsqueda rápida con sugerencias
    async quickSearch(query, limit = 10) {
        try {
            if (!query || query.length < 2) return [];
            
            const queryLower = `%${query.toLowerCase()}%`;
            
            const results = await this.db.all(`
                SELECT DISTINCT name, set_name, series, rarity
                FROM cards 
                WHERE name LIKE ? OR set_name LIKE ?
                ORDER BY 
                    CASE 
                        WHEN name LIKE ? THEN 1
                        WHEN set_name LIKE ? THEN 2
                        ELSE 3
                    END,
                    name
                LIMIT ?
            `, [queryLower, queryLower, queryLower, queryLower, limit]);
            
            return results.map(result => ({
                name: result.name,
                set: result.set_name,
                series: result.series,
                rarity: result.rarity,
                type: 'card'
            }));
        } catch (error) {
            console.error('❌ Error en búsqueda rápida:', error);
            return [];
        }
    }

    // Obtener estadísticas de búsqueda
    async getSearchStats() {
        try {
            const stats = await Promise.all([
                this.db.get('SELECT COUNT(*) as total FROM cards'),
                this.db.get('SELECT COUNT(DISTINCT series) as series FROM cards WHERE series IS NOT NULL'),
                this.db.get('SELECT COUNT(DISTINCT set_name) as sets FROM cards WHERE set_name IS NOT NULL'),
                this.db.get('SELECT COUNT(DISTINCT rarity) as rarities FROM cards WHERE rarity IS NOT NULL'),
                this.db.get('SELECT COUNT(DISTINCT types) as types FROM cards WHERE types IS NOT NULL')
            ]);
            
            return {
                totalCards: stats[0].total,
                totalSeries: stats[1].series,
                totalSets: stats[2].sets,
                totalRarities: stats[3].rarities,
                totalTypes: stats[4].types
            };
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            return {};
        }
    }

    // Cerrar conexión
    async close() {
        await this.db.close();
    }
}

module.exports = AdvancedSearch;