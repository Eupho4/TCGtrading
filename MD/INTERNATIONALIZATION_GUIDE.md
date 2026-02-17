# 🌍 Guía de Internacionalización - TCGtrade

## 📋 **Resumen del Sistema**

TCGtrade ahora incluye un sistema completo de internacionalización (i18n) que soporta **10 idiomas** diferentes:

- 🇪🇸 **Español** (idioma base)
- 🇺🇸 **English** (inglés)
- 🇫🇷 **Français** (francés)
- 🇩🇪 **Deutsch** (alemán)
- 🇮🇹 **Italiano** (italiano)
- 🇵🇹 **Português** (portugués)
- 🇯🇵 **日本語** (japonés)
- 🇰🇷 **한국어** (coreano)
- 🇨🇳 **中文** (chino simplificado)
- 🇷🇺 **Русский** (ruso)

## 🚀 **Características Implementadas**

### **1. Detección Automática de Idioma**
- Detecta automáticamente el idioma del navegador del usuario
- Si el idioma del navegador no está soportado, usa español por defecto

### **2. Persistencia de Preferencias**
- Guarda el idioma elegido en `localStorage`
- Recuerda la preferencia del usuario entre sesiones

### **3. Selector Visual de Idioma**
- Selector elegante en el header con banderas y nombres nativos
- Cambio instantáneo de idioma sin recargar la página

### **4. Traducción Completa**
- **Navegación**: Todos los enlaces y botones
- **Contenido**: Títulos, descripciones, mensajes
- **Formularios**: Labels, placeholders, mensajes de error
- **Interfaz**: Botones, alertas, confirmaciones

## 🛠️ **Cómo Usar el Sistema**

### **Para Usuarios:**
1. **Cambiar idioma**: Usa el selector en la esquina superior derecha del header
2. **Idioma automático**: El sistema detecta tu idioma del navegador
3. **Persistencia**: Tu elección se guarda automáticamente

### **Para Desarrolladores:**

#### **1. Añadir Nuevas Traducciones**

Edita `js/translations.js` y añade nuevas claves:

```javascript
// En la sección 'es' (español)
'es': {
    // ... traducciones existentes ...
    'nueva.clave': 'Texto en español',
    'otra.clave': 'Otro texto en español'
},

// En la sección 'en' (inglés)
'en': {
    // ... traducciones existentes ...
    'nueva.clave': 'Text in English',
    'otra.clave': 'Other text in English'
}
```

#### **2. Usar Traducciones en HTML**

```html
<!-- Traducción simple -->
<span data-i18n="nav.explore">Explorar</span>

<!-- Traducción con HTML preservado -->
<div data-i18n="hero.subtitle" data-i18n-html>
    Conecta con coleccionistas de todo el mundo...
</div>

<!-- Traducción de placeholder -->
<input data-i18n-placeholder="header.searchPlaceholder" 
       placeholder="Buscar cartas, sets, usuarios...">

<!-- Traducción de título -->
<button data-i18n-title="nav.language" title="Idioma">
    🌍
</button>
```

#### **3. Usar Traducciones en JavaScript**

```javascript
// Función global de traducción
const texto = t('nav.explore'); // "Explorar" o "Explore"

// Con parámetros
const mensaje = t('search.quickSuccess', { count: 5 }); 
// "Búsqueda rápida: 5 cartas encontradas."

// Obtener idioma actual
const idiomaActual = i18n.getCurrentLanguage(); // "es", "en", etc.

// Cambiar idioma programáticamente
i18n.changeLanguage('en');
```

#### **4. Añadir un Nuevo Idioma**

1. **Añadir traducciones** en `js/translations.js`:
```javascript
'ja': { // Japonés
    'nav.explore': '探索',
    'nav.myCards': 'マイカード',
    // ... todas las traducciones
}
```

2. **Añadir opción** en el selector del header:
```html
<option value="ja">🇯🇵 日本語</option>
```

3. **Añadir nombre del idioma** en las traducciones:
```javascript
'languages.ja': '日本語'
```

## 📁 **Estructura de Archivos**

```
js/
├── translations.js    # Todas las traducciones
└── i18n.js          # Sistema de internacionalización

index.html           # HTML con atributos data-i18n
```

## 🔧 **Funciones Disponibles**

### **Clase I18n**

```javascript
// Cambiar idioma
i18n.changeLanguage('en');

// Obtener idioma actual
i18n.getCurrentLanguage();

// Obtener nombre del idioma
i18n.getCurrentLanguageName();

// Verificar si un idioma está soportado
i18n.isLanguageSupported('fr');

// Obtener lista de idiomas soportados
i18n.getSupportedLanguages();

// Formatear fecha según el idioma
i18n.formatDate(new Date());

// Formatear número según el idioma
i18n.formatNumber(1234.56);
```

### **Función Global t()**

```javascript
// Traducción simple
t('nav.explore')

// Traducción con parámetros
t('search.quickSuccess', { count: 10 })

// Fallback si no existe traducción
t('clave.inexistente') // Devuelve la clave
```

## 🎯 **Convenciones de Nomenclatura**

### **Claves de Traducción**
- **Formato**: `seccion.subseccion.elemento`
- **Ejemplos**:
  - `nav.explore` - Navegación > Explorar
  - `auth.login` - Autenticación > Login
  - `profile.personalInfo` - Perfil > Información Personal

### **Secciones Principales**
- `nav.*` - Navegación
- `header.*` - Header y búsqueda
- `hero.*` - Sección principal
- `auth.*` - Autenticación
- `profile.*` - Perfil de usuario
- `dashboard.*` - Dashboard
- `settings.*` - Configuración
- `search.*` - Búsqueda
- `myCards.*` - Mis Cartas
- `card.*` - Detalles de cartas
- `footer.*` - Pie de página
- `languages.*` - Nombres de idiomas

## 🌐 **Idiomas Soportados**

| Código | Idioma | Nombre Nativo | Estado |
|--------|--------|---------------|--------|
| `es` | Español | Español | ✅ Completo |
| `en` | Inglés | English | ✅ Completo |
| `fr` | Francés | Français | ✅ Completo |
| `de` | Alemán | Deutsch | ✅ Completo |
| `it` | Italiano | Italiano | ⚠️ Parcial |
| `pt` | Portugués | Português | ⚠️ Parcial |
| `ja` | Japonés | 日本語 | ⚠️ Parcial |
| `ko` | Coreano | 한국어 | ⚠️ Parcial |
| `zh` | Chino | 中文 | ⚠️ Parcial |
| `ru` | Ruso | Русский | ⚠️ Parcial |

## 🔄 **Eventos del Sistema**

```javascript
// Escuchar cambios de idioma
window.addEventListener('languageChanged', (event) => {
    console.log('Idioma cambiado a:', event.detail.language);
    // Actualizar contenido dinámico aquí
});
```

## 🚀 **Próximos Pasos**

### **Para Completar la Implementación:**

1. **Añadir más atributos `data-i18n`** a elementos HTML restantes
2. **Completar traducciones** para idiomas parciales
3. **Implementar traducción dinámica** para contenido generado por JavaScript
4. **Añadir validación de idioma** en formularios
5. **Implementar traducción de fechas y números** según el idioma

### **Para Mejorar la Experiencia:**

1. **Animaciones** al cambiar de idioma
2. **Detección de dirección de texto** (RTL para árabe/hebreo)
3. **Traducción automática** de contenido de la API
4. **Preferencias de idioma** por usuario en la base de datos

## 📞 **Soporte**

Si encuentras problemas con el sistema de internacionalización:

1. **Verifica la consola** del navegador para errores
2. **Comprueba que los archivos** `js/translations.js` y `js/i18n.js` se cargan correctamente
3. **Verifica que las claves** de traducción existen en todos los idiomas
4. **Revisa el localStorage** para ver si el idioma se guarda correctamente

---

**¡El sistema de internacionalización está listo para hacer TCGtrade accesible a coleccionistas de todo el mundo!** 🌍✨