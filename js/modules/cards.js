/**
 * Cards Module
 * Handles user card collection management
 */

import { 
    db,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc
} from './firebase-config.js';

import { showNotification } from './utils.js';
import { SUCCESS_MESSAGES, CARD_CONDITIONS, LANGUAGES } from './constants.js';
import { getCurrentUser } from './auth.js';

// Cache for user cards
let userCardsCache = [];

/**
 * Load user's card collection
 */
export async function loadMyCollection(userId) {
    if (!userId) {
        showNotification('Debes iniciar sesión para ver tu colección', 'warning');
        return [];
    }
    
    try {
        const cardsRef = collection(db, `users/${userId}/my_cards`);
        const snapshot = await getDocs(cardsRef);
        
        userCardsCache = [];
        snapshot.forEach(doc => {
            userCardsCache.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return userCardsCache;
    } catch (error) {
        showNotification('Error al cargar tu colección', 'error');
        return [];
    }
}

/**
 * Add card to user's collection
 */
export async function addCardToCollection(cardId, cardName, imageUrl, setName, series, number, condition = 'NM', language = 'Español') {
    const user = getCurrentUser();
    if (!user) {
        showNotification('Debes iniciar sesión para añadir cartas', 'warning');
        return false;
    }
    
    try {
        const cardData = {
            cardId,
            name: cardName,
            imageUrl,
            set: setName,
            series,
            number,
            condition,
            language,
            addedAt: new Date().toISOString()
        };
        
        const docRef = doc(db, `users/${user.uid}/my_cards`, cardId);
        await setDoc(docRef, cardData);
        
        // Update cache
        userCardsCache.push({ id: cardId, ...cardData });
        
        // Update user stats
        await updateUserCardCount(user.uid, 1);
        
        showNotification(SUCCESS_MESSAGES.CARD_ADDED, 'success');
        return true;
    } catch (error) {
        showNotification('Error al añadir la carta', 'error');
        return false;
    }
}

/**
 * Remove card from user's collection
 */
export async function removeCardFromCollection(cardId) {
    const user = getCurrentUser();
    if (!user) {
        showNotification('Debes iniciar sesión para eliminar cartas', 'warning');
        return false;
    }
    
    try {
        await deleteDoc(doc(db, `users/${user.uid}/my_cards`, cardId));
        
        // Update cache
        userCardsCache = userCardsCache.filter(card => card.id !== cardId);
        
        // Update user stats
        await updateUserCardCount(user.uid, -1);
        
        showNotification(SUCCESS_MESSAGES.CARD_REMOVED, 'success');
        return true;
    } catch (error) {
        showNotification('Error al eliminar la carta', 'error');
        return false;
    }
}

/**
 * Check if user has a specific card
 */
export async function checkIfUserHasCard(cardId) {
    const user = getCurrentUser();
    if (!user) return false;
    
    try {
        const docRef = doc(db, `users/${user.uid}/my_cards`, cardId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists();
    } catch (error) {
        return false;
    }
}

/**
 * Update user's total card count
 */
async function updateUserCardCount(userId, increment) {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const currentCount = userDoc.data().totalCards || 0;
            await setDoc(userRef, {
                totalCards: Math.max(0, currentCount + increment)
            }, { merge: true });
        }
    } catch (error) {
    }
}

/**
 * Get user's card statistics
 */
export async function getCardStatistics(userId) {
    if (!userId) return null;
    
    try {
        const cards = await loadMyCollection(userId);
        
        // Calculate statistics
        const stats = {
            total: cards.length,
            bySet: {},
            byCondition: {},
            byLanguage: {},
            byRarity: {}
        };
        
        cards.forEach(card => {
            // By set
            if (card.set) {
                stats.bySet[card.set] = (stats.bySet[card.set] || 0) + 1;
            }
            
            // By condition
            if (card.condition) {
                stats.byCondition[card.condition] = (stats.byCondition[card.condition] || 0) + 1;
            }
            
            // By language
            if (card.language) {
                stats.byLanguage[card.language] = (stats.byLanguage[card.language] || 0) + 1;
            }
            
            // By rarity (if available)
            if (card.rarity) {
                stats.byRarity[card.rarity] = (stats.byRarity[card.rarity] || 0) + 1;
            }
        });
        
        return stats;
    } catch (error) {
        return null;
    }
}

/**
 * Filter user's cards
 */
export function filterUserCards(filters = {}) {
    let filteredCards = [...userCardsCache];
    
    if (filters.name) {
        const searchTerm = filters.name.toLowerCase();
        filteredCards = filteredCards.filter(card => 
            card.name?.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filters.set) {
        filteredCards = filteredCards.filter(card => 
            card.set === filters.set
        );
    }
    
    if (filters.condition) {
        filteredCards = filteredCards.filter(card => 
            card.condition === filters.condition
        );
    }
    
    if (filters.language) {
        filteredCards = filteredCards.filter(card => 
            card.language === filters.language
        );
    }
    
    return filteredCards;
}

/**
 * Show add card modal
 */
export function showAddCardModal(cardId, cardName, imageUrl, setName, series, number) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full shadow-xl">
                <div class="mb-6">
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">
                        Añadir a Mi Colección
                    </h3>
                    
                    <div class="flex flex-col items-center mb-4">
                        <img src="${imageUrl}" alt="${cardName}" class="w-48 h-auto rounded-lg shadow-lg mb-4">
                        <div class="text-center">
                            <p class="font-semibold text-gray-900 dark:text-white">${cardName}</p>
                            <p class="text-sm text-gray-600 dark:text-gray-400">${setName} • #${number}</p>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Estado de la carta
                            </label>
                            <select id="cardConditionSelect" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                                ${Object.entries(CARD_CONDITIONS).map(([key, value]) => 
                                    `<option value="${key}">${value.icon} ${value.label}</option>`
                                ).join('')}
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Idioma de la carta
                            </label>
                            <select id="cardLanguageSelect" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                                ${Object.entries(LANGUAGES).map(([lang, flag]) => 
                                    `<option value="${lang}">${flag} ${lang}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="flex gap-3">
                    <button id="confirmAddCard" class="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                        Añadir a Colección
                    </button>
                    <button id="cancelAddCard" class="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                        Cancelar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners
        const cancelBtn = modal.querySelector('#cancelAddCard');
        const confirmBtn = modal.querySelector('#confirmAddCard');
        const conditionSelect = modal.querySelector('#cardConditionSelect');
        const languageSelect = modal.querySelector('#cardLanguageSelect');
        
        // Set default values
        conditionSelect.value = 'NM';
        languageSelect.value = 'Español';
        
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });
        
        confirmBtn.addEventListener('click', () => {
            modal.remove();
            resolve({
                confirmed: true,
                condition: conditionSelect.value,
                language: languageSelect.value
            });
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve(null);
            }
        });
    });
}

/**
 * Add card directly (wrapper for modal and collection)
 */
export async function addCardDirectly(cardId, cardName, imageUrl, setName, series, number) {
    const result = await showAddCardModal(cardId, cardName, imageUrl, setName, series, number);
    
    if (result && result.confirmed) {
        await addCardToCollection(
            cardId, 
            cardName, 
            imageUrl, 
            setName, 
            series, 
            number,
            result.condition,
            result.language
        );
    }
}

/**
 * Get user cards cache
 */
export function getUserCardsCache() {
    return userCardsCache;
}

// Export for window access
if (typeof window !== 'undefined') {
    window.addCardDirectly = addCardDirectly;
    window.removeCardFromCollection = removeCardFromCollection;
}