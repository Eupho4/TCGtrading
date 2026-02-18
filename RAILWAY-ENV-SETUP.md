# 🔧 Configurar Variables de Entorno en Railway

## ❌ Error Actual
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

## ✅ Solución: Configurar DATABASE_URL

### Paso 1: Obtener tu DATABASE_URL

Tu base de datos PostgreSQL está en la nube (no localhost). Necesitas la URL completa:

**Formato:**
```
postgresql://username:password@host:port/database
```

### Paso 2: Configurar en Railway

1. **Ve a tu proyecto Railway**
2. **Click en "Settings"**
3. **Click en "Variables"**
4. **Agrega estas variables:**

#### Variable 1: DATABASE_URL
```
DATABASE_URL=postgresql://tu_usuario:tu_password@tu_host:5432/tu_database
```

#### Variable 2: NODE_ENV
```
NODE_ENV=production
```

### Paso 3: ¿Dónde obtengo mi DATABASE_URL?

#### Opción A: Si usas Railway PostgreSQL
1. En Railway dashboard → tu proyecto
2. Click en tu servicio PostgreSQL
3. Ve a "Connect" → "Connection String"
4. Copia la URL completa

#### Opción B: Si usas otro proveedor (Supabase, ElephantSQL, etc.)
1. Ve al dashboard de tu proveedor
2. Busca "Connection String" o "Database URL"
3. Copia la URL completa

#### Opción C: Si no tienes base de datos en la nube
1. **Crea una base de datos PostgreSQL gratuita:**
   - **Supabase**: https://supabase.com (gratis y fácil)
   - **ElephantSQL**: https://www.elephantsql.com (gratis hasta 5GB)
   - **Railway PostgreSQL**: Agrega servicio PostgreSQL en Railway

### Paso 4: Probar la conexión

Una vez configuradas las variables:

1. **Railway hará redeploy automáticamente**
2. **Verifica el health check:** `https://tu-app.railway.app/api/health`
3. **Prueba la búsqueda:** `https://tu-app.railway.app/api/pokemontcg/cards?q=charizard`

### Paso 5: Si aún no funciona

#### Debug adicional:
1. **Revisa los logs en Railway dashboard**
2. **Verifica que la URL sea correcta**
3. **Asegúrate que la base de datos sea accesible**

#### Ejemplo de URL correcta:
```
DATABASE_URL=postgresql://postgres:abc123@db.railway.app:5432/railway
```

### 🚀 Recomendación: Usar Railway PostgreSQL

**La opción más fácil:**

1. **En tu proyecto Railway**
2. **"New Service" → "Add PostgreSQL"**
3. **Espera a que se cree**
4. **Copia la connection string**
5. **Pégala en Variables → DATABASE_URL**

**Ventajas:**
- ✅ Misma red que tu aplicación
- ✅ Configuración automática
- ✅ Gratis para empezar
- ✅ Escalable

### 📱 Checklist Final

- [ ] Base de datos PostgreSQL creada
- [ ] DATABASE_URL configurada en Railway
- [ ] NODE_ENV=production configurado
- [ ] Railway redeploy completado
- [ ] Health check funcionando
- [ ] Búsqueda de cartas funcionando

### 🎯 Una vez configurado

Tu aplicación estará en:
**https://tu-app.railway.app**

Con:
- 🎴 **6,199 cartas** funcionando
- 🔍 **Búsqueda instantánea**
- 🖼️ **Imágenes HD**
- 📚 **Series correctas**

**¡Solo falta configurar esa variable de entorno!** 🚀✨
