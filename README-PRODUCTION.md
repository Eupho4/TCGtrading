# TCGtrade - Producción

## 🚀 Despliegue

### Opción 1: Firebase Hosting + Functions
```bash
# 1. Instalar Firebase CLI
npm install -g firebase-tools

# 2. Login en Firebase
firebase login

# 3. Desplegar
firebase deploy --only hosting,functions
```

### Opción 2: Railway/Heroku
```bash
# 1. Configurar variables de entorno
# DATABASE_URL, POKEMON_TCG_API_KEY

# 2. Desplegar
git push heroku main
# o
railway up
```

## 📊 Estadísticas Actuales
- Total cartas: 6199
- Con imágenes: 5557 (89.6%)
- Con series: 4775 (77.0%)

## 🔧 Configuración
- Base de datos: PostgreSQL
- API: TCGdex + PostgreSQL híbrido
- Frontend: HTML/CSS/JavaScript vanilla
- Hosting: Firebase Hosting
- Functions: Node.js 18
