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

<<<<<<< HEAD
## Estado Actual (04/03/2026) — SISTEMA DE COLECCIÓN IMPLEMENTADO
=======
## Estado Actual (04/03/2026) — DEPLOYMENT EN RAILWAY FUNCIONANDO
>>>>>>> 3374b6c73b22c9570b47e5687f02988de431badc

### ✅ Lo que funciona:
- **22,721 cartas** migradas a Railway PostgreSQL
- **21 series, 200 sets, 11 tipos, 4 rarezas** en Railway
- **Búsqueda de cartas** funciona en la web
- **Paginación** funciona correctamente al cambiar de página
- **Imágenes** se ven correctamente (WebP alta calidad desde TCGdex)
- **Frontend** desplegado y funcionando en Railway
<<<<<<< HEAD
- **server-simple.js** es el servidor en producción (Railway usa `npm start` → `server-simple.js`)
- **Filtros de búsqueda** funcionando correctamente:
  - ✅ Filtro por **set** (nombre exacto, no trae "Base Set 2" cuando filtras "Base Set")
  - ✅ Filtro por **serie** (nombre exacto)
  - ✅ Filtro por **tipo** (Grass, Fire, Water, etc. usando `ILIKE ANY(c.types)`)
  - ✅ Filtro por **Trainer** (cartas sin HP y sin "Energy" en nombre)
  - ✅ Filtro por **Energy** (cartas sin HP con "Energy" en nombre)
  - ✅ Filtro por **rareza**
  - ✅ Filtros funcionan **sin necesidad de escribir texto** en el buscador
- **Sistema de colección personal**:
  - ✅ Modal "Agregar por Set" funcional
  - ✅ Carga todas las cartas del set seleccionado (usando `?setId=` exacto)
  - ✅ Ordenación numérica de cartas (#1, #2, #3...)
  - ✅ Selector de **condición** por carta (NM, EX, GD, PO)
  - ✅ Selector de **cantidad** por carta (1-99)
  - ✅ Checkboxes para selección masiva
  - ✅ Guardado en Firebase Firestore (`users/{uid}/my_cards/{cardId}`)
  - ✅ Modal se cierra correctamente después de agregar

### 🔧 TAREAS PENDIENTES:
1. **Arreglar imágenes rotas en sets con punto** (sm3.5, ex5.5, etc.) — Script `fix-dot-urls.js` creado pero no ejecutado
2. **Mostrar precios en la UI** — Los datos de Cardmarket/TCGPlayer ya están en la BD, solo falta mostrarlos
3. **Sistema de intercambios** — Propuestas, contraoferta, aceptar/rechazar
4. **Cardmarket API** — Actualización periódica de precios (requiere cuenta vendedor)
5. **Campos "Para intercambio/venta"** en colección personal
6. **Notificaciones** — Oferta recibida, trade completado
7. **Perfil público** — Reputación, historial de trades
=======
- **server-hybrid.js** configurado para Railway (sin JOINs a tablas que no existían)
- **Sistema de intercambios**: propuestas, aceptar/rechazar, ver detalles funcional
- **Display de cartas mejorado** en modales de intercambio/propuesta (función compartida `generateTradeCardHTML`)
- **Botón "Ver Propuestas"** en sección de intercambios para trades con propuestas pendientes
- **Chat**: icono flotante siempre visible cuando usuario autenticado
- **Chat**: ambos usuarios registrados como participantes al inicializar chat

### 🔧 TAREA PENDIENTE — Arreglar imágenes rotas en sets con punto:
- **Problema**: Sets con punto en el ID (ej: `sm3.5`, `ex5.5`, `sv03.5`, `sv04.5`, `sv06.5`, `me02.5`, `sv10.5b`, `sv10.5w`, `sm7.5`, `swsh3.5`, `swsh10.5`, `swsh12.5`) tienen URLs de imágenes que devuelven 404.
- **Causa**: Las URLs de TCGdex usan el set ID sin punto en la ruta. Ej: `sm3.5` → la URL correcta es `.../sm35/...` no `.../sm3.5/...`
- **Script creado**: `fix-dot-urls.js` — listo para ejecutar, no se ha ejecutado todavía
- **Acción**: Ejecutar `node fix-dot-urls.js` para arreglar todas las URLs de sets con punto
>>>>>>> 3374b6c73b22c9570b47e5687f02988de431badc

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
- `server-simple.js` — **Servidor en producción** (Railway). Express + PostgreSQL directo. Endpoints: `/api/pokemontcg/cards`, `/api/pokemontcg/sets`, `/api/tcgdex-image/*`
- `server-hybrid.js` — Servidor alternativo con más features (no usado en producción actualmente)

### Backup:
- `tcg_complete_backup_2026-02-19T14-19-35-633Z.json` — Backup completo de 22,721 cartas (NOTA: las imágenes en este JSON están vacías `{}`, se restauraron desde TCGdex API)

## Archivos Clave Modificados (04/03/2026)

### Backend (`server-simple.js`):
- **Filtros arreglados** (commits: `08a9a5f`, `cdc0236`, `e52052d`):
  - Añadido parámetro `setId` para match exacto por ID de set
  - Filtro `set` y `series` usan `ILIKE` por nombre exacto (sin wildcards `%`)
  - Filtro `type` usa `$N ILIKE ANY(c.types)` para arrays PostgreSQL
  - Filtro `trainer`: `hp IS NULL AND NOT (name ILIKE '%Energy%')`
  - Filtro `energy`: `hp IS NULL AND name ILIKE '%Energy%'`

### Frontend (`js/app-ui.js`):
- **Filtros** (commits: `4f4f71a`):
  - `fetchCards('')` permite búsqueda vacía con solo filtros activos
  - `buildCardsApiUrl` construye query string con todos los filtros
- **Sistema de colección** (commits: `e52052d`, `77bd3f8`):
  - `showBulkAddModal()` — Modal para agregar cartas por set completo
  - `loadSetCards(setId)` — Usa `?setId=` en vez de `?q=set.id:`
  - Ordenación numérica: `cards.sort((a,b) => parseInt(a.number) - parseInt(b.number))`
  - Columna condición (NM/EX/GD/PO) en tabla de selección
  - `addCardToCollection()` acepta parámetro `quantity` para agregar múltiples de una vez
  - Modal con `id="bulkAddModal"` para cierre correcto
  - Contador dinámico sin mostrar "(0)" inicial

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
<<<<<<< HEAD
6. ✅ Arreglar filtros de búsqueda (set, serie, tipo, trainer, energy, rareza)
7. ✅ Implementar sistema de colección personal con Firebase
8. ✅ Modal "Agregar por Set" con condición y cantidad
9. 🔧 **PENDIENTE**: Ejecutar `node fix-dot-urls.js` para arreglar imágenes de sets con punto (sm3.5, ex5.5, etc.)
10. 📋 **ROADMAP**:
    - Mostrar precios Cardmarket/TCGPlayer en cards
    - Sistema de intercambios (propuestas, contraoferta, aceptar/rechazar)
    - Cardmarket API para actualización de precios
    - Campos "Para intercambio/venta" en colección
    - Sistema de notificaciones
    - Perfil público con reputación
    - Blockchain/tokens (THORChain o similar) — proyecto a largo plazo

---
*Última actualización: 04/03/2026 — Sistema de colección implementado*
*Commits recientes: 77bd3f8 (bulk modal fixes), e52052d (collection system), cdc0236 (trainer/energy filters)*
=======
6. ✅ Arreglar bug: Cartas borradas reaparecen en propuestas
7. ✅ Fix viewProposalDetails: createdBy → userId
8. ✅ Botón "Ver Propuestas" en sección de intercambios
9. ✅ Mejorar display de cartas en modales (función compartida `generateTradeCardHTML`)
10. ✅ Fix chat: icono flotante siempre visible cuando autenticado (`chat-ui.js` → `updateMinimizedBar`)
11. ✅ Fix chat: registrar AMBOS usuarios como participantes en `initializeTradeChat` (`chat.js`)
12. ✅ Fix chat: corregir parámetros en `openTradeChat` (evitar doble prefijo `trade_trade_` y pasar `otherUserId` correcto)
13. ⏳ **PENDIENTE TEST**: Verificar que el chat funciona entre 2 cuentas (enviar mensaje y que aparezca al otro)
14. ⏳ Ejecutar `node fix-dot-urls.js` para arreglar imágenes de sets con punto
15. 📋 Sistema 'Disponible para Intercambio' en colecciones (prioridad media)

## Bugs Reportados y Estado (04/03/2026)
1. ✅ **Cartas borradas reaparecen** - ARREGLADO
2. ✅ **Chat no aparece al otro usuario** - ARREGLADO (2 bugs: parámetros incorrectos en `openTradeChat` + solo se registraba 1 participante)
3. ✅ **Icono flotante de chat desaparece** - ARREGLADO (ahora visible siempre que usuario está autenticado)
4. 🔧 **No se pueden añadir múltiples cartas** - Logs añadidos, pendiente investigación

## Cambios en archivos clave (sesión 04/03/2026 tarde)
- `js/modules/chat.js` — `initializeTradeChat` ahora registra AMBOS usuarios como participantes y añade chat a `userChats` de ambos
- `js/modules/chat-ui.js` — `updateMinimizedBar` muestra barra siempre si usuario autenticado (no depende de chats activos)
- `js/app-ui.js` — `openTradeChat` pasa `realTradeId` (sin prefijo) + `otherUserId` correcto a `initializeTradeChat`. Añadida función `generateTradeCardHTML`, botón "Ver Propuestas"

---
*Última actualización: 04/03/2026 17:00 — Sesión PC trabajo*
*Contexto guardado para futuras conversaciones*
>>>>>>> 3374b6c73b22c9570b47e5687f02988de431badc
