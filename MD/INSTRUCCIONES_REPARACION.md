# 🔧 Instrucciones para Reparar la Funcionalidad de TCGtrade

## Problemas Encontrados y Soluciones

### 1. 📁 Renombrar archivo de configuración de Netlify

**Problema**: El archivo se llama `netlify.toml.txt` y Netlify no lo reconoce.

**Solución**: Renombrar el archivo:
```bash
mv netlify.toml.txt netlify.toml
```

### 2. 🔑 Configurar API Key de Pokémon TCG

**Crear archivo `.env`** en la raíz del proyecto:
```env
# Variables de entorno para TCGtrade
POKEMON_TCG_API_KEY=tu_api_key_aqui

# Firebase (ya configurado en el HTML)
FIREBASE_API_KEY=AIzaSyCkgz6_Zpu0VOW6GgJxOxd9QlVccsBXnog
FIREBASE_AUTH_DOMAIN=tcgtrade-7ba27.firebaseapp.com
FIREBASE_PROJECT_ID=tcgtrade-7ba27
FIREBASE_STORAGE_BUCKET=tcgtrade-7ba27.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=207150886257
FIREBASE_APP_ID=1:207150886257:web:26edebbeb7df7a1d935ad0
```

### 3. 🔧 Actualizar función pokemon-proxy.js

**Archivo**: `netlify/functions/pokemon-proxy.js`

**Cambios necesarios**:

1. **Añadir headers para la API** (línea 43, después de `console.log('URL final:', apiUrl);`):
```javascript
// Headers para la API de Pokémon TCG
const apiHeaders = {
  'Content-Type': 'application/json'
};

// Agregar API Key si está disponible en las variables de entorno
if (process.env.POKEMON_TCG_API_KEY) {
  apiHeaders['X-Api-Key'] = process.env.POKEMON_TCG_API_KEY;
  console.log('API Key configurada');
} else {
  console.log('API Key no encontrada, usando acceso público limitado');
}
```

2. **Actualizar la llamada fetch** (línea 44):
```javascript
// Cambiar esta línea:
const response = await fetch(apiUrl);

// Por esta:
const response = await fetch(apiUrl, {
  method: 'GET',
  headers: apiHeaders
});
```

3. **Mejorar manejo de errores** (líneas 50-58):
```javascript
// Cambiar el return del error:
return {
  statusCode: response.status,
  headers,
  body: JSON.stringify({
    error: 'API Error',
    status: response.status,
    message: errorText,
    url: apiUrl  // ← Añadir esta línea
  })
};
```

4. **Mejorar logs de éxito** (línea 61):
```javascript
// Cambiar:
console.log('Datos recibidos exitosamente');

// Por:
console.log('Datos recibidos exitosamente:', data.data ? data.data.length : 0, 'items');
```

### 4. 🖱️ Arreglar botón principal en index.html

**Archivo**: `index.html`

**Cambio 1**: Añadir ID al botón (línea ~975):
```html
<!-- Cambiar: -->
<button class="btn-primary text-xl px-8 py-4 rounded-full font-semibold">
    ¡Empieza a Intercambiar Ahora!
</button>

<!-- Por: -->
<button id="startTradingBtn" class="btn-primary text-xl px-8 py-4 rounded-full font-semibold">
    ¡Empieza a Intercambiar Ahora!
</button>
```

**Cambio 2**: Añadir event listener (línea ~560, después de `if (homeLink) homeLink.addEventListener...`):
```javascript
const startTradingBtn = document.getElementById('startTradingBtn');
if (startTradingBtn) startTradingBtn.addEventListener('click', (e) => { e.preventDefault(); showAuthModal('register'); });
```

### 5. 📋 Mejorar botones "Ver Detalles"

**Archivo**: `index.html`

**Cambio 1**: Actualizar botón en fetchCards (línea ~194-196):
```javascript
// Cambiar:
<button class="btn-primary px-4 py-2 rounded-lg text-sm font-semibold"
        onclick="alert('Carta: ${card.name}')">
    Ver Detalles
</button>

// Por:
<button class="btn-primary px-4 py-2 rounded-lg text-sm font-semibold"
        onclick="showCardDetails('${card.id}', '${card.name}', '${card.images?.small || ''}', '${card.set?.name || 'N/A'}', '${card.set?.series || 'N/A'}', '${card.number || 'N/A'}')">
    Ver Detalles
</button>
```

**Cambio 2**: Añadir funciones al final del JavaScript (línea ~723, antes de las funciones globales):
```javascript
// Función para mostrar detalles de carta
window.showCardDetails = (cardId, cardName, imageUrl, setName, series, number) => {
    if (!currentUser) {
        alert('Inicia sesión para añadir cartas a tu colección');
        showAuthModal('login');
        return;
    }

    const confirmed = confirm(`¿Quieres añadir "${cardName}" a tu colección?\n\nSet: ${setName}\nSerie: ${series}\nNúmero: ${number}`);
    
    if (confirmed) {
        addCardToCollection(cardId, cardName, imageUrl, setName, series, number);
    }
};

// Función para añadir carta a la colección
async function addCardToCollection(cardId, cardName, imageUrl, setName, series, number) {
    if (!currentUser) return;

    try {
        // Pedir idioma al usuario
        const language = prompt('¿En qué idioma es esta carta?', 'Español') || 'Español';

        const cardData = {
            id: cardId,
            name: cardName,
            imageUrl: imageUrl,
            set: setName,
            series: series,
            number: number,
            language: language,
            setId: cardId.split('-')[0], // Extraer setId del cardId
            addedAt: new Date()
        };

        await setDoc(doc(db, `artifacts/${appId}/users/${currentUser.uid}/my_cards/${cardId}`), cardData);
        alert(`¡Carta "${cardName}" añadida a tu colección!`);
    } catch (error) {
        console.error('Error al añadir carta:', error);
        alert('Error al añadir la carta. Inténtalo de nuevo.');
    }
}
```

### 6. 🌐 Configurar API Key en Netlify

1. Ve a tu dashboard de Netlify
2. Selecciona tu sitio (shimmering-druid-c28918)
3. Ve a **Site settings** → **Environment variables**
4. Añade:
   - **Key**: `POKEMON_TCG_API_KEY`
   - **Value**: Tu API key de pokemontcg.io

### 7. 🔑 Obtener API Key de Pokémon TCG

1. Ve a [https://pokemontcg.io/](https://pokemontcg.io/)
2. Crea una cuenta gratuita
3. Ve a tu dashboard
4. Copia tu API Key
5. Pégala en el archivo `.env` y en Netlify

## ✅ Verificación

Después de hacer todos los cambios:

1. **Commit y push** los cambios:
```bash
git add -A
git commit -m "Fix API connection and restore functionality"
git push
```

2. **Espera** que Netlify redeploy (2-3 minutos)

3. **Prueba**:
   - Buscar cartas (ej: "pikachu")
   - Hacer clic en botones
   - Registrarse/iniciar sesión
   - Añadir cartas a la colección

## 🐛 Solución de Problemas

- **"Failed to fetch"**: Verifica la API Key en Netlify
- **"Rate limit exceeded"**: Necesitas configurar la API Key
- **Botones no funcionan**: Verifica que los event listeners estén añadidos
- **Function not found**: Asegúrate que `netlify.toml` esté en la raíz

## 📊 Límites de la API

- **Sin API Key**: 1,000 requests/día
- **Con API Key**: 20,000 requests/día (gratuita)