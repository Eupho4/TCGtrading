// Vercel Function - Pokemon TCG API Proxy
// Optimizado para mejor rendimiento en Vercel

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Solo se permiten peticiones GET' 
    });
  }

  try {
    console.log('🚀 Vercel Function - Pokemon Proxy iniciada');
    console.log('📋 URL completa:', req.url);
    console.log('📋 Query params:', req.query);

    // Extraer endpoint de la URL o query params
    let endpoint = req.query.endpoint || req.url.replace('/api/pokemon-proxy', '').replace(/^\//, '');
    
    // Si viene del query param, necesitamos reconstruir la query string
    if (req.query.endpoint) {
      const queryParams = new URLSearchParams();
      Object.keys(req.query).forEach(key => {
        if (key !== 'endpoint') {
          queryParams.append(key, req.query[key]);
        }
      });
      if (queryParams.toString()) {
        endpoint += '?' + queryParams.toString();
      }
    }
    
    if (!endpoint) {
      return res.status(400).json({
        error: 'Missing endpoint',
        message: 'Debes especificar un endpoint de la API',
        example: '/api/pokemon-proxy?endpoint=cards&q=name:pikachu'
      });
    }

    // Construir URL de la API con optimizaciones
    const baseUrl = 'https://api.pokemontcg.io/v2';
    let apiUrl = `${baseUrl}/${endpoint}`;
    
    // Optimizar consultas para ser más rápidas
    if (endpoint.includes('cards?q=')) {
      // Si no tiene pageSize, añadir uno pequeño por defecto
      if (!endpoint.includes('pageSize=')) {
        apiUrl += (endpoint.includes('?') ? '&' : '?') + 'pageSize=20';
      }
      // Si tiene pageSize muy grande, reducirlo
      apiUrl = apiUrl.replace(/pageSize=(\d+)/, (match, size) => {
        const pageSize = parseInt(size);
        return pageSize > 50 ? 'pageSize=30' : match;
      });
    }
    
    console.log('🌐 Fetching from Pokemon API (optimized):', apiUrl);

    // Configurar headers (incluyendo API Key si está disponible)
    const apiHeaders = {
      'User-Agent': 'TCGtrade-App/1.0',
      'Accept': 'application/json'
    };

    // Añadir API Key si está disponible
    if (process.env.POKEMON_TCG_API_KEY) {
      apiHeaders['X-Api-Key'] = process.env.POKEMON_TCG_API_KEY;
      console.log('🔑 API Key configurada correctamente');
    } else {
      console.log('⚠️ API Key no encontrada, usando acceso público limitado');
    }

    // Hacer petición a la API con timeout agresivo para Vercel
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('⏰ Timeout alcanzado (7s), abortando petición');
      controller.abort();
    }, 7000); // 7 segundos - más agresivo para evitar timeout de Vercel

    console.log('📡 Iniciando fetch a Pokemon API...');
    const startTime = Date.now();

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: apiHeaders,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    const fetchTime = Date.now() - startTime;
    console.log(`⚡ Fetch completado en ${fetchTime}ms`);
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

    // Leer respuesta como texto primero
    const responseText = await response.text();
    console.log(`📄 Response length: ${responseText.length} characters`);
    
    // Verificar si la respuesta está vacía
    if (!responseText || responseText.trim() === '') {
      console.error('❌ Respuesta vacía de la API');
      return res.status(502).json({
        error: 'Empty response',
        message: 'La API de Pokemon TCG devolvió una respuesta vacía',
        url: apiUrl,
        fetchTime: `${fetchTime}ms`,
        timestamp: new Date().toISOString()
      });
    }

    // Intentar parsear JSON
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('✅ JSON parseado correctamente');
    } catch (parseError) {
      console.error('❌ Error al parsear JSON:', parseError.message);
      console.error('📄 Response text preview:', responseText.substring(0, 200));
      
      return res.status(502).json({
        error: 'JSON parse error',
        message: 'Error al procesar la respuesta de la API',
        details: parseError.message,
        responsePreview: responseText.substring(0, 200),
        url: apiUrl,
        fetchTime: `${fetchTime}ms`,
        timestamp: new Date().toISOString()
      });
    }

    // Verificar status de la respuesta
    if (!response.ok) {
      console.error(`❌ API Error ${response.status}:`, data);
      return res.status(response.status).json({
        error: 'API Error',
        message: data.message || `Error ${response.status} de la API de Pokemon TCG`,
        details: data,
        url: apiUrl,
        fetchTime: `${fetchTime}ms`,
        timestamp: new Date().toISOString()
      });
    }

    // Éxito - devolver datos
    console.log(`✅ Proxy exitoso: ${data.data?.length || 'N/A'} items devueltos`);
    
    // Añadir metadata útil
    const responseData = {
      ...data,
      _metadata: {
        fetchTime: `${fetchTime}ms`,
        timestamp: new Date().toISOString(),
        hasApiKey: !!process.env.POKEMON_TCG_API_KEY,
        endpoint: endpoint
      }
    };

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ Error completo en proxy:', error);
    
    let errorMessage = 'Error interno del servidor';
    let errorType = 'ServerError';
    
    if (error.name === 'AbortError') {
      errorMessage = 'La petición a la API tardó demasiado tiempo';
      errorType = 'TimeoutError';
    } else if (error.message.includes('fetch')) {
      errorMessage = 'Error de conexión con la API de Pokemon TCG';
      errorType = 'ConnectionError';
    }

    return res.status(500).json({
      error: 'Proxy error',
      type: errorType,
      message: errorMessage,
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
}