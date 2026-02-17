# 🔍 Parche para Arreglar la Búsqueda

## Problema Detectado
La función de búsqueda puede estar fallando por varios motivos. Aquí tienes el código exacto para reemplazar.

## Solución: Reemplazar la función fetchCards

**Archivo**: `index.html`
**Líneas**: ~146-217

### Código Actual a Reemplazar:
Busca esta función en tu `index.html` y reemplázala completamente:

```javascript
async function fetchCards(query) {
    if (!cardsContainer) return;

    cardsContainer.innerHTML = '';
    if (noResultsMessage) noResultsMessage.classList.add('hidden');
    if (errorMessage) errorMessage.classList.add('hidden');

    if (query.length < 3) {
        showInitialSections();
        return;
    }

    showLoadingSpinner();
    showSearchResults();

    try {
        // URL simplificada para test
        const apiUrl = `/api/pokemontcg/cards?q=name:*${encodeURIComponent(query)}*&pageSize=20`;

        console.log('Buscando con URL:', apiUrl);

        const response = await fetch(apiUrl);
        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const cards = data.data || [];

        console.log(`Encontradas ${cards.length} cartas`);

        if (cards.length > 0) {
            cards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.className = 'card-bg rounded-xl shadow-lg overflow-hidden transform transition-transform hover:scale-105';
                cardElement.innerHTML = `
                    <img src="${card.images?.small || 'https://placehold.co/400x550/a0aec0/ffffff?text=Sin+imagen'}"
                         alt="${card.name}"
                         class="w-full h-auto object-cover rounded-t-xl">
                    <div class="p-4">
                        <h3 class="text-xl font-semibold mb-2 text-gray-900">${card.name}</h3>
                        <p class="text-gray-600 text-sm mb-3">Set: ${card.set?.name || 'N/A'}</p>
                        <p class="text-gray-600 text-sm mb-3">Serie: ${card.set?.series || 'N/A'}</p>
                        <div class="flex justify-between items-center">
                            <button class="btn-primary px-4 py-2 rounded-lg text-sm font-semibold"
                                    onclick="showCardDetails('${card.id}', '${card.name}', '${card.images?.small || ''}', '${card.set?.name || 'N/A'}', '${card.set?.series || 'N/A'}', '${card.number || 'N/A'}')">
                                Ver Detalles
                            </button>
                        </div>
                    </div>
                `;
                cardsContainer.appendChild(cardElement);
            });
        } else {
            if (noResultsMessage) noResultsMessage.classList.remove('hidden');
        }

    } catch (error) {
        console.error('Error completo:', error);

        if (errorMessage) {
            errorMessage.textContent = `Error: ${error.message}`;
            errorMessage.classList.remove('hidden');
        }
    } finally {
        hideLoadingSpinner();
    }
}
```

### Por Este Código Mejorado:

```javascript
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

    // Si la query es muy corta, mostrar página inicial
    if (query.length < 3) {
        showInitialSections();
        return;
    }

    showLoadingSpinner();
    showSearchResults();

    try {
        // Construir URL con mejor encoding
        const encodedQuery = encodeURIComponent(query.toLowerCase());
        const apiUrl = `/api/pokemontcg/cards?q=name:*${encodedQuery}*&pageSize=20`;

        console.log('🌐 Fetching from URL:', apiUrl);

        // Hacer petición con timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout

        const response = await fetch(apiUrl, {
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        clearTimeout(timeoutId);

        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response:', errorText);
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const cards = data.data || [];

        console.log('✅ API Response received:', {
            totalCount: data.totalCount,
            cardsReturned: cards.length,
            page: data.page,
            pageSize: data.pageSize
        });

        if (cards.length > 0) {
            cards.forEach((card, index) => {
                console.log(`📋 Processing card ${index + 1}:`, card.name);
                
                const cardElement = document.createElement('div');
                cardElement.className = 'card-bg rounded-xl shadow-lg overflow-hidden transform transition-transform hover:scale-105';
                
                // Escapar comillas en los datos para evitar errores de JavaScript
                const safeCardId = (card.id || '').replace(/'/g, "\\'");
                const safeCardName = (card.name || '').replace(/'/g, "\\'");
                const safeSetName = (card.set?.name || 'N/A').replace(/'/g, "\\'");
                const safeSeries = (card.set?.series || 'N/A').replace(/'/g, "\\'");
                const safeNumber = (card.number || 'N/A').replace(/'/g, "\\'");
                const safeImageUrl = (card.images?.small || '').replace(/'/g, "\\'");
                
                cardElement.innerHTML = `
                    <img src="${card.images?.small || 'https://placehold.co/400x550/a0aec0/ffffff?text=Sin+imagen'}"
                         alt="${card.name || 'Carta sin nombre'}"
                         class="w-full h-auto object-cover rounded-t-xl"
                         onerror="this.src='https://placehold.co/400x550/a0aec0/ffffff?text=Error+imagen'">
                    <div class="p-4">
                        <h3 class="text-xl font-semibold mb-2 text-gray-900">${card.name || 'Nombre no disponible'}</h3>
                        <p class="text-gray-600 text-sm mb-3">Set: ${card.set?.name || 'N/A'}</p>
                        <p class="text-gray-600 text-sm mb-3">Serie: ${card.set?.series || 'N/A'}</p>
                        <p class="text-gray-600 text-sm mb-3">Número: ${card.number || 'N/A'}</p>
                        <div class="flex justify-between items-center">
                            <button class="btn-primary px-4 py-2 rounded-lg text-sm font-semibold"
                                    onclick="showCardDetails('${safeCardId}', '${safeCardName}', '${safeImageUrl}', '${safeSetName}', '${safeSeries}', '${safeNumber}')">
                                Ver Detalles
                            </button>
                        </div>
                    </div>
                `;
                cardsContainer.appendChild(cardElement);
            });
            
            console.log('✅ All cards rendered successfully');
        } else {
            console.log('ℹ️ No cards found for query:', query);
            if (noResultsMessage) {
                noResultsMessage.textContent = `No se encontraron cartas para "${query}". Intenta con otro nombre.`;
                noResultsMessage.classList.remove('hidden');
            }
        }

    } catch (error) {
        console.error('❌ Error completo en fetchCards:', error);

        let errorMsg = 'Error al buscar cartas. ';
        
        if (error.name === 'AbortError') {
            errorMsg += 'La búsqueda tardó demasiado tiempo.';
        } else if (error.message.includes('Failed to fetch')) {
            errorMsg += 'Problema de conexión. Verifica tu internet.';
        } else if (error.message.includes('404')) {
            errorMsg += 'Servicio no disponible temporalmente.';
        } else {
            errorMsg += error.message;
        }

        if (errorMessage) {
            errorMessage.textContent = errorMsg;
            errorMessage.classList.remove('hidden');
        }
    } finally {
        hideLoadingSpinner();
    }
}
```

## Pasos para Aplicar:

1. **Abre** tu archivo `index.html`
2. **Busca** la función `async function fetchCards(query) {`
3. **Selecciona** toda la función (desde `async function fetchCards` hasta el `}` que la cierra)
4. **Reemplaza** con el código mejorado de arriba
5. **Guarda** el archivo
6. **Commit y push** los cambios

## Mejoras Incluidas:

- ✅ **Mejor logging** para debug
- ✅ **Timeout de 15 segundos** para evitar cuelgues
- ✅ **Escape de comillas** para evitar errores JS
- ✅ **Manejo de errores específicos** (conexión, 404, etc.)
- ✅ **Validación de datos** antes de renderizar
- ✅ **Mensajes de error más claros**
- ✅ **Fallbacks para imágenes rotas**

## Test:

Después de aplicar el parche:
1. Ve a tu web
2. Busca "pikachu" 
3. Abre la consola del navegador (F12)
4. Verás logs detallados de lo que está pasando

¡Esto debería solucionar el problema de búsqueda sin romper nada más!