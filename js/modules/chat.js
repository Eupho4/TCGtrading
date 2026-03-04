// Módulo de Chat en Tiempo Real para TCGtrade
// Utiliza Firebase Realtime Database para mensajería instantánea

import { 
    getDatabase, 
    ref, 
    push, 
    onValue, 
    serverTimestamp, 
    query, 
    orderByChild, 
    limitToLast,
    off,
    set,
    get,
    onDisconnect,
    update,
    remove
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js';

class ChatManager {
    constructor(auth, db) {
        this.auth = auth;
        this.db = db;
        this.realtimeDb = getDatabase();
        this.activeChats = new Map();
        this.chatListeners = new Map();
        this.unreadCounts = new Map();
        this.currentChatId = null;
        this.typingTimeouts = new Map();
        this.globalChatListener = null;
        
        // Iniciar monitoreo global cuando el usuario se autentique
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                this.startGlobalChatMonitoring();
            } else {
                this.stopGlobalChatMonitoring();
            }
        });
    }

    // Generar ID único para el chat entre dos usuarios
    generateChatId(userId1, userId2) {
        const sortedIds = [userId1, userId2].sort();
        return `chat_${sortedIds[0]}_${sortedIds[1]}`;
    }

    // Generar ID para chat de intercambio específico
    generateTradeChatId(tradeId) {
        // El ID del chat es único por intercambio, así ambos usuarios acceden al mismo chat
        return `trade_${tradeId}`;
    }

    // Inicializar chat para un intercambio
    async initializeTradeChat(tradeId, otherUserId, otherUserName = 'Usuario') {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            throw new Error('Usuario no autenticado');
        }

        const chatId = this.generateTradeChatId(tradeId);
        
        // Verificar si el chat ya existe
        const chatMetaRef = ref(this.realtimeDb, `chats/${chatId}/metadata`);
        
        try {
            // Intentar obtener metadata existente
            const snapshot = await get(chatMetaRef);
            
            if (snapshot.exists()) {
                // Si existe, solo actualizar el participante actual
                const updates = {
                    [`participants/${currentUser.uid}/uid`]: currentUser.uid,
                    [`participants/${currentUser.uid}/email`]: currentUser.email,
                    [`participants/${currentUser.uid}/displayName`]: currentUser.displayName || currentUser.email.split('@')[0],
                    [`participants/${currentUser.uid}/lastSeen`]: serverTimestamp(),
                    [`participants/${currentUser.uid}/online`]: true
                };
                
                // Registrar al otro usuario si se proporcionó su ID
                if (otherUserId && otherUserId !== currentUser.uid) {
                    const existingMeta = snapshot.val();
                    if (!existingMeta?.participants?.[otherUserId]) {
                        updates[`participants/${otherUserId}/uid`] = otherUserId;
                        updates[`participants/${otherUserId}/displayName`] = otherUserName;
                        updates[`participants/${otherUserId}/online`] = false;
                        console.log('👥 Añadiendo otro usuario como participante:', otherUserId);
                    }
                }
                
                await update(chatMetaRef, updates);
                console.log('📝 Chat existente actualizado, participantes sincronizados');
                
                // Agregar a userChats de AMBOS usuarios
                const userChatRef = ref(this.realtimeDb, `userChats/${currentUser.uid}/${chatId}`);
                await set(userChatRef, {
                    timestamp: serverTimestamp(),
                    tradeId: tradeId,
                    restoredAt: serverTimestamp()
                });
                
                if (otherUserId && otherUserId !== currentUser.uid) {
                    const otherUserChatRef = ref(this.realtimeDb, `userChats/${otherUserId}/${chatId}`);
                    await set(otherUserChatRef, { timestamp: serverTimestamp(), tradeId: tradeId });
                    console.log('📬 Chat añadido a userChats del otro usuario:', otherUserId);
                }
                console.log('♻️ Chat restaurado a listas de ambos usuarios');
            } else {
                // Si no existe, crear nuevo
                // IMPORTANTE: Registrar ambos usuarios como participantes para que ambos puedan ver el chat
                const metadata = {
                    tradeId: tradeId,
                    participants: {
                        [currentUser.uid]: {
                            uid: currentUser.uid,
                            email: currentUser.email,
                            displayName: currentUser.displayName || currentUser.email.split('@')[0],
                            lastSeen: serverTimestamp(),
                            online: true
                        }
                    },
                    createdAt: serverTimestamp(),
                    lastMessage: null,
                    lastMessageTime: null,
                    // Marcar como chat de intercambio público para que cualquiera pueda unirse
                    isTradeChat: true
                };
                
                // Añadir al otro usuario como participante
                if (otherUserId && otherUserId !== currentUser.uid) {
                    metadata.participants[otherUserId] = {
                        uid: otherUserId,
                        displayName: otherUserName,
                        online: false
                    };
                    console.log('👥 Nuevo chat con ambos participantes:', currentUser.uid, otherUserId);
                }
                
                await set(chatMetaRef, metadata);
                console.log('✨ Nuevo chat de intercambio creado:', chatId);
                
                // Agregar a userChats de AMBOS usuarios
                const userChatRef = ref(this.realtimeDb, `userChats/${currentUser.uid}/${chatId}`);
                await set(userChatRef, {
                    timestamp: serverTimestamp(),
                    tradeId: tradeId
                });
                
                if (otherUserId && otherUserId !== currentUser.uid) {
                    const otherUserChatRef2 = ref(this.realtimeDb, `userChats/${otherUserId}/${chatId}`);
                    await set(otherUserChatRef2, { timestamp: serverTimestamp(), tradeId: tradeId });
                    console.log('📬 Chat añadido a userChats del otro usuario:', otherUserId);
                }
            }
        } catch (error) {
            console.error('Error al inicializar chat:', error);
            // Si hay error, intentar crear de todos modos
            const metadata = {
                tradeId: tradeId,
                participants: {
                    [currentUser.uid]: {
                        uid: currentUser.uid,
                        email: currentUser.email,
                        displayName: currentUser.displayName || currentUser.email.split('@')[0],
                        lastSeen: serverTimestamp(),
                        online: true
                    }
                },
                createdAt: serverTimestamp(),
                lastMessage: null,
                lastMessageTime: null
            };
            
            // Añadir otro usuario en fallback
            if (otherUserId && otherUserId !== currentUser.uid) {
                metadata.participants[otherUserId] = { uid: otherUserId, displayName: otherUserName, online: false };
            }
            await set(chatMetaRef, metadata);
        }
        
        // Configurar estado de presencia
        this.setupPresence(chatId, currentUser.uid);
        
        return chatId;
    }

    // Configurar estado de presencia (online/offline)
    setupPresence(chatId, userId) {
        const userStatusRef = ref(this.realtimeDb, `chats/${chatId}/metadata/participants/${userId}/online`);
        const userLastSeenRef = ref(this.realtimeDb, `chats/${chatId}/metadata/participants/${userId}/lastSeen`);
        
        // Marcar como online
        set(userStatusRef, true);
        set(userLastSeenRef, serverTimestamp());
        
        // Configurar para marcar como offline cuando se desconecte
        onDisconnect(userStatusRef).set(false);
        onDisconnect(userLastSeenRef).set(serverTimestamp());
    }

    // Enviar mensaje
    async sendMessage(chatId, message, messageType = 'text') {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            throw new Error('Usuario no autenticado');
        }

        // Primero, asegurarse de que el usuario está registrado como participante
        const chatMetaRef = ref(this.realtimeDb, `chats/${chatId}/metadata`);
        const metaSnapshot = await get(chatMetaRef);
        
        if (metaSnapshot.exists()) {
            const metadata = metaSnapshot.val();
            // Si el usuario no está en los participantes, añadirlo
            if (!metadata.participants?.[currentUser.uid]) {
                const updates = {
                    [`participants/${currentUser.uid}`]: {
                        uid: currentUser.uid,
                        email: currentUser.email,
                        displayName: currentUser.displayName || currentUser.email.split('@')[0],
                        lastSeen: serverTimestamp(),
                        online: true
                    }
                };
                await update(chatMetaRef, updates);
                console.log('👤 Usuario añadido como participante al enviar mensaje');
                
                // Agregar a userChats si no existe
                const userChatRef = ref(this.realtimeDb, `userChats/${currentUser.uid}/${chatId}`);
                await set(userChatRef, {
                    timestamp: serverTimestamp()
                });
            }
        }

        const messagesRef = ref(this.realtimeDb, `chats/${chatId}/messages`);
        const newMessage = {
            senderId: currentUser.uid,
            senderEmail: currentUser.email,
            senderName: currentUser.displayName || currentUser.email.split('@')[0],
            message: message,
            type: messageType, // 'text', 'image', 'card_offer', 'system'
            timestamp: serverTimestamp(),
            delivered: false, // Entregado
            read: false, // Leído
            readBy: {} // Quién ha leído el mensaje
        };

        // Enviar mensaje
        const messageRef = await push(messagesRef, newMessage);
        
        // Marcar como entregado inmediatamente
        setTimeout(() => {
            update(ref(this.realtimeDb, `chats/${chatId}/messages/${messageRef.key}`), {
                delivered: true
            });
        }, 100);
        
        // Actualizar último mensaje en metadata
        const otherUserId = await this.getOtherUserId(chatId);
        const metaUpdates = {
            lastMessage: message,
            lastMessageTime: serverTimestamp(),
            lastMessageSender: currentUser.uid
        };
        if (otherUserId) {
            metaUpdates[`unreadCount_${otherUserId}`] = serverTimestamp();
        }
        await update(chatMetaRef, metaUpdates);
        
        // SIEMPRE actualizar userChats cuando se envía un mensaje
        const userChatRef = ref(this.realtimeDb, `userChats/${currentUser.uid}/${chatId}`);
        await set(userChatRef, {
            timestamp: serverTimestamp(),
            lastActivity: serverTimestamp()
        });
        
        // Disparar evento para actualizar la UI
        window.dispatchEvent(new CustomEvent('chatRestored', {
            detail: { chatId }
        }));

        // Notificar al otro usuario
        this.notifyOtherUser(chatId, message);

        return messageRef.key;
    }
    
    // Obtener el ID del otro usuario en el chat
    async getOtherUserId(chatId) {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return null;
        const chatMetaRef = ref(this.realtimeDb, `chats/${chatId}/metadata/participants`);
        const snapshot = await get(chatMetaRef);
        if (snapshot.exists()) {
            const participants = snapshot.val();
            const otherUserId = Object.keys(participants).find(uid => uid !== currentUser.uid);
            return otherUserId || null;
        }
        return null;
    }
    
    // Notificar al otro usuario sobre nuevo mensaje
    async notifyOtherUser(chatId, message) {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return;
        
        const otherUserId = await this.getOtherUserId(chatId);
        if (!otherUserId) {
            console.warn('⚠️ No se encontró el otro usuario en el chat');
            return;
        }
        
        // Añadir el chat a la lista userChats del otro usuario
        const otherUserChatRef = ref(this.realtimeDb, `userChats/${otherUserId}/${chatId}`);
        await set(otherUserChatRef, {
            timestamp: serverTimestamp(),
            lastActivity: serverTimestamp(),
            hasUnread: true
        });
        
        console.log('📬 Chat añadido a lista del usuario:', otherUserId);
    }

    // Enviar notificación de carta ofrecida
    async sendCardOffer(chatId, cardData) {
        const message = {
            text: `Ofrezco: ${cardData.name}`,
            cardId: cardData.id,
            cardName: cardData.name,
            cardImage: cardData.imageUrl,
            cardSet: cardData.set
        };
        
        return await this.sendMessage(chatId, JSON.stringify(message), 'card_offer');
    }

    // Marcar mensajes como leídos
    async markMessagesAsRead(chatId) {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return;

        const messagesRef = ref(this.realtimeDb, `chats/${chatId}/messages`);
        const messagesQuery = query(messagesRef, orderByChild('timestamp'));
        
        onValue(messagesQuery, (snapshot) => {
            const updates = {};
            snapshot.forEach((childSnapshot) => {
                const message = childSnapshot.val();
                const messageKey = childSnapshot.key;
                
                // Marcar como leído si no es mi mensaje y no está leído
                if (message.senderId !== currentUser.uid) {
                    if (!message.read) {
                        updates[`${messageKey}/read`] = true;
                        updates[`${messageKey}/readBy/${currentUser.uid}`] = serverTimestamp();
                        updates[`${messageKey}/readTime`] = serverTimestamp();
                    }
                }
            });
            
            // Aplicar todas las actualizaciones de una vez
            if (Object.keys(updates).length > 0) {
                const messagesRef = ref(this.realtimeDb, `chats/${chatId}/messages`);
                update(messagesRef, updates);
            }
        }, { onlyOnce: true });

        // Resetear contador de no leídos
        this.resetUnreadCount(chatId);
        
        // Actualizar metadata del chat
        const chatMetaRef = ref(this.realtimeDb, `chats/${chatId}/metadata`);
        update(chatMetaRef, {
            [`lastRead_${currentUser.uid}`]: serverTimestamp()
        });
    }

    // Escuchar mensajes nuevos
    async listenToMessages(chatId, callback, limit = 50) {
        // Primero, asegurarse de que el usuario está registrado como participante
        const currentUser = this.auth.currentUser;
        if (currentUser) {
            const chatMetaRef = ref(this.realtimeDb, `chats/${chatId}/metadata`);
            const metaSnapshot = await get(chatMetaRef);
            
            if (metaSnapshot.exists()) {
                const metadata = metaSnapshot.val();
                // Si el usuario no está en los participantes, añadirlo
                if (!metadata.participants?.[currentUser.uid]) {
                    const updates = {
                        [`participants/${currentUser.uid}`]: {
                            uid: currentUser.uid,
                            email: currentUser.email,
                            displayName: currentUser.displayName || currentUser.email.split('@')[0],
                            lastSeen: serverTimestamp(),
                            online: true
                        }
                    };
                    await update(chatMetaRef, updates);
                    console.log('👤 Usuario añadido como participante al abrir chat');
                }
            }
        }
        
        const messagesRef = ref(this.realtimeDb, `chats/${chatId}/messages`);
        const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(limit));
        
        const listener = onValue(messagesQuery, (snapshot) => {
            const messages = [];
            snapshot.forEach((childSnapshot) => {
                messages.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            
            // Ordenar por timestamp
            messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            
            callback(messages);
        });

        // Guardar listener para poder desconectarlo después
        this.chatListeners.set(chatId, listener);
        
        return listener;
    }

    // Escuchar estado de escritura
    listenToTyping(chatId, userId, callback) {
        const typingRef = ref(this.realtimeDb, `chats/${chatId}/typing/${userId}`);
        
        const listener = onValue(typingRef, (snapshot) => {
            const isTyping = snapshot.val() || false;
            callback(isTyping);
        });

        return listener;
    }

    // Indicar que está escribiendo
    setTypingStatus(chatId, isTyping) {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return;

        const typingRef = ref(this.realtimeDb, `chats/${chatId}/typing/${currentUser.uid}`);
        set(typingRef, isTyping);

        // Auto-resetear después de 3 segundos
        if (isTyping) {
            // Cancelar timeout anterior si existe
            if (this.typingTimeouts.has(chatId)) {
                clearTimeout(this.typingTimeouts.get(chatId));
            }

            // Crear nuevo timeout
            const timeout = setTimeout(() => {
                set(typingRef, false);
                this.typingTimeouts.delete(chatId);
            }, 3000);

            this.typingTimeouts.set(chatId, timeout);
        }
    }

    // Obtener lista de chats del usuario
    async getUserChats() {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            console.log('⚠️ No hay usuario autenticado para obtener chats');
            return [];
        }

        try {
            // Primero obtener la lista de chats del usuario desde userChats
            const userChatsRef = ref(this.realtimeDb, `userChats/${currentUser.uid}`);
            const userChatsSnapshot = await get(userChatsRef);
            const userChatIds = {};
            
            if (userChatsSnapshot.exists()) {
                userChatsSnapshot.forEach((child) => {
                    userChatIds[child.key] = true;
                });
            }
            
            // console.log('📋 UserChats encontrados:', Object.keys(userChatIds));
            
            // Luego obtener los detalles de esos chats
            const chatsRef = ref(this.realtimeDb, 'chats');
            const snapshot = await get(chatsRef);
            
            const chats = [];
            
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const chatData = childSnapshot.val();
                    let chatId = childSnapshot.key;
                    
                    // Normalizar el chatId para evitar duplicados
                    const originalId = chatId;
                    if (chatId.startsWith('trade_trade_')) {
                        chatId = chatId.replace('trade_trade_', 'trade_');
                        // Saltar este chat duplicado - ya lo procesaremos con el ID correcto
                        return;
                    }
                    
                    // Incluir el chat si:
                    // 1. El usuario es participante registrado
                    // 2. Es un chat de intercambio (isTradeChat) y el usuario ha enviado mensajes
                    const isParticipant = chatData?.metadata?.participants?.[currentUser.uid];
                    const isTradeChat = chatData?.metadata?.isTradeChat;
                    
                    // Verificar si el usuario ha enviado mensajes en este chat
                    let hasUserMessages = false;
                    if (chatData?.messages) {
                        hasUserMessages = Object.values(chatData.messages).some(
                            msg => msg.senderId === currentUser.uid
                        );
                    }
                    
                    // Verificar si el chat está oculto para el usuario (en localStorage)
                    let isHidden = false;
                    try {
                        const hiddenChatsKey = `hiddenChats_${currentUser.uid}`;
                        const hiddenChats = JSON.parse(localStorage.getItem(hiddenChatsKey) || '[]');
                        isHidden = hiddenChats.includes(chatId);
                        
                        // Debug log temporal para verificar eliminación
                        if (hiddenChats.length > 0) {
                            console.log(`🔍 Chat ${chatId} - Oculto: ${isHidden}, Lista ocultos:`, hiddenChats);
                        }
                    } catch (e) {
                        console.error('Error al leer chats ocultos:', e);
                    }
                    
                    // Solo incluir chats que estén en userChats
                    const isInUserChats = userChatIds[chatId] || userChatIds[originalId];
                    
                    // CAMBIO: Solo mostrar chats que estén explícitamente en userChats Y no estén ocultos
                    if (isInUserChats && !isHidden) {
                        // Si el usuario no está registrado como participante pero ha enviado mensajes,
                        // añadirlo automáticamente
                        if (!isParticipant && hasUserMessages) {
                            const updates = {
                                [`participants/${currentUser.uid}`]: {
                                    uid: currentUser.uid,
                                    email: currentUser.email,
                                    displayName: currentUser.displayName || currentUser.email.split('@')[0],
                                    lastSeen: serverTimestamp(),
                                    online: false
                                }
                            };
                            
                            // Actualizar de forma asíncrona sin esperar
                            const chatMetaRef = ref(this.realtimeDb, `chats/${chatId}/metadata`);
                            update(chatMetaRef, updates).catch(console.error);
                        }
                        
                        // Obtener el otro participante
                        const participants = Object.values(chatData.metadata.participants || {});
                        const otherParticipant = participants.find(p => p.uid !== currentUser.uid);
                        
                        chats.push({
                            id: chatId,
                            ...chatData.metadata,
                            otherUser: otherParticipant || { displayName: 'Chat de Intercambio' },
                            unreadCount: this.unreadCounts.get(chatId) || 0
                        });
                    }
                });
                
                // Ordenar por último mensaje
                chats.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
            }
            
            // console.log(`📋 ${chats.length} chats encontrados para el usuario`);
            return chats;
            
        } catch (error) {
            console.error('❌ Error al obtener chats:', error);
            return [];
        }
    }

    // Incrementar contador de mensajes no leídos
    incrementUnreadCount(chatId, senderId) {
        const currentUser = this.auth.currentUser;
        if (!currentUser || senderId === currentUser.uid) return;

        const currentCount = this.unreadCounts.get(chatId) || 0;
        this.unreadCounts.set(chatId, currentCount + 1);
        
        // Disparar evento personalizado para actualizar UI
        window.dispatchEvent(new CustomEvent('unreadCountUpdated', {
            detail: { chatId, count: currentCount + 1 }
        }));
    }

    // Resetear contador de no leídos
    resetUnreadCount(chatId) {
        this.unreadCounts.set(chatId, 0);
        
        window.dispatchEvent(new CustomEvent('unreadCountUpdated', {
            detail: { chatId, count: 0 }
        }));
    }

    // Obtener contador total de mensajes no leídos
    getTotalUnreadCount() {
        let total = 0;
        this.unreadCounts.forEach(count => total += count);
        return total;
    }

    // Desconectar listener de un chat
    disconnectChat(chatId) {
        if (!chatId) {
            console.warn('disconnectChat llamado sin chatId');
            return;
        }
        
        const listener = this.chatListeners.get(chatId);
        if (listener) {
            try {
                off(listener);
                this.chatListeners.delete(chatId);
            } catch (error) {
                console.warn('Error al desconectar listener:', error);
            }
        }

        // Marcar como offline
        const currentUser = this.auth.currentUser;
        if (currentUser) {
            const userStatusRef = ref(this.realtimeDb, `chats/${chatId}/metadata/participants/${currentUser.uid}/online`);
            set(userStatusRef, false);
        }
    }

    // Eliminar chat completamente
    async deleteChat(chatId) {
        try {
            console.log('🗑️ Eliminando chat de Firebase:', chatId);
            console.log('📊 Estado actual:', {
                auth: this.auth?.currentUser?.uid,
                realtimeDb: !!this.realtimeDb,
                chatId: chatId
            });
            
            const currentUser = this.auth.currentUser;
            if (!currentUser) {
                throw new Error('Usuario no autenticado');
            }
            
            // Desconectar listeners primero
            console.log('🔌 Desconectando listeners...');
            this.disconnectChat(chatId);
            
            // Eliminar el chat de Firebase
            console.log('🔥 Construyendo referencia para eliminar...');
            const chatRef = ref(this.realtimeDb, `chats/${chatId}`);
            
            // Primero intentar obtener los participantes del chat
            console.log('👥 Obteniendo participantes del chat...');
            const chatSnapshot = await get(chatRef);
            const chatData = chatSnapshot.val();
            
            if (chatData && chatData.metadata && chatData.metadata.participants) {
                // Eliminar referencia en userChats para todos los participantes
                const participants = Object.keys(chatData.metadata.participants);
                console.log('👥 Participantes encontrados:', participants);
                
                for (const userId of participants) {
                    try {
                        const userChatRef = ref(this.realtimeDb, `userChats/${userId}/${chatId}`);
                        console.log(`🗑️ Eliminando referencia para usuario ${userId}`);
                        await remove(userChatRef);
                    } catch (err) {
                        console.warn(`⚠️ No se pudo eliminar referencia para ${userId}:`, err);
                    }
                }
            }
            
            // Ahora eliminar el chat completo
            console.log('🔥 Ejecutando eliminación con remove()...');
            await remove(chatRef);
            
            // Verificar que se eliminó realmente
            console.log('🔍 Verificando eliminación...');
            const checkSnapshot = await get(chatRef);
            if (checkSnapshot.exists()) {
                console.error('❌ El chat aún existe después de intentar eliminarlo');
                throw new Error('No se pudo eliminar el chat de Firebase');
            } else {
                console.log('✅ Confirmado: El chat ya no existe en Firebase');
            }
            
            // Limpiar contadores locales
            this.unreadCounts.delete(chatId);
            
            console.log('✅ Chat eliminado de Firebase exitosamente');
            return true;
        } catch (error) {
            console.error('❌ Error detallado al eliminar chat:', {
                error: error.message,
                code: error.code,
                chatId: chatId
            });
            throw error;
        }
    }
    
    // Obtener chats ocultos del usuario
    async getHiddenChats() {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            console.log('❌ Usuario no autenticado');
            return [];
        }

        try {
            // Obtener lista de IDs de chats ocultos desde localStorage
            const hiddenChatsKey = `hiddenChats_${currentUser.uid}`;
            const hiddenChatIds = JSON.parse(localStorage.getItem(hiddenChatsKey) || '[]');
            
            // Solo loguear en casos importantes
            // console.log('🔍 Buscando chats ocultos:', hiddenChatIds);
            
            if (hiddenChatIds.length === 0) {
                // console.log('🙈 No hay chats ocultos');
                return [];
            }
            
            const chatsRef = ref(this.realtimeDb, 'chats');
            const snapshot = await get(chatsRef);
            
            const hiddenChats = [];
            
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const chatData = childSnapshot.val();
                    let chatId = childSnapshot.key;
                    
                    // Normalizar el chatId para evitar duplicados
                    if (chatId.startsWith('trade_trade_')) {
                        chatId = chatId.replace('trade_trade_', 'trade_');
                        // Saltar este chat duplicado
                        return;
                    }
                    
                    // Verificar si este chat está en la lista de ocultos
                    if (hiddenChatIds.includes(chatId)) {
                        const participant = chatData?.metadata?.participants?.[currentUser.uid];
                        const isParticipant = !!participant;
                        
                        // Verificar si el usuario ha enviado mensajes
                        let hasUserMessages = false;
                        if (chatData?.messages) {
                            hasUserMessages = Object.values(chatData.messages).some(
                                msg => msg.senderId === currentUser.uid
                            );
                        }
                        
                        if (isParticipant || hasUserMessages) {
                            // Obtener el otro participante
                            const participants = Object.values(chatData.metadata.participants || {});
                            const otherParticipant = participants.find(p => p.uid !== currentUser.uid);
                            
                            hiddenChats.push({
                                id: chatId,
                                ...chatData.metadata,
                                otherUser: otherParticipant || { displayName: 'Chat de Intercambio' },
                                unreadCount: 0 // Los chats ocultos no cuentan mensajes no leídos
                            });
                        }
                    }
                });
                
                // Ordenar por último mensaje
                hiddenChats.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
            }
            
            // Devolver chats ocultos
            return hiddenChats;
            
        } catch (error) {
            console.error('❌ Error al obtener chats ocultos:', error);
            return [];
        }
    }
    
    // Mostrar un chat oculto
    async unhideChat(chatId) {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            throw new Error('Usuario no autenticado');
        }
        
        try {
            // Quitar de la lista de chats ocultos en localStorage
            const hiddenChatsKey = `hiddenChats_${currentUser.uid}`;
            let hiddenChats = JSON.parse(localStorage.getItem(hiddenChatsKey) || '[]');
            
            // Filtrar el chat que queremos restaurar
            hiddenChats = hiddenChats.filter(id => id !== chatId);
            
            // Guardar la lista actualizada
            localStorage.setItem(hiddenChatsKey, JSON.stringify(hiddenChats));
            
            console.log('✅ Chat restaurado de localStorage');
            return true;
        } catch (error) {
            console.error('❌ Error al restaurar chat:', error);
            throw error;
        }
    }
    
    // Desconectar todos los listeners
    disconnectAll() {
        this.chatListeners.forEach((listener, chatId) => {
            this.disconnectChat(chatId);
        });
        
        // Limpiar timeouts de typing
        this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
        this.typingTimeouts.clear();
    }

    // Eliminar un chat (solo para admin o participantes)
    async deleteChat(chatId) {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return;

        // Verificar que el usuario es participante
        const chatRef = ref(this.realtimeDb, `chats/${chatId}`);
        
        // En producción, deberías verificar permisos antes de eliminar
        await set(chatRef, null);
        
        // Limpiar listeners y contadores
        this.disconnectChat(chatId);
        this.unreadCounts.delete(chatId);
    }

    // Buscar mensajes en un chat
    async searchMessages(chatId, searchTerm) {
        const messagesRef = ref(this.realtimeDb, `chats/${chatId}/messages`);
        
        return new Promise((resolve) => {
            onValue(messagesRef, (snapshot) => {
                const messages = [];
                snapshot.forEach((childSnapshot) => {
                    const message = childSnapshot.val();
                    if (message.message && message.message.toLowerCase().includes(searchTerm.toLowerCase())) {
                        messages.push({
                            id: childSnapshot.key,
                            ...message
                        });
                    }
                });
                resolve(messages);
            }, { onlyOnce: true });
        });
    }
    
    // Monitorear todos los chats donde el usuario es participante
    async startGlobalChatMonitoring() {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return;
        
        console.log('🌍 Iniciando monitoreo global de chats');
        
        // Escuchar cambios en todos los chats
        const chatsRef = ref(this.realtimeDb, 'chats');
        this.globalChatListener = onValue(chatsRef, async (snapshot) => {
            if (snapshot.exists()) {
                const chats = snapshot.val();
                
                for (const [chatId, chatData] of Object.entries(chats)) {
                    // Verificar si el usuario es participante
                    if (chatData.metadata?.participants?.[currentUser.uid]) {
                        // Verificar si hay mensajes nuevos que no sean del usuario actual
                        if (chatData.metadata?.lastMessageSender && 
                            chatData.metadata.lastMessageSender !== currentUser.uid) {
                            
                            // Verificar si el chat está en userChats
                            const userChatRef = ref(this.realtimeDb, `userChats/${currentUser.uid}/${chatId}`);
                            const userChatSnapshot = await get(userChatRef);
                            
                            if (!userChatSnapshot.exists()) {
                                // Agregar el chat a userChats
                                await set(userChatRef, {
                                    timestamp: serverTimestamp(),
                                    addedFrom: 'incoming_message'
                                });
                                
                                console.log('📥 Chat agregado automáticamente:', chatId);
                                
                                // Disparar evento para actualizar UI
                                window.dispatchEvent(new CustomEvent('chatRestored', {
                                    detail: { chatId, reason: 'incoming_message' }
                                }));
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Detener monitoreo global
    stopGlobalChatMonitoring() {
        if (this.globalChatListener) {
            off(ref(this.realtimeDb, 'chats'), 'value', this.globalChatListener);
            this.globalChatListener = null;
            console.log('🛑 Monitoreo global de chats detenido');
        }
    }
}

// Exportar para uso en otros módulos
window.ChatManager = ChatManager;

export default ChatManager;