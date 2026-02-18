# 🚀 Configuración Railway Auto-Deploy desde GitHub

## ✅ Estado Actual
- **GitHub**: ✅ Todos los cambios subidos (commit bbf7b78)
- **Repositorio**: https://github.com/Eupho4/TCGtrading.git
- **Base de datos**: 6,199 cartas listas
- **API**: Funcionando con TCGdex + PostgreSQL

## 🌐 Configurar Railway Auto-Deploy

### Paso 1: Conectar Railway a GitHub

1. **Ve a Railway**: https://railway.app
2. **Login** con tu cuenta GitHub
3. **Click en "New Project"**
4. **Selecciona "Deploy from GitHub repo"**
5. **Busca tu repositorio**: `Eupho4/TCGtrading`
6. **Click en "Connect Repo"**

### Paso 2: Configurar Variables de Entorno

En Railway dashboard, ve a **Settings → Variables** y agrega:

```bash
DATABASE_URL=postgresql://usuario:password@host:puerto/database
NODE_ENV=production
POKEMON_TCG_API_KEY=tu_api_key (opcional)
```

### Paso 3: Configurar Deploy Settings

En **Settings → Deploy**:
- **Branch**: `main`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health`

### Paso 4: Trigger Primer Deploy

1. **Click en "Deploy Now"**
2. **Espera a que termine el build**
3. **Revisa los logs** si hay errores

## 🔄 Auto-Deploy Funcionará

Ahora cada vez que hagas:
```bash
git add .
git commit -m "Tu mensaje"
git push origin main
```

**Railway automáticamente:**
1. 🔍 Detectará el push
2. 🏗️ Hará build del proyecto
3. 🚀 Desplegará la nueva versión
4. ✅ Verificará health check

## 📊 Monitoreo

### Health Check
- **URL**: `https://tu-app.railway.app/api/health`
- **Response**: JSON con status, uptime, memory

### Logs
- **Railway Dashboard**: Logs en tiempo real
- **Build Logs**: Ver errores de compilación
- **Runtime Logs**: Ver errores de ejecución

### Métricas
- **Uptime**: Railway monitorea automáticamente
- **Performance**: Tiempo de respuesta
- **Errors**: Notificaciones de errores

## 🛠️ Comandos Útiles

### Local Development
```bash
npm start              # Iniciar local
npm run dev            # Modo desarrollo
```

### Debug en Producción
```bash
# Ver logs de Railway
railway logs

# Ver status
railway status

# Trigger deploy manual
railway up
```

### Mantenimiento
```bash
# Verificar base de datos
node check-migration-status.js

# Arreglar problemas si es necesario
node fix-series-and-images.js
```

## 🎯 Flujo de Trabajo Recomendado

### 1. Desarrollo Local
```bash
# Hacer cambios
# Probar localmente
npm start
```

### 2. Commit y Push
```bash
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main
```

### 3. Auto-Deploy
- ✅ Railway detecta cambios
- ✅ Build automático
- ✅ Deploy automático
- ✅ Health check verification

### 4. Verificación
- 🌐 Visita tu URL
- 🧪 Prueba la funcionalidad
- 📊 Revisa logs si es necesario

## 🚨 Troubleshooting

### Si el deploy falla:
1. **Revisa los build logs** en Railway
2. **Verifica variables de entorno**
3. **Asegúrate que package.json es correcto**
4. **Prueba localmente primero**

### Si la API no responde:
1. **Verifica health check**: `/api/health`
2. **Revisa logs de runtime**
3. **Verifica conexión a base de datos**
4. **Reinicia el servicio**

### Si las imágenes no cargan:
1. **Verifica URLs en la base de datos**
2. **Ejecuta script de arreglos**:
   ```bash
   node fix-series-and-images.js
   ```

## 🎉 ¡Listo!

Tu aplicación TCGtrade está configurada para:
- 🔄 **Auto-deploy** desde GitHub
- 📊 **Monitoreo** automático
- 🏥 **Health checks**
- 🚀 **Producción ready**

**URL de tu aplicación**: https://tu-app.railway.app

**Cada push a GitHub = Nuevo deploy automático** 🚀✨
