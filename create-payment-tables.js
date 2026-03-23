/**
 * Payment Tables Migration
 * Creates database tables required for the Stripe Connect escrow payment system.
 *
 * Run with: node create-payment-tables.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createPaymentTables() {
    const client = await pool.connect();
    try {
        console.log('🔧 Creando tablas de pagos...');

        await client.query('BEGIN');

        // ── user_stripe_accounts ────────────────────────────────────────────────
        // Stores the Stripe Connect Express account linked to each Firebase user.
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_stripe_accounts (
                id               SERIAL PRIMARY KEY,
                firebase_uid     VARCHAR(128) NOT NULL UNIQUE,
                stripe_account_id VARCHAR(64) NOT NULL UNIQUE,
                account_status   VARCHAR(32)  NOT NULL DEFAULT 'pending',
                    -- pending | active | restricted | disabled
                charges_enabled  BOOLEAN      NOT NULL DEFAULT FALSE,
                payouts_enabled  BOOLEAN      NOT NULL DEFAULT FALSE,
                details_submitted BOOLEAN     NOT NULL DEFAULT FALSE,
                country          VARCHAR(2),
                currency         VARCHAR(3),
                created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            )
        `);

        // ── trade_payments ──────────────────────────────────────────────────────
        // One payment record per trade that uses the protection / escrow feature.
        await client.query(`
            CREATE TABLE IF NOT EXISTS trade_payments (
                id                    SERIAL PRIMARY KEY,
                trade_id              VARCHAR(128) NOT NULL UNIQUE,
                    -- Firestore trade document ID
                buyer_firebase_uid    VARCHAR(128) NOT NULL,
                seller_firebase_uid   VARCHAR(128) NOT NULL,
                seller_stripe_account VARCHAR(64),
                    -- Stripe Connect account of the receiving party

                payment_type          VARCHAR(16) NOT NULL DEFAULT 'trade_protection',
                    -- trade_protection | direct_sale

                -- Amounts in *cents* (EUR)
                gross_amount_cents    INTEGER     NOT NULL,
                    -- Amount charged to buyer
                commission_cents      INTEGER     NOT NULL,
                    -- Platform fee (3.99 EUR fixed, or 7 % of gross)
                stripe_fee_cents      INTEGER     NOT NULL DEFAULT 0,
                    -- Stripe processing fee (estimated at capture time)
                net_amount_cents      INTEGER     NOT NULL,
                    -- Amount to be transferred to seller after fees

                stripe_payment_intent VARCHAR(64),
                stripe_transfer_id    VARCHAR(64),
                stripe_refund_id      VARCHAR(64),

                payment_status        VARCHAR(24) NOT NULL DEFAULT 'pending',
                    -- pending | requires_payment_method | requires_confirmation
                    -- | requires_capture | captured | transferred
                    -- | refunded | disputed | cancelled

                tracking_number       VARCHAR(64),
                tracking_carrier      VARCHAR(32),

                notes                 TEXT,
                created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        // ── Indexes ─────────────────────────────────────────────────────────────
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_trade_payments_trade_id
                ON trade_payments (trade_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_trade_payments_buyer
                ON trade_payments (buyer_firebase_uid)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_trade_payments_seller
                ON trade_payments (seller_firebase_uid)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_trade_payments_status
                ON trade_payments (payment_status)
        `);

        await client.query('COMMIT');

        console.log('✅ Tablas de pagos creadas correctamente:');
        console.log('   • user_stripe_accounts');
        console.log('   • trade_payments');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error creando tablas de pagos:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

createPaymentTables();
