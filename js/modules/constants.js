/**
 * Constants Module
 * Application-wide constants and configurations
 */

// Card conditions mapping (CardMarket standard)
export const CARD_CONDITIONS = {
    'M': { label: 'Mint', color: 'bg-green-600', icon: '💎' },
    'NM': { label: 'Near Mint', color: 'bg-green-500', icon: '✨' },
    'EX': { label: 'Excellent', color: 'bg-blue-500', icon: '⭐' },
    'GD': { label: 'Good', color: 'bg-yellow-500', icon: '👍' },
    'LP': { label: 'Light Played', color: 'bg-orange-500', icon: '✓' },
    'PL': { label: 'Played', color: 'bg-red-500', icon: '👌' },
    'PO': { label: 'Poor', color: 'bg-gray-500', icon: '⚠️' }
};

// Language options for cards
export const LANGUAGES = {
    'Español': '🇪🇸',
    'Inglés': '🇬🇧',
    'Francés': '🇫🇷',
    'Alemán': '🇩🇪',
    'Italiano': '🇮🇹',
    'Portugués': '🇵🇹',
    'Japonés': '🇯🇵',
    'Chino': '🇨🇳',
    'Coreano': '🇰🇷'
};

// API endpoints
export const API_ENDPOINTS = {
    POKEMON_TCG: 'https://tcgtrade-production.up.railway.app/api/pokemontcg',
    PROXY_CARDS: 'https://tcgtrade-production.up.railway.app/api/pokemontcg/cards',
    PROXY_SETS: 'https://tcgtrade-production.up.railway.app/api/pokemontcg/sets'
};

// Storage keys
export const STORAGE_KEYS = {
    CURRENT_USER: 'currentUser',
    DARK_MODE: 'darkMode',
    USER_TRADES_PREFIX: 'userTrades_',
    USER_CARDS_CACHE: 'userCardsCache'
};

// View modes for card display
export const VIEW_MODES = {
    GRID: 'grid',
    LIST: 'list'
};

// Trade status (extended with payment/escrow lifecycle states)
export const TRADE_STATUS = {
    ACTIVE: 'active',
    PENDING: 'pending',
    IN_ESCROW: 'in_escrow',     // Funds held - awaiting shipment
    IN_TRANSIT: 'in_transit',   // Tracking number provided
    COMPLETED: 'completed',     // Buyer confirmed receipt / auto-released
    DISPUTED: 'disputed',       // Buyer opened a dispute
    CANCELLED: 'cancelled'
};

// Payment types
export const PAYMENT_TYPES = {
    TRADE_PROTECTION: 'trade_protection', // Fixed 3.99 € fee
    DIRECT_SALE: 'direct_sale'            // 7 % commission on sale value
};

// Commission configuration
export const COMMISSION = {
    TRADE_PROTECTION_EUR: 3.99,  // Fixed protection fee in EUR
    DIRECT_SALE_PERCENT: 0.07,   // 7 % of gross sale amount
    STRIPE_PERCENT: 0.014,       // Stripe Connect: ~1.4% + 0.25 € (EU cards)
    STRIPE_FIXED_EUR: 0.25       // Stripe fixed component
};

// Default pagination
export const PAGINATION = {
    CARDS_PER_PAGE: 20,
    MAX_PAGES: 10
};

// Timeouts
export const TIMEOUTS = {
    SEARCH_DEBOUNCE: 300,
    API_REQUEST: 60000, // 60 seconds
    API_RETRY: 30000,   // 30 seconds
    NOTIFICATION: 3000  // 3 seconds
};

// Error messages
export const ERROR_MESSAGES = {
    NETWORK_ERROR: 'Error de conexión. Por favor, verifica tu internet.',
    API_ERROR: 'Error al obtener datos. Intenta de nuevo más tarde.',
    AUTH_REQUIRED: 'Debes iniciar sesión para realizar esta acción.',
    INVALID_CREDENTIALS: 'Credenciales inválidas. Verifica tu email y contraseña.',
    USER_EXISTS: 'Este email ya está registrado.',
    WEAK_PASSWORD: 'La contraseña debe tener al menos 6 caracteres.',
    GENERIC_ERROR: 'Ha ocurrido un error. Por favor, intenta de nuevo.'
};

// Success messages
export const SUCCESS_MESSAGES = {
    LOGIN: '¡Bienvenido de nuevo!',
    REGISTER: '¡Cuenta creada exitosamente!',
    LOGOUT: 'Sesión cerrada correctamente.',
    CARD_ADDED: 'Carta añadida a tu colección.',
    CARD_REMOVED: 'Carta eliminada de tu colección.',
    TRADE_CREATED: 'Intercambio creado exitosamente.',
    TRADE_UPDATED: 'Intercambio actualizado.',
    TRADE_DELETED: 'Intercambio eliminado.',
    PROFILE_UPDATED: 'Perfil actualizado correctamente.',
    PASSWORD_RESET: 'Email de recuperación enviado. Revisa tu bandeja de entrada.'
};