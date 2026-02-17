# TCGtrade - Intercambio de Cartas Pokémon TCG

Una aplicación web para intercambio de cartas Pokémon TCG conectada a la API oficial de Pokémon TCG.

## 🚀 Configuración

### 1. API Key de Pokémon TCG

Para que la aplicación funcione correctamente, necesitas obtener una API Key gratuita:

1. Ve a [https://pokemontcg.io/](https://pokemontcg.io/)
2. Crea una cuenta gratuita
3. Ve a tu dashboard y copia tu API Key
4. Añade tu API Key al archivo `.env`:

```env
POKEMON_TCG_API_KEY=tu_api_key_aqui
```

### 2. Variables de Entorno en Netlify

Si despliegas en Netlify, configura las siguientes variables de entorno:

1. Ve a tu dashboard de Netlify
2. Selecciona tu sitio
3. Ve a Site settings > Environment variables
4. Añade:
   - `POKEMON_TCG_API_KEY`: Tu API Key de Pokémon TCG

### 3. Firebase (Ya configurado)

La configuración de Firebase ya está incluida en el código para:
- Autenticación de usuarios
- Base de datos Firestore para colecciones

## 📁 Estructura del Proyecto

```
/
├── index.html              # Página principal
├── netlify.toml            # Configuración de Netlify
├── package.json            # Configuración del proyecto
├── .env                    # Variables de entorno (local)
├── .env.example           # Ejemplo de variables de entorno
└── netlify/
    └── functions/
        └── pokemon-proxy.js # Función proxy para la API
```

## 🔧 Funciones

### Proxy Pokémon TCG (`/api/pokemontcg/*`)

- **Endpoint**: `/api/pokemontcg/*`
- **Métodos**: GET
- **CORS**: Configurado
- **API Key**: Se añade automáticamente si está configurada

Endpoints:
- `/api/pokemontcg/cards` - Buscar cartas
- `/api/pokemontcg/sets` - Obtener expansiones
- `/api/pokemontcg/types` - Tipos de cartas
- `/api/pokemontcg/supertypes` - Supertipos
- `/api/pokemontcg/subtypes` - Subtipos


## 🐛 Solución de Problemas

### Error: "Failed to fetch"
- Verifica que tengas configurada la API Key
- Revisa los logs de la función en Netlify
- Asegúrate de que `netlify.toml` esté en la raíz

### Error: "Rate limit exceeded"
- Esto ocurre sin API Key (límite de 1000 requests/día)
- Configura tu API Key para obtener 20,000 requests/día

### Error: "Function not found"
- Verifica que el archivo `netlify.toml` esté correctamente nombrado
- Asegúrate de que la función esté en `netlify/functions/`

## 📊 Límites de la API

- **Sin API Key**: 1,000 requests/día
- **Con API Key gratuita**: 20,000 requests/día
- **Rate limit**: 1,000 requests/hora

## 🔗 Enlaces útiles

- [Documentación API Pokémon TCG](https://docs.pokemontcg.io/)
- [Firebase Console](https://console.firebase.google.com/)
- [Netlify Dashboard](https://app.netlify.com/)

## 📝 Notas

- La aplicación funciona sin API Key pero con límites estrictos
- Firebase ya está configurado y funcionando
- La función proxy maneja automáticamente CORS y errores