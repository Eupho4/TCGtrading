/**
 * Utilities Module
 * Common utility functions used throughout the application
 */

// DOM element references (will be initialized in init function)
let elements = {};

/**
 * Initialize DOM element references
 */
export function initializeElements() {
    elements = {
        loadingSpinner: document.getElementById('loadingSpinner'),
        heroSection: document.getElementById('heroSection'),
        howItWorksSection: document.getElementById('howItWorks'),
        searchResultsSection: document.getElementById('searchResults'),
        myCardsSection: document.getElementById('myCardsSection'),
        profileSection: document.getElementById('profileSection'),
        interchangesSection: document.getElementById('interchangesSection'),
        helpSection: document.getElementById('helpSection'),
        noMyCardsMessage: document.getElementById('noMyCardsMessage')
    };
    return elements;
}

/**
 * Show loading spinner
 */
export function showLoadingSpinner() {
    if (elements.loadingSpinner) elements.loadingSpinner.style.display = 'block';
}

/**
 * Hide loading spinner
 */
export function hideLoadingSpinner() {
    if (elements.loadingSpinner) elements.loadingSpinner.style.display = 'none';
}

/**
 * Show initial sections (hero and how it works)
 */
export function showInitialSections() {
    hideAllSections();
    if (elements.heroSection) elements.heroSection.classList.remove('hidden');
    if (elements.howItWorksSection) elements.howItWorksSection.classList.remove('hidden');
}

/**
 * Show search results section
 */
export function showSearchResults() {
    hideAllSections();
    if (elements.searchResultsSection) elements.searchResultsSection.classList.remove('hidden');
}

/**
 * Show my cards section
 */
export function showMyCardsSection() {
    hideAllSections();
    if (elements.myCardsSection) elements.myCardsSection.classList.remove('hidden');
}

/**
 * Show help section
 */
export function showHelpSection() {
    hideAllSections();
    if (elements.helpSection) elements.helpSection.classList.remove('hidden');
}

/**
 * Show interchanges section
 */
export function showInterchangesSection() {
    hideAllSections();
    if (elements.interchangesSection) elements.interchangesSection.classList.remove('hidden');
}

/**
 * Show profile section
 */
export function showProfileSection() {
    hideAllSections();
    if (elements.profileSection) elements.profileSection.classList.remove('hidden');
}

/**
 * Hide all main sections
 */
function hideAllSections() {
    Object.values(elements).forEach(element => {
        if (element && element.classList) {
            element.classList.add('hidden');
        }
    });
}

/**
 * Custom notification system
 */
export function showNotification(message, type = 'success', duration = 3000) {
    // Remove any existing notification
    const existingNotification = document.querySelector('.custom-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'custom-notification fixed top-4 right-4 z-[9999] max-w-md animate-slide-in';
    
    // Set styles based on type
    const styles = {
        success: 'bg-green-500 text-white',
        error: 'bg-red-500 text-white',
        warning: 'bg-yellow-500 text-white',
        info: 'bg-blue-500 text-white'
    };
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    notification.innerHTML = `
        <div class="${styles[type] || styles.info} px-6 py-4 rounded-lg shadow-lg flex items-center gap-3">
            <span class="text-2xl">${icons[type] || icons.info}</span>
            <p class="font-medium">${message}</p>
            <button onclick="this.closest('.custom-notification').remove()" 
                    class="ml-auto text-white/80 hover:text-white text-xl leading-none">
                ×
            </button>
        </div>
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slide-in {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        .animate-slide-in {
            animation: slide-in 0.3s ease-out;
        }
    `;
    
    if (!document.querySelector('style[data-notification-styles]')) {
        style.setAttribute('data-notification-styles', 'true');
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (notification && notification.parentNode) {
                notification.style.animation = 'slide-in 0.3s ease-out reverse';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }
}

/**
 * Format date to Spanish locale
 */
export function formatDate(date) {
    if (!date) return 'Fecha desconocida';
    const dateObj = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(dateObj);
}

/**
 * Generate unique ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Get current user from localStorage
 */
export function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
}

/**
 * Set current user to localStorage
 */
export function setCurrentUser(user) {
    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
        localStorage.removeItem('currentUser');
    }
}

/**
 * Apply dark mode based on user preference
 */
export function applyDarkMode() {
    const darkModeEnabled = localStorage.getItem('darkMode') === 'true';
    const darkModeToggle = document.getElementById('darkModeToggle');
    
    if (darkModeEnabled) {
        document.body.classList.add('dark-mode');
        if (darkModeToggle) darkModeToggle.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        if (darkModeToggle) darkModeToggle.checked = false;
    }
}

/**
 * Toggle dark mode
 */
export function toggleDarkMode() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    return isDarkMode;
}