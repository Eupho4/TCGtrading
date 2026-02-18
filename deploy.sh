#!/bin/bash
echo "🚀 Desplegando TCGtrade a producción..."

# Verificar que estamos en la rama correcta
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
    echo "⚠️ Cambia a la rama main: git checkout main"
    exit 1
fi

# Limpiar cache
npm cache clean --force

# Instalar dependencias
npm install --production

# Desplegar a Firebase
firebase deploy --only hosting,functions

echo "✅ Despliegue completado!"
echo "🌐 Tu web está en: https://tcgtrade.web.app"
