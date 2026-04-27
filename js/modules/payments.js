/**
 * Payments Module
 * Frontend service for interacting with the Stripe payment backend.
 * All API calls go through the app's own server (no Stripe keys exposed here).
 */

import { showNotification } from './utils.js';
import { PAYMENT_TYPES, COMMISSION } from './constants.js';

// ── Configuration ─────────────────────────────────────────────────────────────
// The Stripe *publishable* key is safe to expose in the client.
// We fetch it lazily from /api/config so it is never hardcoded in source.
const API_BASE = '/api/stripe';

// Loaded lazily when first needed
let _stripe          = null;
let _publishableKey  = null;

/**
 * Fetch the Stripe publishable key from the server config endpoint.
 * @returns {Promise<string>}
 */
async function getPublishableKey() {
    if (_publishableKey) return _publishableKey;
    const res  = await fetch('/api/config');
    const data = await res.json();
    if (!data.stripePublishableKey) {
        throw new Error('Stripe publishable key not configured on the server.');
    }
    _publishableKey = data.stripePublishableKey;
    return _publishableKey;
}

/**
 * Load the Stripe.js library and return the Stripe instance.
 * The script is injected only once.
 * @returns {Promise<Stripe>}
 */
async function getStripe() {
    if (_stripe) return _stripe;

    if (!window.Stripe) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.onload  = resolve;
            script.onerror = () => reject(new Error('Failed to load Stripe.js'));
            document.head.appendChild(script);
        });
    }

    const key = await getPublishableKey();
    _stripe = window.Stripe(key);
    return _stripe;
}

// ── Connect account ───────────────────────────────────────────────────────────

/**
 * Check if the current user has a connected Stripe account.
 * @param {string} userId  UUID de app_users
 */
export async function checkAccountStatus(userId) {
    try {
        const res = await fetch(`${API_BASE}/account-status?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data;
    } catch (error) {
        console.error('Error checking Stripe account status:', error);
        return { connected: false, chargesEnabled: false, status: 'unknown' };
    }
}

/**
 * Start the Stripe Connect Express onboarding flow.
 * Redirects the browser to Stripe's hosted onboarding page.
 *
 * @param {string} userId
 * @param {string} email
 * @param {string} [country='ES']
 * @param {string} [tradeId='']    – Optional, to return to the correct trade
 */
export async function connectStripeAccount(userId, email, country = 'ES', tradeId = '') {
    let notificationShown = false;
    try {
        const res = await fetch(`${API_BASE}/connect/create-account`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ userId, email, country, tradeId })
        });

        const data = await res.json();
        if (!data.success) {
            if (data.connectSetupRequired) {
                showNotification(
                    'Stripe Connect no está activo en esta cuenta. ' +
                    'El administrador debe activarlo en dashboard.stripe.com/connect.',
                    'error'
                );
            } else {
                showNotification(data.error || 'Error al conectar cuenta bancaria. Intenta de nuevo.', 'error');
            }
            notificationShown = true;
            throw new Error(data.error);
        }

        // Redirect to Stripe onboarding
        window.location.href = data.onboardingUrl;

    } catch (error) {
        console.error('Error starting Stripe Connect:', error);
        // Only show a fallback notification when nothing has been shown yet
        // (e.g. a network failure before we could read the server response).
        if (!notificationShown) {
            showNotification('Error de red al conectar cuenta bancaria. Intenta de nuevo.', 'error');
        }
    }
}

/**
 * Open the Stripe Express Dashboard for an already-connected seller.
 * @param {string} userId
 */
export async function openStripeDashboard(userId) {
    try {
        const res = await fetch(`${API_BASE}/connect/dashboard-link`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ userId })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        window.open(data.dashboardUrl, '_blank', 'noopener,noreferrer');

    } catch (error) {
        console.error('Error opening Stripe dashboard:', error);
        showNotification('Error al abrir el panel de Stripe.', 'error');
    }
}

// ── Escrow payments ───────────────────────────────────────────────────────────

/**
 * Fetch the fee breakdown for a given payment type & amount.
 * Useful for showing the user an itemised cost preview before paying.
 *
 * @param {'trade_protection'|'direct_sale'} paymentType
 * @param {number} grossAmountEur
 * @returns {{ grossEur: string, commissionEur: string, netEur: string }}
 */
export function previewFees(paymentType, grossAmountEur = 0) {
    if (paymentType === PAYMENT_TYPES.TRADE_PROTECTION) {
        const gross      = COMMISSION.TRADE_PROTECTION_EUR;
        const commission = gross;
        const stripeFee  = +(gross * COMMISSION.STRIPE_PERCENT + COMMISSION.STRIPE_FIXED_EUR).toFixed(2);
        return {
            grossEur:      gross.toFixed(2),
            commissionEur: commission.toFixed(2),
            stripeFeeEur:  stripeFee.toFixed(2),
            netEur:        '0.00'  // Trade protection: seller gets nothing; it is a fee
        };
    }

    const commission = +(grossAmountEur * COMMISSION.DIRECT_SALE_PERCENT).toFixed(2);
    const stripeFee  = +(grossAmountEur * COMMISSION.STRIPE_PERCENT + COMMISSION.STRIPE_FIXED_EUR).toFixed(2);
    const net        = +(grossAmountEur - commission - stripeFee).toFixed(2);

    return {
        grossEur:      grossAmountEur.toFixed(2),
        commissionEur: commission.toFixed(2),
        stripeFeeEur:  stripeFee.toFixed(2),
        netEur:        net.toFixed(2)
    };
}

/**
 * Create a PaymentIntent on the server and mount Stripe Elements in
 * the given container element so the user can enter their card details.
 *
 * @param {object} opts
 * @param {string} opts.tradeId
 * @param {'trade_protection'|'direct_sale'} opts.paymentType
 * @param {number} opts.grossAmountEur
 * @param {string} opts.buyerUserId
 * @param {string} opts.buyerEmail
 * @param {string} opts.sellerUserId
 * @param {HTMLElement} opts.mountElement  – DOM element to mount the card form into
 * @param {Function}    opts.onSuccess     – Called when payment is confirmed
 * @param {Function}    opts.onError       – Called on payment error
 * @returns {Promise<{ elements: StripeElements, submit: Function }>}
 */
export async function initPaymentForm({
    tradeId,
    paymentType,
    grossAmountEur,
    buyerUserId,
    buyerEmail,
    sellerUserId,
    mountElement,
    onSuccess,
    onError
}) {
    try {
        // 1. Create the PaymentIntent on the server
        const res = await fetch(`${API_BASE}/payment/create-intent`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                tradeId,
                paymentType,
                grossAmountEur,
                buyerUserId,
                buyerEmail,
                sellerUserId
            })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        // 2. Mount Stripe Elements
        const stripe   = await getStripe();
        const elements = stripe.elements({ clientSecret: data.clientSecret, locale: 'es' });
        const paymentElement = elements.create('payment', {
            layout: 'tabs',
            fields: { billingDetails: { email: 'auto' } }
        });
        paymentElement.mount(mountElement);

        // 3. Return a submit function the UI can call
        const submit = async () => {
            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/?payment_success=1&trade=${tradeId}`
                },
                redirect: 'if_required'
            });

            if (error) {
                const msg = error.message || 'Error al procesar el pago.';
                showNotification(msg, 'error');
                if (onError) onError(error);
            } else {
                showNotification('¡Pago procesado correctamente! Fondos retenidos en depósito.', 'success');
                if (onSuccess) onSuccess(data);
            }
        };

        return { elements, submit, fees: data.fees };

    } catch (error) {
        console.error('Error initialising payment form:', error);
        showNotification('Error al iniciar el pago. Intenta de nuevo.', 'error');
        throw error;
    }
}

/**
 * Buyer confirms they received the cards → release escrow funds to the seller.
 *
 * @param {string} tradeId
 * @param {string} buyerUserId
 * @returns {Promise<boolean>}
 */
export async function confirmReceipt(tradeId, buyerUserId) {
    try {
        const res = await fetch(`${API_BASE}/payment/release`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ tradeId, buyerUserId })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        showNotification('¡Fondos liberados al vendedor! Intercambio completado.', 'success');
        return true;

    } catch (error) {
        console.error('Error releasing escrow:', error);
        showNotification('Error al liberar los fondos. Contacta con soporte.', 'error');
        return false;
    }
}

/**
 * Seller provides the shipment tracking number.
 *
 * @param {string} tradeId
 * @param {string} sellerUserId
 * @param {string} trackingNumber
 * @param {string} [carrier='']
 * @returns {Promise<boolean>}
 */
export async function addTracking(tradeId, sellerUserId, trackingNumber, carrier = '') {
    try {
        const res = await fetch(`${API_BASE}/payment/tracking`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ tradeId, sellerUserId, trackingNumber, carrier })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        showNotification('Número de seguimiento guardado.', 'success');
        return true;

    } catch (error) {
        console.error('Error saving tracking:', error);
        showNotification('Error al guardar el seguimiento.', 'error');
        return false;
    }
}

/**
 * Open a dispute / request a refund for a trade payment.
 *
 * @param {string} tradeId
 * @param {string} requesterUserId
 * @param {string} [reason='requested_by_customer']
 * @returns {Promise<boolean>}
 */
export async function openDispute(tradeId, requesterUserId, reason = 'requested_by_customer') {
    try {
        const res = await fetch(`${API_BASE}/payment/refund`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ tradeId, requesterUserId, reason })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        showNotification('Disputa abierta. El equipo de soporte revisará el caso.', 'info');
        return true;

    } catch (error) {
        console.error('Error opening dispute:', error);
        showNotification('Error al abrir la disputa. Contacta con soporte.', 'error');
        return false;
    }
}

/**
 * Get the current payment status for a trade.
 * @param {string} tradeId
 * @returns {Promise<object|null>}
 */
export async function getPaymentStatus(tradeId) {
    try {
        const res = await fetch(`${API_BASE}/payment/status?tradeId=${encodeURIComponent(tradeId)}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data.payment;
    } catch (error) {
        console.error('Error getting payment status:', error);
        return null;
    }
}
