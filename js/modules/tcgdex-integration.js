// TCGdex Integration for Frontend
// Módulo de integración de TCGdex para el cliente

// URLs de la API
const API_BASE = window.location.origin;
const TCGDEX_ENDPOINTS = {
    cards: `${API_BASE}/api/tcgdex/cards`,
    sets: `${API_BASE}/api/tcgdex/sets`,
    card: (id) => `${API_BASE}/api/tcgdex/card/${id}`,
    combined: `${API_BASE}/api/search/combined`
};

// Cache para optimizar consultas
const apiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Función auxiliar para gestionar caché
function getCachedData(key) {
    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    apiCache.delete(key);
    return null;
}

function setCachedData(key, data) {
    apiCache.set(key, {
        data: data,
        timestamp: Date.now()
    });
}

// Función genérica para hacer peticiones a la API
async function fetchFromAPI(url, options = {}) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching from API:', error);
        throw error;
    }
}

// Funciones públicas de búsqueda

// Buscar cartas en TCGdex
export async function searchTCGdexCards(query) {
    const cacheKey = `tcgdex_search_${query}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const url = new URL(TCGDEX_ENDPOINTS.cards);
        url.searchParams.append('q', query);
        
        const data = await fetchFromAPI(url.toString());
        setCachedData(cacheKey, data);
        return data;
    } catch (error) {
        console.error('Error searching TCGdex cards:', error);
        throw error;
    }
}

// Buscar cartas en ambas APIs (combinado)
export async function searchCardsCombined(query) {
    const cacheKey = `combined_search_${query}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const url = new URL(TCGDEX_ENDPOINTS.combined);
        url.searchParams.append('q', query);
        
        const data = await fetchFromAPI(url.toString());
        setCachedData(cacheKey, data);
        return data;
    } catch (error) {
        console.error('Error in combined search:', error);
        throw error;
    }
}

// Obtener todos los sets de TCGdex
export async function getTCGdexSets() {
    const cacheKey = 'tcgdex_sets';
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const data = await fetchFromAPI(TCGDEX_ENDPOINTS.sets);
        setCachedData(cacheKey, data);
        return data;
    } catch (error) {
        console.error('Error fetching TCGdex sets:', error);
        throw error;
    }
}

// Obtener una carta específica de TCGdex
export async function getTCGdexCard(cardId) {
    const cacheKey = `tcgdex_card_${cardId}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const data = await fetchFromAPI(TCGDEX_ENDPOINTS.card(cardId));
        setCachedData(cacheKey, data);
        return data;
    } catch (error) {
        console.error('Error fetching TCGdex card:', error);
        throw error;
    }
}

// Obtener cartas de un set específico
export async function getTCGdexCardsBySet(setId) {
    const cacheKey = `tcgdex_set_cards_${setId}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const url = new URL(TCGDEX_ENDPOINTS.cards);
        url.searchParams.append('set', setId);
        
        const data = await fetchFromAPI(url.toString());
        setCachedData(cacheKey, data);
        return data;
    } catch (error) {
        console.error('Error fetching TCGdex set cards:', error);
        throw error;
    }
}

// Función para renderizar resultados de búsqueda combinada
export function renderCombinedResults(results, container) {
    if (!results || !results.data || results.data.length === 0) {
        container.innerHTML = '<p class="no-results">No se encontraron resultados</p>';
        return;
    }

    const sources = results.sources || {};
    const cards = results.data;

    // Crear HTML para los resultados
    let html = '<div class="search-results-container">';
    
    // Mostrar estadísticas de fuentes
    html += '<div class="source-stats">';
    html += '<span class="stat-item">Total: ' + cards.length + ' cartas</span>';
    
    if (sources.pokemonTCG) {
        html += '<span class="stat-item pokemon-tcg">Pokemon TCG: ' + sources.pokemonTCG.count + '</span>';
    }
    
    if (sources.tcgdex) {
        html += '<span class="stat-item tcgdex">TCGdex: ' + sources.tcgdex.count + '</span>';
    }
    
    html += '</div>';

    // Renderizar cartas
    html += '<div class="cards-grid">';
    cards.forEach(card => {
        html += renderCardItem(card);
    });
    html += '</div>';

    html += '</div>';
    
    container.innerHTML = html;
}

// Función para renderizar una carta individual
function renderCardItem(card) {
    const source = card.source || 'unknown';
    const sourceClass = source === 'tcgdex' ? 'tcgdex-card' : 'pokemontcg-card';
    
    return `
        <div class="card-item ${sourceClass}" data-card-id="${card.id}" data-source="${source}">
            <div class="card-image-container">
                <img src="${card.images?.small || card.images?.large || '/images/card-placeholder.png'}" 
                     alt="${card.name}"
                     loading="lazy"
                     onerror="this.src='/images/card-placeholder.png'">
                <span class="card-source-badge">${source === 'tcgdex' ? 'TCGdex' : 'Pokemon TCG'}</span>
            </div>
            <div class="card-info">
                <h4 class="card-name">${card.name}</h4>
                <p class="card-set">${card.set?.name || 'Set desconocido'}</p>
                <p class="card-number">#${card.number || '???'}</p>
                ${card.rarity ? `<p class="card-rarity">${card.rarity}</p>` : ''}
            </div>
            <div class="card-actions">
                <button class="btn-view-details" onclick="viewCardDetails('${card.id}', '${source}')">
                    Ver detalles
                </button>
                <button class="btn-add-collection" onclick="addToCollection('${card.id}', '${source}')">
                    Añadir a colección
                </button>
            </div>
        </div>
    `;
}

// Función para ver detalles de una carta
window.viewCardDetails = async function(cardId, source) {
    try {
        let cardData;
        
        if (source === 'tcgdex') {
            const response = await getTCGdexCard(cardId);
            cardData = response.data;
        } else {
            // Usar la API existente de Pokemon TCG
            const response = await fetch(`${API_BASE}/api/pokemontcg/cards/${cardId}`);
            const data = await response.json();
            cardData = data.data;
        }
        
        // Mostrar modal con detalles (asumiendo que existe una función showCardModal)
        if (window.showCardModal) {
            window.showCardModal(cardData);
        } else {
            console.log('Card details:', cardData);
            alert('Ver consola para detalles de la carta');
        }
    } catch (error) {
        console.error('Error loading card details:', error);
        alert('Error al cargar los detalles de la carta');
    }
};

// Función para añadir a la colección
window.addToCollection = async function(cardId, source) {
    try {
        // Aquí iría la lógica para añadir a la colección
        console.log('Adding to collection:', cardId, source);
        
        // Por ahora, mostrar un mensaje de confirmación
        const cardName = document.querySelector(`[data-card-id="${cardId}"] .card-name`)?.textContent || cardId;
        
        if (confirm(`¿Añadir "${cardName}" a tu colección?`)) {
            // TODO: Implementar lógica de colección
            alert('Carta añadida a la colección (funcionalidad en desarrollo)');
        }
    } catch (error) {
        console.error('Error adding to collection:', error);
        alert('Error al añadir a la colección');
    }
};

// Función para integrar la búsqueda dual en el buscador existente
export function setupDualSearch() {
    // Buscar el formulario de búsqueda existente
    const searchForm = document.querySelector('#search-form, .search-form, form[role="search"]');
    const searchInput = document.querySelector('#search-input, .search-input, input[type="search"]');
    const searchResults = document.querySelector('#search-results, .search-results');
    
    if (!searchForm || !searchInput) {
        console.warn('No se encontró el formulario de búsqueda');
        return;
    }
    
    // Añadir opción de búsqueda dual
    const searchModeToggle = document.createElement('div');
    searchModeToggle.className = 'search-mode-toggle';
    searchModeToggle.innerHTML = `
        <label>
            <input type="radio" name="search-mode" value="pokemontcg" checked>
            Solo Pokemon TCG
        </label>
        <label>
            <input type="radio" name="search-mode" value="tcgdex">
            Solo TCGdex
        </label>
        <label>
            <input type="radio" name="search-mode" value="combined">
            Búsqueda combinada
        </label>
    `;
    
    searchForm.insertBefore(searchModeToggle, searchInput.nextSibling);
    
    // Manejar el evento de búsqueda
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const query = searchInput.value.trim();
        if (!query) return;
        
        const searchMode = document.querySelector('input[name="search-mode"]:checked')?.value || 'pokemontcg';
        
        // Mostrar indicador de carga
        if (searchResults) {
            searchResults.innerHTML = '<div class="loading">Buscando...</div>';
        }
        
        try {
            let results;
            
            switch (searchMode) {
                case 'tcgdex':
                    results = await searchTCGdexCards(query);
                    break;
                case 'combined':
                    results = await searchCardsCombined(query);
                    break;
                default:
                    // Usar la búsqueda existente de Pokemon TCG
                    return; // Dejar que el handler existente lo maneje
            }
            
            if (searchResults && results) {
                renderCombinedResults(results, searchResults);
            }
        } catch (error) {
            console.error('Error en búsqueda:', error);
            if (searchResults) {
                searchResults.innerHTML = '<div class="error">Error al realizar la búsqueda</div>';
            }
        }
    });
}

// Estilos CSS para los nuevos elementos
const styles = `
<style>
.search-mode-toggle {
    display: flex;
    gap: 15px;
    margin: 10px 0;
    flex-wrap: wrap;
}

.search-mode-toggle label {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
}

.source-stats {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
    padding: 10px;
    background: #f0f0f0;
    border-radius: 5px;
}

.stat-item {
    font-weight: bold;
}

.stat-item.pokemon-tcg {
    color: #ff6b6b;
}

.stat-item.tcgdex {
    color: #4ecdc4;
}

.cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
}

.card-item {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 10px;
    transition: transform 0.2s;
    position: relative;
}

.card-item:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
}

.card-source-badge {
    position: absolute;
    top: 5px;
    right: 5px;
    background: rgba(0,0,0,0.7);
    color: white;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 12px;
}

.tcgdex-card .card-source-badge {
    background: #4ecdc4;
}

.pokemontcg-card .card-source-badge {
    background: #ff6b6b;
}

.card-image-container {
    position: relative;
    margin-bottom: 10px;
}

.card-image-container img {
    width: 100%;
    height: auto;
    border-radius: 5px;
}

.card-info {
    margin-bottom: 10px;
}

.card-name {
    font-size: 16px;
    font-weight: bold;
    margin: 5px 0;
}

.card-set {
    font-size: 14px;
    color: #666;
    margin: 3px 0;
}

.card-number {
    font-size: 13px;
    color: #888;
}

.card-rarity {
    font-size: 13px;
    color: #4a4a4a;
    font-style: italic;
}

.card-actions {
    display: flex;
    gap: 5px;
    flex-direction: column;
}

.card-actions button {
    padding: 5px 10px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.2s;
}

.btn-view-details {
    background: #3498db;
    color: white;
}

.btn-view-details:hover {
    background: #2980b9;
}

.btn-add-collection {
    background: #2ecc71;
    color: white;
}

.btn-add-collection:hover {
    background: #27ae60;
}

.loading, .error, .no-results {
    text-align: center;
    padding: 40px;
    font-size: 18px;
}

.error {
    color: #e74c3c;
}

.no-results {
    color: #7f8c8d;
}
</style>
`;

// Inyectar estilos al cargar el módulo
document.head.insertAdjacentHTML('beforeend', styles);

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDualSearch);
} else {
    setupDualSearch();
}

// Exportar todas las funciones necesarias
export default {
    searchTCGdexCards,
    searchCardsCombined,
    getTCGdexSets,
    getTCGdexCard,
    getTCGdexCardsBySet,
    renderCombinedResults,
    setupDualSearch
};