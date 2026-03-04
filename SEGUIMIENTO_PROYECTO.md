# Seguimiento del Proyecto TCGtrading

## INSTRUCCIONES PARA CASCADE (IA)
**IMPORTANTE**: Al iniciar cada conversación sobre este proyecto:
1. **ABRIR Y LEER** este documento de seguimiento primero
2. **REPASAR** el estado actual y scripts existentes
3. **CONSULTAR** este documento antes de crear nuevos scripts
4. **ACTUALIZAR** este documento después de cada cambio importante

## Contexto General
- **Proyecto**: TCGtrading - Plataforma de trading de cartas TCG
- **Ubicación PC trabajo**: `C:\Users\PC1\Desktop\TCGtrading\`
- **Base de datos LOCAL**: PostgreSQL (`postgresql://postgres:Badalona.17@localhost:5432/Pokemon%20TCG`)
- **Base de datos RAILWAY**: `postgresql://postgres:yyHavXPjvNKFLHjltnZjkUUvtDaPjKFf@nozomi.proxy.rlwy.net:50668/railway`
- **Web en producción**: https://tcgtrade-production.up.railway.app
- **GitHub**: https://github.com/Eupho4/TCGtrading.git (rama `main`)
- **API externa**: TCGdex API (https://api.tcgdex.net/v2)

## Estado Actual (03/03/2026) — DEPLOYMENT EN RAILWAY FUNCIONANDO

### ✅ Lo que funciona:
- **22,721 cartas** migradas a Railway PostgreSQL
- **21 series, 200 sets, 11 tipos, 4 rarezas** en Railway
- **Búsqueda de cartas** funciona en la web
- **Paginación** funciona correctamente al cambiar de página
- **Imágenes** se ven correctamente (WebP alta calidad desde TCGdex)
- **Frontend** desplegado y funcionando en Railway
- **server-hybrid.js** configurado para Railway (sin JOINs a tablas que no existían)

### 🔧 TAREA PENDIENTE — Arreglar imágenes rotas en sets con punto:
- **Problema**: Sets con punto en el ID (ej: `sm3.5`, `ex5.5`, `sv03.5`, `sv04.5`, `sv06.5`, `me02.5`, `sv10.5b`, `sv10.5w`, `sm7.5`, `swsh3.5`, `swsh10.5`, `swsh12.5`) tienen URLs de imágenes que devuelven 404.
- **Causa**: Las URLs de TCGdex usan el set ID sin punto en la ruta. Ej: `sm3.5` → la URL correcta es `.../sm35/...` no `.../sm3.5/...`
- **Ejemplo**: `Shining Rayquaza` (sm3.5-56)
  - ❌ URL actual: `https://assets.tcgdex.net/en/sm/sm3.5/56/high.webp` → 404
  - ✅ URL correcta: `https://assets.tcgdex.net/en/sm/sm35/56/high.webp` → 200
- **Script creado**: `fix-dot-urls.js` — listo para ejecutar, no se ha ejecutado todavía
- **Acción**: Ejecutar `node fix-dot-urls.js` para arreglar todas las URLs de sets con punto

## Estructura de Base de Datos (Railway)
- `cards` — 22,721 registros. Columnas: id, name, number, set_id, rarity_id, hp, types, subtypes, rules, images (JSONB), tcgplayer, cardmarket, legal, artist, flavor_text, national_pokedex_numbers, attacks, weaknesses, resistances, retreat_cost, converted_retreat_cost
- `sets` — 200 registros. Columnas: id, name, serie_id, logo, symbol
- `series` — 21 registros. Columnas: id, name
- `types` — 11 registros. Columnas: id, name
- `rarities` — 4 registros. Columnas: id, name

## Scripts Importantes

### Migración y datos:
- `migrate-local.js` — Migrar JSON backup a PostgreSQL local
- `migrate-to-railway.js` — Migrar JSON backup a Railway PostgreSQL
- `fix-railway-tables.js` — Crear y poblar tablas sets/series/types/rarities en Railway desde TCGdex API
- `restore-images-from-tcgdex.js` — Restaurar URLs de imágenes desde TCGdex API (ya ejecutado, 22,755 cartas)
- `fix-dot-urls.js` — **PENDIENTE** Arreglar URLs de sets con punto en el ID
- `import-json-to-db.js` — Script original de importación
- `check-missing-images.js` — Verificar cartas sin imágenes
- `check-card.js` — Verificar una carta específica en BD

### Servidor:
- `server-hybrid.js` — Servidor principal (Express + PostgreSQL). Usa `DATABASE_URL` del entorno. En Railway tiene SSL habilitado. Formatea cartas con info de sets desde cache.

### Backup:
- `tcg_complete_backup_2026-02-19T14-19-35-633Z.json` — Backup completo de 22,721 cartas (NOTA: las imágenes en este JSON están vacías `{}`, se restauraron desde TCGdex API)

## Archivos Clave Modificados (03/03/2026)
- `server-hybrid.js` — Añadido código para arreglar URLs de imágenes TCGdex (añade `/high.webp`). Queries sin JOINs a sets/series para Railway.
- `js/app-ui.js` — Eliminado bloqueo de URLs TCGdex que forzaba placeholder "En Proceso". Arreglado bug de paginación (`data.pagination?.total || data.totalCount`).

## Configuración Railway
- **DATABASE_URL**: configurada como variable de entorno en Railway
- **Deploy**: automático desde GitHub (push a `main` = redeploy en 2-3 min)
- **Node.js**: v24.14.0
- **SSL**: habilitado para conexión a PostgreSQL

## Próximos Pasos
1. ✅ Migrar 22,721 cartas a Railway
2. ✅ Crear tablas sets/series/types/rarities en Railway
3. ✅ Arreglar paginación frontend
4. ✅ Restaurar imágenes desde TCGdex (22,755 cartas)
5. ✅ Eliminar bloqueo placeholder TCGdex en frontend
6. ✅ Arreglar bug: Cartas borradas reaparecen en propuestas
7. 🔧 **PENDIENTE DEPLOY**: Cambios en `js/app-ui.js` (bug cartas borradas + logs debug)
8. 🔧 **PENDIENTE**: Arreglar bug chat no aparece al otro usuario (archivo `js/modules/chat.js` corrupto, necesita restauración)
9. 🔧 **INVESTIGAR**: Bug no se pueden añadir múltiples cartas (logs añadidos, necesita prueba en web)
10. ⏳ Ejecutar `node fix-dot-urls.js` para arreglar imágenes de sets con punto (sm3.5, ex5.5, etc.)

## Bugs Reportados (04/03/2026)
1. ✅ **Cartas borradas reaparecen** - ARREGLADO (limpiar contenedores antes de pre-cargar)
2. 🔧 **No se pueden añadir múltiples cartas** - Logs añadidos, pendiente investigación
3. 🔧 **Chat no aparece al otro usuario** - Archivo corrupto, necesita restauración y fix

## Comandos Git Bloqueados
- Los comandos `git` se están cancelando automáticamente en Windsurf
- **SOLUCIÓN TEMPORAL**: Usuario debe ejecutar manualmente en PowerShell:
  ```powershell
  git checkout HEAD -- js/modules/chat.js
  git add js/app-ui.js
  git commit -m "Fix: Bug cartas borradas + logs debug"
  git pull origin main --rebase
  git push origin main
  ```

---
*Última actualización: 04/03/2026 11:55 — Sesión PC trabajo*
*Contexto guardado para futuras conversaciones*
