require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const stripeService = require('./stripe-service');
const { initAuthTables, mountAuthRoutes, createRequireAuthForUserId, getJwtSecret, jwtOptions } = require('./server-auth');
const { initInboxTradesTables, mountInboxTradesRoutes } = require('./server-inbox-trades');
const { initChatTables, mountChatRoutes } = require('./server-chat');

// ── Shipping / tracking helpers ───────────────────────────────────────────────

/**
 * Validate that a tracking number matches the standard Correos España format:
 * two uppercase letters, nine digits, two uppercase letters (e.g. ES123456789ES).
 *
 * @param {string} trackingNumber
 * @returns {boolean}
 */
function validateCorreosTrackingNumber(trackingNumber) {
    return /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(trackingNumber.toUpperCase());
}

/**
 * Build the Correos España shipment-tracking URL for a given tracking number.
 *
 * @param {string} trackingNumber
 * @returns {string}
 */
function getCorreosTrackingUrl(trackingNumber) {
    return `https://www.correos.es/es/es/herramientas/localizador/detalles?numero=${encodeURIComponent(trackingNumber)}`;
}

// ── Stripe error helper ───────────────────────────────────────────────────────
/**
 * Map a Stripe (or generic) error to an appropriate HTTP status code and a
 * user-visible message.
 *
 * Stripe Connect not enabled  → 503  (service unavailable until configured)
 * Invalid request / bad input → 400
 * Auth / key problems         → 401
 * Everything else             → 500
 *
 * @param {Error} error
 * @returns {{ status: number, message: string }}
 */
function classifyStripeError(error) {
    const msg = error.message || '';

    // "You can only create new accounts if you've signed up for Connect"
    // Stripe does not expose a dedicated error code for this, so we check the
    // error type first (StripeInvalidRequestError) and then the message text.
    if (
        (error.type === 'StripeInvalidRequestError' || !error.type) &&
        (msg.includes('signed up for Connect') || msg.includes('dashboard.stripe.com/connect'))
    ) {
        return {
            status: 503,
            message: 'Stripe Connect no está habilitado en esta cuenta. ' +
                     'Actívalo en https://dashboard.stripe.com/connect y vuelve a intentarlo.',
            connectSetupRequired: true
        };
    }

    // Stripe API key not set or invalid
    if (msg.includes('STRIPE_SECRET_KEY') || error.type === 'StripeAuthenticationError') {
        return { status: 401, message: 'Stripe no está configurado correctamente en el servidor.' };
    }

    // Stripe invalid-request errors (bad parameters, etc.)
    if (error.type === 'StripeInvalidRequestError') {
        return { status: 400, message: msg };
    }

    return { status: 500, message: msg };
}

const app = express();
const PORT = process.env.PORT || 3000;

// Base de datos PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

let requireAuthUserId = null;
try {
    requireAuthUserId = createRequireAuthForUserId(pool);
} catch (e) {
    console.warn('Auth API: deshabilitada hasta que JWT_SECRET esté configurado');
}

// ── Middleware ────────────────────────────────────────────────────────────────
// ── Stripe webhooks need the raw body; register BEFORE express.json()
app.use('/api/stripe/webhooks', express.raw({ type: 'application/json' }));

app.use(cors());
app.use(express.json());
app.use(express.static('html'));
app.use('/js', express.static('js'));
app.use('/css', express.static('css'));

// ── Rate limiting for payment/Stripe API routes ───────────────────────────────
const stripeApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 30,                    // Max 30 requests per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests. Please try again later.' }
});

// ── Rate limiting for database read routes ────────────────────────────────────
const dbReadLimiter = rateLimit({
    windowMs: 60 * 1000,        // 1 minute
    max: 120,                   // Max 120 requests per IP per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests. Please try again later.' }
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected'
    });
});

/**
 * GET /api/config
 * Returns public client-side configuration (safe values only – no secret keys).
 */
app.get('/api/config', (req, res) => {
    res.json({
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
        authApiEnabled: !!process.env.JWT_SECRET
    });
});

if (requireAuthUserId) {
    mountAuthRoutes(app, pool);
    mountInboxTradesRoutes(app, pool, getJwtSecret, jwtOptions, dbReadLimiter);
    mountChatRoutes(app, pool, getJwtSecret, jwtOptions, dbReadLimiter);
}

// ── User collection (PostgreSQL) — requiere JWT (mismo userId que en el token) ─
app.get('/api/users/:userId/cards', requireAuthUserId || ((_req, res) => res.status(503).json({ success: false, error: 'Autenticación no configurada' })), async (req, res) => {
    try {
        const { userId } = req.params;
        if (String(req.user.id) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'No autorizado' });
        }
        const result = await pool.query(
            `SELECT
                user_id,
                card_id AS id,
                card_name AS name,
                image_url AS "imageUrl",
                set_name AS "set",
                set_id AS "setId",
                series,
                card_number AS number,
                card_condition AS condition,
                language,
                quantity,
                is_transferable AS "isTransferable",
                custom_price AS "customPrice",
                added_at AS "addedAt",
                updated_at AS "lastUpdated"
             FROM user_cards
             WHERE user_id = $1
             ORDER BY set_name ASC, card_number ASC`,
            [userId]
        );

        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error loading user cards:', error.message);
        res.status(500).json({ success: false, error: 'Error loading user cards' });
    }
});

app.post('/api/users/:userId/cards', requireAuthUserId || ((_req, res) => res.status(503).json({ success: false, error: 'Autenticación no configurada' })), async (req, res) => {
    try {
        const { userId } = req.params;
        if (String(req.user.id) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'No autorizado' });
        }
        const {
            cardId,
            name,
            imageUrl = '',
            set = '',
            setId = null,
            series = '',
            number = '',
            condition = 'NM',
            language = 'Español',
            quantity = 1
        } = req.body || {};

        if (!cardId || !name) {
            return res.status(400).json({ success: false, error: 'cardId and name are required' });
        }

        await pool.query(
            `INSERT INTO user_cards (
                user_id, card_id, card_name, image_url, set_name, set_id, series, card_number,
                card_condition, language, quantity, added_at, updated_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
            ON CONFLICT (user_id, card_id) DO UPDATE
               SET quantity       = user_cards.quantity + EXCLUDED.quantity,
                   card_name      = EXCLUDED.card_name,
                   image_url      = EXCLUDED.image_url,
                   set_name       = EXCLUDED.set_name,
                   set_id         = COALESCE(EXCLUDED.set_id, user_cards.set_id),
                   series         = EXCLUDED.series,
                   card_number    = EXCLUDED.card_number,
                   card_condition = EXCLUDED.card_condition,
                   language       = EXCLUDED.language,
                   updated_at     = NOW()`,
            [userId, cardId, name, imageUrl, set, setId, series, number, condition, language, quantity]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error upserting user card:', error.message);
        res.status(500).json({ success: false, error: 'Error saving card' });
    }
});

app.patch('/api/users/:userId/cards/:cardId', requireAuthUserId || ((_req, res) => res.status(503).json({ success: false, error: 'Autenticación no configurada' })), async (req, res) => {
    try {
        const { userId, cardId } = req.params;
        if (String(req.user.id) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'No autorizado' });
        }
        const { isTransferable, customPrice, quantity, condition, language } = req.body || {};

        const updates = [];
        const params = [userId, cardId];
        let idx = 3;

        if (isTransferable !== undefined) {
            updates.push(`is_transferable = $${idx++}`);
            params.push(!!isTransferable);
        }
        if (customPrice !== undefined) {
            updates.push(`custom_price = $${idx++}`);
            params.push(customPrice === null ? null : Number(customPrice));
        }
        if (quantity !== undefined) {
            updates.push(`quantity = GREATEST(1, $${idx++})`);
            params.push(Number(quantity) || 1);
        }
        if (condition !== undefined) {
            updates.push(`card_condition = $${idx++}`);
            params.push(condition);
        }
        if (language !== undefined) {
            updates.push(`language = $${idx++}`);
            params.push(language);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }

        updates.push('updated_at = NOW()');

        const result = await pool.query(
            `UPDATE user_cards
                SET ${updates.join(', ')}
              WHERE user_id = $1 AND card_id = $2`,
            params
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Card not found in collection' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating user card:', error.message);
        res.status(500).json({ success: false, error: 'Error updating card' });
    }
});

app.delete('/api/users/:userId/cards/:cardId', requireAuthUserId || ((_req, res) => res.status(503).json({ success: false, error: 'Autenticación no configurada' })), async (req, res) => {
    try {
        const { userId, cardId } = req.params;
        if (String(req.user.id) !== String(userId)) {
            return res.status(403).json({ success: false, error: 'No autorizado' });
        }
        await pool.query('DELETE FROM user_cards WHERE user_id = $1 AND card_id = $2', [userId, cardId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting user card:', error.message);
        res.status(500).json({ success: false, error: 'Error deleting card' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// STRIPE CONNECT & PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/stripe/connect/create-account
 * Create a Stripe Express Connected account for a seller and return the
 * onboarding URL.
 *
 * Body: { firebaseUid, email, country? }
 */
app.post('/api/stripe/connect/create-account', stripeApiLimiter, async (req, res) => {
    try {
        const { firebaseUid, email, country = 'ES', tradeId = '' } = req.body;
        if (!firebaseUid || !email) {
            return res.status(400).json({ success: false, error: 'firebaseUid and email are required' });
        }

        // Check if this user already has an account
        const existing = await pool.query(
            'SELECT stripe_account_id, account_status FROM user_stripe_accounts WHERE firebase_uid = $1',
            [firebaseUid]
        );

        let stripeAccountId;

        if (existing.rows.length > 0) {
            stripeAccountId = existing.rows[0].stripe_account_id;
        } else {
            const account = await stripeService.createConnectAccount({ email, country, firebaseUid });
            stripeAccountId = account.id;

            // Guard: reject if this Stripe account is already linked to a different user.
            const conflict = await pool.query(
                'SELECT firebase_uid FROM user_stripe_accounts WHERE stripe_account_id = $1',
                [stripeAccountId]
            );
            if (conflict.rows.length > 0 && conflict.rows[0].firebase_uid !== firebaseUid) {
                return res.status(409).json({
                    success: false,
                    error: 'This Stripe account is already linked to a different user.'
                });
            }

            await pool.query(
                `INSERT INTO user_stripe_accounts
                    (firebase_uid, stripe_account_id, account_status, country)
                 VALUES ($1, $2, 'pending', $3)`,
                [firebaseUid, stripeAccountId, country]
            );
        }

        const onboardingUrl = await stripeService.createAccountLink(stripeAccountId, tradeId);
        res.json({ success: true, onboardingUrl, stripeAccountId });

    } catch (error) {
        console.error('Error creating Connect account:', error.message);
        // PostgreSQL unique-violation on stripe_account_id means this Stripe
        // account was concurrently linked to a different user – treat as 409.
        if (error.code === '23505' && error.constraint === 'user_stripe_accounts_stripe_account_id_key') {
            return res.status(409).json({
                success: false,
                error: 'This Stripe account is already linked to a different user.'
            });
        }
        const { status, message, connectSetupRequired } = classifyStripeError(error);
        res.status(status).json({ success: false, error: message, connectSetupRequired: connectSetupRequired || false });
    }
});

/**
 * GET /api/stripe/connect/return
 * Landing page after Stripe onboarding is completed / abandoned.
 * Stripe redirects the browser here; we update DB and redirect to the app.
 */
app.get('/api/stripe/connect/return', stripeApiLimiter, async (req, res) => {
    try {
        const { account: stripeAccountId, trade = '' } = req.query;
        if (!stripeAccountId) {
            return res.redirect('/?stripe_error=missing_account');
        }

        const account = await stripeService.retrieveAccount(stripeAccountId);

        await pool.query(
            `UPDATE user_stripe_accounts
                SET account_status    = $2,
                    charges_enabled   = $3,
                    payouts_enabled   = $4,
                    details_submitted = $5,
                    updated_at        = NOW()
              WHERE stripe_account_id = $1`,
            [
                stripeAccountId,
                account.charges_enabled ? 'active' : 'pending',
                account.charges_enabled,
                account.payouts_enabled,
                account.details_submitted
            ]
        );

        const redirectUrl = trade
            ? `/?stripe_connected=1&trade=${trade}`
            : '/?stripe_connected=1';

        res.redirect(redirectUrl);

    } catch (error) {
        console.error('Error in Connect return:', error.message);
        res.redirect('/?stripe_error=callback_failed');
    }
});

/**
 * GET /api/stripe/connect/refresh
 * Called by Stripe when the onboarding link expires. Re-creates the link.
 */
app.get('/api/stripe/connect/refresh', stripeApiLimiter, async (req, res) => {
    try {
        const { account: stripeAccountId, trade = '' } = req.query;
        if (!stripeAccountId) {
            return res.redirect('/?stripe_error=missing_account');
        }
        const onboardingUrl = await stripeService.createAccountLink(stripeAccountId, trade);
        res.redirect(onboardingUrl);
    } catch (error) {
        console.error('Error refreshing Connect link:', error.message);
        res.redirect('/?stripe_error=refresh_failed');
    }
});

/**
 * GET /api/stripe/account-status
 * Returns the current onboarding status for a user.
 * Query: ?firebaseUid=xxx
 */
app.get('/api/stripe/account-status', stripeApiLimiter, async (req, res) => {
    try {
        const { firebaseUid } = req.query;
        if (!firebaseUid) {
            return res.status(400).json({ success: false, error: 'firebaseUid is required' });
        }

        const result = await pool.query(
            `SELECT stripe_account_id, account_status, charges_enabled,
                    payouts_enabled, details_submitted, country, currency
               FROM user_stripe_accounts
              WHERE firebase_uid = $1`,
            [firebaseUid]
        );

        if (result.rows.length === 0) {
            return res.json({ success: true, connected: false });
        }

        const row = result.rows[0];
        res.json({
            success: true,
            connected: true,
            accountId: row.stripe_account_id,
            status: row.account_status,
            chargesEnabled: row.charges_enabled,
            payoutsEnabled: row.payouts_enabled,
            detailsSubmitted: row.details_submitted
        });

    } catch (error) {
        console.error('Error getting account status:', error.message);
        const { status, message } = classifyStripeError(error);
        res.status(status).json({ success: false, error: message });
    }
});

/**
 * POST /api/stripe/connect/dashboard-link
 * Returns a Stripe Express Dashboard URL for the seller.
 *
 * Body: { firebaseUid }
 */
app.post('/api/stripe/connect/dashboard-link', stripeApiLimiter, async (req, res) => {
    try {
        const { firebaseUid } = req.body;
        if (!firebaseUid) {
            return res.status(400).json({ success: false, error: 'firebaseUid is required' });
        }

        const result = await pool.query(
            'SELECT stripe_account_id FROM user_stripe_accounts WHERE firebase_uid = $1',
            [firebaseUid]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'No connected account found' });
        }

        const dashboardUrl = await stripeService.createDashboardLink(result.rows[0].stripe_account_id);
        res.json({ success: true, dashboardUrl });

    } catch (error) {
        console.error('Error creating dashboard link:', error.message);
        const { status, message } = classifyStripeError(error);
        res.status(status).json({ success: false, error: message });
    }
});

// ── Escrow Payments ────────────────────────────────────────────────────────

/**
 * POST /api/stripe/payment/create-intent
 * Creates an escrow PaymentIntent (manual capture) for a trade.
 *
 * Body: {
 *   tradeId, paymentType, grossAmountEur,
 *   buyerFirebaseUid, buyerEmail,
 *   sellerFirebaseUid
 * }
 */
app.post('/api/stripe/payment/create-intent', stripeApiLimiter, async (req, res) => {
    try {
        const {
            tradeId,
            paymentType = 'trade_protection',
            grossAmountEur = 0,
            buyerFirebaseUid,
            buyerEmail,
            sellerFirebaseUid
        } = req.body;

        if (!tradeId || !buyerFirebaseUid || !sellerFirebaseUid) {
            return res.status(400).json({ success: false, error: 'tradeId, buyerFirebaseUid and sellerFirebaseUid are required' });
        }

        // Look up seller's connected account
        const sellerResult = await pool.query(
            'SELECT stripe_account_id, charges_enabled FROM user_stripe_accounts WHERE firebase_uid = $1',
            [sellerFirebaseUid]
        );

        const sellerStripeAccount = sellerResult.rows.length > 0 && sellerResult.rows[0].charges_enabled
            ? sellerResult.rows[0].stripe_account_id
            : null;

        const { clientSecret, paymentIntentId, fees } = await stripeService.createEscrowPaymentIntent({
            tradeId,
            paymentType,
            grossAmountEur,
            sellerStripeAccount,
            buyerEmail,
            metadata: {
                buyer_firebase_uid:  buyerFirebaseUid,
                seller_firebase_uid: sellerFirebaseUid
            }
        });

        // Persist to DB
        await pool.query(
            `INSERT INTO trade_payments
                (trade_id, buyer_firebase_uid, seller_firebase_uid,
                 seller_stripe_account, payment_type,
                 gross_amount_cents, commission_cents, stripe_fee_cents, net_amount_cents,
                 stripe_payment_intent, payment_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
             ON CONFLICT (trade_id) DO UPDATE
                SET stripe_payment_intent = EXCLUDED.stripe_payment_intent,
                    payment_status        = 'pending',
                    updated_at            = NOW()`,
            [
                tradeId, buyerFirebaseUid, sellerFirebaseUid,
                sellerStripeAccount, paymentType,
                fees.grossCents, fees.commissionCents, fees.stripeFeeCents, fees.netCents,
                paymentIntentId
            ]
        );

        res.json({
            success: true,
            clientSecret,
            paymentIntentId,
            fees: {
                grossEur:      (fees.grossCents / 100).toFixed(2),
                commissionEur: (fees.commissionCents / 100).toFixed(2),
                stripeFeeEur:  (fees.stripeFeeCents / 100).toFixed(2),
                netEur:        (fees.netCents / 100).toFixed(2)
            }
        });

    } catch (error) {
        console.error('Error creating payment intent:', error.message);
        const { status, message } = classifyStripeError(error);
        res.status(status).json({ success: false, error: message });
    }
});

/**
 * POST /api/stripe/payment/release
 * Buyer confirms receipt → capture the escrowed funds.
 *
 * Body: { tradeId, buyerFirebaseUid }
 */
app.post('/api/stripe/payment/release', stripeApiLimiter, async (req, res) => {
    try {
        const { tradeId, buyerFirebaseUid } = req.body;
        if (!tradeId || !buyerFirebaseUid) {
            return res.status(400).json({ success: false, error: 'tradeId and buyerFirebaseUid are required' });
        }

        const result = await pool.query(
            `SELECT stripe_payment_intent, payment_status, buyer_firebase_uid
               FROM trade_payments WHERE trade_id = $1`,
            [tradeId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Payment record not found' });
        }

        const payment = result.rows[0];

        if (payment.buyer_firebase_uid !== buyerFirebaseUid) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        if (payment.payment_status !== 'requires_capture') {
            return res.status(400).json({
                success: false,
                error: `Cannot release funds in status: ${payment.payment_status}`
            });
        }

        await stripeService.capturePaymentIntent(payment.stripe_payment_intent);

        await pool.query(
            `UPDATE trade_payments
                SET payment_status = 'transferred', updated_at = NOW()
              WHERE trade_id = $1`,
            [tradeId]
        );

        res.json({ success: true, message: 'Funds released to seller' });

    } catch (error) {
        console.error('Error releasing payment:', error.message);
        const { status, message } = classifyStripeError(error);
        res.status(status).json({ success: false, error: message });
    }
});

/**
 * POST /api/stripe/payment/refund
 * Cancel or refund a trade payment (dispute / cancellation).
 *
 * Body: { tradeId, requesterFirebaseUid, reason? }
 */
app.post('/api/stripe/payment/refund', stripeApiLimiter, async (req, res) => {
    try {
        const {
            tradeId,
            requesterFirebaseUid,
            reason = 'requested_by_customer'
        } = req.body;

        if (!tradeId || !requesterFirebaseUid) {
            return res.status(400).json({ success: false, error: 'tradeId and requesterFirebaseUid are required' });
        }

        const result = await pool.query(
            `SELECT stripe_payment_intent, payment_status, buyer_firebase_uid
               FROM trade_payments WHERE trade_id = $1`,
            [tradeId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Payment record not found' });
        }

        const payment = result.rows[0];

        if (payment.buyer_firebase_uid !== requesterFirebaseUid) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const refundResult = await stripeService.refundPaymentIntent(
            payment.stripe_payment_intent,
            reason
        );

        const newStatus = refundResult.object === 'refund' ? 'refunded' : 'cancelled';

        await pool.query(
            `UPDATE trade_payments
                SET payment_status  = $2,
                    stripe_refund_id = $3,
                    updated_at       = NOW()
              WHERE trade_id = $1`,
            [tradeId, newStatus, refundResult.id || null]
        );

        res.json({ success: true, status: newStatus });

    } catch (error) {
        console.error('Error processing refund:', error.message);
        const { status, message } = classifyStripeError(error);
        res.status(status).json({ success: false, error: message });
    }
});

/**
 * POST /api/stripe/payment/tracking
 * Seller provides a tracking number for a shipment.
 *
 * Body: { tradeId, sellerFirebaseUid, trackingNumber, carrier? }
 */
app.post('/api/stripe/payment/tracking', stripeApiLimiter, async (req, res) => {
    try {
        const { tradeId, sellerFirebaseUid, trackingNumber, carrier = 'Correos' } = req.body;

        if (!tradeId || !sellerFirebaseUid || !trackingNumber) {
            return res.status(400).json({ success: false, error: 'tradeId, sellerFirebaseUid and trackingNumber are required' });
        }

        // Validate Correos España format when carrier is Correos (or not specified)
        if (carrier === 'Correos' && !validateCorreosTrackingNumber(trackingNumber)) {
            return res.status(400).json({
                success: false,
                error: 'Formato de número de seguimiento de Correos inválido. Debe tener el formato: 2 letras + 9 números + 2 letras (ej: ES123456789ES)'
            });
        }

        const result = await pool.query(
            'SELECT seller_firebase_uid, payment_status FROM trade_payments WHERE trade_id = $1',
            [tradeId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Payment record not found' });
        }

        if (result.rows[0].seller_firebase_uid !== sellerFirebaseUid) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        await pool.query(
            `UPDATE trade_payments
                SET tracking_number   = $2,
                    tracking_carrier  = $3,
                    shipping_status   = 'SHIPPED',
                    payment_status    = 'requires_capture',
                    updated_at        = NOW()
              WHERE trade_id = $1`,
            [tradeId, trackingNumber, carrier]
        );

        const trackingUrl = carrier === 'Correos'
            ? getCorreosTrackingUrl(trackingNumber)
            : null;

        res.json({ success: true, message: 'Tracking information saved', trackingUrl });

    } catch (error) {
        console.error('Error saving tracking info:', error.message);
        const { status, message } = classifyStripeError(error);
        res.status(status).json({ success: false, error: message });
    }
});

/**
 * GET /api/stripe/payment/status
 * Returns the current payment status for a trade.
 * Query: ?tradeId=xxx
 */
app.get('/api/stripe/payment/status', stripeApiLimiter, async (req, res) => {
    try {
        const { tradeId } = req.query;
        if (!tradeId) {
            return res.status(400).json({ success: false, error: 'tradeId is required' });
        }

        const result = await pool.query(
            `SELECT payment_type, gross_amount_cents, commission_cents,
                    stripe_fee_cents, net_amount_cents,
                    payment_status, tracking_number, tracking_carrier,
                    shipping_status, created_at, updated_at
               FROM trade_payments WHERE trade_id = $1`,
            [tradeId]
        );

        if (result.rows.length === 0) {
            return res.json({ success: true, payment: null });
        }

        const p = result.rows[0];
        const trackingUrl = p.tracking_number && p.tracking_carrier === 'Correos'
            ? getCorreosTrackingUrl(p.tracking_number)
            : null;
        res.json({
            success: true,
            payment: {
                paymentType:    p.payment_type,
                grossEur:       (p.gross_amount_cents / 100).toFixed(2),
                commissionEur:  (p.commission_cents / 100).toFixed(2),
                stripeFeeEur:   (p.stripe_fee_cents / 100).toFixed(2),
                netEur:         (p.net_amount_cents / 100).toFixed(2),
                status:         p.payment_status,
                trackingNumber: p.tracking_number,
                carrier:        p.tracking_carrier,
                shippingStatus: p.shipping_status || 'PENDING',
                trackingUrl,
                createdAt:      p.created_at,
                updatedAt:      p.updated_at
            }
        });

    } catch (error) {
        console.error('Error getting payment status:', error.message);
        const { status, message } = classifyStripeError(error);
        res.status(status).json({ success: false, error: message });
    }
});

// ── Stripe Webhooks ────────────────────────────────────────────────────────

/**
 * POST /api/stripe/webhooks
 * Receives and processes Stripe webhook events.
 * Body must be raw (registered before express.json() middleware above).
 */
app.post('/api/stripe/webhooks', async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
        return res.status(400).json({ error: 'Missing Stripe-Signature header' });
    }

    let event;
    try {
        event = stripeService.constructWebhookEvent(req.body, signature);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    try {
        const result = await stripeService.handleWebhookEvent(event, pool);
        console.log(`Webhook ${event.type}: ${result.action}`);
        res.json({ received: true, action: result.action });
    } catch (err) {
        console.error('Error handling webhook event:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Búsqueda de cartas - DIRECTO a PostgreSQL
app.get('/api/pokemontcg/cards', dbReadLimiter, async (req, res) => {
    try {
        const {
            q = '',
            page = 1,
            pageSize = 20,
            set,
            setId,
            series,
            type,
            rarity
        } = req.query;

        const offset = (page - 1) * pageSize;
        
        // Construir WHERE clause
        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        if (q) {
            whereConditions.push(`(c.name ILIKE $${paramIndex} OR c.id ILIKE $${paramIndex})`);
            params.push(`%${q}%`);
            paramIndex++;
        }

        if (setId) {
            whereConditions.push(`s.id = $${paramIndex}`);
            params.push(setId);
            paramIndex++;
        } else if (set) {
            whereConditions.push(`s.name ILIKE $${paramIndex}`);
            params.push(set);
            paramIndex++;
        }

        if (series) {
            whereConditions.push(`se.name ILIKE $${paramIndex}`);
            params.push(series);
            paramIndex++;
        }

        if (type) {
            if (type.toLowerCase() === 'trainer') {
                whereConditions.push(`(c.hp IS NULL AND NOT (c.name ILIKE $${paramIndex}))`);
                params.push('%Energy%');
                paramIndex++;
            } else if (type.toLowerCase() === 'energy') {
                whereConditions.push(`(c.hp IS NULL AND c.name ILIKE $${paramIndex})`);
                params.push('%Energy%');
                paramIndex++;
            } else {
                whereConditions.push(`$${paramIndex} ILIKE ANY(c.types)`);
                params.push(type);
                paramIndex++;
            }
        }

        if (rarity) {
            whereConditions.push(`r.name ILIKE $${paramIndex}`);
            params.push(`%${rarity}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Query principal
        const query = `
            SELECT 
                c.id, c.name, c.number, c.hp, c.types, c.subtypes, c.rules, c.images,
                c.artist, c.flavor_text, c.national_pokedex_numbers, c.attacks, c.weaknesses,
                c.resistances, c.retreat_cost, c.converted_retreat_cost, c.tcgplayer, c.cardmarket,
                c.set_id, s.name as set_name, s.series_id, s.logo as set_logo, s.symbol as set_symbol,
                se.name as series_name, se.logo as series_logo,
                r.name as rarity_name
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            LEFT JOIN rarities r ON c.rarity_id = r.id
            ${whereClause}
            ORDER BY c.name
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(pageSize, offset);

        // Query para contar total
        const countQuery = `
            SELECT COUNT(*) as total
            FROM cards c
            LEFT JOIN sets s ON c.set_id = s.id
            LEFT JOIN series se ON s.series_id = se.id
            LEFT JOIN rarities r ON c.rarity_id = r.id
            ${whereClause}
        `;

        // Ejecutar queries
        const [cardsResult, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, params.slice(0, -2))
        ]);

        // Formatear respuesta
        const cards = cardsResult.rows.map(card => {
            // Procesar imágenes
            let images = card.images;
            if (typeof images === 'string') {
                try {
                    images = JSON.parse(images);
                } catch (e) {
                    images = { small: null, large: null };
                }
            }

            // Procesar arrays
            const types = Array.isArray(card.types) ? card.types : 
                         typeof card.types === 'string' ? JSON.parse(card.types || '[]') : [];
            
            const attacks = Array.isArray(card.attacks) ? card.attacks : 
                           typeof card.attacks === 'string' ? JSON.parse(card.attacks || '[]') : [];

            return {
                id: card.id,
                name: card.name,
                number: card.number,
                hp: card.hp,
                types: types,
                subtypes: Array.isArray(card.subtypes) ? card.subtypes : [],
                rules: Array.isArray(card.rules) ? card.rules : [],
                images: images,
                artist: card.artist,
                flavorText: card.flavor_text,
                nationalPokedexNumbers: Array.isArray(card.national_pokedex_numbers) ? card.national_pokedex_numbers : [],
                attacks: attacks,
                weaknesses: Array.isArray(card.weaknesses) ? card.weaknesses : [],
                resistances: Array.isArray(card.resistances) ? card.resistances : [],
                retreatCost: Array.isArray(card.retreat_cost) ? card.retreat_cost : [],
                convertedRetreatCost: card.converted_retreat_cost,
                tcgplayer: card.tcgplayer,
                cardmarket: card.cardmarket,
                set: {
                    id: card.set_id,
                    name: card.set_name,
                    series: card.series_name,
                    logo: card.set_logo,
                    symbol: card.set_symbol
                },
                rarity: card.rarity_name
            };
        });

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / pageSize);

        res.json({
            success: true,
            data: cards,
            pagination: {
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                total: total,
                totalPages: totalPages
            }
        });

    } catch (error) {
        console.error('Error en búsqueda:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obtener precios en lote para múltiples IDs de cartas
app.get('/api/pokemontcg/cards/prices', dbReadLimiter, async (req, res) => {
    try {
        const { ids = '' } = req.query;
        const cardIds = ids.split(',').map(id => id.trim()).filter(Boolean);

        if (cardIds.length === 0) {
            return res.json({ success: true, data: {} });
        }

        const placeholders = cardIds.map((_, i) => `$${i + 1}`).join(', ');
        const result = await pool.query(
            `SELECT id, tcgplayer, cardmarket FROM cards WHERE id IN (${placeholders})`,
            cardIds
        );

        const priceMap = {};
        result.rows.forEach(row => {
            const cmPrice = row.cardmarket?.avg30 || row.cardmarket?.avg1 || row.cardmarket?.avg || null;
            const tcgPrice = row.tcgplayer?.normal?.marketPrice || row.tcgplayer?.holofoil?.marketPrice || null;
            priceMap[row.id] = { cardmarket: cmPrice, tcgplayer: tcgPrice };
        });

        res.json({ success: true, data: priceMap });
    } catch (error) {
        console.error('Error al obtener precios en lote:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener sets
app.get('/api/pokemontcg/sets', dbReadLimiter, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                s.id, s.name, s.series_id, s.logo, s.symbol,
                se.name as series_name,
                COUNT(c.id) as card_count
            FROM sets s
            LEFT JOIN series se ON s.series_id = se.id
            LEFT JOIN cards c ON s.id = c.set_id
            GROUP BY s.id, s.name, s.series_id, s.logo, s.symbol, se.name
            ORDER BY s.name
        `);

        const sets = result.rows.map(set => ({
            id: set.id,
            name: set.name,
            series: set.series_name,
            logo: set.logo,
            symbol: set.symbol,
            cardCount: parseInt(set.card_count)
        }));

        res.json({
            success: true,
            data: sets
        });

    } catch (error) {
        console.error('Error en sets:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obtener series
app.get('/api/pokemontcg/series', dbReadLimiter, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                se.id, se.name, se.logo,
                COUNT(DISTINCT s.id) as set_count,
                COUNT(c.id) as card_count
            FROM series se
            LEFT JOIN sets s ON se.id = s.series_id
            LEFT JOIN cards c ON s.id = c.set_id
            GROUP BY se.id, se.name, se.logo
            ORDER BY se.name
        `);

        const series = result.rows.map(s => ({
            id: s.id,
            name: s.name,
            logo: s.logo,
            setCount: parseInt(s.set_count),
            cardCount: parseInt(s.card_count)
        }));

        res.json({
            success: true,
            data: series
        });

    } catch (error) {
        console.error('Error en series:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Servir frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'index.html'));
});

// ── Auto-migration: create payment tables if they don't exist ─────────────────
async function initializePaymentTables() {
    const client = await pool.connect();
    try {
        await initAuthTables(client);
        await initInboxTradesTables(client);
        await initChatTables(client);
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_stripe_accounts (
                id                SERIAL PRIMARY KEY,
                firebase_uid      VARCHAR(128) NOT NULL UNIQUE,
                stripe_account_id VARCHAR(64)  NOT NULL UNIQUE,
                account_status    VARCHAR(32)  NOT NULL DEFAULT 'pending',
                charges_enabled   BOOLEAN      NOT NULL DEFAULT FALSE,
                payouts_enabled   BOOLEAN      NOT NULL DEFAULT FALSE,
                details_submitted BOOLEAN      NOT NULL DEFAULT FALSE,
                country           VARCHAR(2),
                currency          VARCHAR(3),
                created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            )
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS trade_payments (
                id                    SERIAL PRIMARY KEY,
                trade_id              VARCHAR(128) NOT NULL UNIQUE,
                buyer_firebase_uid    VARCHAR(128) NOT NULL,
                seller_firebase_uid   VARCHAR(128) NOT NULL,
                seller_stripe_account VARCHAR(64),
                payment_type          VARCHAR(16)  NOT NULL DEFAULT 'trade_protection',
                gross_amount_cents    INTEGER      NOT NULL,
                commission_cents      INTEGER      NOT NULL,
                stripe_fee_cents      INTEGER      NOT NULL DEFAULT 0,
                net_amount_cents      INTEGER      NOT NULL,
                stripe_payment_intent VARCHAR(64),
                stripe_transfer_id    VARCHAR(64),
                stripe_refund_id      VARCHAR(64),
                payment_status        VARCHAR(24)  NOT NULL DEFAULT 'pending',
                tracking_number       VARCHAR(64),
                tracking_carrier      VARCHAR(32)  DEFAULT 'Correos',
                shipping_status       VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
                notes                 TEXT,
                created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            )
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_cards (
                id              SERIAL PRIMARY KEY,
                user_id         VARCHAR(128) NOT NULL,
                card_id         VARCHAR(128) NOT NULL,
                card_name       TEXT         NOT NULL,
                image_url       TEXT,
                set_name        TEXT,
                set_id          VARCHAR(64),
                series          TEXT,
                card_number     TEXT,
                card_condition  VARCHAR(16)  NOT NULL DEFAULT 'NM',
                language        VARCHAR(32)  NOT NULL DEFAULT 'Español',
                quantity        INTEGER      NOT NULL DEFAULT 1,
                is_transferable BOOLEAN      NOT NULL DEFAULT FALSE,
                custom_price    NUMERIC(10,2),
                added_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                UNIQUE (user_id, card_id)
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_trade_payments_trade_id ON trade_payments (trade_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_trade_payments_buyer ON trade_payments (buyer_firebase_uid)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_trade_payments_seller ON trade_payments (seller_firebase_uid)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_trade_payments_status ON trade_payments (payment_status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON user_cards (user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_user_cards_card_id ON user_cards (card_id)`);

        // Migrate existing deployments: add shipping_status column if not present
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'trade_payments' AND column_name = 'shipping_status'
                ) THEN
                    ALTER TABLE trade_payments
                        ADD COLUMN shipping_status VARCHAR(16) NOT NULL DEFAULT 'PENDING';
                END IF;
            END
            $$
        `);

        // Ensure UNIQUE constraints exist on user_stripe_accounts even if the
        // table was created before these constraints were part of the schema.
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'user_stripe_accounts'::regclass
                      AND contype  = 'u'
                      AND conname  = 'user_stripe_accounts_stripe_account_id_key'
                ) THEN
                    ALTER TABLE user_stripe_accounts
                        ADD CONSTRAINT user_stripe_accounts_stripe_account_id_key
                        UNIQUE (stripe_account_id);
                END IF;
            END
            $$
        `);
        console.log('✅ Tablas de pagos listas');
    } catch (err) {
        console.error('❌ Error inicializando tablas de pagos:', err.message);
    } finally {
        client.release();
    }
}

// Iniciar servidor
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Servidor TCGtrade iniciado en puerto ${PORT}`);
    console.log(`📊 Base de datos: PostgreSQL`);
    console.log(`🌐 http://localhost:${PORT}`);
    await initializePaymentTables();
});
