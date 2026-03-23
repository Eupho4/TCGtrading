# TCGtrade - Intercambio de Cartas Pokémon TCG

Una plataforma web para intercambiar y vender cartas Pokémon TCG con pagos seguros mediante depósito de garantía (escrow) a través de Stripe Connect.

## 🌐 Ver la aplicación en la web

La aplicación está desplegada en **Railway** y es accesible en:

> **https://tcgtrade-production.up.railway.app**

![TCGtrade screenshot](https://github.com/user-attachments/assets/606629d0-62a8-4983-bfe3-d757f4a57c00)

---

## ✅ ¿Qué se hizo en el Pull Request anterior?

El PR anterior (#1 – *"feat: Stripe Connect escrow payment system with commission logic"*) integró un **sistema de pagos seguro** basado en Stripe Connect. A continuación se explica todo lo que se implementó y dónde verlo en la web.

---

### 1. 🏦 Stripe Connect – Conexión de cuenta bancaria

**Qué hace:** Permite que los vendedores conecten su cuenta bancaria a través de Stripe para recibir el dinero de sus ventas e intercambios.

**Dónde verlo en la web:**
1. Inicia sesión en la app.
2. Haz clic en tu **avatar / nombre de usuario** (esquina superior derecha) → **Mi Perfil**.
3. Ve a la pestaña **💳 Pagos**.
4. Verás el banner **"🏦 Cuenta Bancaria"** con el botón **"Conectar cuenta bancaria"**.

**Archivos clave:**
- `stripe-service.js` → Lógica backend de Stripe Connect (crear cuenta, generar enlaces de onboarding, verificar estado).
- `js/modules/payments.js` → `connectStripeAccount()`, `checkAccountStatus()`, `openStripeDashboard()`.
- `js/modules/payment-ui.js` → `renderConnectAccountBanner()` – renderiza el banner en el perfil.
- `server-simple.js` → Rutas:
  - `POST /api/stripe/connect/create-account`
  - `GET /api/stripe/connect/return`
  - `GET /api/stripe/account-status`
  - `POST /api/stripe/connect/dashboard-link`

---

### 2. 🔒 Sistema de Depósito de Garantía (Escrow)

**Qué hace:** Cuando un comprador paga un intercambio, el dinero queda **retenido en Stripe** (no llega al vendedor todavía). El vendedor envía las cartas y proporciona el número de seguimiento. El comprador confirma que recibió las cartas y entonces los fondos se liberan automáticamente al vendedor.

**Flujo completo:**

| Paso | Quién | Acción |
|------|-------|--------|
| 1 | Comprador | Paga la tarifa de protección → dinero retenido en Stripe |
| 2 | Vendedor | Envía las cartas y añade número de seguimiento |
| 3 | Comprador | Confirma la recepción → dinero liberado al vendedor |
| ⚠️ | Comprador | Si hay problema → abre disputa → soporte revisa el caso |

**Dónde verlo en la web:**
1. Ve a la pestaña **💳 Pagos** en el perfil.
2. Sección **"🔒 ¿Cómo funciona el Depósito de Garantía?"** – muestra el flujo visual en 4 pasos.

**Archivos clave:**
- `stripe-service.js` → `createEscrowPaymentIntent()`, `capturePaymentIntent()`, `refundPaymentIntent()`.
- `js/modules/payments.js` → `initPaymentForm()`, `confirmReceipt()`, `addTracking()`, `openDispute()`.
- `js/modules/payment-ui.js` → `renderPaymentForm()`, `renderPaymentStatus()`.
- `server-simple.js` → Rutas:
  - `POST /api/stripe/payment/create-intent` – crea el pago en escrow
  - `POST /api/stripe/payment/release` – comprador confirma recepción
  - `POST /api/stripe/payment/tracking` – vendedor añade seguimiento
  - `POST /api/stripe/payment/refund` – reembolso / disputa
  - `GET /api/stripe/payment/status` – estado actual del pago

---

### 3. 💰 Comisiones y Tasas

**Qué hace:** Calcula automáticamente cuánto cobra la plataforma y cuánto recibe el vendedor.

**Dos modalidades:**

| Modalidad | Tarifa | Descripción |
|-----------|--------|-------------|
| 🛡️ **Protección de Intercambio** | **3,99 €** fijos | Intercambio carta-por-carta protegido. Los fondos se retienen hasta confirmar recepción. |
| 💳 **Venta Directa** | **7 %** sobre el precio | Comisión sobre el valor de venta. Se descuenta antes de transferir el dinero. |

> *Adicionalmente se descuentan las tasas de Stripe (~1,4 % + 0,25 € por transacción).*

**Dónde verlo en la web:**
1. Ve a la pestaña **💳 Pagos** en el perfil.
2. Sección **"💰 Comisiones y Tasas"** – muestra las dos tarjetas de precio.

**Archivos clave:**
- `stripe-service.js` → `calculateFees()` – calcula comisión + tasas Stripe.
- `js/modules/constants.js` → `COMMISSION` y `PAYMENT_TYPES` con todos los valores.
- `html/index.html` (líneas ~2164–2186) → UI de las tarjetas de comisiones.

---

### 4. 🗄️ Tablas de Base de Datos

**Qué hace:** Almacena en PostgreSQL (Railway) toda la información de cuentas Stripe y pagos.

**Tablas creadas:**

```sql
-- Cuentas Stripe Connect de cada usuario
user_stripe_accounts (
  firebase_uid, stripe_account_id, account_status,
  charges_enabled, country, created_at, updated_at
)

-- Pagos por intercambio (escrow)
trade_payments (
  trade_id, buyer_firebase_uid, seller_firebase_uid,
  seller_stripe_account, payment_type,
  gross_amount_cents, commission_cents, stripe_fee_cents, net_amount_cents,
  stripe_payment_intent, stripe_refund_id,
  payment_status, tracking_number, tracking_carrier,
  created_at, updated_at
)
```

**Archivo clave:** `create-payment-tables.js`

---

### 5. 🔔 Webhooks de Stripe

**Qué hace:** Stripe envía notificaciones al servidor cuando ocurre un evento (pago confirmado, transferencia completada, etc.). El servidor actualiza la base de datos automáticamente.

**Eventos manejados:**
- `payment_intent.succeeded` → actualiza estado a `requires_capture`
- `payment_intent.payment_failed` → marca el pago como `failed`
- `transfer.created` → confirma que el vendedor recibió el dinero

**Archivos clave:**
- `stripe-service.js` → `constructWebhookEvent()`, `handleWebhookEvent()`.
- `server-simple.js` → `POST /api/stripe/webhooks`.

---

## 📁 Estructura de Archivos Principales

```
TCGtrading/
├── server-simple.js              # Servidor Express + todas las rutas API
├── stripe-service.js             # Servicio Stripe (backend puro)
├── create-payment-tables.js      # Script para crear tablas en PostgreSQL
├── html/
│   └── index.html                # Frontend principal (SPA)
├── js/
│   └── modules/
│       ├── payments.js           # Lógica de pagos (frontend)
│       ├── payment-ui.js         # Componentes UI de pagos
│       ├── constants.js          # Constantes: comisiones, estados, etc.
│       ├── auth.js               # Autenticación Firebase
│       ├── chat.js               # Sistema de chat entre usuarios
│       └── ...
├── css/
│   └── custom-styles.css         # Estilos personalizados
├── .env.example                  # Variables de entorno necesarias
└── railway.json                  # Configuración de despliegue Railway
```

---

## ⚙️ Configuración para Desarrollo Local

### 1. Variables de entorno

Copia `.env.example` a `.env` y rellena los valores:

```env
# Base de datos PostgreSQL (Railway)
DATABASE_URL=postgresql://...

# API Pokémon TCG
POKEMON_TCG_API_KEY=tu_api_key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# URL pública (para redirecciones de Stripe Connect)
APP_URL=http://localhost:3000
```

### 2. Instalar dependencias y arrancar

```bash
npm install
npm start
# → http://localhost:3000
```

### 3. Crear tablas de pagos (primera vez)

```bash
node create-payment-tables.js
```

### 4. Probar webhooks de Stripe localmente

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhooks
```

---

## 🔗 URLs importantes

| Recurso | URL |
|---------|-----|
| 🌐 Aplicación en producción | https://tcgtrade-production.up.railway.app |
| 📊 Dashboard Railway | https://railway.app/ |
| 🔑 Dashboard Stripe | https://dashboard.stripe.com/ |
| 🔥 Firebase Console | https://console.firebase.google.com/ |
| 🃏 API Pokémon TCG | https://pokemontcg.io/ |

---

## 🛠️ Dependencias Principales

| Paquete | Versión | Uso |
|---------|---------|-----|
| `express` | ^4.21.2 | Servidor web |
| `stripe` | ^20.4.1 | Pagos Stripe Connect |
| `pg` | ^8.16.3 | PostgreSQL (Railway) |
| `firebase` | (CDN) | Autenticación de usuarios |
| `@tcgdex/sdk` | ^2.7.1 | Datos de cartas Pokémon |