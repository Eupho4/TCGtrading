// 🌍 Sistema de Internacionalización - TCGtrade
// Manejo de múltiples idiomas y traducciones

class I18n {
    constructor() {
        this.currentLanguage = 'es'; // Idioma por defecto
        this.translations = window.translations || {};
        this.init();
    }

    // Inicializar el sistema
    init() {
        // Detectar idioma del navegador
        this.detectBrowserLanguage();
        
        // Cargar idioma guardado
        this.loadSavedLanguage();
        
        // Aplicar idioma actual
        this.applyLanguage(this.currentLanguage);
        
    }

    // Detectar idioma del navegador
    detectBrowserLanguage() {
        const browserLang = navigator.language || navigator.userLanguage;
        const langCode = browserLang.split('-')[0];
        
        // Verificar si el idioma del navegador está soportado
        if (this.translations[langCode]) {
            this.currentLanguage = langCode;
        }
    }

    // Cargar idioma guardado en localStorage
    loadSavedLanguage() {
        const savedLang = localStorage.getItem('tcgtrade_language');
        if (savedLang && this.translations[savedLang]) {
            this.currentLanguage = savedLang;
        }
    }

    // Guardar idioma en localStorage
    saveLanguage(langCode) {
        localStorage.setItem('tcgtrade_language', langCode);
    }

    // Obtener traducción
    t(key, params = {}) {
        const translation = this.translations[this.currentLanguage]?.[key] || 
                           this.translations['es']?.[key] || 
                           key;

        // Reemplazar parámetros en la traducción
        return this.replaceParams(translation, params);
    }

    // Reemplazar parámetros en el texto
    replaceParams(text, params) {
        return text.replace(/\{(\w+)\}/g, (match, param) => {
            return params[param] || match;
        });
    }

    // Cambiar idioma
    changeLanguage(langCode) {
        if (!this.translations[langCode]) {
            return false;
        }

        this.currentLanguage = langCode;
        this.saveLanguage(langCode);
        this.applyLanguage(langCode);
        
        return true;
    }

    // Aplicar idioma a toda la página
    applyLanguage(langCode) {
        // Actualizar atributo lang del HTML
        document.documentElement.lang = langCode;
        
        // Traducir elementos con data-i18n
        this.translateElements();
        
        // Actualizar selector de idioma
        this.updateLanguageSelector();
        
        // Disparar evento de cambio de idioma
        window.dispatchEvent(new CustomEvent('languageChanged', { 
            detail: { language: langCode } 
        }));
    }

    // Traducir elementos con data-i18n
    translateElements() {
        const elements = document.querySelectorAll('[data-i18n]');
        
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            if (translation && translation !== key) {
                // Preservar HTML si existe
                if (element.hasAttribute('data-i18n-html')) {
                    element.innerHTML = translation;
                } else {
                    element.textContent = translation;
                }
            }
        });

        // Traducir placeholders
        const inputs = document.querySelectorAll('[data-i18n-placeholder]');
        inputs.forEach(input => {
            const key = input.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            
            if (translation && translation !== key) {
                input.placeholder = translation;
            }
        });

        // Traducir títulos
        const titles = document.querySelectorAll('[data-i18n-title]');
        titles.forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const translation = this.t(key);
            
            if (translation && translation !== key) {
                element.title = translation;
            }
        });
    }

    // Actualizar selector de idioma
    updateLanguageSelector() {
        const selector = document.getElementById('languageSelector');
        if (selector) {
            selector.value = this.currentLanguage;
        }
    }

    // Crear selector de idioma
    createLanguageSelector() {
        const selector = document.createElement('select');
        selector.id = 'languageSelector';
        selector.className = 'bg-white border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400';
        
        // Añadir opciones para cada idioma
        Object.keys(this.translations).forEach(langCode => {
            const option = document.createElement('option');
            option.value = langCode;
            option.textContent = this.t(`languages.${langCode}`);
            option.selected = langCode === this.currentLanguage;
            selector.appendChild(option);
        });

        // Event listener para cambio de idioma
        selector.addEventListener('change', (e) => {
            this.changeLanguage(e.target.value);
        });

        return selector;
    }

    // Obtener idioma actual
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    // Obtener nombre del idioma actual
    getCurrentLanguageName() {
        return this.t(`languages.${this.currentLanguage}`);
    }

    // Verificar si un idioma está soportado
    isLanguageSupported(langCode) {
        return !!this.translations[langCode];
    }

    // Obtener lista de idiomas soportados
    getSupportedLanguages() {
        return Object.keys(this.translations);
    }

    // Formatear fecha según el idioma
    formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };

        const finalOptions = { ...defaultOptions, ...options };
        
        try {
            return new Intl.DateTimeFormat(this.currentLanguage, finalOptions).format(date);
        } catch (error) {
            // Fallback a formato en inglés
            return new Intl.DateTimeFormat('en', finalOptions).format(date);
        }
    }

    // Formatear número según el idioma
    formatNumber(number, options = {}) {
        try {
            return new Intl.NumberFormat(this.currentLanguage, options).format(number);
        } catch (error) {
            // Fallback a formato en inglés
            return new Intl.NumberFormat('en', options).format(number);
        }
    }
}

// Crear instancia global
window.i18n = new I18n();

// Función global para traducción rápida
window.t = (key, params) => window.i18n.t(key, params);

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = I18n;
}