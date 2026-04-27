/**
 * Stripe Connect Service
 * Handles all Stripe operations: Connect onboarding, escrow PaymentIntents,
 * fund capture / release, refunds, webhook processing, and commission maths.
 *
 * Environment variables required (see .env.example):
 *   STRIPE_SECRET_KEY        – Your Stripe secret key (sk_live_… / sk_test_…)
 *   STRIPE_WEBHOOK_SECRET    – Signing secret from the Stripe webhook dashboard
 *   APP_URL                  – Public base URL of the app (e.g. https://…)
 */

'use strict';

const Stripe = require('stripe');

// ── Stripe client ────────────────────────────────────────────────────────────
// Lazily initialised so that the module can be loaded without a key
// (e.g. during tests or when the env variable is not yet set).
let _stripe = null;

function getStripeClient() {
    if (_stripe) return _stripe;
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY environment variable is not set.');
    }
    _stripe = Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-02-24.acacia'
    });
    return _stripe;
}

// ── Commission constants ─────────────────────────────────────────────────────
const TRADE_PROTECTION_EUR   = 3.99;   // Fixed fee per trade-protection payment
const DIRECT_SALE_PERCENT    = 0.07;   // 7 % of gross for direct sales
const STRIPE_PERCENT         = 0.014;  // Stripe Connect typical EU blended rate
const STRIPE_FIXED_CENTS     = 25;     // 0.25 € in cents

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert EUR amount to cents (integer).
 * @param {number} eur
 * @returns {number}
 */
function eurToCents(eur) {
    return Math.round(eur * 100);
}

/**
 * Calculate the platform commission and estimated Stripe fee in cents.
 *
 * @param {'trade_protection'|'direct_sale'} paymentType
 * @param {number} grossAmountEur  - What the buyer pays (ignored for trade_protection)
 * @returns {{ grossCents: number, commissionCents: number, stripeFeeCents: number, netCents: number }}
 */
function calculateFees(paymentType, grossAmountEur = 0) {
    let grossCents;
    let commissionCents;

    if (paymentType === 'trade_protection') {
        // Fixed 3.99 € – the buyer pays only this amount
        grossCents       = eurToCents(TRADE_PROTECTION_EUR);
        commissionCents  = grossCents; // Full fee is platform revenue; seller gets nothing
    } else {
        // Direct sale – buyer pays the card price; platform takes 7 %
        grossCents       = eurToCents(grossAmountEur);
        commissionCents  = Math.round(grossCents * DIRECT_SALE_PERCENT);
    }

    // Stripe's processing fee (estimated): 1.4 % + 0.25 € for EU cards
    const stripeFeeCents = Math.round(grossCents * STRIPE_PERCENT) + STRIPE_FIXED_CENTS;
    const netCents       = grossCents - commissionCents - stripeFeeCents;

    return { grossCents, commissionCents, stripeFeeCents, netCents };
}

// ── Stripe Connect ────────────────────────────────────────────────────────────

/**
 * Create a new Stripe Express Connected account for a seller.
 * @param {object} opts
 * @param {string} opts.email        – User's email address
 * @param {string} opts.country      – ISO-3166-1 alpha-2 country code (e.g. 'ES')
 * @param {string} opts.userId  – app user id (UUID, stored in metadata)
 * @returns {Promise<Stripe.Account>}
 */
async function createConnectAccount({ email, country = 'ES', userId }) {
    return getStripeClient().accounts.create({
        type: 'express',
        country,
        email,
        capabilities: {
            card_payments: { requested: true },
            transfers:     { requested: true }
        },
        business_type: 'individual',
        metadata: { app_user_id: String(userId) }
    });
}

/**
 * Generate a Stripe Account Link URL so the user can complete onboarding.
 * @param {string} stripeAccountId
 * @param {string} tradeId  – Optional – used to redirect back to the right trade
 * @returns {Promise<string>}  The `url` to redirect the user to
 */
async function createAccountLink(stripeAccountId, tradeId = '') {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const link = await getStripeClient().accountLinks.create({
        account:     stripeAccountId,
        refresh_url: `${baseUrl}/api/stripe/connect/refresh?account=${stripeAccountId}`,
        return_url:  `${baseUrl}/api/stripe/connect/return?account=${stripeAccountId}&trade=${tradeId}`,
        type:        'account_onboarding'
    });
    return link.url;
}

/**
 * Retrieve a Connect account (for status checks).
 * @param {string} stripeAccountId
 * @returns {Promise<Stripe.Account>}
 */
async function retrieveAccount(stripeAccountId) {
    return getStripeClient().accounts.retrieve(stripeAccountId);
}

/**
 * Create a Stripe Login Link so the seller can access their Express Dashboard.
 * @param {string} stripeAccountId
 * @returns {Promise<string>}
 */
async function createDashboardLink(stripeAccountId) {
    const link = await getStripeClient().accounts.createLoginLink(stripeAccountId);
    return link.url;
}

// ── Escrow / PaymentIntents ───────────────────────────────────────────────────

/**
 * Create a PaymentIntent in manual capture mode (escrow).
 * The payment is authorised but NOT captured immediately. Funds are captured
 * (released to the platform) only when the trade completes.
 *
 * @param {object} opts
 * @param {string} opts.tradeId              – Firestore trade document ID
 * @param {'trade_protection'|'direct_sale'} opts.paymentType
 * @param {number} opts.grossAmountEur       – Gross amount buyer pays (EUR)
 *                                             (ignored for trade_protection)
 * @param {string} opts.sellerStripeAccount  – Seller's connected account ID
 * @param {string} opts.buyerEmail           – Buyer's email (for receipts)
 * @param {object} [opts.metadata]           – Extra metadata attached to PI
 * @returns {Promise<{ clientSecret: string, paymentIntentId: string, fees: object }>}
 */
async function createEscrowPaymentIntent({
    tradeId,
    paymentType,
    grossAmountEur,
    sellerStripeAccount,
    buyerEmail,
    metadata = {}
}) {
    const fees = calculateFees(paymentType, grossAmountEur);

    const paymentIntent = await getStripeClient().paymentIntents.create({
        amount:               fees.grossCents,
        currency:             'eur',
        capture_method:       'manual',       // Escrow: authorise only, capture later
        receipt_email:        buyerEmail,
        application_fee_amount: fees.commissionCents,  // Platform commission
        transfer_data: sellerStripeAccount
            ? { destination: sellerStripeAccount }
            : undefined,
        metadata: {
            trade_id:     tradeId,
            payment_type: paymentType,
            commission_cents:   String(fees.commissionCents),
            stripe_fee_cents:   String(fees.stripeFeeCents),
            net_cents:          String(fees.netCents),
            ...metadata
        }
    });

    return {
        clientSecret:    paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        fees
    };
}

/**
 * Capture an authorised PaymentIntent (release escrow to the platform/seller).
 * Call this when the buyer confirms receipt OR when auto-delivery is confirmed.
 *
 * @param {string} paymentIntentId
 * @returns {Promise<Stripe.PaymentIntent>}
 */
async function capturePaymentIntent(paymentIntentId) {
    return getStripeClient().paymentIntents.capture(paymentIntentId);
}

/**
 * Cancel / refund a PaymentIntent (still uncaptured → cancel; captured → refund).
 *
 * @param {string} paymentIntentId
 * @param {string} [reason]  Stripe refund reason: 'duplicate'|'fraudulent'|'requested_by_customer'
 * @returns {Promise<Stripe.PaymentIntent|Stripe.Refund>}
 */
async function refundPaymentIntent(paymentIntentId, reason = 'requested_by_customer') {
    const pi = await getStripeClient().paymentIntents.retrieve(paymentIntentId);

    if (pi.status === 'requires_capture') {
        // Still in escrow – just cancel the authorisation (no charge to buyer)
        return getStripeClient().paymentIntents.cancel(paymentIntentId, { cancellation_reason: reason });
    }

    // Already captured – issue a refund
    return getStripeClient().refunds.create({
        payment_intent: paymentIntentId,
        reason,
        metadata: { refunded_at: new Date().toISOString() }
    });
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

/**
 * Construct and validate a Stripe webhook event from a raw request.
 * MUST be called with the raw body buffer (before JSON parsing).
 *
 * @param {Buffer|string} rawBody
 * @param {string}        signature  – Value of the `Stripe-Signature` header
 * @returns {Stripe.Event}
 */
function constructWebhookEvent(rawBody, signature) {
    return getStripeClient().webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
    );
}

/**
 * Process a verified Stripe webhook event.
 * Returns an object with the action taken so the route handler can update DB.
 *
 * @param {Stripe.Event} event
 * @param {object}       db    – pg Pool (passed in to keep service stateless)
 * @returns {Promise<{ handled: boolean, action: string }>}
 */
async function handleWebhookEvent(event, db) {
    switch (event.type) {

        case 'payment_intent.amount_capturable_updated':
        case 'payment_intent.created': {
            const pi = event.data.object;
            await db.query(
                `UPDATE trade_payments
                    SET payment_status = 'requires_capture',
                        updated_at     = NOW()
                  WHERE stripe_payment_intent = $1`,
                [pi.id]
            );
            return { handled: true, action: 'payment_authorised' };
        }

        case 'payment_intent.succeeded': {
            const pi = event.data.object;
            await db.query(
                `UPDATE trade_payments
                    SET payment_status = 'transferred',
                        updated_at     = NOW()
                  WHERE stripe_payment_intent = $1`,
                [pi.id]
            );
            return { handled: true, action: 'payment_succeeded' };
        }

        case 'payment_intent.payment_failed': {
            const pi = event.data.object;
            await db.query(
                `UPDATE trade_payments
                    SET payment_status = 'cancelled',
                        notes          = $2,
                        updated_at     = NOW()
                  WHERE stripe_payment_intent = $1`,
                [pi.id, pi.last_payment_error?.message || 'Payment failed']
            );
            return { handled: true, action: 'payment_failed' };
        }

        case 'account.updated': {
            const account = event.data.object;
            await db.query(
                `UPDATE user_stripe_accounts
                    SET account_status    = $2,
                        charges_enabled   = $3,
                        payouts_enabled   = $4,
                        details_submitted = $5,
                        updated_at        = NOW()
                  WHERE stripe_account_id = $1`,
                [
                    account.id,
                    account.charges_enabled ? 'active' : 'restricted',
                    account.charges_enabled,
                    account.payouts_enabled,
                    account.details_submitted
                ]
            );
            return { handled: true, action: 'account_updated' };
        }

        case 'charge.dispute.created': {
            const dispute = event.data.object;
            // dispute.payment_intent contains the PI id
            await db.query(
                `UPDATE trade_payments
                    SET payment_status = 'disputed',
                        updated_at     = NOW()
                  WHERE stripe_payment_intent = $1`,
                [dispute.payment_intent]
            );
            return { handled: true, action: 'dispute_opened' };
        }

        default:
            return { handled: false, action: 'unhandled_event' };
    }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
    // Connect
    createConnectAccount,
    createAccountLink,
    retrieveAccount,
    createDashboardLink,
    // Escrow
    createEscrowPaymentIntent,
    capturePaymentIntent,
    refundPaymentIntent,
    // Webhooks
    constructWebhookEvent,
    handleWebhookEvent,
    // Utilities
    calculateFees,
    eurToCents
};
