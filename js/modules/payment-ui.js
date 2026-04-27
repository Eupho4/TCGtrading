/**
 * Payment UI Module
 * Renders all payment-related interface components.
 * Fully responsive / mobile-first using the project's Tailwind CSS classes.
 */

import {
    checkAccountStatus,
    connectStripeAccount,
    openStripeDashboard,
    initPaymentForm,
    confirmReceipt,
    addTracking,
    openDispute,
    getPaymentStatus,
    previewFees
} from './payments.js';

import { showNotification } from './utils.js';
import { TRADE_STATUS, PAYMENT_TYPES } from './constants.js';

// ── Connect-account banner ────────────────────────────────────────────────────

/**
 * Render a "connect your bank account" banner into `container`.
 * If the user already has an active account, shows a "Manage" button instead.
 *
 * @param {HTMLElement} container
 * @param {object}      user       – { uid, email, displayName? }
 */
export async function renderConnectAccountBanner(container, user) {
    if (!container || !user) return;

    const status = await checkAccountStatus(user.uid);

    if (status.connected && status.chargesEnabled) {
        container.innerHTML = `
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between
                        gap-3 p-4 bg-green-50 dark:bg-green-900/20
                        border border-green-200 dark:border-green-700 rounded-xl">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">✅</span>
                    <div>
                        <p class="font-semibold text-green-800 dark:text-green-300 text-sm">
                            Cuenta bancaria conectada
                        </p>
                        <p class="text-xs text-green-600 dark:text-green-400">
                            Puedes recibir pagos de tus intercambios
                        </p>
                    </div>
                </div>
                <button id="stripeManageBtn"
                        class="w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-lg
                               bg-green-600 hover:bg-green-700 text-white transition-colors">
                    Gestionar cuenta
                </button>
            </div>`;

        container.querySelector('#stripeManageBtn')
            .addEventListener('click', () => openStripeDashboard(user.uid));

    } else {
        const isPending = status.connected && !status.chargesEnabled;

        container.innerHTML = `
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between
                        gap-3 p-4 bg-blue-50 dark:bg-blue-900/20
                        border border-blue-200 dark:border-blue-700 rounded-xl">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">${isPending ? '⏳' : '🏦'}</span>
                    <div>
                        <p class="font-semibold text-blue-800 dark:text-blue-300 text-sm">
                            ${isPending
                                ? 'Verificación pendiente'
                                : 'Conecta tu cuenta bancaria'}
                        </p>
                        <p class="text-xs text-blue-600 dark:text-blue-400">
                            ${isPending
                                ? 'Completa la verificación de Stripe para recibir pagos'
                                : 'Necesaria para recibir el dinero de tus ventas e intercambios'}
                        </p>
                    </div>
                </div>
                <button id="stripeConnectBtn"
                        class="w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-lg
                               bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                    ${isPending ? 'Completar verificación' : 'Conectar con Stripe'}
                </button>
            </div>`;

        container.querySelector('#stripeConnectBtn')
            .addEventListener('click', () =>
                connectStripeAccount(user.uid, user.email)
            );
    }
}

// ── Fee preview ───────────────────────────────────────────────────────────────

/**
 * Render an itemised fee breakdown inside `container`.
 *
 * @param {HTMLElement} container
 * @param {'trade_protection'|'direct_sale'} paymentType
 * @param {number} grossAmountEur
 */
export function renderFeePreview(container, paymentType, grossAmountEur = 0) {
    if (!container) return;

    const fees = previewFees(paymentType, grossAmountEur);
    const isProtection = paymentType === PAYMENT_TYPES.TRADE_PROTECTION;

    container.innerHTML = `
        <div class="rounded-xl border border-gray-200 dark:border-gray-700
                    bg-white dark:bg-gray-800 overflow-hidden text-sm">
            <div class="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 font-semibold
                        text-gray-700 dark:text-gray-300">
                ${isProtection ? '🛡️ Protección de intercambio' : '💰 Venta directa'}
            </div>
            <div class="divide-y divide-gray-100 dark:divide-gray-700">
                <div class="flex justify-between px-4 py-2 text-gray-600 dark:text-gray-400">
                    <span>${isProtection ? 'Tarifa de protección' : 'Precio de venta'}</span>
                    <span class="font-medium text-gray-900 dark:text-white">
                        ${fees.grossEur} €
                    </span>
                </div>
                <div class="flex justify-between px-4 py-2 text-gray-600 dark:text-gray-400">
                    <span>Comisión plataforma
                        ${isProtection ? '(fija)' : '(7 %)'}
                    </span>
                    <span class="text-red-500">− ${fees.commissionEur} €</span>
                </div>
                <div class="flex justify-between px-4 py-2 text-gray-600 dark:text-gray-400">
                    <span>Tasas de procesamiento (Stripe)</span>
                    <span class="text-red-500">− ${fees.stripeFeeEur} €</span>
                </div>
                ${!isProtection ? `
                <div class="flex justify-between px-4 py-2 font-semibold
                            text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/50">
                    <span>Recibes</span>
                    <span class="text-green-600 dark:text-green-400">${fees.netEur} €</span>
                </div>` : ''}
            </div>
        </div>`;
}

// ── Payment modal ─────────────────────────────────────────────────────────────

/**
 * Open a full-screen responsive modal containing the Stripe payment form.
 *
 * @param {object} opts
 * @param {string} opts.tradeId
 * @param {'trade_protection'|'direct_sale'} opts.paymentType
 * @param {number} opts.grossAmountEur
 * @param {object} opts.buyer               – { uid, email }
 * @param {string} opts.sellerUserId
 * @param {Function} [opts.onSuccess]
 */
export async function openPaymentModal({
    tradeId,
    paymentType = PAYMENT_TYPES.TRADE_PROTECTION,
    grossAmountEur = 0,
    buyer,
    sellerUserId,
    onSuccess
}) {
    // Remove any stale modal
    document.getElementById('paymentModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'paymentModal';
    modal.className = `
        fixed inset-0 z-50 flex items-end sm:items-center justify-center
        bg-black/60 backdrop-blur-sm p-0 sm:p-4`;

    modal.innerHTML = `
        <div class="relative w-full sm:max-w-md max-h-[95dvh] overflow-y-auto
                    bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl
                    flex flex-col">

            <!-- Header -->
            <div class="sticky top-0 z-10 flex items-center justify-between
                        px-5 py-4 border-b border-gray-200 dark:border-gray-700
                        bg-white dark:bg-gray-900">
                <h2 class="text-lg font-bold text-gray-900 dark:text-white">
                    Pago seguro
                </h2>
                <button id="closePaymentModal"
                        aria-label="Cerrar"
                        class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800
                               text-gray-500 dark:text-gray-400 transition-colors">
                    ✕
                </button>
            </div>

            <!-- Body -->
            <div class="flex-1 px-5 py-4 space-y-5">

                <!-- Fee preview -->
                <div id="feePreviewContainer"></div>

                <!-- Stripe Elements will be mounted here -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Método de pago
                    </label>
                    <div id="stripePaymentElement"
                         class="p-3 border border-gray-200 dark:border-gray-700
                                rounded-xl min-h-[120px]">
                        <div class="flex items-center justify-center h-24 text-gray-400 text-sm">
                            <svg class="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none">
                                <circle class="opacity-25" cx="12" cy="12" r="10"
                                        stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor"
                                      d="M4 12a8 8 0 018-8v8H4z"></path>
                            </svg>
                            Cargando formulario de pago…
                        </div>
                    </div>
                </div>

                <!-- Security notice -->
                <p class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>🔒</span>
                    Pago seguro procesado por Stripe. Tus datos no se almacenan en nuestros servidores.
                </p>
            </div>

            <!-- Footer / Submit -->
            <div class="sticky bottom-0 z-10 px-5 py-4 bg-white dark:bg-gray-900
                        border-t border-gray-200 dark:border-gray-700">
                <button id="submitPaymentBtn"
                        disabled
                        class="w-full py-3.5 px-6 rounded-xl font-semibold text-white
                               bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                               disabled:cursor-not-allowed transition-colors text-base
                               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                    Confirmar pago
                </button>
            </div>
        </div>`;

    document.body.appendChild(modal);

    // Close handlers
    const close = () => modal.remove();
    modal.querySelector('#closePaymentModal').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    // Render fee preview
    renderFeePreview(
        modal.querySelector('#feePreviewContainer'),
        paymentType,
        grossAmountEur
    );

    // Init Stripe form
    try {
        const mountEl = modal.querySelector('#stripePaymentElement');
        const { submit } = await initPaymentForm({
            tradeId,
            paymentType,
            grossAmountEur,
            buyerUserId:  buyer.uid,
            buyerEmail:   buyer.email,
            sellerUserId,
            mountElement: mountEl,
            onSuccess: (data) => {
                close();
                showNotification('¡Pago procesado! Fondos en depósito.', 'success');
                if (onSuccess) onSuccess(data);
            },
            onError: () => {}
        });

        const submitBtn = modal.querySelector('#submitPaymentBtn');
        submitBtn.disabled = false;
        submitBtn.addEventListener('click', async () => {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Procesando…';
            await submit();
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirmar pago';
        });

    } catch {
        modal.querySelector('#stripePaymentElement').innerHTML = `
            <p class="text-red-500 text-sm text-center py-4">
                Error al cargar el formulario de pago. Intenta de nuevo.
            </p>`;
    }
}

// ── Trade payment status panel ────────────────────────────────────────────────

/**
 * Render the payment / escrow status panel for an active trade.
 *
 * @param {HTMLElement} container
 * @param {object}      trade      – { id, status, buyerUid, sellerUid }
 * @param {object}      currentUser – { uid }
 */
export async function renderTradePaymentPanel(container, trade, currentUser) {
    if (!container) return;

    const payment = await getPaymentStatus(trade.id);

    if (!payment) {
        container.innerHTML = '';
        return;
    }

    const isBuyer  = currentUser.uid === trade.buyerUid;
    const isSeller = currentUser.uid === trade.sellerUid;

    const statusConfig = {
        pending:           { icon: '⏳', label: 'Pago pendiente',     color: 'yellow' },
        requires_capture:  { icon: '🔒', label: 'Fondos retenidos',   color: 'blue'   },
        transferred:       { icon: '✅', label: 'Pago completado',    color: 'green'  },
        refunded:          { icon: '↩️', label: 'Reembolsado',        color: 'gray'   },
        cancelled:         { icon: '❌', label: 'Pago cancelado',     color: 'red'    },
        disputed:          { icon: '⚠️', label: 'En disputa',         color: 'orange' }
    };

    const cfg  = statusConfig[payment.status] || { icon: '❓', label: payment.status, color: 'gray' };
    const col  = cfg.color;

    // Color map for Tailwind (must be full class names for purge safety)
    const colorClasses = {
        yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300',
        blue:   'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700 text-blue-700 dark:text-blue-300',
        green:  'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700 text-green-700 dark:text-green-300',
        gray:   'bg-gray-50 border-gray-200 dark:bg-gray-700/20 dark:border-gray-600 text-gray-700 dark:text-gray-300',
        red:    'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700 text-red-700 dark:text-red-300',
        orange: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700 text-orange-700 dark:text-orange-300'
    };

    const showRelease = isBuyer  && payment.status === 'requires_capture';
    const showDispute = isBuyer  && ['requires_capture'].includes(payment.status);
    const showTracking = isSeller && payment.status === 'requires_capture' && !payment.trackingNumber;

    container.innerHTML = `
        <div class="rounded-xl border p-4 space-y-4 ${colorClasses[col]}">
            <!-- Status header -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 font-semibold text-sm">
                    <span>${cfg.icon}</span>
                    <span>${cfg.label}</span>
                </div>
                <span class="text-xs opacity-70">
                    ${new Date(payment.updatedAt).toLocaleDateString('es-ES')}
                </span>
            </div>

            <!-- Amount breakdown -->
            <div class="grid grid-cols-2 gap-2 text-xs bg-white/50 dark:bg-black/20
                        rounded-lg p-3">
                <span class="text-gray-600 dark:text-gray-400">Importe</span>
                <span class="text-right font-medium">${payment.grossEur} €</span>
                <span class="text-gray-600 dark:text-gray-400">Comisión</span>
                <span class="text-right text-red-500">− ${payment.commissionEur} €</span>
                ${payment.paymentType === 'direct_sale' ? `
                <span class="text-gray-600 dark:text-gray-400 font-semibold">Recibe vendedor</span>
                <span class="text-right font-semibold text-green-600 dark:text-green-400">
                    ${payment.netEur} €
                </span>` : ''}
            </div>

            <!-- Tracking info (if present) -->
            ${payment.trackingNumber ? `
            <div class="flex flex-col gap-2 text-xs bg-white/50 dark:bg-black/20
                        rounded-lg px-3 py-2">
                <div class="flex items-center gap-2">
                    <span>📦</span>
                    <span>Seguimiento:
                        <strong>${payment.trackingNumber}</strong>
                        ${payment.carrier ? `(${payment.carrier})` : ''}
                    </span>
                </div>
                ${(isBuyer && payment.carrier === 'Correos') ? `
                <a href="${payment.trackingUrl}"
                   target="_blank" rel="noopener noreferrer"
                   class="inline-flex items-center gap-1.5 text-xs font-medium
                          text-blue-600 dark:text-blue-400 hover:underline">
                    🔗 Rastrear envío en Correos
                </a>` : ''}
            </div>` : ''}

            <!-- Action buttons -->
            <div class="flex flex-col sm:flex-row gap-2">

                ${showRelease ? `
                <button id="releaseEscrowBtn"
                        class="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold
                               bg-green-600 hover:bg-green-700 text-white transition-colors
                               focus:outline-none focus:ring-2 focus:ring-green-500">
                    ✅ Confirmar recepción
                </button>` : ''}

                ${showDispute ? `
                <button id="openDisputeBtn"
                        class="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium
                               border border-red-300 dark:border-red-700
                               text-red-600 dark:text-red-400
                               hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors
                               focus:outline-none focus:ring-2 focus:ring-red-500">
                    ⚠️ Reportar problema
                </button>` : ''}

                ${showTracking ? `
                <button id="addTrackingBtn"
                        class="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium
                               bg-blue-600 hover:bg-blue-700 text-white transition-colors
                               focus:outline-none focus:ring-2 focus:ring-blue-500">
                    📦 Añadir seguimiento
                </button>` : ''}
            </div>
        </div>`;

    // Wire up button actions
    container.querySelector('#releaseEscrowBtn')
        ?.addEventListener('click', async () => {
            if (confirm('¿Confirmas que has recibido las cartas en buen estado?')) {
                await confirmReceipt(trade.id, currentUser.uid);
                renderTradePaymentPanel(container, trade, currentUser);
            }
        });

    container.querySelector('#openDisputeBtn')
        ?.addEventListener('click', async () => {
            if (confirm('¿Deseas abrir una disputa? El equipo de soporte revisará el caso.')) {
                await openDispute(trade.id, currentUser.uid);
                renderTradePaymentPanel(container, trade, currentUser);
            }
        });

    container.querySelector('#addTrackingBtn')
        ?.addEventListener('click', () => openTrackingModal(trade.id, currentUser.uid, container, trade));
}

// ── Tracking modal ────────────────────────────────────────────────────────────

/**
 * Open a small modal for the seller to enter a shipment tracking number.
 */
function openTrackingModal(tradeId, sellerUserId, panelContainer, trade) {
    document.getElementById('trackingModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'trackingModal';
    modal.className = `
        fixed inset-0 z-50 flex items-end sm:items-center justify-center
        bg-black/60 backdrop-blur-sm p-0 sm:p-4`;

    modal.innerHTML = `
        <div class="w-full sm:max-w-sm bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl
                    flex flex-col">
            <div class="flex items-center justify-between px-5 py-4
                        border-b border-gray-200 dark:border-gray-700">
                <h3 class="font-bold text-gray-900 dark:text-white">Número de seguimiento</h3>
                <button id="closeTrackingModal"
                        class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800
                               text-gray-500 dark:text-gray-400">✕</button>
            </div>
            <div class="px-5 py-5 space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Número de tracking <span class="text-red-500">*</span>
                    </label>
                    <input id="trackingNumberInput" type="text" placeholder="Ej: ES123456789ES"
                           class="w-full px-3 py-2.5 rounded-lg border border-gray-300
                                  dark:border-gray-600 bg-white dark:bg-gray-800
                                  text-gray-900 dark:text-white text-sm
                                  focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <p id="trackingFormatHint" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Formato Correos: 2 letras + 9 números + 2 letras (ej: ES123456789ES)
                    </p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Transportista
                    </label>
                    <select id="carrierSelect"
                            class="w-full px-3 py-2.5 rounded-lg border border-gray-300
                                   dark:border-gray-600 bg-white dark:bg-gray-800
                                   text-gray-900 dark:text-white text-sm
                                   focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="Correos" selected>Correos</option>
                        <option value="SEUR">SEUR</option>
                        <option value="MRW">MRW</option>
                        <option value="GLS">GLS</option>
                        <option value="DHL">DHL</option>
                        <option value="UPS">UPS</option>
                        <option value="FedEx">FedEx</option>
                        <option value="Other">Otro</option>
                    </select>
                </div>
            </div>
            <div class="px-5 pb-5">
                <button id="saveTrackingBtn"
                        class="w-full py-3 rounded-xl font-semibold text-white
                               bg-blue-600 hover:bg-blue-700 transition-colors text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500">
                    Guardar y notificar
                </button>
            </div>
        </div>`;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#closeTrackingModal').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    // Show/hide the Correos format hint based on carrier selection
    const carrierSelect = modal.querySelector('#carrierSelect');
    const formatHint    = modal.querySelector('#trackingFormatHint');
    carrierSelect.addEventListener('change', () => {
        formatHint.style.display = carrierSelect.value === 'Correos' ? '' : 'none';
    });

    modal.querySelector('#saveTrackingBtn').addEventListener('click', async () => {
        const trackingNumber = modal.querySelector('#trackingNumberInput').value.trim();
        const carrier        = modal.querySelector('#carrierSelect').value;

        if (!trackingNumber) {
            showNotification('Introduce el número de seguimiento.', 'error');
            return;
        }

        // Client-side Correos format validation
        if (carrier === 'Correos' && !/^[A-Za-z]{2}\d{9}[A-Za-z]{2}$/.test(trackingNumber)) {
            showNotification('Formato inválido. Correos: 2 letras + 9 números + 2 letras (ej: ES123456789ES)', 'error');
            return;
        }

        const ok = await addTracking(tradeId, sellerUserId, trackingNumber, carrier);
        if (ok) {
            close();
            // Refresh the panel
            const currentUser = { uid: sellerUserId };
            renderTradePaymentPanel(panelContainer, trade, currentUser);
        }
    });
}
