// Depuración del chat (API del VPS, sin Firebase)

export class ChatDebugger {
    constructor(chatManager) {
        this.chatManager = chatManager;
        window.chatDebug = this;
    }

    async testApiConnection() {
        if (typeof window.authFetch !== 'function') {
            console.error('authFetch no disponible');
            return false;
        }
        try {
            const r = await window.authFetch('/api/chats');
            const j = await r.json().catch(() => ({}));
            console.log('GET /api/chats', r.status, j.success);
            return r.ok;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    async verifyChatAccess(tradeId) {
        const clean = String(tradeId || '').replace(/^trade_+/i, '');
        const chatId = `trade_${clean}`;
        console.log('Verificando acceso a', chatId);
        if (typeof window.authFetch !== 'function') return false;
        const r = await window.authFetch(
            `/api/chats/${encodeURIComponent(chatId)}/messages?limit=1`
        );
        const j = await r.json().catch(() => ({}));
        console.log('Mensajes:', r.status, j);
        return r.ok;
    }

    async sendTestMessage(tradeId, message = 'Mensaje de prueba') {
        const clean = String(tradeId || '').replace(/^trade_+/i, '');
        const chatId = `trade_${clean}`;
        try {
            return await this.chatManager.sendMessage(chatId, message);
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    async listenToChat(tradeId) {
        const clean = String(tradeId || '').replace(/^trade_+/i, '');
        const chatId = `trade_${clean}`;
        this._listenTimer = setInterval(async () => {
            const r = await window.authFetch(
                `/api/chats/${encodeURIComponent(chatId)}/messages?limit=20`
            );
            const j = await r.json().catch(() => ({}));
            if (j.success && j.data) {
                console.log('poll messages', j.data.length);
            }
        }, 3000);
    }

    checkUserStatus() {
        const u = this.chatManager.getCurrentUserId?.() || this.chatManager.auth?.currentUser;
        console.log('Usuario (API id):', u);
        return u;
    }

    async listUserChats() {
        return this.chatManager.getUserChats();
    }

    async runFullDiagnostic(tradeId) {
        console.log('Diagnóstico chat (VPS API)');
        this.checkUserStatus();
        await this.testApiConnection();
        if (tradeId) {
            await this.verifyChatAccess(tradeId);
        }
        await this.listUserChats();
    }
}

window.ChatDebugger = ChatDebugger;
