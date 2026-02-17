# 🚂 Pasos para Deploy en Railway

## ✅ Preparación Completada

Ya hemos preparado todo el código para Railway:
- ✅ `server.js` optimizado para Railway
- ✅ `package.json` con dependencias correctas
- ✅ `railway.json` con configuración
- ✅ `.railwayignore` para optimizar deploy
- ✅ Código probado localmente

## 🚀 Pasos para Deploy

### Paso 1: Crear cuenta en Railway
1. Ve a [railway.app](https://railway.app)
2. Haz clic en "Start a New Project"
3. Selecciona "Deploy from GitHub repo"
4. Conecta tu cuenta de GitHub
5. Selecciona el repositorio `TCGtrade`

### Paso 2: Configurar Variables de Entorno
En el dashboard de Railway:

1. Ve a la pestaña "Variables"
2. Añade estas variables:
   ```
   POKEMON_TCG_API_KEY=tu_api_key_aqui
   NODE_ENV=production
   PORT=3000
   ```

### Paso 3: Obtener API Key de Pokémon TCG
1. Ve a [pokemontcg.io](https://pokemontcg.io)
2. Regístrate o inicia sesión
3. Ve a tu dashboard
4. Copia tu API Key

### Paso 4: Deploy Automático
Railway hará deploy automáticamente cuando:
- Conectes el repositorio
- Hagas push a GitHub

## 🔍 Verificar el Deploy

Una vez deployado, prueba estas URLs:

### Test Básico
```
https://tu-app.railway.app/api/test
```
**Respuesta esperada:**
```json
{
  "message": "✅ Railway server funcionando correctamente",
  "timestamp": "2025-08-14T...",
  "platform": "Railway",
  "hasApiKey": true
}
```

### Verificar API Key
```
https://tu-app.railway.app/api/check-api-key
```
**Respuesta esperada:**
```json
{
  "hasApiKey": true,
  "apiKeyLength": 32,
  "apiKeyPreview": "abc12345...",
  "message": "API Key está configurada correctamente en Railway"
}
```

### Test de Búsqueda
```
https://tu-app.railway.app/api/pokemontcg/cards?q=name:pikachu&pageSize=3
```

## 🎯 Ventajas de Railway

✅ **Sin límites de timeout** (vs Netlify 10s)
✅ **Mejor rendimiento para APIs**
✅ **Deploy automático desde GitHub**
✅ **Logs en tiempo real**
✅ **Variables de entorno fáciles**
✅ **Precios muy competitivos**

## 💰 Costos Estimados

- **Plan gratuito**: $5 crédito/mes
- **Nuestro uso estimado**: ~$5-10/mes
- **Muy económico** comparado con otras plataformas

## 🆘 Troubleshooting

### Si el deploy falla:
1. Verifica que el repositorio esté conectado
2. Revisa los logs en Railway
3. Asegúrate de que `server.js` esté en la raíz

### Si la API no funciona:
1. Verifica `POKEMON_TCG_API_KEY` en Variables
2. Prueba `/api/test` primero
3. Revisa los logs para errores específicos

### Si necesitas ayuda:
- Logs en tiempo real en Railway
- Documentación: [docs.railway.app](https://docs.railway.app)

## 🎉 ¡Listo para Deploy!

Tu aplicación está completamente preparada para Railway. Solo necesitas:
1. Conectar el repositorio
2. Configurar la API Key
3. ¡Disfrutar de tu app sin límites de timeout!