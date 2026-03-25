// Importar las funciones necesarias de Firebase
// Deploy forzado: 2024-01-16 - Correcciones completas de modo oscuro aplicadas
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously, signInWithCustomToken, updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js';

// Importar módulos de chat
import ChatManager from '/js/modules/chat.js?v=33';
import ChatUI from '/js/modules/chat-ui.js?v=33';
import { ChatDebugger } from '/js/modules/chat-debug.js?v=33';

// Importar módulos de pagos
import { renderConnectAccountBanner } from '/js/modules/payment-ui.js';

// Verificar que las importaciones se cargaron correctamente
console.log('🔍 Verificando importaciones de chat:', {
    ChatManager: typeof ChatManager,
    ChatUI: typeof ChatUI,
    ChatDebugger: typeof ChatDebugger
});

// Importar módulos de migración y sincronización
import DataMigration from '/js/modules/data-migration.js?v=34';
import DataSync from '/js/modules/data-sync.js?v=34';


// CONFIGURACIÓN DE FIREBASE - REEMPLAZA CON TUS DATOS
const firebaseConfig = {
    apiKey: "AIzaSyCkgz6_Zpu0VOW6GgJxOxd9QlVccsBXnog",
    authDomain: "tcgtrade-7ba27.firebaseapp.com",
    projectId: "tcgtrade-7ba27",
    storageBucket: "tcgtrade-7ba27.firebasestorage.app",
    messagingSenderId: "207150886257",
    appId: "1:207150886257:web:26edebbeb7df7a1d935ad0",
    databaseURL: "https://tcgtrade-7ba27-default-rtdb.europe-west1.firebasedatabase.app" // URL de Realtime Database
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ID único de tu aplicación para Firestore
const appId = 'tcgtrade-pokemon-app';

// Hacer disponibles globalmente para compatibilidad con main.js
window.auth = auth;
window.db = db;
window.EmailAuthProvider = EmailAuthProvider;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signOut = signOut;
window.onAuthStateChanged = onAuthStateChanged;
window.updateEmail = updateEmail;
window.updatePassword = updatePassword;
window.reauthenticateWithCredential = reauthenticateWithCredential;
window.sendPasswordResetEmail = sendPasswordResetEmail;
window.doc = doc;
window.setDoc = setDoc;
window.getDoc = getDoc;
window.collection = collection;
window.getDocs = getDocs;
window.deleteDoc = deleteDoc;

// Emitir evento cuando Firebase esté listo (por si algún módulo lo necesita)
setTimeout(() => {
    window.dispatchEvent(new CustomEvent('firebaseReady', {
        detail: { auth, db, EmailAuthProvider }
    }));
    console.log('🔥 Evento firebaseReady emitido');
}, 100);

// Variables globales
let currentUser = null;
let allSets = []; // Cache para todos los sets de la API
let userCardsCache = []; // Cache para las cartas del usuario

// Cache de precios para cartas en intercambios
const tradePriceCache = new Map();

// Etiquetas de fuentes de precios
const PRICE_LABEL_CARDMARKET = 'CM';
const PRICE_LABEL_TCGPLAYER  = 'TCG';
const PRICE_TOOLTIP_CARDMARKET = 'Cardmarket (precio europeo en EUR)';
const PRICE_TOOLTIP_TCGPLAYER  = 'TCGPlayer (precio norteamericano en USD)';

// Obtener precio de una carta por ID o nombre
async function fetchCardPrice(cardId, cardName) {
    const cacheKey = cardId || cardName;
    if (!cacheKey) return null;
    if (tradePriceCache.has(cacheKey)) return tradePriceCache.get(cacheKey);
    try {
        const query = cardId || cardName;
        const response = await fetch(`/api/pokemontcg/cards?q=${encodeURIComponent(query)}&pageSize=5`);
        const data = await response.json();
        let card = null;
        if (data.data && data.data.length > 0) {
            card = cardId ? (data.data.find(c => c.id === cardId) || data.data[0]) : data.data[0];
        }
        let prices = null;
        if (card) {
            const cmPrice = card.cardmarket?.avg30 || card.cardmarket?.avg1 || card.cardmarket?.avg || null;
            const tcgPrice = card.tcgplayer?.normal?.marketPrice || card.tcgplayer?.holofoil?.marketPrice || null;
            if (cmPrice !== null || tcgPrice !== null) {
                prices = { cardmarket: cmPrice, tcgplayer: tcgPrice };
            }
        }
        tradePriceCache.set(cacheKey, prices);
        return prices;
    } catch (e) {
        console.warn('No se pudo obtener precio para carta:', cardId || cardName);
        tradePriceCache.set(cacheKey, null);
        return null;
    }
}

// Formatear precio en euros
function formatTradePrice(price) {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(price);
}

// Cargar precios para todos los elementos [data-card-price] dentro de un contenedor
async function loadTradeCardPrices(container) {
    const priceElements = container.querySelectorAll('[data-card-price]');
    if (priceElements.length === 0) return;
    const fetchPromises = Array.from(priceElements).map(async (el) => {
        const cardId = el.dataset.cardId;
        const cardName = el.dataset.cardName;
        const prices = await fetchCardPrice(cardId, cardName);
        if (prices && (prices.cardmarket || prices.tcgplayer)) {
            el.innerHTML = `
                <div class="flex flex-col gap-0.5 mt-1">
                    ${prices.cardmarket ? `<span class="text-[10px] font-medium text-green-600 dark:text-green-400" title="${PRICE_TOOLTIP_CARDMARKET}">💳 ${PRICE_LABEL_CARDMARKET} ${formatTradePrice(prices.cardmarket)}</span>` : ''}
                    ${prices.tcgplayer ? `<span class="text-[10px] font-medium text-blue-600 dark:text-blue-400" title="${PRICE_TOOLTIP_TCGPLAYER}">🎮 ${PRICE_LABEL_TCGPLAYER} $${prices.tcgplayer.toFixed(2)}</span>` : ''}
                </div>`;
        } else {
            el.innerHTML = '';
        }
    });
    await Promise.all(fetchPromises);
}

// Load market prices for [data-market-price] elements in the collection view
async function loadCollectionMarketPrices(container) {
    const priceElements = container.querySelectorAll('[data-market-price]');
    if (priceElements.length === 0) return;
    const fetchPromises = Array.from(priceElements).map(async (el) => {
        const cardId = el.dataset.cardId;
        const cardName = el.dataset.cardName;
        const prices = await fetchCardPrice(cardId, cardName);
        if (prices && (prices.cardmarket || prices.tcgplayer)) {
            const parts = [];
            if (prices.cardmarket) parts.push(`<span class="text-green-600 dark:text-green-400 font-medium" title="${PRICE_TOOLTIP_CARDMARKET}">💳 ${PRICE_LABEL_CARDMARKET} ${formatTradePrice(prices.cardmarket)}</span>`);
            if (prices.tcgplayer) parts.push(`<span class="text-blue-600 dark:text-blue-400 font-medium" title="${PRICE_TOOLTIP_TCGPLAYER}">🎮 ${PRICE_LABEL_TCGPLAYER} $${prices.tcgplayer.toFixed(2)}</span>`);
            el.innerHTML = parts.join('<span class="text-gray-400 mx-1">·</span>');
        } else {
            el.innerHTML = '<span class="text-gray-400 italic">Sin precio de mercado</span>';
        }
    });
    await Promise.all(fetchPromises);
}

// ── Balance / diferencia de valor del intercambio ───────────────────────────

// Resolves the best available EUR price for a single trade card
async function resolveCardPrice(card) {
    if (card.customPrice != null) return card.customPrice;
    const prices = await fetchCardPrice(card.id, card.name);
    return prices?.cardmarket ?? null;
}

// Calculates and renders the trade value balance into a given DOM element.
// offeredCards: cards the trade owner offers
// wantedCards:  cards the trade owner wants
async function renderTradeBalance(balanceEl, offeredCards, wantedCards) {
    if (!balanceEl) return;

    const offered = offeredCards || [];
    const wanted  = wantedCards  || [];

    const [offeredPrices, wantedPrices] = await Promise.all([
        Promise.all(offered.map(resolveCardPrice)),
        Promise.all(wanted.map(resolveCardPrice))
    ]);

    const offeredKnown = offeredPrices.filter(p => p !== null);
    const wantedKnown  = wantedPrices.filter(p => p !== null);

    if (offeredKnown.length === 0 && wantedKnown.length === 0) {
        balanceEl.innerHTML = '<p class="text-xs text-gray-400 italic text-center">Sin precios disponibles para calcular el balance</p>';
        return;
    }

    // Work in cents to avoid floating-point precision issues
    const offeredCents = offeredKnown.reduce((a, b) => a + Math.round(b * 100), 0);
    const wantedCents  = wantedKnown.reduce((a, b) => a + Math.round(b * 100), 0);
    const diffCents    = offeredCents - wantedCents;
    // Convert back to EUR for display
    const offeredTotal = offeredCents / 100;
    const wantedTotal  = wantedCents  / 100;
    const diff         = diffCents    / 100;
    const hasPartialPrices = offeredKnown.length < offered.length || wantedKnown.length < wanted.length;

    let icon, diffLabel, colorClass;
    if (diffCents === 0) {
        icon = '⚖️';
        diffLabel = 'Intercambio equilibrado';
        colorClass = 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200';
    } else if (diffCents > 0) {
        // Offered side is worth more → person wanting the cards should add cash
        icon = '📤';
        diffLabel = `Quien solicita las cartas debería compensar con <strong>${formatTradePrice(diff)}</strong>`;
        colorClass = 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200';
    } else {
        // Wanted side is worth more → person offering should add cash
        icon = '📥';
        diffLabel = `Quien ofrece las cartas debería compensar con <strong>${formatTradePrice(Math.abs(diff))}</strong>`;
        colorClass = 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200';
    }

    balanceEl.innerHTML = `
        <div class="flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium ${colorClass}">
            <span class="text-base">${icon}</span>
            <span>${diffLabel}</span>
            <span class="ml-auto flex gap-3 text-xs opacity-80 font-normal">
                <span>📤 Ofrecido: <strong>${formatTradePrice(offeredTotal)}</strong></span>
                <span>📥 Buscado: <strong>${formatTradePrice(wantedTotal)}</strong></span>
            </span>
            ${hasPartialPrices ? '<span class="text-xs opacity-60 w-full">(algunos precios no disponibles — balance estimado)</span>' : ''}
        </div>
    `;
}

// ── Precio personalizado por carta ──────────────────────────────────────────

// ── Transferible: marcar/desmarcar carta como disponible para intercambio ──

// Actualiza el estado transferible de una carta en Firestore y en el índice global
window.toggleCardTransferable = async function(cardId, cardName, imageUrl, setName, condition, language, customPrice, currentIsTransferable) {
    if (!currentUser) {
        showNotification('Debes iniciar sesión para marcar cartas como transferibles', 'warning', 3000);
        return;
    }

    const cardRef = doc(db, 'users', currentUser.uid, 'my_cards', cardId);
    const transferRef = doc(db, 'transferable_cards', cardId, 'users', currentUser.uid);

    // Usar el estado pasado como parámetro; si no, intentar desde caché
    const cached = userCardsCache.find(c => c.id === cardId);
    let resolvedCurrent = false;
    if (currentIsTransferable !== undefined) {
        resolvedCurrent = !!currentIsTransferable;
    } else if (cached) {
        resolvedCurrent = !!cached.isTransferable;
    }
    const newValue = !resolvedCurrent;

    // Paso 1: Actualizar la colección personal del usuario (operación crítica)
    try {
        await setDoc(cardRef, { isTransferable: newValue }, { merge: true });
        if (cached) cached.isTransferable = newValue;
    } catch (e) {
        console.error('Error al actualizar carta en colección personal:', e);
        showNotification('Error al actualizar el estado de la carta', 'error', 3000);
        return;
    }

    // Paso 2: Actualizar el índice global de cartas transferibles (no crítico)
    try {
        if (newValue) {
            const userName = await getUserDisplayName();
            await setDoc(transferRef, {
                userId: currentUser.uid,
                userName,
                customPrice: customPrice != null ? customPrice : null,
                condition: condition || 'NM',
                language: language || 'Español',
                cardId,
                cardName,
                imageUrl: imageUrl || '',
                setName: setName || '',
                addedAt: new Date()
            });
            showNotification(`✅ "${cardName}" disponible para intercambio`, 'success', 3000);
        } else {
            await deleteDoc(transferRef);
            showNotification(`🔒 "${cardName}" ya no está disponible para intercambio`, 'info', 3000);
        }
    } catch (e) {
        console.error('No se pudo actualizar el índice global de transferibles:', e);
        if (newValue) {
            showNotification(`⚠️ "${cardName}" marcada localmente, pero no es visible para otros usuarios. Asegúrate de estar conectado.`, 'warning', 5000);
        } else {
            showNotification(`🔒 "${cardName}" desmarcada en tu colección`, 'info', 3000);
        }
    }

    // Paso 3: Re-renderizar la colección visible siempre (independientemente del resultado del índice)
    if (typeof loadMyCollection === 'function' && document.getElementById('myCardsContainer')) {
        loadMyCollection(currentUser.uid);
    }
    if (typeof loadUserCollection === 'function' && document.getElementById('myCardsGrid')) {
        loadUserCollection();
    }
};

// Guardar/actualizar el precio personal de una carta en Firestore y caché
window.updateCardCustomPrice = async function(cardId, price) {
    if (!currentUser) return;
    try {
        const cardRef = doc(db, 'users', currentUser.uid, 'my_cards', cardId);
        const priceValue = price !== '' && price !== null && !isNaN(parseFloat(price))
            ? parseFloat(parseFloat(price).toFixed(2))
            : null;
        await setDoc(cardRef, { customPrice: priceValue }, { merge: true });
        // Update cache
        const cached = userCardsCache.find(c => c.id === cardId);
        if (cached) cached.customPrice = priceValue;
        // Sync price in transferable_cards index if card is transferable
        if (cached && cached.isTransferable) {
            try {
                const transferRef = doc(db, 'transferable_cards', cardId, 'users', currentUser.uid);
                await setDoc(transferRef, { customPrice: priceValue }, { merge: true });
            } catch (_) { /* ignorar errores de sincronización */ }
        }
        showNotification(priceValue !== null ? `Precio personal actualizado: ${formatTradePrice(priceValue)}` : 'Precio personal eliminado', 'success', 3000);
        return priceValue;
    } catch (e) {
        console.error('Error al actualizar precio:', e);
        showNotification('Error al guardar el precio', 'error', 3000);
        return null;
    }
};

// Mostrar modal para editar el precio personal de una carta
window.showEditCustomPriceModal = function(cardId, cardName, currentPrice) {
    const existing = document.getElementById('editCustomPriceModal');
    if (existing) existing.remove();

    const formattedCurrent = currentPrice != null ? parseFloat(currentPrice).toFixed(2) : '';

    const modal = document.createElement('div');
    modal.id = 'editCustomPriceModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">💰 Precio Personal</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${cardName}</p>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Precio (€)</label>
            <input id="customPriceInput" type="number" min="0" step="0.01"
                   value="${formattedCurrent}"
                   placeholder="Ej: 4.50"
                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400 mb-4">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">Este precio aparecerá en tu colección y tendrá preferencia en los intercambios.</p>
            <div class="flex gap-2 justify-end">
                <button onclick="document.getElementById('editCustomPriceModal').remove()"
                        class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm">
                    Cancelar
                </button>
                ${currentPrice != null ? `
                <button onclick="window._saveCustomPrice('${cardId}', '')"
                        class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm">
                    Quitar precio
                </button>` : ''}
                <button onclick="window._saveCustomPrice('${cardId}', document.getElementById('customPriceInput').value)"
                        class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold">
                    Guardar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    setTimeout(() => document.getElementById('customPriceInput')?.focus(), 50);
};

// Helper: save and refresh collection
window._saveCustomPrice = async function(cardId, priceStr) {
    const modal = document.getElementById('editCustomPriceModal');
    if (modal) modal.remove();
    await window.updateCardCustomPrice(cardId, priceStr);
    // Re-render collection if visible
    if (currentUser) {
        if (typeof loadMyCollection === 'function' && document.getElementById('myCardsContainer')) {
            loadMyCollection(currentUser.uid);
        }
        if (document.getElementById('myCardsGrid')) {
            renderMyCards(userCardsCache);
        }
    }
};

// Seleccionar carta de la colección del usuario para un intercambio (mantiene condición/idioma)
window.selectCollectionCardForTrade = function(type, cardIndex, cardId, cardName, cardImage, setName, cardNumber, language, condition) {
    const containerId = type === 'offered' ? 'offeredCardsContainer' : 'wantedCardsContainer';
    const container = document.getElementById(containerId);
    if (!container) return;
    const cardElement = container.querySelectorAll('.trade-card')[cardIndex];
    if (cardElement) {
        const conditionSelect = cardElement.querySelector(`select[name="${type}_condition_${cardIndex}"]`);
        if (conditionSelect) conditionSelect.value = condition || 'NM';
        const languageSelect = cardElement.querySelector(`select[name="${type}_language_${cardIndex}"]`);
        if (languageSelect) {
            for (let i = 0; i < languageSelect.options.length; i++) {
                if (languageSelect.options[i].value === language) {
                    languageSelect.selectedIndex = i;
                    break;
                }
            }
        }
        const fromMyCardsInput = cardElement.querySelector(`input[name="${type}_fromMyCards_${cardIndex}"]`);
        if (fromMyCardsInput) fromMyCardsInput.value = 'true';
        // Propagate customPrice from collection cache
        const cachedCard = userCardsCache.find(c => c.id === cardId);
        const customPriceInput = cardElement.querySelector(`input[name="${type}_customPrice_${cardIndex}"]`);
        if (customPriceInput) customPriceInput.value = (cachedCard?.customPrice != null) ? cachedCard.customPrice : '';
    }
    selectCardForTrade(type, cardIndex, cardId, cardName, cardImage, setName, cardNumber, true);
};

// Variables para migración y sincronización
let dataMigration = null;
let dataSync = null;

// Variable para búsqueda avanzada
let advancedSearch = null;

// Hacer variables disponibles globalmente
window.currentUser = currentUser;
window.userCardsCache = userCardsCache;
window.dataMigration = dataMigration;
window.dataSync = dataSync;
window.advancedSearch = advancedSearch;
let chatManager = null; // Gestor de chat
let chatUI = null; // UI del chat

// Referencias a elementos del DOM
let searchInput, searchResultsSection, heroSection, howItWorksSection, cardsContainer, loadingSpinner, noResultsMessage, errorMessage;
let authModal, loginForm, registerForm, loginEmailInput, loginPasswordInput, loginBtn, loginError;
let registerEmailInput, registerPasswordInput, confirmPasswordInput, registerBtn, registerError;
let closeAuthModalBtn, toggleToRegister, toggleToLogin;
let loginLink, registerLink, profileLink, logoutLink;
let myCardsNavLink, myCardsLink, myCardsSection, myCardsContainer, noMyCardsMessage, myCardsErrorMessage;
let seriesFilter, setFilter, languageFilter, applyFiltersBtn, showAllSetCardsToggle;
let profileSection, profileSidebarLinks, profileGeneralInfo, profileMyCardsTabContent, profileTradeHistory, profileSettings;
let profileEmailDisplay, profileUidDisplay, profileMemberSince, profileLoginRequiredMessage, profileGeneralInfoContent;
let profileNameInput, profileLastNameInput, profileAddressInput, profilePhoneInput, profileSaveMessage, saveProfileBtn;
let settingsNewEmailInput, emailChangeMessage, saveEmailBtn;
let settingsCurrentPasswordInput, settingsNewPasswordInput, settingsConfirmNewPasswordInput, passwordChangeMessage, savePasswordBtn;
let darkModeToggle, interchangesSection, helpSection;

// Token de autenticación inicial (si existe)
const initialAuthToken = null; // Puedes configurar esto si tienes un token personalizado

// --- Funciones de Utilidad ---
function showLoadingSpinner() {
    if (loadingSpinner) loadingSpinner.style.display = 'block';
}

function hideLoadingSpinner() {
    if (loadingSpinner) loadingSpinner.style.display = 'none';
}

// Helper function para ocultar todas las secciones de inicio
function hideHomeSections() {
    if (heroSection) heroSection.classList.add('hidden');
    const howItWorksSection = document.getElementById('howItWorksSection');
    const featuresSection = document.getElementById('featuresSection');
    const ctaSection = document.getElementById('ctaSection');
    if (howItWorksSection) howItWorksSection.classList.add('hidden');
    if (featuresSection) featuresSection.classList.add('hidden');
    if (ctaSection) ctaSection.classList.add('hidden');
}

function showInitialSections() {
    // Mostrar secciones iniciales
    if (heroSection) heroSection.classList.remove('hidden');

    // Mostrar las nuevas secciones de la página de inicio
    const howItWorksSection = document.getElementById('howItWorksSection');
    const featuresSection = document.getElementById('featuresSection');
    const ctaSection = document.getElementById('ctaSection');

    if (howItWorksSection) howItWorksSection.classList.remove('hidden');
    if (featuresSection) featuresSection.classList.remove('hidden');
    if (ctaSection) ctaSection.classList.remove('hidden');

    // Ocultar otras secciones
    if (searchResultsSection) searchResultsSection.classList.add('hidden');
    if (myCardsSection) myCardsSection.classList.add('hidden');
    if (profileSection) profileSection.classList.add('hidden');
    if (interchangesSection) interchangesSection.classList.add('hidden');
    if (helpSection) helpSection.classList.add('hidden');

    // Ocultar también el buzón
    const inboxSection = document.getElementById('inboxSection');
    if (inboxSection) inboxSection.classList.add('hidden');
}

function showSearchResults() {
    // Ocultar secciones iniciales
    hideHomeSections();

    // Ocultar otras secciones
    if (myCardsSection) myCardsSection.classList.add('hidden');
    if (profileSection) profileSection.classList.add('hidden');
    if (interchangesSection) interchangesSection.classList.add('hidden');
    if (helpSection) helpSection.classList.add('hidden');

    // Ocultar también el buzón
    const inboxSection = document.getElementById('inboxSection');
    if (inboxSection) inboxSection.classList.add('hidden');

    // Mostrar resultados de búsqueda
    if (searchResultsSection) searchResultsSection.classList.remove('hidden');
}

function showInboxSection() {
    // Ocultar otras secciones
    hideHomeSections();
    if (searchResultsSection) searchResultsSection.classList.add('hidden');
    if (myCardsSection) myCardsSection.classList.add('hidden');
    if (profileSection) profileSection.classList.add('hidden');
    if (helpSection) helpSection.classList.add('hidden');
    if (interchangesSection) interchangesSection.classList.add('hidden');

    // Mostrar sección del buzón
    const inboxSection = document.getElementById('inboxSection');
    if (inboxSection) {
        inboxSection.classList.remove('hidden');

        // Cargar datos del buzón
        loadInbox();
    }
}

function showMyCardsSection() {
    // Ocultar otras secciones
    hideHomeSections();
    if (searchResultsSection) searchResultsSection.classList.add('hidden');
    if (profileSection) profileSection.classList.add('hidden');
    if (interchangesSection) interchangesSection.classList.add('hidden');
    if (helpSection) helpSection.classList.add('hidden');

    // Ocultar también el buzón
    const inboxSection = document.getElementById('inboxSection');
    if (inboxSection) inboxSection.classList.add('hidden');

    // Mostrar sección de mis cartas
    if (myCardsSection) myCardsSection.classList.remove('hidden');

    // Cargar colección si hay usuario autenticado
    if (currentUser) {
        loadMyCollection(currentUser.uid);
        fetchSetsAndPopulateFilter(); // Cargar sets para filtros
    } else {
        if (noMyCardsMessage) {
            noMyCardsMessage.textContent = 'Debes iniciar sesión para ver tu colección.';
            noMyCardsMessage.classList.remove('hidden');
        }
    }
}

function showInterchangesSection() {
    // Ocultar otras secciones
    hideHomeSections();
    if (searchResultsSection) searchResultsSection.classList.add('hidden');
    if (myCardsSection) myCardsSection.classList.add('hidden');
    if (profileSection) profileSection.classList.add('hidden');
    if (helpSection) helpSection.classList.add('hidden');

    // Ocultar también el buzón
    const inboxSection = document.getElementById('inboxSection');
    if (inboxSection) inboxSection.classList.add('hidden');

    // Mostrar sección de intercambios
    if (interchangesSection) interchangesSection.classList.remove('hidden');

    // Cargar intercambios si hay usuario autenticado
    if (currentUser) {
        loadAvailableTrades();
    } else {
        // Mostrar mensaje de login si no está autenticado
        const interchangesContainer = document.getElementById('interchangesContainer');
        if (interchangesContainer) {
            interchangesContainer.innerHTML = `
                        <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                            <p>Debes iniciar sesión para ver intercambios disponibles</p>
                            <button class="btn-primary mt-4 px-4 py-2 rounded-lg text-sm font-semibold" onclick="showAuthModal('login')">
                                Iniciar Sesión
                            </button>
                        </div>
                    `;
        }
    }
}

function showHelpSection(tabToShow = null) {
    // Ocultar otras secciones
    hideHomeSections();
    if (searchResultsSection) searchResultsSection.classList.add('hidden');
    if (myCardsSection) myCardsSection.classList.add('hidden');
    if (profileSection) profileSection.classList.add('hidden');
    if (interchangesSection) interchangesSection.classList.add('hidden');

    // Ocultar también el buzón
    const inboxSection = document.getElementById('inboxSection');
    if (inboxSection) inboxSection.classList.add('hidden');

    // Mostrar sección de ayuda
    if (helpSection) helpSection.classList.remove('hidden');

    // Inicializar FAQ
    initializeFAQ();

    // Si se especificó una pestaña, cambiar a ella
    if (tabToShow) {
        // Pequeño delay para asegurar que el DOM esté listo
        setTimeout(() => {
            switchHelpTab(tabToShow);
        }, 50);
    }
}


function showProfileSection() {
    console.log('🔍 showProfileSection llamada');

    // IMPORTANTE: NO MOSTRAR MODAL DE LOGIN AQUÍ
    // Esta función SOLO debe mostrar el perfil, nada más

    // Ocultar el modal de autenticación si está abierto
    if (authModal && authModal.classList.contains('show')) {
        console.log('⚠️ Cerrando modal de auth que no debería estar abierto');
        hideAuthModal();
    }

    // Ocultar otras secciones
    hideHomeSections();
    if (searchResultsSection) searchResultsSection.classList.add('hidden');
    if (myCardsSection) myCardsSection.classList.add('hidden');
    if (interchangesSection) interchangesSection.classList.add('hidden');
    if (helpSection) helpSection.classList.add('hidden');

    // Ocultar también el buzón
    const inboxSection = document.getElementById('inboxSection');
    if (inboxSection) inboxSection.classList.add('hidden');

    // Mostrar sección de perfil
    if (profileSection) {
        profileSection.classList.remove('hidden');
        // Cargar datos del usuario y estadísticas
        loadProfileData();
    } else {
        // Si no existe la sección de perfil, mostrar mensaje
        showNotification('Sección de perfil en desarrollo. Por ahora puedes usar "Mis Cartas" para gestionar tu colección.', 'info', 5000);
        showMyCardsSection();
    }
}

// Función para cambiar entre tabs del perfil
function switchProfileTab(tabName) {
    // Ocultar todos los contenidos de tabs
    const tabContents = document.querySelectorAll('.profile-tab-content');
    tabContents.forEach(content => content.classList.add('hidden'));

    // Remover clase active de todos los tabs
    const tabs = document.querySelectorAll('.profile-tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
        tab.classList.remove('border-orange-500', 'text-orange-600');
        tab.classList.add('border-transparent', 'text-gray-500');
    });

    // Mostrar el contenido del tab seleccionado
    let targetContent;
    let targetTab;

    switch (tabName) {
        case 'personal':
            targetContent = document.getElementById('profilePersonalContent');
            targetTab = document.getElementById('profilePersonalTab');
            break;
        case 'dashboard':
            targetContent = document.getElementById('profileDashboardContent');
            targetTab = document.getElementById('profileDashboardTab');
            break;
        case 'collection':
            targetContent = document.getElementById('profileCollectionContent');
            targetTab = document.getElementById('profileCollectionTab');
            break;
        case 'trades':
            targetContent = document.getElementById('profileTradesContent');
            targetTab = document.getElementById('profileTradesTab');
            break;
        case 'settings':
            targetContent = document.getElementById('profileSettingsContent');
            targetTab = document.getElementById('profileSettingsTab');
            break;
        case 'ratings':
            targetContent = document.getElementById('profileRatingsContent');
            targetTab = document.getElementById('profileRatingsTab');
            // Cargar valoraciones al abrir la pestaña
            if (typeof loadRatingsTab === 'function') {
                loadRatingsTab();
            }
            break;
        case 'payments': {
            targetContent = document.getElementById('profilePaymentsContent');
            targetTab = document.getElementById('profilePaymentsTab');
            // Render Stripe Connect banner when the tab is opened
            const bannerEl = document.getElementById('stripeConnectBanner');
            if (bannerEl && window.currentUser) {
                renderConnectAccountBanner(bannerEl, window.currentUser);
            }
            break;
        }
    }

    if (targetContent) {
        targetContent.classList.remove('hidden');
    }

    if (targetTab) {
        targetTab.classList.add('active', 'border-orange-500', 'text-orange-600');
        targetTab.classList.remove('border-transparent', 'text-gray-500');
    }

    // Cargar estadísticas al abrir el Dashboard
    if (tabName === 'dashboard' && typeof loadProfileStats === 'function' && currentUser) {
        try {
            loadProfileStats();
        } catch (e) {
            console.error('Error al cargar estadísticas al abrir Dashboard:', e);
        }
    }

    // Cargar colección al abrir la pestaña Mi Colección
    if (tabName === 'collection' && typeof loadUserCollection === 'function') {
        loadUserCollection();
    }
}

// Función para cambiar entre tabs de ayuda
function switchHelpTab(tabName) {
    // Ocultar todos los contenidos de tabs
    const tabContents = document.querySelectorAll('.help-tab-content');
    tabContents.forEach(content => content.classList.add('hidden'));

    // Remover clase active de todos los tabs
    const tabs = document.querySelectorAll('.help-tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
        tab.classList.remove('border-orange-500', 'text-orange-600');
        tab.classList.add('border-transparent', 'text-gray-500');
    });

    // Mostrar el contenido del tab seleccionado
    let targetContent;
    let targetTab;

    switch (tabName) {
        case 'getting-started':
            targetContent = document.getElementById('helpGettingStartedContent');
            targetTab = document.getElementById('helpGettingStartedTab');
            break;
        case 'trading':
            targetContent = document.getElementById('helpTradingContent');
            targetTab = document.getElementById('helpTradingTab');
            break;
        case 'card-conditions':
            targetContent = document.getElementById('helpCardConditionsContent');
            targetTab = document.getElementById('helpCardConditionsTab');
            break;
        case 'account':
            targetContent = document.getElementById('helpAccountContent');
            targetTab = document.getElementById('helpAccountTab');
            break;
        case 'faq':
            targetContent = document.getElementById('helpFAQContent');
            targetTab = document.getElementById('helpFAQTab');
            break;
        case 'newFeatures':
            targetContent = document.getElementById('helpNewFeaturesContent');
            targetTab = document.getElementById('helpNewFeaturesTab');
            break;
    }

    if (targetContent) {
        targetContent.classList.remove('hidden');
    }

    if (targetTab) {
        targetTab.classList.add('active', 'border-orange-500', 'text-orange-600');
        targetTab.classList.remove('border-transparent', 'text-gray-500');
    }
}

// Función para cambiar entre tabs de intercambios
function switchTradeTab(tabName) {
    // Ocultar todos los contenidos de tabs
    const tabContents = document.querySelectorAll('.trade-tab-content');
    tabContents.forEach(content => content.classList.add('hidden'));

    // Remover clase active de todos los tabs
    const tabs = document.querySelectorAll('.trade-tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
        tab.classList.remove('border-orange-500', 'text-orange-600');
        tab.classList.add('border-transparent', 'text-gray-500');
    });

    // Mostrar el contenido del tab seleccionado
    let targetContent;
    let targetTab;

    switch (tabName) {
        case 'active':
            targetContent = document.getElementById('tradesActiveContent');
            targetTab = document.getElementById('tradesActiveTab');
            break;
        case 'pending':
            targetContent = document.getElementById('tradesPendingContent');
            targetTab = document.getElementById('tradesPendingTab');
            break;
        case 'completed':
            targetContent = document.getElementById('tradesCompletedContent');
            targetTab = document.getElementById('tradesCompletedTab');
            break;
        case 'received':
            targetContent = document.getElementById('tradesReceivedContent');
            targetTab = document.getElementById('tradesReceivedTab');
            break;
    }

    if (targetContent) {
        targetContent.classList.remove('hidden');
    }

    if (targetTab) {
        targetTab.classList.add('active', 'border-orange-500', 'text-orange-600');
        targetTab.classList.remove('border-transparent', 'text-gray-500');
    }
}

// Función para cargar datos del perfil
async function loadProfileData() {
    try {
        console.log('🔄 Cargando datos del perfil...');

        // Cargar información del usuario
        await loadUserInfo();

        // Cargar estadísticas
        await loadProfileStats();

        // Cargar valoraciones del usuario
        loadUserRating();

        console.log('✅ Datos del perfil cargados correctamente');
    } catch (error) {
        console.error('❌ Error al cargar datos del perfil:', error);
    }
}

// Función para mostrar mensajes de estado del perfil
function showProfileSaveMessage(message, type = 'success') {
    const messageElement = document.getElementById('profileSaveMessage');
    if (!messageElement) return;

    const messageText = messageElement.querySelector('p');
    if (messageText) {
        messageText.textContent = message;
    }

    // Aplicar estilos según el tipo
    messageElement.className = 'mt-4 p-3 rounded-lg';
    if (type === 'success') {
        messageElement.classList.add('bg-green-100', 'text-green-700', 'border', 'border-green-200');
    } else if (type === 'error') {
        messageElement.classList.add('bg-red-100', 'text-red-700', 'border', 'border-red-200');
    } else if (type === 'info') {
        messageElement.classList.add('bg-blue-100', 'text-blue-700', 'border', 'border-blue-200');
    }

    messageElement.classList.remove('hidden');

    // Ocultar después de 3 segundos
    setTimeout(() => {
        messageElement.classList.add('hidden');
    }, 3000);
}

// Función para guardar datos del perfil
async function saveProfileData() {
    console.log('🔧 saveProfileData iniciada');

    if (!currentUser) {
        console.error('❌ No hay usuario conectado');
        showProfileSaveMessage('Debes iniciar sesión para guardar cambios', 'error');
        return;
    }

    try {
        console.log('🔧 Obteniendo valores del formulario...');
        const name = document.getElementById('profileName')?.value?.trim();
        const lastName = document.getElementById('profileLastName')?.value?.trim();
        const address = document.getElementById('profileAddress')?.value?.trim();
        const birthDate = document.getElementById('profileBirthDate')?.value;
        const email = document.getElementById('profileEmail')?.value?.trim();

        console.log('🔧 Valores obtenidos:', { name, lastName, address, birthDate, email });

        // Validaciones básicas
        if (!name) {
            console.error('❌ Nombre vacío');
            showProfileSaveMessage('El nombre es obligatorio', 'error');
            return;
        }
        if (!lastName) {
            console.error('❌ Apellidos vacíos');
            showProfileSaveMessage('Los apellidos son obligatorios', 'error');
            return;
        }
        if (!email) {
            console.error('❌ Email vacío');
            showProfileSaveMessage('El correo electrónico es obligatorio', 'error');
            return;
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.error('❌ Formato de email inválido');
            showProfileSaveMessage('El formato del correo electrónico no es válido', 'error');
            return;
        }

        // Preparar datos para guardar
        const profileData = {
            name: name,
            lastName: lastName,
            address: address || '',
            birthDate: birthDate || '',
            email: email,
            updatedAt: new Date()
        };

        console.log('🔧 Datos a guardar:', profileData);
        console.log('🔧 Usuario UID:', currentUser.uid);
        console.log('🔧 Firebase db disponible:', !!db);
        console.log('🔧 Firebase auth disponible:', !!auth);

        // Verificar que Firebase esté inicializado correctamente
        if (!db) {
            throw new Error('Firebase Firestore no está inicializado');
        }

        // Guardar en Firestore
        console.log('🔧 Guardando en Firestore...');
        const userDocRef = doc(db, 'users', currentUser.uid);
        console.log('🔧 Referencia del documento:', userDocRef);

        await setDoc(userDocRef, profileData, { merge: true });
        console.log('✅ Datos guardados en Firestore');

        // Actualizar el nombre en el header del perfil
        const userNameElement = document.getElementById('profileUserName');
        if (userNameElement) {
            userNameElement.textContent = `${name} ${lastName}`;
            console.log('✅ Nombre actualizado en header');
        }

        // Actualizar email en Firebase Auth si ha cambiado
        if (email !== currentUser.email) {
            console.log('🔧 Email ha cambiado, actualizando en Auth...');
            console.log('🔧 Email actual:', currentUser.email);
            console.log('🔧 Email nuevo:', email);

            if (!auth) {
                throw new Error('Firebase Auth no está inicializado');
            }

            try {
                await updateEmail(currentUser, email);
                console.log('✅ Email actualizado en Firebase Auth');
                // Actualizar el objeto currentUser localmente
                currentUser.email = email;
            } catch (authError) {
                console.error('❌ Error al actualizar email en Auth:', authError);
                console.error('❌ Código de error:', authError.code);
                console.error('❌ Mensaje de error:', authError.message);

                if (authError.code === 'auth/requires-recent-login') {
                    showProfileSaveMessage('⚠️ Datos guardados pero el email no se pudo actualizar. Por seguridad, debes volver a iniciar sesión para cambiar el email.', 'info');
                } else {
                    showProfileSaveMessage(`⚠️ Datos guardados pero el email no se pudo actualizar: ${authError.message}`, 'info');
                }
            }
        }

        showProfileSaveMessage('✅ Perfil actualizado correctamente', 'success');
        console.log('✅ Datos del perfil guardados exitosamente');

    } catch (error) {
        console.error('❌ Error al guardar datos del perfil:', error);

        // Manejo específico de errores de permisos
        if (error.code === 'permission-denied') {
            showProfileSaveMessage('❌ Error de permisos. Verifica que las reglas de Firestore estén configuradas correctamente.', 'error');
        } else if (error.code === 'unauthenticated') {
            showProfileSaveMessage('❌ Error de autenticación. Por favor, vuelve a iniciar sesión.', 'error');
        } else {
            showProfileSaveMessage('❌ Error al guardar los cambios: ' + error.message, 'error');
        }
    }
}

// Función para mostrar mensajes de cambio de contraseña
function showPasswordChangeMessage(message, type = 'success') {
    const messageElement = document.getElementById('passwordChangeMessage');
    if (!messageElement) {
        console.error('❌ Elemento passwordChangeMessage no encontrado');
        return;
    }

    const messageText = messageElement.querySelector('p');
    if (messageText) {
        messageText.textContent = message;
    }

    // Limpiar clases anteriores
    messageElement.classList.remove('bg-green-100', 'text-green-700', 'bg-red-100', 'text-red-700', 'bg-blue-100', 'text-blue-700');
    messageElement.classList.remove('hidden');

    // Aplicar clases según el tipo
    if (type === 'success') {
        messageElement.classList.add('bg-green-100', 'text-green-700');
    } else if (type === 'error') {
        messageElement.classList.add('bg-red-100', 'text-red-700');
    } else if (type === 'info') {
        messageElement.classList.add('bg-blue-100', 'text-blue-700');
    }

    // Ocultar después de 5 segundos
    setTimeout(() => {
        messageElement.classList.add('hidden');
    }, 5000);
}



// Función para cambiar contraseña
async function changePassword() {
    console.log('🔧 changePassword iniciada');

    if (!currentUser) {
        console.error('❌ No hay usuario conectado');
        showPasswordChangeMessage('Debes iniciar sesión para cambiar la contraseña', 'error');
        return;
    }

    try {
        console.log('🔧 Obteniendo valores del formulario...');
        const currentPassword = document.getElementById('currentPassword')?.value;
        const newPassword = document.getElementById('newPassword')?.value;
        const confirmNewPassword = document.getElementById('confirmNewPassword')?.value;

        console.log('🔧 Valores obtenidos:', {
            hasCurrentPassword: !!currentPassword,
            hasNewPassword: !!newPassword,
            hasConfirmPassword: !!confirmNewPassword
        });

        // Validaciones
        if (!currentPassword) {
            console.error('❌ Contraseña actual vacía');
            showPasswordChangeMessage('Debes ingresar tu contraseña actual', 'error');
            return;
        }
        if (!newPassword) {
            console.error('❌ Nueva contraseña vacía');
            showPasswordChangeMessage('Debes ingresar una nueva contraseña', 'error');
            return;
        }
        if (newPassword.length < 6) {
            console.error('❌ Nueva contraseña muy corta');
            showPasswordChangeMessage('La nueva contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            console.error('❌ Contraseñas no coinciden');
            showPasswordChangeMessage('Las contraseñas nuevas no coinciden', 'error');
            return;
        }
        if (newPassword === currentPassword) {
            console.error('❌ Nueva contraseña igual a la actual');
            showPasswordChangeMessage('La nueva contraseña debe ser diferente a la actual', 'error');
            return;
        }

        console.log('🔧 Validaciones pasadas, reautenticando...');
        console.log('🔧 Email del usuario:', currentUser.email);
        console.log('🔧 Firebase Auth disponible:', !!auth);

        // Verificar que Firebase Auth esté inicializado
        if (!auth) {
            throw new Error('Firebase Auth no está inicializado');
        }

        // Reautenticar al usuario antes de cambiar la contraseña
        console.log('🔧 Creando credenciales...');
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        console.log('🔧 Credenciales creadas:', !!credential);

        console.log('🔧 Iniciando reautenticación...');
        await reauthenticateWithCredential(currentUser, credential);
        console.log('✅ Reautenticación exitosa');

        // Cambiar la contraseña
        console.log('🔧 Cambiando contraseña...');
        await updatePassword(currentUser, newPassword);
        console.log('✅ Contraseña cambiada exitosamente');

        // Limpiar el formulario
        document.getElementById('passwordChangeForm').reset();
        console.log('✅ Formulario limpiado');

        showPasswordChangeMessage('✅ Contraseña cambiada correctamente', 'success');

    } catch (error) {
        console.error('❌ Error al cambiar contraseña:', error);
        console.error('❌ Tipo de error:', typeof error);
        console.error('❌ Código de error:', error.code);
        console.error('❌ Mensaje de error:', error.message);
        console.error('❌ Stack trace:', error.stack);

        let errorMessage = 'Error al cambiar la contraseña';

        if (error.code === 'auth/wrong-password') {
            errorMessage = 'La contraseña actual es incorrecta';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'La nueva contraseña es demasiado débil';
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = 'Por seguridad, debes volver a iniciar sesión para cambiar la contraseña';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Demasiados intentos. Intenta de nuevo más tarde';
        } else if (error.code === 'auth/user-mismatch') {
            errorMessage = 'Error de autenticación. Por favor, vuelve a iniciar sesión.';
        } else if (error.code === 'auth/invalid-credential') {
            errorMessage = 'Credenciales inválidas. Verifica tu contraseña actual.';
        }

        showPasswordChangeMessage(`❌ ${errorMessage}`, 'error');
    }
}

// Función para cargar información del usuario
async function loadUserInfo() {
    if (!currentUser) return;

    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        let userData = userDoc.data();

        // MIGRACIÓN AUTOMÁTICA: Si el usuario tiene un name pero no username,
        // significa que es un usuario antiguo donde el username estaba en name
        if (userData && userData.name && !userData.username) {
            console.log('🔄 Detectado usuario antiguo, migrando estructura de datos...');

            // Verificar si el name parece ser un username (sin espacios, formato de usuario)
            const nameValue = userData.name;
            const isUsername = !nameValue.includes(' ') && /^[a-zA-Z0-9_]+$/.test(nameValue);

            if (isUsername) {
                // Migrar: mover name a username
                userData.username = nameValue;
                userData.name = ''; // Limpiar el campo name para el nombre real

                // Actualizar en Firestore
                try {
                    await setDoc(doc(db, 'users', currentUser.uid), {
                        username: nameValue,
                        name: ''
                    }, { merge: true });
                    console.log('✅ Datos migrados exitosamente');
                } catch (migrationError) {
                    console.error('Error al migrar datos:', migrationError);
                }
            }
        }

        // Actualizar información del usuario en la UI (header del perfil)
        const userNameElement = document.getElementById('profileUserName');
        const userEmailElement = document.getElementById('profileUserEmail');
        const joinDateElement = document.getElementById('profileJoinDate');

        if (userNameElement) {
            // Mostrar username primero, luego nombre completo si existe
            let displayName = 'Usuario';

            if (userData?.username) {
                displayName = userData.username;
            } else if (userData?.name && userData?.lastName) {
                displayName = `${userData.name} ${userData.lastName}`;
            } else if (userData?.name) {
                displayName = userData.name;
            } else if (userData?.displayName) {
                displayName = userData.displayName;
            } else if (currentUser.displayName) {
                displayName = currentUser.displayName;
            }

            userNameElement.textContent = displayName;
        }

        if (userEmailElement) {
            userEmailElement.textContent = currentUser.email || 'usuario@ejemplo.com';
        }

        if (joinDateElement) {
            const joinDate = userData?.createdAt?.toDate() || currentUser.metadata?.creationTime;
            if (joinDate) {
                const date = new Date(joinDate);
                joinDateElement.textContent = date.toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long'
                });
            }
        }

        // Cargar datos en el formulario de perfil personal
        const profileUsernameInput = document.getElementById('profileUsername');
        const profileNameInput = document.getElementById('profileName');
        const profileLastNameInput = document.getElementById('profileLastName');
        const profileAddressInput = document.getElementById('profileAddress');
        const profileBirthDateInput = document.getElementById('profileBirthDate');
        const profileEmailInput = document.getElementById('profileEmail');

        // Usar los datos ya migrados
        if (profileUsernameInput) profileUsernameInput.value = userData?.username || '';
        if (profileNameInput) profileNameInput.value = userData?.name || '';
        if (profileLastNameInput) profileLastNameInput.value = userData?.lastName || '';
        if (profileAddressInput) profileAddressInput.value = userData?.address || '';
        if (profileBirthDateInput) profileBirthDateInput.value = userData?.birthDate || '';
        if (profileEmailInput) profileEmailInput.value = userData?.email || currentUser.email || '';

        // Cargar preferencia de modo oscuro
        loadDarkModePreference(userData);

        console.log('✅ Información del usuario cargada:', userData);

    } catch (error) {
        console.error('❌ Error al cargar información del usuario:', error);
    }
}

// Función para cargar preferencia de modo oscuro
function loadDarkModePreference(userData) {
    // NO cambiar el modo si no hay preferencia guardada
    if (userData?.darkMode === undefined) {
        console.log('No hay preferencia de modo oscuro guardada, manteniendo estado actual');
        // El estado ya está sincronizado visualmente con las clases CSS
        return;
    }

    const darkMode = userData.darkMode;
    applyDarkMode(darkMode);
}

// Función para aplicar modo oscuro
function applyDarkMode(isDark) {
    const html = document.documentElement;

    if (isDark) {
        html.classList.add('dark');
        document.body.classList.add('dark-mode');
    } else {
        html.classList.remove('dark');
        document.body.classList.remove('dark-mode');
    }

    // Actualizar elementos flotantes
    updateFloatingElementsOpacity();

    // Guardar también en localStorage para persistencia local
    localStorage.setItem('darkMode', isDark ? 'true' : 'false');
}

// Función para guardar preferencia de modo oscuro
async function saveDarkModePreference(isDark) {
    if (!currentUser) return;

    try {
        await setDoc(doc(db, 'users', currentUser.uid), {
            darkMode: isDark,
            updatedAt: new Date()
        }, { merge: true });

        applyDarkMode(isDark);
        console.log('✅ Preferencia de modo oscuro guardada:', isDark);
    } catch (error) {
        console.error('❌ Error al guardar preferencia de modo oscuro:', error);
    }
}

// Hacer funciones disponibles globalmente
window.saveDarkModePreference = saveDarkModePreference;
window.applyDarkMode = applyDarkMode;
window.loadDarkModePreference = loadDarkModePreference;

// Función de prueba para verificar que todo funciona
window.testNavigation = function () {
    console.log('🧪 Probando navegación...');
    console.log('Funciones disponibles:', {
        showInitialSections: typeof showInitialSections,
        showAuthModal: typeof showAuthModal,
        showMyCardsSection: typeof showMyCardsSection,
        showInterchangesSection: typeof showInterchangesSection,
        showProfileSection: typeof showProfileSection,
        logoutUser: typeof logoutUser
    });

    // Probar cada función
    try {
        console.log('✅ Todas las funciones están disponibles');
        return true;
    } catch (error) {
        console.error('❌ Error en las funciones:', error);
        return false;
    }
};

// Función para cargar estadísticas del perfil
async function loadProfileStats() {
    if (!currentUser) return;

    try {
        console.log('📊 Cargando estadísticas del perfil...');

        // Obtener colección del usuario
        const userCardsRef = collection(db, 'users', currentUser.uid, 'my_cards');
        const userCardsSnapshot = await getDocs(userCardsRef);

        const cards = [];
        userCardsSnapshot.forEach(doc => {
            cards.push({ id: doc.id, ...doc.data() });
        });

        // Calcular estadísticas
        // Total de cartas sumando las cantidades
        const totalCards = cards.reduce((total, card) => {
            // Si no tiene quantity o es 0, contar como 1
            const qty = card.quantity > 0 ? card.quantity : 1;
            return total + qty;
        }, 0);

        const uniqueCards = new Set(cards.map(card => card.id)).size;
        const uniqueSets = new Set(cards.map(card => (typeof card.set === 'string' ? card.set : card.set?.name)).filter(Boolean)).size;

        // Por ahora, intercambios completados = 0 (se implementará más adelante)
        const completedTrades = 0;

        // Actualizar UI con las estadísticas
        updateProfileStats(totalCards, uniqueCards, uniqueSets, completedTrades, cards);

        // Cargar desglose por sets
        await loadSetsBreakdown(cards);

    } catch (error) {
        console.error('❌ Error al cargar estadísticas:', error);
    }
}

// --- Constantes de Condiciones de Cartas (CardMarket) ---
const CARD_CONDITIONS = {
    M: {
        code: 'M',
        name: 'Mint (M)',
        description: 'Perfectas condiciones, sin excusas. Carta como recién salida del sobre.',
        color: '#10B981', // Verde
        icon: '💎'
    },
    NM: {
        code: 'NM',
        name: 'Near Mint (NM)',
        description: 'Aspecto de no haber sido jugada sin fundas. Marcas mínimas permitidas.',
        color: '#059669', // Verde oscuro
        icon: '✨'
    },
    EX: {
        code: 'EX',
        name: 'Excellent (EX)',
        description: 'Como si se hubiera usado poco sin fundas. Daño visible pero menor.',
        color: '#3B82F6', // Azul
        icon: '⭐'
    },
    GD: {
        code: 'GD',
        name: 'Good (GD)',
        description: 'Aspecto de mucho uso en torneo sin fundas. Deterioro notable.',
        color: '#F59E0B', // Amarillo
        icon: '🟡'
    },
    LP: {
        code: 'LP',
        name: 'Light Played (LP)',
        description: 'Uso prolongado sin fundas. Válida para torneos con fundas.',
        color: '#F97316', // Naranja
        icon: '🟠'
    },
    PL: {
        code: 'PL',
        name: 'Played (PL)',
        description: 'Aspecto muy deteriorado. Dudoso para torneos incluso con fundas.',
        color: '#DC2626', // Rojo
        icon: '🔴'
    },
    PO: {
        code: 'PO',
        name: 'Poor (PO)',
        description: 'Literalmente destrozada o alterada. No válida para torneos.',
        color: '#7F1D1D', // Rojo oscuro
        icon: '💀'
    }
};

// --- Función de Notificaciones Personalizadas ---
function showNotification(message, type = 'success', duration = 3000) {
    // Remover notificación anterior si existe
    const existingNotification = document.querySelector('.custom-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Crear nueva notificación
    const notification = document.createElement('div');
    notification.className = 'custom-notification fixed top-20 right-4 z-[10000] transform translate-x-full transition-transform duration-300';

    // Estilos según el tipo
    let bgColor, borderColor, iconColor, icon;
    switch (type) {
        case 'success':
            bgColor = 'bg-green-50 dark:bg-green-900/30';
            borderColor = 'border-green-200 dark:border-green-800';
            iconColor = 'text-green-600 dark:text-green-400';
            icon = '✅';
            break;
        case 'error':
            bgColor = 'bg-red-50 dark:bg-red-900/30';
            borderColor = 'border-red-200 dark:border-red-800';
            iconColor = 'text-red-600 dark:text-red-400';
            icon = '❌';
            break;
        case 'warning':
            bgColor = 'bg-yellow-50 dark:bg-yellow-900/30';
            borderColor = 'border-yellow-200 dark:border-yellow-800';
            iconColor = 'text-yellow-600 dark:text-yellow-400';
            icon = '⚠️';
            break;
        case 'info':
            bgColor = 'bg-blue-50 dark:bg-blue-900/30';
            borderColor = 'border-blue-200 dark:border-blue-800';
            iconColor = 'text-blue-600 dark:text-blue-400';
            icon = 'ℹ️';
            break;
    }

    notification.innerHTML = `
                <div class="${bgColor} ${borderColor} border-2 rounded-lg shadow-xl p-4 max-w-sm">
                    <div class="flex items-center gap-3">
                        <span class="${iconColor} text-2xl">${icon}</span>
                        <p class="text-gray-800 dark:text-gray-200 font-medium">${message}</p>
                        <button onclick="this.closest('.custom-notification').remove()" 
                                class="ml-auto text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                            ×
                        </button>
                    </div>
                </div>
            `;

    document.body.appendChild(notification);

    // Animar entrada
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
        notification.classList.add('translate-x-0');
    }, 10);

    // Auto-ocultar después de la duración especificada
    if (duration > 0) {
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

// --- Funciones de Intercambios ---

// Función de búsqueda de cartas para intercambios con debounce
let searchTimeout;
window.searchCardForTrade = async function (input, type, cardIndex) {
    const query = input.value.trim();
    const resultsContainer = input.parentElement.nextElementSibling;

    // Limpiar timeout anterior
    clearTimeout(searchTimeout);

    if (query.length < 2) {
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '';
        return;
    }

    // Mostrar loading
    resultsContainer.innerHTML = `
                <div class="p-3 text-center text-gray-500 dark:text-gray-400">
                    <div class="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                    <span class="ml-2">Buscando...</span>
                </div>
            `;
    resultsContainer.classList.remove('hidden');

    // Para cartas ofrecidas, buscar solo en la colección del usuario
    if (type === 'offered') {
        // Cargar colección si no está en caché
        if (!userCardsCache || userCardsCache.length === 0) {
            if (!currentUser) {
                resultsContainer.innerHTML = `<div class="p-3 text-center text-gray-500 dark:text-gray-400">Inicia sesión para buscar en tu colección</div>`;
                return;
            }
            try {
                const myCardsCollectionRef = collection(db, `users/${currentUser.uid}/my_cards`);
                const querySnapshot = await getDocs(myCardsCollectionRef);
                userCardsCache = [];
                querySnapshot.forEach(doc => {
                    userCardsCache.push({ id: doc.id, ...doc.data() });
                });
            } catch (error) {
                console.error('Error cargando cartas:', error);
                resultsContainer.innerHTML = `<div class="p-3 text-center text-red-500">Error al cargar tu colección</div>`;
                setTimeout(() => resultsContainer.classList.add('hidden'), 3000);
                return;
            }
        }

        if (userCardsCache.length === 0) {
            resultsContainer.innerHTML = `<div class="p-3 text-center text-gray-500 dark:text-gray-400">No tienes cartas en tu colección. Añade cartas primero.</div>`;
            return;
        }

        // Filtrar colección por la búsqueda
        const queryLower = query.toLowerCase();
        const matchingCards = userCardsCache.filter(card =>
            (card.name || '').toLowerCase().includes(queryLower) ||
            (card.set || '').toLowerCase().includes(queryLower)
        ).slice(0, 10);

        const escapeForOnclick = (str) => String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');

        if (matchingCards.length > 0) {
            resultsContainer.innerHTML = matchingCards.map(card => `
                <div class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2 border-b border-gray-200 dark:border-gray-600 last:border-0"
                     onclick="selectCollectionCardForTrade('${type}', ${cardIndex}, '${escapeForOnclick(card.id)}', '${escapeForOnclick(card.name)}', '${escapeForOnclick(card.imageUrl || '')}', '${escapeForOnclick(card.set || '')}', '${escapeForOnclick(card.number || '')}', '${escapeForOnclick(card.language || 'Español')}', '${escapeForOnclick(card.condition || 'NM')}')">
                    ${card.imageUrl ? `<img src="${card.imageUrl}" alt="${card.name}" class="w-10 h-14 object-contain rounded">` : '<div class="w-10 h-14 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded"><span>🎴</span></div>'}
                    <div class="flex-1">
                        <div class="font-medium text-sm text-gray-900 dark:text-white">${card.name || 'Sin nombre'}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">${card.set || 'Set desconocido'} • #${card.number || 'N/A'} • ${CARD_CONDITIONS[card.condition]?.icon || ''} ${card.condition || 'NM'} • ${card.language || 'Español'}</div>
                    </div>
                </div>
            `).join('');
        } else {
            resultsContainer.innerHTML = `<div class="p-3 text-center text-gray-500 dark:text-gray-400">No tienes esta carta en tu colección</div>`;
        }
        return;
    }

    // Para cartas buscadas, buscar en la API completa
    // Debounce de 300ms
    searchTimeout = setTimeout(async () => {
        try {
            // Usar el proxy en lugar de la API directa
            const encodedQuery = encodeURIComponent(query);
            const response = await fetch(`/api/pokemontcg/cards?q=${encodeURIComponent(query)}&pageSize=10`);
            const data = await response.json();

            if (data.data && data.data.length > 0) {
                // Función para escapar caracteres especiales en onclick
                const escapeForOnclick = (str) => {
                    return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
                };

                resultsContainer.innerHTML = data.data.map(card => `
                            <div class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2 border-b border-gray-200 dark:border-gray-600 last:border-0"
                                 onclick="selectCardForTrade('${type}', ${cardIndex}, '${escapeForOnclick(card.id)}', '${escapeForOnclick(card.name)}', '${escapeForOnclick(card.images.small)}', '${escapeForOnclick(card.set?.name || '')}', '${escapeForOnclick(card.number || '')}')">
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
            console.error('Error buscando cartas:', error);
            resultsContainer.innerHTML = `
                        <div class="p-3 text-center text-red-500">
                            Error al buscar cartas. Intenta de nuevo.
                        </div>
                    `;
            // Reintentar con timeout más largo
            setTimeout(() => {
                resultsContainer.classList.add('hidden');
            }, 3000);
        }
    }, 500); // Aumentar debounce a 500ms para evitar demasiadas peticiones
};

// Función para seleccionar una carta del autocompletado
window.selectCardForTrade = function (type, cardIndex, cardId, cardName, cardImage, setName, cardNumber, shouldLock = false) {
    console.log('🎯 selectCardForTrade llamado:', { type, cardIndex, cardName, shouldLock });
    console.log('📍 Llamado desde:', shouldLock ? 'MIS CARTAS' : 'BUSCADOR API');

    // Usar el ID correcto del contenedor
    const containerId = type === 'offered' ? 'offeredCardsContainer' : 'wantedCardsContainer';
    const container = document.getElementById(containerId);

    if (!container) {
        console.error('❌ selectCardForTrade: No se encontró el contenedor:', containerId);
        alert('Error: No se pudo encontrar el contenedor de cartas. Recarga la página.');
        return;
    }

    const cardElement = container.querySelectorAll('.trade-card')[cardIndex];

    if (cardElement) {
        console.log('✅ Elemento de carta encontrado en índice:', cardIndex);

        // Actualizar el input visible
        const nameInput = cardElement.querySelector(`input[name="${type}_name_${cardIndex}"]`);
        if (nameInput) {
            nameInput.value = cardName;

            // Solo bloquear si viene de "Mis Cartas" (shouldLock = true)
            if (shouldLock) {
                nameInput.readOnly = true;
                nameInput.classList.add('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed');
                nameInput.classList.remove('bg-white', 'dark:bg-gray-700');
                console.log('✅ Carta seleccionada desde Mis Cartas y BLOQUEADA:', cardName);

                // Bloquear también los selectores
                const conditionSelect = cardElement.querySelector('select[name*="_condition_"]');
                const languageSelect = cardElement.querySelector('select[name*="_language_"]');
                if (conditionSelect) {
                    conditionSelect.disabled = true;
                    conditionSelect.classList.add('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed');
                }
                if (languageSelect) {
                    languageSelect.disabled = true;
                    languageSelect.classList.add('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed');
                }

                // SOLO desde Mis Cartas: Añadir nueva fila vacía después de bloquear
                setTimeout(() => {
                    addCardToTrade(type);
                }, 100);
            } else {
                // Desde el buscador API - NO bloquear y NO crear nueva línea
                console.log('✅ Carta seleccionada desde buscador (sin bloquear, sin nueva línea):', cardName);
                // NO hacer nada más, solo llenar los datos
            }
        } else {
            console.error('❌ No se encontró el input de nombre');
        }

        // Actualizar los campos ocultos
        const idInput = cardElement.querySelector(`input[name="${type}_id_${cardIndex}"]`);
        const imageInput = cardElement.querySelector(`input[name="${type}_image_${cardIndex}"]`);
        const setInput = cardElement.querySelector(`input[name="${type}_set_${cardIndex}"]`);
        const numberInput = cardElement.querySelector(`input[name="${type}_number_${cardIndex}"]`);

        if (idInput) idInput.value = cardId;
        if (imageInput) imageInput.value = cardImage;
        if (setInput) setInput.value = setName;
        if (numberInput) numberInput.value = cardNumber;

        // Ocultar resultados (solo si existe nameInput)
        if (nameInput && nameInput.parentElement && nameInput.parentElement.nextElementSibling) {
            const resultsContainer = nameInput.parentElement.nextElementSibling;
            resultsContainer.classList.add('hidden');
            resultsContainer.innerHTML = '';
        }

        // Solo mostrar miniatura si viene de "Mis Cartas" (cuando se bloquea)
        if (shouldLock) {
            showCardThumbnail(cardElement, cardImage, cardName);
        }

        // Actualizar título generado
        updateGeneratedTitle();
    }
};

// Función para mostrar miniatura de carta seleccionada
function showCardThumbnail(cardElement, imageUrl, cardName) {
    if (!imageUrl) {
        console.log('⚠️ No hay URL de imagen para mostrar miniatura');
        return;
    }

    // Buscar el input de nombre
    const nameInput = cardElement.querySelector('.card-name-input');
    if (!nameInput) return;

    // Buscar o crear contenedor de miniatura al lado del input
    let thumbnailContainer = cardElement.querySelector('.card-thumbnail-inline');

    if (!thumbnailContainer) {
        // Crear contenedor inline para el icono con hover
        thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'card-thumbnail-inline absolute right-2 top-1/2 -translate-y-1/2 z-10';
        nameInput.parentElement.style.position = 'relative';
        nameInput.parentElement.appendChild(thumbnailContainer);

        // Ajustar padding del input para hacer espacio al icono
        nameInput.style.paddingRight = '2.5rem';
    }

    // Usar un ID único en lugar del índice para evitar problemas
    const uniqueId = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    thumbnailContainer.setAttribute('data-card-id', uniqueId);

    thumbnailContainer.innerHTML = `
                <div class="relative group">
                    <button type="button" 
                            class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                            title="Ver carta">
                        <span class="text-xl">🖼️</span>
                    </button>
                    <!-- Preview on hover - Tamaño grande y centrado -->
                    <div class="fixed inset-0 z-[10000] hidden group-hover:flex items-center justify-center pointer-events-none">
                        <div class="relative">
                            <img src="${imageUrl}" alt="${cardName}" 
                                 class="max-w-[400px] max-h-[560px] w-auto h-auto shadow-2xl rounded-lg border-2 border-white dark:border-gray-700">
                        </div>
                    </div>
                </div>
            `;

    console.log('🖼️ Miniatura mostrada para:', cardName);
}

// Función para limpiar la selección de una carta
window.clearCardSelection = function (type, cardIndex) {
    const containerId = type === 'offered' ? 'offeredCardsContainer' : 'wantedCardsContainer';
    const container = document.getElementById(containerId);
    if (!container) return;

    const cardElement = container.querySelectorAll('.trade-card')[cardIndex];
    if (!cardElement) return;

    // Limpiar el input de nombre y desbloquearlo
    const nameInput = cardElement.querySelector(`input[name="${type}_name_${cardIndex}"]`);
    if (nameInput) {
        nameInput.value = '';
        nameInput.readOnly = false;
        nameInput.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed');
        nameInput.focus();
    }

    // Limpiar campos ocultos
    const idInput = cardElement.querySelector(`input[name="${type}_id_${cardIndex}"]`);
    const imageInput = cardElement.querySelector(`input[name="${type}_image_${cardIndex}"]`);
    const setInput = cardElement.querySelector(`input[name="${type}_set_${cardIndex}"]`);
    const numberInput = cardElement.querySelector(`input[name="${type}_number_${cardIndex}"]`);

    if (idInput) idInput.value = '';
    if (imageInput) imageInput.value = '';
    if (setInput) setInput.value = '';
    if (numberInput) numberInput.value = '';

    // Quitar el icono de miniatura
    const thumbnailContainer = cardElement.querySelector('.card-thumbnail-inline');
    if (thumbnailContainer) {
        thumbnailContainer.remove();
        // Restaurar el padding del input
        const nameInput2 = cardElement.querySelector('.card-name-input');
        if (nameInput2) {
            nameInput2.style.paddingRight = '';
        }
    }

    // Actualizar título generado
    updateGeneratedTitle();
};

// Función para manejar Enter en el input de carta
window.handleCardInputKeypress = function (event, type, cardIndex) {
    if (event.key === 'Enter') {
        event.preventDefault();
        // Por ahora, Enter no hace nada automáticamente
        // El usuario debe hacer click en "Añadir carta"
        console.log('↩️ Enter presionado - usar botón "Añadir carta" para confirmar');
    }
};

// Función para manejar cuando el input pierde el foco
window.handleCardInputBlur = function (input, type, cardIndex) {
    // Por ahora, no hacer nada automáticamente al perder el foco
    // El usuario debe hacer click en "Añadir carta" para confirmar
    console.log('👁️ Input perdió el foco - usar botón "Añadir carta" para confirmar');
};

// Función para añadir cartas desde "Mis Cartas"
window.addFromMyCards = async function (type) {
    if (!currentUser) {
        showNotification('Debes iniciar sesión para acceder a tu colección', 'warning', 4000);
        return;
    }

    // Si no hay cache, cargar las cartas desde Firestore
    if (!userCardsCache || userCardsCache.length === 0) {
        try {
            const myCardsCollectionRef = collection(db, `users/${currentUser.uid}/my_cards`);
            const querySnapshot = await getDocs(myCardsCollectionRef);
            userCardsCache = [];

            querySnapshot.forEach(doc => {
                userCardsCache.push({ id: doc.id, ...doc.data() });
            });
        } catch (error) {
            console.error('Error cargando cartas:', error);
            showNotification('Error al cargar tu colección. Por favor, intenta de nuevo.', 'error', 5000);
            return;
        }
    }

    if (userCardsCache.length === 0) {
        showNotification('No tienes cartas guardadas en tu colección. Ve a "Mis Cartas" para añadir algunas.', 'info', 5000);
        return;
    }

    // Crear modal para seleccionar cartas
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.onclick = function (e) {
        if (e.target === modal) modal.remove();
    };

    // Ordenar cartas por set y número
    const sortedCards = [...userCardsCache].sort((a, b) => {
        if (a.set !== b.set) return (a.set || '').localeCompare(b.set || '');
        return parseInt(a.number || 0) - parseInt(b.number || 0);
    });

    modal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                    <div class="p-4 border-b dark:border-gray-700">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                                Seleccionar de Mis Cartas (${userCardsCache.length} cartas)
                            </h3>
                            <button onclick="this.closest('.fixed').remove()" 
                                    class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl">
                                &times;
                            </button>
                        </div>
                        
                        <!-- Barra de búsqueda -->
                        <div class="flex gap-2">
                            <input type="text" 
                                   id="myCardsSearchInput"
                                   placeholder="Buscar en tu colección..."
                                   class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                                   oninput="filterMyCardsModal(this.value)">
                            
                            <select id="myCardsSetFilter" 
                                    class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                                    onchange="filterMyCardsModal(document.getElementById('myCardsSearchInput').value)">
                                <option value="">Todos los sets</option>
                                ${[...new Set(sortedCards.map(c => c.set))].filter(Boolean).sort().map(set =>
        `<option value="${set}">${set}</option>`
    ).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="p-3 overflow-y-auto flex-1" id="myCardsListContainer">
                        <div class="space-y-1" id="myCardsList">
                            ${sortedCards.map((card, index) => {
        // Función para escapar caracteres especiales
        const escapeForOnclick = (str) => {
            return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
        };

        const safeCardName = escapeForOnclick(card.name);
        const safeImageUrl = escapeForOnclick(card.imageUrl);
        const safeSet = escapeForOnclick(card.set);
        const safeNumber = escapeForOnclick(card.number);

        return `
                                <div class="my-card-row flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
                                     data-card-name="${card.name?.toLowerCase() || ''}"
                                     data-card-set="${card.set?.toLowerCase() || ''}">
                                    
                                    <!-- Icono de imagen con hover -->
                                    <div class="relative group">
                                        <button type="button" 
                                                class="w-8 h-8 bg-gray-100 dark:bg-gray-600 rounded flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                                                title="Ver carta">
                                            <span class="text-lg">🖼️</span>
                                        </button>
                                        
                                        <!-- Vista previa al hover (solo imagen) -->
                                        <div class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] hidden group-hover:block pointer-events-none">
                                            <img src="${card.imageUrl}" 
                                                 alt="${card.name}" 
                                                 class="w-80 h-auto shadow-2xl rounded-lg">
                                        </div>
                                    </div>
                                    
                                    <!-- Información de la carta (más compacta) -->
                                    <div class="flex-1 min-w-0">
                                        <div class="font-medium text-sm text-gray-900 dark:text-white truncate">${card.name || 'Sin nombre'}</div>
                                        <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            ${card.set || 'Set desconocido'} • #${card.number || 'N/A'} • ${card.language || 'Español'} ${card.condition ? `• ${CARD_CONDITIONS[card.condition]?.icon || ''} ${card.condition}` : ''}
                                        </div>
                                    </div>
                                    
                                    <!-- Botón de seleccionar -->
                                    <button onclick="selectFromMyCards('${type}', '${card.id}', '${safeCardName}', '${safeImageUrl}', '${safeSet}', '${safeNumber}', '${card.language || 'Español'}', '${card.condition || 'NM'}'); this.closest('.fixed').remove();"
                                            class="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-medium">
                                        + Añadir
                                    </button>
                                </div>
                                `;
    }).join('')}
                        </div>
                        
                        <!-- Mensaje cuando no hay resultados -->
                        <div id="noResultsMessage" class="hidden text-center py-8 text-gray-500 dark:text-gray-400">
                            No se encontraron cartas que coincidan con tu búsqueda
                        </div>
                    </div>
                </div>
            `;

    document.body.appendChild(modal);
};

// Función para filtrar cartas en el modal
window.filterMyCardsModal = function (searchTerm) {
    const setFilter = document.getElementById('myCardsSetFilter');
    const selectedSet = setFilter ? setFilter.value.toLowerCase() : '';
    const searchLower = searchTerm.toLowerCase();

    const cardRows = document.querySelectorAll('.my-card-row');
    const noResultsMsg = document.getElementById('noResultsMessage');
    let visibleCount = 0;

    cardRows.forEach(row => {
        const cardName = row.dataset.cardName || '';
        const cardSet = row.dataset.cardSet || '';

        const matchesSearch = !searchLower || cardName.includes(searchLower);
        const matchesSet = !selectedSet || cardSet === selectedSet;

        if (matchesSearch && matchesSet) {
            row.style.display = 'flex';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    // Mostrar mensaje si no hay resultados
    if (noResultsMsg) {
        noResultsMsg.classList.toggle('hidden', visibleCount > 0);
    }
};

// Función para seleccionar carta desde "Mis Cartas"
window.selectFromMyCards = function (type, cardId, cardName, cardImage, setName, cardNumber, language = 'Español', condition = 'NM') {
    console.log('📋 selectFromMyCards llamada con:', { type, cardId, cardName, cardImage, setName, cardNumber, language, condition });

    // Obtener el contenedor correcto
    const containerId = type === 'offered' ? 'offeredCardsContainer' : 'wantedCardsContainer';
    const container = document.getElementById(containerId);

    if (!container) {
        console.error('❌ No se encontró el contenedor:', containerId);
        return;
    }

    const cards = container.querySelectorAll('.trade-card');

    // Buscar la primera fila vacía
    let targetCardIndex = -1;
    let cardElement = null;

    for (let i = 0; i < cards.length; i++) {
        const nameInput = cards[i].querySelector(`input[name="${type}_name_${i}"]`);
        if (nameInput && !nameInput.value && !nameInput.readOnly) {
            targetCardIndex = i;
            cardElement = cards[i];
            break;
        }
    }

    // Si no hay filas vacías, añadir una nueva
    if (targetCardIndex === -1) {
        addCardToTrade(type);
        const newCards = container.querySelectorAll('.trade-card');
        targetCardIndex = newCards.length - 1;
        cardElement = newCards[targetCardIndex];
    }

    if (!cardElement) {
        console.error('❌ No se encontró el elemento de carta');
        return;
    }

    // Rellenar los datos de la carta seleccionada
    // Pasar shouldLock = true porque viene de "Mis Cartas"
    selectCardForTrade(type, targetCardIndex, cardId, cardName, cardImage, setName, cardNumber, true);

    // Establecer el idioma de la carta
    const languageSelect = cardElement.querySelector(`select[name="${type}_language_${targetCardIndex}"]`);
    if (languageSelect) {
        console.log('✅ Selector de idioma encontrado, estableciendo:', language);
        // Buscar la opción que coincida con el idioma
        const options = languageSelect.options;
        for (let i = 0; i < options.length; i++) {
            if (options[i].value === language) {
                languageSelect.selectedIndex = i;
                console.log('✅ Idioma establecido en índice:', i);
                break;
            }
        }
    } else {
        console.error('❌ No se encontró el selector de idioma');
    }

    // Establecer la condición de la carta
    const conditionSelect = cardElement.querySelector(`select[name="${type}_condition_${targetCardIndex}"]`);
    if (conditionSelect) {
        console.log('✅ Selector de condición encontrado, estableciendo:', condition);
        conditionSelect.value = condition;
    } else {
        console.error('❌ No se encontró el selector de condición');
    }

    // IMPORTANTE: Marcar que esta carta viene de "Mis Cartas"
    const fromMyCardsInput = cardElement.querySelector(`input[name="${type}_fromMyCards_${targetCardIndex}"]`);
    if (fromMyCardsInput) {
        fromMyCardsInput.value = 'true';
        console.log('✅ Carta marcada como proveniente de "Mis Cartas"');
    }

    // Propagar precio personalizado desde la caché de colección
    const cachedCard = userCardsCache.find(c => c.id === cardId);
    const customPriceInput = cardElement.querySelector(`input[name="${type}_customPrice_${targetCardIndex}"]`);
    if (customPriceInput) customPriceInput.value = (cachedCard?.customPrice != null) ? cachedCard.customPrice : '';

    // Verificar que el nombre se haya establecido correctamente
    const nameInput = cardElement.querySelector(`input[name="${type}_name_${targetCardIndex}"]`);
    if (nameInput) {
        console.log('✅ Nombre establecido:', nameInput.value);
    } else {
        console.error('❌ No se encontró el input de nombre');
    }
};

// Función para contar cuántas personas ofrecen una carta específica
function getCardOffersCount(cardName, cardSet) {
    let offersCount = 0;

    // Debug: log para ver qué carta estamos buscando
    console.log('🔍 Buscando ofertas para:', cardName, 'del set:', cardSet);

    // Buscar en todos los intercambios guardados en localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (key && key.startsWith('userTrades_')) {
            try {
                const trades = JSON.parse(localStorage.getItem(key) || '[]');
                console.log(`📦 Revisando ${trades.length} intercambios en ${key}`);

                // Contar las veces que esta carta aparece en las cartas ofrecidas
                trades.forEach(trade => {
                    if (trade.offeredCards && Array.isArray(trade.offeredCards)) {
                        trade.offeredCards.forEach(offeredCard => {
                            const offeredCardName = offeredCard.name || offeredCard;
                            const offeredCardSet = offeredCard.set || '';

                            console.log(`  - Comparando "${cardName}" (${cardSet}) con "${offeredCardName}" (${offeredCardSet})`);

                            // Comparación exacta de nombre Y set
                            const nameMatch = offeredCardName && offeredCardName.toLowerCase() === cardName.toLowerCase();
                            const setMatch = offeredCardSet && offeredCardSet.toLowerCase() === cardSet.toLowerCase();

                            if (nameMatch && setMatch) {
                                console.log('  ✅ ¡Coincidencia exacta encontrada!');
                                offersCount++;
                            }
                        });
                    }
                });
            } catch (error) {
                console.error('Error al procesar intercambios:', error);
            }
        }
    }

    console.log(`📊 Total de ofertas encontradas para "${cardName}" del set "${cardSet}": ${offersCount}`);
    return offersCount;
}

// Función de debug para ver todos los intercambios
window.debugShowAllTrades = function () {
    console.log('🔍 === MOSTRANDO TODOS LOS INTERCAMBIOS ===');

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (key && key.startsWith('userTrades_')) {
            try {
                const trades = JSON.parse(localStorage.getItem(key) || '[]');
                console.log(`\n📦 Usuario: ${key}`);
                console.log(`Total de intercambios: ${trades.length}`);

                trades.forEach((trade, index) => {
                    console.log(`\n--- Intercambio ${index + 1} ---`);
                    console.log('ID:', trade.id);
                    console.log('Título:', trade.title);
                    console.log('Descripción:', trade.description);
                    console.log('Creado:', trade.createdAt);

                    console.log('\n📤 Cartas Ofrecidas:');
                    if (trade.offeredCards && trade.offeredCards.length > 0) {
                        trade.offeredCards.forEach((card, i) => {
                            if (typeof card === 'object') {
                                console.log(`  ${i + 1}. ${card.name} - Set: ${card.set || 'N/A'} - Condición: ${card.condition || 'N/A'} - Idioma: ${card.language || 'N/A'}`);
                            } else {
                                console.log(`  ${i + 1}. ${card}`);
                            }
                        });
                    } else {
                        console.log('  (Sin cartas ofrecidas)');
                    }

                    console.log('\n📥 Cartas Buscadas:');
                    if (trade.wantedCards && trade.wantedCards.length > 0) {
                        trade.wantedCards.forEach((card, i) => {
                            if (typeof card === 'object') {
                                console.log(`  ${i + 1}. ${card.name} - Set: ${card.set || 'N/A'} - Condición: ${card.condition || 'N/A'} - Idioma: ${card.language || 'N/A'}`);
                            } else {
                                console.log(`  ${i + 1}. ${card}`);
                            }
                        });
                    } else {
                        console.log('  (Sin cartas buscadas)');
                    }

                    console.log('\n------------------------');
                });
            } catch (error) {
                console.error('Error al procesar intercambios:', error);
            }
        }
    }

    console.log('\n🔍 === FIN DE LA LISTA ===');
};

// Función para obtener todos los intercambios que ofrecen una carta específica
function getCardOfferDetails(cardName, cardSet) {
    const offers = [];

    // Buscar en todos los intercambios guardados en localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (key && key.startsWith('userTrades_')) {
            try {
                const trades = JSON.parse(localStorage.getItem(key) || '[]');

                trades.forEach(trade => {
                    if (trade.offeredCards && Array.isArray(trade.offeredCards)) {
                        const hasCard = trade.offeredCards.some(offeredCard => {
                            const offeredCardName = offeredCard.name || offeredCard;
                            const offeredCardSet = offeredCard.set || '';

                            // Comparación exacta de nombre Y set
                            const nameMatch = offeredCardName && offeredCardName.toLowerCase() === cardName.toLowerCase();
                            const setMatch = offeredCardSet && offeredCardSet.toLowerCase() === cardSet.toLowerCase();

                            return nameMatch && setMatch;
                        });

                        if (hasCard) {
                            offers.push({
                                user: trade.user || 'Usuario desconocido',
                                userId: trade.userId || key.replace('userTrades_', ''),
                                title: trade.title,
                                offeredCards: trade.offeredCards,
                                wantedCards: trade.wantedCards,
                                createdAt: trade.createdAt
                            });
                        }
                    }
                });
            } catch (error) {
                console.error('Error al procesar intercambios:', error);
            }
        }
    }

    return offers;
}

// Función para mostrar el modal con las ofertas de una carta
window.showCardOffers = function (cardName, cardSet, cardImageUrl) {
    const offers = getCardOfferDetails(cardName, cardSet);

    if (offers.length === 0) {
        showNotification('No hay ofertas disponibles para esta carta en este momento.', 'info', 4000);
        return;
    }

    // Crear el modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.onclick = function (e) {
        if (e.target === modal) modal.remove();
    };

    let offersHTML = offers.map(offer => `
                <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-600">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h4 class="font-semibold text-gray-800 dark:text-white">${offer.title || 'Intercambio sin título'}</h4>
                            <p class="text-sm text-gray-600 dark:text-gray-400">Por: <span class="font-medium">${offer.user}</span></p>
                        </div>
                        <span class="text-xs text-gray-500 dark:text-gray-400">
                            ${offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('es-ES') : 'Fecha no disponible'}
                        </span>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">📤 Ofrece:</h5>
                            <div class="space-y-1">
                                ${offer.offeredCards.map(card => `
                                    <div class="bg-white dark:bg-gray-600 px-2 py-1 rounded text-xs flex items-center gap-1">
                                        ${card.image ? `<img src="${card.image}" alt="${card.name}" class="w-6 h-8 object-contain">` : ''}
                                        <span class="text-gray-700 dark:text-gray-200">${card.name || card}</span>
                                        ${card.condition ? `<span class="ml-2 text-gray-500 dark:text-gray-400">(${card.condition})</span>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div>
                            <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">📥 Busca:</h5>
                            <div class="space-y-1">
                                ${offer.wantedCards.map(card => `
                                    <div class="bg-white dark:bg-gray-600 px-2 py-1 rounded text-xs flex items-center gap-1">
                                        ${card.image ? `<img src="${card.image}" alt="${card.name}" class="w-6 h-8 object-contain">` : ''}
                                        <span class="text-gray-700 dark:text-gray-200">${card.name || card}</span>
                                        ${card.condition ? `<span class="ml-2 text-gray-500 dark:text-gray-400">(${card.condition})</span>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-3 flex justify-end">
                        <button class="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-sm"
                                onclick="alert('Función de contacto en desarrollo')">
                            💬 Contactar
                        </button>
                    </div>
                </div>
            `).join('');

    modal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                    <div class="p-6 border-b dark:border-gray-700">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <img src="${cardImageUrl}" alt="${cardName}" class="w-16 h-20 object-contain rounded">
                                <div>
                                    <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                                        Ofertas de ${cardName}
                                    </h3>
                                    <p class="text-sm text-gray-600 dark:text-gray-400">
                                        ${offers.length} ${offers.length === 1 ? 'persona ofrece' : 'personas ofrecen'} esta carta
                                    </p>
                                </div>
                            </div>
                            <button onclick="this.closest('.fixed').remove()" 
                                    class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl">
                                &times;
                            </button>
                        </div>
                    </div>
                    
                    <div class="p-6 overflow-y-auto flex-1">
                        ${offersHTML}
                    </div>
                </div>
            `;

    document.body.appendChild(modal);
};

// Función helper para obtener el nombre de usuario para mostrar en intercambios
async function getUserDisplayName(uid = null) {
    try {
        const userId = uid || currentUser?.uid;
        if (!userId) return 'Usuario';

        // Si es el usuario actual y no se proporciona uid
        if (!uid && currentUser) {
            // Primero intentar obtener de Firestore
            if (typeof db !== 'undefined' && db) {
                const userDoc = await getDoc(doc(db, 'users', userId));
                const userData = userDoc.data();

                if (userData) {
                    // PRIORIDAD 1: Username (nombre de usuario único)
                    if (userData.username) {
                        return userData.username;
                    }
                    // PRIORIDAD 2: Nombre completo si no hay username
                    if (userData.name && userData.lastName) {
                        return `${userData.name} ${userData.lastName}`;
                    }
                    // PRIORIDAD 3: Solo nombre
                    if (userData.name) {
                        return userData.name;
                    }
                    // PRIORIDAD 4: DisplayName guardado
                    if (userData.displayName) {
                        return userData.displayName;
                    }
                }
            }

            // Si no hay datos en Firestore, usar displayName de Auth
            if (currentUser.displayName) {
                return currentUser.displayName;
            }

            // Como último recurso, usar parte del email antes del @
            if (currentUser.email) {
                return currentUser.email.split('@')[0];
            }
        }

        return 'Usuario';
    } catch (error) {
        console.error('Error obteniendo nombre de usuario:', error);
        // Si hay error, intentar con el displayName o email del currentUser
        if (currentUser?.displayName) return currentUser.displayName;
        if (currentUser?.email) return currentUser.email.split('@')[0];
        return 'Usuario';
    }
}

// Función para cargar intercambios del usuario
async function loadUserTrades() {
    console.log('🤝 === INICIANDO loadUserTrades ===');
    console.log('👤 currentUser:', currentUser);
    console.log('👤 currentUser?.uid:', currentUser?.uid);

    if (!currentUser) {
        console.log('❌ No hay usuario actual, saliendo de loadUserTrades');
        return;
    }

    try {
        console.log('🤝 Cargando intercambios del usuario...');
        console.log('👤 Usuario actual:', currentUser.uid);

        // Cargar intercambios guardados del usuario ACTUAL (usando su UID)
        const userTradesKey = `userTrades_${currentUser.uid}`;
        const savedTrades = JSON.parse(localStorage.getItem(userTradesKey) || '[]');

        console.log('📦 Intercambios en localStorage:', {
            key: userTradesKey,
            count: savedTrades.length,
            trades: savedTrades.map(t => ({ id: t.id, title: t.title, userId: t.userId }))
        });

        // Usar solo los intercambios guardados reales, sin datos de ejemplo
        let allTrades = [...savedTrades];

        // Convertir fechas de string a Date si es necesario
        allTrades = allTrades.map(trade => ({
            ...trade,
            createdAt: typeof trade.createdAt === 'string' ? new Date(trade.createdAt) : trade.createdAt
        }));

        console.log('🎯 Llamando displayTrades con:', allTrades.length, 'intercambios');

        // Verificar si el contenedor existe
        const container = document.getElementById('myTradesContainer');
        console.log('📱 Contenedor myTradesContainer:', {
            exists: !!container,
            visible: container ? container.offsetParent !== null : false,
            innerHTML: container ? container.innerHTML.substring(0, 100) + '...' : 'N/A'
        });

        if (!container) {
            console.error('❌ Contenedor myTradesContainer no encontrado');
            return;
        }

        displayTrades(allTrades, 'myTradesContainer');

    } catch (error) {
        console.error('❌ Error al cargar intercambios:', error);
    }
}

// Función para cargar intercambios disponibles
async function loadAvailableTrades() {
    if (!currentUser) return;

    try {
        console.log('🎯 Cargando intercambios disponibles...');

        // Cargar TODOS los intercambios de localStorage
        let allAvailableTrades = [];

        // Obtener todas las claves de localStorage que sean de intercambios
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);

            // Si la clave es de intercambios y NO es del usuario actual
            if (key.startsWith('userTrades_') && key !== `userTrades_${currentUser.uid}`) {
                const trades = JSON.parse(localStorage.getItem(key) || '[]');

                // Añadir todos los intercambios de otros usuarios
                trades.forEach(trade => {
                    // Asegurarse de que no se puedan editar intercambios de otros
                    allAvailableTrades.push({
                        ...trade,
                        type: 'available', // Marcar como disponible, no creado
                        userId: key.replace('userTrades_', '') // Extraer el userId de la clave
                    });
                });
            }
        }

        // No mostrar datos de ejemplo, solo intercambios reales

        // Convertir fechas si es necesario
        allAvailableTrades = allAvailableTrades.map(trade => ({
            ...trade,
            createdAt: typeof trade.createdAt === 'string' ? new Date(trade.createdAt) : trade.createdAt
        }));

        displayTrades(allAvailableTrades, 'availableTradesContainer');

    } catch (error) {
        console.error('❌ Error al cargar intercambios disponibles:', error);
    }
}

// Función para mostrar intercambios en un contenedor
function displayTrades(trades, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    console.log('🖼️ displayTrades llamado:', {
        containerId: containerId,
        tradesCount: trades.length,
        trades: trades.map(t => ({ id: t.id, title: t.title, userId: t.userId, type: t.type }))
    });

    if (trades.length === 0) {
        container.innerHTML = `
                    <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                        <p>No hay intercambios disponibles</p>
                    </div>
                `;
        return;
    }

    let tradesHTML = '';
    trades.forEach(trade => {
        // Escapar valores para usar en onclick
        // Función para escapar caracteres especiales
        const escapeForOnclick = (str) => {
            return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
        };

        const escapedTitle = escapeForOnclick(trade.title);
        const escapedUserId = escapeForOnclick(trade.userId);

        // Usar cartas finales si el intercambio fue completado con propuesta aceptada
        const displayOffered = trade.finalOfferedCards || trade.offeredCards;
        const displayWanted = trade.finalWantedCards || trade.wantedCards;
        const isCompleted = trade.status === 'completed';
        const hasProposals = trade.hasProposals || trade.proposalCount > 0;

        tradesHTML += `
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border ${isCompleted ? 'border-green-300 dark:border-green-600' : hasProposals ? 'border-yellow-300 dark:border-yellow-600' : 'border-gray-200 dark:border-gray-600'} hover:border-orange-300 dark:hover:border-orange-400 transition-colors">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h4 class="font-semibold text-gray-800 dark:text-white">${trade.title}</h4>
                                <p class="text-sm text-gray-600 dark:text-gray-300">${trade.description}</p>
                            </div>
                            <div class="flex items-center gap-2">
                                ${isCompleted ? '<span class="text-xs px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full font-medium">✅ Completado</span>' : ''}
                                ${hasProposals && !isCompleted ? `<span class="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full font-medium">📬 ${trade.proposalCount || ''} Propuesta(s)</span>` : ''}
                                <span class="text-xs text-gray-500 dark:text-gray-400">${formatDate(trade.createdAt)}</span>
                            </div>
                        </div>
                        
                        ${isCompleted && trade.finalOfferedCards ? '<div class="text-xs text-green-600 dark:text-green-400 mb-2 font-medium">📋 Cartas acordadas en la propuesta aceptada:</div>' : ''}
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">📤 ${isCompleted && trade.finalOfferedCards ? 'Recibe:' : 'Ofrezco:'}</h5>
                                <div class="space-y-2">
                                    ${displayOffered.map(card => `
                                        <div class="flex items-center justify-between bg-white dark:bg-gray-600 px-3 py-2 rounded border border-gray-200 dark:border-gray-500">
                                            <div class="flex items-center gap-2 flex-1 min-w-0">
                                                ${card.image ? `<img src="${card.image}" alt="${card.name}" class="w-8 h-11 object-contain rounded flex-shrink-0">` : ''}
                                                <div class="flex-1 min-w-0">
                                                    <span class="text-sm text-gray-700 dark:text-gray-200 block truncate">${card.name || card}</span>
                                                    ${card.customPrice != null
                                                        ? `<span class="text-[10px] font-semibold text-orange-600 dark:text-orange-400">💰 ${formatTradePrice(card.customPrice)}</span>`
                                                        : `<div data-card-price data-card-id="${card.id || ''}" data-card-name="${card.name || ''}"></div>`
                                                    }
                                                </div>
                                            </div>
                                            <div class="flex items-center space-x-2 flex-shrink-0">
                                                <span class="text-xs px-2 py-1 rounded-full text-white font-medium" 
                                                      style="background-color: ${CARD_CONDITIONS[card.condition || 'NM'].color}">
                                                    ${CARD_CONDITIONS[card.condition || 'NM'].icon} ${card.condition || 'NM'}
                                                </span>
                                                <span class="text-xs text-gray-500 dark:text-gray-400">${card.language || 'Español'}</span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            <div>
                                <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">📥 ${isCompleted && trade.finalWantedCards ? 'Entrega:' : 'Busco:'}</h5>
                                <div class="space-y-2">
                                    ${displayWanted.map(card => `
                                        <div class="flex items-center justify-between bg-white dark:bg-gray-600 px-3 py-2 rounded border border-gray-200 dark:border-gray-500">
                                            <div class="flex items-center gap-2 flex-1 min-w-0">
                                                ${card.image ? `<img src="${card.image}" alt="${card.name}" class="w-8 h-11 object-contain rounded flex-shrink-0">` : ''}
                                                <div class="flex-1 min-w-0">
                                                    <span class="text-sm text-gray-700 dark:text-gray-200 block truncate">${card.name || card}</span>
                                                    ${card.customPrice != null
                                                        ? `<span class="text-[10px] font-semibold text-orange-600 dark:text-orange-400">💰 ${formatTradePrice(card.customPrice)}</span>`
                                                        : `<div data-card-price data-card-id="${card.id || ''}" data-card-name="${card.name || ''}"></div>`
                                                    }
                                                </div>
                                            </div>
                                            <div class="flex items-center space-x-2 flex-shrink-0">
                                                <span class="text-xs px-2 py-1 rounded-full text-white font-medium" 
                                                      style="background-color: ${CARD_CONDITIONS[card.condition || 'NM'].color}">
                                                    ${CARD_CONDITIONS[card.condition || 'NM'].icon} ${card.condition || 'NM'}
                                                </span>
                                                <span class="text-xs text-gray-500 dark:text-gray-400">${card.language || 'Español'}</span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        
                        <!-- Balance de valor del intercambio -->
                        <div class="mt-3 mb-2" data-trade-balance="${trade.id}">
                            <p class="text-xs text-gray-400 italic text-center">Calculando balance…</p>
                        </div>
                        
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400">Por: ${trade.user}</span>
                            <div class="flex space-x-2">
                                <!-- Botón de chat solo visible si no es tu propio intercambio -->
                                ${trade.userId !== currentUser?.uid ? `
                                    <button class="btn-secondary px-3 py-1 rounded text-xs" data-trade-id="${trade.id}" data-user-id="${escapedUserId}" data-trade-title="${escapedTitle}" onclick="console.log('Chat clicked', window.openTradeChat); if(window.openTradeChat) { window.openTradeChat('${trade.id}', '${escapedUserId}', '${escapedTitle}'); } else { console.error('openTradeChat no está definido'); }">
                                        💭 Chat
                                    </button>
                                ` : `
                                    <span class="text-xs text-gray-400 dark:text-gray-500 italic">
                                        (Tu intercambio)
                                    </span>
                                `}
                                
                                ${trade.userId === currentUser?.uid ? `
                                    ${hasProposals ? `
                                        <button class="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-xs font-semibold" onclick="viewTradeDetails('${trade.id}')">
                                            📬 Ver Propuestas
                                        </button>
                                    ` : ''}
                                    <button class="btn-secondary px-3 py-1 rounded text-xs" onclick="editTrade('${trade.id}')">
                                        ✏️ Editar
                                    </button>
                                    <button class="btn-secondary px-3 py-1 rounded text-xs" onclick="deleteTrade('${trade.id}')">
                                        🗑️ Eliminar
                                    </button>
                                ` : `
                                    <button class="btn-primary px-3 py-1 rounded text-xs" onclick="proposeTrade('${trade.id}')">
                                        💬 Proponer
                                    </button>
                                    <button class="btn-secondary px-3 py-1 rounded text-xs" onclick="viewTradeDetails('${trade.id}')">
                                        👁️ Ver
                                    </button>
                                `}
                            </div>
                        </div>
                    </div>
                `;
    });

    container.innerHTML = tradesHTML;
    loadTradeCardPrices(container);
    // Render balance for each trade asynchronously
    trades.forEach(trade => {
        const balanceEl = container.querySelector(`[data-trade-balance="${trade.id}"]`);
        const displayOffered = trade.finalOfferedCards || trade.offeredCards;
        const displayWanted  = trade.finalWantedCards  || trade.wantedCards;
        renderTradeBalance(balanceEl, displayOffered, displayWanted);
    });
}

// Función para formatear fechas
function formatDate(date) {
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Funciones de acción para intercambios
// Función para encontrar un intercambio por ID
function findTradeById(tradeId) {
    // Primero buscar en los intercambios del usuario actual
    if (currentUser) {
        const userTradesKey = `userTrades_${currentUser.uid}`;
        const userTrades = JSON.parse(localStorage.getItem(userTradesKey) || '[]');
        const userTrade = userTrades.find(trade => trade.id === tradeId);
        if (userTrade) return userTrade;
    }

    // Si no se encuentra, buscar en todos los intercambios disponibles
    // Esto incluye intercambios de otros usuarios
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
        if (key.startsWith('userTrades_')) {
            const trades = JSON.parse(localStorage.getItem(key) || '[]');
            const trade = trades.find(t => t.id === tradeId);
            if (trade) return trade;
        }
    }

    return null;
}

// Función para editar intercambio (abre modal con datos pre-cargados)
function editTrade(tradeId) {
    console.log('🔍 === INICIANDO EDICIÓN ===');
    console.log('✏️ Editando intercambio ID:', tradeId);

    // Verificar localStorage
    const userTradesKey = `userTrades_${currentUser.uid}`;
    const savedTrades = JSON.parse(localStorage.getItem(userTradesKey) || '[]');
    console.log('📦 Intercambios en localStorage:', savedTrades.length);
    console.log('📦 Todos los intercambios:', savedTrades);

    const trade = findTradeById(tradeId);
    console.log('🔍 Intercambio encontrado:', trade);

    if (!trade) {
        console.error('❌ No se encontró el intercambio para editar. ID buscado:', tradeId);
        showNotification('No se encontró el intercambio para editar', 'error', 4000);
        return;
    }

    console.log('📋 Datos completos del intercambio a editar:');
    console.log('- ID:', trade.id);
    console.log('- Título:', trade.title);
    console.log('- Descripción:', trade.description);
    console.log('- Cartas ofrecidas:', trade.offeredCards);
    console.log('- Cartas buscadas:', trade.wantedCards);

    // Abrir modal de crear intercambio con datos pre-cargados
    console.log('🚀 Abriendo modal con datos...');
    showCreateTradeModal(trade);
}

// Función para eliminar intercambio directamente
async function deleteTrade(tradeId) {
    console.log('🗑️ Eliminando intercambio:', tradeId);

    const trade = findTradeById(tradeId);
    if (!trade) {
        showNotification('No se encontró el intercambio para eliminar', 'error', 4000);
        return;
    }

    // Usar modal personalizado en lugar de confirm()
    const confirmed = await showConfirmDeleteModal(trade.title);

    if (confirmed) {
        // Eliminar del localStorage
        const userTradesKey = `userTrades_${currentUser.uid}`;
        let savedTrades = JSON.parse(localStorage.getItem(userTradesKey) || '[]');
        savedTrades = savedTrades.filter(t => t.id !== tradeId);
        localStorage.setItem(userTradesKey, JSON.stringify(savedTrades));

        console.log('✅ Intercambio eliminado exitosamente');

        // Mostrar mensaje de éxito con estilo personalizado
        showSuccessMessage('¡Intercambio eliminado exitosamente! 🗑️');

        // Recargar la lista de intercambios
        loadUserTrades();
    }
}

// Función para abrir chat de intercambio (disponible globalmente)
window.openTradeChat = async function (tradeId, otherUserId, tradeTitle) {
    console.log('🔍 openTradeChat llamado con:', { tradeId, otherUserId, tradeTitle });

    if (!currentUser) {
        showNotification('Debes iniciar sesión para usar el chat', 'warning');
        showAuthModal('login');
        return;
    }

    // Verificar que no estés intentando chatear contigo mismo
    if (otherUserId === currentUser.uid) {
        showNotification('No puedes abrir un chat contigo mismo', 'warning');
        return;
    }

    // Si el chat no está inicializado, intentar inicializarlo
    if (!window.chatManager || !window.chatUI) {
        console.log('⏳ Chat no inicializado, intentando inicializar...');

        // Verificar si las clases están disponibles
        if (typeof ChatManager === 'undefined' || typeof ChatUI === 'undefined') {
            console.error('❌ Clases de chat no disponibles');
            showNotification('Error: El sistema de chat no se cargó correctamente', 'error');
            return;
        }

        // Intentar inicializar
        try {
            window.chatManager = new ChatManager(auth, db);
            window.chatUI = new ChatUI(window.chatManager);
            console.log('✅ Chat inicializado exitosamente');
        } catch (error) {
            console.error('❌ Error al inicializar chat:', error);
            showNotification('Error al inicializar el chat. Por favor, recarga la página.', 'error');
            return;
        }
    }

    try {
        // Normalizar el chatId - si ya tiene el prefijo trade_, no duplicarlo
        let chatId = tradeId;
        if (!tradeId.startsWith('trade_')) {
            chatId = `trade_${tradeId}`;
        }

        // Obtener información del intercambio
        const trade = findTradeById(tradeId);
        let displayName = 'Chat del Intercambio';

        if (trade) {
            // Usar un nombre más descriptivo para el chat
            displayName = `Chat: ${trade.title || 'Intercambio'}`;

            // Si no se proporciona título, usar el título del intercambio
            if (!tradeTitle) {
                tradeTitle = trade.title;
            }
        }

        console.log('📨 Abriendo chat compartido:', { chatId, tradeId, displayName });
        console.log('👤 Usuario actual:', currentUser.uid);

        // Inicializar o unirse al chat del intercambio
        // Extraer el ID real del intercambio (sin el prefijo trade_)
        const realTradeId = tradeId.replace(/^trade_/, '');
        // Obtener nombre del otro usuario si es posible
        let otherUserName = 'Usuario';
        if (trade) {
            if (trade.userId !== currentUser.uid) {
                otherUserName = trade.userName || trade.user || 'Usuario';
            }
        }
        // initializeTradeChat(tradeId, otherUserId, otherUserName) - pasa realTradeId para evitar doble prefijo
        await window.chatManager.initializeTradeChat(realTradeId, otherUserId, otherUserName);

        // Abrir ventana de chat
        await window.chatUI.openChat(chatId);

        // Automáticamente escuchar mensajes para este chat
        if (!window.chatManager.chatListeners.has(chatId)) {
            console.log('🔊 Iniciando escucha de mensajes para:', chatId);
        }

        console.log('✅ Chat abierto exitosamente');
        console.log('💡 Tip: Ejecuta chatDebugger.runFullDiagnostic("' + tradeId + '") en la consola para diagnóstico');

    } catch (error) {
        console.error('❌ Error al abrir chat:', error);
        showNotification('Error al abrir el chat: ' + error.message, 'error');
    }
};

function proposeTrade(tradeId) {
    console.log('💬 Proponiendo intercambio:', tradeId);

    // Buscar el intercambio original
    const originalTrade = findTradeById(tradeId);
    if (!originalTrade) {
        showNotification('No se encontró el intercambio', 'error');
        return;
    }

    // Verificar que el usuario esté logueado
    if (!currentUser) {
        showNotification('Debes iniciar sesión para proponer un intercambio', 'warning');
        return;
    }

    // Verificar que no sea el propio intercambio del usuario
    if (originalTrade.userId === currentUser.uid) {
        showNotification('No puedes proponer en tu propio intercambio', 'warning');
        return;
    }

    // Crear modal de contrapropuesta
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.id = 'proposalModal';

    modal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
                    <!-- Header -->
                    <div class="bg-gradient-to-r from-green-500 to-green-600 dark:from-green-700 dark:to-green-800 p-6">
                        <div class="flex justify-between items-start">
                            <div class="text-white">
                                <h2 class="text-2xl font-bold mb-2">
                                    💬 Proponer Intercambio
                                </h2>
                                <p class="text-sm opacity-90">
                                    Respondiendo a: ${originalTrade.title || 'Intercambio sin título'}
                                </p>
                                <p class="text-xs opacity-75 mt-1">
                                    De: ${originalTrade.userName || originalTrade.user || 'Usuario'}
                                </p>
                            </div>
                            <button onclick="document.getElementById('proposalModal').remove()" 
                                    class="text-white hover:text-gray-200 transition-colors">
                                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Content -->
                    <div class="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
                        <form id="proposalForm" onsubmit="handleProposalSubmit(event, '${tradeId}')">
                            <!-- Información del intercambio original -->
                            <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
                                <h3 class="font-bold text-gray-900 dark:text-white mb-3">
                                    📋 Intercambio Original
                                </h3>
                                <div class="grid md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span class="font-semibold text-gray-700 dark:text-gray-300">Ofrece:</span>
                                        <ul class="mt-1 space-y-1">
                                            ${originalTrade.offeredCards.map(card => `
                                                <li class="text-gray-600 dark:text-gray-400">
                                                    • ${card.name} ${card.condition ? `(${card.condition})` : ''}
                                                </li>
                                            `).join('')}
                                        </ul>
                                    </div>
                                    <div>
                                        <span class="font-semibold text-gray-700 dark:text-gray-300">Busca:</span>
                                        <ul class="mt-1 space-y-1">
                                            ${originalTrade.wantedCards.map(card => `
                                                <li class="text-gray-600 dark:text-gray-400">
                                                    • ${card.name} ${card.condition ? `(${card.condition})` : ''}
                                                </li>
                                            `).join('')}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Tu Contrapropuesta -->
                            <div class="space-y-6">
                                <h3 class="font-bold text-lg text-gray-900 dark:text-white">
                                    ✨ Tu Contrapropuesta
                                </h3>
                                
                                <!-- Cartas que ofreces (lo que el otro busca) -->
                                <div>
                                    <h4 class="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                        <span class="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 p-1 rounded">
                                            📤
                                        </span>
                                        Cartas que Ofreces (respuesta a lo que busca)
                                    </h4>
                                    <div id="proposalOfferedCardsContainer" class="space-y-3">
                                        <!-- Se pre-cargarán las cartas que el otro busca -->
                                    </div>
                                    <div class="flex gap-2 mt-3">
                                        <button type="button" onclick="addCardToProposal('offered')"
                                                class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                                            + Añadir Carta
                                        </button>
                                        <button type="button" onclick="addFromMyCardsToProposal('offered')"
                                                class="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                                            📚 Desde Mis Cartas
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- Cartas que buscas (modificación de lo que ofrece) -->
                                <div>
                                    <h4 class="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                        <span class="bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 p-1 rounded">
                                            📥
                                        </span>
                                        Cartas que Buscas (de lo que ofrece)
                                    </h4>
                                    <div id="proposalWantedCardsContainer" class="space-y-3">
                                        <!-- Se pre-cargarán las cartas que el otro ofrece -->
                                    </div>
                                    <button type="button" onclick="addCardToProposal('wanted')"
                                            class="mt-3 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                                        + Añadir Carta
                                    </button>
                                </div>
                                
                                <!-- Mensaje adicional -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Mensaje (opcional)
                                    </label>
                                    <textarea id="proposalMessage" rows="3"
                                              class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400"
                                              placeholder="Añade un mensaje para explicar tu propuesta..."></textarea>
                                </div>
                            </div>
                            
                            <!-- Botones de acción -->
                            <div class="flex gap-3 justify-end mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                <button type="button" onclick="document.getElementById('proposalModal').remove()"
                                        class="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold">
                                    Cancelar
                                </button>
                                <button type="submit"
                                        class="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold">
                                    Enviar Propuesta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

    document.body.appendChild(modal);

    // Pre-cargar las cartas sugeridas basadas en el intercambio original
    preloadProposalCards(originalTrade);
}

// Función para pre-cargar las cartas en la propuesta
function preloadProposalCards(originalTrade) {
    const offeredContainer = document.getElementById('proposalOfferedCardsContainer');
    const wantedContainer = document.getElementById('proposalWantedCardsContainer');

    console.log('📋 Pre-cargando cartas para propuesta:', originalTrade);

    // Limpiar contenedores antes de pre-cargar (evita duplicados)
    offeredContainer.innerHTML = '';
    wantedContainer.innerHTML = '';

    // Pre-cargar las cartas que el otro busca (para que las ofrezcas)
    originalTrade.wantedCards.forEach((card, index) => {
        console.log('📤 Pre-cargando carta ofrecida:', card);
        const cardHtml = createProposalCardInput('offered', index, card, true);
        offeredContainer.insertAdjacentHTML('beforeend', cardHtml);
    });

    // Pre-cargar las cartas que el otro ofrece (para que las selecciones)
    originalTrade.offeredCards.forEach((card, index) => {
        console.log('📥 Pre-cargando carta buscada:', card);
        const cardHtml = createProposalCardInput('wanted', index, card, true);
        wantedContainer.insertAdjacentHTML('beforeend', cardHtml);
    });
}

// Función para crear un input de carta en la propuesta
function createProposalCardInput(type, index, cardData = {}, isPreloaded = false) {
    const uniqueId = `proposal_${type}_${Date.now()}_${index}`;

    // Asegurar que la condición tenga un valor por defecto
    if (!cardData.condition) {
        cardData.condition = 'NM';
    }

    console.log(`🎴 createProposalCardInput llamado:`, {
        type,
        index,
        cardData,
        isPreloaded,
        hasImage: !!cardData.image,
        imageUrl: cardData.image ? cardData.image.substring(0, 100) : 'NO IMAGE'
    });

    return `
                <div class="proposal-card bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600" data-unique-id="${uniqueId}">
                    <div class="flex items-center gap-3">
                        ${cardData.image ? `
                            <img src="${cardData.image}" 
                                 alt="${cardData.name || 'Carta'}" 
                                 class="w-16 h-20 object-contain rounded proposal-card-image"
                                 loading="lazy"
                                 onerror="console.error('Error loading image:', this.src); this.style.display='none'; this.nextElementSibling.style.display='flex';"
                                 onload="console.log('Image loaded:', this.src);">
                            <div class="w-16 h-20 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center proposal-card-image" style="display:none;">
                                <span class="text-2xl">🎴</span>
                            </div>
                        ` : `
                            <div class="w-16 h-20 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center proposal-card-image">
                                <span class="text-2xl">🎴</span>
                            </div>
                        `}
                        
                        <div class="flex-1 space-y-2">
                            <div class="relative">
                                <input type="text" 
                                       name="${uniqueId}_name"
                                       value="${cardData.name || ''}"
                                       placeholder="Buscar carta..."
                                       ${isPreloaded ? 'readonly' : `oninput="searchProposalCard(this, '${uniqueId}')"`}
                                       class="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${isPreloaded ? 'bg-gray-100 dark:bg-gray-600' : ''} focus:outline-none focus:ring-2 focus:ring-green-400">
                                ${!isPreloaded ? `
                                    <div class="proposal-search-results absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto hidden"></div>
                                ` : ''}
                            </div>
                            
                            <div class="flex gap-2">
                                <select name="${uniqueId}_condition"
                                        ${isPreloaded ? 'disabled' : ''}
                                        class="flex-1 p-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${isPreloaded ? 'bg-gray-100 dark:bg-gray-600' : ''} focus:outline-none focus:ring-2 focus:ring-green-400">
                                    ${Object.entries(CARD_CONDITIONS).map(([key, condition]) => `
                                        <option value="${key}" ${cardData.condition === key ? 'selected' : ''}>
                                            ${condition.icon} ${condition.code}
                                        </option>
                                    `).join('')}
                                </select>
                                
                                <select name="${uniqueId}_language"
                                        ${isPreloaded ? 'disabled' : ''}
                                        class="flex-1 p-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${isPreloaded ? 'bg-gray-100 dark:bg-gray-600' : ''} focus:outline-none focus:ring-2 focus:ring-green-400">
                                    <option value="Español" ${cardData.language === 'Español' ? 'selected' : ''}>Español</option>
                                    <option value="Inglés" ${cardData.language === 'Inglés' ? 'selected' : ''}>Inglés</option>
                                    <option value="Japonés" ${cardData.language === 'Japonés' ? 'selected' : ''}>Japonés</option>
                                    <option value="Francés" ${cardData.language === 'Francés' ? 'selected' : ''}>Francés</option>
                                    <option value="Alemán" ${cardData.language === 'Alemán' ? 'selected' : ''}>Alemán</option>
                                    <option value="Italiano" ${cardData.language === 'Italiano' ? 'selected' : ''}>Italiano</option>
                                    <option value="Portugués" ${cardData.language === 'Portugués' ? 'selected' : ''}>Portugués</option>
                                    <option value="Chino" ${cardData.language === 'Chino' ? 'selected' : ''}>Chino</option>
                                    <option value="Coreano" ${cardData.language === 'Coreano' ? 'selected' : ''}>Coreano</option>
                                </select>
                            </div>
                            
                            <!-- Campos ocultos para datos adicionales -->
                            <input type="hidden" name="${uniqueId}_id" value="${cardData.id || ''}">
                            <input type="hidden" name="${uniqueId}_image" value="${cardData.image || ''}">
                            <input type="hidden" name="${uniqueId}_set" value="${cardData.set || ''}">
                            <input type="hidden" name="${uniqueId}_number" value="${cardData.number || ''}">
                            <input type="hidden" name="${uniqueId}_customPrice" value="${cardData.customPrice != null ? cardData.customPrice : ''}">
                        </div>
                        
                        <button type="button" onclick="this.closest('.proposal-card').remove()"
                                class="text-red-500 hover:text-red-700 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
}

// Función para añadir carta a la propuesta
window.addCardToProposal = function (type) {
    const container = document.getElementById(`proposal${type === 'offered' ? 'Offered' : 'Wanted'}CardsContainer`);
    if (!container) {
        console.error('❌ Container not found:', `proposal${type === 'offered' ? 'Offered' : 'Wanted'}CardsContainer`);
        return;
    }
    const index = container.children.length;
    console.log('➕ Añadiendo carta:', { type, index, currentCards: index });
    const cardHtml = createProposalCardInput(type, index);
    container.insertAdjacentHTML('beforeend', cardHtml);
    console.log('✅ Carta añadida. Total ahora:', container.children.length);
};

// Función para buscar cartas en la API desde el modal de propuesta
let proposalSearchTimeout;
window.searchProposalCard = async function (input, uniqueId) {
    const query = input.value.trim();
    const resultsContainer = input.parentElement.querySelector('.proposal-search-results');

    if (!resultsContainer) return;

    // Limpiar timeout anterior
    clearTimeout(proposalSearchTimeout);

    if (query.length < 2) {
        resultsContainer.classList.add('hidden');
        return;
    }

    // Mostrar loading
    resultsContainer.innerHTML = `
                <div class="p-3 text-center text-gray-500">
                    <div class="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                    <span class="ml-2">Buscando...</span>
                </div>
            `;
    resultsContainer.classList.remove('hidden');

    // Determinar si es una carta ofrecida (solo de la colección del usuario)
    const isOffered = uniqueId.startsWith('proposal_offered_');

    if (isOffered) {
        // Para cartas ofrecidas en propuesta, buscar solo en la colección del usuario
        if (!userCardsCache || userCardsCache.length === 0) {
            if (!currentUser) {
                resultsContainer.innerHTML = `<div class="p-3 text-center text-gray-500 dark:text-gray-400">Inicia sesión para buscar en tu colección</div>`;
                return;
            }
            try {
                const myCardsCollectionRef = collection(db, `users/${currentUser.uid}/my_cards`);
                const querySnapshot = await getDocs(myCardsCollectionRef);
                userCardsCache = [];
                querySnapshot.forEach(doc => {
                    userCardsCache.push({ id: doc.id, ...doc.data() });
                });
            } catch (error) {
                console.error('Error cargando cartas:', error);
                resultsContainer.innerHTML = `<div class="p-3 text-center text-red-500">Error al cargar tu colección</div>`;
                setTimeout(() => resultsContainer.classList.add('hidden'), 3000);
                return;
            }
        }

        if (userCardsCache.length === 0) {
            resultsContainer.innerHTML = `<div class="p-3 text-center text-gray-500 dark:text-gray-400">No tienes cartas en tu colección</div>`;
            return;
        }

        const queryLower = query.toLowerCase();
        const matchingCards = userCardsCache.filter(card =>
            (card.name || '').toLowerCase().includes(queryLower) ||
            (card.set || '').toLowerCase().includes(queryLower)
        ).slice(0, 10);

        const escapeForOnclick = (str) => String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');

        if (matchingCards.length > 0) {
            resultsContainer.innerHTML = matchingCards.map(card => `
                <div class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2 border-b border-gray-200 dark:border-gray-600 last:border-0"
                     onclick="selectProposalCardFromCollection('${uniqueId}', '${escapeForOnclick(card.id)}', '${escapeForOnclick(card.name)}', '${escapeForOnclick(card.imageUrl || '')}', '${escapeForOnclick(card.set || '')}', '${escapeForOnclick(card.number || '')}', '${escapeForOnclick(card.language || 'Español')}', '${escapeForOnclick(card.condition || 'NM')}')">
                    ${card.imageUrl ? `<img src="${card.imageUrl}" alt="${card.name}" class="w-10 h-14 object-contain rounded">` : '<div class="w-10 h-14 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded"><span>🎴</span></div>'}
                    <div class="flex-1">
                        <div class="font-medium text-sm text-gray-900 dark:text-white">${card.name || 'Sin nombre'}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">${card.set || 'Set desconocido'} • #${card.number || 'N/A'} • ${CARD_CONDITIONS[card.condition]?.icon || ''} ${card.condition || 'NM'} • ${card.language || 'Español'}</div>
                    </div>
                </div>
            `).join('');
        } else {
            resultsContainer.innerHTML = `<div class="p-3 text-center text-gray-500 dark:text-gray-400">No tienes esta carta en tu colección</div>`;
        }
        return;
    }

    // Debounce de 500ms
    proposalSearchTimeout = setTimeout(async () => {
        try {
            const encodedQuery = encodeURIComponent(query);
            const response = await fetch(`/api/pokemontcg/cards?q=${encodeURIComponent(query)}&pageSize=10`);
            const data = await response.json();

            if (data.data && data.data.length > 0) {
                // Función para escapar caracteres especiales en onclick
                const escapeForOnclick = (str) => {
                    return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
                };

                resultsContainer.innerHTML = data.data.map(card => `
                            <div class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2 border-b border-gray-200 dark:border-gray-600 last:border-0"
                                 onclick="selectProposalCard('${uniqueId}', '${escapeForOnclick(card.id)}', '${escapeForOnclick(card.name)}', '${escapeForOnclick(card.images.small)}', '${escapeForOnclick(card.set?.name || '')}', '${escapeForOnclick(card.number || '')}')">
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
            console.error('Error buscando cartas:', error);
            resultsContainer.innerHTML = `
                        <div class="p-3 text-center text-red-500">
                            Error al buscar cartas
                        </div>
                    `;
        }
    }, 500);
};

// Función para seleccionar una carta del buscador en propuesta
window.selectProposalCard = function (uniqueId, cardId, cardName, cardImage, setName, cardNumber) {
    const cardElement = document.querySelector(`[data-unique-id="${uniqueId}"]`);
    if (!cardElement) return;

    // Actualizar el input de nombre
    const nameInput = cardElement.querySelector(`input[name="${uniqueId}_name"]`);
    if (nameInput) {
        nameInput.value = cardName;
    }

    // Actualizar campos ocultos
    const idInput = cardElement.querySelector(`input[name="${uniqueId}_id"]`) ||
        (() => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = `${uniqueId}_id`;
            cardElement.appendChild(input);
            return input;
        })();
    idInput.value = cardId;

    const imageInputHidden = cardElement.querySelector(`input[name="${uniqueId}_image"]`) ||
        (() => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = `${uniqueId}_image`;
            cardElement.appendChild(input);
            return input;
        })();
    imageInputHidden.value = cardImage;

    const setInput = cardElement.querySelector(`input[name="${uniqueId}_set"]`) ||
        (() => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = `${uniqueId}_set`;
            cardElement.appendChild(input);
            return input;
        })();
    setInput.value = setName;

    const numberInput = cardElement.querySelector(`input[name="${uniqueId}_number"]`) ||
        (() => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = `${uniqueId}_number`;
            cardElement.appendChild(input);
            return input;
        })();
    numberInput.value = cardNumber;

    // Actualizar la imagen
    const imageContainer = cardElement.querySelector('.proposal-card-image');
    if (imageContainer) {
        if (imageContainer.tagName === 'IMG') {
            imageContainer.src = cardImage;
            imageContainer.alt = cardName;
        } else {
            // Reemplazar el div con una imagen
            const newImg = document.createElement('img');
            newImg.src = cardImage;
            newImg.alt = cardName;
            newImg.className = 'w-16 h-20 object-contain rounded proposal-card-image';
            imageContainer.replaceWith(newImg);
        }
    }

    // Ocultar resultados de búsqueda
    const resultsContainer = nameInput?.parentElement?.querySelector('.proposal-search-results');
    if (resultsContainer) {
        resultsContainer.classList.add('hidden');
    }
};

// Seleccionar carta de la colección del usuario en el modal de propuesta
window.selectProposalCardFromCollection = function (uniqueId, cardId, cardName, cardImage, setName, cardNumber, language, condition) {
    // Llenar los datos de la carta (imagen, nombre, campos ocultos)
    selectProposalCard(uniqueId, cardId, cardName, cardImage, setName, cardNumber);

    const cardElement = document.querySelector(`[data-unique-id="${uniqueId}"]`);
    if (!cardElement) return;

    // Establecer condición e idioma de la carta de la colección
    const conditionSelect = cardElement.querySelector(`select[name="${uniqueId}_condition"]`);
    if (conditionSelect) conditionSelect.value = condition || 'NM';

    const languageSelect = cardElement.querySelector(`select[name="${uniqueId}_language"]`);
    if (languageSelect) {
        for (let i = 0; i < languageSelect.options.length; i++) {
            if (languageSelect.options[i].value === language) {
                languageSelect.selectedIndex = i;
                break;
            }
        }
    }
};

// Función para añadir desde Mis Cartas a la propuesta
window.addFromMyCardsToProposal = async function (type) {
    if (!currentUser) {
        showNotification('Debes iniciar sesión para acceder a tu colección', 'warning', 4000);
        return;
    }

    // Crear modal similar al de addFromMyCards pero para propuesta
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4';
    modal.id = 'proposalCardsModal';

    // Cargar las cartas del usuario
    const cardsRef = collection(db, 'users', currentUser.uid, 'my_cards');
    const snapshot = await getDocs(cardsRef);
    const userCards = [];
    snapshot.forEach(doc => {
        const cardData = doc.data();
        console.log('📦 Carta cargada desde Firebase:', cardData);
        userCards.push({ id: doc.id, ...cardData });
    });

    console.log('📚 Total de cartas cargadas:', userCards.length);
    console.log('🎴 Primera carta (ejemplo):', userCards[0]);

    // Guardar las cartas en el window para acceso fácil
    window.tempProposalCards = userCards;

    modal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                        <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                            📚 Seleccionar desde Mis Cartas
                        </h3>
                    </div>
                    <div class="p-6 overflow-y-auto max-h-[60vh]">
                        ${userCards.length === 0 ? `
                            <p class="text-center text-gray-500 dark:text-gray-400">
                                No tienes cartas en tu colección
                            </p>
                        ` : `
                            <div class="space-y-2">
                                ${userCards.map((card, idx) => {
        const cardImage = card.image || card.imageUrl || card.cardImage || card.imageSmall || '';
        return `
                                    <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600">
                                        ${cardImage ? `
                                            <img src="${cardImage}" alt="${card.name}" class="w-12 h-16 object-contain rounded"
                                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                            <div class="w-12 h-16 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center" style="display:none;">
                                                <span class="text-xl">🎴</span>
                                            </div>
                                        ` : `
                                            <div class="w-12 h-16 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
                                                <span class="text-xl">🎴</span>
                                            </div>
                                        `}
                                        <div class="flex-1">
                                            <div class="font-medium text-sm text-gray-900 dark:text-white">${card.name || 'Sin nombre'}</div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400">
                                                ${card.set || 'Set desconocido'} • ${card.condition || 'NM'} • ${card.language || 'Español'}
                                            </div>
                                        </div>
                                        <button data-card-index="${idx}" 
                                                onclick="handleProposalCardSelection(this, '${type}')"
                                                class="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-semibold">
                                            Seleccionar
                                        </button>
                                    </div>
                                    `;
    }).join('')}
                            </div>
                        `}
                    </div>
                    <div class="p-6 border-t border-gray-200 dark:border-gray-700">
                        <button onclick="this.closest('.fixed').remove()"
                                class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold">
                            Cerrar
                        </button>
                    </div>
                </div>
            `;

    document.body.appendChild(modal);
};

// Nueva función para manejar la selección de cartas
window.handleProposalCardSelection = function (button, type) {
    const cardIndex = parseInt(button.getAttribute('data-card-index'));
    const card = window.tempProposalCards[cardIndex];

    if (!card) {
        console.error('❌ No se encontró la carta en el índice:', cardIndex);
        showNotification('Error al seleccionar la carta', 'error');
        return;
    }

    console.log('🎴 Carta seleccionada:', card);

    // Buscar el campo de imagen correcto
    const imageUrl = card.image || card.imageUrl || card.cardImage || card.imageSmall || '';

    console.log('🖼️ Buscando imagen:', {
        'card.image': card.image,
        'card.imageUrl': card.imageUrl,
        'card.cardImage': card.cardImage,
        'card.imageSmall': card.imageSmall,
        'Imagen final': imageUrl
    });

    // Llamar a la función original con los datos correctos
    selectFromMyCardsToProposal(
        type,
        card.id,
        card.name || '',
        imageUrl,
        card.set || '',
        card.number || '',
        card.language || 'Español',
        card.condition || 'NM'
    );

    // Cerrar el modal
    const modal = document.getElementById('proposalCardsModal');
    if (modal) modal.remove();
};

// Función para seleccionar carta desde Mis Cartas para propuesta
window.selectFromMyCardsToProposal = function (type, cardId, cardName, cardImage, setName, cardNumber, language, condition) {
    console.log('🎴 selectFromMyCardsToProposal - Datos recibidos:', {
        type, cardId, cardName,
        cardImage: cardImage ? cardImage.substring(0, 50) + '...' : 'NO IMAGE',
        setName, cardNumber, language, condition
    });

    const containerId = `proposal${type === 'offered' ? 'Offered' : 'Wanted'}CardsContainer`;
    const container = document.getElementById(containerId);

    if (!container) {
        console.error('❌ No se encontró el contenedor:', containerId);
        showNotification('Error al añadir la carta. Por favor, intenta de nuevo.', 'error');
        return;
    }

    const index = container.children.length;

    // Crear los datos de la carta
    const cachedCard = userCardsCache.find(c => c.id === cardId);
    const cardData = {
        id: cardId,
        name: cardName,
        image: cardImage,
        set: setName,
        number: cardNumber,
        language: language,
        condition: condition,
        fromMyCards: true,
        customPrice: cachedCard?.customPrice ?? null
    };

    console.log('📝 cardData creado:', cardData);

    // Crear el HTML de la carta (bloqueada porque viene de Mis Cartas)
    const cardHtml = createProposalCardInput(type, index, cardData, true);

    // Verificar si el HTML contiene la imagen
    if (cardImage && !cardHtml.includes(cardImage)) {
        console.error('❌ La imagen no está en el HTML generado');
    } else if (cardImage) {
        console.log('✅ Imagen incluida en el HTML');
    }

    container.insertAdjacentHTML('beforeend', cardHtml);

    // Verificar que la imagen se renderizó correctamente
    setTimeout(() => {
        const addedCard = container.lastElementChild;
        if (addedCard) {
            const imgElement = addedCard.querySelector('img.proposal-card-image');
            if (imgElement) {
                console.log('✅ Imagen encontrada en el DOM:', imgElement.src);
                // Verificar si la imagen se está cargando
                imgElement.onerror = function () {
                    console.error('❌ Error al cargar la imagen:', this.src);
                    // Reemplazar con placeholder si falla
                    const placeholder = document.createElement('div');
                    placeholder.className = 'w-16 h-20 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center proposal-card-image';
                    placeholder.innerHTML = '<span class="text-2xl">🎴</span>';
                    this.replaceWith(placeholder);
                };
                imgElement.onload = function () {
                    console.log('✅ Imagen cargada correctamente:', this.src);
                };
            } else {
                console.log('⚠️ No se encontró elemento img en la carta añadida');
            }
        }
    }, 100);

    // Mostrar notificación de éxito
    showNotification('Carta añadida desde tu colección', 'success', 2000);
};

// Función para manejar el envío de la propuesta
window.handleProposalSubmit = function (event, originalTradeId) {
    event.preventDefault();

    if (!currentUser) {
        showNotification('Debes iniciar sesión para enviar una propuesta', 'warning');
        return;
    }

    // Obtener el intercambio original
    const allTrades = [];
    // Buscar en todos los usuarios
    const userKeys = Object.keys(localStorage).filter(key => key.startsWith('userTrades_'));
    userKeys.forEach(key => {
        const trades = JSON.parse(localStorage.getItem(key) || '[]');
        trades.forEach(trade => {
            allTrades.push({ ...trade, ownerKey: key });
        });
    });

    const originalTradeData = allTrades.find(t => t.id === originalTradeId);

    // Recopilar datos de la propuesta
    const proposalData = {
        id: 'proposal_' + Date.now(),
        originalTradeId: originalTradeId,
        fromUserId: currentUser.uid,
        fromUserName: localStorage.getItem(`username_${currentUser.uid}`) || currentUser.email.split('@')[0],
        message: document.getElementById('proposalMessage')?.value || '',
        offeredCards: [],
        wantedCards: [],
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    // Recopilar cartas ofrecidas
    const offeredContainer = document.getElementById('proposalOfferedCardsContainer');
    Array.from(offeredContainer.children).forEach(cardEl => {
        const inputs = cardEl.querySelectorAll('input, select');
        const cardData = {};
        inputs.forEach(input => {
            const name = input.name;
            if (name) {
                const field = name.split('_').pop();
                cardData[field] = input.value;
            }
        });
        if (cardData.name && cardData.name.trim()) {
            if ('customPrice' in cardData) {
                cardData.customPrice = cardData.customPrice !== '' && !isNaN(parseFloat(cardData.customPrice)) ? parseFloat(cardData.customPrice) : null;
            }
            proposalData.offeredCards.push(cardData);
        }
    });

    // Recopilar cartas buscadas
    const wantedContainer = document.getElementById('proposalWantedCardsContainer');
    Array.from(wantedContainer.children).forEach(cardEl => {
        const inputs = cardEl.querySelectorAll('input, select');
        const cardData = {};
        inputs.forEach(input => {
            const name = input.name;
            if (name) {
                const field = name.split('_').pop();
                cardData[field] = input.value;
            }
        });
        if (cardData.name && cardData.name.trim()) {
            if ('customPrice' in cardData) {
                cardData.customPrice = cardData.customPrice !== '' && !isNaN(parseFloat(cardData.customPrice)) ? parseFloat(cardData.customPrice) : null;
            }
            proposalData.wantedCards.push(cardData);
        }
    });

    // Validar que haya al menos una carta en cada lado
    if (proposalData.offeredCards.length === 0 || proposalData.wantedCards.length === 0) {
        showNotification('Debes incluir al menos una carta en cada lado de la propuesta', 'warning');
        return;
    }

    // Actualizar el intercambio original SOLO con metadata (no modificar cartas)
    if (originalTradeData) {
        // Marcar que tiene propuestas
        originalTradeData.hasProposals = true;
        originalTradeData.proposalCount = (originalTradeData.proposalCount || 0) + 1;
        originalTradeData.lastProposalAt = new Date().toISOString();

        // Guardar el intercambio actualizado
        const ownerKey = originalTradeData.ownerKey;
        const ownerTrades = JSON.parse(localStorage.getItem(ownerKey) || '[]');
        const tradeIndex = ownerTrades.findIndex(t => t.id === originalTradeId);
        if (tradeIndex !== -1) {
            // Limpiar ownerKey antes de guardar (no debe filtrarse al trade)
            const cleanTrade = { ...originalTradeData };
            delete cleanTrade.ownerKey;
            ownerTrades[tradeIndex] = cleanTrade;
            localStorage.setItem(ownerKey, JSON.stringify(ownerTrades));
        }

        // Crear notificación para el dueño del intercambio
        const ownerId = ownerKey.replace('userTrades_', '');
        const notification = {
            id: `notif_${Date.now()}`,
            type: 'proposal',
            title: '📬 Nueva propuesta recibida',
            message: `${proposalData.fromUserName} ha enviado una propuesta para tu intercambio "${originalTradeData.title}"`,
            tradeId: originalTradeId,
            proposalId: proposalData.id,
            from: proposalData.fromUserName,
            timestamp: new Date().toISOString(),
            read: false
        };

        // Guardar notificación
        const notificationsKey = `notifications_${ownerId}`;
        const notifications = JSON.parse(localStorage.getItem(notificationsKey) || '[]');
        notifications.unshift(notification);
        localStorage.setItem(notificationsKey, JSON.stringify(notifications));

        // Actualizar badge si es el usuario actual
        if (ownerId === currentUser.uid) {
            updateNotificationBadge();
        }
    }

    // Guardar la propuesta
    const proposalsKey = `proposals_${originalTradeId}`;
    const existingProposals = JSON.parse(localStorage.getItem(proposalsKey) || '[]');
    existingProposals.push(proposalData);
    localStorage.setItem(proposalsKey, JSON.stringify(existingProposals));

    console.log('💾 Debug handleProposalSubmit:');
    console.log('- Proposal saved with key:', proposalsKey);
    console.log('- Proposal data:', proposalData);
    console.log('- All proposals in key:', existingProposals);

    // Cerrar modal y mostrar confirmación
    document.getElementById('proposalModal').remove();
    showNotification('✅ Propuesta enviada con éxito! El usuario será notificado.', 'success', 5000);

    // Actualizar la vista de intercambios si está visible
    if (document.getElementById('availableTradesContainer')) {
        loadAvailableTrades();
    }
};

// Función para actualizar el contador de notificaciones
function updateNotificationBadge() {
    if (!currentUser) {
        const badge = document.getElementById('notificationBadge');
        if (badge) badge.classList.add('hidden');
        return;
    }

    const notificationsKey = `notifications_${currentUser.uid}`;
    const notifications = JSON.parse(localStorage.getItem(notificationsKey) || '[]');
    const unreadCount = notifications.filter(n => !n.read).length;

    const badge = document.getElementById('notificationBadge');
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

// Función para cargar el Buzón
function loadInbox() {
    if (!currentUser) {
        const container = document.getElementById('notificationsList');
        if (container) {
            container.innerHTML = `
                        <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                            <p>Debes iniciar sesión para ver tu buzón</p>
                        </div>
                    `;
        }
        return;
    }

    // Cargar notificaciones
    loadNotifications();

    // Cargar propuestas recibidas
    loadReceivedProposals();

    // Cargar propuestas enviadas
    loadSentProposals();
}

// Función para cargar notificaciones
function loadNotifications() {
    if (!currentUser) return;

    const notificationsKey = `notifications_${currentUser.uid}`;
    const notifications = JSON.parse(localStorage.getItem(notificationsKey) || '[]');

    const container = document.getElementById('notificationsList');
    if (!container) return;

    if (notifications.length === 0) {
        container.innerHTML = `
                    <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                        <span class="text-4xl">📭</span>
                        <p class="mt-2">No tienes notificaciones</p>
                    </div>
                `;
        return;
    }

    container.innerHTML = notifications.map(notif => `
                <div class="notification-item bg-gray-50 dark:bg-gray-700 rounded-lg p-4 ${!notif.read ? 'border-l-4 border-purple-500' : ''}">
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <h4 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                ${notif.title}
                                ${!notif.read ? '<span class="bg-purple-500 text-white text-xs px-2 py-1 rounded-full">Nuevo</span>' : ''}
                            </h4>
                            <p class="text-gray-600 dark:text-gray-300 mt-1">${notif.message}</p>
                            <div class="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                                <span>De: ${notif.from}</span>
                                <span>${formatRelativeTime(notif.timestamp)}</span>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            ${notif.proposalId && notif.tradeId ? `
                                <button onclick="viewProposalDetails('${notif.proposalId}', '${notif.tradeId}')"
                                        class="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm">
                                    Ver Propuesta
                                </button>
                            ` : ''}
                            ${notif.tradeId ? `
                                <button onclick="viewTradeDetails('${notif.tradeId}')"
                                        class="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm">
                                    Ver Intercambio
                                </button>
                            ` : ''}
                            ${!notif.read ? `
                                <button onclick="markNotificationAsRead('${notif.id}')"
                                        class="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm">
                                    Marcar como leído
                                </button>
                            ` : ''}
                            <button onclick="deleteNotification('${notif.id}')"
                                    class="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                                    title="Eliminar notificación">
                                ✕
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
}

// Función para cargar propuestas recibidas
function loadReceivedProposals() {
    if (!currentUser) return;

    const container = document.getElementById('receivedProposalsList');
    if (!container) return;

    const receivedProposals = [];

    // Buscar propuestas en todos los intercambios del usuario
    const userTrades = JSON.parse(localStorage.getItem(`userTrades_${currentUser.uid}`) || '[]');

    userTrades.forEach(trade => {
        const proposalsKey = `proposals_${trade.id}`;
        const proposals = JSON.parse(localStorage.getItem(proposalsKey) || '[]');
        proposals.forEach(proposal => {
            receivedProposals.push({
                ...proposal,
                tradeName: trade.title,
                tradeId: trade.id
            });
        });
    });

    if (receivedProposals.length === 0) {
        container.innerHTML = `
                    <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                        <span class="text-4xl">📭</span>
                        <p class="mt-2">No has recibido propuestas</p>
                    </div>
                `;
        return;
    }

    container.innerHTML = receivedProposals.map(proposal => `
                <div class="proposal-item bg-white dark:bg-gray-700 rounded-lg shadow p-4">
                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <h4 class="font-semibold text-gray-900 dark:text-white">
                                Propuesta para: ${proposal.tradeName}
                            </h4>
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                De: ${proposal.fromUserName} • ${formatRelativeTime(proposal.createdAt)}
                            </p>
                        </div>
                        <span class="px-2 py-1 text-xs rounded-full ${proposal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            proposal.status === 'accepted' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
        }">
                            ${proposal.status === 'pending' ? 'Pendiente' :
            proposal.status === 'accepted' ? 'Aceptada' : 'Rechazada'}
                        </span>
                    </div>
                    
                    <div class="grid md:grid-cols-2 gap-4 mb-3">
                        <div>
                            <h5 class="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Te ofrece:</h5>
                            <ul class="space-y-1">
                                ${proposal.offeredCards.map(card => `
                                    <li class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                        ${card.image ? `<img src="${card.image}" class="w-8 h-10 object-contain rounded">` : '🎴'}
                                        ${card.name} (${card.condition || 'NM'})
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        <div>
                            <h5 class="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Busca:</h5>
                            <ul class="space-y-1">
                                ${proposal.wantedCards.map(card => `
                                    <li class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                        ${card.image ? `<img src="${card.image}" class="w-8 h-10 object-contain rounded">` : '🎴'}
                                        ${card.name} (${card.condition || 'NM'})
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                    
                    ${proposal.message ? `
                        <div class="bg-gray-50 dark:bg-gray-800 rounded p-3 mb-3">
                            <p class="text-sm text-gray-600 dark:text-gray-300">"${proposal.message}"</p>
                        </div>
                    ` : ''}
                    
                    <div class="flex gap-2">
                        <button onclick="viewProposalDetails('${proposal.id}', '${proposal.tradeId}')"
                                class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm">
                            Ver Detalles
                        </button>
                        ${proposal.status === 'pending' ? `
                            <button onclick="acceptProposal('${proposal.id}', '${proposal.tradeId}')"
                                    class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded text-sm">
                                Aceptar
                            </button>
                            <button onclick="rejectProposal('${proposal.id}', '${proposal.tradeId}')"
                                    class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm">
                                Rechazar
                            </button>
                        ` : ''}
                        <button onclick="deleteReceivedProposal('${proposal.id}', '${proposal.tradeId}')"
                                class="px-2 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm"
                                title="Eliminar propuesta">
                            ✕
                        </button>
                    </div>
                </div>
            `).join('');
}

// Función para cargar propuestas enviadas
function loadSentProposals() {
    if (!currentUser) return;

    const container = document.getElementById('sentProposalsList');
    if (!container) return;

    const sentProposals = [];

    // Buscar todas las propuestas enviadas por el usuario
    const proposalKeys = Object.keys(localStorage).filter(key => key.startsWith('proposals_'));

    console.log('🔍 Debug loadSentProposals:');
    console.log('- Current user ID:', currentUser.uid);
    console.log('- Proposal keys found:', proposalKeys);

    proposalKeys.forEach(key => {
        const proposals = JSON.parse(localStorage.getItem(key) || '[]');
        console.log(`- Key ${key}:`, proposals);
        const userProposals = proposals.filter(p => p.fromUserId === currentUser.uid);
        console.log(`- User proposals in ${key}:`, userProposals);
        userProposals.forEach(proposal => {
            sentProposals.push(proposal);
        });
    });

    console.log('- Total sent proposals found:', sentProposals);

    if (sentProposals.length === 0) {
        container.innerHTML = `
                    <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                        <span class="text-4xl">📭</span>
                        <p class="mt-2">No has enviado propuestas</p>
                    </div>
                `;
        return;
    }

    container.innerHTML = sentProposals.map(proposal => `
                <div class="proposal-item bg-white dark:bg-gray-700 rounded-lg shadow p-4">
                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <h4 class="font-semibold text-gray-900 dark:text-white">
                                Propuesta enviada
                            </h4>
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                ${formatRelativeTime(proposal.createdAt)}
                            </p>
                        </div>
                        <span class="px-2 py-1 text-xs rounded-full ${proposal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            proposal.status === 'accepted' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
        }">
                            ${proposal.status === 'pending' ? 'Pendiente' :
            proposal.status === 'accepted' ? 'Aceptada' : 'Rechazada'}
                        </span>
                    </div>
                    
                    <div class="grid md:grid-cols-2 gap-4 mb-3">
                        <div>
                            <h5 class="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Ofreces:</h5>
                            <ul class="space-y-1">
                                ${proposal.offeredCards.map(card => `
                                    <li class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                        ${card.image ? `<img src="${card.image}" class="w-8 h-10 object-contain rounded">` : '🎴'}
                                        ${card.name} (${card.condition || 'NM'})
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        <div>
                            <h5 class="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Buscas:</h5>
                            <ul class="space-y-1">
                                ${proposal.wantedCards.map(card => `
                                    <li class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                        ${card.image ? `<img src="${card.image}" class="w-8 h-10 object-contain rounded">` : '🎴'}
                                        ${card.name} (${card.condition || 'NM'})
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                    
                    <div class="flex gap-2">
                        ${proposal.status === 'pending' ? `
                            <button onclick="cancelProposal('${proposal.id}', '${proposal.originalTradeId}')"
                                    class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm">
                                Cancelar Propuesta
                            </button>
                        ` : ''}
                        <button onclick="deleteSentProposal('${proposal.id}', '${proposal.originalTradeId}')"
                                class="px-2 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm"
                                title="Eliminar propuesta">
                            ✕
                        </button>
                    </div>
                </div>
            `).join('');
}

// Función para formatear tiempo relativo
function formatRelativeTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `hace ${days} día${days > 1 ? 's' : ''}`;
    if (hours > 0) return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    return 'hace unos segundos';
}

// Función para marcar notificación como leída
window.markNotificationAsRead = function (notifId) {
    if (!currentUser) return;

    const notificationsKey = `notifications_${currentUser.uid}`;
    const notifications = JSON.parse(localStorage.getItem(notificationsKey) || '[]');

    const notif = notifications.find(n => n.id === notifId);
    if (notif) {
        notif.read = true;
        localStorage.setItem(notificationsKey, JSON.stringify(notifications));
        loadNotifications();
        updateNotificationBadge();
    }
};

// Función para eliminar notificación
window.deleteNotification = async function (notifId) {
    if (!currentUser) return;

    // Buscar la notificación para mostrar su título
    const notificationsKey = `notifications_${currentUser.uid}`;
    const notifications = JSON.parse(localStorage.getItem(notificationsKey) || '[]');
    const notif = notifications.find(n => n.id === notifId);

    // Confirmar eliminación con modal personalizado
    const confirmed = await showCustomConfirmModal(
        '¿Eliminar notificación?',
        'Esta acción no se puede deshacer.',
        notif ? notif.title : 'Notificación',
        'delete'
    );

    if (!confirmed) return;

    // Filtrar la notificación a eliminar
    const updatedNotifications = notifications.filter(n => n.id !== notifId);
    localStorage.setItem(notificationsKey, JSON.stringify(updatedNotifications));

    // Recargar la lista de notificaciones
    loadNotifications();
    updateNotificationBadge();

    // Mostrar confirmación
    showNotification('Notificación eliminada', 'success', 2000);
};

// Función para eliminar propuesta recibida
window.deleteReceivedProposal = async function (proposalId, tradeId) {
    if (!currentUser) return;

    // Buscar la propuesta para mostrar información
    const proposalsKey = `proposals_${tradeId}`;
    const proposals = JSON.parse(localStorage.getItem(proposalsKey) || '[]');
    const proposal = proposals.find(p => p.id === proposalId);

    // Confirmar eliminación con modal personalizado
    const confirmed = await showCustomConfirmModal(
        '¿Eliminar propuesta recibida?',
        'Esta acción no se puede deshacer.',
        proposal ? `Propuesta de ${proposal.fromUserName}` : 'Propuesta recibida',
        'delete'
    );

    if (!confirmed) return;

    // Filtrar la propuesta a eliminar
    const updatedProposals = proposals.filter(p => p.id !== proposalId);
    localStorage.setItem(proposalsKey, JSON.stringify(updatedProposals));

    // Recargar la lista de propuestas recibidas
    loadReceivedProposals();

    // Mostrar confirmación
    showNotification('Propuesta recibida eliminada', 'success', 2000);
};

// Función para eliminar propuesta enviada
window.deleteSentProposal = async function (proposalId, tradeId) {
    if (!currentUser) return;

    // Buscar la propuesta para mostrar información
    const proposalsKey = `proposals_${tradeId}`;
    const proposals = JSON.parse(localStorage.getItem(proposalsKey) || '[]');
    const proposal = proposals.find(p => p.id === proposalId);

    // Confirmar eliminación con modal personalizado
    const confirmed = await showCustomConfirmModal(
        '¿Eliminar propuesta enviada?',
        'Esta acción no se puede deshacer.',
        proposal ? `Propuesta enviada` : 'Propuesta enviada',
        'delete'
    );

    if (!confirmed) return;

    // Filtrar la propuesta a eliminar
    const updatedProposals = proposals.filter(p => p.id !== proposalId);
    localStorage.setItem(proposalsKey, JSON.stringify(updatedProposals));

    // Recargar la lista de propuestas enviadas
    loadSentProposals();

    // Mostrar confirmación
    showNotification('Propuesta enviada eliminada', 'success', 2000);
};

// Función para rechazar propuesta
window.rejectProposal = function (proposalId, tradeId) {
    if (!currentUser) return;

    // Buscar la propuesta
    const proposalsKey = `proposals_${tradeId}`;
    const proposals = JSON.parse(localStorage.getItem(proposalsKey) || '[]');
    const proposal = proposals.find(p => p.id === proposalId);

    if (proposal) {
        // Actualizar estado de la propuesta
        proposal.status = 'rejected';
        proposal.rejectedAt = new Date().toISOString();
        localStorage.setItem(proposalsKey, JSON.stringify(proposals));

        // Crear notificación para el usuario que envió la propuesta
        const notification = {
            id: `notif_${Date.now()}`,
            type: 'proposal_rejected',
            title: '❌ Propuesta rechazada',
            message: `Tu propuesta para el intercambio ha sido rechazada`,
            tradeId: tradeId,
            proposalId: proposalId,
            from: localStorage.getItem(`username_${currentUser.uid}`) || currentUser.email.split('@')[0],
            timestamp: new Date().toISOString(),
            read: false
        };

        // Guardar notificación para el proponente
        const proponentNotificationsKey = `notifications_${proposal.fromUserId}`;
        const proponentNotifications = JSON.parse(localStorage.getItem(proponentNotificationsKey) || '[]');
        proponentNotifications.unshift(notification);
        localStorage.setItem(proponentNotificationsKey, JSON.stringify(proponentNotifications));

        // Mostrar confirmación
        showNotification('Propuesta rechazada. El usuario ha sido notificado.', 'info', 3000);

        // Recargar la lista de propuestas
        loadReceivedProposals();
    }
};

// Función para aceptar propuesta
window.acceptProposal = function (proposalId, tradeId) {
    if (!currentUser) return;

    // Buscar la propuesta
    const proposalsKey = `proposals_${tradeId}`;
    const proposals = JSON.parse(localStorage.getItem(proposalsKey) || '[]');
    const proposal = proposals.find(p => p.id === proposalId);

    if (proposal) {
        // Actualizar estado de la propuesta
        proposal.status = 'accepted';
        proposal.acceptedAt = new Date().toISOString();
        localStorage.setItem(proposalsKey, JSON.stringify(proposals));

        // Crear notificación para el usuario que envió la propuesta
        const notification = {
            id: `notif_${Date.now()}`,
            type: 'proposal_accepted',
            title: '✅ Propuesta aceptada',
            message: `Tu propuesta para el intercambio ha sido aceptada. ¡Es hora de valorar el intercambio!`,
            tradeId: tradeId,
            proposalId: proposalId,
            from: localStorage.getItem(`username_${currentUser.uid}`) || currentUser.email.split('@')[0],
            timestamp: new Date().toISOString(),
            read: false
        };

        // Guardar notificación para el proponente
        const proponentNotificationsKey = `notifications_${proposal.fromUserId}`;
        const proponentNotifications = JSON.parse(localStorage.getItem(proponentNotificationsKey) || '[]');
        proponentNotifications.unshift(notification);
        localStorage.setItem(proponentNotificationsKey, JSON.stringify(proponentNotifications));

        // Marcar el intercambio como completado Y actualizar cartas con las de la propuesta
        const userKeys = Object.keys(localStorage).filter(key => key.startsWith('userTrades_'));
        userKeys.forEach(key => {
            const trades = JSON.parse(localStorage.getItem(key) || '[]');
            const tradeIndex = trades.findIndex(t => t.id === tradeId);
            if (tradeIndex !== -1) {
                trades[tradeIndex].status = 'completed';
                trades[tradeIndex].completedAt = new Date().toISOString();
                trades[tradeIndex].completedWith = proposal.fromUserId;
                // Actualizar las cartas del intercambio con las de la propuesta aceptada
                trades[tradeIndex].finalOfferedCards = proposal.offeredCards;
                trades[tradeIndex].finalWantedCards = proposal.wantedCards;
                trades[tradeIndex].acceptedProposalId = proposalId;
                // Limpiar ownerKey si se filtró
                delete trades[tradeIndex].ownerKey;
                localStorage.setItem(key, JSON.stringify(trades));
            }
        });

        // Mostrar modal de valoración para ambos usuarios
        setTimeout(() => {
            showRatingModal(proposal.fromUserId, proposal.fromUserName, tradeId);
        }, 500);

        showNotification('✅ Propuesta aceptada. ¡Ahora puedes valorar el intercambio!', 'success', 4000);

        // Recargar la lista de propuestas
        loadReceivedProposals();
    }
};

// Función para ver detalles de propuesta
window.viewProposalDetails = function (proposalId, tradeId) {
    if (!currentUser) return;

    // Buscar la propuesta
    const proposalsKey = `proposals_${tradeId}`;
    const proposals = JSON.parse(localStorage.getItem(proposalsKey) || '[]');
    const proposal = proposals.find(p => p.id === proposalId);

    if (!proposal) {
        showNotification('No se encontró la propuesta', 'error');
        return;
    }

    // Buscar el intercambio original
    const allTrades = [];
    const userKeys = Object.keys(localStorage).filter(key => key.startsWith('userTrades_'));
    userKeys.forEach(key => {
        const trades = JSON.parse(localStorage.getItem(key) || '[]');
        trades.forEach(trade => {
            allTrades.push(trade);
        });
    });

    const originalTrade = allTrades.find(t => t.id === tradeId);

    // Crear modal similar al de viewTradeDetails pero con datos de la propuesta
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';

    // Usar función compartida para generar cartas
    const generateCardHTML = generateTradeCardHTML;

    modal.innerHTML = `
                <div class="bg-white dark:bg-gray-900 rounded-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
                    <!-- Header con gradiente -->
                    <div class="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
                        <div class="flex justify-between items-start">
                            <div>
                                <h2 class="text-2xl font-bold mb-2">📋 Detalles de la Propuesta</h2>
                                <div class="flex items-center gap-4 text-purple-100">
                                    <span class="flex items-center gap-1">
                                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
                                        </svg>
                                        Propuesta de: ${proposal.fromUserName}
                                    </span>
                                    <span class="flex items-center gap-1">
                                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                                            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                                        </svg>
                                        ${formatRelativeTime(proposal.createdAt)}
                                    </span>
                                </div>
                            </div>
                            <button onclick="this.closest('.fixed').remove()" 
                                    class="text-white hover:text-purple-200 transition-colors">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Contenido scrolleable -->
                    <div class="overflow-y-auto max-h-[calc(90vh-120px)] bg-gray-50 dark:bg-gray-800">
                        <div class="p-8">
                            ${originalTrade ? `
                                <!-- Intercambio Original -->
                                <div class="mb-8 p-6 bg-white dark:bg-gray-900 rounded-xl shadow-sm">
                                    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <span class="text-2xl">📦</span>
                                        Intercambio Original: ${originalTrade.title}
                                    </h3>
                                <div class="grid md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span class="font-semibold text-gray-700 dark:text-gray-300">Ofrece:</span>
                                        <ul class="mt-1 space-y-1">
                                            ${originalTrade.offeredCards.map(card => `
                                                <li class="text-gray-600 dark:text-gray-400">
                                                    • ${card.name} ${card.condition ? `(${card.condition})` : ''}
                                                </li>
                                            `).join('')}
                                        </ul>
                                    </div>
                                    <div>
                                        <span class="font-semibold text-gray-700 dark:text-gray-300">Busca:</span>
                                        <ul class="mt-1 space-y-1">
                                            ${originalTrade.wantedCards.map(card => `
                                                <li class="text-gray-600 dark:text-gray-400">
                                                    • ${card.name} ${card.condition ? `(${card.condition})` : ''}
                                                </li>
                                            `).join('')}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        
                        <!-- Propuesta con layout horizontal -->
                        <div class="flex flex-col lg:flex-row items-start justify-center gap-8">
                            <!-- Cartas que ofrece el proponente -->
                            <div class="flex-1 w-full">
                                <div class="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
                                    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <span class="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 p-2 rounded-lg">
                                            📤
                                        </span>
                                        ${proposal.fromUserName} Ofrece
                                    </h3>
                                    <div class="${getTradeCardGridClass(proposal.offeredCards.length)} gap-4">
                                        ${generateCardHTML(proposal.offeredCards)}
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Separador visual con icono de intercambio -->
                            <div class="flex items-center justify-center lg:pt-20">
                                <div class="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-4 rounded-full shadow-lg">
                                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                                    </svg>
                                </div>
                            </div>
                            
                            <!-- Cartas que busca el proponente -->
                            <div class="flex-1 w-full">
                                <div class="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
                                    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <span class="bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 p-2 rounded-lg">
                                            📥
                                        </span>
                                        ${proposal.fromUserName} Busca
                                    </h3>
                                    <div class="${getTradeCardGridClass(proposal.wantedCards.length)} gap-4">
                                        ${generateCardHTML(proposal.wantedCards)}
                                    </div>
                                </div>
                            </div>
                        </div>
                            
                            ${proposal.message ? `
                                <!-- Mensaje del proponente -->
                                <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <h4 class="font-semibold text-gray-900 dark:text-white mb-2">💬 Mensaje:</h4>
                                    <p class="text-gray-700 dark:text-gray-300">${proposal.message}</p>
                                </div>
                            ` : ''}
                            
                            <!-- Botones de acción -->
                            ${proposal.status === 'pending' && originalTrade && originalTrade.userId === currentUser.uid ? `
                                <div class="flex gap-3 justify-center mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                    <button onclick="acceptProposal('${proposalId}', '${tradeId}'); this.closest('.fixed').remove();"
                                            class="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold">
                                        ✅ Aceptar Propuesta
                                    </button>
                                    <button onclick="rejectProposal('${proposalId}', '${tradeId}'); this.closest('.fixed').remove();"
                                            class="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold">
                                        ❌ Rechazar Propuesta
                                    </button>
                                    <button onclick="this.closest('.fixed').remove()"
                                            class="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold">
                                        Cerrar
                                    </button>
                                </div>
                            ` : `
                                <div class="flex justify-center mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                    <button onclick="this.closest('.fixed').remove()"
                                            class="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold">
                                        Cerrar
                                    </button>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;

    document.body.appendChild(modal);
};

// Función para cancelar propuesta enviada
window.cancelProposal = function (proposalId, tradeId) {
    if (!currentUser) return;

    // Buscar la propuesta
    const proposalsKey = `proposals_${tradeId}`;
    const proposals = JSON.parse(localStorage.getItem(proposalsKey) || '[]');
    const proposalIndex = proposals.findIndex(p => p.id === proposalId);

    if (proposalIndex !== -1) {
        // Eliminar la propuesta
        proposals.splice(proposalIndex, 1);
        localStorage.setItem(proposalsKey, JSON.stringify(proposals));

        showNotification('Propuesta cancelada', 'success', 3000);

        // Recargar la lista de propuestas enviadas
        loadSentProposals();
    }
};

// Sistema de valoración con Pokéballs
const POKEBALL_RATINGS = {
    0: {
        name: 'Sin valorar',
        icon: '⚪',
        color: 'gray',
        emoji: '⚪'
    },
    1: {
        name: 'Premier Ball',
        icon: '⚪',
        color: 'white',
        emoji: '⚪',
        image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/premier-ball.png'
    },
    2: {
        name: 'Poké Ball',
        icon: '🔴',
        color: 'red',
        emoji: '🔴',
        image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'
    },
    3: {
        name: 'Great Ball',
        icon: '🔵',
        color: 'blue',
        emoji: '🔵',
        image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png'
    },
    4: {
        name: 'Ultra Ball',
        icon: '⚫',
        color: 'black',
        emoji: '⚫',
        image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png'
    },
    5: {
        name: 'Master Ball',
        icon: '🟣',
        color: 'purple',
        emoji: '🟣',
        image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png'
    }
};

// Función para mostrar el modal de valoración
function showRatingModal(userId, userName, tradeId) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.id = 'ratingModal';

    let selectedRating = 0;

    modal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
                    <div class="text-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            🎉 ¡Intercambio Completado!
                        </h2>
                        <p class="text-gray-600 dark:text-gray-300">
                            ¿Cómo fue tu experiencia con <strong>${userName}</strong>?
                        </p>
                    </div>
                    
                    <!-- Sistema de Pokéballs -->
                    <div class="mb-6">
                        <div class="flex justify-center gap-3 mb-4" id="pokeballRating">
                            ${[1, 2, 3, 4, 5].map(rating => `
                                <button onclick="selectRating(${rating})" 
                                        class="pokeball-rating transform transition-all hover:scale-125 p-2"
                                        data-rating="${rating}"
                                        title="${POKEBALL_RATINGS[rating].name}">
                                    <img src="${POKEBALL_RATINGS[rating].image}" 
                                         alt="${POKEBALL_RATINGS[rating].name}"
                                         class="w-12 h-12 opacity-30 grayscale transition-all pokeball-img">
                                </button>
                            `).join('')}
                        </div>
                        <p class="text-center text-sm text-gray-500 dark:text-gray-400" id="ratingText">
                            Selecciona una valoración
                        </p>
                    </div>
                    
                    <!-- Comentario opcional -->
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Comentario (opcional)
                        </label>
                        <textarea id="ratingComment" 
                                  rows="3" 
                                  class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                                  placeholder="Comparte tu experiencia..."></textarea>
                    </div>
                    
                    <!-- Botones -->
                    <div class="flex gap-3">
                        <button onclick="submitRating('${userId}', '${userName}', '${tradeId}')"
                                id="submitRatingBtn"
                                disabled
                                class="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors">
                            Enviar Valoración
                        </button>
                        <button onclick="document.getElementById('ratingModal').remove()"
                                class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold">
                            Omitir
                        </button>
                    </div>
                </div>
            `;

    document.body.appendChild(modal);
}

// Función para seleccionar rating
window.selectRating = function (rating) {
    // Actualizar visual de las Pokéballs
    const pokeballs = document.querySelectorAll('.pokeball-rating');
    pokeballs.forEach((ball, index) => {
        const ballRating = index + 1;
        const img = ball.querySelector('img');

        if (ballRating <= rating) {
            // Pokéball seleccionada
            img.classList.remove('opacity-30', 'grayscale');
            img.classList.add('opacity-100');

            // Añadir animación de rebote
            ball.classList.add('animate-bounce');
            setTimeout(() => ball.classList.remove('animate-bounce'), 500);
        } else {
            // Pokéball no seleccionada
            img.classList.add('opacity-30', 'grayscale');
            img.classList.remove('opacity-100');
        }
    });

    // Actualizar texto con imagen
    const ratingText = document.getElementById('ratingText');
    ratingText.innerHTML = `
                <div class="flex items-center justify-center gap-2">
                    <span class="font-semibold">${POKEBALL_RATINGS[rating].name}</span>
                    <img src="${POKEBALL_RATINGS[rating].image}" 
                         alt="${POKEBALL_RATINGS[rating].name}"
                         class="w-6 h-6 inline-block">
                </div>
            `;

    // Habilitar botón de enviar
    const submitBtn = document.getElementById('submitRatingBtn');
    submitBtn.disabled = false;
    submitBtn.setAttribute('data-rating', rating);
};

// Función para enviar valoración
window.submitRating = function (userId, userName, tradeId) {
    const submitBtn = document.getElementById('submitRatingBtn');
    const rating = parseInt(submitBtn.getAttribute('data-rating'));
    const comment = document.getElementById('ratingComment').value;

    if (!rating) {
        showNotification('Por favor selecciona una valoración', 'warning');
        return;
    }

    // Crear objeto de valoración
    const ratingData = {
        id: `rating_${Date.now()}`,
        fromUserId: currentUser.uid,
        fromUserName: localStorage.getItem(`username_${currentUser.uid}`) || currentUser.email.split('@')[0],
        toUserId: userId,
        toUserName: userName,
        rating: rating,
        ratingName: POKEBALL_RATINGS[rating].name,
        comment: comment,
        tradeId: tradeId,
        timestamp: new Date().toISOString()
    };

    // Guardar valoración
    const ratingsKey = `ratings_${userId}`;
    const userRatings = JSON.parse(localStorage.getItem(ratingsKey) || '[]');
    userRatings.push(ratingData);
    localStorage.setItem(ratingsKey, JSON.stringify(userRatings));

    // Actualizar promedio de valoración del usuario
    updateUserRatingAverage(userId);

    // Crear notificación para el usuario valorado
    const notification = {
        id: `notif_${Date.now()}`,
        type: 'new_rating',
        title: `${POKEBALL_RATINGS[rating].emoji} Nueva valoración recibida`,
        message: `${ratingData.fromUserName} te ha valorado con ${rating} ${rating === 1 ? 'Pokéball' : 'Pokéballs'}`,
        rating: rating,
        from: ratingData.fromUserName,
        timestamp: new Date().toISOString(),
        read: false
    };

    const notificationsKey = `notifications_${userId}`;
    const notifications = JSON.parse(localStorage.getItem(notificationsKey) || '[]');
    notifications.unshift(notification);
    localStorage.setItem(notificationsKey, JSON.stringify(notifications));

    // Cerrar modal y mostrar confirmación
    document.getElementById('ratingModal').remove();
    showNotification(`✅ Valoración enviada: ${rating} ${POKEBALL_RATINGS[rating].emoji}`, 'success', 3000);
};

// Función para actualizar el promedio de valoración
function updateUserRatingAverage(userId) {
    const ratingsKey = `ratings_${userId}`;
    const userRatings = JSON.parse(localStorage.getItem(ratingsKey) || '[]');

    if (userRatings.length === 0) return;

    // Calcular promedio
    const totalRating = userRatings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / userRatings.length;

    // Guardar promedio
    const userStatsKey = `userStats_${userId}`;
    const userStats = JSON.parse(localStorage.getItem(userStatsKey) || '{}');
    userStats.averageRating = averageRating;
    userStats.totalRatings = userRatings.length;
    userStats.lastUpdated = new Date().toISOString();

    localStorage.setItem(userStatsKey, JSON.stringify(userStats));
}

// Función para mostrar valoración con Pokéballs
window.displayPokeballRating = function (rating, showNumber = false, size = 'small') {
    const fullBalls = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;

    // Determinar tamaño de las imágenes
    const sizeClasses = {
        'small': 'w-5 h-5',
        'medium': 'w-6 h-6',
        'large': 'w-8 h-8'
    };
    const imgSize = sizeClasses[size] || sizeClasses['small'];

    let display = '<div class="inline-flex items-center gap-1">';

    // Mostrar Pokéballs llenas
    for (let i = 1; i <= fullBalls; i++) {
        display += `
                    <img src="${POKEBALL_RATINGS[i].image}" 
                         alt="${POKEBALL_RATINGS[i].name}"
                         title="${POKEBALL_RATINGS[i].name}"
                         class="${imgSize} inline-block">
                `;
    }

    // Mostrar media Pokéball si aplica
    if (hasHalf && fullBalls < 5) {
        display += `
                    <img src="${POKEBALL_RATINGS[fullBalls + 1].image}" 
                         alt="${POKEBALL_RATINGS[fullBalls + 1].name}"
                         title="${POKEBALL_RATINGS[fullBalls + 1].name}"
                         class="${imgSize} inline-block opacity-50">
                `;
    }

    // Mostrar Pokéballs vacías (usar Premier Ball con muy baja opacidad)
    const emptyCount = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyCount; i++) {
        display += `
                    <img src="${POKEBALL_RATINGS[1].image}" 
                         alt="Vacío"
                         class="${imgSize} inline-block opacity-20 grayscale">
                `;
    }

    if (showNumber) {
        display += ` <span class="text-sm text-gray-500 ml-2">(${rating.toFixed(1)})</span>`;
    }

    display += '</div>';

    return display;
};

// Función para cargar y mostrar valoraciones del usuario
function loadUserRating() {
    if (!currentUser) return;

    const userStatsKey = `userStats_${currentUser.uid}`;
    const userStats = JSON.parse(localStorage.getItem(userStatsKey) || '{}');

    const ratingDisplay = document.getElementById('userRatingDisplay');
    const ratingStats = document.getElementById('userRatingStats');

    if (ratingDisplay && ratingStats) {
        if (userStats.averageRating && userStats.totalRatings > 0) {
            ratingDisplay.innerHTML = displayPokeballRating(userStats.averageRating, true, 'large');
            ratingStats.innerHTML = `
                        <div>
                            <span class="font-semibold text-2xl">${userStats.totalRatings}</span> 
                            <span class="text-lg">valoración${userStats.totalRatings !== 1 ? 'es' : ''}</span>
                        </div>
                        <div class="text-lg opacity-90">
                            Promedio: ${userStats.averageRating.toFixed(1)}/5.0
                        </div>
                    `;
        } else {
            ratingDisplay.innerHTML = `
                        <span class="text-xl opacity-75">Sin valoraciones aún</span>
                    `;
            ratingStats.innerHTML = `
                        <span class="text-sm opacity-75">Completa tu primer intercambio para recibir valoraciones</span>
                    `;
        }
    }
}

// Función para cargar la pestaña de valoraciones completa
function loadRatingsTab() {
    if (!currentUser) return;

    // Cargar resumen de valoración
    loadUserRating();

    // Cargar historial de reseñas
    loadRatingsHistory();

    // Cargar estadísticas
    loadRatingStatistics();
}

// Función para cargar el historial de reseñas
function loadRatingsHistory() {
    if (!currentUser) return;

    const ratingsKey = `ratings_${currentUser.uid}`;
    const userRatings = JSON.parse(localStorage.getItem(ratingsKey) || '[]');

    const container = document.getElementById('ratingsHistoryContainer');
    if (!container) return;

    if (userRatings.length === 0) {
        container.innerHTML = `
                    <div class="text-center py-12">
                        <span class="text-6xl">📭</span>
                        <p class="mt-4 text-gray-500 dark:text-gray-400">
                            No has recibido reseñas aún
                        </p>
                        <p class="text-sm text-gray-400 dark:text-gray-500 mt-2">
                            Las reseñas aparecerán aquí cuando completes intercambios
                        </p>
                    </div>
                `;
    } else {
        // Ordenar por fecha más reciente
        userRatings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        container.innerHTML = userRatings.map(rating => `
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-5 hover:shadow-lg transition-shadow">
                        <div class="flex items-start gap-4">
                            <div class="flex-shrink-0">
                                <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                    ${rating.fromUserName.charAt(0).toUpperCase()}
                                </div>
                            </div>
                            <div class="flex-1">
                                <div class="flex items-start justify-between mb-2">
                                    <div>
                                        <h4 class="font-semibold text-gray-900 dark:text-white">
                                            ${rating.fromUserName}
                                        </h4>
                                        <div class="flex items-center gap-2 mt-1">
                                            <div class="text-lg">
                                                ${displayPokeballRating(rating.rating)}
                                            </div>
                                            <span class="text-sm text-gray-500 dark:text-gray-400">
                                                ${POKEBALL_RATINGS[rating.rating].name}
                                            </span>
                                        </div>
                                    </div>
                                    <span class="text-xs text-gray-500 dark:text-gray-400">
                                        ${formatRelativeTime(rating.timestamp)}
                                    </span>
                                </div>
                                ${rating.comment ? `
                                    <div class="bg-white dark:bg-gray-800 rounded-lg p-3 mt-3">
                                        <p class="text-gray-700 dark:text-gray-300 italic">
                                            "${rating.comment}"
                                        </p>
                                    </div>
                                ` : ''}
                                ${rating.tradeId ? `
                                    <div class="mt-3 text-xs text-gray-500 dark:text-gray-400">
                                        Intercambio #${rating.tradeId.slice(-6)}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('');
    }
}

// Función para cargar estadísticas de valoraciones
function loadRatingStatistics() {
    if (!currentUser) return;

    const ratingsKey = `ratings_${currentUser.uid}`;
    const userRatings = JSON.parse(localStorage.getItem(ratingsKey) || '[]');

    // Contar por tipo de Pokéball
    const counts = {
        1: 0, // Premier Ball
        2: 0, // Poké Ball
        3: 0, // Great Ball
        4: 0, // Ultra Ball
        5: 0  // Master Ball
    };

    userRatings.forEach(rating => {
        if (rating.rating >= 1 && rating.rating <= 5) {
            counts[rating.rating]++;
        }
    });

    // Actualizar los contadores en el DOM
    document.getElementById('premierBallCount').textContent = counts[1];
    document.getElementById('pokeBallCount').textContent = counts[2];
    document.getElementById('greatBallCount').textContent = counts[3];
    document.getElementById('ultraBallCount').textContent = counts[4];
    document.getElementById('masterBallCount').textContent = counts[5];
}

// Función para refrescar las valoraciones
window.refreshRatings = function () {
    loadRatingsTab();
    showNotification('Valoraciones actualizadas', 'success', 2000);
}

// Función para mostrar historial de valoraciones
window.showRatingHistory = function () {
    if (!currentUser) return;

    const ratingsKey = `ratings_${currentUser.uid}`;
    const userRatings = JSON.parse(localStorage.getItem(ratingsKey) || '[]');

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
                    <div class="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
                        <div class="flex justify-between items-center">
                            <h2 class="text-2xl font-bold">🏆 Historial de Valoraciones</h2>
                            <button onclick="this.closest('.fixed').remove()" 
                                    class="text-white hover:text-purple-200 transition-colors">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <div class="p-6 overflow-y-auto max-h-[60vh]">
                        ${userRatings.length === 0 ? `
                            <div class="text-center py-8">
                                <span class="text-6xl">📭</span>
                                <p class="mt-4 text-gray-500 dark:text-gray-400">
                                    No has recibido valoraciones aún
                                </p>
                            </div>
                        ` : `
                            <div class="space-y-4">
                                ${userRatings.map(rating => `
                                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                        <div class="flex items-start justify-between">
                                            <div class="flex-1">
                                                <div class="flex items-center gap-3 mb-2">
                                                    <span class="font-semibold text-gray-900 dark:text-white">
                                                        ${rating.fromUserName}
                                                    </span>
                                                    <div class="text-lg">
                                                        ${displayPokeballRating(rating.rating)}
                                                    </div>
                                                </div>
                                                ${rating.comment ? `
                                                    <p class="text-gray-600 dark:text-gray-300 text-sm italic">
                                                        "${rating.comment}"
                                                    </p>
                                                ` : ''}
                                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                                    ${formatRelativeTime(rating.timestamp)}
                                                </p>
                                            </div>
                                            <div class="text-2xl">
                                                ${POKEBALL_RATINGS[rating.rating].emoji}
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>
            `;

    document.body.appendChild(modal);
};

// Función compartida para generar HTML de cartas en modales de intercambio/propuesta
function generateTradeCardHTML(cards) {
    return cards.map(card => `
        <div class="group relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 w-44">
            <!-- Imagen de la carta -->
            <div class="relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 p-2">
                ${card.image ? `
                    <img src="${card.image}" alt="${card.name}" 
                         class="w-full h-auto rounded-lg" loading="lazy">
                ` : `
                    <div class="w-full aspect-[3/4] flex items-center justify-center">
                        <span class="text-6xl opacity-40">🎴</span>
                    </div>
                `}
                <!-- Badge de condición -->
                <div class="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-md"
                     style="background-color: ${CARD_CONDITIONS[card.condition || 'NM']?.color || '#6b7280'}">
                    ${CARD_CONDITIONS[card.condition || 'NM']?.icon || '✨'} ${card.condition || 'NM'}
                </div>
            </div>
            
            <!-- Info de la carta -->
            <div class="px-3 py-2.5 space-y-1.5">
                <h4 class="font-bold text-sm text-gray-900 dark:text-white text-center leading-tight line-clamp-2">
                    ${card.name || 'Sin nombre'}
                </h4>
                
                <!-- Pills compactas -->
                <div class="flex flex-wrap gap-1 justify-center">
                    ${card.set ? `
                        <span class="inline-block bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[120px]">
                            ${card.set}
                        </span>
                    ` : ''}
                    ${card.number ? `
                        <span class="inline-block bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded text-[10px] font-medium">
                            #${card.number}
                        </span>
                    ` : ''}
                </div>
                <div class="flex justify-center">
                    <span class="inline-block bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded text-[10px] font-medium">
                        🌐 ${card.language || 'Español'}
                    </span>
                </div>
                <!-- Precio: personal preferido sobre mercado -->
                <div class="text-center">
                    ${card.customPrice != null
                        ? `<span class="text-[10px] font-semibold text-orange-600 dark:text-orange-400">💰 ${formatTradePrice(card.customPrice)}</span>`
                        : `<div data-card-price data-card-id="${card.id || ''}" data-card-name="${card.name || ''}"></div>`
                    }
                </div>
            </div>
        </div>
    `).join('');
}

function getTradeCardGridClass(count) {
    if (count === 1) return 'flex justify-center';
    if (count === 2) return 'flex flex-wrap justify-center gap-5';
    return 'flex flex-wrap justify-center gap-4';
}

function viewTradeDetails(tradeId) {
    console.log('👁️ Viendo detalles del intercambio:', tradeId);

    // Buscar el intercambio
    const trade = findTradeById(tradeId);
    if (!trade) {
        showNotification('No se encontró el intercambio', 'error');
        return;
    }

    // Crear modal de detalles
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';

    // Usar cartas finales si el intercambio fue completado
    const isCompleted = trade.status === 'completed';
    const displayOffered = trade.finalOfferedCards || trade.offeredCards;
    const displayWanted = trade.finalWantedCards || trade.wantedCards;

    // Usar función compartida para generar cartas
    const offeredCardsHTML = generateTradeCardHTML(displayOffered);
    const offeredGridClass = getTradeCardGridClass(displayOffered.length);

    const wantedCardsHTML = generateTradeCardHTML(displayWanted);
    const wantedGridClass = getTradeCardGridClass(displayWanted.length);

    modal.innerHTML = `
                <div class="bg-white dark:bg-gray-900 rounded-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
                    <!-- Header con gradiente -->
                    <div class="bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-700 dark:to-orange-800 p-6">
                        <div class="flex justify-between items-start">
                            <div class="text-white">
                                <h2 class="text-3xl font-bold mb-2">
                                    ${trade.title || 'Intercambio sin título'}
                                </h2>
                                <div class="flex items-center gap-4 text-sm opacity-90">
                                    <span class="flex items-center gap-1">
                                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                                        </svg>
                                        ${trade.userName || trade.user || 'Usuario'}
                                    </span>
                                    <span class="flex items-center gap-1">
                                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
                                        </svg>
                                        ${trade.createdAt ? new Date(trade.createdAt).toLocaleDateString('es-ES') : 'Fecha desconocida'}
                                    </span>
                                </div>
                            </div>
                            <button onclick="this.closest('.fixed').remove()" 
                                    class="text-white hover:text-gray-200 transition-colors">
                                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Content con scroll -->
                    <div class="overflow-y-auto max-h-[calc(90vh-120px)] bg-gray-50 dark:bg-gray-800">
                        <div class="p-8">
                            <!-- Trade Flow mejorado -->
                            <div class="flex flex-col lg:flex-row items-start justify-center gap-8">
                                <!-- Offered Cards -->
                                <div class="flex-1 w-full">
                                    <div class="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
                                        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                            <span class="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 p-2 rounded-lg">
                                                📤
                                            </span>
                                            Ofrece
                                        </h3>
                                        <div class="${offeredGridClass} gap-4">
                                            ${offeredCardsHTML || '<p class="text-gray-500 text-center italic py-8">No hay cartas ofrecidas</p>'}
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Separador visual -->
                                <div class="flex items-center justify-center lg:pt-20">
                                    <div class="bg-gradient-to-r from-orange-400 to-orange-600 text-white p-4 rounded-full shadow-lg">
                                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                                        </svg>
                                    </div>
                                </div>
                                
                                <!-- Wanted Cards -->
                                <div class="flex-1 w-full">
                                    <div class="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
                                        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                            <span class="bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 p-2 rounded-lg">
                                                📥
                                            </span>
                                            Busca
                                        </h3>
                                        <div class="${wantedGridClass} gap-4">
                                            ${wantedCardsHTML || '<p class="text-gray-500 text-center italic py-8">No hay cartas buscadas</p>'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Balance de valor del intercambio -->
                        <div id="tradeDetailBalance" class="mx-0 mb-6 px-0 pt-2">
                            <p class="text-xs text-gray-400 italic text-center">Calculando balance de valor…</p>
                        </div>
                        
                        <!-- Description -->
                        ${trade.description ? `
                            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
                                <h3 class="font-bold text-gray-900 dark:text-white mb-2">📝 Descripción</h3>
                                <p class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">${trade.description}</p>
                            </div>
                        ` : ''}
                        
                        <!-- Propuestas Pendientes (solo visible para el dueño del trade) -->
                        ${(() => {
                            const proposalsKey = `proposals_${tradeId}`;
                            const tradeProposals = JSON.parse(localStorage.getItem(proposalsKey) || '[]');
                            const pendingProposals = tradeProposals.filter(p => p.status === 'pending');
                            if (pendingProposals.length > 0 && currentUser && trade.userId === currentUser.uid) {
                                return `
                                <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-6 mb-6 mx-8">
                                    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <span class="text-2xl">📬</span>
                                        Propuestas Recibidas (${pendingProposals.length})
                                    </h3>
                                    <div class="space-y-4">
                                        ${pendingProposals.map(p => `
                                            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
                                                <div class="flex items-center justify-between mb-3">
                                                    <div>
                                                        <span class="font-semibold text-gray-900 dark:text-white">${p.fromUserName}</span>
                                                        <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">${formatRelativeTime(p.createdAt)}</span>
                                                    </div>
                                                    <span class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">Pendiente</span>
                                                </div>
                                                <div class="grid md:grid-cols-2 gap-3 text-sm mb-3">
                                                    <div>
                                                        <span class="font-medium text-gray-700 dark:text-gray-300">Ofrece:</span>
                                                        <ul class="mt-1">${p.offeredCards.map(c => '<li class="text-gray-600 dark:text-gray-400 flex items-center gap-1">' + (c.image ? '<img src="' + c.image + '" class="w-6 h-8 object-contain rounded">' : '') + ' ' + c.name + '</li>').join('')}</ul>
                                                    </div>
                                                    <div>
                                                        <span class="font-medium text-gray-700 dark:text-gray-300">Busca:</span>
                                                        <ul class="mt-1">${p.wantedCards.map(c => '<li class="text-gray-600 dark:text-gray-400 flex items-center gap-1">' + (c.image ? '<img src="' + c.image + '" class="w-6 h-8 object-contain rounded">' : '') + ' ' + c.name + '</li>').join('')}</ul>
                                                    </div>
                                                </div>
                                                ${p.message ? '<p class="text-sm text-gray-500 dark:text-gray-400 italic mb-3">"' + p.message + '"</p>' : ''}
                                                <div class="flex gap-2">
                                                    <button onclick="viewProposalDetails('${p.id}', '${tradeId}')"
                                                            class="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm font-semibold">
                                                        Ver Detalles
                                                    </button>
                                                    <button onclick="acceptProposal('${p.id}', '${tradeId}'); this.closest('.fixed').remove();"
                                                            class="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-semibold">
                                                        ✅ Aceptar
                                                    </button>
                                                    <button onclick="rejectProposal('${p.id}', '${tradeId}'); this.closest('.fixed').remove();"
                                                            class="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-semibold">
                                                        ❌ Rechazar
                                                    </button>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>`;
                            }
                            return '';
                        })()}
                        
                        <!-- Action Buttons -->
                        <div class="flex gap-3 justify-center">
                            ${currentUser && trade.userId !== currentUser.uid ? `
                                <button onclick="proposeTrade('${tradeId}')" 
                                        class="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors">
                                    <span>💬</span> Proponer Intercambio
                                </button>
                                <button onclick="contactUser('${trade.userId}')" 
                                        class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors">
                                    <span>📧</span> Contactar
                                </button>
                            ` : ''}
                            <button onclick="this.closest('.fixed').remove()" 
                                    class="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            `;

    document.body.appendChild(modal);

    // Cargar precios de las cartas en la vista de detalles
    loadTradeCardPrices(modal);

    // Calcular y mostrar balance de valor del intercambio
    const balanceEl = modal.querySelector('#tradeDetailBalance');
    renderTradeBalance(balanceEl, displayOffered, displayWanted);

    // Cerrar con ESC o click fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escHandler);
        }
    });
}

// Función para contactar con un usuario
function contactUser(userId) {
    console.log('📧 Contactando con usuario:', userId);
    showNotification('Función de contacto en desarrollo', 'info');
}

// Función para mostrar modal de crear intercambio
window.showCreateTradeModal = (existingTrade = null) => {
    console.log('🚀 === ABRIENDO MODAL ===');
    console.log('📥 Parámetro existingTrade recibido:', existingTrade);

    // Verificar si ya existe un modal abierto
    const existingModal = document.querySelector('#createTradeModal');
    if (existingModal) {
        console.log('⚠️ Modal ya existe, cerrando el anterior');
        existingModal.remove();
    }

    if (!currentUser) {
        showNotification('Debes iniciar sesión para crear intercambios', 'warning', 4000);
        showAuthModal('login');
        return;
    }

    const isEditing = !!existingTrade;
    console.log('🔧 isEditing calculado:', isEditing);
    console.log(isEditing ? '✏️ Modo edición activado' : '🆕 Modo crear nuevo');

    if (isEditing) {
        console.log('📋 Datos para edición:');
        console.log('- existingTrade completo:', existingTrade);
        console.log('- offeredCards:', existingTrade?.offeredCards);
        console.log('- wantedCards:', existingTrade?.wantedCards);
    }

    const modal = document.createElement('div');
    modal.id = 'createTradeModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                            <span class="icon mr-3">${isEditing ? '✏️' : '🤝'}</span> ${isEditing ? 'Editar Intercambio' : 'Crear Nuevo Intercambio'}
                        </h3>
                        <button id="closeCreateTradeModal" 
                                class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-3xl">
                            &times;
                        </button>
                    </div>

                    <form id="createTradeForm" class="space-y-6">
                        ${isEditing ? `<input type="hidden" id="editingTradeId" value="${existingTrade.id}">` : ''}
                        <!-- Vista previa del título generado -->
                        <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                            <h4 class="text-lg font-semibold text-orange-800 dark:text-orange-300 mb-2 flex items-center">
                                <span class="mr-2">✨</span> Vista Previa del Título
                            </h4>
                            <div id="generatedTitle" class="text-gray-700 dark:text-gray-300 font-medium italic">
                                El título se generará automáticamente cuando añadas cartas
                            </div>
                        </div>

                        <!-- Cartas que ofrezco -->
                        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                            <h4 class="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4 flex items-center">
                                <span class="mr-2">📤</span> Cartas que Ofrezco
                            </h4>
                            <div id="offeredCardsContainer" class="space-y-3 mb-4">
                                <!-- Las cartas ofrecidas se añadirán aquí -->
                            </div>
                            <div class="flex gap-2">
                                <button type="button" id="addOfferedCardBtn"
                                        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center">
                                    <span class="mr-2">+</span> Añadir Carta
                                </button>
                                <button type="button" onclick="addFromMyCards('offered')"
                                        class="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center">
                                    <span class="mr-2">📚</span> Desde Mis Cartas
                                </button>
                            </div>
                        </div>

                        <!-- Cartas que busco -->
                        <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                            <h4 class="text-lg font-semibold text-green-800 dark:text-green-300 mb-4 flex items-center">
                                <span class="mr-2">📥</span> Cartas que Busco
                            </h4>
                            <div id="wantedCardsContainer" class="space-y-3 mb-4">
                                <!-- Las cartas buscadas se añadirán aquí -->
                            </div>
                            <div class="flex gap-2">
                                <button type="button" id="addWantedCardBtn"
                                        class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center">
                                    <span class="mr-2">+</span> Añadir Carta
                                </button>
                            </div>
                        </div>

                        <!-- Otros detalles -->
                        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                            <h4 class="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
                                <span class="mr-2">📝</span> Otros Detalles
                            </h4>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Información adicional (opcional)
                                </label>
                                <textarea id="tradeDescription" rows="3"
                                          placeholder="Describe condiciones específicas, preferencias, ubicación para intercambio presencial, etc..."
                                          class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-gray-600 text-gray-900 dark:text-white resize-none"></textarea>
                            </div>
                        </div>

                        <!-- Botones de acción -->
                        <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <button type="button" id="cancelCreateTrade"
                                    class="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold">
                                Cancelar
                            </button>
                            <button type="submit" id="submitCreateTrade"
                                    class="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold flex items-center">
                                <span class="mr-2">${isEditing ? '✅' : '🚀'}</span> ${isEditing ? 'Confirmar Intercambio' : 'Crear Intercambio'}
                            </button>
                        </div>
                    </form>
                </div>
            `;

    document.body.appendChild(modal);
    setupCreateTradeModalEvents(modal, isEditing, existingTrade);
};

// Configurar eventos del modal de crear intercambio
function setupCreateTradeModalEvents(modal, isEditing = false, existingTrade = null) {
    console.log('🔧 === CONFIGURANDO EVENTOS DEL MODAL ===');
    console.log('🔧 isEditing recibido:', isEditing);
    console.log('🔧 existingTrade recibido:', existingTrade);
    const closeBtn = modal.querySelector('#closeCreateTradeModal');
    const cancelBtn = modal.querySelector('#cancelCreateTrade');
    const form = modal.querySelector('#createTradeForm');
    const addOfferedBtn = modal.querySelector('#addOfferedCardBtn');
    const addWantedBtn = modal.querySelector('#addWantedCardBtn');

    // Cerrar modal
    const closeModal = () => modal.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Cerrar con ESC o click fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    });

    // Añadir cartas
    addOfferedBtn.addEventListener('click', () => addCardToTrade('offered'));
    addWantedBtn.addEventListener('click', () => addCardToTrade('wanted'));

    // Enviar formulario
    form.addEventListener('submit', handleCreateTradeSubmit);

    // Añadir cartas iniciales o pre-cargar datos existentes
    console.log('🔍 === INICIANDO SETUP DE CARTAS ===');
    console.log('🔧 isEditing:', isEditing);
    console.log('📦 existingTrade:', existingTrade);

    if (isEditing && existingTrade) {
        console.log('📋 ✅ ENTRANDO EN MODO EDICIÓN');
        console.log('📋 Modo edición: pre-cargando cartas existentes...', existingTrade);
        console.log('📋 offeredCards para pre-cargar:', existingTrade.offeredCards);
        console.log('📋 wantedCards para pre-cargar:', existingTrade.wantedCards);

        // Pre-cargar descripción inmediatamente
        setTimeout(() => {
            const descriptionTextarea = document.getElementById('tradeDescription');
            if (descriptionTextarea && existingTrade.description) {
                descriptionTextarea.value = existingTrade.description;
                console.log('✅ Descripción pre-cargada:', existingTrade.description);
            }
        }, 50);

        // Pre-cargar cartas ofrecidas
        console.log(`📦 Cargando ${existingTrade.offeredCards.length} cartas ofrecidas`);
        existingTrade.offeredCards.forEach((card, index) => {
            console.log(`📝 Añadiendo carta ofrecida ${index}:`, card);
            // Forzar la creación de nueva fila para cada carta guardada
            addCardToTrade('offered', true);
            // Pre-cargar datos con delay para asegurar que el DOM esté listo
            setTimeout(() => {
                preloadCardData('offered', index, card);
            }, 100 + (index * 50));
        });

        // Pre-cargar cartas buscadas  
        console.log(`📦 Cargando ${existingTrade.wantedCards.length} cartas buscadas`);
        existingTrade.wantedCards.forEach((card, index) => {
            console.log(`📝 Añadiendo carta buscada ${index}:`, card);
            // Forzar la creación de nueva fila para cada carta guardada
            addCardToTrade('wanted', true);
            // Pre-cargar datos con delay para asegurar que el DOM esté listo
            setTimeout(() => {
                preloadCardData('wanted', index, card);
            }, 100 + (index * 50));
        });

        // Actualizar título y añadir filas vacías después de pre-cargar todo
        setTimeout(() => {
            updateGeneratedTitle();

            // En modo edición, solo añadir fila vacía si no hay ninguna
            // IMPORTANTE: Usar forceAdd=true para evitar bloquear las cartas existentes
            const offeredContainer = document.getElementById('offeredCardsContainer');
            const wantedContainer = document.getElementById('wantedCardsContainer');

            // Verificar si necesitamos añadir fila vacía para ofertas
            const offeredCards = offeredContainer.querySelectorAll('.trade-card');
            let hasEmptyOffered = false;
            offeredCards.forEach(card => {
                const input = card.querySelector('input[name*="_name_"]');
                if (input && !input.value.trim()) {
                    hasEmptyOffered = true;
                }
            });
            if (!hasEmptyOffered) {
                addCardToTrade('offered', true); // Forzar para no bloquear
            }

            // Verificar si necesitamos añadir fila vacía para búsquedas
            const wantedCards = wantedContainer.querySelectorAll('.trade-card');
            let hasEmptyWanted = false;
            wantedCards.forEach(card => {
                const input = card.querySelector('input[name*="_name_"]');
                if (input && !input.value.trim()) {
                    hasEmptyWanted = true;
                }
            });
            if (!hasEmptyWanted) {
                addCardToTrade('wanted', true); // Forzar para no bloquear
            }

            console.log('✅ Pre-carga completada en modo edición - campos EDITABLES');
        }, 600);
    } else {
        // Modo crear nuevo: añadir cartas vacías
        console.log('🆕 Modo crear nuevo: añadiendo cartas vacías');
        addCardToTrade('offered');
        addCardToTrade('wanted');
    }
}

// Función para pre-cargar datos en una carta existente
function preloadCardData(type, cardIndex, cardData) {
    console.log(`📝 Pre-cargando datos para ${type} carta ${cardIndex}:`, cardData);

    const container = document.getElementById(type === 'offered' ? 'offeredCardsContainer' : 'wantedCardsContainer');
    const cardElement = container.children[cardIndex];

    if (!cardElement) {
        console.error('❌ No se encontró el elemento de carta para pre-cargar');
        return;
    }

    // Determinar si la carta viene de "Mis Cartas"
    const isFromMyCards = cardData.fromMyCards === true;
    console.log(`📌 Carta ${isFromMyCards ? 'DE MI COLECCIÓN (bloqueada)' : 'DEL BUSCADOR (editable)'}`);

    // Pre-cargar el campo oculto fromMyCards
    const fromMyCardsInput = cardElement.querySelector(`input[name*="${type}_fromMyCards_"]`);
    if (fromMyCardsInput) {
        fromMyCardsInput.value = isFromMyCards ? 'true' : 'false';
    }

    // Pre-cargar nombre
    const nameInput = cardElement.querySelector(`input[name*="${type}_name_"]`);
    if (nameInput && cardData.name) {
        nameInput.value = cardData.name;

        if (isFromMyCards) {
            // Si es de "Mis Cartas", BLOQUEAR
            nameInput.readOnly = true;
            nameInput.classList.add('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed');
            nameInput.classList.remove('bg-white');
        } else {
            // Si es del buscador, mantener EDITABLE
            nameInput.readOnly = false;
            nameInput.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed');
            nameInput.classList.add('bg-white', 'dark:bg-gray-700');
        }
    }

    // Pre-cargar campos ocultos (IMPORTANTE para que funcione la miniatura)
    const idInput = cardElement.querySelector(`input[name*="${type}_id_"]`);
    if (idInput && cardData.id) {
        idInput.value = cardData.id;
    }

    const imageInput = cardElement.querySelector(`input[name*="${type}_image_"]`);
    if (imageInput && cardData.image) {
        imageInput.value = cardData.image;
    }

    const setInput = cardElement.querySelector(`input[name*="${type}_set_"]`);
    if (setInput && cardData.set) {
        setInput.value = cardData.set;
    }

    const numberInput = cardElement.querySelector(`input[name*="${type}_number_"]`);
    if (numberInput && cardData.number) {
        numberInput.value = cardData.number;
    }

    // Pre-cargar condición
    const conditionSelect = cardElement.querySelector(`select[name*="${type}_condition_"]`);
    if (conditionSelect && cardData.condition) {
        conditionSelect.value = cardData.condition;

        if (isFromMyCards) {
            // Si es de "Mis Cartas", BLOQUEAR
            conditionSelect.disabled = true;
            conditionSelect.classList.add('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed');
            conditionSelect.classList.remove('bg-white');
        } else {
            // Si es del buscador, mantener EDITABLE
            conditionSelect.disabled = false;
            conditionSelect.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed');
            conditionSelect.classList.add('bg-white', 'dark:bg-gray-700');
        }
    }

    // Pre-cargar idioma
    const languageSelect = cardElement.querySelector(`select[name*="${type}_language_"]`);
    if (languageSelect && cardData.language) {
        languageSelect.value = cardData.language;

        if (isFromMyCards) {
            // Si es de "Mis Cartas", BLOQUEAR
            languageSelect.disabled = true;
            languageSelect.classList.add('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed');
            languageSelect.classList.remove('bg-white');
        } else {
            // Si es del buscador, mantener EDITABLE
            languageSelect.disabled = false;
            languageSelect.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed');
            languageSelect.classList.add('bg-white', 'dark:bg-gray-700');
        }
    }

    // Mostrar miniatura si hay imagen
    if (cardData.image && cardData.name) {
        console.log(`🖼️ Mostrando miniatura para carta pre-cargada: ${cardData.name}`);
        showCardThumbnail(cardElement, cardData.image, cardData.name);
    }

    // NO bloquear en modo edición - el usuario debe poder modificar
    console.log(`✅ Carta ${type} ${cardIndex} pre-cargada con miniatura y EDITABLE (modo edición)`);
}

// Función para añadir carta al intercambio
function addCardToTrade(type, forceAdd = false) {
    console.log(`📝 addCardToTrade llamado para tipo: ${type}, forceAdd: ${forceAdd}`);
    const container = document.getElementById(type === 'offered' ? 'offeredCardsContainer' : 'wantedCardsContainer');

    if (!container) {
        console.error('❌ No se encontró el contenedor');
        return;
    }

    // Si NO es forzado, verificar si necesitamos nueva fila
    if (!forceAdd) {
        // Bloquear todas las filas con contenido no bloqueadas
        const allCards = container.querySelectorAll('.trade-card');
        let needNewRow = true;

        allCards.forEach((card, index) => {
            const nameInput = card.querySelector('input[name*="_name_"]');

            if (nameInput && !nameInput.readOnly) {
                if (nameInput.value.trim()) {
                    // Si tiene contenido y no está bloqueada, bloquearla
                    console.log(`🔒 Bloqueando carta ${index}: ${nameInput.value}`);
                    lockExistingCard(card);

                    // Mostrar miniatura si hay imagen
                    const imageInput = card.querySelector('input[name*="_image_"]');
                    if (imageInput && imageInput.value) {
                        showCardThumbnail(card, imageInput.value, nameInput.value);
                    }
                } else {
                    // Hay una fila vacía no bloqueada
                    needNewRow = false;
                    console.log(`ℹ️ Fila ${index} está vacía, no se necesita nueva fila`);
                }
            }
        });

        // Solo añadir nueva fila si todas tienen contenido o están bloqueadas
        if (!needNewRow) {
            console.log('✓ Ya hay una fila vacía disponible');
            return;
        }
    }

    console.log('➕ Creando nueva fila vacía');

    const cardIndex = container.children.length;
    const cardId = `${type}_card_${cardIndex}`;

    const cardElement = document.createElement('div');
    cardElement.className = 'trade-card bg-white dark:bg-gray-600 rounded-lg p-4 border border-gray-200 dark:border-gray-500';
    cardElement.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div class="relative">
                        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Nombre de la carta *
                        </label>
                        <div class="relative">
                            <input type="text" name="${type}_name_${cardIndex}"
                                   placeholder="Buscar carta..."
                                   value=""
                                   class="card-name-input w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                                   oninput="searchCardForTrade(this, '${type}', ${cardIndex})"
                                   onkeypress="handleCardInputKeypress(event, '${type}', ${cardIndex})"
                                   onblur="handleCardInputBlur(this, '${type}', ${cardIndex})"
                                   title="Buscar carta en la base de datos">
                            <input type="hidden" name="${type}_id_${cardIndex}" value="">
                            <input type="hidden" name="${type}_image_${cardIndex}" value="">
                            <input type="hidden" name="${type}_set_${cardIndex}" value="">
                            <input type="hidden" name="${type}_number_${cardIndex}" value="">
                            <input type="hidden" name="${type}_fromMyCards_${cardIndex}" value="false">
                            <input type="hidden" name="${type}_customPrice_${cardIndex}" value="">
                        </div>
                        <div class="card-search-results absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto hidden"></div>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Condición *
                        </label>
                        <select name="${type}_condition_${cardIndex}"
                                class="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                                title="Selecciona la condición de la carta">
                            ${Object.values(CARD_CONDITIONS).map(condition =>
        `<option value="${condition.code}">${condition.icon} ${condition.code}</option>`
    ).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Idioma
                        </label>
                        <select name="${type}_language_${cardIndex}"
                                class="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                                title="Selecciona el idioma de la carta">
                            <option value="Español">🇪🇸 Español</option>
                            <option value="Inglés">🇺🇸 Inglés</option>
                            <option value="Francés">🇫🇷 Francés</option>
                            <option value="Italiano">🇮🇹 Italiano</option>
                            <option value="Alemán">🇩🇪 Alemán</option>
                            <option value="Portugués">🇵🇹 Portugués</option>
                            <option value="Japonés">🇯🇵 Japonés</option>
                            <option value="Chino">🇨🇳 Chino</option>
                            <option value="Coreano">🇰🇷 Coreano</option>
                            <option value="Tailandés">🇹🇭 Tailandés</option>
                            <option value="Ruso">🇷🇺 Ruso</option>
                            <option value="Holandés">🇳🇱 Holandés</option>
                            <option value="Sueco">🇸🇪 Sueco</option>
                            <option value="Noruego">🇳🇴 Noruego</option>
                            <option value="Danés">🇩🇰 Danés</option>
                            <option value="Finlandés">🇫🇮 Finlandés</option>
                            <option value="Polaco">🇵🇱 Polaco</option>
                            <option value="Checo">🇨🇿 Checo</option>
                            <option value="Húngaro">🇭🇺 Húngaro</option>
                            <option value="Griego">🇬🇷 Griego</option>
                            <option value="Turco">🇹🇷 Turco</option>
                            <option value="Árabe">🇸🇦 Árabe</option>
                            <option value="Hebreo">🇮🇱 Hebreo</option>
                            <option value="Hindi">🇮🇳 Hindi</option>
                            <option value="Vietnamita">🇻🇳 Vietnamita</option>
                            <option value="Malayo">🇲🇾 Malayo</option>
                            <option value="Indonesio">🇮🇩 Indonesio</option>
                            <option value="Filipino">🇵🇭 Filipino</option>
                            <option value="Cualquiera">🌍 Cualquiera</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 opacity-0">
                            Eliminar
                        </label>
                        <button type="button" onclick="removeCardFromTrade(this)"
                                class="w-full h-[38px] bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm font-semibold transition-colors flex items-center justify-center"
                                title="Eliminar carta">
                            🗑️
                        </button>
                    </div>
                </div>
            `;

    container.appendChild(cardElement);
    updateGeneratedTitle();

    console.log(`✅ Nueva carta ${type} añadida y lista para editar`);
}

// Función para bloquear una carta completa (todos sus campos)
function lockExistingCard(cardElement) {
    console.log('🔒 Bloqueando carta completa');

    // Bloquear input de nombre
    const nameInput = cardElement.querySelector('input[name*="_name_"]');
    if (nameInput && !nameInput.readOnly) {
        nameInput.readOnly = true;
        nameInput.className = nameInput.className.replace('bg-white dark:bg-gray-700', 'bg-gray-100 dark:bg-gray-600');
        nameInput.className = nameInput.className.replace('text-gray-900 dark:text-white', 'text-gray-700 dark:text-gray-300');
        nameInput.className = nameInput.className.replace(' focus:outline-none focus:ring-2 focus:ring-orange-400', '');
        nameInput.className += ' cursor-not-allowed';
        nameInput.title = "Carta bloqueada - solo se puede eliminar";
    }

    // Bloquear select de condición
    const conditionSelect = cardElement.querySelector('select[name*="_condition_"]');
    if (conditionSelect && !conditionSelect.disabled) {
        conditionSelect.disabled = true;
        conditionSelect.className = conditionSelect.className.replace('bg-white dark:bg-gray-700', 'bg-gray-100 dark:bg-gray-600');
        conditionSelect.className = conditionSelect.className.replace('text-gray-900 dark:text-white', 'text-gray-700 dark:text-gray-300');
        conditionSelect.className = conditionSelect.className.replace(' focus:outline-none focus:ring-2 focus:ring-orange-400', '');
        conditionSelect.className += ' cursor-not-allowed';
        conditionSelect.title = "Carta bloqueada - solo se puede eliminar";
    }

    // Bloquear select de idioma
    const languageSelect = cardElement.querySelector('select[name*="_language_"]');
    if (languageSelect && !languageSelect.disabled) {
        languageSelect.disabled = true;
        languageSelect.className = languageSelect.className.replace('bg-white dark:bg-gray-700', 'bg-gray-100 dark:bg-gray-600');
        languageSelect.className = languageSelect.className.replace('text-gray-900 dark:text-white', 'text-gray-700 dark:text-gray-300');
        languageSelect.className = languageSelect.className.replace(' focus:outline-none focus:ring-2 focus:ring-orange-400', '');
        languageSelect.className += ' cursor-not-allowed';
        languageSelect.title = "Carta bloqueada - solo se puede eliminar";
    }
}

// Función para eliminar carta y actualizar título
window.removeCardFromTrade = function (button) {
    console.log('🗑️ Intentando eliminar carta...');

    // Buscar el elemento de la carta usando la clase específica
    const cardElement = button.closest('.trade-card');

    if (!cardElement) {
        console.error('❌ No se pudo encontrar el elemento de la carta');
        return;
    }

    const container = cardElement.parentElement;
    console.log('📦 Container encontrado, tiene', container.children.length, 'cartas');

    // Verificar que no sea la única carta del tipo
    if (container.children.length <= 1) {
        showNotification('Debes mantener al menos una carta de cada tipo', 'warning', 4000);
        return;
    }

    // Eliminar la carta
    console.log('✅ Eliminando carta...');
    cardElement.remove();

    // Actualizar el título
    console.log('🔄 Actualizando título...');
    updateGeneratedTitle();

    console.log('✨ Carta eliminada exitosamente');
};

// Función para generar título automáticamente
function updateGeneratedTitle() {
    const titleElement = document.getElementById('generatedTitle');
    if (!titleElement) return;

    const offeredCards = [];
    const wantedCards = [];

    // Recoger cartas ofrecidas
    const offeredContainer = document.getElementById('offeredCardsContainer');
    if (offeredContainer) {
        offeredContainer.querySelectorAll('.card-name-input').forEach(input => {
            if (input.value.trim()) {
                offeredCards.push(input.value.trim());
            }
        });
    }

    // Recoger cartas buscadas
    const wantedContainer = document.getElementById('wantedCardsContainer');
    if (wantedContainer) {
        wantedContainer.querySelectorAll('.card-name-input').forEach(input => {
            if (input.value.trim()) {
                wantedCards.push(input.value.trim());
            }
        });
    }

    // Generar título
    let generatedTitle = '';

    if (offeredCards.length > 0 && wantedCards.length > 0) {
        const offeredText = offeredCards.length === 1
            ? offeredCards[0]
            : `${offeredCards[0]} (+${offeredCards.length - 1} más)`;

        const wantedText = wantedCards.length === 1
            ? wantedCards[0]
            : `${wantedCards[0]} (+${wantedCards.length - 1} más)`;

        generatedTitle = `Intercambio ${offeredText} por ${wantedText}`;
    } else if (offeredCards.length > 0) {
        const offeredText = offeredCards.length === 1
            ? offeredCards[0]
            : `${offeredCards[0]} (+${offeredCards.length - 1} más)`;
        generatedTitle = `Intercambio ${offeredText} por [Cartas buscadas]`;
    } else if (wantedCards.length > 0) {
        const wantedText = wantedCards.length === 1
            ? wantedCards[0]
            : `${wantedCards[0]} (+${wantedCards.length - 1} más)`;
        generatedTitle = `Intercambio [Cartas ofrecidas] por ${wantedText}`;
    } else {
        generatedTitle = 'El título se generará automáticamente cuando añadas cartas';
    }

    titleElement.textContent = generatedTitle;
    titleElement.className = generatedTitle.includes('[')
        ? 'text-gray-500 dark:text-gray-400 font-medium italic'
        : 'text-gray-800 dark:text-gray-200 font-semibold';
}

// Manejar envío del formulario
async function handleCreateTradeSubmit(e) {
    e.preventDefault();

    // Desactivar validación HTML nativa para hacer nuestra propia validación
    const form = e.target;
    const formData = new FormData(form);

    // Detectar si estamos editando
    const editingTradeIdElement = document.getElementById('editingTradeId');
    const isEditing = !!editingTradeIdElement;
    const editingTradeId = isEditing ? editingTradeIdElement.value : null;

    console.log(isEditing ? `✏️ Editando intercambio: ${editingTradeId}` : '🆕 Creando nuevo intercambio');

    // Recoger datos básicos
    const generatedTitleElement = document.getElementById('generatedTitle');
    const generatedTitle = generatedTitleElement ? generatedTitleElement.textContent : '';

    const tradeData = {
        title: generatedTitle,
        description: document.getElementById('tradeDescription').value || '',
        offeredCards: [],
        wantedCards: [],
        user: await getUserDisplayName(),
        userId: currentUser.uid, // ID del usuario propietario
        status: 'active',
        type: 'created',
        createdAt: new Date()
    };

    // Si estamos editando, mantener datos existentes
    if (isEditing) {
        tradeData.id = editingTradeId;
        const existingTrade = findTradeById(editingTradeId);
        if (existingTrade) {
            tradeData.createdAt = existingTrade.createdAt; // Mantener fecha original
            tradeData.updatedAt = new Date(); // Añadir fecha de actualización
        }
    } else {
        tradeData.createdAt = new Date();
    }

    // Recoger cartas ofrecidas
    const offeredContainer = document.getElementById('offeredCardsContainer');
    Array.from(offeredContainer.children).forEach((cardEl, index) => {
        const nameInput = cardEl.querySelector(`input[name*="offered_name_"]`);
        const idInput = cardEl.querySelector(`input[name*="offered_id_"]`);
        const imageInput = cardEl.querySelector(`input[name*="offered_image_"]`);
        const setInput = cardEl.querySelector(`input[name*="offered_set_"]`);
        const numberInput = cardEl.querySelector(`input[name*="offered_number_"]`);
        const conditionSelect = cardEl.querySelector(`select[name*="offered_condition_"]`);
        const languageSelect = cardEl.querySelector(`select[name*="offered_language_"]`);

        if (nameInput && nameInput.value.trim()) {
            const fromMyCardsInput = cardEl.querySelector(`input[name*="offered_fromMyCards_"]`);
            const customPriceInput = cardEl.querySelector(`input[name*="offered_customPrice_"]`);
            const rawCustomPrice = customPriceInput ? customPriceInput.value : '';
            tradeData.offeredCards.push({
                name: nameInput.value.trim(),
                id: idInput ? idInput.value : '',
                image: imageInput ? imageInput.value : '',
                set: setInput ? setInput.value : '',
                number: numberInput ? numberInput.value : '',
                condition: conditionSelect ? conditionSelect.value : 'NM',
                language: languageSelect ? languageSelect.value : 'Español',
                fromMyCards: fromMyCardsInput ? fromMyCardsInput.value === 'true' : false,
                customPrice: rawCustomPrice !== '' && !isNaN(parseFloat(rawCustomPrice)) ? parseFloat(rawCustomPrice) : null
            });
        }
    });

    // Recoger cartas buscadas
    const wantedContainer = document.getElementById('wantedCardsContainer');
    Array.from(wantedContainer.children).forEach((cardEl, index) => {
        const nameInput = cardEl.querySelector(`input[name*="wanted_name_"]`);
        const idInput = cardEl.querySelector(`input[name*="wanted_id_"]`);
        const imageInput = cardEl.querySelector(`input[name*="wanted_image_"]`);
        const setInput = cardEl.querySelector(`input[name*="wanted_set_"]`);
        const numberInput = cardEl.querySelector(`input[name*="wanted_number_"]`);
        const conditionSelect = cardEl.querySelector(`select[name*="wanted_condition_"]`);
        const languageSelect = cardEl.querySelector(`select[name*="wanted_language_"]`);

        if (nameInput && nameInput.value.trim()) {
            const fromMyCardsInput = cardEl.querySelector(`input[name*="wanted_fromMyCards_"]`);
            tradeData.wantedCards.push({
                name: nameInput.value.trim(),
                id: idInput ? idInput.value : '',
                image: imageInput ? imageInput.value : '',
                set: setInput ? setInput.value : '',
                number: numberInput ? numberInput.value : '',
                condition: conditionSelect ? conditionSelect.value : 'NM',
                language: languageSelect ? languageSelect.value : 'Español',
                fromMyCards: fromMyCardsInput ? fromMyCardsInput.value === 'true' : false
            });
        }
    });

    // Validaciones mejoradas - solo cuentan cartas con nombre
    console.log('📋 Validando intercambio:', {
        totalOfferedCards: offeredContainer.children.length,
        validOfferedCards: tradeData.offeredCards.length,
        totalWantedCards: wantedContainer.children.length,
        validWantedCards: tradeData.wantedCards.length,
        title: tradeData.title
    });

    if (tradeData.offeredCards.length === 0) {
        showNotification('Debes completar al menos una carta que ofreces', 'warning', 5000);
        return;
    }

    if (tradeData.wantedCards.length === 0) {
        showNotification('Debes completar al menos una carta que buscas', 'warning', 5000);
        return;
    }

    if (!tradeData.title.trim() || tradeData.title.includes('[') || tradeData.title.includes('automáticamente')) {
        showNotification('El título no se ha generado correctamente. Completa las cartas primero.', 'warning', 5000);
        return;
    }

    try {
        const userTradesKey = `userTrades_${currentUser.uid}`;
        let savedTrades = JSON.parse(localStorage.getItem(userTradesKey) || '[]');

        if (isEditing) {
            // Modo edición: actualizar intercambio existente
            console.log('✏️ Actualizando intercambio existente:', tradeData);

            const tradeIndex = savedTrades.findIndex(t => t.id === editingTradeId);
            if (tradeIndex !== -1) {
                savedTrades[tradeIndex] = tradeData;
                localStorage.setItem(userTradesKey, JSON.stringify(savedTrades));

                // Aquí se implementará la actualización en Firestore
                // await updateTradeInFirestore(tradeData);

                showSuccessMessage('¡Intercambio actualizado exitosamente! ✏️');
            } else {
                throw new Error('No se encontró el intercambio para actualizar');
            }
        } else {
            // Modo creación: crear nuevo intercambio
            tradeData.id = 'trade_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            console.log('💾 Creando nuevo intercambio:', tradeData);

            // Debug: Verificar estado antes de guardar
            console.log('🔍 === ANTES DE GUARDAR ===');
            console.log('👤 Usuario actual:', currentUser?.uid);
            console.log('🔑 Clave a usar:', userTradesKey);
            console.log('📦 Intercambios existentes:', savedTrades.length);
            console.log('📦 Intercambios existentes (detalle):', savedTrades.map(t => ({ id: t.id, title: t.title, userId: t.userId })));

            savedTrades.unshift(tradeData); // Añadir al principio
            localStorage.setItem(userTradesKey, JSON.stringify(savedTrades));

            // Debug: Verificar estado después de guardar
            console.log('🔍 === DESPUÉS DE GUARDAR ===');
            const verifyTrades = JSON.parse(localStorage.getItem(userTradesKey) || '[]');
            console.log('📦 Intercambios guardados:', verifyTrades.length);
            console.log('📦 Intercambios guardados (detalle):', verifyTrades.map(t => ({ id: t.id, title: t.title, userId: t.userId })));

            // Aquí se implementará el guardado en Firestore
            // await saveTradeToFirestore(tradeData);

            showSuccessMessage('¡Intercambio creado exitosamente! 🎉');
        }
        document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50').remove(); // Cerrar modal

        // Recargar intercambios
        console.log('🔄 Recargando intercambios después de crear/editar...');
        if (typeof loadUserTrades === 'function') {
            loadUserTrades();
        } else {
            console.error('❌ loadUserTrades no está disponible');
        }

    } catch (error) {
        console.error('❌ Error al crear intercambio:', error);
        showNotification('Error al crear el intercambio. Inténtalo de nuevo.', 'error', 5000);
    }
}

// Función para mostrar mensaje de éxito
function showSuccessMessage(message) {
    const successModal = document.createElement('div');
    successModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    successModal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 text-center shadow-xl">
                    <div class="text-6xl mb-4">🎉</div>
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">${message}</h3>
                    <p class="text-gray-600 dark:text-gray-300 mb-6">Tu intercambio estará visible para otros coleccionistas.</p>
                    <button onclick="this.parentElement.parentElement.remove()" 
                            class="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold">
                        ¡Perfecto!
                    </button>
                </div>
            `;

    document.body.appendChild(successModal);

    // Auto-cerrar después de 3 segundos
    setTimeout(() => {
        if (successModal.parentElement) {
            successModal.remove();
        }
    }, 3000);
}

// Función para mostrar modal de confirmación personalizado
function showConfirmDeleteModal(tradeTitle, onConfirm) {
    return new Promise((resolve) => {
        const confirmModal = document.createElement('div');
        confirmModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        confirmModal.innerHTML = `
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 text-center shadow-xl">
                        <div class="text-6xl mb-4">🗑️</div>
                        <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">¿Estás seguro de que quieres eliminar este intercambio?</h3>
                        <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 mb-6">
                            <p class="text-gray-800 dark:text-gray-200 font-semibold">"${tradeTitle}"</p>
                        </div>
                        <p class="text-gray-600 dark:text-gray-300 mb-6">⚠️ Esta acción no se puede deshacer.</p>
                        <div class="flex gap-3 justify-center">
                            <button id="cancelDelete" 
                                    class="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                                Cancelar
                            </button>
                            <button id="confirmDelete" 
                                    class="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                                🗑️ Eliminar
                            </button>
                        </div>
                    </div>
                `;

        document.body.appendChild(confirmModal);

        // Eventos
        const cancelBtn = confirmModal.querySelector('#cancelDelete');
        const confirmBtn = confirmModal.querySelector('#confirmDelete');

        cancelBtn.addEventListener('click', () => {
            confirmModal.remove();
            resolve(false);
        });

        confirmBtn.addEventListener('click', () => {
            confirmModal.remove();
            resolve(true);
        });

        // ESC para cancelar
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                confirmModal.remove();
                document.removeEventListener('keydown', handleEsc);
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleEsc);

        // Click fuera del modal para cancelar
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                confirmModal.remove();
                resolve(false);
            }
        });
    });
}

// Función genérica para mostrar modal de confirmación personalizado
function showCustomConfirmModal(title, message, itemName = '', type = 'delete') {
    return new Promise((resolve) => {
        const confirmModal = document.createElement('div');
        confirmModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

        // Configurar icono y colores según el tipo
        let icon, confirmButtonClass, confirmButtonText;
        switch (type) {
            case 'delete':
                icon = '🗑️';
                confirmButtonClass = 'bg-red-500 hover:bg-red-600';
                confirmButtonText = '🗑️ Eliminar';
                break;
            case 'warning':
                icon = '⚠️';
                confirmButtonClass = 'bg-orange-500 hover:bg-orange-600';
                confirmButtonText = '⚠️ Confirmar';
                break;
            default:
                icon = '❓';
                confirmButtonClass = 'bg-blue-500 hover:bg-blue-600';
                confirmButtonText = '✅ Confirmar';
        }

        confirmModal.innerHTML = `
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 text-center shadow-xl">
                        <div class="text-6xl mb-4">${icon}</div>
                        <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">${title}</h3>
                        ${itemName ? `
                            <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 mb-6">
                                <p class="text-gray-800 dark:text-gray-200 font-semibold">"${itemName}"</p>
                            </div>
                        ` : ''}
                        <p class="text-gray-600 dark:text-gray-300 mb-6">${message}</p>
                        <div class="flex gap-3 justify-center">
                            <button id="cancelCustomConfirm" 
                                    class="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                                Cancelar
                            </button>
                            <button id="confirmCustomConfirm" 
                                    class="${confirmButtonClass} text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                                ${confirmButtonText}
                            </button>
                        </div>
                    </div>
                `;

        document.body.appendChild(confirmModal);

        // Eventos
        const cancelBtn = confirmModal.querySelector('#cancelCustomConfirm');
        const confirmBtn = confirmModal.querySelector('#confirmCustomConfirm');

        cancelBtn.addEventListener('click', () => {
            confirmModal.remove();
            resolve(false);
        });

        confirmBtn.addEventListener('click', () => {
            confirmModal.remove();
            resolve(true);
        });

        // ESC para cancelar
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                confirmModal.remove();
                document.removeEventListener('keydown', handleEsc);
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleEsc);

        // Click fuera del modal para cancelar
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                confirmModal.remove();
                resolve(false);
            }
        });
    });
}

// Función para generar selector de condición de carta
function createConditionSelector(selectedCondition = 'NM', onChangeCallback = null) {
    const select = document.createElement('select');
    select.className = 'condition-selector text-xs px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400';

    Object.values(CARD_CONDITIONS).forEach(condition => {
        const option = document.createElement('option');
        option.value = condition.code;
        option.textContent = `${condition.icon} ${condition.name}`;
        option.style.backgroundColor = condition.color;
        option.style.color = 'white';

        if (condition.code === selectedCondition) {
            option.selected = true;
        }

        select.appendChild(option);
    });

    if (onChangeCallback) {
        select.addEventListener('change', (e) => {
            onChangeCallback(e.target.value);
        });
    }

    return select;
}

// Función para mostrar información de condición al hacer hover
function showConditionInfo(conditionCode) {
    const condition = CARD_CONDITIONS[conditionCode];
    if (!condition) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'condition-tooltip absolute z-50 bg-gray-900 text-white text-xs rounded-lg p-2 max-w-xs shadow-lg';
    tooltip.innerHTML = `
                <div class="font-semibold mb-1">${condition.icon} ${condition.name}</div>
                <div class="text-gray-300">${condition.description}</div>
            `;

    return tooltip;
}

// Función para obtener el color de una condición
function getConditionColor(conditionCode) {
    return CARD_CONDITIONS[conditionCode]?.color || '#6B7280';
}

// Función para obtener el icono de una condición
function getConditionIcon(conditionCode) {
    return CARD_CONDITIONS[conditionCode]?.icon || '❓';
}

// Función para inicializar FAQ
function initializeFAQ() {
    const faqQuestions = document.querySelectorAll('.faq-question');

    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const icon = question.querySelector('span:last-child');

            // Toggle respuesta
            if (answer.classList.contains('hidden')) {
                answer.classList.remove('hidden');
                answer.classList.add('show');
                icon.textContent = '−';
            } else {
                answer.classList.add('hidden');
                answer.classList.remove('show');
                icon.textContent = '+';
            }
        });
    });
}

// Función para actualizar estadísticas en la UI
function updateProfileStats(totalCards, uniqueCards, uniqueSets, completedTrades, cards = []) {
    const totalCardsElement = document.getElementById('totalCardsCount');
    const uniqueCardsElement = document.getElementById('uniqueCardsCount');
    const uniqueSetsElement = document.getElementById('uniqueSetsCount');
    const completedTradesElement = document.getElementById('completedTradesCount');
    const totalValueElement = document.getElementById('totalCollectionValue');

    if (totalCardsElement) {
        totalCardsElement.textContent = totalCards;
    }
    if (uniqueCardsElement) uniqueCardsElement.textContent = uniqueCards;
    if (uniqueSetsElement) uniqueSetsElement.textContent = uniqueSets;
    if (completedTradesElement) completedTradesElement.textContent = completedTrades;

    // Calcular valor total de la colección
    if (totalValueElement && cards.length > 0) {
        const totalValue = calculateCollectionValue(cards);
        totalValueElement.textContent = formatCurrency(totalValue);
    } else if (totalValueElement) {
        totalValueElement.textContent = '€0.00';
    }
}

// Función para calcular el valor total de la colección
function calculateCollectionValue(cards) {
    let totalValue = 0;

    cards.forEach(card => {
        // Obtener el precio base de la carta según su rareza
        const basePrice = getCardBasePrice(card.rarity || 'Common');

        // Aplicar multiplicadores según la condición
        const conditionMultiplier = getConditionMultiplier(card.condition || 'NM');

        // Aplicar multiplicador según el idioma (cartas en inglés suelen valer más)
        const languageMultiplier = getLanguageMultiplier(card.language || 'Español');

        // Calcular precio final de la carta
        const cardValue = basePrice * conditionMultiplier * languageMultiplier;

        totalValue += cardValue;
    });

    return totalValue;
}

// Función para obtener el precio base según la rareza
function getCardBasePrice(rarity) {
    const basePrices = {
        'Common': 0.10,
        'Uncommon': 0.25,
        'Rare': 1.00,
        'Rare Holo': 3.00,
        'Rare Ultra': 5.00,
        'Rare Secret': 10.00,
        'Rare Rainbow': 15.00,
        'Rare Gold': 20.00,
        'Rare Shiny': 8.00,
        'Rare Shiny GX': 25.00,
        'Rare Shiny V': 30.00,
        'Rare Shiny VMAX': 50.00,
        'Rare Shiny GX Rainbow': 100.00,
        'Rare Shiny V Rainbow': 120.00,
        'Rare Shiny VMAX Rainbow': 200.00,
        'Rare Shiny Gold': 150.00,
        'Rare Shiny Gold GX': 300.00,
        'Rare Shiny Gold V': 400.00,
        'Rare Shiny Gold VMAX': 600.00,
        'Rare Shiny Gold Rainbow': 800.00,
        'Rare Shiny Gold Rainbow GX': 1000.00,
        'Rare Shiny Gold Rainbow V': 1200.00,
        'Rare Shiny Gold Rainbow VMAX': 1500.00,
        'Rare Shiny Gold Rainbow GX Rainbow': 2000.00,
        'Rare Shiny Gold Rainbow V Rainbow': 2500.00,
        'Rare Shiny Gold Rainbow VMAX Rainbow': 3000.00,
        'Rare Shiny Gold Rainbow GX Rainbow Gold': 5000.00,
        'Rare Shiny Gold Rainbow V Rainbow Gold': 7500.00,
        'Rare Shiny Gold Rainbow VMAX Rainbow Gold': 10000.00
    };

    return basePrices[rarity] || 0.50; // Precio por defecto
}

// Función para obtener el multiplicador según la condición
function getConditionMultiplier(condition) {
    const conditionMultipliers = {
        'M': 1.5,    // Mint - 50% más
        'NM': 1.0,   // Near Mint - precio base
        'EX': 0.8,   // Excellent - 20% menos
        'GD': 0.6,   // Good - 40% menos
        'LP': 0.4,   // Light Played - 60% menos
        'PL': 0.2,   // Played - 80% menos
        'PO': 0.1    // Poor - 90% menos
    };

    return conditionMultipliers[condition] || 1.0;
}

// Función para obtener el multiplicador según el idioma
function getLanguageMultiplier(language) {
    const languageMultipliers = {
        'English': 1.2,    // Inglés - 20% más
        'Español': 1.0,    // Español - precio base
        'Français': 0.9,   // Francés - 10% menos
        'Deutsch': 0.9,    // Alemán - 10% menos
        'Italiano': 0.9,   // Italiano - 10% menos
        'Português': 0.9,  // Portugués - 10% menos
        '日本語': 1.1,      // Japonés - 10% más
        '한국어': 1.0,      // Coreano - precio base
        '中文': 1.0,        // Chino - precio base
        'Русский': 0.8     // Ruso - 20% menos
    };

    return languageMultipliers[language] || 1.0;
}

// Función para formatear moneda
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// Función para cargar desglose por sets
async function loadSetsBreakdown(cards) {
    const setsBreakdownElement = document.getElementById('setsBreakdown');
    if (!setsBreakdownElement) return;

    try {
        // Agrupar cartas por set
        const setsMap = new Map();
        cards.forEach(card => {
            const setName = (typeof card.set === 'string' ? card.set : card.set?.name) || 'Sin Set';
            if (!setsMap.has(setName)) {
                setsMap.set(setName, []);
            }
            setsMap.get(setName).push(card);
        });

        // Crear HTML para el desglose
        if (setsMap.size === 0) {
            setsBreakdownElement.innerHTML = `
                        <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                            <p>No hay cartas en tu colección</p>
                        </div>
                    `;
            return;
        }

        let setsHTML = '';
        setsMap.forEach((cardsInSet, setName) => {
            setsHTML += `
                        <div class="set-item bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                            <div class="flex justify-between items-center">
                                <div>
                                    <h4 class="font-semibold text-gray-800 dark:text-gray-100">${setName}</h4>
                                    <p class="text-sm text-gray-600 dark:text-gray-300">${cardsInSet.length} cartas</p>
                                </div>
                                <div class="text-right">
                                    <div class="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                        <div class="h-full bg-orange-500 rounded-full" style="width: ${Math.min(100, (cardsInSet.length / 10) * 100)}%"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
        });

        setsBreakdownElement.innerHTML = setsHTML;

    } catch (error) {
        console.error('❌ Error al cargar desglose por sets:', error);
        setsBreakdownElement.innerHTML = `
                    <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                        <p>Error al cargar el desglose por sets</p>
                    </div>
                `;
    }
}

// --- Funciones del Modal de Autenticación ---
function showAuthModal(mode) {
    if (!authModal) {
        console.error('❌ authModal not found!');
        return;
    }

    console.log('🔧 Adding show class to authModal');
    authModal.classList.add('show');

    const forgotPasswordForm = document.getElementById('forgotPasswordForm');

    if (mode === 'login') {
        if (loginForm) loginForm.classList.remove('hidden');
        if (registerForm) registerForm.classList.add('hidden');
        if (forgotPasswordForm) forgotPasswordForm.classList.add('hidden');
    } else if (mode === 'register') {
        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.remove('hidden');
        if (forgotPasswordForm) forgotPasswordForm.classList.add('hidden');
    } else if (mode === 'forgot') {
        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.add('hidden');
        if (forgotPasswordForm) forgotPasswordForm.classList.remove('hidden');
    }
}

// Hacer funciones disponibles globalmente
window.showAuthModal = showAuthModal;

function hideAuthModal() {
    if (authModal) authModal.classList.remove('show');
}

// --- Función de Búsqueda de Cartas (MEJORADA) ---
async function fetchCards(query) {
    console.log('🔍 fetchCards called with query:', query);

    if (!cardsContainer) {
        console.error('❌ cardsContainer not found!');
        return;
    }

    // Limpiar resultados anteriores
    cardsContainer.innerHTML = '';
    if (noResultsMessage) noResultsMessage.classList.add('hidden');
    if (errorMessage) errorMessage.classList.add('hidden');

    // Validar mínimo de caracteres
    if (query.length > 0 && query.length < 2) {
        if (noResultsMessage) {
            noResultsMessage.textContent = 'Por favor, escribe al menos 2 caracteres para buscar.';
            noResultsMessage.classList.remove('hidden');
        }
        if (cardsContainer) cardsContainer.innerHTML = '';
        hideLoadingSpinner();
        return;
    }

    // Si la query está vacía y no hay filtros activos, no buscar
    const hasActiveFilters = searchFiltersState.series || searchFiltersState.set ||
        searchFiltersState.rarity || searchFiltersState.type;
    if (query.length === 0 && !hasActiveFilters) {
        hideLoadingSpinner();
        return;
    }

    const searchQuery = query;

    showLoadingSpinner();
    showSearchResults();

    try {
        // Construir URL optimizada con paginación - usar sintaxis simple que funciona
        const base = searchQuery.toLowerCase();
        lastSearchBase = base;
        searchPage = 1;
        searchPageSize = 20;

        // Generar ID único para esta búsqueda (para cache)
        currentSearchId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        console.log('🆔 Nueva búsqueda con ID:', currentSearchId);
        const apiUrl = buildCardsApiUrl(base, searchPage, searchPageSize);

        console.log('🌐 Fetching from URL:', apiUrl);

        // Hacer petición con timeout mejorado
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('⏰ Timeout alcanzado, abortando petición...');
            controller.abort();
        }, 60000); // Aumentado a 60s para dar más tiempo al API

        let response;
        try {
            response = await fetch(apiUrl, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                console.log('🔄 Petición cancelada por timeout');
                throw new Error('TIMEOUT');
            }
            throw fetchError;
        }

        console.log('📡 Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response:', errorText);
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const cards = data.data || [];

        console.log('✅ API Response received:', {
            totalCount: data.pagination?.total || data.totalCount || 0,
            cardsReturned: cards.length,
            localResults: data.localResults || 0,
            apiResults: data.apiResults || 0,
            combinedResults: data.combinedResults || 0
        });

        // Render paginación
        const totalCount = data.pagination?.total || data.totalCount || 0;
        renderPagination(totalCount, searchPage, searchPageSize);

        if (cards.length > 0) {
            // Usar la función de renderizado estándar para consistencia
            renderCardsFromData(cards);

            console.log('✅ All cards rendered successfully');
        } else {
            console.log('ℹ️ No cards found for query:', searchQuery);
            if (noResultsMessage) {
                // Crear mensaje más específico basado en los filtros aplicados
                let message = `No se encontraron cartas para "${searchQuery}".`;

                const activeFilters = [];
                if (searchFiltersState.series) activeFilters.push(`Serie: ${searchFiltersState.series}`);
                if (searchFiltersState.set) activeFilters.push(`Set: ${searchFiltersState.set}`);
                if (searchFiltersState.rarity) activeFilters.push(`Rareza: ${searchFiltersState.rarity}`);
                if (searchFiltersState.type) activeFilters.push(`Tipo: ${searchFiltersState.type}`);
                if (searchFiltersState.language) activeFilters.push(`Idioma: ${searchFiltersState.language}`);

                if (activeFilters.length > 0) {
                    message += `\n\nFiltros aplicados: ${activeFilters.join(', ')}`;
                    message += `\n\n💡 Sugerencias:`;
                    message += `\n• Verifica que el set "${searchFiltersState.set}" exista en la base de datos`;
                    message += `\n• Prueba con filtros menos específicos`;
                    message += `\n• Usa el botón "Limpiar" para quitar todos los filtros`;
                } else {
                    message += ` Intenta con otro nombre.`;
                }

                noResultsMessage.textContent = message;
                noResultsMessage.classList.remove('hidden');
            }
        }

        // Ocultar spinner de carga
        hideLoadingSpinner();

    } catch (error) {
        console.error('❌ Error completo en fetchCards:', error);

        // Si es timeout, intentar con búsqueda más simple y menos resultados
        if ((error.name === 'AbortError' || error.message.includes('408') || error.message === 'TIMEOUT') && !searchQuery.includes('_retry')) {
            console.log('🔄 Timeout detectado, reintentando con búsqueda optimizada...');

            try {
                // Usar búsqueda más simple para el retry
                const retryUrl = buildCardsApiUrl(searchQuery.toLowerCase(), 1, 20);
                console.log('🔄 Retry URL (búsqueda exacta):', retryUrl);

                const retryController = new AbortController();
                const retryTimeoutId = setTimeout(() => {
                    console.log('⏰ Retry timeout alcanzado');
                    retryController.abort();
                }, 30000); // 30 segundos para retry

                let retryResponse;
                try {
                    retryResponse = await fetch(retryUrl, {
                        signal: retryController.signal,
                        headers: { 'Content-Type': 'application/json' }
                    });
                    clearTimeout(retryTimeoutId);
                } catch (retryError) {
                    clearTimeout(retryTimeoutId);
                    throw retryError;
                }

                if (retryResponse.ok) {
                    const retryData = await retryResponse.json();
                    const retryCards = retryData.data || [];

                    console.log('✅ Retry successful:', retryCards.length, 'cards');

                    // Mostrar mensaje de retry con opción de cargar más
                    if (errorMessage) {
                        errorMessage.innerHTML = `
                                    ⚠️ Búsqueda optimizada: ${retryCards.length} cartas encontradas. La API está lenta hoy.<br>
                                    <button onclick="loadMoreResults('${query}')" class="btn-primary px-4 py-2 mt-2 rounded-lg text-sm">
                                        🔄 Intentar Cargar Más Cartas
                                    </button>
                                `;
                        errorMessage.classList.remove('hidden');
                    }

                    // Renderizar cartas del retry
                    if (retryCards.length > 0) {
                        retryCards.forEach((card, index) => {
                            const cardElement = document.createElement('div');
                            cardElement.className = 'card-bg rounded-xl shadow-lg overflow-hidden transform transition-transform hover:scale-105';

                            // Función para escapar caracteres especiales
                            const escapeForOnclick = (str) => {
                                return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
                            };

                            const safeCardId = escapeForOnclick(card.id);
                            const safeCardName = escapeForOnclick(card.name);
                            const safeSetName = escapeForOnclick(card.set?.name || 'N/A');
                            const safeSeries = escapeForOnclick(card.set?.series || 'N/A');
                            const safeNumber = escapeForOnclick(card.number || 'N/A');
                            const safeImageUrl = escapeForOnclick(card.images?.small);

                            cardElement.innerHTML = `
                                        <img src="${card.images?.small || 'https://placehold.co/400x550/a0aec0/ffffff?text=Sin+imagen'}"
                                             alt="${card.name || 'Carta sin nombre'}"
                                             class="w-full h-auto object-cover rounded-t-xl"
                                             onerror="this.src='https://placehold.co/400x550/a0aec0/ffffff?text=Error+imagen'">
                                        <div class="p-4">
                                            <h3 class="text-xl font-semibold mb-2 text-gray-900 dark:text-white">${card.name || 'Nombre no disponible'}</h3>
                                            <p class="text-gray-600 text-sm mb-3">Set: ${card.set?.name || 'N/A'}</p>
                                            <p class="text-gray-600 text-sm mb-3">Serie: ${card.set?.series || 'N/A'}</p>
                                            <p class="text-gray-600 text-sm mb-3">Número: ${card.number || 'N/A'}</p>
                                            <button class="w-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 mb-3 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                                                    onclick="showCardOffers('${safeCardName}', '${safeSetName}', '${safeImageUrl}')">
                                                <span>🤝</span>
                                                <span>Ofrecidas: ${getCardOffersCount(card.name, card.set?.name || '')}</span>
                                            </button>
                                            <div class="flex justify-between items-center gap-2">
                                                <button class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold"
                                                        onclick="showCardDetailsOnly('${safeCardId}', '${safeCardName}', '${safeImageUrl}', '${safeSetName}', '${safeSeries}', '${safeNumber}')">
                                                    Ver Detalles
                                                </button>
                                                <button class="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold"
                                                        onclick="addCardDirectly('${safeCardId}', '${safeCardName}', '${safeImageUrl}', '${safeSetName}', '${safeSeries}', '${safeNumber}')">
                                                    + Añadir
                                                </button>
                                            </div>
                                        </div>
                                    `;
                            cardsContainer.appendChild(cardElement);
                        });

                        hideLoadingSpinner();
                        return; // Exit successfully
                    }
                }
            } catch (retryError) {
                console.error('❌ Retry también falló:', retryError);
            }
        }

        let errorMsg = '';
        let suggestions = '';

        if (error.name === 'AbortError' || error.message === 'TIMEOUT') {
            errorMsg = '⏰ La búsqueda está tardando demasiado tiempo.';
            suggestions = `
                        <div class="mt-2 text-sm">
                            <strong>Sugerencias:</strong>
                            <ul class="list-disc list-inside mt-1 text-gray-600 dark:text-gray-400">
                                <li>Intenta con un nombre más corto o específico</li>
                                <li>Busca solo una palabra (ej: "Pikachu" en vez de "Pikachu VMAX")</li>
                                <li>Espera unos segundos antes de reintentar</li>
                            </ul>
                        </div>
                    `;
        } else if (error.message.includes('Failed to fetch')) {
            errorMsg = '🌐 Problema de conexión con el servidor.';
            suggestions = '<small class="text-gray-600 dark:text-gray-400">Verifica tu conexión a internet.</small>';
        } else if (error.message.includes('504')) {
            errorMsg = '⚠️ El servidor de Pokémon TCG no responde.';
            suggestions = '<small class="text-gray-600 dark:text-gray-400">El servicio puede estar sobrecargado. Intenta más tarde.</small>';
        } else {
            errorMsg = '❌ Error al buscar cartas.';
            suggestions = '<small class="text-gray-600 dark:text-gray-400">Intenta de nuevo en unos momentos.</small>';
        }

        if (errorMessage) {
            errorMessage.innerHTML = `
                        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                            <div class="text-yellow-800 dark:text-yellow-200 font-semibold">${errorMsg}</div>
                            ${suggestions}
                            <button onclick="fetchCards('${query}')" 
                                    class="mt-3 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                                🔄 Reintentar Búsqueda
                            </button>
                        </div>
                    `;
            errorMessage.classList.remove('hidden');
        }
    } finally {
        hideLoadingSpinner();
    }
}

// Función corregida para obtener cartas de un set
async function fetchAllCardsInSet(setId) {
    console.log(`Obteniendo todas las cartas del set: ${setId}`);

    try {
        // URL corregida para usar tu función pokemon-proxy
        const response = await fetch(`/api/pokemontcg/cards?q=set.id:${setId}&pageSize=250`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log(`Obtenidas ${data.data?.length || 0} cartas del set ${setId}`);
        return data.data || [];

    } catch (error) {
        console.error('Error al obtener cartas del set:', error);
        if (myCardsErrorMessage) {
            myCardsErrorMessage.textContent = 'Error al cargar las cartas de esta expansión.';
            myCardsErrorMessage.classList.remove('hidden');
        }
        return [];
    }
}
// Función para cargar la colección del usuario
async function loadMyCollection(userId) {
    if (!myCardsContainer) return;

    myCardsContainer.innerHTML = '';
    if (noMyCardsMessage) noMyCardsMessage.classList.add('hidden');
    if (myCardsErrorMessage) myCardsErrorMessage.classList.add('hidden');
    showLoadingSpinner();

    try {
        // Si tenemos sincronización activa, usar los datos del cache
        if (dataSync && userCardsCache.length > 0) {
            console.log('📦 Usando datos sincronizados de la colección');
        } else {
            // Fallback: cargar desde Firestore directamente
            console.log('📦 Cargando colección desde Firestore...');
            const myCardsCollectionRef = collection(db, `users/${userId}/my_cards`);
            const querySnapshot = await getDocs(myCardsCollectionRef);
            userCardsCache = [];

            querySnapshot.forEach(doc => {
                userCardsCache.push({ id: doc.id, ...doc.data() });
            });
        }

        // Aplicar filtros
        const selectedSeries = seriesFilter?.value || '';
        const selectedSetId = setFilter?.value || '';
        const selectedLanguage = languageFilter?.value || '';
        const showAll = showAllSetCardsToggle?.checked || false;

        let cardsToDisplay = [];

        if (showAll && selectedSetId) {
            // Mostrar todas las cartas del set (incluyendo faltantes)
            // fetchAllCardsInSet ya devuelve datos completos de PostgreSQL (con precios)
            const allCardsInSet = await fetchAllCardsInSet(selectedSetId);
            const ownedCardIds = new Set(userCardsCache.map(card => card.id));

            allCardsInSet.forEach(apiCard => {
                const matchesSeries = selectedSeries === "" || (apiCard.set && apiCard.set.series === selectedSeries);
                const matchesLanguage = selectedLanguage === "" || (ownedCardIds.has(apiCard.id) && userCardsCache.find(c => c.id === apiCard.id).language === selectedLanguage);

                if (matchesSeries && matchesLanguage) {
                    if (ownedCardIds.has(apiCard.id)) {
                        const ownedCard = userCardsCache.find(c => c.id === apiCard.id);
                        // Incluir precios del registro de PostgreSQL directamente
                        const cmPrice = apiCard.cardmarket?.avg30 || apiCard.cardmarket?.avg1 || apiCard.cardmarket?.avg || null;
                        const tcgPrice = apiCard.tcgplayer?.normal?.marketPrice || apiCard.tcgplayer?.holofoil?.marketPrice || null;
                        cardsToDisplay.push({ ...ownedCard, isOwned: true, marketPrices: { cardmarket: cmPrice, tcgplayer: tcgPrice } });
                    } else {
                        cardsToDisplay.push({
                            id: apiCard.id,
                            name: apiCard.name,
                            number: apiCard.number,
                            imageUrl: 'https://placehold.co/400x550/e2e8f0/4a5568?text=Falta',
                            set: apiCard.set ? apiCard.set.name : 'N/A',
                            series: apiCard.set && apiCard.set.series ? apiCard.set.series : 'N/A',
                            language: 'N/A',
                            isOwned: false
                        });
                    }
                }
            });

            // Ordenar por número de carta
            cardsToDisplay.sort((a, b) => {
                const numA = parseInt(a.number, 10) || Infinity;
                const numB = parseInt(b.number, 10) || Infinity;
                return numA - numB;
            });

        } else {
            // Modo normal: solo cartas poseídas
            let filteredCards = userCardsCache.filter(card => {
                const matchesSeries = selectedSeries === "" || card.series === selectedSeries;
                const matchesSet = selectedSetId === "" || card.setId === selectedSetId;
                const matchesLanguage = selectedLanguage === "" || card.language === selectedLanguage;
                return matchesSeries && matchesSet && matchesLanguage;
            });

            filteredCards.sort((a, b) => {
                if (a.set !== b.set) return a.set.localeCompare(b.set);
                const numA = parseInt(a.number, 10) || Infinity;
                const numB = parseInt(b.number, 10) || Infinity;
                return numA - numB;
            });

            // Obtener precios de PostgreSQL en una sola petición batch
            if (filteredCards.length > 0) {
                try {
                    const ids = filteredCards.map(c => c.id).join(',');
                    const priceRes = await fetch(`/api/pokemontcg/cards/prices?ids=${encodeURIComponent(ids)}`);
                    const priceData = await priceRes.json();
                    if (priceData.success) {
                        filteredCards = filteredCards.map(card => ({
                            ...card,
                            marketPrices: priceData.data[card.id] || { cardmarket: null, tcgplayer: null }
                        }));
                    }
                } catch (e) {
                    console.warn('No se pudieron obtener precios de mercado:', e);
                }
            }

            cardsToDisplay = filteredCards;
        }

        renderCardsInCollection(cardsToDisplay);

        if (cardsToDisplay.length === 0) {
            if (noMyCardsMessage) {
                noMyCardsMessage.textContent = 'No se encontraron cartas con los filtros aplicados.';
                noMyCardsMessage.classList.remove('hidden');
            }
        }

    } catch (error) {
        console.error('Error al cargar la colección:', error);
        if (myCardsErrorMessage) myCardsErrorMessage.classList.remove('hidden');
    } finally {
        hideLoadingSpinner();
    }
}

// Función para renderizar cartas en la colección (nuevo diseño de lista)
function renderCardsInCollection(cards) {
    if (!myCardsContainer) return;

    myCardsContainer.innerHTML = '';

    if (cards.length === 0) {
        if (noMyCardsMessage) noMyCardsMessage.classList.remove('hidden');
        return;
    }

    // Cambiar el contenedor a diseño de lista
    myCardsContainer.className = 'space-y-1 border rounded-lg bg-white dark:bg-gray-800';

    cards.forEach((card, index) => {
        const isOwned = card.isOwned !== undefined ? card.isOwned : true;
        const imageUrl = card.imageUrl;

        const row = document.createElement('div');
        // Use auto height to accommodate price rows
        row.className = 'relative flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 overflow-visible';
        if (index < cards.length - 1) {
            row.className += ' border-b';
        }

        // Icono de imagen con hover
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'w-10 h-10 flex items-center justify-center bg-transparent rounded cursor-pointer absolute left-3 top-3 z-10';
        imgWrapper.title = 'Pasa el mouse para ver imagen';
        imgWrapper.innerHTML = isOwned ? '<span class="text-xl">🎴</span>' : '<span class="text-xl opacity-50">🎴</span>';

        // Contenedor de imagen con hover
        const imgContainer = document.createElement('div');
        imgContainer.className = 'hidden absolute left-14 top-0 z-30';
        imgContainer.style.pointerEvents = 'none';

        const imgEl = document.createElement('img');
        imgEl.src = imageUrl || 'https://placehold.co/400x550/a0aec0/ffffff?text=Sin+imagen';
        imgEl.alt = card.name || 'Carta';
        imgEl.className = 'w-64 h-auto object-contain rounded-lg shadow-2xl border-2 border-gray-200';
        imgEl.onerror = () => { imgEl.src = 'https://placehold.co/400x550/a0aec0/ffffff?text=Error'; };

        imgContainer.appendChild(imgEl);
        row.appendChild(imgContainer);

        // Eventos de hover
        imgWrapper.addEventListener('mouseenter', () => {
            imgContainer.classList.remove('hidden');
        });

        imgWrapper.addEventListener('mouseleave', () => {
            imgContainer.classList.add('hidden');
        });

        // Información de la carta
        const info = document.createElement('div');
        info.className = 'flex-1 min-w-0 pl-16';

        if (isOwned) {
            const escapedId = (card.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const escapedName = (card.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const escapedSet = (card.set || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const escapedImage = (card.imageUrl || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const escapedCondition = (card.condition || 'NM').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const escapedLanguage = (card.language || 'Español').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const isTransferable = !!card.isTransferable;
            const customPriceDisplay = card.customPrice != null
                ? `<span class="text-orange-600 dark:text-orange-400 font-semibold">💰 ${formatTradePrice(card.customPrice)}</span>`
                : `<span class="text-gray-400 dark:text-gray-500 italic">Sin precio personal</span>`;

            // Precios de mercado ya disponibles desde PostgreSQL (sin llamada extra)
            const mp = card.marketPrices;
            let marketPriceHtml = '<span class="text-gray-400 italic">Sin precio de mercado</span>';
            if (mp && (mp.cardmarket || mp.tcgplayer)) {
                const parts = [];
                if (mp.cardmarket) parts.push(`<span class="text-green-600 dark:text-green-400 font-medium">💳 ${formatTradePrice(mp.cardmarket)}</span>`);
                if (mp.tcgplayer) parts.push(`<span class="text-blue-600 dark:text-blue-400 font-medium">🎮 $${mp.tcgplayer.toFixed(2)}</span>`);
                marketPriceHtml = parts.join('<span class="text-gray-400 mx-1">·</span>');
            }

            const transferableBadge = isTransferable
                ? `<span class="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-0.5 rounded font-semibold">🔄 Transferible</span>`
                : '';

            info.innerHTML = `
                <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-semibold text-gray-900 dark:text-white">${card.name}</span>
                            ${card.quantity > 1 ? `<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">x${card.quantity}</span>` : ''}
                            <span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">En colección</span>
                            ${transferableBadge}
                        </div>
                        <div class="text-xs text-gray-600 dark:text-gray-400">
                            #${card.number} · ${card.set} · ${card.series || 'N/A'} · ${card.language || 'N/A'}
                        </div>
                        <div class="flex items-center gap-2 mt-0.5 flex-wrap text-xs">
                            <span class="text-gray-500 dark:text-gray-400">Mercado:</span>
                            ${marketPriceHtml}
                        </div>
                        <div class="flex items-center gap-2 mt-0.5 text-xs">
                            <span class="text-gray-500 dark:text-gray-400">Personal:</span>
                            ${customPriceDisplay}
                            <button onclick="showEditCustomPriceModal('${escapedId}', '${escapedName}', ${card.customPrice != null ? card.customPrice : 'null'})"
                                    class="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 ml-1"
                                    title="Editar precio personal">✏️</button>
                        </div>
                    </div>
                    <div class="flex flex-col gap-1 flex-shrink-0 items-end">
                        <button onclick="toggleCardTransferable('${escapedId}', '${escapedName}', '${escapedImage}', '${escapedSet}', '${escapedCondition}', '${escapedLanguage}', ${card.customPrice != null ? card.customPrice : 'null'}, ${isTransferable})"
                                class="${isTransferable ? 'bg-purple-500 hover:bg-purple-600 text-white' : 'bg-gray-100 hover:bg-purple-100 text-gray-600 dark:bg-gray-700 dark:hover:bg-purple-900 dark:text-gray-300'} px-3 py-1.5 rounded text-xs font-semibold transition-colors"
                                title="${isTransferable ? 'Quitar de intercambios' : 'Marcar como disponible para intercambio'}">
                            ${isTransferable ? '🔄 Transferible' : '🔒 Marcar transferible'}
                        </button>
                        <button class="btn-secondary px-3 py-1.5 rounded text-xs" onclick="removeCardFromCollection('${escapedId}')">
                            Eliminar
                        </button>
                    </div>
                </div>
            `;
        } else {
            info.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <div class="flex items-center gap-2">
                            <span class="font-semibold text-gray-500 line-through">${card.name}</span>
                            <span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Falta</span>
                        </div>
                        <div class="text-xs text-gray-400">
                            #${card.number} · ${card.set} · ${card.series || 'N/A'}
                        </div>
                    </div>
                    <span class="text-sm text-gray-500 dark:text-gray-400">Falta en tu colección</span>
                </div>
            `;
        }

        row.appendChild(imgWrapper);
        row.appendChild(info);
        myCardsContainer.appendChild(row);
    });
}

// Función para eliminar carta de la colección
window.removeCardFromCollection = async (cardId) => {
    if (!currentUser) {
        alert('Por favor, inicia sesión.');
        return;
    }

    try {
        await deleteDoc(doc(db, `users/${currentUser.uid}/my_cards/${cardId}`));
        // Si estaba marcada como transferible, limpiar también el índice global
        try {
            await deleteDoc(doc(db, 'transferable_cards', cardId, 'users', currentUser.uid));
        } catch (_) { /* ignorar si no existía */ }
        showNotification('Carta eliminada de tu colección', 'success', 3000);

        // Actualizar ambas vistas: Mis Cartas y Mi Colección del perfil
        await loadMyCollection(currentUser.uid);
        if (typeof loadUserCollection === 'function') {
            await loadUserCollection();
        }

        // También actualizar las estadísticas del perfil
        if (typeof loadProfileStats === 'function') {
            await loadProfileStats();
        }
    } catch (error) {
        console.error('Error al eliminar carta:', error);
        showNotification('Error al eliminar la carta. Inténtalo de nuevo.', 'error', 5000);
    }
};

// Función para poblar filtros de búsqueda
async function fetchSetsAndPopulateSearchFilters() {
    if (allSets.length > 0) {
        await populateSearchFilters();
        return;
    }

    console.log('🔄 Cargando sets para filtros de búsqueda...');

    try {
        const response = await fetch('/api/pokemontcg/sets');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        allSets = data.data || [];

        console.log('✅ Sets cargados para filtros:', allSets.length);
        allSets.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

        await populateSearchFilters();

    } catch (error) {
        console.error('Error al cargar sets para filtros:', error);
        // Usar datos locales como fallback - TODAS LAS SERIES Y SETS
        allSets = [
            // BASE SERIES (1996-2000)
            { id: 'base1', name: 'Base', series: 'Base', releaseDate: '1996-10-20' },
            { id: 'base2', name: 'Jungle', series: 'Base', releaseDate: '1999-06-16' },
            { id: 'base3', name: 'Fossil', series: 'Base', releaseDate: '1999-10-10' },
            { id: 'base4', name: 'Base Set 2', series: 'Base', releaseDate: '2000-02-24' },
            { id: 'base5', name: 'Team Rocket', series: 'Base', releaseDate: '2000-04-24' },
            { id: 'base6', name: 'Gym Heroes', series: 'Base', releaseDate: '2000-08-14' },
            { id: 'base7', name: 'Gym Challenge', series: 'Base', releaseDate: '2000-10-16' },
            { id: 'base8', name: 'Neo Genesis', series: 'Base', releaseDate: '2000-12-16' },
            { id: 'base9', name: 'Neo Discovery', series: 'Base', releaseDate: '2001-06-01' },
            { id: 'base10', name: 'Neo Revelation', series: 'Base', releaseDate: '2001-09-21' },
            { id: 'base11', name: 'Neo Destiny', series: 'Base', releaseDate: '2002-02-28' },
            { id: 'base12', name: 'Legendary Collection', series: 'Base', releaseDate: '2002-05-24' },

            // ADVANCED SERIES (2003-2007)
            { id: 'adv1', name: 'Expedition Base Set', series: 'Advanced', releaseDate: '2002-09-15' },
            { id: 'adv2', name: 'Aquapolis', series: 'Advanced', releaseDate: '2003-01-15' },
            { id: 'adv3', name: 'Skyridge', series: 'Advanced', releaseDate: '2003-05-12' },
            { id: 'adv4', name: 'EX Ruby & Sapphire', series: 'Advanced', releaseDate: '2003-06-18' },
            { id: 'adv5', name: 'EX Sandstorm', series: 'Advanced', releaseDate: '2003-09-17' },
            { id: 'adv6', name: 'EX Dragon', series: 'Advanced', releaseDate: '2003-11-24' },
            { id: 'adv7', name: 'EX Team Magma vs Team Aqua', series: 'Advanced', releaseDate: '2004-03-15' },
            { id: 'adv8', name: 'EX Hidden Legends', series: 'Advanced', releaseDate: '2004-06-07' },
            { id: 'adv9', name: 'EX FireRed & LeafGreen', series: 'Advanced', releaseDate: '2004-09-27' },
            { id: 'adv10', name: 'EX Team Rocket Returns', series: 'Advanced', releaseDate: '2004-11-08' },
            { id: 'adv11', name: 'EX Deoxys', series: 'Advanced', releaseDate: '2005-02-14' },
            { id: 'adv12', name: 'EX Emerald', series: 'Advanced', releaseDate: '2005-05-09' },
            { id: 'adv13', name: 'EX Unseen Forces', series: 'Advanced', releaseDate: '2005-08-22' },
            { id: 'adv14', name: 'EX Delta Species', series: 'Advanced', releaseDate: '2005-10-31' },
            { id: 'adv15', name: 'EX Legend Maker', series: 'Advanced', releaseDate: '2006-02-13' },
            { id: 'adv16', name: 'EX Holon Phantoms', series: 'Advanced', releaseDate: '2006-05-03' },
            { id: 'adv17', name: 'EX Crystal Guardians', series: 'Advanced', releaseDate: '2006-08-30' },
            { id: 'adv18', name: 'EX Dragon Frontiers', series: 'Advanced', releaseDate: '2006-11-08' },
            { id: 'adv19', name: 'EX Power Keepers', series: 'Advanced', releaseDate: '2007-02-14' },

            // DIAMOND & PEARL SERIES (2007-2010)
            { id: 'dp1', name: 'Diamond & Pearl', series: 'Diamond & Pearl', releaseDate: '2007-05-01' },
            { id: 'dp2', name: 'Mysterious Treasures', series: 'Diamond & Pearl', releaseDate: '2007-08-15' },
            { id: 'dp3', name: 'Secret Wonders', series: 'Diamond & Pearl', releaseDate: '2007-11-07' },
            { id: 'dp4', name: 'Great Encounters', series: 'Diamond & Pearl', releaseDate: '2008-02-13' },
            { id: 'dp5', name: 'Majestic Dawn', series: 'Diamond & Pearl', releaseDate: '2008-05-21' },
            { id: 'dp6', name: 'Legends Awakened', series: 'Diamond & Pearl', releaseDate: '2008-08-20' },
            { id: 'dp7', name: 'Stormfront', series: 'Diamond & Pearl', releaseDate: '2008-11-05' },
            { id: 'dp8', name: 'Platinum', series: 'Diamond & Pearl', releaseDate: '2009-02-11' },
            { id: 'dp9', name: 'Rising Rivals', series: 'Diamond & Pearl', releaseDate: '2009-05-20' },
            { id: 'dp10', name: 'Supreme Victors', series: 'Diamond & Pearl', releaseDate: '2009-08-19' },
            { id: 'dp11', name: 'Arceus', series: 'Diamond & Pearl', releaseDate: '2009-11-04' },

            // HEARTGOLD & SOULSILVER SERIES (2010-2011)
            { id: 'hgss1', name: 'HeartGold & SoulSilver', series: 'HeartGold & SoulSilver', releaseDate: '2010-02-10' },
            { id: 'hgss2', name: 'Unleashed', series: 'HeartGold & SoulSilver', releaseDate: '2010-05-12' },
            { id: 'hgss3', name: 'Undaunted', series: 'HeartGold & SoulSilver', releaseDate: '2010-08-18' },
            { id: 'hgss4', name: 'Triumphant', series: 'HeartGold & SoulSilver', releaseDate: '2010-11-03' },
            { id: 'hgss5', name: 'Call of Legends', series: 'HeartGold & SoulSilver', releaseDate: '2011-02-09' },

            // BLACK & WHITE SERIES (2011-2013)
            { id: 'bw1', name: 'Black & White', series: 'Black & White', releaseDate: '2011-04-25' },
            { id: 'bw2', name: 'Emerging Powers', series: 'Black & White', releaseDate: '2011-08-31' },
            { id: 'bw3', name: 'Noble Victories', series: 'Black & White', releaseDate: '2011-11-16' },
            { id: 'bw4', name: 'Next Destinies', series: 'Black & White', releaseDate: '2012-02-08' },
            { id: 'bw5', name: 'Dark Explorers', series: 'Black & White', releaseDate: '2012-05-09' },
            { id: 'bw6', name: 'Dragons Exalted', series: 'Black & White', releaseDate: '2012-08-15' },
            { id: 'bw7', name: 'Boundaries Crossed', series: 'Black & White', releaseDate: '2012-11-07' },
            { id: 'bw8', name: 'Plasma Storm', series: 'Black & White', releaseDate: '2013-02-06' },
            { id: 'bw9', name: 'Plasma Freeze', series: 'Black & White', releaseDate: '2013-05-08' },
            { id: 'bw10', name: 'Plasma Blast', series: 'Black & White', releaseDate: '2013-08-14' },
            { id: 'bw11', name: 'Legendary Treasures', series: 'Black & White', releaseDate: '2013-11-08' },

            // XY SERIES (2014-2016)
            { id: 'xy1', name: 'XY', series: 'XY', releaseDate: '2014-02-05' },
            { id: 'xy2', name: 'Flashfire', series: 'XY', releaseDate: '2014-05-07' },
            { id: 'xy3', name: 'Furious Fists', series: 'XY', releaseDate: '2014-08-13' },
            { id: 'xy4', name: 'Phantom Forces', series: 'XY', releaseDate: '2014-11-05' },
            { id: 'xy5', name: 'Primal Clash', series: 'XY', releaseDate: '2015-02-04' },
            { id: 'xy6', name: 'Roaring Skies', series: 'XY', releaseDate: '2015-05-06' },
            { id: 'xy7', name: 'Ancient Origins', series: 'XY', releaseDate: '2015-08-12' },
            { id: 'xy8', name: 'BREAKthrough', series: 'XY', releaseDate: '2015-11-04' },
            { id: 'xy9', name: 'BREAKpoint', series: 'XY', releaseDate: '2016-02-03' },
            { id: 'xy10', name: 'Fates Collide', series: 'XY', releaseDate: '2016-05-04' },
            { id: 'xy11', name: 'Steam Siege', series: 'XY', releaseDate: '2016-08-03' },
            { id: 'xy12', name: 'Evolutions', series: 'XY', releaseDate: '2016-11-02' },

            // SUN & MOON SERIES (2017-2019)
            { id: 'sm1', name: 'Sun & Moon', series: 'Sun & Moon', releaseDate: '2017-02-03' },
            { id: 'sm2', name: 'Guardians Rising', series: 'Sun & Moon', releaseDate: '2017-05-05' },
            { id: 'sm3', name: 'Burning Shadows', series: 'Sun & Moon', releaseDate: '2017-08-04' },
            { id: 'sm4', name: 'Crimson Invasion', series: 'Sun & Moon', releaseDate: '2017-11-03' },
            { id: 'sm5', name: 'Ultra Prism', series: 'Sun & Moon', releaseDate: '2018-02-02' },
            { id: 'sm6', name: 'Forbidden Light', series: 'Sun & Moon', releaseDate: '2018-05-04' },
            { id: 'sm7', name: 'Celestial Storm', series: 'Sun & Moon', releaseDate: '2018-08-03' },
            { id: 'sm8', name: 'Lost Thunder', series: 'Sun & Moon', releaseDate: '2018-11-02' },
            { id: 'sm9', name: 'Team Up', series: 'Sun & Moon', releaseDate: '2019-02-01' },
            { id: 'sm10', name: 'Detective Pikachu', series: 'Sun & Moon', releaseDate: '2019-04-05' },
            { id: 'sm11', name: 'Unbroken Bonds', series: 'Sun & Moon', releaseDate: '2019-05-03' },
            { id: 'sm12', name: 'Unified Minds', series: 'Sun & Moon', releaseDate: '2019-08-02' },
            { id: 'sm13', name: 'Hidden Fates', series: 'Sun & Moon', releaseDate: '2019-08-23' },
            { id: 'sm14', name: 'Cosmic Eclipse', series: 'Sun & Moon', releaseDate: '2019-11-01' },

            // SWORD & SHIELD SERIES (2020-2022)
            { id: 'swsh1', name: 'Sword & Shield', series: 'Sword & Shield', releaseDate: '2020-02-07' },
            { id: 'swsh2', name: 'Rebel Clash', series: 'Sword & Shield', releaseDate: '2020-05-01' },
            { id: 'swsh3', name: 'Darkness Ablaze', series: 'Sword & Shield', releaseDate: '2020-08-14' },
            { id: 'swsh4', name: 'Vivid Voltage', series: 'Sword & Shield', releaseDate: '2020-11-13' },
            { id: 'swsh5', name: 'Battle Styles', series: 'Sword & Shield', releaseDate: '2021-03-19' },
            { id: 'swsh6', name: 'Chilling Reign', series: 'Sword & Shield', releaseDate: '2021-06-18' },
            { id: 'swsh7', name: 'Evolving Skies', series: 'Sword & Shield', releaseDate: '2021-08-27' },
            { id: 'swsh8', name: 'Fusion Strike', series: 'Sword & Shield', releaseDate: '2021-11-12' },
            { id: 'swsh9', name: 'Brilliant Stars', series: 'Sword & Shield', releaseDate: '2022-02-25' },
            { id: 'swsh10', name: 'Astral Radiance', series: 'Sword & Shield', releaseDate: '2022-05-27' },
            { id: 'swsh11', name: 'Lost Origin', series: 'Sword & Shield', releaseDate: '2022-09-09' },
            { id: 'swsh12', name: 'Silver Tempest', series: 'Sword & Shield', releaseDate: '2022-11-11' },

            // SCARLET & VIOLET SERIES (2023-2025)
            { id: 'sv1', name: 'Scarlet & Violet', series: 'Scarlet & Violet', releaseDate: '2023-03-31' },
            { id: 'sv2', name: 'Paldea Evolved', series: 'Scarlet & Violet', releaseDate: '2023-06-16' },
            { id: 'sv3', name: 'Obsidian Flames', series: 'Scarlet & Violet', releaseDate: '2023-08-11' },
            { id: 'sv4', name: '151', series: 'Scarlet & Violet', releaseDate: '2023-09-22' },
            { id: 'sv5', name: 'Paradox Rift', series: 'Scarlet & Violet', releaseDate: '2023-11-03' },
            { id: 'sv6', name: 'Paldean Fates', series: 'Scarlet & Violet', releaseDate: '2024-01-26' },
            { id: 'sv7', name: 'Temporal Forces', series: 'Scarlet & Violet', releaseDate: '2024-03-22' },
            { id: 'sv8', name: 'Twilight Masquerade', series: 'Scarlet & Violet', releaseDate: '2024-05-24' },
            { id: 'sv9', name: 'Shrouded Fable', series: 'Scarlet & Violet', releaseDate: '2024-08-30' },
            { id: 'sv10', name: 'Stellar Crown', series: 'Scarlet & Violet', releaseDate: '2024-11-01' },
            { id: 'sv11', name: 'Shrouded Fable', series: 'Scarlet & Violet', releaseDate: '2024-12-13' },
            { id: 'sv12', name: 'Shrouded Fable', series: 'Scarlet & Violet', releaseDate: '2025-01-31' },

            // SETS ESPECIALES Y PROMOCIONALES
            { id: 'pop1', name: 'POP Series 1', series: 'POP', releaseDate: '2004-09-01' },
            { id: 'pop2', name: 'POP Series 2', series: 'POP', releaseDate: '2005-03-01' },
            { id: 'pop3', name: 'POP Series 3', series: 'POP', releaseDate: '2005-09-01' },
            { id: 'pop4', name: 'POP Series 4', series: 'POP', releaseDate: '2006-03-01' },
            { id: 'pop5', name: 'POP Series 5', series: 'POP', releaseDate: '2006-09-01' },
            { id: 'pop6', name: 'POP Series 6', series: 'POP', releaseDate: '2007-03-01' },
            { id: 'pop7', name: 'POP Series 7', series: 'POP', releaseDate: '2007-09-01' },
            { id: 'pop8', name: 'POP Series 8', series: 'POP', releaseDate: '2008-03-01' },
            { id: 'pop9', name: 'POP Series 9', series: 'POP', releaseDate: '2008-09-01' },

            // SETS DE JAPÓN
            { id: 'jpn1', name: 'Base Set (Japón)', series: 'Japón', releaseDate: '1996-10-20' },
            { id: 'jpn2', name: 'Jungle (Japón)', series: 'Japón', releaseDate: '1999-06-16' },
            { id: 'jpn3', name: 'Fossil (Japón)', series: 'Japón', releaseDate: '1999-10-10' },
            { id: 'jpn4', name: 'Team Rocket (Japón)', series: 'Japón', releaseDate: '2000-04-24' },
            { id: 'jpn5', name: 'Gym Heroes (Japón)', series: 'Japón', releaseDate: '2000-08-14' },
            { id: 'jpn6', name: 'Gym Challenge (Japón)', series: 'Japón', releaseDate: '2000-10-16' },
            { id: 'jpn7', name: 'Neo Genesis (Japón)', series: 'Japón', releaseDate: '2000-12-16' },
            { id: 'jpn8', name: 'Neo Discovery (Japón)', series: 'Japón', releaseDate: '2001-06-01' },
            { id: 'jpn9', name: 'Neo Revelation (Japón)', series: 'Japón', releaseDate: '2001-09-21' },
            { id: 'jpn10', name: 'Neo Destiny (Japón)', series: 'Japón', releaseDate: '2002-02-28' },

            // SETS DE EUROPA
            { id: 'eur1', name: 'Base Set (Europa)', series: 'Europa', releaseDate: '1999-10-10' },
            { id: 'eur2', name: 'Jungle (Europa)', series: 'Europa', releaseDate: '1999-06-16' },
            { id: 'eur3', name: 'Fossil (Europa)', series: 'Europa', releaseDate: '1999-10-10' },
            { id: 'eur4', name: 'Team Rocket (Europa)', series: 'Europa', releaseDate: '2000-04-24' },
            { id: 'eur5', name: 'Gym Heroes (Europa)', series: 'Europa', releaseDate: '2000-08-14' },
            { id: 'eur6', name: 'Gym Challenge (Europa)', series: 'Europa', releaseDate: '2000-10-16' },

            // SETS DE AUSTRALIA
            { id: 'aus1', name: 'Base Set (Australia)', series: 'Australia', releaseDate: '1999-10-10' },
            { id: 'aus2', name: 'Jungle (Australia)', series: 'Australia', releaseDate: '1999-06-16' },
            { id: 'aus3', name: 'Fossil (Australia)', series: 'Australia', releaseDate: '1999-10-10' },
            { id: 'aus4', name: 'Team Rocket (Australia)', series: 'Australia', releaseDate: '2000-04-24' },
            { id: 'aus5', name: 'Gym Heroes (Australia)', series: 'Australia', releaseDate: '2000-08-14' },
            { id: 'aus6', name: 'Gym Challenge (Australia)', series: 'Australia', releaseDate: '2000-10-16' }
        ];

        console.log('✅ Sets locales cargados para filtros:', allSets.length);
        await populateSearchFilters();
    }
}

// Función para poblar los filtros de búsqueda con datos reales
async function populateSearchFilters() {
    const filterSeriesSelect = document.getElementById('filterSeriesSelect');
    const filterSetSelect = document.getElementById('filterSetSelect');

    // Obtener sets reales de la base de datos
    const realSets = await fetchRealSetsFromDatabase();

    if (filterSeriesSelect) {
        filterSeriesSelect.innerHTML = '<option value="">Todas las Series</option>';
        const uniqueSeries = [...new Set(realSets.map(set => set.series))].filter(Boolean).sort();
        uniqueSeries.forEach(series => {
            const option = document.createElement('option');
            option.value = series;
            option.textContent = series;
            filterSeriesSelect.appendChild(option);
        });
        console.log('✅ Filtro de series poblado con', uniqueSeries.length, 'series reales');
    }

    if (filterSetSelect) {
        filterSetSelect.innerHTML = '<option value="">Todos los Sets</option>';
        // Ordenar sets de más antiguo a más nuevo (orden cronológico)
        const sortedSets = [...realSets].sort((a, b) => {
            // Mapear nombres de sets a fechas aproximadas para orden cronológico
            const setDates = {
                'Base': '1996-10-20',
                'Jungle': '1999-06-16',
                'Fossil': '1999-10-10',
                'Base Set 2': '2000-02-24',
                'Team Rocket': '2000-04-24',
                'Gym Heroes': '2000-08-14',
                'Gym Challenge': '2000-10-16',
                'Neo Genesis': '2000-12-16',
                'Neo Discovery': '2001-06-01',
                'Neo Revelation': '2001-09-21',
                'Neo Destiny': '2002-02-28',
                'Legendary Collection': '2002-05-24'
            };

            const dateA = setDates[a.name] || '2020-01-01';
            const dateB = setDates[b.name] || '2020-01-01';
            return new Date(dateA) - new Date(dateB);
        });

        sortedSets.forEach(set => {
            const option = document.createElement('option');
            option.value = set.name; // Usar el nombre real de la base de datos
            option.textContent = set.name;
            filterSetSelect.appendChild(option);
        });
        console.log('✅ Filtro de sets poblado con', sortedSets.length, 'sets reales (orden cronológico)');
    }

    // Agregar event listener para el filtro de serie
    if (filterSeriesSelect) {
        filterSeriesSelect.addEventListener('change', () => {
            const selectedSeries = filterSeriesSelect.value;
            searchFiltersState.series = selectedSeries; // Actualizar estado
            if (selectedSeries === "") {
                populateSetFilterForSearch(allSets);
            } else {
                const setsInSeries = allSets.filter(set => set.series === selectedSeries);
                populateSetFilterForSearch(setsInSeries);
            }
            if (filterSetSelect) filterSetSelect.value = "";
            searchFiltersState.set = ""; // Limpiar set cuando cambia serie
        });
    }
}

// Función para poblar el filtro de sets en búsqueda
function populateSetFilterForSearch(setsToDisplay) {
    const filterSetSelect = document.getElementById('filterSetSelect');
    if (!filterSetSelect) return;

    filterSetSelect.innerHTML = '<option value="">Todos los Sets</option>';
    // Ordenar sets de más antiguo a más nuevo
    const sortedSets = [...setsToDisplay].sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
    sortedSets.forEach(set => {
        const option = document.createElement('option');
        option.value = set.name;
        option.textContent = set.name;
        filterSetSelect.appendChild(option);
    });
}

// Función para obtener sets reales de la base de datos
async function fetchRealSetsFromDatabase() {
    console.log('🔄 Obteniendo sets reales de la base de datos...');

    try {
        const response = await fetch('/api/pokemontcg/sets');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const sets = data.data || [];

        const realSets = sets.map(s => ({
            id: s.id,
            name: s.name,
            series: s.series || 'Unknown'
        })).sort((a, b) => a.name.localeCompare(b.name));
        console.log('✅ Sets reales obtenidos:', realSets.length);
        return realSets;

    } catch (error) {
        console.error('❌ Error obteniendo sets reales:', error);
        return [];
    }
}

// Función para obtener sets de la API (MEJORADA)
async function fetchSetsAndPopulateFilter() {
    if (allSets.length > 0) return;

    console.log('🔄 Cargando sets desde la API...');

    try {
        // Timeout más generoso para sets (pueden ser muchos)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos

        // Intentar primero con menos sets para ver si funciona
        const response = await fetch('/api/pokemontcg/sets', {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log('📡 Sets API Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Sets API Error:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        allSets = data.data || [];

        console.log('✅ Sets cargados:', allSets.length);

        allSets.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

        // Poblar filtro de Series
        const uniqueSeries = [...new Set(allSets.map(set => set.series))].filter(Boolean).sort();
        if (seriesFilter) {
            seriesFilter.innerHTML = '<option value="">Todas las Series</option>';
            uniqueSeries.forEach(series => {
                const option = document.createElement('option');
                option.value = series;
                option.textContent = series;
                seriesFilter.appendChild(option);
            });
        }

        // Poblar filtro de Sets
        populateSetFilter(allSets);
        if (setFilter) setFilter.disabled = false;

        console.log(`Cargados ${allSets.length} sets y ${uniqueSeries.length} series`);

    } catch (error) {
        console.error('Error al cargar sets:', error);
        console.log('🔄 Usando sets locales como fallback...');

        // Fallback: usar sets locales predefinidos si la API falla
        allSets = [
            { id: 'sv', name: 'Scarlet & Violet', series: 'Scarlet & Violet', releaseDate: '2023-03-31' },
            { id: 'pgo', name: 'Pokémon GO', series: 'Sword & Shield', releaseDate: '2022-07-01' },
            { id: 'astralradiance', name: 'Astral Radiance', series: 'Sword & Shield', releaseDate: '2022-05-27' },
            { id: 'brilliantstars', name: 'Brilliant Stars', series: 'Sword & Shield', releaseDate: '2022-02-25' },
            { id: 'fusionstrikes', name: 'Fusion Strike', series: 'Sword & Shield', releaseDate: '2021-11-12' },
            { id: 'evolvingskies', name: 'Evolving Skies', series: 'Sword & Shield', releaseDate: '2021-08-27' },
            { id: 'chillingReign', name: 'Chilling Reign', series: 'Sword & Shield', releaseDate: '2021-06-18' },
            { id: 'battlestyles', name: 'Battle Styles', series: 'Sword & Shield', releaseDate: '2021-03-19' },
            { id: 'shiningfates', name: 'Shining Fates', series: 'Sword & Shield', releaseDate: '2021-02-19' },
            { id: 'vividvoltage', name: 'Vivid Voltage', series: 'Sword & Shield', releaseDate: '2020-11-13' },
            { id: 'championsPath', name: 'Champions Path', series: 'Sword & Shield', releaseDate: '2020-09-25' },
            { id: 'darknessAblaze', name: 'Darkness Ablaze', series: 'Sword & Shield', releaseDate: '2020-08-14' },
            { id: 'rebelclash', name: 'Rebel Clash', series: 'Sword & Shield', releaseDate: '2020-05-01' },
            { id: 'base1', name: 'Base', series: 'Base', releaseDate: '1999-01-09' },
            { id: 'base2', name: 'Jungle', series: 'Base', releaseDate: '1999-06-16' },
            { id: 'base3', name: 'Fossil', series: 'Base', releaseDate: '1999-10-10' }
        ];

        console.log('✅ Sets locales cargados:', allSets.length);

        // Poblar filtros con datos locales
        const uniqueSeries = [...new Set(allSets.map(set => set.series))].filter(Boolean).sort();
        if (seriesFilter) {
            seriesFilter.innerHTML = '<option value="">Todas las Series</option>';
            uniqueSeries.forEach(series => {
                const option = document.createElement('option');
                option.value = series;
                option.textContent = series;
                seriesFilter.appendChild(option);
            });
        }
        populateSetFilter(allSets);
        if (setFilter) setFilter.disabled = false;
        if (myCardsErrorMessage) {
            myCardsErrorMessage.textContent = 'No se pudieron cargar los filtros. La API está lenta. Intenta más tarde o configura tu API Key.';
            myCardsErrorMessage.classList.remove('hidden');
        }
    }
}

// Función para poblar el filtro de sets
function populateSetFilter(setsToDisplay) {
    if (!setFilter) return;

    setFilter.innerHTML = '<option value="">Todas las Expansiones</option>';
    setsToDisplay.forEach(set => {
        const option = document.createElement('option');
        option.value = set.id;
        option.textContent = set.name;
        setFilter.appendChild(option);
    });
}

// --- Funciones de Autenticación ---
window.logoutUser = async () => {
    try {
        console.log('🚪 Cerrando sesión...');

        // Limpiar sistema de chat antes de cerrar sesión
        if (window.chatManager) {
            try {
                window.chatManager.disconnectAll();
            } catch (e) {
                console.warn('Error al desconectar chat manager:', e);
            }
            window.chatManager = null;
        }
        if (window.chatUI) {
            // Cerrar todas las ventanas de chat abiertas
            const chatWindows = document.querySelectorAll('[id^="chat-window-"]');
            chatWindows.forEach(window => window.remove());

            // Limpiar barra de chats minimizados
            const minimizedBar = document.getElementById('minimized-chats-bar');
            if (minimizedBar) minimizedBar.remove();

            window.chatUI = null;
        }
        // Limpiar debugger si existe
        if (window.chatDebugger) {
            window.chatDebugger = null;
        }
        if (window.chatDebug) {
            window.chatDebug = null;
        }

        // Cerrar sesión en Firebase
        await signOut(auth);

        // Limpiar datos del usuario actual
        currentUser = null;

        // Reinicializar variables de chat
        chatManager = null;
        chatUI = null;

        // Limpiar cualquier dato en caché
        userCardsCache = [];

        // Limpiar formularios si existen
        const forms = document.querySelectorAll('form');
        forms.forEach(form => form.reset());

        // Limpiar contenido sensible de los contenedores
        const myCardsContainer = document.getElementById('myCardsContainer');
        if (myCardsContainer) myCardsContainer.innerHTML = '';

        const myTradesContainer = document.getElementById('myTradesContainer');
        if (myTradesContainer) myTradesContainer.innerHTML = '';

        const availableTradesContainer = document.getElementById('availableTradesContainer');
        if (availableTradesContainer) availableTradesContainer.innerHTML = '';

        // Ocultar todas las secciones privadas
        const profileSection = document.getElementById('profileSection');
        const myCardsSection = document.getElementById('myCardsSection');
        const interchangesSection = document.getElementById('interchangesSection');
        const helpSection = document.getElementById('helpSection');
        const searchResultsSection = document.getElementById('searchResults');
        const inboxSection = document.getElementById('inboxSection');

        if (profileSection) profileSection.classList.add('hidden');
        if (myCardsSection) myCardsSection.classList.add('hidden');
        if (interchangesSection) interchangesSection.classList.add('hidden');
        if (helpSection) helpSection.classList.add('hidden');
        if (searchResultsSection) searchResultsSection.classList.add('hidden');
        if (inboxSection) inboxSection.classList.add('hidden');

        // Actualizar manualmente los enlaces de navegación
        const loginLink = document.getElementById('loginLink');
        const registerLink = document.getElementById('registerLink');
        const logoutLink = document.getElementById('logoutLink');
        const chatLink = document.getElementById('chatLink');
        const inboxLink = document.getElementById('inboxLink');

        // Mostrar enlaces de login/register, ocultar logout y chat
        if (loginLink) loginLink.classList.remove('hidden');
        if (registerLink) registerLink.classList.remove('hidden');
        if (logoutLink) logoutLink.classList.add('hidden');
        if (chatLink) chatLink.classList.add('hidden');
        if (inboxLink) inboxLink.classList.add('hidden');

        // Mostrar la pantalla inicial (hero y how it works)
        showInitialSections();

        // Limpiar la barra de búsqueda si existe
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';

        // Scroll al inicio de la página
        window.scrollTo(0, 0);

        console.log('✅ Sesión cerrada exitosamente');
        showNotification('Has cerrado sesión exitosamente', 'success', 3000);

    } catch (error) {
        console.error('❌ Error al cerrar sesión:', error);
        showNotification('Error al cerrar sesión. Por favor, intenta de nuevo.', 'error', 5000);
    }
};

// --- Configuración de Event Listeners ---
function setupNavigationEvents() {
    console.log('🚀 Inicializando aplicación...');

    // Verificar que las funciones estén disponibles
    if (typeof showInitialSections === 'undefined') {
        console.error('❌ showInitialSections no está definida');
        return;
    }
    if (typeof showAuthModal === 'undefined') {
        console.error('❌ showAuthModal no está definida');
        return;
    }
    if (typeof showMyCardsSection === 'undefined') {
        console.error('❌ showMyCardsSection no está definida');
        return;
    }
    if (typeof showInterchangesSection === 'undefined') {
        console.error('❌ showInterchangesSection no está definida');
        return;
    }
    if (typeof showProfileSection === 'undefined') {
        console.error('❌ showProfileSection no está definida');
        return;
    }
    if (typeof logoutUser === 'undefined') {
        console.error('❌ logoutUser no está definida');
        return;
    }

    console.log('✅ Todas las funciones están disponibles');

}

// Función para animar la Pokéball cambiante (removida - ya no se usa)

// Función para generar elementos flotantes
function generateFloatingElements() {
    const floatingBg = document.getElementById('floatingBackground');
    if (!floatingBg) return;

    // URLs de solo Pokéballs
    const pokemonImages = [
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png',
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png',
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png',
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/premier-ball.png',
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/luxury-ball.png',
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/quick-ball.png',
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/timer-ball.png'
    ];

    const sizes = ['small', 'medium', 'large'];
    const numElements = 15; // Número de elementos flotantes

    // Limpiar elementos existentes
    floatingBg.innerHTML = '';

    // Generar elementos con diferentes capas para parallax
    for (let i = 0; i < numElements; i++) {
        const element = document.createElement('img');
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        const layer = i % 3; // Distribuir en 3 capas

        element.className = `floating-element ${size}`;
        element.src = pokemonImages[Math.floor(Math.random() * pokemonImages.length)];
        element.alt = 'Pokemon';

        // Posición aleatoria
        element.style.left = `${Math.random() * 100}%`;
        element.style.top = `${Math.random() * 100}%`;

        // Retraso aleatorio en la animación
        element.style.animationDelay = `${Math.random() * 20}s`;

        // Ajustar velocidad según la capa para efecto parallax
        if (layer === 0) {
            element.style.animationDuration = '40s'; // Capa trasera más lenta
            element.style.opacity = '0.08';
        } else if (layer === 1) {
            element.style.animationDuration = '30s'; // Capa media
            element.style.opacity = '0.12';
        } else {
            element.style.animationDuration = '20s'; // Capa frontal más rápida
            element.style.opacity = '0.15';
        }

        // Ajustar opacidad para modo oscuro
        if (document.body.classList.contains('dark-mode')) {
            element.classList.add('dark-mode');
            element.style.opacity = parseFloat(element.style.opacity) * 0.5;
        }

        floatingBg.appendChild(element);
    }
}

// Actualizar elementos flotantes cuando cambia el modo oscuro
function updateFloatingElementsOpacity() {
    const elements = document.querySelectorAll('.floating-element');
    elements.forEach(el => {
        if (document.body.classList.contains('dark-mode')) {
            el.classList.add('dark-mode');
        } else {
            el.classList.remove('dark-mode');
        }
    });
}

// Función para configurar el sidebar
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');

    // Función para abrir sidebar
    function openSidebar() {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('show');
        hamburgerBtn.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevenir scroll del body
    }

    // Función para cerrar sidebar
    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('show');
        hamburgerBtn.classList.remove('active');
        document.body.style.overflow = ''; // Restaurar scroll
    }

    // Click en hamburguesa
    hamburgerBtn.addEventListener('click', () => {
        if (sidebar.classList.contains('open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    // Click en botón de cerrar
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeSidebar);
    }

    // Click en overlay
    sidebarOverlay.addEventListener('click', closeSidebar);

    // ESC para cerrar
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    });

    // Configurar links del sidebar
    const sidebarLinks = {
        'sidebarHomeLink': () => {
            closeSidebar();
            showInitialSections();
            window.scrollTo(0, 0);
        },
        'sidebarMyCardsLink': () => {
            closeSidebar();
            showMyCardsSection();
        },
        'sidebarInterchangesLink': () => {
            closeSidebar();
            showInterchangesSection();
        },
        'sidebarCollectionLink': () => {
            closeSidebar();
            // Ir directamente a Mi Perfil > Mi Colección
            showProfileSection();
            setTimeout(() => {
                switchProfileTab('collection');
            }, 100);
        },
        'sidebarInboxLink': () => {
            closeSidebar();
            document.getElementById('inboxLink')?.click();
        },
        'sidebarChatLink': () => {
            closeSidebar();
            document.getElementById('chatLink')?.click();
        },
        'sidebarHelpLink': () => {
            closeSidebar();
            showHelpSection();
        },
        'sidebarLoginLink': () => {
            closeSidebar();
            document.getElementById('loginLink')?.click();
        },
        'sidebarRegisterLink': () => {
            closeSidebar();
            document.getElementById('registerLink')?.click();
        },
        'sidebarLogoutLink': () => {
            closeSidebar();
            document.getElementById('logoutLink')?.click();
        }
    };

    // Asignar eventos a los links
    Object.keys(sidebarLinks).forEach(linkId => {
        const link = document.getElementById(linkId);
        if (link) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                sidebarLinks[linkId]();
            });
        }
    });

    // Actualizar tema del sidebar cuando cambie el modo oscuro
    const updateSidebarTheme = () => {
        if (document.body.classList.contains('dark-mode')) {
            sidebar.classList.add('dark');
        } else {
            sidebar.classList.remove('dark');
        }
    };

    // Observar cambios en el modo oscuro
    const observer = new MutationObserver(updateSidebarTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // Aplicar tema inicial
    updateSidebarTheme();

    // Actualizar visibilidad de items según el estado de login
    window.updateSidebarVisibility = function () {
        const isLoggedIn = !!currentUser;

        // Items que solo se muestran cuando está logueado
        const loggedInItems = ['sidebarInboxLink', 'sidebarChatLink', 'sidebarLogoutLink', 'sidebarCommDivider'];
        loggedInItems.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.toggle('hidden', !isLoggedIn);
            }
        });

        // Items que solo se muestran cuando NO está logueado
        const loggedOutItems = ['sidebarLoginLink', 'sidebarRegisterLink'];
        loggedOutItems.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.toggle('hidden', isLoggedIn);
            }
        });
    };
}

// Función para animar números
function animateNumber(element, start, end, duration) {
    const startTime = performance.now();
    const startValue = start;
    const endValue = end;

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Función de easing para hacer la animación más suave
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);

        const currentValue = Math.floor(startValue + (endValue - startValue) * easeOutQuart);
        element.textContent = currentValue.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// ==============================================
// FUNCIONES DEL HEADER MODERNO
// ==============================================

// Inicializar header moderno
function initializeModernHeader() {
    console.log('🎨 Inicializando header moderno...');

    const header = document.getElementById('modernHeader');
    const hamburgerBtn = document.getElementById('hamburgerBtn');

    // Configurar hamburguesa moderna
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', toggleModernHamburger);
    }

    // Configurar logo animado
    const logo = document.querySelector('.modern-logo');
    if (logo) {
        logo.addEventListener('mouseenter', () => {
            logo.style.transform = 'scale(1.05) rotate(2deg)';
        });

        logo.addEventListener('mouseleave', () => {
            logo.style.transform = 'scale(1) rotate(0deg)';
        });
    }

    // Configurar botones con efectos
    setupModernButtons();

    console.log('✅ Header moderno inicializado');
}

// Toggle hamburguesa moderna
function toggleModernHamburger() {
    const hamburger = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (hamburger && sidebar) {
        hamburger.classList.toggle('active');

        if (sidebar.classList.contains('open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }
}


// Configurar búsqueda inteligente
function setupSmartSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchSuggestions = document.getElementById('searchSuggestions');

    if (!searchInput || !searchSuggestions) return;

    let searchTimeout;
    let currentSuggestions = [];

    // Debounce para búsqueda
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            hideSuggestions();
            return;
        }

        searchTimeout = setTimeout(() => {
            performSmartSearch(query);
        }, 300);
    });

    // Mostrar sugerencias al hacer focus
    searchInput.addEventListener('focus', () => {
        if (currentSuggestions.length > 0) {
            showSuggestions();
        }
    });

    // Ocultar sugerencias al hacer blur
    searchInput.addEventListener('blur', (e) => {
        // Delay para permitir clicks en sugerencias
        setTimeout(() => {
            if (!searchSuggestions.contains(e.relatedTarget)) {
                hideSuggestions();
            }
        }, 200);
    });

    // Búsqueda inteligente
    async function performSmartSearch(query) {
        try {
            // Simular búsqueda inteligente (aquí iría la lógica real)
            const suggestions = await generateSmartSuggestions(query);
            currentSuggestions = suggestions;
            displaySuggestions(suggestions);
        } catch (error) {
            console.error('Error en búsqueda inteligente:', error);
        }
    }

    // Generar sugerencias inteligentes
    async function generateSmartSuggestions(query) {
        if (query.length < 2) return [];

        // Sugerencias más realistas basadas en Pokémon TCG
        const suggestions = [];

        // Sugerencias de cartas populares
        const popularCards = [
            'Pikachu', 'Charizard', 'Blastoise', 'Venusaur', 'Mewtwo',
            'Lugia', 'Ho-Oh', 'Rayquaza', 'Garchomp', 'Lucario',
            'Greninja', 'Decidueye', 'Incineroar', 'Primarina'
        ];

        popularCards.forEach(card => {
            if (card.toLowerCase().includes(query.toLowerCase())) {
                suggestions.push({
                    type: 'card',
                    text: card,
                    icon: '⚡',
                    description: 'Carta Pokémon'
                });
            }
        });

        // Sugerencias de sets populares
        const popularSets = [
            'Base', 'Jungle', 'Fossil', 'Team Rocket', 'Gym Heroes',
            'Neo Genesis', 'Neo Discovery', 'Neo Destiny', 'Expedition',
            'Aquapolis', 'Skyridge', 'Ruby & Sapphire', 'Diamond & Pearl'
        ];

        popularSets.forEach(set => {
            if (set.toLowerCase().includes(query.toLowerCase())) {
                suggestions.push({
                    type: 'set',
                    text: set,
                    icon: '📦',
                    description: 'Set de cartas'
                });
            }
        });

        // Sugerencias de tipos
        const types = [
            'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Fighting',
            'Darkness', 'Metal', 'Dragon', 'Fairy', 'Colorless'
        ];

        types.forEach(type => {
            if (type.toLowerCase().includes(query.toLowerCase())) {
                suggestions.push({
                    type: 'type',
                    text: type,
                    icon: '🏷️',
                    description: 'Tipo de energía'
                });
            }
        });

        return suggestions.slice(0, 6); // Máximo 6 sugerencias
    }

    // Mostrar sugerencias
    function displaySuggestions(suggestions) {
        if (suggestions.length === 0) {
            hideSuggestions();
            return;
        }

        searchSuggestions.innerHTML = suggestions.map(suggestion => `
                    <div class="suggestion-item" data-type="${suggestion.type}">
                        <span class="suggestion-icon">${suggestion.icon}</span>
                        <div class="suggestion-content">
                            <span class="suggestion-text">${suggestion.text}</span>
                            <span class="suggestion-description">${suggestion.description || ''}</span>
                        </div>
                    </div>
                `).join('');

        showSuggestions();

        // Agregar eventos a las sugerencias
        searchSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const text = item.querySelector('.suggestion-text').textContent;
                searchInput.value = text;
                hideSuggestions();
                quickSearch(); // Ejecutar búsqueda
            });
        });
    }

    function showSuggestions() {
        searchSuggestions.classList.remove('hidden');
        searchSuggestions.style.opacity = '0';
        searchSuggestions.style.transform = 'translateY(-10px)';

        requestAnimationFrame(() => {
            searchSuggestions.style.transition = 'all 0.3s ease';
            searchSuggestions.style.opacity = '1';
            searchSuggestions.style.transform = 'translateY(0)';
        });
    }

    function hideSuggestions() {
        if (searchSuggestions.classList.contains('hidden')) return;

        searchSuggestions.style.transition = 'all 0.2s ease';
        searchSuggestions.style.opacity = '0';
        searchSuggestions.style.transform = 'translateY(-10px)';

        setTimeout(() => {
            searchSuggestions.classList.add('hidden');
        }, 200);
    }
}

// Configurar animaciones de partículas
function setupParticleAnimations() {
    const particles = document.querySelectorAll('.particle');

    particles.forEach((particle, index) => {
        // Animación aleatoria para cada partícula
        const delay = Math.random() * 2;
        const duration = 4 + Math.random() * 4;

        particle.style.animationDelay = `${delay}s`;
        particle.style.animationDuration = `${duration}s`;

        // Efecto hover en partículas
        particle.addEventListener('mouseenter', () => {
            particle.style.transform = 'scale(1.5)';
            particle.style.background = 'rgba(255, 255, 255, 1)';
        });

        particle.addEventListener('mouseleave', () => {
            particle.style.transform = 'scale(1)';
            particle.style.background = 'rgba(255, 255, 255, 0.6)';
        });
    });
}

// Configurar botones modernos
function setupModernButtons() {
    // Botones de navegación
    const navButtons = document.querySelectorAll('.modern-nav-btn, .modern-login-btn');

    navButtons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px) scale(1.05)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0) scale(1)';
        });

        // Efecto ripple
        button.addEventListener('click', createRippleEffect);
    });

    // Botón de búsqueda
    const searchBtn = document.querySelector('.modern-search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            searchBtn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                searchBtn.style.transform = 'scale(1)';
            }, 150);
        });
    }
}

// Crear efecto ripple
function createRippleEffect(e) {
    const button = e.currentTarget;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');

    button.appendChild(ripple);

    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// Agregar estilos para el efecto ripple
const rippleStyles = `
            .ripple {
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.3);
                transform: scale(0);
                animation: ripple-animation 0.6s linear;
                pointer-events: none;
            }
            
            @keyframes ripple-animation {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
            
            .suggestion-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                cursor: pointer;
                transition: all 0.2s ease;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .suggestion-item:hover {
                background: rgba(255, 255, 255, 0.1);
                transform: translateX(4px);
            }
            
            .suggestion-item:last-child {
                border-bottom: none;
            }
            
            .suggestion-icon {
                font-size: 1.2rem;
                flex-shrink: 0;
            }
            
            .suggestion-content {
                display: flex;
                flex-direction: column;
                gap: 2px;
                flex: 1;
            }
            
            .suggestion-text {
                color: white;
                font-weight: 600;
                font-size: 0.95rem;
            }
            
            .suggestion-description {
                color: rgba(255, 255, 255, 0.7);
                font-size: 0.8rem;
                font-weight: 400;
            }
        `;

// Inyectar estilos
const styleSheet = document.createElement('style');
styleSheet.textContent = rippleStyles;
document.head.appendChild(styleSheet);

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM cargado, configurando eventos...');

    // Inicializar búsqueda avanzada (opcional)
    setTimeout(() => {
        initAdvancedSearch();
    }, 1000);

    // Prueba de conectividad API
    console.log('🔍 Probando conectividad API...');
    fetch('/api/pokemontcg/types')
        .then(response => response.json())
        .then(data => {
            console.log('✅ API conectada:', data);
        })
        .catch(error => {
            console.error('❌ Error API:', error);
        });

    // Generar elementos flotantes
    generateFloatingElements();

    // ==============================================
    // FUNCIONALIDADES DEL HEADER MODERNO
    // ==============================================

    // Inicializar header moderno
    initializeModernHeader();


    // Configurar búsqueda inteligente
    setupSmartSearch();

    // Configurar animaciones de partículas
    setupParticleAnimations();

    // Configurar sidebar
    setupSidebar();

    // Configurar animación de estadísticas cuando entren en vista
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.animated) {
                const element = entry.target;
                const finalValue = parseInt(element.textContent.replace(/,/g, ''));
                element.dataset.animated = 'true';
                element.classList.add('count-animate');
                animateNumber(element, 0, finalValue, 2000);
            }
        });
    }, { threshold: 0.5 });

    // Observar elementos de estadísticas
    const totalUsers = document.getElementById('totalUsersCount');
    const totalTrades = document.getElementById('totalTradesCount');
    const globalTotalCards = document.getElementById('globalTotalCardsCount');

    if (totalUsers) statsObserver.observe(totalUsers);
    if (totalTrades) statsObserver.observe(totalTrades);
    if (globalTotalCards) statsObserver.observe(globalTotalCards);

    // CARGAR MODO OSCURO DESDE LOCALSTORAGE AL INICIO
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
        const isDark = savedDarkMode === 'true';
        console.log('🌙 Cargando modo oscuro desde localStorage:', isDark);
        applyDarkMode(isDark);

        // El estado del botón se sincroniza automáticamente con las clases CSS
    }

    // Asignar referencias a elementos del DOM
    searchInput = document.getElementById('searchInput');
    searchResultsSection = document.getElementById('searchResults');
    heroSection = document.getElementById('heroSection');
    howItWorksSection = document.getElementById('howItWorksSection');
    cardsContainer = document.getElementById('cardsContainer');
    loadingSpinner = document.getElementById('loadingSpinner');
    noResultsMessage = document.getElementById('noResultsMessage');
    errorMessage = document.getElementById('errorMessage');

    authModal = document.getElementById('authModal');
    loginForm = document.getElementById('loginForm');
    registerForm = document.getElementById('registerForm');
    loginEmailInput = document.getElementById('loginEmail');
    loginPasswordInput = document.getElementById('loginPassword');
    loginBtn = document.getElementById('loginBtn');
    loginError = document.getElementById('loginError');
    registerEmailInput = document.getElementById('registerEmail');
    registerPasswordInput = document.getElementById('registerPassword');
    confirmPasswordInput = document.getElementById('confirmPassword');
    registerBtn = document.getElementById('registerBtn');
    registerError = document.getElementById('registerError');
    closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
    toggleToRegister = document.getElementById('toggleToRegister');
    toggleToLogin = document.getElementById('toggleToLogin');

    loginLink = document.getElementById('loginLink');
    registerLink = document.getElementById('registerLink');
    profileLink = document.getElementById('profileLink');
    logoutLink = document.getElementById('logoutLink');

    myCardsNavLink = document.getElementById('myCardsNavLink');
    myCardsLink = document.getElementById('myCardsLink');
    myCardsSection = document.getElementById('myCardsSection');
    myCardsContainer = document.getElementById('myCardsContainer');
    noMyCardsMessage = document.getElementById('noMyCardsMessage');
    myCardsErrorMessage = document.getElementById('myCardsErrorMessage');

    seriesFilter = document.getElementById('seriesFilter');
    setFilter = document.getElementById('setFilter');
    languageFilter = document.getElementById('languageFilter');
    applyFiltersBtn = document.getElementById('applyFiltersBtn');
    showAllSetCardsToggle = document.getElementById('showAllSetCardsToggle');

    interchangesSection = document.getElementById('interchangesSection');
    helpSection = document.getElementById('helpSection');

    // Inicializar elementos del perfil
    profileLink = document.getElementById('profileLink');
    profileSection = document.getElementById('profileSection');

    // Inicializar botón de modo oscuro
    darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            const isDark = document.documentElement.classList.contains('dark');
            const newMode = !isDark;
            console.log('🌙 Toggle modo oscuro:', newMode ? 'oscuro' : 'claro');
            applyDarkMode(newMode);
            saveDarkModePreference(newMode);
        });
        console.log('✅ Botón de modo oscuro inicializado');
    } else {
        console.warn('⚠️ No se encontró el botón darkModeToggle');
    }

    // Inicializar la aplicación después de un pequeño delay
    setTimeout(() => {
        setupNavigationEvents();
    }, 100);



    // Event listeners para tabs del perfil
    const profilePersonalTab = document.getElementById('profilePersonalTab');
    const profileDashboardTab = document.getElementById('profileDashboardTab');
    const profileCollectionTab = document.getElementById('profileCollectionTab');
    const profileTradesTab = document.getElementById('profileTradesTab');
    const profileSettingsTab = document.getElementById('profileSettingsTab');

    if (profilePersonalTab) {
        profilePersonalTab.addEventListener('click', () => switchProfileTab('personal'));
    }
    if (profileDashboardTab) {
        profileDashboardTab.addEventListener('click', () => switchProfileTab('dashboard'));
    }
    if (profileCollectionTab) {
        profileCollectionTab.addEventListener('click', () => switchProfileTab('collection'));
    }
    if (profileTradesTab) {
        profileTradesTab.addEventListener('click', () => switchProfileTab('trades'));
    }
    if (profileSettingsTab) {
        profileSettingsTab.addEventListener('click', () => switchProfileTab('settings'));
    }

    const profileRatingsTab = document.getElementById('profileRatingsTab');
    if (profileRatingsTab) {
        profileRatingsTab.addEventListener('click', () => switchProfileTab('ratings'));
    }

    const profilePaymentsTab = document.getElementById('profilePaymentsTab');
    if (profilePaymentsTab) {
        profilePaymentsTab.addEventListener('click', () => switchProfileTab('payments'));
    }

    // Event listeners para tabs de ayuda
    const helpGettingStartedTab = document.getElementById('helpGettingStartedTab');
    const helpTradingTab = document.getElementById('helpTradingTab');
    const helpCardConditionsTab = document.getElementById('helpCardConditionsTab');
    const helpAccountTab = document.getElementById('helpAccountTab');
    const helpFAQTab = document.getElementById('helpFAQTab');

    if (helpGettingStartedTab) {
        helpGettingStartedTab.addEventListener('click', () => switchHelpTab('getting-started'));
    }
    if (helpTradingTab) {
        helpTradingTab.addEventListener('click', () => switchHelpTab('trading'));
    }
    if (helpCardConditionsTab) {
        helpCardConditionsTab.addEventListener('click', () => switchHelpTab('card-conditions'));
    }
    if (helpAccountTab) {
        helpAccountTab.addEventListener('click', () => switchHelpTab('account'));
    }
    if (helpFAQTab) {
        helpFAQTab.addEventListener('click', () => switchHelpTab('faq'));
    }

    const helpNewFeaturesTab = document.getElementById('helpNewFeaturesTab');
    if (helpNewFeaturesTab) {
        helpNewFeaturesTab.addEventListener('click', () => switchHelpTab('newFeatures'));
    }

    // Event listeners para tabs de intercambios
    const tradesActiveTab = document.getElementById('tradesActiveTab');
    const tradesPendingTab = document.getElementById('tradesPendingTab');
    const tradesCompletedTab = document.getElementById('tradesCompletedTab');
    const tradesReceivedTab = document.getElementById('tradesReceivedTab');

    if (tradesActiveTab) {
        tradesActiveTab.addEventListener('click', () => switchTradeTab('active'));
    }
    if (tradesPendingTab) {
        tradesPendingTab.addEventListener('click', () => switchTradeTab('pending'));
    }
    if (tradesCompletedTab) {
        tradesCompletedTab.addEventListener('click', () => switchTradeTab('completed'));
    }
    if (tradesReceivedTab) {
        tradesReceivedTab.addEventListener('click', () => switchTradeTab('received'));
    }

    // Event listeners para botones de ayuda
    const searchHelpBtn = document.getElementById('searchHelpBtn');
    const contactSupportBtn = document.getElementById('contactSupportBtn');

    if (searchHelpBtn) {
        searchHelpBtn.addEventListener('click', () => {
            console.log('🔍 Buscar ayuda clicked');
            alert('Función de búsqueda de ayuda en desarrollo');
        });
    }

    if (contactSupportBtn) {
        contactSupportBtn.addEventListener('click', () => {
            console.log('📧 Contactar soporte clicked');
            alert('Función de contacto con soporte en desarrollo');
        });
    }

    // Event listeners para botones de intercambios
    const createTradeBtn = document.getElementById('createTradeBtn');
    const createFirstTradeBtn = document.getElementById('createFirstTradeBtn');
    const findTradesBtn = document.getElementById('findTradesBtn');

    if (createTradeBtn) {
        createTradeBtn.addEventListener('click', () => {
            console.log('➕ Crear intercambio clicked');
            showCreateTradeModal();
        });
    }

    if (createFirstTradeBtn) {
        createFirstTradeBtn.addEventListener('click', () => {
            console.log('➕ Crear primer intercambio clicked');
            showCreateTradeModal();
        });
    }

    if (findTradesBtn) {
        findTradesBtn.addEventListener('click', () => {
            console.log('🔍 Buscar intercambios clicked');
            alert('Función de búsqueda en desarrollo');
        });
    }

    // Event listener para el formulario de perfil personal
    const profilePersonalForm = document.getElementById('profilePersonalForm');
    if (profilePersonalForm) {
        profilePersonalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveProfileData();
        });
    }

    // Event listener para el botón cancelar
    const cancelProfileBtn = document.getElementById('cancelProfileBtn');
    if (cancelProfileBtn) {
        cancelProfileBtn.addEventListener('click', () => {
            loadUserInfo(); // Recargar datos originales
            showProfileSaveMessage('Cambios cancelados', 'info');
        });
    }

    // Event listeners para cambio de contraseña
    const passwordChangeForm = document.getElementById('passwordChangeForm');
    if (passwordChangeForm) {
        passwordChangeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await changePassword();
        });
    }

    const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
    if (cancelPasswordBtn) {
        cancelPasswordBtn.addEventListener('click', () => {
            document.getElementById('passwordChangeForm').reset();
            showPasswordChangeMessage('Cambios cancelados', 'info');
        });
    }

    // Event listeners para modal
    if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', hideAuthModal);
    if (toggleToRegister) toggleToRegister.addEventListener('click', (e) => { e.preventDefault(); showAuthModal('register'); });
    if (toggleToLogin) toggleToLogin.addEventListener('click', (e) => { e.preventDefault(); showAuthModal('login'); });

    // Event listeners para recuperación de contraseña
    const toggleToForgotPassword = document.getElementById('toggleToForgotPassword');
    const backToLogin = document.getElementById('backToLogin');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const resetEmailInput = document.getElementById('resetEmail');
    const resetPasswordError = document.getElementById('resetPasswordError');
    const resetPasswordSuccess = document.getElementById('resetPasswordSuccess');

    if (toggleToForgotPassword) {
        toggleToForgotPassword.addEventListener('click', (e) => {
            e.preventDefault();
            showAuthModal('forgot');
        });
    }

    if (backToLogin) {
        backToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            showAuthModal('login');
        });
    }

    // Función para manejar el reset de contraseña
    async function handlePasswordReset() {
        const email = resetEmailInput?.value;

        if (!email) {
            if (resetPasswordError) {
                resetPasswordError.textContent = 'Por favor, ingresa tu correo electrónico.';
                resetPasswordError.classList.remove('hidden');
            }
            return;
        }

        // Ocultar mensajes anteriores
        if (resetPasswordError) resetPasswordError.classList.add('hidden');
        if (resetPasswordSuccess) resetPasswordSuccess.classList.add('hidden');

        try {
            console.log('📧 Enviando email de recuperación a:', email);
            await sendPasswordResetEmail(auth, email);

            // Mostrar mensaje de éxito con aviso de SPAM
            if (resetPasswordSuccess) {
                resetPasswordSuccess.innerHTML = `
                            <span class="block font-semibold">✅ ¡Email enviado exitosamente!</span>
                            <span class="block mt-1">📧 Enviado a: ${email}</span>
                            <span class="block mt-2 text-yellow-600 font-semibold">
                                ⚠️ IMPORTANTE: Revisa tu carpeta de SPAM/Correo no deseado
                            </span>
                            <span class="block text-xs mt-1">
                                El email puede tardar 1-2 minutos en llegar
                            </span>
                        `;
                resetPasswordSuccess.classList.remove('hidden');
            }

            // Limpiar el campo
            if (resetEmailInput) resetEmailInput.value = '';

            // Volver al login después de 10 segundos (más tiempo para leer el aviso)
            setTimeout(() => {
                showAuthModal('login');
            }, 10000);

        } catch (error) {
            console.error('❌ Error al enviar email de recuperación:', error);

            let errorMessage = 'Error al enviar el email de recuperación.';

            if (error.code === 'auth/user-not-found') {
                errorMessage = 'No existe una cuenta con este correo electrónico.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'El formato del correo electrónico no es válido.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Demasiados intentos. Por favor, espera un momento.';
            }

            if (resetPasswordError) {
                resetPasswordError.textContent = errorMessage;
                resetPasswordError.classList.remove('hidden');
            }
        }
    }

    // Event listener para el botón de reset
    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', handlePasswordReset);
    }

    // Event listener para Enter en el campo de email
    if (resetEmailInput) {
        resetEmailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handlePasswordReset();
            }
        });
    }

    // Event listeners para filtros
    if (seriesFilter) {
        seriesFilter.addEventListener('change', () => {
            const selectedSeries = seriesFilter.value;
            if (selectedSeries === "") {
                populateSetFilter(allSets);
            } else {
                const setsInSeries = allSets.filter(set => set.series === selectedSeries);
                populateSetFilter(setsInSeries);
            }
            if (setFilter) setFilter.value = "";
            if (showAllSetCardsToggle) {
                showAllSetCardsToggle.checked = false;
                showAllSetCardsToggle.disabled = selectedSeries === "";
            }
        });
    }

    if (setFilter) {
        setFilter.addEventListener('change', () => {
            if (showAllSetCardsToggle) {
                showAllSetCardsToggle.disabled = !setFilter.value;
                if (!setFilter.value) showAllSetCardsToggle.checked = false;
            }
        });
    }

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            console.log('🔍 Aplicando filtros...');
            if (currentUser) {
                loadMyCollection(currentUser.uid);
            } else {
                if (noMyCardsMessage) {
                    noMyCardsMessage.textContent = 'Debes iniciar sesión para aplicar filtros.';
                    noMyCardsMessage.classList.remove('hidden');
                }
            }
        });
    }

    // Event listener para el filtro de idioma (actualización automática)
    if (languageFilter) {
        languageFilter.addEventListener('change', () => {
            console.log('🌍 Idioma seleccionado:', languageFilter.value);
            if (currentUser) {
                loadMyCollection(currentUser.uid);
            }
        });
    }

    if (showAllSetCardsToggle) {
        showAllSetCardsToggle.addEventListener('change', () => {
            if (currentUser && setFilter?.value) {
                loadMyCollection(currentUser.uid);
            } else if (showAllSetCardsToggle.checked) {
                alert('Debes iniciar sesión y seleccionar una expansión.');
                showAllSetCardsToggle.checked = false;
            }
        });
    }

    // Función para manejar el login
    async function handleLogin() {
        console.log('🔐 handleLogin ejecutado');
        const email = loginEmailInput?.value;
        const password = loginPasswordInput?.value;

        console.log('📧 Email:', email);
        console.log('🔑 Password length:', password?.length);

        if (!email || !password) {
            console.error('❌ Email o contraseña vacíos');
            if (loginError) {
                loginError.textContent = 'Por favor ingresa email y contraseña';
                loginError.classList.remove('hidden');
            }
            return;
        }

        if (loginError) loginError.classList.add('hidden');

        try {
            console.log('🚀 Intentando iniciar sesión con Firebase...');
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('✅ Inicio de sesión exitoso:', userCredential.user.email);
            hideAuthModal();
            console.log('✅ Modal cerrado');
            showNotification('¡Bienvenido de nuevo!', 'success');
        } catch (error) {
            console.error('❌ Error al iniciar sesión:', error.code, error.message);
            let errorMessage = 'Error al iniciar sesión.';
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'No existe una cuenta con este correo electrónico.';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Contraseña incorrecta.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Formato de correo inválido.';
            } else if (error.code === 'auth/invalid-credential') {
                errorMessage = 'Credenciales inválidas. Verifica tu email y contraseña.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Demasiados intentos fallidos. Intenta más tarde.';
            }
            if (loginError) {
                loginError.textContent = errorMessage;
                loginError.classList.remove('hidden');
            }
            showNotification(errorMessage, 'error');
        }
    }

    // Event listeners para autenticación - BOTÓN LOGIN
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }

    // Event listener para ENTER en el formulario de login
    if (loginForm) {
        // Agregar event listener a los campos de input del login
        const loginInputs = [loginEmailInput, loginPasswordInput];
        loginInputs.forEach(input => {
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLogin();
                    }
                });
            }
        });
    }

    // Función para manejar el registro
    async function handleRegister() {
        const username = document.getElementById('registerUsername')?.value?.trim();
        const email = registerEmailInput?.value;
        const password = registerPasswordInput?.value;
        const confirmPassword = confirmPasswordInput?.value;
        if (registerError) registerError.classList.add('hidden');

        // Validaciones
        if (!username) {
            if (registerError) {
                registerError.textContent = 'El nombre de usuario es obligatorio.';
                registerError.classList.remove('hidden');
            }
            return;
        }

        if (username.length < 3) {
            if (registerError) {
                registerError.textContent = 'El nombre de usuario debe tener al menos 3 caracteres.';
                registerError.classList.remove('hidden');
            }
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            if (registerError) {
                registerError.textContent = 'El nombre de usuario solo puede contener letras, números y guiones bajos.';
                registerError.classList.remove('hidden');
            }
            return;
        }

        if (password !== confirmPassword) {
            if (registerError) {
                registerError.textContent = 'Las contraseñas no coinciden.';
                registerError.classList.remove('hidden');
            }
            return;
        }

        if (password.length < 6) {
            if (registerError) {
                registerError.textContent = 'La contraseña debe tener al menos 6 caracteres.';
                registerError.classList.remove('hidden');
            }
            return;
        }

        try {
            console.log('🚀 Iniciando proceso de registro...');
            console.log('📝 Username:', username);
            console.log('📧 Email:', email);

            // NOTA: La verificación de nombre de usuario duplicado está deshabilitada
            // porque requeriría permisos especiales en Firestore para leer todos los usuarios.
            // En producción, esto se manejaría con una Cloud Function o un índice especial.
            console.log('ℹ️ Saltando verificación de nombre de usuario duplicado (requiere configuración adicional)');

            console.log('🔐 Creando cuenta con Firebase Auth...');
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log('✅ Cuenta creada exitosamente:', user.uid);

            // Crear perfil completo en Firestore
            console.log('💾 Guardando perfil en Firestore...');
            await setDoc(doc(db, 'users', user.uid), {
                username: username, // Username único elegido en el registro
                name: '', // Nombre real (se llenará después en el perfil)
                lastName: '', // Apellido (se llenará después en el perfil)
                email: user.email,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log('✅ Perfil guardado en Firestore');

            hideAuthModal();
            console.log('🎉 Usuario registrado exitosamente:', user.email, 'Username:', username);

            // Mostrar mensaje de éxito
            alert(`¡Bienvenido ${username}! Tu cuenta ha sido creada exitosamente.`);

        } catch (error) {
            console.error('❌ Error detallado al registrar:', error);
            console.error('Código de error:', error.code);
            console.error('Mensaje de error:', error.message);

            let errorMessage = 'Error al registrar. Por favor, intenta de nuevo.';

            // Errores de Firebase Auth
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Este correo ya está registrado.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Formato de correo inválido.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Error de conexión. Verifica tu conexión a internet.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Demasiados intentos. Por favor, espera un momento.';
            } else if (error.code === 'auth/operation-not-allowed') {
                errorMessage = 'El registro está temporalmente deshabilitado.';
            } else if (error.message) {
                // Si hay un mensaje de error específico, mostrarlo
                errorMessage = `Error: ${error.message}`;
            }

            if (registerError) {
                registerError.textContent = errorMessage;
                registerError.classList.remove('hidden');
            }
        }
    }

    // Event listener para BOTÓN REGISTRO
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    }

    // Event listener para ENTER en el formulario de registro
    if (registerForm) {
        const registerUsernameInput = document.getElementById('registerUsername');
        const registerInputs = [registerUsernameInput, registerEmailInput, registerPasswordInput, confirmPasswordInput];
        registerInputs.forEach(input => {
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleRegister();
                    }
                });
            }
        });
    }

    // Configurar tabs del buzón
    const inboxTabs = document.querySelectorAll('.inbox-tab');
    inboxTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();

            // Remover clase active de todos los tabs
            inboxTabs.forEach(t => {
                t.classList.remove('active', 'border-purple-500', 'text-purple-600');
                t.classList.add('border-transparent', 'text-gray-500');
            });

            // Añadir clase active al tab clickeado
            tab.classList.add('active', 'border-purple-500', 'text-purple-600');
            tab.classList.remove('border-transparent', 'text-gray-500');

            // Ocultar todos los contenidos
            document.querySelectorAll('.inbox-content').forEach(content => {
                content.classList.add('hidden');
            });

            // Mostrar el contenido correspondiente
            if (tab.id === 'inboxNotificationsTab') {
                document.getElementById('inboxNotificationsContent').classList.remove('hidden');
                loadNotifications();
            } else if (tab.id === 'inboxProposalsTab') {
                document.getElementById('inboxProposalsContent').classList.remove('hidden');
                loadReceivedProposals();
            } else if (tab.id === 'inboxSentProposalsTab') {
                document.getElementById('inboxSentProposalsContent').classList.remove('hidden');
                loadSentProposals();
            }
        });
    });

    // Event listener delegado para botones de chat (como respaldo)
    document.addEventListener('click', function (e) {
        if (e.target && e.target.textContent && e.target.textContent.includes('💭 Chat')) {
            e.preventDefault();
            const button = e.target;
            const tradeId = button.getAttribute('data-trade-id');
            const userId = button.getAttribute('data-user-id');
            const tradeTitle = button.getAttribute('data-trade-title');

            console.log('Chat button clicked via delegated event:', { tradeId, userId, tradeTitle });

            if (window.openTradeChat && tradeId) {
                window.openTradeChat(tradeId, userId || '', tradeTitle || '');
            } else {
                console.error('openTradeChat no está disponible o falta tradeId');
            }
        }
    });

    // Escuchar cambios de autenticación
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        window.currentUser = user; // Actualizar referencia global
        console.log('🔐 onAuthStateChanged ejecutado. Usuario:', !!user, user?.email);

        // Debug: Verificar localStorage al cambiar de usuario
        if (user) {
            console.log('🔍 === LOGIN DETECTADO ===');
            const userTradesKey = `userTrades_${user.uid}`;
            const existingTrades = JSON.parse(localStorage.getItem(userTradesKey) || '[]');
            console.log('📦 Intercambios existentes para este usuario:', {
                key: userTradesKey,
                count: existingTrades.length,
                trades: existingTrades.map(t => ({ id: t.id, title: t.title }))
            });
        } else {
            console.log('🔍 === LOGOUT DETECTADO ===');
            console.log('📦 Verificando localStorage después del logout...');
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('userTrades_')) {
                    const trades = JSON.parse(localStorage.getItem(key) || '[]');
                    console.log(`- ${key}: ${trades.length} intercambios`);
                }
            }
        }

        // Cargar intercambios del usuario después del login
        if (user) {
            console.log('🔄 === CARGANDO INTERCAMBIOS DESPUÉS DEL LOGIN ===');
            console.log('👤 Usuario logueado:', user.uid);

            // Verificar si loadUserTrades está disponible
            if (typeof loadUserTrades === 'function') {
                console.log('✅ loadUserTrades está disponible, ejecutando...');
                try {
                    await loadUserTrades();
                    console.log('✅ loadUserTrades ejecutado correctamente');
                } catch (error) {
                    console.error('❌ Error al ejecutar loadUserTrades:', error);
                }
            } else {
                console.error('❌ loadUserTrades no está disponible');
            }
        }

        // Inicializar sistema de chat si el usuario está autenticado
        if (user && !chatManager) {
            console.log('💬 Inicializando sistema de chat...');
            console.log('🔍 Verificando clases disponibles:', {
                ChatManager: typeof ChatManager,
                ChatUI: typeof ChatUI,
                ChatDebugger: typeof ChatDebugger
            });

            try {
                if (typeof ChatManager === 'undefined') {
                    console.error('❌ ChatManager no está disponible');
                    showNotification('Error: ChatManager no se cargó correctamente', 'error');
                    return;
                }

                if (typeof ChatUI === 'undefined') {
                    console.error('❌ ChatUI no está disponible');
                    showNotification('Error: ChatUI no se cargó correctamente', 'error');
                    return;
                }

                chatManager = new ChatManager(auth, db);
                chatUI = new ChatUI(chatManager);
                const chatDebugger = new ChatDebugger(chatManager);

                window.chatManager = chatManager; // Hacer disponible globalmente
                window.chatUI = chatUI; // Hacer disponible globalmente
                window.chatDebugger = chatDebugger; // Hacer disponible globalmente

                console.log('✅ Sistema de chat inicializado correctamente');
                console.log('📊 Instancias creadas:', {
                    chatManager: !!window.chatManager,
                    chatUI: !!window.chatUI,
                    chatDebugger: !!window.chatDebugger
                });
            } catch (error) {
                console.error('❌ Error al inicializar chat:', error);
                console.error('❌ Stack trace:', error.stack);
                showNotification('Error al inicializar el chat: ' + error.message, 'error');
            }

            // Inicializar sistema de migración y sincronización
            try {
                console.log('🔄 Inicializando sistema de migración y sincronización...');
                dataMigration = new DataMigration(auth, db);
                dataSync = new DataSync(auth, db);

                window.dataMigration = dataMigration; // Hacer disponible globalmente
                window.dataSync = dataSync; // Hacer disponible globalmente

                console.log('✅ Sistema de migración y sincronización inicializado');

                // Ejecutar migración automática
                setTimeout(async () => {
                    console.log('🚀 Iniciando migración automática...');
                    const migrationSuccess = await dataMigration.migrateAllData();
                    if (migrationSuccess) {
                        console.log('🎉 Migración completada exitosamente');

                        // Iniciar sincronización en tiempo real
                        await startDataSync();
                    } else {
                        console.log('⚠️ Migración parcial o fallida');
                    }
                }, 2000);

            } catch (error) {
                console.error('❌ Error al inicializar migración/sincronización:', error);
            }

            // Escuchar actualizaciones de mensajes no leídos
            window.addEventListener('unreadCountUpdated', (event) => {
                // Contar CHATS con mensajes sin leer (no mensajes totales)
                let chatsWithUnread = 0;
                for (const [chatId, count] of chatManager.unreadCounts) {
                    if (count > 0) {
                        chatsWithUnread++;
                    }
                }

                const chatBadge = document.getElementById('chatBadge');
                if (chatBadge) {
                    if (chatsWithUnread > 0) {
                        chatBadge.textContent = chatsWithUnread;
                        chatBadge.classList.remove('hidden');
                    } else {
                        chatBadge.classList.add('hidden');
                    }
                }

                // Actualizar también el bocadillo de chats
                if (chatUI && typeof chatUI.updateMinimizedBar === 'function') {
                    chatUI.updateMinimizedBar();
                }
            });

            // Cargar chats persistidos después de un pequeño delay
            setTimeout(async () => {
                console.log('⏰ Cargando chats persistidos después de autenticación...');
                if (chatUI && typeof chatUI.loadPersistedChats === 'function') {
                    await chatUI.loadPersistedChats();
                }
                // Actualizar badge de chats
                if (chatUI && typeof chatUI.updateChatBadge === 'function') {
                    await chatUI.updateChatBadge();
                }

                // Verificar si hay chats guardados y mostrar barra si es necesario
                try {
                    const userId = currentUser.uid;
                    const savedState = localStorage.getItem(`chatsState_${userId}`);
                    if (savedState) {
                        const chatsState = JSON.parse(savedState);
                        if (chatsState.activeChats && chatsState.activeChats.length > 0) {
                            console.log('💬 Hay chats guardados, verificando barra minimizada...');
                            // Si no hay barra visible, crearla
                            if (!document.getElementById('minimized-chats-bar')) {
                                chatUI.createMinimizedBar();
                                chatUI.updateMinimizedBar();
                            }
                        }
                    }
                } catch (e) {
                    console.log('No se pudo verificar estado de chats:', e);
                }
            }, 1500); // Esperar 1.5 segundos para asegurar que todo esté inicializado

            // Actualizar badge de chats cada 10 segundos
            setInterval(async () => {
                if (chatUI && typeof chatUI.updateChatBadge === 'function') {
                    await chatUI.updateChatBadge();
                }
            }, 10000);

        } else if (!user && chatManager) {
            // Limpiar chat si el usuario cierra sesión
            console.log('💬 Limpiando sistema de chat...');
            chatManager.disconnectAll();
            chatManager = null;
            chatUI = null;

            // Limpiar sistema de migración y sincronización
            if (dataSync) {
                console.log('🔄 Desconectando sincronización...');
                dataSync.disconnectAll();
                dataSync = null;
            }
            dataMigration = null;
        }

        // Obtener referencias a los elementos de navegación
        const loginLink = document.getElementById('loginLink');
        const registerLink = document.getElementById('registerLink');
        const logoutLink = document.getElementById('logoutLink');
        const profileLink = document.getElementById('profileLink');
        const myCardsNavLink = document.getElementById('myCardsNavLink');
        const inboxLink = document.getElementById('inboxLink');
        const chatLink = document.getElementById('chatLink');

        // Mis Cartas siempre visible
        if (myCardsNavLink) myCardsNavLink.classList.remove('hidden');

        if (user) {
            // Usuario conectado: ocultar login/register, mostrar logout y buzón
            if (loginLink) loginLink.classList.add('hidden');
            if (registerLink) registerLink.classList.add('hidden');
            if (logoutLink) logoutLink.classList.remove('hidden');
            // Mi Perfil siempre visible (funciona diferente según estado)
            if (profileLink) profileLink.classList.remove('hidden');
            // Mostrar buzón y chat para usuarios autenticados
            if (inboxLink) inboxLink.classList.remove('hidden');
            if (chatLink) chatLink.classList.remove('hidden');

            // Actualizar badge de notificaciones
            updateNotificationBadge();

            // Actualizar sidebar
            if (window.updateSidebarVisibility) {
                window.updateSidebarVisibility();
            }

            // CARGAR MODO OSCURO INMEDIATAMENTE AL INICIAR SESIÓN
            try {
                console.log('🌙 Cargando preferencia de modo oscuro del usuario...');
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const userData = userDoc.data();

                if (userData && userData.darkMode !== undefined) {
                    console.log('🌙 Aplicando modo oscuro:', userData.darkMode);
                    applyDarkMode(userData.darkMode);

                    // El estado del botón se sincroniza automáticamente con las clases CSS
                } else {
                    console.log('🌙 No hay preferencia guardada, manteniendo modo actual');
                }
            } catch (error) {
                console.error('Error al cargar preferencia de modo oscuro:', error);
            }
        } else {
            console.log('🔓 Usuario desconectado, actualizando navegación...');

            // Usuario desconectado: mostrar login/register, ocultar logout
            if (loginLink) {
                loginLink.classList.remove('hidden');
                console.log('✅ Login link mostrado');
            } else {
                console.warn('⚠️ loginLink no encontrado');
            }

            if (registerLink) {
                registerLink.classList.remove('hidden');
                console.log('✅ Register link mostrado');
            } else {
                console.warn('⚠️ registerLink no encontrado');
            }

            if (logoutLink) {
                logoutLink.classList.add('hidden');
                console.log('✅ Logout link ocultado');
            } else {
                console.warn('⚠️ logoutLink no encontrado');
            }

            // Ocultar chat y buzón para usuarios no autenticados
            if (chatLink) chatLink.classList.add('hidden');
            if (inboxLink) inboxLink.classList.add('hidden');
            // OCULTAR Mi Perfil cuando no hay usuario autenticado
            if (profileLink) profileLink.classList.add('hidden');

            // Actualizar sidebar
            if (window.updateSidebarVisibility) {
                window.updateSidebarVisibility();
            }

            // Opcional: Restaurar modo por defecto al cerrar sesión
            // Si quieres que al cerrar sesión vuelva al modo claro, descomenta estas líneas:
            // applyDarkMode(false);
            // const darkModeToggle = document.getElementById('darkModeToggle');
            // if (darkModeToggle) darkModeToggle.checked = false;
        }
    });

    // Event listener para búsqueda
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('keyup', (event) => {
            clearTimeout(searchTimeout);
            const query = event.target.value.trim();
            // Eliminar mínimo de caracteres - buscar siempre
            searchTimeout = setTimeout(() => {
                fetchCards(query);
            }, 500);
        });
    }

    // Inicializar la Pokéball animada (removida)

    // Mostrar secciones iniciales
    showInitialSections();

    // Cargar sets para filtros de búsqueda
    fetchSetsAndPopulateSearchFilters();

    // Filtros de búsqueda
    const filterSeriesSelect = document.getElementById('filterSeriesSelect');
    const filterSetSelect = document.getElementById('filterSetSelect');
    const filterRaritySelect = document.getElementById('filterRaritySelect');
    const filterTypeSelect = document.getElementById('filterTypeSelect');
    const filterLanguageSelect = document.getElementById('filterLanguageSelect');
    const applySearchFiltersBtn = document.getElementById('applySearchFiltersBtn');
    const clearSearchFiltersBtn = document.getElementById('clearSearchFiltersBtn');

    // Event listeners para actualizar filtros automáticamente
    if (filterSetSelect) {
        filterSetSelect.addEventListener('change', () => {
            searchFiltersState.set = filterSetSelect.value;
        });
    }

    if (filterRaritySelect) {
        filterRaritySelect.addEventListener('change', () => {
            searchFiltersState.rarity = filterRaritySelect.value;
        });
    }

    if (filterTypeSelect) {
        filterTypeSelect.addEventListener('change', () => {
            searchFiltersState.type = filterTypeSelect.value;
        });
    }

    if (filterLanguageSelect) {
        filterLanguageSelect.addEventListener('change', () => {
            searchFiltersState.language = filterLanguageSelect.value;
        });
    }

    if (applySearchFiltersBtn) {
        applySearchFiltersBtn.addEventListener('click', () => {
            searchFiltersState.series = filterSeriesSelect?.value || '';
            searchFiltersState.set = filterSetSelect?.value || '';
            searchFiltersState.rarity = filterRaritySelect?.value || '';
            searchFiltersState.type = filterTypeSelect?.value || '';
            searchFiltersState.language = filterLanguageSelect?.value || '';
            const q = (searchInput?.value || '').trim();

            // Aplicar filtros incluso sin término de búsqueda específico
            if (q.length >= 2) {
                fetchCards(q);
            } else if (searchFiltersState.series || searchFiltersState.set ||
                searchFiltersState.rarity || searchFiltersState.type ||
                searchFiltersState.language) {
                // Si hay filtros pero no término de búsqueda, buscar solo por filtros
                console.log('🔍 Aplicando filtros sin término de búsqueda:', searchFiltersState);
                fetchCards('');
            } else {
                showNotification('Por favor ingresa un término de búsqueda o selecciona filtros', 'warning');
            }
        });
    }
    if (clearSearchFiltersBtn) {
        clearSearchFiltersBtn.addEventListener('click', () => {
            if (filterSeriesSelect) filterSeriesSelect.value = '';
            if (filterSetSelect) filterSetSelect.value = '';
            if (filterRaritySelect) filterRaritySelect.value = '';
            if (filterTypeSelect) filterTypeSelect.value = '';
            if (filterLanguageSelect) filterLanguageSelect.value = '';
            searchFiltersState.series = '';
            searchFiltersState.set = '';
            searchFiltersState.rarity = '';
            searchFiltersState.type = '';
            searchFiltersState.language = '';
            const q = (searchInput?.value || '').trim();
            if (q.length >= 3) fetchCards(q);
        });
    }

    // Event listeners para enlaces de navegación
    const loginLinkNav = document.getElementById('loginLink');
    const registerLinkNav = document.getElementById('registerLink');
    const logoutLinkNav = document.getElementById('logoutLink');
    const profileLinkNav = document.getElementById('profileLink');
    const myCardsNavLinkNav = document.getElementById('myCardsNavLink');
    const inboxLinkNav = document.getElementById('inboxLink');
    const chatLinkNav = document.getElementById('chatLink');

    console.log('🔍 Enlaces encontrados:', {
        loginLink: !!loginLinkNav,
        registerLink: !!registerLinkNav,
        logoutLink: !!logoutLinkNav,
        profileLink: !!profileLinkNav,
        myCardsNavLink: !!myCardsNavLinkNav,
        inboxLink: !!inboxLinkNav,
        chatLink: !!chatLinkNav
    });

    // Event listener para login
    if (loginLinkNav) {
        loginLinkNav.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🔐 Login link clicked');
            showAuthModal('login');
        });
    }

    // Event listener para register
    if (registerLinkNav) {
        registerLinkNav.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('📝 Register link clicked');
            showAuthModal('register');
        });
    }

    // Event listener para logout
    if (logoutLinkNav) {
        logoutLinkNav.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('🚪 Logout link clicked');
            try {
                await signOut(auth);
                console.log('✅ Usuario desconectado');
                showNotification('Sesión cerrada exitosamente', 'success');
                // Volver a la página principal
                showInitialSections();
            } catch (error) {
                console.error('❌ Error al cerrar sesión:', error);
                showNotification('Error al cerrar sesión', 'error');
            }
        });
    }

    // Event listener para Mi Perfil
    if (profileLinkNav) {
        profileLinkNav.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Evitar propagación
            console.log('👤 Profile link clicked - Usuario autenticado');
            // SOLO mostrar el perfil, sin verificaciones
            showProfileSection();
        });
    }

    // Event listener para Mis Cartas
    if (myCardsNavLinkNav) {
        myCardsNavLinkNav.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🎴 My cards link clicked');
            showMyCardsSection();
        });
    }

    // Event listener para Buzón
    if (inboxLinkNav) {
        inboxLinkNav.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('📬 Inbox link clicked');
            showInboxSection();
        });
    }

    // Event listener para Chat
    if (chatLinkNav) {
        chatLinkNav.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('💬 Chat link clicked');
            console.log('🔍 Estado del chat:', {
                chatManager: !!window.chatManager,
                chatUI: !!window.chatUI,
                chatDebugger: !!window.chatDebugger,
                currentUser: !!currentUser
            });

            // Verificar si hay sistema de chat inicializado
            if (window.chatUI && window.chatUI.showChatList) {
                window.chatUI.showChatList();
            } else {
                console.warn('⚠️ Sistema de chat no inicializado');
                showNotification('Sistema de chat no disponible. Intentando reinicializar...', 'warning');

                // Intentar reinicializar el chat
                try {
                    if (currentUser && typeof ChatManager !== 'undefined' && typeof ChatUI !== 'undefined') {
                        console.log('🔄 Reinicializando sistema de chat...');
                        window.chatManager = new ChatManager(auth, db);
                        window.chatUI = new ChatUI(window.chatManager);
                        window.chatDebugger = new ChatDebugger(window.chatManager);
                        showNotification('Sistema de chat reinicializado correctamente', 'success');
                    } else {
                        showNotification('No se puede reinicializar el chat. Recarga la página.', 'error');
                    }
                } catch (error) {
                    console.error('❌ Error al reinicializar chat:', error);
                    showNotification('Error al reinicializar el chat: ' + error.message, 'error');
                }
            }
        });
    }

});

// Función de diagnóstico del sistema de chat
window.diagnoseChat = function () {
    console.log('🔍 === DIAGNÓSTICO DEL SISTEMA DE CHAT ===');
    console.log('📊 Estado general:', {
        currentUser: !!currentUser,
        currentUserUid: currentUser?.uid,
        chatManager: !!window.chatManager,
        chatUI: !!window.chatUI,
        chatDebugger: !!window.chatDebugger,
        ChatManagerClass: typeof ChatManager,
        ChatUIClass: typeof ChatUI,
        ChatDebuggerClass: typeof ChatDebugger
    });

    if (window.chatManager) {
        console.log('💬 ChatManager:', {
            activeChats: window.chatManager.activeChats?.size || 0,
            chatListeners: window.chatManager.chatListeners?.size || 0,
            currentChatId: window.chatManager.currentChatId
        });
    }

    if (window.chatUI) {
        console.log('🎨 ChatUI:', {
            hasShowChatList: typeof window.chatUI.showChatList === 'function',
            hasOpenChat: typeof window.chatUI.openChat === 'function',
            hasUpdateMinimizedBar: typeof window.chatUI.updateMinimizedBar === 'function',
            activeChats: window.chatUI.activeChats?.size || 0,
            minimizedChats: window.chatUI.minimizedChats?.size || 0
        });
    }

    console.log('🔧 Acciones disponibles:');
    console.log('- window.diagnoseChat() - Este diagnóstico');
    console.log('- window.reinitializeChat() - Reinicializar chat');
    console.log('- window.testChat() - Probar funcionalidad básica');
};

// Función para reinicializar el chat
window.reinitializeChat = function () {
    console.log('🔄 Reinicializando sistema de chat...');
    try {
        if (!currentUser) {
            console.error('❌ No hay usuario autenticado');
            showNotification('Debes iniciar sesión para usar el chat', 'warning');
            return false;
        }

        if (typeof ChatManager === 'undefined' || typeof ChatUI === 'undefined') {
            console.error('❌ Clases de chat no disponibles');
            showNotification('Error: Las clases de chat no se cargaron correctamente', 'error');
            return false;
        }

        // Limpiar instancias anteriores
        if (window.chatManager) {
            try {
                window.chatManager.disconnectAll();
            } catch (e) {
                console.warn('Error al desconectar chat manager anterior:', e);
            }
        }

        // Crear nuevas instancias
        window.chatManager = new ChatManager(auth, db);
        window.chatUI = new ChatUI(window.chatManager);
        window.chatDebugger = new ChatDebugger(window.chatManager);

        console.log('✅ Sistema de chat reinicializado correctamente');
        showNotification('Sistema de chat reinicializado correctamente', 'success');
        return true;

    } catch (error) {
        console.error('❌ Error al reinicializar chat:', error);
        showNotification('Error al reinicializar el chat: ' + error.message, 'error');
        return false;
    }
};

// Función para probar el chat
window.testChat = function () {
    console.log('🧪 Probando funcionalidad del chat...');

    if (!window.chatManager || !window.chatUI) {
        console.error('❌ Sistema de chat no inicializado');
        showNotification('Sistema de chat no inicializado. Usa window.reinitializeChat()', 'error');
        return false;
    }

    try {
        // Probar métodos básicos
        const hasShowChatList = typeof window.chatUI.showChatList === 'function';
        const hasOpenChat = typeof window.chatUI.openChat === 'function';
        const hasUpdateMinimizedBar = typeof window.chatUI.updateMinimizedBar === 'function';

        console.log('✅ Métodos disponibles:', {
            showChatList: hasShowChatList,
            openChat: hasOpenChat,
            updateMinimizedBar: hasUpdateMinimizedBar
        });

        if (hasShowChatList) {
            console.log('🎯 Probando showChatList...');
            window.chatUI.showChatList();
            console.log('✅ showChatList ejecutado correctamente');
        }

        showNotification('Prueba de chat completada. Revisa la consola.', 'success');
        return true;

    } catch (error) {
        console.error('❌ Error en prueba de chat:', error);
        showNotification('Error en prueba de chat: ' + error.message, 'error');
        return false;
    }
};

// Función de diagnóstico para intercambios
window.diagnoseTrades = function () {
    console.log('🔍 === DIAGNÓSTICO DE INTERCAMBIOS ===');
    console.log('👤 Usuario actual:', currentUser?.uid);

    if (!currentUser) {
        console.error('❌ No hay usuario autenticado');
        return;
    }

    const userTradesKey = `userTrades_${currentUser.uid}`;
    const savedTrades = JSON.parse(localStorage.getItem(userTradesKey) || '[]');

    console.log('📦 Intercambios del usuario:', {
        key: userTradesKey,
        count: savedTrades.length,
        trades: savedTrades.map(t => ({
            id: t.id,
            title: t.title,
            userId: t.userId,
            createdAt: t.createdAt
        }))
    });

    // Verificar todos los intercambios en localStorage
    console.log('🌍 Todos los intercambios en localStorage:');
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('userTrades_')) {
            const trades = JSON.parse(localStorage.getItem(key) || '[]');
            console.log(`- ${key}: ${trades.length} intercambios`, trades.map(t => ({ id: t.id, title: t.title })));
        }
    }

    // Verificar contenedor
    const container = document.getElementById('myTradesContainer');
    console.log('📱 Contenedor myTradesContainer:', {
        exists: !!container,
        innerHTML: container?.innerHTML?.substring(0, 200) + '...'
    });

    console.log('🔧 Acciones disponibles:');
    console.log('- window.diagnoseTrades() - Este diagnóstico');
    console.log('- window.clearAllTrades() - Limpiar todos los intercambios');
    console.log('- window.reloadTrades() - Recargar intercambios');
};

// Función para limpiar todos los intercambios
window.clearAllTrades = function () {
    if (!currentUser) {
        console.error('❌ No hay usuario autenticado');
        return;
    }

    const userTradesKey = `userTrades_${currentUser.uid}`;
    localStorage.setItem(userTradesKey, JSON.stringify([]));
    console.log('🗑️ Intercambios del usuario limpiados');

    // Recargar la vista
    if (typeof loadUserTrades === 'function') {
        loadUserTrades();
    }
};

// Función para recargar intercambios
window.reloadTrades = function () {
    console.log('🔄 Recargando intercambios manualmente...');
    if (typeof loadUserTrades === 'function') {
        loadUserTrades();
    } else {
        console.error('❌ loadUserTrades no está disponible');
    }
};

// Función para verificar intercambios fantasma
window.checkGhostTrades = function () {
    console.log('👻 === VERIFICANDO INTERCAMBIOS FANTASMA ===');
    console.log('👤 Usuario actual:', currentUser?.uid);

    if (!currentUser) {
        console.error('❌ No hay usuario autenticado');
        return;
    }

    const currentUserKey = `userTrades_${currentUser.uid}`;
    console.log('🔑 Clave del usuario actual:', currentUserKey);

    // Verificar todos los intercambios en localStorage
    console.log('🌍 Todos los intercambios en localStorage:');
    const allTradeKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('userTrades_')) {
            allTradeKeys.push(key);
            const trades = JSON.parse(localStorage.getItem(key) || '[]');
            console.log(`- ${key}: ${trades.length} intercambios`);
            trades.forEach(trade => {
                console.log(`  * ${trade.id}: "${trade.title}" (userId: ${trade.userId})`);
            });
        }
    }

    // Verificar si hay claves de otros usuarios
    const otherUserKeys = allTradeKeys.filter(key => key !== currentUserKey);
    if (otherUserKeys.length > 0) {
        console.log('⚠️ INTERCAMBIOS DE OTROS USUARIOS DETECTADOS:', otherUserKeys);
        console.log('💡 Esto podría explicar por qué aparecen intercambios "fantasma"');
    } else {
        console.log('✅ Solo hay intercambios del usuario actual');
    }

    // Verificar el contenedor actual
    const container = document.getElementById('myTradesContainer');
    if (container) {
        const tradeElements = container.querySelectorAll('[class*="bg-gray-50"]');
        console.log('📱 Elementos de intercambio en el DOM:', tradeElements.length);
    }
};

// Función para forzar la carga de intercambios
window.forceLoadTrades = function () {
    console.log('🚀 === FORZANDO CARGA DE INTERCAMBIOS ===');
    console.log('👤 Usuario actual:', currentUser?.uid);

    if (!currentUser) {
        console.error('❌ No hay usuario autenticado');
        return;
    }

    // Verificar localStorage directamente
    const userTradesKey = `userTrades_${currentUser.uid}`;
    const savedTrades = JSON.parse(localStorage.getItem(userTradesKey) || '[]');

    console.log('📦 Intercambios en localStorage:', {
        key: userTradesKey,
        count: savedTrades.length,
        trades: savedTrades.map(t => ({ id: t.id, title: t.title }))
    });

    // Verificar contenedor
    const container = document.getElementById('myTradesContainer');
    console.log('📱 Estado del contenedor:', {
        exists: !!container,
        visible: container ? container.offsetParent !== null : false,
        currentContent: container ? container.innerHTML.substring(0, 200) : 'N/A'
    });

    // Forzar carga
    if (typeof loadUserTrades === 'function') {
        console.log('🔄 Ejecutando loadUserTrades...');
        loadUserTrades();
    } else {
        console.error('❌ loadUserTrades no está disponible');
    }
};

// Función para limpiar intercambios de otros usuarios
window.cleanGhostTrades = function () {
    console.log('🧹 === LIMPIANDO INTERCAMBIOS FANTASMA ===');

    if (!currentUser) {
        console.error('❌ No hay usuario autenticado');
        return;
    }

    const currentUserKey = `userTrades_${currentUser.uid}`;
    let cleaned = 0;

    // Eliminar todas las claves de intercambios que no sean del usuario actual
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('userTrades_') && key !== currentUserKey) {
            console.log('🗑️ Eliminando intercambios de:', key);
            localStorage.removeItem(key);
            cleaned++;
        }
    }

    console.log(`✅ Limpieza completada. ${cleaned} claves eliminadas.`);

    // Recargar la vista
    if (typeof loadUserTrades === 'function') {
        loadUserTrades();
    }
};

// Función para mostrar detalles de carta (mejorada)
window.showCardDetailsOnly = async (cardId, cardName, imageUrl, setName, series, number) => {
    // Crear modal de detalles
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';

    // Mostrar modal con loading
    modal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-bold text-gray-900 dark:text-white">Detalles de la Carta</h3>
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                    </div>
                    
                    <!-- Loading spinner -->
                    <div id="cardDetailsLoading" class="flex justify-center items-center py-8">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span class="ml-3 text-gray-600 dark:text-gray-400">Cargando detalles...</span>
                    </div>
                    
                    <!-- Contenido de detalles (se llenará dinámicamente) -->
                    <div id="cardDetailsContent" class="hidden">
                        <!-- Se llenará con datos de la API -->
                    </div>
                </div>
            `;

    document.body.appendChild(modal);

    try {
        // Obtener datos completos de la carta desde la API
        const response = await fetch(`/api/pokemontcg/cards?q=${encodeURIComponent(cardName)}&pageSize=50`);
        const data = await response.json();
        const card = data.data?.find(c => c.id === cardId) || data.data?.[0];

        if (card) {
            // Ocultar loading y mostrar contenido
            document.getElementById('cardDetailsLoading').classList.add('hidden');
            document.getElementById('cardDetailsContent').classList.remove('hidden');

            // Generar contenido detallado
            document.getElementById('cardDetailsContent').innerHTML = generateCardDetailsHTML(card);
        } else {
            // Fallback si no se encuentra la carta
            document.getElementById('cardDetailsLoading').innerHTML = `
                        <div class="text-center py-8">
                            <p class="text-gray-600 dark:text-gray-400">No se pudieron cargar los detalles completos</p>
                            <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                    class="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                                Cerrar
                            </button>
                        </div>
                    `;
        }
    } catch (error) {
        console.error('Error cargando detalles de carta:', error);
        // Mostrar error
        document.getElementById('cardDetailsLoading').innerHTML = `
                    <div class="text-center py-8">
                        <p class="text-red-600 dark:text-red-400">Error al cargar los detalles</p>
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                class="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                            Cerrar
                        </button>
                    </div>
                `;
    }
};

// Función para generar HTML detallado de la carta
function generateCardDetailsHTML(card) {
    const safeCardName = (card.name || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
    const safeImageUrl = (card.images?.large || card.images?.small || '/images/card-placeholder.svg').replace(/'/g, "\\'").replace(/"/g, '\\"');
    const safeSetName = (card.set?.name || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
    const safeSeries = (card.set?.series || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
    const safeNumber = (card.number || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
    const safeCardId = (card.id || '').replace(/'/g, "\\'").replace(/"/g, '\\"');

    // Obtener precios si están disponibles
    const tcgplayerMetaFields = ['unit', 'updated', 'idProduct'];
    const tcgplayerConditions = Object.fromEntries(
        Object.entries(card.tcgplayer || {}).filter(([k]) => !tcgplayerMetaFields.includes(k))
    );
    const cardmarketData = card.cardmarket || {};
    const hasCardmarketPrices = (cardmarketData.avg30 || cardmarketData.avg1 || cardmarketData.avg) ? true : false;

    // Función para formatear precios
    const formatPrice = (price) => price ? `$${parseFloat(price).toFixed(2)}` : 'N/A';

    // Función para obtener color del tipo
    const getTypeColor = (type) => {
        const colors = {
            'Fire': 'bg-red-500',
            'Water': 'bg-blue-500',
            'Grass': 'bg-green-500',
            'Electric': 'bg-yellow-500',
            'Psychic': 'bg-purple-500',
            'Fighting': 'bg-orange-600',
            'Darkness': 'bg-gray-700',
            'Metal': 'bg-gray-400',
            'Dragon': 'bg-indigo-500',
            'Fairy': 'bg-pink-400',
            'Colorless': 'bg-gray-300'
        };
        return colors[type] || 'bg-gray-400';
    };

    return `
                <!-- Header con gradiente -->
                <div class="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-lg p-6 text-white mb-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h2 class="text-2xl font-bold mb-1">${safeCardName}</h2>
                            <p class="text-blue-100 text-sm">${safeSetName} • ${safeSeries}</p>
                        </div>
                        <div class="text-right">
                            <div class="text-3xl font-bold">#${safeNumber}</div>
                            <div class="text-blue-100 text-xs">${card.rarity || 'Common'}</div>
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Imagen de la carta -->
                    <div class="text-center">
                        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg">
                            <img src="${safeImageUrl}" alt="${safeCardName}" 
                                 class="w-full max-w-sm mx-auto rounded-lg"
                                 onerror="this.src='/images/card-placeholder.svg'">
                        </div>
                    </div>
                    
                    <!-- Información detallada -->
                    <div class="space-y-4">
                        <!-- Información básica -->
                        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-200 dark:border-gray-700">
                            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                                <span class="mr-2">📋</span>
                                Información Básica
                            </h3>
                            <div class="space-y-3">
                                <div class="flex items-center space-x-3">
                                    <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                                        <span class="text-blue-600 dark:text-blue-400 text-sm">🏷️</span>
                                    </div>
                                    <div>
                                        <p class="text-xs text-gray-500 dark:text-gray-400">Nombre</p>
                                        <p class="font-semibold text-gray-900 dark:text-white">${safeCardName}</p>
                                    </div>
                                </div>
                                <div class="flex items-center space-x-3">
                                    <div class="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                                        <span class="text-green-600 dark:text-green-400 text-sm">📦</span>
                                    </div>
                                    <div>
                                        <p class="text-xs text-gray-500 dark:text-gray-400">Set</p>
                                        <p class="font-semibold text-gray-900 dark:text-white">${safeSetName}</p>
                                    </div>
                                </div>
                                <div class="flex items-center space-x-3">
                                    <div class="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                                        <span class="text-purple-600 dark:text-purple-400 text-sm">🎯</span>
                                    </div>
                                    <div>
                                        <p class="text-xs text-gray-500 dark:text-gray-400">Serie</p>
                                        <p class="font-semibold text-gray-900 dark:text-white">${safeSeries}</p>
                                    </div>
                                </div>
                                <div class="flex items-center space-x-3">
                                    <div class="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                                        <span class="text-orange-600 dark:text-orange-400 text-sm">⭐</span>
                                    </div>
                                    <div>
                                        <p class="text-xs text-gray-500 dark:text-gray-400">Rareza</p>
                                        <p class="font-semibold text-gray-900 dark:text-white">${card.rarity || 'Common'}</p>
                                    </div>
                                </div>
                                <div class="flex items-center space-x-3">
                                    <div class="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                        <span class="text-gray-600 dark:text-gray-400 text-sm">🔢</span>
                                    </div>
                                    <div>
                                        <p class="text-xs text-gray-500 dark:text-gray-400">ID</p>
                                        <p class="font-mono text-xs text-gray-900 dark:text-white">${safeCardId}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Tipos y subtipos -->
                        ${(card.types?.length > 0 || card.subtypes?.length > 0) ? `
                        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-200 dark:border-gray-700">
                            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                                <span class="mr-2">⚡</span>
                                Tipos
                            </h3>
                            <div class="space-y-3">
                                ${card.types?.length > 0 ? `
                                <div>
                                    <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Tipos de Energía</p>
                                    <div class="flex flex-wrap gap-2">
                                        ${card.types.map(type => `
                                            <span class="px-3 py-1 ${getTypeColor(type)} text-white rounded-full text-sm font-semibold">
                                                ${type}
                                            </span>
                                        `).join('')}
                                    </div>
                                </div>
                                ` : ''}
                                ${card.subtypes?.length > 0 ? `
                                <div>
                                    <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Subtipos</p>
                                    <div class="flex flex-wrap gap-2">
                                        ${card.subtypes.map(subtype => `
                                            <span class="px-2 py-1 bg-emerald-500 text-white rounded-full text-xs font-medium">
                                                ${subtype}
                                            </span>
                                        `).join('')}
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        ` : ''}
                        
                        <!-- Precios -->
                        ${(Object.keys(tcgplayerConditions).length > 0 || hasCardmarketPrices) ? `
                        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-200 dark:border-gray-700">
                            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                                <span class="mr-2">💰</span>
                                Precios de Mercado
                            </h3>
                            <div class="space-y-4">
                                ${Object.keys(tcgplayerConditions).length > 0 ? `
                                <div>
                                    <div class="flex items-center mb-2">
                                        <div class="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mr-2">
                                            <span class="text-white text-xs font-bold">T</span>
                                        </div>
                                        <h4 class="font-semibold text-gray-800 dark:text-gray-200">TCGPlayer</h4>
                                    </div>
                                    <div class="grid grid-cols-1 gap-2">
                                        ${Object.entries(tcgplayerConditions).map(([condition, prices]) => `
                                            <div class="bg-gray-50 dark:bg-gray-700 rounded p-3">
                                                <div class="font-semibold text-gray-700 dark:text-gray-300 mb-1 capitalize text-sm">${condition}</div>
                                                <div class="space-y-1 text-xs">
                                                    ${prices.lowPrice ? `<div class="flex justify-between"><span class="text-gray-500">Bajo:</span><span class="font-semibold text-green-600">${formatPrice(prices.lowPrice)}</span></div>` : ''}
                                                    ${prices.midPrice ? `<div class="flex justify-between"><span class="text-gray-500">Medio:</span><span class="font-semibold text-blue-600">${formatPrice(prices.midPrice)}</span></div>` : ''}
                                                    ${prices.highPrice ? `<div class="flex justify-between"><span class="text-gray-500">Alto:</span><span class="font-semibold text-red-600">${formatPrice(prices.highPrice)}</span></div>` : ''}
                                                    ${prices.marketPrice ? `<div class="flex justify-between"><span class="text-gray-500">Mercado:</span><span class="font-semibold text-purple-600">${formatPrice(prices.marketPrice)}</span></div>` : ''}
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                                ` : ''}
                                
                                ${hasCardmarketPrices ? `
                                <div>
                                    <div class="flex items-center mb-2">
                                        <div class="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center mr-2">
                                            <span class="text-white text-xs font-bold">C</span>
                                        </div>
                                        <h4 class="font-semibold text-gray-800 dark:text-gray-200">Cardmarket</h4>
                                    </div>
                                    <div class="bg-gray-50 dark:bg-gray-700 rounded p-3">
                                        <div class="grid grid-cols-3 gap-2 text-xs">
                                            ${cardmarketData.avg30 ? `<div class="text-center"><div class="text-gray-500">Prom. 30d</div><div class="font-semibold text-green-600">${formatPrice(cardmarketData.avg30)}</div></div>` : ''}
                                            ${cardmarketData.avg1 ? `<div class="text-center"><div class="text-gray-500">Prom. 1d</div><div class="font-semibold text-blue-600">${formatPrice(cardmarketData.avg1)}</div></div>` : ''}
                                            ${cardmarketData.trend ? `<div class="text-center"><div class="text-gray-500">Tendencia</div><div class="font-semibold text-purple-600">${formatPrice(cardmarketData.trend)}</div></div>` : ''}
                                        </div>
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Botones de acción -->
                <div class="mt-6 flex flex-wrap gap-3 justify-center">
                    <button onclick="addCardDirectly('${safeCardId}', '${safeCardName}', '${safeImageUrl}', '${safeSetName}', '${safeSeries}', '${safeNumber}')" 
                            class="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold transition-colors">
                        + Añadir a Colección
                    </button>
                    <button onclick="showCardOffers('${safeCardName}', '${safeSetName}', '${safeImageUrl}')" 
                            class="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-semibold transition-colors">
                        🤝 Ver Intercambios
                    </button>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold transition-colors">
                        Cerrar
                    </button>
                </div>
            `;
}

// Función para mostrar modal de confirmación personalizado
window.showAddCardModal = (cardId, cardName, imageUrl, setName, series, number) => {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full shadow-xl">
                        <div class="mb-6">
                            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">Añadir a Colección</h3>
                            
                            <!-- Vista previa de la carta -->
                            <div class="flex flex-col items-center mb-4">
                                <img src="${imageUrl}" alt="${cardName}" class="w-32 h-44 object-contain rounded mb-3">
                                <div class="text-center">
                                    <p class="font-semibold text-gray-900 dark:text-white">${cardName}</p>
                                    <p class="text-sm text-gray-600 dark:text-gray-400">${setName} • #${number}</p>
                                </div>
                            </div>
                            
                            <!-- Selector de condición -->
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Condición de la carta
                                </label>
                                <select id="cardConditionSelect" 
                                        class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                                    ${Object.values(CARD_CONDITIONS).map(condition =>
            `<option value="${condition.code}" ${condition.code === 'NM' ? 'selected' : ''}>
                                            ${condition.icon} ${condition.code} - ${condition.name}
                                        </option>`
        ).join('')}
                                </select>
                            </div>
                            
                            <!-- Selector de idioma -->
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Idioma de la carta
                                </label>
                                <select id="cardLanguageSelect" 
                                        class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                                    <option value="Español" selected>🇪🇸 Español</option>
                                    <option value="Inglés">🇺🇸 Inglés</option>
                                    <option value="Francés">🇫🇷 Francés</option>
                                    <option value="Italiano">🇮🇹 Italiano</option>
                                    <option value="Alemán">🇩🇪 Alemán</option>
                                    <option value="Portugués">🇵🇹 Portugués</option>
                                    <option value="Japonés">🇯🇵 Japonés</option>
                                    <option value="Chino">🇨🇳 Chino</option>
                                    <option value="Coreano">🇰🇷 Coreano</option>
                                    <option value="Otro">🌍 Otro</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="flex gap-3 justify-end">
                            <button id="cancelAddCard" 
                                    class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors">
                                Cancelar
                            </button>
                            <button id="confirmAddCard" 
                                    class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">
                                Añadir a Colección
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

        cancelBtn.addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });

        confirmBtn.addEventListener('click', () => {
            const selectedCondition = conditionSelect.value;
            const selectedLanguage = languageSelect.value;
            modal.remove();
            resolve({ condition: selectedCondition, language: selectedLanguage });
        });

        // Cerrar con ESC o click fuera
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve(null);
            }
        });

        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
                resolve(null);
            }
        });
    });
};

// Función para añadir carta directamente (botón separado)
window.addCardDirectly = async (cardId, cardName, imageUrl, setName, series, number) => {
    if (!currentUser) {
        showNotification('Inicia sesión para añadir cartas a tu colección', 'warning', 4000);
        showAuthModal('login');
        return;
    }

    const result = await showAddCardModal(cardId, cardName, imageUrl, setName, series, number);

    if (result) {
        addCardToCollection(cardId, cardName, imageUrl, setName, series, number, result.condition, result.language);
        if (typeof loadUserCollection === 'function') {
            loadUserCollection();
        }
        if (typeof loadProfileStats === 'function') {
            loadProfileStats();
        }
    }
};

// Mantener función original para compatibilidad (deprecated)
window.showCardDetails = window.addCardDirectly;

// Función para añadir carta a la colección
async function addCardToCollection(cardId, cardName, imageUrl, setName, series, number, condition = 'NM', language = 'Español', quantity = 1) {
    if (!currentUser) return;

    try {
        const cardRef = doc(db, 'users', currentUser.uid, 'my_cards', cardId);
        const cardDoc = await getDoc(cardRef);

        if (cardDoc.exists()) {
            const currentData = cardDoc.data();
            const newQuantity = (currentData.quantity || 1) + quantity;
            await setDoc(cardRef, {
                ...currentData,
                quantity: newQuantity,
                condition: condition,
                lastUpdated: new Date()
            });
        } else {
            await setDoc(cardRef, {
                id: cardId,
                name: cardName,
                imageUrl: imageUrl,
                set: setName,
                series: series,
                number: number,
                condition: condition,
                language: language,
                setId: cardId.split('-')[0],
                quantity: quantity,
                addedAt: new Date()
            });
        }
    } catch (error) {
        console.error('Error al añadir carta:', error);
        throw error;
    }
}

// Función para mostrar modal de agregar cartas por set
window.showBulkAddModal = async () => {
    if (!currentUser) {
        showNotification('Inicia sesión para añadir cartas a tu colección', 'warning');
        showAuthModal('login');
        return;
    }

    // Crear modal
    const modal = document.createElement('div');
    modal.id = 'bulkAddModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">
                            ➕ Agregar Cartas por Set
                        </h2>
                        <button class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                onclick="document.getElementById('bulkAddModal').remove()">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <!-- Selector de Set -->
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Selecciona un Set:
                        </label>
                        <select id="bulkSetSelector" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white">
                            <option value="">Cargando sets...</option>
                        </select>
                    </div>
                    
                    <!-- Filtros y controles -->
                    <div class="mb-4 flex flex-wrap gap-2">
                        <button id="selectAllBtn" class="btn-secondary px-3 py-1 rounded text-sm" disabled>
                            ✅ Seleccionar Todas
                        </button>
                        <button id="deselectAllBtn" class="btn-secondary px-3 py-1 rounded text-sm" disabled>
                            ❌ Deseleccionar Todas
                        </button>
                        <span class="text-sm text-gray-600 dark:text-gray-400 ml-auto">
                            Seleccionadas: <span id="selectedCount">0</span>
                        </span>
                    </div>
                    
                    <!-- Contenedor de cartas -->
                    <div class="overflow-y-auto max-h-[50vh] border dark:border-gray-700 rounded-lg p-4">
                        <style>
                            .card-hover-container {
                                position: relative;
                                z-index: 1;
                            }
                            .card-hover-container:hover {
                                z-index: 999;
                            }
                            .card-hover-image {
                                transition: transform 0.2s ease, box-shadow 0.2s ease;
                                transform-origin: left center;
                            }
                            .card-hover-image:hover {
                                transform: scale(3);
                                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                                position: relative;
                                z-index: 1000;
                                background: white;
                                border-radius: 0.375rem;
                            }
                            .dark .card-hover-image:hover {
                                background: rgb(31, 41, 55);
                            }
                        </style>
                        <div id="bulkCardsContainer" class="text-center text-gray-500 dark:text-gray-400 py-8">
                            Selecciona un set para ver las cartas disponibles
                        </div>
                    </div>
                    
                    <!-- Botones de acción -->
                    <div class="mt-6 flex justify-end space-x-3">
                        <button class="btn-secondary px-4 py-2 rounded" onclick="document.getElementById('bulkAddModal').remove()">
                            Cancelar
                        </button>
                        <button id="bulkAddBtn" class="btn-primary px-4 py-2 rounded" disabled>
                            ➕ Agregar Seleccionadas
                        </button>
                    </div>
                </div>
            `;

    document.body.appendChild(modal);

    // Cargar sets disponibles
    loadAvailableSets();

    // Event listeners
    const setSelector = document.getElementById('bulkSetSelector');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const bulkAddBtn = document.getElementById('bulkAddBtn');

    setSelector.addEventListener('change', (e) => {
        if (e.target.value) {
            loadSetCards(e.target.value);
        }
    });

    selectAllBtn.addEventListener('click', () => selectAllCards(true));
    deselectAllBtn.addEventListener('click', () => selectAllCards(false));
    bulkAddBtn.addEventListener('click', () => addSelectedCards());
};

// Cargar sets disponibles (INCLUYE TCGDEX)
async function loadAvailableSets() {
    const selector = document.getElementById('bulkSetSelector');
    if (!selector) return;

    try {
        // Cargar sets de ambas APIs
        const [pokemonResponse, tcgdexResponse] = await Promise.allSettled([
            fetch('/api/pokemontcg/sets'),
            fetch('/api/tcgdex/sets')
        ]);

        let allSets = [];

        // Procesar sets de Pokemon TCG
        if (pokemonResponse.status === 'fulfilled' && pokemonResponse.value.ok) {
            const data = await pokemonResponse.value.json();
            const pokemonSets = data.data || [];
            allSets = [...pokemonSets];
        }

        // Procesar sets de TCGdex
        if (tcgdexResponse.status === 'fulfilled' && tcgdexResponse.value.ok) {
            const data = await tcgdexResponse.value.json();
            const tcgdexSets = data.data || [];

            // Añadir sets de TCGdex que no estén duplicados
            tcgdexSets.forEach(tcgSet => {
                const exists = allSets.some(set =>
                    set.id === tcgSet.id ||
                    (set.name === tcgSet.name && set.releaseDate === tcgSet.releaseDate)
                );
                if (!exists) {
                    allSets.push({
                        ...tcgSet,
                        source: 'tcgdex'
                    });
                }
            });
        }

        // Ordenar sets por fecha de lanzamiento (más recientes primero)
        allSets.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

        selector.innerHTML = '<option value="">Selecciona un set...</option>';

        // Agrupar por fuente
        const pokemonTCGSets = allSets.filter(s => s.source !== 'tcgdex');
        const tcgdexSets = allSets.filter(s => s.source === 'tcgdex');

        // Añadir sets de Pokemon TCG
        if (pokemonTCGSets.length > 0) {
            const optgroup1 = document.createElement('optgroup');
            optgroup1.label = '🌍 Pokemon TCG (Internacional)';
            pokemonTCGSets.forEach(set => {
                const option = document.createElement('option');
                option.value = set.id;
                option.dataset.source = 'pokemontcg';
                option.textContent = `${set.displayName || set.name} (${set.total || set.printedTotal || 0} cartas)`;
                optgroup1.appendChild(option);
            });
            selector.appendChild(optgroup1);
        }

        // Añadir sets de TCGdex
        if (tcgdexSets.length > 0) {
            const optgroup2 = document.createElement('optgroup');
            optgroup2.label = '🌏 TCGdex (Japonés/Coreano/Chino)';
            tcgdexSets.forEach(set => {
                const option = document.createElement('option');
                option.value = set.id;
                option.dataset.source = 'tcgdex';

                // Crear indicadores de idioma mejorados
                const langIndicators = set.languageIndicators || [];
                let langBadges = '';

                if (langIndicators.length === 1) {
                    // Un solo idioma
                    const langClass = langIndicators[0] === 'JP' ? 'lang-indicator-jp' :
                        langIndicators[0] === 'KO' ? 'lang-indicator-ko' :
                            'lang-indicator-ch';
                    langBadges = `<span class="lang-indicator ${langClass}">${langIndicators[0]}</span>`;
                } else if (langIndicators.length > 1) {
                    // Múltiples idiomas
                    langBadges = `<span class="lang-indicator lang-indicator-multi">${langIndicators.join('/')}</span>`;
                }

                // Añadir banderas también
                const flags = set.availableLanguages?.map(l => {
                    switch (l) {
                        case 'ja': return '🇯🇵';
                        case 'ko': return '🇰🇷';
                        case 'zh-cn':
                        case 'zh-tw': return '🇨🇳';
                        default: return '';
                    }
                }).filter(Boolean).join('') || '';

                // Usar innerHTML para incluir el HTML del badge
                const displayText = `${set.displayName || set.name} ${flags} (${set.total || set.printedTotal || 0} cartas)`;
                option.textContent = displayText;
                // Guardar indicadores como data attribute para uso posterior
                option.dataset.langIndicators = langIndicators.join(',');
                option.dataset.languages = JSON.stringify(set.availableLanguages || []);
                optgroup2.appendChild(option);
            });
            selector.appendChild(optgroup2);
        }
    } catch (error) {
        console.error('Error al cargar sets:', error);
        selector.innerHTML = '<option value="">Error al cargar sets</option>';
    }
}

// Cargar cartas de un set (INCLUYE TCGDEX)
async function loadSetCards(setId) {
    const container = document.getElementById('bulkCardsContainer');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const selector = document.getElementById('bulkSetSelector');

    if (!container || !selector) return;

    // Obtener la fuente del set seleccionado
    const selectedOption = selector.options[selector.selectedIndex];
    const source = selectedOption?.dataset?.source || 'pokemontcg';

    container.innerHTML = `
                <div class="text-center py-8">
                    <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
                    <p class="text-lg text-gray-600 dark:text-gray-300">Cargando cartas del set...</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Esto puede tardar unos segundos</p>
                </div>
            `;
    selectAllBtn.disabled = true;
    deselectAllBtn.disabled = true;

    try {
        let response;
        if (source === 'tcgdex') {
            response = await fetch(`/api/tcgdex/cards?set=${setId}`);
        } else {
            response = await fetch(`/api/pokemontcg/cards?setId=${encodeURIComponent(setId)}&pageSize=250`);
        }

        if (!response.ok) throw new Error('Error al cargar cartas');

        const data = await response.json();
        const cards = (data.data || []).sort((a, b) => {
            const nA = parseInt(a.number) || 0;
            const nB = parseInt(b.number) || 0;
            return nA - nB;
        });

        if (cards.length === 0) {
            container.innerHTML = '<div class="text-center py-4">No se encontraron cartas</div>';
            return;
        }

        // Crear tabla de cartas
        container.innerHTML = `
                    <table class="w-full">
                        <thead>
                            <tr class="border-b dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
                                <th class="text-left p-2 w-8">
                                    <input type="checkbox" id="selectAllCheckbox" class="rounded">
                                </th>
                                <th class="text-left p-2 w-10">#</th>
                                <th class="text-left p-2 w-14">Img</th>
                                <th class="text-left p-2">Nombre</th>
                                <th class="text-left p-2">Rareza</th>
                                <th class="text-left p-2 w-20">Cant.</th>
                                <th class="text-left p-2 w-28">Condición</th>
                            </tr>
                        </thead>
                        <tbody id="cardsTableBody">
                            ${cards.map(card => `
                                <tr class="border-b dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td class="p-2">
                                        <input type="checkbox" class="card-checkbox rounded" 
                                               data-card-id="${card.id}"
                                               data-card-name="${card.displayName || card.name}"
                                               data-card-image="${card.images.small}"
                                               data-card-set="${card.set?.displayName || card.set?.name || ''}"
                                               data-card-series="${card.set?.series || ''}"
                                               data-card-number="${card.number}">
                                    </td>
                                    <td class="p-2 text-sm">${card.number}</td>
                                    <td class="p-2">
                                        <div class="card-hover-container">
                                            <img src="${card.images?.small || '/images/card-placeholder.svg'}" 
                                                 alt="${card.displayName || card.name}" 
                                                 class="card-hover-image w-12 h-16 object-contain cursor-pointer"
                                                 loading="lazy"
                                                 onerror="this.src='/images/card-placeholder.svg'"
                                                 onclick="window.open('${card.images?.large || card.images?.small || '#'}', '_blank')">
                                        </div>
                                    </td>
                                    <td class="p-2 font-medium">${card.displayName || card.name}</td>
                                    <td class="p-2 text-xs text-gray-500">${card.rarity || 'Common'}</td>
                                    <td class="p-2">
                                        <input type="number" min="1" max="99" value="1"
                                               class="card-quantity w-14 px-1 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                                               data-card-id="${card.id}">
                                    </td>
                                    <td class="p-2">
                                        <select class="card-condition w-24 px-1 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                                                data-card-id="${card.id}">
                                            <option value="NM">NM</option>
                                            <option value="EX">EX</option>
                                            <option value="GD">GD</option>
                                            <option value="PO">PO</option>
                                        </select>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

        // Habilitar botones
        selectAllBtn.disabled = false;
        deselectAllBtn.disabled = false;

        // Event listeners para checkboxes
        const checkboxes = container.querySelectorAll('.card-checkbox');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', updateSelectedCount);
        });

        // Checkbox para seleccionar todas
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        selectAllCheckbox.addEventListener('change', (e) => {
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            updateSelectedCount();
        });

    } catch (error) {
        console.error('Error al cargar cartas del set:', error);
        container.innerHTML = '<div class="text-center py-4 text-red-500">Error al cargar las cartas</div>';
    }
}

// Seleccionar/deseleccionar todas las cartas
function selectAllCards(select) {
    const checkboxes = document.querySelectorAll('.card-checkbox');
    checkboxes.forEach(cb => cb.checked = select);
    document.getElementById('selectAllCheckbox').checked = select;
    updateSelectedCount();
}

// Actualizar contador de seleccionadas
function updateSelectedCount() {
    const selected = document.querySelectorAll('.card-checkbox:checked').length;
    document.getElementById('selectedCount').textContent = selected;

    const bulkAddBtn = document.getElementById('bulkAddBtn');
    bulkAddBtn.disabled = selected === 0;
    bulkAddBtn.textContent = selected > 0 ? `➕ Agregar Seleccionadas (${selected})` : '➕ Agregar Seleccionadas';
}

// Agregar cartas seleccionadas
async function addSelectedCards() {
    const selected = document.querySelectorAll('.card-checkbox:checked');
    if (selected.length === 0) return;

    const bulkAddBtn = document.getElementById('bulkAddBtn');
    bulkAddBtn.disabled = true;
    bulkAddBtn.textContent = 'Agregando...';

    let addedCount = 0;
    const errors = [];

    for (const checkbox of selected) {
        const cardId = checkbox.dataset.cardId;
        const quantityInput = document.querySelector(`.card-quantity[data-card-id="${cardId}"]`);
        const conditionInput = document.querySelector(`.card-condition[data-card-id="${cardId}"]`);
        const quantity = parseInt(quantityInput?.value) || 1;
        const condition = conditionInput?.value || 'NM';

        try {
            await addCardToCollection(
                cardId,
                checkbox.dataset.cardName,
                checkbox.dataset.cardImage,
                checkbox.dataset.cardSet,
                checkbox.dataset.cardSeries,
                checkbox.dataset.cardNumber,
                condition,
                'Español',
                quantity
            );
            addedCount += quantity;
        } catch (error) {
            console.error(`Error al agregar ${checkbox.dataset.cardName}:`, error);
            errors.push(checkbox.dataset.cardName);
        }
    }

    // Cerrar modal
    document.getElementById('bulkAddModal')?.remove();

    // Mostrar resultado
    if (errors.length === 0) {
        showNotification(`✅ ${addedCount} cartas agregadas exitosamente`, 'success');
    } else {
        showNotification(`⚠️ ${addedCount} cartas agregadas. ${errors.length} errores.`, 'warning');
    }

    // Recargar colección
    if (typeof loadUserCollection === 'function') {
        loadUserCollection();
    }
}

// Función para cargar más resultados
window.loadMoreResults = async (query) => {
    console.log('🔄 Intentando cargar más resultados para:', query);

    if (errorMessage) errorMessage.classList.add('hidden');
    showLoadingSpinner();

    try {
        // Intentar con wildcard pero menos resultados
        const encodedQuery = encodeURIComponent(query.toLowerCase());
        const moreUrl = `/api/pokemontcg/cards?q=${encodeURIComponent(query.toLowerCase())}&pageSize=50`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // Más tiempo

        const response = await fetch(moreUrl, {
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            const cards = data.data || [];

            // Limpiar contenedor y mostrar nuevos resultados
            cardsContainer.innerHTML = '';

            if (cards.length > 0) {
                // Usar la función de renderizado estándar para consistencia
                renderCardsFromData(cards);

                if (errorMessage) {
                    errorMessage.innerHTML = `✅ ¡Éxito! Cargadas ${cards.length} cartas adicionales.`;
                    errorMessage.classList.remove('hidden');
                }
            }
        } else {
            throw new Error(`HTTP ${response.status}`);
        }

    } catch (error) {
        console.error('Error al cargar más resultados:', error);
        if (errorMessage) {
            errorMessage.textContent = '❌ No se pudieron cargar más resultados. La API está muy lenta en este momento.';
            errorMessage.classList.remove('hidden');
        }
    } finally {
        hideLoadingSpinner();
    }
};

// Función de búsqueda súper rápida (solo 10 resultados)
window.quickSearch = async () => {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim();

    if (query.length > 0 && query.length < 2) {
        alert('Por favor, escribe al menos 2 caracteres para buscar.');
        return;
    }

    console.log('🚀 Búsqueda rápida iniciada para:', query);

    if (cardsContainer) cardsContainer.innerHTML = '';
    if (noResultsMessage) noResultsMessage.classList.add('hidden');
    if (errorMessage) errorMessage.classList.add('hidden');

    showLoadingSpinner();
    showSearchResults();

    try {
        const encodedQuery = encodeURIComponent('name:' + query.toLowerCase());
        // Búsqueda directa a la API pública de pokemontcg.io
        const quickUrl = `/api/pokemontcg/cards?q=${encodeURIComponent(query.toLowerCase())}&pageSize=10`;

        console.log('🚀 Quick URL:', quickUrl);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(quickUrl, {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            const cards = data.data || [];

            console.log('🚀 Quick search success:', cards.length, 'cards');

            if (cards.length > 0) {
                // Usar la función de renderizado estándar para consistencia
                renderCardsFromData(cards);

                if (errorMessage) {
                    errorMessage.innerHTML = `✅ Búsqueda rápida: ${cards.length} cartas encontradas. <button onclick="fetchCards('${query}')" class="bg-blue-500 text-white px-3 py-1 rounded ml-2">🔍 Buscar Más</button>`;
                    errorMessage.classList.remove('hidden');
                }
            } else {
                if (noResultsMessage) {
                    noResultsMessage.textContent = `Búsqueda rápida: No se encontraron cartas para "${query}".`;
                    noResultsMessage.classList.remove('hidden');
                }
            }
        } else {
            throw new Error(`HTTP ${response.status}`);
        }

    } catch (error) {
        console.error('❌ Quick search error:', error);
        if (errorMessage) {
            errorMessage.textContent = '⚡ Búsqueda rápida falló. Prueba la búsqueda normal.';
            errorMessage.classList.remove('hidden');
        }
    } finally {
        hideLoadingSpinner();
    }
};

// Hacer funciones disponibles globalmente
// Hacer funciones disponibles globalmente
window.showAuthModal = showAuthModal;
window.hideAuthModal = hideAuthModal;
window.showMyCardsSection = showMyCardsSection;
window.showHelpSection = showHelpSection;
window.showInterchangesSection = showInterchangesSection;
window.showProfileSection = showProfileSection;
window.showInitialSections = showInitialSections;
window.fetchCards = fetchCards;
window.editTrade = editTrade;
window.deleteTrade = deleteTrade;
window.proposeTrade = proposeTrade;
window.viewTradeDetails = viewTradeDetails;
window.createConditionSelector = createConditionSelector;
window.showConditionInfo = showConditionInfo;
window.getConditionColor = getConditionColor;
window.getConditionIcon = getConditionIcon;
window.calculateCollectionValue = calculateCollectionValue;
window.formatCurrency = formatCurrency;

// Cargar y renderizar Mi Colección
async function loadUserCollection() {
    const grid = document.getElementById('myCardsGrid');
    const status = document.getElementById('myCardsStatus');
    if (!grid) return;
    if (!currentUser) {
        if (status) status.textContent = 'Inicia sesión para ver tu colección';
        grid.innerHTML = `
                    <div class="col-span-full text-center text-gray-500 py-8">
                        <p>No hay cartas en tu colección</p>
                    </div>
                `;
        return;
    }

    try {
        if (status) status.textContent = 'Cargando tu colección...';
        const cardsRef = collection(db, 'users', currentUser.uid, 'my_cards');
        const snap = await getDocs(cardsRef);
        const cards = [];
        snap.forEach(d => cards.push({ id: d.id, ...d.data() }));

        if (cards.length === 0) {
            grid.innerHTML = `
                        <div class="col-span-full text-center text-gray-500 py-8">
                            <p>No hay cartas en tu colección</p>
                        </div>
                    `;
        } else {
            // Obtener precios de PostgreSQL en una sola petición batch
            try {
                const ids = cards.map(c => c.id).join(',');
                const priceRes = await fetch(`/api/pokemontcg/cards/prices?ids=${encodeURIComponent(ids)}`);
                const priceData = await priceRes.json();
                if (priceData.success) {
                    cards.forEach(card => {
                        card.marketPrices = priceData.data[card.id] || { cardmarket: null, tcgplayer: null };
                    });
                }
            } catch (e) {
                console.warn('No se pudieron obtener precios de mercado:', e);
            }
            renderMyCards(cards);
        }
        if (status) status.textContent = '';
    } catch (err) {
        console.error('Error al cargar colección:', err);
        if (status) status.textContent = 'Error al cargar tu colección';
    }
}

function renderMyCards(cards) {
    const container = document.getElementById('myCardsGrid');
    if (!container) return;

    // Cambiar el contenedor a diseño de lista
    container.className = 'space-y-1 border rounded-lg bg-white dark:bg-gray-800';
    container.innerHTML = '';

    if (cards.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8">No hay cartas en tu colección</div>';
        return;
    }

    cards.forEach((card, index) => {
        const imageUrl = card.imageUrl || '';
        const name = card.name || card.id;
        const setName = (typeof card.set === 'string' ? card.set : card.set?.name) || 'Set';
        const number = card.number || '';
        const language = card.language || 'Español';
        const condition = card.condition || 'NM';
        const cardId = card.id || name;

        const row = document.createElement('div');
        row.className = 'relative flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 overflow-visible';
        if (index < cards.length - 1) {
            row.className += ' border-b';
        }

        // Icono de imagen con hover
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'w-10 h-10 flex items-center justify-center bg-transparent rounded cursor-pointer absolute left-3 top-3 z-10';
        imgWrapper.title = 'Pasa el mouse para ver imagen';
        imgWrapper.innerHTML = '<span class="text-xl">🎴</span>';

        // Contenedor de imagen con hover
        const imgContainer = document.createElement('div');
        imgContainer.className = 'hidden absolute left-14 top-0 z-30';
        imgContainer.style.pointerEvents = 'none';

        const imgEl = document.createElement('img');
        imgEl.src = imageUrl || 'https://placehold.co/400x550/a0aec0/ffffff?text=Sin+imagen';
        imgEl.alt = name || 'Carta';
        imgEl.className = 'w-64 h-auto object-contain rounded-lg shadow-2xl border-2 border-gray-200';
        imgEl.onerror = () => { imgEl.src = 'https://placehold.co/400x550/a0aec0/ffffff?text=Error'; };

        imgContainer.appendChild(imgEl);
        row.appendChild(imgContainer);

        // Eventos de hover
        imgWrapper.addEventListener('mouseenter', () => {
            imgContainer.classList.remove('hidden');
        });

        imgWrapper.addEventListener('mouseleave', () => {
            imgContainer.classList.add('hidden');
        });

        // Información de la carta
        const info = document.createElement('div');
        info.className = 'flex-1 min-w-0 pl-16';

        const escapedId = cardId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escapedName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escapedSet = setName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escapedImage = imageUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escapedCondition = condition.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escapedLanguage = language.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const isTransferable = !!card.isTransferable;
        const customPriceDisplay = card.customPrice != null
            ? `<span class="text-orange-600 dark:text-orange-400 font-semibold">💰 ${formatTradePrice(card.customPrice)}</span>`
            : `<span class="text-gray-400 dark:text-gray-500 italic">Sin precio personal</span>`;

        // Precios de mercado ya disponibles desde PostgreSQL (sin llamada extra)
        const mp = card.marketPrices;
        let marketPriceHtml = '<span class="text-gray-400 italic">Sin precio de mercado</span>';
        if (mp && (mp.cardmarket || mp.tcgplayer)) {
            const parts = [];
            if (mp.cardmarket) parts.push(`<span class="text-green-600 dark:text-green-400 font-medium">💳 ${formatTradePrice(mp.cardmarket)}</span>`);
            if (mp.tcgplayer) parts.push(`<span class="text-blue-600 dark:text-blue-400 font-medium">🎮 $${mp.tcgplayer.toFixed(2)}</span>`);
            marketPriceHtml = parts.join('<span class="text-gray-400 mx-1">·</span>');
        }

        const transferableBadge = isTransferable
            ? `<span class="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-0.5 rounded font-semibold">🔄 Transferible</span>`
            : '';

        info.innerHTML = `
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-semibold text-gray-900 dark:text-white">${name}</span>
                        <span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">En colección</span>
                        ${transferableBadge}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400">
                        #${number} · ${setName} · ${language} · ${condition}
                    </div>
                    <div class="flex items-center gap-2 mt-0.5 flex-wrap text-xs">
                        <span class="text-gray-500 dark:text-gray-400">Mercado:</span>
                        ${marketPriceHtml}
                    </div>
                    <div class="flex items-center gap-2 mt-0.5 text-xs">
                        <span class="text-gray-500 dark:text-gray-400">Personal:</span>
                        ${customPriceDisplay}
                        <button onclick="showEditCustomPriceModal('${escapedId}', '${escapedName}', ${card.customPrice != null ? card.customPrice : 'null'})"
                                class="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 ml-1"
                                title="Editar precio personal">✏️</button>
                    </div>
                </div>
                <div class="flex flex-col gap-1 flex-shrink-0 items-end">
                    <button onclick="toggleCardTransferable('${escapedId}', '${escapedName}', '${escapedImage}', '${escapedSet}', '${escapedCondition}', '${escapedLanguage}', ${card.customPrice != null ? card.customPrice : 'null'}, ${isTransferable})"
                            class="${isTransferable ? 'bg-purple-500 hover:bg-purple-600 text-white' : 'bg-gray-100 hover:bg-purple-100 text-gray-600 dark:bg-gray-700 dark:hover:bg-purple-900 dark:text-gray-300'} px-3 py-1.5 rounded text-xs font-semibold transition-colors"
                            title="${isTransferable ? 'Quitar de intercambios' : 'Marcar como disponible para intercambio'}">
                        ${isTransferable ? '🔄 Transferible' : '🔒 Marcar transferible'}
                    </button>
                    <button class="btn-secondary px-3 py-1.5 rounded text-xs" onclick="removeCardFromCollection('${escapedId}')">
                        Eliminar
                    </button>
                </div>
            </div>
        `;

        row.appendChild(imgWrapper);
        row.appendChild(info);
        container.appendChild(row);
    });
}

// Estado de filtros de búsqueda
const searchFiltersState = {
    series: '', set: '', rarity: '', type: '', language: '', subtype: '', hasImage: '', hasPrice: ''
};

// Estado de paginación de búsqueda
let lastSearchBase = '';
let searchPage = 1;
let searchPageSize = 20;
let searchTotal = 0;
let searchCache = new Map(); // Cache para resultados de búsqueda
let currentSearchId = null; // ID único para cada búsqueda

function buildCardsQuery(baseQuery) {
    // Para nuestro endpoint combinado, solo devolvemos la query base
    // Los filtros se pasan como parámetros separados
    return baseQuery;
}

function buildCardsApiUrl(baseQuery, page, pageSize) {
    const qParam = encodeURIComponent(baseQuery || '');
    const pageParam = page ? `&page=${page}` : '';
    const seriesParam = searchFiltersState.series ? `&series=${encodeURIComponent(searchFiltersState.series)}` : '';
    const setParam = searchFiltersState.set ? `&set=${encodeURIComponent(searchFiltersState.set)}` : '';
    const rarityParam = searchFiltersState.rarity ? `&rarity=${encodeURIComponent(searchFiltersState.rarity)}` : '';
    const typeParam = searchFiltersState.type ? `&type=${encodeURIComponent(searchFiltersState.type)}` : '';

    const finalUrl = `/api/pokemontcg/cards?q=${qParam}${pageParam}&pageSize=${pageSize}${seriesParam}${setParam}${rarityParam}${typeParam}`;
    console.log('buildCardsApiUrl:', finalUrl);
    return finalUrl;
}

function renderPagination(totalCount, page, pageSize) {
    const pagination = document.getElementById('searchPagination');
    if (!pagination) return;
    pagination.innerHTML = '';
    if (!totalCount || totalCount <= pageSize) return;

    const totalPages = Math.ceil(totalCount / pageSize);
    const maxButtons = 7;
    const start = Math.max(1, page - 3);
    const end = Math.min(totalPages, start + maxButtons - 1);

    const makeBtn = (label, targetPage, isActive = false, disabled = false) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.className = `px-3 py-1 rounded ${isActive ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;
        if (!disabled && !isActive) {
            btn.addEventListener('click', () => goToSearchPage(targetPage));
        }
        return btn;
    };

    pagination.appendChild(makeBtn('«', 1, false, page === 1));
    pagination.appendChild(makeBtn('‹', Math.max(1, page - 1), false, page === 1));

    for (let p = start; p <= end; p++) {
        pagination.appendChild(makeBtn(String(p), p, p === page));
    }

    pagination.appendChild(makeBtn('›', Math.min(totalPages, page + 1), false, page === totalPages));
    pagination.appendChild(makeBtn('»', totalPages, false, page === totalPages));
}

async function goToSearchPage(targetPage) {
    // Verificar si ya tenemos esta página en cache
    const cacheKey = `${currentSearchId}_${targetPage}`;
    if (searchCache.has(cacheKey)) {
        console.log('⚡ Loading from cache:', targetPage);
        const cachedData = searchCache.get(cacheKey);
        searchPage = targetPage;
        renderCardsFromData(cachedData.cards);
        renderPagination(cachedData.totalCount, searchPage, searchPageSize);
        return;
    }

    // Si no está en cache, hacer la llamada a la API
    searchPage = targetPage;
    const apiUrl = buildCardsApiUrl(lastSearchBase, searchPage, searchPageSize);
    console.log('🌐 Fetching page:', searchPage, apiUrl);

    // Mostrar loading instantáneo
    showPageLoading();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
        const response = await fetch(apiUrl, { signal: controller.signal, headers: { 'Content-Type': 'application/json' } });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const cards = data.data || [];
        cardsContainer.innerHTML = '';
        cards.forEach((card) => {
            // Función para escapar caracteres especiales
            const escapeForOnclick = (str) => {
                return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
            };

            const safeCardId = escapeForOnclick(card.id);
            const safeCardName = escapeForOnclick(card.name);
            const safeSetName = escapeForOnclick(card.set?.name || 'N/A');
            const safeSeries = escapeForOnclick(card.set?.series || 'N/A');
            const safeNumber = escapeForOnclick(card.number || 'N/A');
            const safeImageUrl = escapeForOnclick(card.images?.small);

            const row = document.createElement('div');
            row.className = 'relative flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 h-16 overflow-visible';
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'w-10 h-10 flex items-center justify-center bg-transparent rounded cursor-pointer absolute left-3 top-1/2 -translate-y-1/2 z-10';
            imgWrapper.title = 'Pasa el mouse para ver imagen';
            imgWrapper.innerHTML = '<span class="text-xl">🎴</span>';

            // Crear contenedor de imagen con hover
            const imgContainer = document.createElement('div');
            imgContainer.className = 'hidden absolute left-14 top-1/2 -translate-y-1/2 z-30';
            imgContainer.style.pointerEvents = 'none';

            const imgEl = document.createElement('img');
            imgEl.src = (card.images?.large || card.images?.small) || 'https://placehold.co/400x550/a0aec0/ffffff?text=Sin+imagen';
            imgEl.alt = card.name || 'Carta';
            imgEl.className = 'w-64 h-auto object-contain rounded-lg shadow-2xl border-2 border-gray-200';
            imgEl.onerror = () => { imgEl.src = 'https://placehold.co/400x550/a0aec0/ffffff?text=Error'; };

            imgContainer.appendChild(imgEl);
            row.appendChild(imgContainer);

            // Eventos de hover
            imgWrapper.addEventListener('mouseenter', () => {
                imgContainer.classList.remove('hidden');
            });

            imgWrapper.addEventListener('mouseleave', () => {
                imgContainer.classList.add('hidden');
            });

            const info = document.createElement('div');
            info.className = 'flex-1 min-w-0 pl-16';
            info.innerHTML = `
                        <div class="flex items-center justify-between">
                            <div class="truncate">
                                <div class="font-semibold text-gray-900 dark:text-white truncate">${card.name || 'Nombre no disponible'}</div>
                                <div class="text-xs text-gray-600 dark:text-gray-300 truncate">Set: ${card.set?.name || 'N/A'} · Serie: ${card.set?.series || 'N/A'} · Nº: ${card.number || 'N/A'}</div>
                            </div>
                            <div class="flex gap-2 items-center">
                                <button class="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                                        onclick="showCardOffers('${safeCardName}', '${safeSetName}', '${safeImageUrl}')">
                                    <span>🤝</span>
                                    <span>Ofrecidas: ${getCardOffersCount(card.name, card.set?.name || '')}</span>
                                </button>
                                <button class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                                    onclick="showCardDetailsOnly('${safeCardId}', '${safeCardName}', '${safeImageUrl}', '${safeSetName}', '${safeSeries}', '${safeNumber}')">Ver Detalles</button>
                                <button class="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs"
                                    onclick="addCardDirectly('${safeCardId}', '${safeCardName}', '${safeImageUrl}', '${safeSetName}', '${safeSeries}', '${safeNumber}')">+ Añadir</button>
                            </div>
                        </div>
                    `;

            row.appendChild(imgWrapper);
            row.appendChild(info);
            cardsContainer.appendChild(row);
        });

        const totalCount = data.pagination?.total || data.totalCount || 0;

        // Guardar en cache
        searchCache.set(cacheKey, { cards, totalCount });

        // Limpiar cache si es muy grande (máximo 50 páginas)
        if (searchCache.size > 50) {
            const firstKey = searchCache.keys().next().value;
            searchCache.delete(firstKey);
        }

        renderCardsFromData(cards);
        renderPagination(totalCount, searchPage, searchPageSize);
        hidePageLoading();
    } catch (e) {
        clearTimeout(timeoutId);
        console.error('❌ Error al cargar página:', e);
        hidePageLoading();
        showPageError();
    }
}

// Función para renderizar cartas desde datos (reutilizable)
function renderCardsFromData(cards) {
    console.log('🎴 Renderizando', cards.length, 'cartas...');
    cardsContainer.innerHTML = '';
    cards.forEach((card) => {
        // Función para escapar caracteres especiales
        const escapeForOnclick = (str) => {
            return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
        };

        const safeCardId = escapeForOnclick(card.id);
        const safeCardName = escapeForOnclick(card.name);
        const safeSetName = escapeForOnclick(card.set?.name || 'N/A');
        const safeSeries = escapeForOnclick(card.set?.series || 'N/A');
        const safeNumber = escapeForOnclick(card.number || 'N/A');
        const safeImageUrl = escapeForOnclick(card.images?.small);

        // ID único para el panel de usuarios (basado en el ID de la carta)
        const panelId = 'users-panel-' + (card.id || '').replace(/[^a-zA-Z0-9]/g, '-');

        const row = document.createElement('div');
        row.className = 'relative flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[4rem] overflow-visible';
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'w-10 h-10 flex items-center justify-center bg-transparent rounded cursor-pointer absolute left-3 top-3 z-10';
        imgWrapper.title = 'Pasa el mouse para ver imagen';
        imgWrapper.innerHTML = '<span class="text-xl">🎴</span>';

        // Crear contenedor de imagen con hover
        const imgContainer = document.createElement('div');
        imgContainer.className = 'hidden absolute left-14 top-0 z-30';
        imgContainer.style.pointerEvents = 'none';

        // Función para obtener URL de imagen válida
        function getValidImageUrl(images) {
            if (!images) return 'https://placehold.co/400x550/a0aec0/ffffff?text=Sin+imagen';
            
            const imageUrl = images.large || images.small;
            if (!imageUrl) return 'https://placehold.co/400x550/a0aec0/ffffff?text=Sin+imagen';
            
            // Si ya es una URL local, usarla directamente
            if (imageUrl.startsWith('/images/')) {
                return imageUrl;
            }
            
            // URLs de TCGdex son válidas, usarlas directamente
            
            return imageUrl;
        }

        const imgEl = document.createElement('img');
        imgEl.src = getValidImageUrl(card.images);
        imgEl.alt = card.name || 'Carta';
        imgEl.className = 'w-64 h-auto object-contain rounded-lg shadow-2xl border-2 border-gray-200';
        imgEl.onerror = () => { 
            console.log('❌ Error cargando imagen:', imgEl.src, 'para carta:', card.name);
            imgEl.src = 'https://placehold.co/400x550/3b82f6/ffffff?text=Carta+No+Disponible'; 
        };

        imgContainer.appendChild(imgEl);
        row.appendChild(imgContainer);

        // Eventos de hover
        imgWrapper.addEventListener('mouseenter', () => {
            imgContainer.classList.remove('hidden');
        });

        imgWrapper.addEventListener('mouseleave', () => {
            imgContainer.classList.add('hidden');
        });

        // Format prices
        const formatPrice = (price) => {
            if (!price || price === 0) return null;
            return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(price);
        };
        const cardmarketPrice = card.cardmarket?.avg30 || card.cardmarket?.avg1 || card.cardmarket?.avg || null;
        const tcgplayerPrice = card.tcgplayer?.normal?.marketPrice || card.tcgplayer?.holofoil?.marketPrice || null;

        // Precio de mercado estándar (preferir Cardmarket en EUR)
        const standardMarketPrice = cardmarketPrice;

        const info = document.createElement('div');
        info.className = 'flex-1 min-w-0 pl-16';
        info.innerHTML = `
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0 flex-1">
                            <div class="font-semibold text-gray-900 dark:text-white truncate">${card.name || 'Nombre no disponible'}</div>
                            <div class="text-xs text-gray-600 dark:text-gray-300 truncate">Set: ${card.set?.name || 'N/A'} · Serie: ${card.set?.series || 'N/A'} · Nº: ${card.number || 'N/A'}</div>
                            ${(cardmarketPrice || tcgplayerPrice) ? `
                                <div class="flex gap-3 text-xs mt-1">
                                    ${cardmarketPrice ? `<span class="text-green-600 dark:text-green-400 font-semibold">💳 ${formatPrice(cardmarketPrice)}</span>` : ''}
                                    ${tcgplayerPrice ? `<span class="text-blue-600 dark:text-blue-400 font-semibold">🎮 $${tcgplayerPrice.toFixed(2)}</span>` : ''}
                                </div>
                            ` : ''}
                        </div>
                        <div class="flex flex-wrap gap-1 items-start justify-end shrink-0">
                            <button class="bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                                id="ver-usuarios-btn-${panelId}"
                                onclick="showUsersWithCard('${safeCardId}', '${safeCardName}', '${safeSetName}', '${safeImageUrl}', '${panelId}', ${standardMarketPrice || 'null'}, this)">
                                <span>👥</span><span>Ver usuarios</span>
                            </button>
                            <button class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-xs"
                                onclick="showCardDetailsOnly('${safeCardId}', '${safeCardName}', '${safeImageUrl}', '${safeSetName}', '${safeSeries}', '${safeNumber}')">Ver Detalles</button>
                            <button class="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded text-xs"
                                onclick="addCardDirectly('${safeCardId}', '${safeCardName}', '${safeImageUrl}', '${safeSetName}', '${safeSeries}', '${safeNumber}')">+ Añadir</button>
                        </div>
                    </div>
                    <div id="${panelId}" class="hidden mt-2 border-t border-gray-100 dark:border-gray-600 pt-2"></div>
                `;

        row.appendChild(imgWrapper);
        row.appendChild(info);
        cardsContainer.appendChild(row);
        console.log('✅ Carta renderizada:', card.name);
    });

}

// Busca en localStorage los usuarios que tienen una carta en sus intercambios ofrecidos
function getUsersWithCardForTrade(cardName, cardId) {
    const users = [];
    const seen = new Set(); // evitar duplicados por usuario

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('userTrades_')) continue;

        try {
            const trades = JSON.parse(localStorage.getItem(key) || '[]');
            const userId = key.replace('userTrades_', '');

            // Saltar las cartas del usuario actual
            if (currentUser && userId === currentUser.uid) continue;

            trades.forEach(trade => {
                if (!trade.offeredCards || !Array.isArray(trade.offeredCards)) return;

                const matchingCard = trade.offeredCards.find(c => {
                    const nameMatch = (c.name || '').toLowerCase() === (cardName || '').toLowerCase();
                    const idMatch = cardId && c.id && c.id === cardId;
                    return nameMatch || idMatch;
                });

                if (matchingCard && !seen.has(userId)) {
                    seen.add(userId);
                    users.push({
                        userId,
                        userName: trade.user || trade.userName || 'Usuario',
                        tradeId: trade.id,
                        customPrice: matchingCard.customPrice ?? null,
                        condition: matchingCard.condition || null,
                        language: matchingCard.language || null,
                        cardImage: matchingCard.image || null
                    });
                }
            });
        } catch (e) {
            // ignorar entradas corruptas
        }
    }

    return users;
}

// Muestra u oculta el panel de usuarios que tienen la carta disponible para intercambio
window.showUsersWithCard = function(cardId, cardName, cardSet, cardImageUrl, panelId, marketPrice, buttonEl) {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    // Toggle: si ya está visible, ocultar
    if (!panel.classList.contains('hidden')) {
        panel.classList.add('hidden');
        if (buttonEl) {
            buttonEl.innerHTML = '<span>👥</span><span>Ver usuarios</span>';
            buttonEl.classList.remove('bg-purple-700');
            buttonEl.classList.add('bg-purple-500');
        }
        return;
    }

    // Mostrar estado de carga
    panel.classList.remove('hidden');
    panel.innerHTML = `
        <div class="flex items-center gap-2 py-2 px-3 text-sm text-gray-500 dark:text-gray-400">
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent"></div>
            <span>Buscando usuarios...</span>
        </div>
    `;
    if (buttonEl) {
        buttonEl.innerHTML = '<span>👥</span><span>Ver usuarios</span>';
        buttonEl.classList.add('bg-purple-700');
        buttonEl.classList.remove('bg-purple-500');
    }

    // Función que renderiza la lista de usuarios
    function renderUsersPanel(users) {
        if (users.length === 0) {
            panel.innerHTML = `
                <div class="py-3 px-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                    😔 Ningún usuario tiene esta carta disponible para intercambio en este momento.
                </div>
            `;
            if (buttonEl) buttonEl.innerHTML = `<span>👥</span><span>Ver usuarios (0)</span>`;
            return;
        }

        const usersHTML = users.map(user => {
            const userStats = JSON.parse(localStorage.getItem(`userStats_${user.userId}`) || '{}');
            const ratingHtml = userStats.averageRating
                ? `${window.displayPokeballRating ? window.displayPokeballRating(userStats.averageRating, false, 'small') : ''}<span class="text-xs text-gray-500 dark:text-gray-400 ml-1">${userStats.averageRating.toFixed(1)}/5</span>`
                : '<span class="text-xs text-gray-400 dark:text-gray-500 italic">Sin valoraciones</span>';

            let priceHTML;
            if (user.customPrice != null) {
                priceHTML = `<span class="text-orange-600 dark:text-orange-400 font-semibold">💰 ${formatTradePrice(user.customPrice)}</span><span class="text-xs text-orange-400 dark:text-orange-500 ml-1">(precio personal)</span>`;
            } else if (marketPrice != null) {
                priceHTML = `<span class="text-green-600 dark:text-green-400 font-semibold">💳 ${formatTradePrice(marketPrice)}</span><span class="text-xs text-gray-400 dark:text-gray-500 ml-1">(precio estándar)</span>`;
            } else {
                priceHTML = '<span class="text-gray-400 dark:text-gray-500 italic text-xs">Precio no disponible</span>';
            }

            const escStr = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

            return `
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 px-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 mb-2">
                    <div class="flex flex-col gap-0.5 min-w-0">
                        <div class="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-1">
                            <span>👤</span><span class="truncate">${user.userName}</span>
                        </div>
                        <div class="flex items-center gap-1 flex-wrap">${ratingHtml}</div>
                        <div class="flex items-center gap-1 flex-wrap text-sm">${priceHTML}</div>
                        ${user.condition ? `<div class="text-xs text-gray-500 dark:text-gray-400">${user.condition}${user.language ? ' · ' + user.language : ''}</div>` : ''}
                    </div>
                    <button onclick="proposeTradeForCard('${escStr(cardId)}', '${escStr(cardName)}', '${escStr(cardImageUrl)}', '${escStr(cardSet)}', '')"
                            class="shrink-0 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors w-full sm:w-auto text-center">
                        🤝 Proponer intercambio
                    </button>
                </div>
            `;
        }).join('');

        panel.innerHTML = `
            <div class="pb-1">
                <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 px-1">
                    Usuarios con esta carta disponible para intercambio:
                </div>
                ${usersHTML}
            </div>
        `;
        if (buttonEl) buttonEl.innerHTML = `<span>👥</span><span>Ver usuarios (${users.length})</span>`;
    }

    // Consultar Firestore: colección global de cartas transferibles
    (async () => {
        try {
            const transferUsersRef = collection(db, 'transferable_cards', cardId, 'users');
            const snapshot = await getDocs(transferUsersRef);
            const firestoreUsers = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                // Excluir al usuario actual
                if (currentUser && data.userId === currentUser.uid) return;
                firestoreUsers.push({
                    userId: data.userId,
                    userName: data.userName || 'Usuario',
                    customPrice: data.customPrice ?? null,
                    condition: data.condition || null,
                    language: data.language || null,
                    cardImage: data.imageUrl || null
                });
            });

            // Combinar con resultados de localStorage (intercambios creados manualmente)
            const localUsers = getUsersWithCardForTrade(cardName, cardId);
            // Añadir usuarios de localStorage que no estén ya en Firestore
            const seenIds = new Set(firestoreUsers.map(u => u.userId));
            localUsers.forEach(u => {
                if (!seenIds.has(u.userId)) firestoreUsers.push(u);
            });

            renderUsersPanel(firestoreUsers);
        } catch (e) {
            console.error('Error al buscar usuarios en Firestore:', e);
            // Si hay error de permisos (reglas no desplegadas aún), mostrar mensaje específico
            if (e?.code === 'permission-denied') {
                panel.innerHTML = `
                    <div class="py-3 px-3 text-sm text-orange-600 dark:text-orange-400 text-center">
                        ⚠️ No se pudo acceder al directorio de usuarios. Comprueba que las reglas de Firestore estén actualizadas.
                    </div>
                `;
                if (buttonEl) buttonEl.innerHTML = `<span>👥</span><span>Ver usuarios</span>`;
            } else {
                // Para otros errores, intentar localStorage como fallback
                renderUsersPanel(getUsersWithCardForTrade(cardName, cardId));
            }
        }
    })();
};

// Abre el modal de creación de intercambio con la carta buscada ya pre-cargada en la sección "Cartas que Busco"
window.proposeTradeForCard = function(cardId, cardName, cardImageUrl, cardSetName, cardNumber) {
    if (!currentUser) {
        showNotification('Debes iniciar sesión para proponer un intercambio', 'warning', 4000);
        showAuthModal('login');
        return;
    }

    // Abrir modal de creación de intercambio
    showCreateTradeModal();

    // Esperar a que el modal esté listo y pre-cargar la carta buscada
    setTimeout(() => {
        if (typeof window.selectCardForTrade === 'function') {
            window.selectCardForTrade('wanted', 0, cardId, cardName, cardImageUrl, cardSetName, cardNumber || '', false);
        }
    }, 350);
};

// Funciones para mostrar/ocultar loading de página
function showPageLoading() {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'pageLoadingIndicator';
    loadingIndicator.className = 'absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-90 flex items-center justify-center z-10';
    loadingIndicator.innerHTML = `
                <div class="flex flex-col items-center">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Cambiando página...</p>
                </div>
            `;
    cardsContainer.style.position = 'relative';
    cardsContainer.appendChild(loadingIndicator);
}

function hidePageLoading() {
    const loadingIndicator = document.getElementById('pageLoadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
}

function showPageError() {
    const errorIndicator = document.createElement('div');
    errorIndicator.className = 'text-center text-red-500 py-8';
    errorIndicator.innerHTML = '❌ Error al cargar la página. Intenta de nuevo.';
    cardsContainer.appendChild(errorIndicator);
}


