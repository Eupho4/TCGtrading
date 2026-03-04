# 🚀 GUÍA COMPLETA: Trabajo → Nube → PC Casa

## 📋 RESUMEN DEL PROCESO

### 🏢 **Paso 1: Desde PC del Trabajo**
1. Esperar a que termine la migración + backup
2. Subir archivos a Google Drive/Dropbox
3. Subir carpeta completa del proyecto

### ☁️ **Paso 2: En la Nube (Google Drive/Dropbox)**
- Archivos de backup SQL
- Instrucciones de restauración
- Carpeta completa del proyecto TCGtrading

### 🏠 **Paso 3: En PC de Casa**
1. Descargar todo desde la nube
2. Instalar PostgreSQL
3. Restaurar base de datos
4. Configurar y ejecutar

---

## 📁 **ARCHIVOS QUE TENDRÁS CUANDO TERMINE**

### 🗄️ **Archivos de Base de Datos**
- `tcg_complete_backup_[FECHA].sql` - Backup completo PostgreSQL
- `tcg_complete_backup_[FECHA]_INSTRUCTIONS.txt` - Guía de restauración

### 📂 **Carpeta del Proyecto**
- `TCGtrading/` - Carpeta completa con todo el código
- `html/` - Interfaz web
- `js/` - JavaScript frontend
- `server-hybrid.js` - Backend
- `.env` - Configuración base de datos

---

## 🏢 **PASO 1: DESDE PC DEL TRABAJO**

### ⏳ **1.1 Esperar a que termine**
- El proceso actual está migrando 22,755 cartas
- Creará backup automático
- Te avisaré cuando esté listo

### 📤 **1.2 Subir a la Nube**
Cuando termine, sube estos archivos a Google Drive/Dropbox:

```
📁 Archivos para subir:
├── tcg_complete_backup_[FECHA].sql
├── tcg_complete_backup_[FECHA]_INSTRUCTIONS.txt
└── TCGtrading/ (carpeta completa)
    ├── html/
    ├── js/
    ├── server-hybrid.js
    ├── .env
    └── (todos los demás archivos)
```

### 💾 **1.3 Verificar subida**
- Asegúrate que todos los archivos estén en la nube
- Verifica que la carpeta TCGtrading esté completa
- Confirma que los archivos SQL no estén corruptos

---

## 🏠 **PASO 2: EN PC DE CASA**

### 🛠️ **2.1 Instalar PostgreSQL**
```bash
# Descargar e instalar PostgreSQL desde:
# https://www.postgresql.org/download/windows/

# Durante instalación:
# - Usar password: Badalona.17 (o la que prefieras)
# - Marcar "Install pgAdmin 4" (opcional pero útil)
# - Puerto: 5432 (default)
```

### 🗄️ **2.2 Crear Base de Datos**
```sql
-- Abrir "SQL Shell (psql)" desde menú inicio
-- Usar tus credenciales de PostgreSQL

CREATE DATABASE pokemon_tcg;
```

### 📥 **2.3 Descargar Archivos desde la Nube**
- Descargar `tcg_complete_backup_[FECHA].sql`
- Descargar carpeta completa `TCGtrading/`
- Colocar todo en una carpeta en tu PC (ej: `C:\Projects\TCGtrading`)

### 🔧 **2.4 Restaurar Base de Datos**
```bash
# Abrir CMD o PowerShell como administrador
cd C:\Projects\TCGtrading

# Restaurar backup (ajusta la fecha del archivo)
psql -h localhost -U postgres -d pokemon_tcg < tcg_complete_backup_2026-02-19T13-30-00-000Z.sql

# Te pedirá password: Badalona.17 (o la que usaste)
```

### ⚙️ **2.5 Configurar Archivo .env**
Edita el archivo `TCGtrading\.env`:
```env
# Si usaste la misma password, no necesitas cambiar nada
DATABASE_URL=postgresql://postgres:Badalona.17@localhost:5432/pokemon_tcg

# Si usaste otra password, ajústala:
# DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/pokemon_tcg
```

### 🚀 **2.6 Probar que Funciona**
```bash
# En CMD/PowerShell, dentro de la carpeta TCGtrading:
node server-hybrid.js

# Deberías ver:
# Sets cargados: 200
# Series cargadas: 21
# Servidor corriendo en http://localhost:3000
```

### 🌐 **2.7 Verificar en Navegador**
- Abre http://localhost:3000
- Busca "charizard" o cualquier carta
- Deberías ver resultados de las 22,755 cartas

---

## 🔍 **VERIFICACIÓN FINAL**

### 📊 **Verificar Base de Datos**
```sql
-- Conectar a pokemon_tcg y ejecutar:
SELECT COUNT(*) as total_cartas FROM cards;
-- Debería mostrar: 22755

SELECT COUNT(DISTINCT set_id) as sets FROM cards;
-- Debería mostrar un número > 100
```

### 🌐 **Verificar Web**
- Busca diferentes cartas
- Verifica que los datos sean correctos
- Revisa que la paginación funcione

---

## 🚨 **SOLUCIÓN DE PROBLEMAS**

### ❌ **Error: "database does not exist"**
```sql
-- Asegúrate de crear la base de datos:
CREATE DATABASE pokemon_tcg;
```

### ❌ **Error: "password authentication failed"**
```bash
# Revisa tu password de PostgreSQL
# Actualiza el archivo .env con la password correcta
```

### ❌ **Error: "relation 'cards' does not exist"**
```bash
# El backup no se restauró correctamente
# Vuelve a ejecutar el comando psql:
psql -h localhost -U postgres -d pokemon_tcg < backup.sql
```

### ❌ **Error: "port already in use"**
```bash
# Cambia el puerto en el servidor:
set PORT=3001 && node server-hybrid.js
# O cierra otros procesos usando el puerto 3000
```

---

## 📱 **ALTERNATIVAS A POSTGRESQL LOCAL**

### 🌐 **Opción 1: Railway (Gratis)**
1. Crear cuenta en https://railway.app
2. Crear nuevo proyecto PostgreSQL
3. Obtener DATABASE_URL
4. Actualizar .env con la nueva URL
5. Subir proyecto a Railway

### 🌐 **Opción 2: Supabase (Gratis)**
1. Crear cuenta en https://supabase.com
2. Crear nuevo proyecto
3. Obtener URL de conexión
4. Restaurar backup en Supabase
5. Actualizar .env

### 🌐 **Opción 3: Neon (Gratis)**
1. Crear cuenta en https://neon.tech
2. Crear base de datos
3. Restaurar backup
4. Usar URL en .env

---

## 🎯 **RESUMEN RÁPIDO**

### 🏢 **En Trabajo:**
1. ⏳ Esperar fin de migración
2. 📤 Subir todo a Google Drive
3. ✅ Confirmar que esté todo

### 🏠 **En Casa:**
1. 🛠️ Instalar PostgreSQL
2. 📥 Descargar archivos
3. 🗄️ Restaurar base de datos
4. ⚙️ Configurar .env
5. 🚀 Ejecutar servidor
6. ✅ Verificar que funcione

### 🎉 **Resultado Final:**
- ✅ 22,755 cartas migradas
- ✅ Búsqueda funcional
- ✅ Todo funcionando localmente
- ✅ Listo para usar sin dependencias

---

## 📞 **SOPORTE**

Si tienes problemas:
1. Revisa los logs del servidor
2. Verifica la conexión a PostgreSQL
3. Confirma que el backup se restauró correctamente
4. Revisa el archivo .env

**¡Listo para cambiar de PC sin perder nada!** 🚀
