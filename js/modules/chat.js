/**
 * Chat — almacenamiento en PostgreSQL vía API del VPS (sin Firebase Realtime DB).
 * Requiere sesión JWT (__useApiAuth + token en localStorage).
 */

class ChatManager {
    constructor(auth, _db) {
        this.auth = auth;
        this.db = _db;
        this.activeChats = new Map();
        this.chatListeners = new Map();
        this.messagePollTimers = new Map();
        this.typingPollTimers = new Map();
        this.unreadCounts = new Map();
        this.currentChatId = null;
        this.typingTimeouts = new Map();
        this.globalChatListener = null;
        this.globalPollTimer = null;

        this._lastMessageSig = new Map();

        if (this.auth && typeof this.auth.onAuthStateChanged === 'function') {
            this.auth.onAuthStateChanged((user) => {
                if (user && this.useApi()) {
                    this.startGlobalChatMonitoring();
                } else {
                    this.stopGlobalChatMonitoring();
                }
            });
        }
    }

    useApi() {
        try {
            return (
                typeof window !== 'undefined' &&
                !!window.__useApiAuth &&
                typeof window.getAuthToken === 'function' &&
                !!window.getAuthToken()
            );
        } catch {
            return false;
        }
    }

    async apiFetch(path, init = {}) {
        if (typeof window.authFetch === 'function') {
            return window.authFetch(path, init);
        }
        const t = window.getAuthToken && window.getAuthToken();
        const h = { ...(init.headers || {}), Accept: 'application/json' };
        if (t) h.Authorization = 'Bearer ' + t;
        return fetch(path, { ...init, headers: h });
    }

    getCurrentUserId() {
        try {
            const fromStorage = localStorage.getItem('tcgtrade_api_user_id');
            if (fromStorage) return fromStorage;
        } catch (_) {}
        return this.auth?.currentUser?.uid || null;
    }

    generateChatId(userId1, userId2) {
        const sortedIds = [userId1, userId2].sort();
        return `chat_${sortedIds[0]}_${sortedIds[1]}`;
    }

    generateTradeChatId(tradeId) {
        const clean = String(tradeId || '').replace(/^trade_+/i, '');
        return `trade_${clean}`;
    }

    async initializeTradeChat(tradeId, otherUserId, otherUserName = 'Usuario') {
        if (!this.useApi()) {
            console.warn('Chat: se requiere autenticación API (JWT) para el chat.');
            return this.generateTradeChatId(tradeId);
        }
        const body = {
            tradeId: String(tradeId || '').replace(/^trade_+/i, ''),
            otherUserId: otherUserId || null,
            otherUserName: otherUserName
        };
        const r = await this.apiFetch('/api/chats/initialize-trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.success || !j.chatId) {
            throw new Error(j.error || 'No se pudo iniciar el chat');
        }
        return j.chatId;
    }

    setupPresence(chatId, _userId) {
        if (!this.useApi()) return;
        this.apiFetch(`/api/chats/${encodeURIComponent(chatId)}/presence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ online: true })
        }).catch(() => {});
    }

    async sendMessage(chatId, message, messageType = 'text') {
        if (!this.useApi()) throw new Error('Chat no disponible sin sesión API');
        const r = await this.apiFetch(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, type: messageType })
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.success) {
            throw new Error(j.error || 'Error al enviar');
        }
        window.dispatchEvent(new CustomEvent('chatRestored', { detail: { chatId } }));
        return j.id;
    }

    async sendCardOffer(chatId, cardData) {
        const payload = {
            text: `Ofrezco: ${cardData.name}`,
            cardId: cardData.id,
            cardName: cardData.name,
            cardImage: cardData.imageUrl,
            cardSet: cardData.set
        };
        return this.sendMessage(chatId, JSON.stringify(payload), 'card_offer');
    }

    async getOtherUserId(chatId) {
        const chats = await this.getUserChats();
        const c = chats.find((x) => x.id === chatId);
        return c?.otherUser?.uid || null;
    }

    async notifyOtherUser() {
        /* El servidor marca has_unread en el otro participante */
    }

    async markMessagesAsRead(chatId) {
        if (!this.useApi()) return;
        await this.apiFetch(`/api/chats/${encodeURIComponent(chatId)}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        this.resetUnreadCount(chatId);
    }

    _normalizeMessages(raw) {
        const list = Array.isArray(raw) ? raw : [];
        return list.map((m) => ({
            id: m.id,
            senderId: m.senderId,
            senderEmail: m.senderEmail,
            senderName: m.senderName,
            message: m.message,
            type: m.type || 'text',
            timestamp: typeof m.timestamp === 'number' ? m.timestamp : new Date(m.timestamp || 0).getTime(),
            delivered: m.delivered !== false,
            read: !!m.read
        }));
    }

    async listenToMessages(chatId, callback, limit = 50) {
        if (!this.useApi()) {
            callback([]);
            return null;
        }

        const poll = async () => {
            try {
                const r = await this.apiFetch(
                    `/api/chats/${encodeURIComponent(chatId)}/messages?limit=${encodeURIComponent(String(limit))}`
                );
                const j = await r.json().catch(() => ({}));
                if (!r.ok || !j.success) return;
                const messages = this._normalizeMessages(j.data);
                const sig = messages.map((m) => `${m.id}:${m.read}`).join('|');
                if (this._lastMessageSig.get(chatId) !== sig) {
                    this._lastMessageSig.set(chatId, sig);
                    callback(messages);
                }
            } catch (e) {
                console.warn('chat poll messages:', e);
            }
        };

        await poll();
        const t = setInterval(poll, 2500);
        this.messagePollTimers.set(chatId, t);
        this.chatListeners.set(chatId, { type: 'poll', timer: t });
        return t;
    }

    listenToTyping(chatId, userId, callback) {
        if (!this.useApi()) return null;
        const poll = async () => {
            try {
                const r = await this.apiFetch(`/api/chats/${encodeURIComponent(chatId)}/typing`);
                const j = await r.json().catch(() => ({}));
                if (!r.ok || !j.success || !j.typing) return;
                const isTyping = !!j.typing[userId];
                callback(isTyping);
            } catch (_) {}
        };
        poll();
        const t = setInterval(poll, 2000);
        this.typingPollTimers.set(`${chatId}:${userId}`, t);
        return t;
    }

    setTypingStatus(chatId, isTyping) {
        if (!this.useApi()) return;
        this.apiFetch(`/api/chats/${encodeURIComponent(chatId)}/typing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isTyping: !!isTyping })
        }).catch(() => {});

        if (isTyping) {
            if (this.typingTimeouts.has(chatId)) {
                clearTimeout(this.typingTimeouts.get(chatId));
            }
            const timeout = setTimeout(() => {
                this.apiFetch(`/api/chats/${encodeURIComponent(chatId)}/typing`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isTyping: false })
                }).catch(() => {});
                this.typingTimeouts.delete(chatId);
            }, 3000);
            this.typingTimeouts.set(chatId, timeout);
        }
    }

    async getUserChats() {
        if (!this.useApi()) {
            return [];
        }
        try {
            const r = await this.apiFetch('/api/chats');
            const j = await r.json().catch(() => ({}));
            if (!r.ok || !j.success) return [];
            const list = Array.isArray(j.data) ? j.data : [];
            list.forEach((c) => {
                if (c.unreadCount > 0) {
                    this.unreadCounts.set(c.id, c.unreadCount);
                }
            });
            return list;
        } catch (e) {
            console.error('Error al obtener chats:', e);
            return [];
        }
    }

    incrementUnreadCount(chatId, senderId) {
        const me = this.getCurrentUserId();
        if (!me || senderId === me) return;
        const n = (this.unreadCounts.get(chatId) || 0) + 1;
        this.unreadCounts.set(chatId, n);
        window.dispatchEvent(new CustomEvent('unreadCountUpdated', { detail: { chatId, count: n } }));
    }

    resetUnreadCount(chatId) {
        this.unreadCounts.set(chatId, 0);
        window.dispatchEvent(new CustomEvent('unreadCountUpdated', { detail: { chatId, count: 0 } }));
    }

    getTotalUnreadCount() {
        let t = 0;
        this.unreadCounts.forEach((c) => (t += c));
        return t;
    }

    disconnectChat(chatId) {
        if (!chatId) return;
        const entry = this.chatListeners.get(chatId);
        if (entry && entry.timer) {
            clearInterval(entry.timer);
        } else if (typeof entry === 'function') {
            /* legacy */
        }
        this.chatListeners.delete(chatId);
        if (this.messagePollTimers.has(chatId)) {
            clearInterval(this.messagePollTimers.get(chatId));
            this.messagePollTimers.delete(chatId);
        }
        this._lastMessageSig.delete(chatId);
        for (const k of Array.from(this.typingPollTimers.keys())) {
            if (k.startsWith(chatId + ':')) {
                clearInterval(this.typingPollTimers.get(k));
                this.typingPollTimers.delete(k);
            }
        }
        if (this.typingTimeouts.has(chatId)) {
            clearTimeout(this.typingTimeouts.get(chatId));
            this.typingTimeouts.delete(chatId);
        }

        if (this.useApi()) {
            this.apiFetch(`/api/chats/${encodeURIComponent(chatId)}/presence`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ online: false })
            }).catch(() => {});
        }
    }

    async deleteChat(chatId) {
        if (!this.useApi()) throw new Error('Chat no disponible');
        const r = await this.apiFetch(`/api/chats/${encodeURIComponent(chatId)}/admin`, { method: 'DELETE' });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.success) {
            throw new Error(j.error || 'No se pudo eliminar');
        }
        this.disconnectChat(chatId);
        this.unreadCounts.delete(chatId);
        return true;
    }

    async getHiddenChats() {
        if (!this.useApi()) return [];
        try {
            const r = await this.apiFetch('/api/chats/hidden');
            const j = await r.json().catch(() => ({}));
            if (!r.ok || !j.success) return [];
            return Array.isArray(j.data) ? j.data : [];
        } catch (e) {
            console.error('getHiddenChats:', e);
            return [];
        }
    }

    async unhideChat(chatId) {
        if (!this.useApi()) throw new Error('Chat no disponible');
        const r = await this.apiFetch(`/api/chats/${encodeURIComponent(chatId)}/unhide`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.success) {
            throw new Error(j.error || 'Error');
        }
        return true;
    }

    disconnectAll() {
        this.chatListeners.forEach((_v, chatId) => {
            this.disconnectChat(chatId);
        });
        this.chatListeners.clear();
        this.typingPollTimers.forEach((t) => clearInterval(t));
        this.typingPollTimers.clear();
        this.typingTimeouts.forEach((t) => clearTimeout(t));
        this.typingTimeouts.clear();
        this.stopGlobalChatMonitoring();
    }

    async searchMessages(chatId, searchTerm) {
        if (!this.useApi()) return [];
        const r = await this.apiFetch(
            `/api/chats/${encodeURIComponent(chatId)}/messages?limit=500`
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.success) return [];
        const q = String(searchTerm || '').toLowerCase();
        return this._normalizeMessages(j.data).filter(
            (m) => m.message && String(m.message).toLowerCase().includes(q)
        );
    }

    async startGlobalChatMonitoring() {
        if (!this.useApi()) return;
        this.stopGlobalChatMonitoring();
        const tick = async () => {
            try {
                await this.getUserChats();
            } catch (_) {}
        };
        tick();
        this.globalPollTimer = setInterval(tick, 20000);
    }

    stopGlobalChatMonitoring() {
        if (this.globalPollTimer) {
            clearInterval(this.globalPollTimer);
            this.globalPollTimer = null;
        }
    }
}

window.ChatManager = ChatManager;
export default ChatManager;
