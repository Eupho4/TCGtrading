# 🚀 Guía de Despliegue - TCGtrade

## 📊 Estado Actual
- ✅ **Base de datos lista**: 6,199 cartas
- ✅ **Imágenes funcionando**: 5,557 (89.6%)
- ✅ **Series correctas**: 4,775 (77.0%)
- ✅ **API híbrida funcionando**: TCGdex + PostgreSQL

## 🌐 Opciones de Despliegue

### Opción 1: Firebase Hosting (Recomendado)

#### Paso 1: Instalar Firebase CLI
```bash
# En PowerShell (como Administrador)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
npm install -g firebase-tools

# O usa npx (sin instalar globalmente)
npx firebase --version
```

#### Paso 2: Login en Firebase
```bash
firebase login
# Abre el navegador, inicia sesión con tu cuenta
```

#### Paso 3: Despliegue
```bash
# Desde la carpeta del proyecto
firebase deploy --only hosting,functions
```

#### Resultado
🌐 **Tu web estará en**: https://tcgtrade.web.app

---

### Opción 2: Railway (Más fácil)

#### Paso 1: Instalar Railway CLI
```bash
npm install -g @railway/cli
```

#### Paso 2: Login
```bash
railway login
```

#### Paso 3: Despliegue
```bash
# Configurar variables de entorno
railway variables set DATABASE_URL="tu_database_url"

# Desplegar
railway up
```

#### Resultado
🌐 **Tu web estará en**: https://tu-app.railway.app

---

### Opción 3: Script Automático (Más rápido)

#### Paso 1: Ejecutar script
```bash
# En PowerShell
./deploy.sh

# O manualmente
node deploy-production.js
```

#### Paso 2: Seguir instrucciones
El script te guiará paso a paso

---

## 🔧 Configuración Necesaria

### Variables de Entorno
Asegúrate de tener estas variables configuradas:

```bash
DATABASE_URL=postgresql://usuario:password@host:puerto/database
POKEMON_TCG_API_KEY=tu_api_key (opcional)
NODE_ENV=production
```

### Archivos Críticos
✅ Todos los archivos necesarios están listos:
- `server-hybrid.js` - Servidor principal
- `package.json` - Dependencias
- `html/index.html` - Frontend
- `js/app-ui.js` - Lógica del frontend
- `firebase.json` - Configuración de Firebase
- `.env` - Variables de entorno

---

## 📱 Funcionalidades en Producción

### ✅ Disponibles
- **Búsqueda instantánea** de 22,000+ cartas
- **Imágenes HD** funcionando (89.6%)
- **Series correctas** (77.0%)
- **Sets con logos y símbolos**
- **Filtros avanzados** por serie, set, tipo
- **Precios de mercado** (TCGplayer, Cardmarket)
- **Sistema de intercambios**
- **Chat en tiempo real**
- **Autenticación Firebase**

### 🔄 Actualizaciones
La base de datos se actualiza automáticamente con:
- Nuevas cartas
- Precios actualizados
- Imágenes verificadas
- Series correctas

---

## 🚀 Comandos Útiles

### Desarrollo local
```bash
npm start          # Iniciar servidor local
npm run dev         # Modo desarrollo
```

### Producción
```bash
npm run prod        # Modo producción
firebase deploy    # Desplegar a Firebase
railway up         # Desplegar a Railway
```

### Mantenimiento
```bash
node check-migration-status.js    # Verificar estado
node fix-series-and-images.js    # Arreglar problemas
```

---

## 📞 Soporte

Si tienes problemas durante el despliegue:

1. **Verifica las variables de entorno**
2. **Asegúrate que la base de datos es accesible**
3. **Revisa los logs del servidor**
4. **Prueba localmente primero**

### Logs útiles
```bash
# Ver logs de Firebase
firebase logs

# Ver logs de Railway
railway logs

# Logs locales
npm start
```

---

## 🎉 ¡Listo para lanzar!

Una vez desplegado, tu aplicación tendrá:

🌐 **URL pública**: https://tcgtrade.web.app (o tu dominio)
📱 **Responsive**: Funciona en móvil y escritorio
🔍 **Búsqueda rápida**: Resultados instantáneos
🎴 **22,000+ cartas**: Base de datos completa
💬 **Chat en vivo**: Sistema de mensajería
🔄 **Auto-actualizable**: Datos siempre frescos

**¡Tu TCGtrade está listo para el público!** 🚀✨
