// TCGdex API Integration Module
// Módulo para integrar la API de TCGdex con nuestra aplicación

import TCGdex from '@tcgdex/sdk';

// Configuración de TCGdex
const tcgdex = new TCGdex('es'); // Español por defecto

// Cache local para optimizar consultas
const tcgdexCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Función auxiliar para gestionar caché
function getCachedData(key) {
    const cached = tcgdexCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
}

function setCachedData(key, data) {
    tcgdexCache.set(key, {
        data: data,
        timestamp: Date.now()
    });
}

// Funciones principales de búsqueda
export async function searchCards(query) {
    const cacheKey = `search_${query}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        // TCGdex tiene una estructura de búsqueda diferente
        // Necesitamos adaptar la query
        const results = await tcgdex.fetchCards({
            name: query,
            localName: query
        });
        
        setCachedData(cacheKey, results);
        return results;
    } catch (error) {
        console.error('Error buscando en TCGdex:', error);
        throw error;
    }
}

export async function getCardById(id) {
    const cacheKey = `card_${id}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const card = await tcgdex.fetchCard(id);
        setCachedData(cacheKey, card);
        return card;
    } catch (error) {
        console.error('Error obteniendo carta de TCGdex:', error);
        throw error;
    }
}

export async function getSets() {
    const cacheKey = 'sets';
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const sets = await tcgdex.fetchSets();
        setCachedData(cacheKey, sets);
        return sets;
    } catch (error) {
        console.error('Error obteniendo sets de TCGdex:', error);
        throw error;
    }
}

export async function getSetById(setId) {
    const cacheKey = `set_${setId}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const set = await tcgdex.fetchSet(setId);
        setCachedData(cacheKey, set);
        return set;
    } catch (error) {
        console.error('Error obteniendo set de TCGdex:', error);
        throw error;
    }
}

export async function getCardsBySet(setId) {
    const cacheKey = `cards_set_${setId}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const set = await tcgdex.fetchSet(setId);
        const cards = set.cards || [];
        setCachedData(cacheKey, cards);
        return cards;
    } catch (error) {
        console.error('Error obteniendo cartas del set de TCGdex:', error);
        throw error;
    }
}

// Función para normalizar datos de TCGdex al formato de nuestra app
export function normalizeTCGdexCard(tcgdexCard) {
    if (!tcgdexCard) return null;

    return {
        id: tcgdexCard.id,
        name: tcgdexCard.localName || tcgdexCard.name,
        nameEN: tcgdexCard.name,
        set: {
            id: tcgdexCard.set?.id,
            name: tcgdexCard.set?.localName || tcgdexCard.set?.name,
            series: tcgdexCard.set?.serie?.localName || tcgdexCard.set?.serie?.name
        },
        number: tcgdexCard.localId || tcgdexCard.id.split('-')[1],
        images: {
            small: tcgdexCard.image + '/low.webp',
            large: tcgdexCard.image + '/high.webp'
        },
        rarity: tcgdexCard.rarity,
        types: tcgdexCard.types || [],
        hp: tcgdexCard.hp,
        attacks: tcgdexCard.attacks || [],
        weaknesses: tcgdexCard.weaknesses || [],
        resistances: tcgdexCard.resistances || [],
        retreatCost: tcgdexCard.retreat,
        artist: tcgdexCard.illustrator,
        dexId: tcgdexCard.dexId || [],
        stage: tcgdexCard.stage,
        evolvesFrom: tcgdexCard.evolveFrom,
        description: tcgdexCard.description,
        source: 'tcgdex' // Para identificar el origen
    };
}

// Función para normalizar sets de TCGdex
export function normalizeTCGdexSet(tcgdexSet) {
    if (!tcgdexSet) return null;

    return {
        id: tcgdexSet.id,
        name: tcgdexSet.localName || tcgdexSet.name,
        nameEN: tcgdexSet.name,
        series: tcgdexSet.serie?.localName || tcgdexSet.serie?.name,
        printedTotal: tcgdexSet.cardCount?.total || 0,
        total: tcgdexSet.cardCount?.total || 0,
        releaseDate: tcgdexSet.releaseDate,
        images: {
            symbol: tcgdexSet.symbol,
            logo: tcgdexSet.logo
        },
        source: 'tcgdex'
    };
}

// Función para buscar en ambas APIs (Pokemon TCG y TCGdex)
export async function searchCardsMultiSource(query, options = {}) {
    const results = {
        pokemonTCG: [],
        tcgdex: []
    };

    try {
        // Búsqueda en paralelo en ambas APIs
        const [tcgdexResults] = await Promise.allSettled([
            searchCards(query)
        ]);

        if (tcgdexResults.status === 'fulfilled' && tcgdexResults.value) {
            results.tcgdex = Array.isArray(tcgdexResults.value) 
                ? tcgdexResults.value.map(normalizeTCGdexCard).filter(Boolean)
                : [];
        }
    } catch (error) {
        console.error('Error en búsqueda multi-fuente:', error);
    }

    return results;
}

// Función para obtener tipos de Pokémon disponibles
export async function getTypes() {
    const cacheKey = 'types';
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const types = await tcgdex.fetchTypes();
        setCachedData(cacheKey, types);
        return types;
    } catch (error) {
        console.error('Error obteniendo tipos de TCGdex:', error);
        throw error;
    }
}

// Función para obtener raridades disponibles
export async function getRarities() {
    const cacheKey = 'rarities';
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const rarities = await tcgdex.fetchRarities();
        setCachedData(cacheKey, rarities);
        return rarities;
    } catch (error) {
        console.error('Error obteniendo raridades de TCGdex:', error);
        throw error;
    }
}

// Función para cambiar el idioma
export function setLanguage(lang) {
    tcgdex.setLanguage(lang);
    // Limpiar caché al cambiar idioma
    tcgdexCache.clear();
}

// Exportar la instancia de TCGdex por si se necesita acceso directo
export { tcgdex };