/**
 * Search Module
 * Handles card searching functionality and API interactions
 */

import { API_ENDPOINTS, TIMEOUTS, VIEW_MODES } from './constants.js';
import { showNotification, showLoadingSpinner, hideLoadingSpinner, debounce } from './utils.js';
import { addCardToCollection } from './cards.js';

// Cache for search results
let searchCache = new Map();
let currentSearchController = null;

/**
 * Main search function for cards
 */
export async function searchCards(query, filters = {}) {
    if (!query || query.trim().length < 2) {
        showNotification('Por favor ingresa al menos 2 caracteres para buscar', 'warning');
        return [];
    }
    
    // Cancel previous search if exists
    if (currentSearchController) {
        currentSearchController.abort();
    }
    
    // Check cache
    const cacheKey = JSON.stringify({ query, filters });
    if (searchCache.has(cacheKey)) {
        return searchCache.get(cacheKey);
    }
    
    showLoadingSpinner();
    currentSearchController = new AbortController();
    
    try {
        const results = await fetchCards(query, filters, currentSearchController.signal);
        
        // Cache results
        searchCache.set(cacheKey, results);
        
        // Clear old cache entries if too many
        if (searchCache.size > 50) {
            const firstKey = searchCache.keys().next().value;
            searchCache.delete(firstKey);
        }
        
        return results;
    } catch (error) {
        if (error.name !== 'AbortError') {
            showNotification('Error al buscar cartas. Por favor intenta de nuevo.', 'error');
        }
        return [];
    } finally {
        hideLoadingSpinner();
        currentSearchController = null;
    }
}

/**
 * Fetch cards from API with timeout and retry logic
 */
async function fetchCards(query, filters = {}, signal) {
    const baseUrl = API_ENDPOINTS.PROXY_CARDS || API_ENDPOINTS.POKEMON_TCG + '/cards';
    const params = new URLSearchParams();
    
    // Add search query
    params.append('q', query);
    
    // Add pagination
    params.append('pageSize', filters.pageSize || '20');
    params.append('page', filters.page || '1');
    
    // Add filters as separate parameters
    if (filters.set) {
        params.append('set', filters.set);
    }
    
    if (filters.series) {
        params.append('series', filters.series);
    }
    
    if (filters.rarity) {
        params.append('rarity', filters.rarity);
    }
    
    if (filters.type) {
        params.append('type', filters.type);
    }
    
    if (filters.language) {
        params.append('language', filters.language);
    }
    
    const url = `${baseUrl}?${params.toString()}`;
    
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUTS.API_REQUEST);
    });
    
    try {
        // Race between fetch and timeout
        const response = await Promise.race([
            fetch(url, { signal }),
            timeoutPromise
        ]);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.data || [];
        
    } catch (error) {
        if (error.message === 'TIMEOUT') {
            
            // Retry with simpler query
            const retryParams = new URLSearchParams();
            retryParams.append('q', query);
            retryParams.append('pageSize', '10');
            
            const retryUrl = `${baseUrl}?${retryParams.toString()}`;
            
            try {
                const retryResponse = await fetch(retryUrl, { 
                    signal,
                    timeout: TIMEOUTS.API_RETRY 
                });
                
                if (!retryResponse.ok) {
                    throw new Error(`HTTP error! status: ${retryResponse.status}`);
                }
                
                const retryData = await retryResponse.json();
                return retryData.data || [];
                
            } catch (retryError) {
                throw retryError;
            }
        }
        
        throw error;
    }
}

/**
 * Search cards for trade form autocomplete
 */
export async function searchCardForTrade(inputElement, type, cardIndex) {
    const query = inputElement.value.trim();
    const resultsContainer = inputElement.parentElement.nextElementSibling;
    
    if (!resultsContainer) return;
    
    if (query.length < 2) {
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '';
        return;
    }
    
    // Show loading
    resultsContainer.innerHTML = `
        <div class="p-3 text-center text-gray-500 dark:text-gray-400">
            <div class="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
            <span class="ml-2">Buscando...</span>
        </div>
    `;
    resultsContainer.classList.remove('hidden');
    
    try {
        const response = await fetch(`https://tcgtrade-production.up.railway.app/api/pokemontcg/cards?q=${query}&pageSize=10`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            resultsContainer.innerHTML = data.data.map(card => `
                <div class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2 border-b border-gray-200 dark:border-gray-600 last:border-0"
                     onclick="selectCardForTrade('${type}', ${cardIndex}, '${card.id}', '${card.name.replace(/'/g, "\\'")}', '${card.images.small}', '${(card.set?.name || '').replace(/'/g, "\\'")}', '${card.number || ''}')">
                    <img src="${card.images.small}" alt="${card.name}" class="w-10 h-14 object-contain">
                    <div class="flex-1">
                        <div class="font-medium text-sm text-gray-900 dark:text-white">${card.name}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">${card.set?.name || 'Set desconocido'} - ${card.number || 'N/A'}</div>
                    </div>
                </div>
            `).join('');
        } else {
            resultsContainer.innerHTML = `
                <div class="p-3 text-center text-gray-500 dark:text-gray-400">
                    No se encontraron cartas
                </div>
            `;
        }
    } catch (error) {
        resultsContainer.innerHTML = `
            <div class="p-3 text-center text-red-500">
                Error al buscar cartas
            </div>
        `;
    }
}

/**
 * Render search results in grid view
 */
export function renderCardsInGrid(cards, container) {
    if (!container) return;
    
    if (!cards || cards.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8">
                <p class="text-gray-500 dark:text-gray-400">No se encontraron cartas</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = cards.map(card => createCardGridItem(card)).join('');
}

/**
 * Render search results in list view
 */
export function renderCardsInList(cards, container) {
    if (!container) return;
    
    if (!cards || cards.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <p class="text-gray-500 dark:text-gray-400">No se encontraron cartas</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = cards.map(card => createCardListItem(card)).join('');
}

/**
 * Create card grid item HTML
 */
function createCardGridItem(card) {
    const safeCardName = (card.name || '').replace(/'/g, "\\'");
    const safeImageUrl = (card.images?.large || card.images?.small || '').replace(/'/g, "\\'");
    const safeSetName = (card.set?.name || '').replace(/'/g, "\\'");
    const safeSeries = (card.set?.series || '').replace(/'/g, "\\'");
    const cardNumber = card.number || '';
    
    // Get offer count
    const offerCount = getCardOfferCount(card.name);
    
    return `
        <div class="card-bg rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div class="relative">
                <img src="${card.images?.small || '/images/card-back.png'}" 
                     alt="${card.name}" 
                     class="w-full h-auto cursor-pointer"
                     onclick="showCardDetails('${card.id}', '${safeCardName}', '${safeImageUrl}')">
                <div class="absolute top-2 right-2">
                    <span class="bg-white dark:bg-gray-800 px-2 py-1 rounded-full text-xs font-semibold shadow">
                        ${card.set?.name || 'Unknown Set'}
                    </span>
                </div>
            </div>
            <div class="p-4">
                <h3 class="font-bold text-lg mb-2 text-gray-800 dark:text-white">${card.name}</h3>
                <div class="flex justify-between items-center mb-3">
                    <span class="text-sm text-gray-600 dark:text-gray-400">
                        #${cardNumber} • ${card.rarity || 'Common'}
                    </span>
                    ${offerCount > 0 ? `
                        <button onclick="showCardOffers('${safeCardName}', '${safeImageUrl}')" 
                                class="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full text-xs font-semibold hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors">
                            ${offerCount} Ofrecida${offerCount > 1 ? 's' : ''}
                        </button>
                    ` : ''}
                </div>
                <button onclick="addCardDirectly('${card.id}', '${safeCardName}', '${safeImageUrl}', '${safeSetName}', '${safeSeries}', '${cardNumber}')"
                        class="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                    Añadir a Mi Colección
                </button>
            </div>
        </div>
    `;
}

/**
 * Create card list item HTML
 */
function createCardListItem(card) {
    const safeCardName = (card.name || '').replace(/'/g, "\\'");
    const safeImageUrl = (card.images?.large || card.images?.small || '').replace(/'/g, "\\'");
    const safeSetName = (card.set?.name || '').replace(/'/g, "\\'");
    const safeSeries = (card.set?.series || '').replace(/'/g, "\\'");
    const cardNumber = card.number || '';
    
    // Get offer count
    const offerCount = getCardOfferCount(card.name);
    
    return `
        <div class="card-bg rounded-lg shadow-lg p-4 flex gap-4 hover:shadow-xl transition-all duration-300">
            <img src="${card.images?.small || '/images/card-back.png'}" 
                 alt="${card.name}" 
                 class="w-24 h-32 object-contain cursor-pointer"
                 onclick="showCardDetails('${card.id}', '${safeCardName}', '${safeImageUrl}')">
            <div class="flex-1">
                <h3 class="font-bold text-lg mb-2 text-gray-800 dark:text-white">${card.name}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Set: ${card.set?.name || 'Unknown'} • #${cardNumber}
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Rareza: ${card.rarity || 'Common'}
                </p>
                <div class="flex gap-2">
                    <button onclick="addCardDirectly('${card.id}', '${safeCardName}', '${safeImageUrl}', '${safeSetName}', '${safeSeries}', '${cardNumber}')"
                            class="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                        Añadir a Colección
                    </button>
                    ${offerCount > 0 ? `
                        <button onclick="showCardOffers('${safeCardName}', '${safeImageUrl}')" 
                                class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                            Ver ${offerCount} Oferta${offerCount > 1 ? 's' : ''}
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Get count of offers for a specific card
 */
function getCardOfferCount(cardName) {
    // Get all trades from localStorage
    let totalOffers = 0;
    
    for (let key in localStorage) {
        if (key.startsWith('userTrades_')) {
            try {
                const trades = JSON.parse(localStorage.getItem(key) || '[]');
                trades.forEach(trade => {
                    if (trade.offeredCards) {
                        trade.offeredCards.forEach(card => {
                            if (card.name === cardName) {
                                totalOffers++;
                            }
                        });
                    }
                });
            } catch (e) {
            }
        }
    }
    
    return totalOffers;
}

/**
 * Initialize search with debouncing
 */
export const debouncedSearch = debounce(searchCards, TIMEOUTS.SEARCH_DEBOUNCE);

// Export for window access
if (typeof window !== 'undefined') {
    window.searchCardForTrade = searchCardForTrade;
}