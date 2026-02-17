// Componente de UI para el Chat en Tiempo Real
// Maneja la interfaz visual del sistema de chat

class ChatUI {
    constructor(chatManager) {
        this.chatManager = chatManager;
        this.currentChatId = null;
        this.currentOtherUserId = null;
        this.isMinimized = false;
        this.activeChats = new Map(); // Almacenar chats activos
        this.minimizedChats = new Set(); // Chats minimizados
        this.createMinimizedBar(); // Crear barra de chats minimizados
        // No cargar chats aquí, se hará después de la autenticación
    }
    
    // Guardar estado de chats en localStorage
    saveChatsState() {
        try {
            if (!this.chatManager || !this.chatManager.auth || !this.chatManager.auth.currentUser) {
                console.log('⚠️ No se puede guardar estado: usuario no autenticado');
                return;
            }
            
            const chatsState = {
                activeChats: [],
                minimizedChats: [],
                timestamp: new Date().toISOString()
            };
            
            // Guardar chats activos
            this.activeChats.forEach((chatData, chatId) => {
                const chatInfo = {
                    chatId: chatId,
                    otherUserName: chatData.otherUserName,
                    tradeTitle: chatData.tradeTitle,
                    isMinimized: this.minimizedChats.has(chatId)
                };
                chatsState.activeChats.push(chatInfo);
                console.log('💾 Guardando chat:', chatInfo);
            });
            
            // Guardar en localStorage
            const userId = this.chatManager.auth.currentUser.uid;
            const key = `chatsState_${userId}`;
            localStorage.setItem(key, JSON.stringify(chatsState));
            
            console.log(`✅ Estado de chats guardado (${chatsState.activeChats.length} chats) en:`, key);
            console.log('📦 Estado guardado:', chatsState);
            
        } catch (error) {
            console.error('❌ Error al guardar estado de chats:', error);
        }
    }
    
    // Cargar chats persistidos de sesiones anteriores
    async loadPersistedChats() {
        console.log('🔄 Intentando cargar chats persistidos...');
        
        // Verificar que tenemos usuario autenticado
        if (!this.chatManager || !this.chatManager.auth || !this.chatManager.auth.currentUser) {
            console.log('⚠️ No hay usuario autenticado, no se pueden cargar chats');
            return;
        }
        
        const userId = this.chatManager.auth.currentUser.uid;
        console.log('👤 Cargando chats para usuario:', userId);
        
        const savedState = localStorage.getItem(`chatsState_${userId}`);
        
        if (!savedState) {
            console.log('📭 No hay chats guardados para este usuario');
            return;
        }
        
        try {
            const chatsState = JSON.parse(savedState);
            console.log('📂 Chats guardados encontrados:', chatsState);
            
            if (!chatsState.activeChats || chatsState.activeChats.length === 0) {
                console.log('📭 No hay chats activos guardados');
                return;
            }
            
            console.log(`📬 Restaurando ${chatsState.activeChats.length} chats...`);
            
            // Contar cuántos chats hay (minimizados o no)
            let hasChats = false;
            let minimizedCount = 0;
            
            // Restaurar cada chat
            for (const chat of chatsState.activeChats) {
                console.log('💬 Restaurando chat:', chat);
                hasChats = true;
                
                try {
                    // Recrear la ventana de chat
                    await this.openChat(chat.chatId, chat.otherUserName, chat.tradeTitle);
                    
                    // Si estaba minimizado, minimizarlo
                    if (chat.isMinimized) {
                        console.log('📥 Minimizando chat:', chat.chatId);
                        this.minimizeChat(chat.chatId);
                        minimizedCount++;
                    }
                } catch (chatError) {
                    console.error('❌ Error al restaurar chat individual:', chatError);
                }
            }
            
            // Si hay chats pero todos están minimizados (o ninguno visible), mostrar la barra
            if (hasChats && (minimizedCount > 0 || this.activeChats.size === 0)) {
                console.log('💬 Mostrando barra de chats minimizados');
                this.createMinimizedBar();
                this.updateMinimizedBar();
            }
            
            console.log('✅ Chats restaurados exitosamente');
            
        } catch (error) {
            console.error('❌ Error al parsear chats guardados:', error);
            // Limpiar estado corrupto
            localStorage.removeItem(`chatsState_${userId}`);
        }
    }

    // Crear ventana de chat flotante
    createChatWindow(chatId, otherUserName = 'Usuario', tradeTitle = '') {
        console.log('🏗️ createChatWindow llamado:', { chatId, otherUserName, tradeTitle });
        
        // Si ya existe una ventana para este chat, solo enfocarla
        if (document.getElementById(`chat-window-${chatId}`)) {
            console.log('⚠️ Ventana ya existe, enfocando...');
            this.focusChatWindow(chatId);
            return;
        }

        const chatWindow = document.createElement('div');
        chatWindow.id = `chat-window-${chatId}`;
        chatWindow.className = 'fixed bottom-4 right-4 w-96 h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl flex flex-col z-50 chat-window';
        
        chatWindow.innerHTML = `
            <!-- Header del chat -->
            <div class="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-t-lg flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="relative">
                        <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <span class="text-lg">👤</span>
                        </div>
                        <div id="online-indicator-${chatId}" class="absolute bottom-0 right-0 w-3 h-3 bg-gray-400 rounded-full border-2 border-white"></div>
                    </div>
                    <div>
                        <h3 class="font-semibold">${otherUserName}</h3>
                        <p class="text-xs opacity-90">${tradeTitle || 'Chat de intercambio'}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="window.chatUI.minimizeChat('${chatId}')" class="hover:bg-white/20 p-1 rounded">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </button>
                    <button onclick="window.chatUI.closeChat('${chatId}')" class="hover:bg-white/20 p-1 rounded">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Indicador de escribiendo -->
            <div id="typing-indicator-${chatId}" class="hidden bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                <span class="flex items-center">
                    <span class="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </span>
                    <span class="ml-2">${otherUserName} está escribiendo...</span>
                </span>
            </div>

            <!-- Área de mensajes -->
            <div id="messages-container-${chatId}" class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
                <div class="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
                    <p>Inicio de la conversación</p>
                </div>
            </div>

            <!-- Área de entrada -->
            <div class="border-t border-gray-200 dark:border-gray-700 p-4">
                <div class="flex items-end space-x-2">
                    <div class="flex-1">
                        <textarea 
                            id="message-input-${chatId}"
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-700 dark:text-white"
                            placeholder="Escribe un mensaje..."
                            rows="2"
                            maxlength="500"></textarea>
                        <div class="flex items-center justify-between mt-2">
                            <div class="flex space-x-2">
                                <button class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" title="Adjuntar imagen">
                                    📷
                                </button>
                                <button class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" title="Enviar carta">
                                    🎴
                                </button>
                                <button class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" title="Emoji">
                                    😊
                                </button>
                            </div>
                            <span id="char-count-${chatId}" class="text-xs text-gray-500">0/500</span>
                        </div>
                    </div>
                    <button 
                        id="send-btn-${chatId}"
                        onclick="window.chatUI.sendMessage('${chatId}')"
                        class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        Enviar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(chatWindow);
        console.log('✅ Ventana de chat añadida al DOM');
        
        // Configurar eventos
        this.setupChatEvents(chatId);
        
        // Guardar referencia del chat activo
        this.activeChats.set(chatId, {
            window: chatWindow,
            otherUserName: otherUserName,
            tradeTitle: tradeTitle
        });
        
        // Guardar estado en localStorage
        this.saveChatsState();

        // Animar entrada
        setTimeout(() => {
            chatWindow.style.animation = 'slideInUp 0.3s ease-out';
        }, 10);

        return chatWindow;
    }

    // Configurar eventos del chat
    setupChatEvents(chatId) {
        const messageInput = document.getElementById(`message-input-${chatId}`);
        const charCount = document.getElementById(`char-count-${chatId}`);
        const sendBtn = document.getElementById(`send-btn-${chatId}`);

        if (messageInput) {
            // Contador de caracteres
            messageInput.addEventListener('input', (e) => {
                const length = e.target.value.length;
                charCount.textContent = `${length}/500`;
                
                // Indicar que está escribiendo
                if (length > 0) {
                    this.chatManager.setTypingStatus(chatId, true);
                } else {
                    this.chatManager.setTypingStatus(chatId, false);
                }
            });

            // Enviar con Enter (sin Shift)
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage(chatId);
                }
            });

            // Auto-resize del textarea
            messageInput.addEventListener('input', (e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            });
        }
    }

    // Enviar mensaje
    async sendMessage(chatId) {
        const messageInput = document.getElementById(`message-input-${chatId}`);
        const sendBtn = document.getElementById(`send-btn-${chatId}`);
        
        if (!messageInput || !messageInput.value.trim()) return;

        const message = messageInput.value.trim();
        
        // Deshabilitar mientras se envía
        messageInput.disabled = true;
        sendBtn.disabled = true;

        try {
            await this.chatManager.sendMessage(chatId, message);
            messageInput.value = '';
            messageInput.style.height = 'auto';
            document.getElementById(`char-count-${chatId}`).textContent = '0/500';
            
            // Dejar de mostrar "escribiendo"
            this.chatManager.setTypingStatus(chatId, false);
            
            // Actualizar badge de chats
            await this.updateChatBadge();
        } catch (error) {
            console.error('Error al enviar mensaje:', error);
            this.showNotification('Error al enviar el mensaje', 'error');
        } finally {
            messageInput.disabled = false;
            sendBtn.disabled = false;
            messageInput.focus();
        }
    }

    // Mostrar mensajes en el chat
    displayMessages(chatId, messages) {
        const container = document.getElementById(`messages-container-${chatId}`);
        if (!container) return;

        const currentUser = this.chatManager.auth.currentUser;
        if (!currentUser) return;

        // Guardar el último mensaje para detectar nuevos
        const lastMessageId = this.lastMessageIds?.get(chatId);
        const newMessages = messages.filter(msg => !this.processedMessages?.has(msg.id));
        
        // Inicializar sets si no existen
        if (!this.processedMessages) this.processedMessages = new Set();
        if (!this.lastMessageIds) this.lastMessageIds = new Map();

        // Limpiar y reconstruir mensajes
        container.innerHTML = messages.length === 0 ? 
            '<div class="text-center text-gray-500 dark:text-gray-400 text-sm py-8"><p>Inicio de la conversación</p></div>' : '';

        messages.forEach(msg => {
            const isOwnMessage = msg.senderId === currentUser.uid;
            const messageEl = this.createMessageElement(msg, isOwnMessage);
            container.appendChild(messageEl);
            
            // Marcar mensaje como procesado
            if (msg.id) {
                this.processedMessages.add(msg.id);
            }
        });

        // Si hay mensajes nuevos que no son míos, reproducir sonido
        if (newMessages.length > 0) {
            const hasNewMessageFromOther = newMessages.some(msg => msg.senderId !== currentUser.uid);
            if (hasNewMessageFromOther) {
                this.playNotificationSound();
            }
        }

        // Actualizar último mensaje
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.id) {
                this.lastMessageIds.set(chatId, lastMsg.id);
            }
        }

        // Scroll al final
        container.scrollTop = container.scrollHeight;
        
        // Actualizar el bocadillo de chats minimizados
        this.updateMinimizedBar();
    }
    
    // Reproducir sonido de notificación
    playNotificationSound() {
        try {
            // Crear un sonido simple usando Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800; // Frecuencia en Hz
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
            
            console.log('🔔 Sonido de notificación reproducido');
        } catch (error) {
            console.log('No se pudo reproducir el sonido:', error);
        }
    }

    // Obtener marcas de verificación según el estado del mensaje
    getCheckMarks(msg) {
        if (!msg) return '';
        
        // Si el mensaje ha sido leído (doble check azul)
        if (msg.read) {
            return '<span class="text-xs" style="color: #4FC3F7;">✓✓</span>';
        }
        // Si el mensaje ha sido entregado (doble check gris)
        else if (msg.delivered) {
            return '<span class="text-xs text-gray-300">✓✓</span>';
        }
        // Si el mensaje ha sido enviado (un check gris)
        else {
            return '<span class="text-xs text-gray-300">✓</span>';
        }
    }
    
    // Crear elemento de mensaje
    createMessageElement(msg, isOwnMessage) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`;
        
        const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        }) : '';

        let messageContent = msg.message;
        
        // Manejar diferentes tipos de mensaje
        if (msg.type === 'card_offer') {
            try {
                const cardData = JSON.parse(msg.message);
                messageContent = `
                    <div class="bg-white dark:bg-gray-700 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
                        <p class="text-sm font-semibold mb-2">${cardData.text}</p>
                        <img src="${cardData.cardImage}" alt="${cardData.cardName}" class="w-24 h-32 object-cover rounded">
                        <p class="text-xs mt-1">${cardData.cardSet}</p>
                    </div>
                `;
            } catch (e) {
                // Si no es JSON válido, mostrar como texto normal
            }
        }

        messageDiv.innerHTML = `
            <div class="max-w-[70%]">
                <div class="${isOwnMessage ? 
                    'bg-orange-500 text-white' : 
                    'bg-white dark:bg-gray-700 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-600'
                } rounded-lg px-4 py-2 shadow-sm">
                    ${msg.type === 'card_offer' ? messageContent : `<p class="break-words">${this.escapeHtml(messageContent)}</p>`}
                    <div class="flex items-center justify-between mt-1">
                        <span class="text-xs ${isOwnMessage ? 'text-orange-100' : 'text-gray-500 dark:text-gray-400'}">
                            ${time}
                        </span>
                        ${isOwnMessage ? this.getCheckMarks(msg) : ''}
                    </div>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 ${isOwnMessage ? 'text-right' : ''}">
                    ${msg.senderName || 'Usuario'}
                </p>
            </div>
        `;

        return messageDiv;
    }

    // Mostrar indicador de escribiendo
    showTypingIndicator(chatId, show) {
        const indicator = document.getElementById(`typing-indicator-${chatId}`);
        if (indicator) {
            if (show) {
                indicator.classList.remove('hidden');
            } else {
                indicator.classList.add('hidden');
            }
        }
    }

    // Actualizar indicador de estado online
    updateOnlineStatus(chatId, isOnline) {
        const indicator = document.getElementById(`online-indicator-${chatId}`);
        if (indicator) {
            indicator.className = `absolute bottom-0 right-0 w-3 h-3 ${
                isOnline ? 'bg-green-500' : 'bg-gray-400'
            } rounded-full border-2 border-white`;
        }
    }

    // Crear barra de chats minimizados
    createMinimizedBar() {
        if (document.getElementById('minimized-chats-bar')) return;
        
        const bar = document.createElement('div');
        bar.id = 'minimized-chats-bar';
        bar.className = 'fixed bottom-4 right-4 bg-orange-500 text-white rounded-full px-4 py-2 shadow-lg cursor-pointer hover:bg-orange-600 transition-colors hidden z-50';
        bar.innerHTML = `
            <div class="flex items-center space-x-2">
                <span class="text-lg">💬</span>
                <span>Chats</span>
                <span id="unread-chats-badge" class="hidden bg-red-500 text-white text-xs rounded-full px-2 py-0.5 ml-1">0</span>
            </div>
        `;
        
        // Al hacer click, mostrar la lista de chats
        bar.addEventListener('click', () => this.showChatList());
        document.body.appendChild(bar);
    }
    
    // Actualizar contador de chats minimizados
    async updateMinimizedBar() {
        const bar = document.getElementById('minimized-chats-bar');
        const badge = document.getElementById('unread-chats-badge');
        
        if (bar) {
            // Mostrar la barra si hay CUALQUIER chat (minimizado o no)
            const totalChats = this.activeChats.size + this.minimizedChats.size;
            
            if (totalChats > 0) {
                bar.classList.remove('hidden');
                
                // Contar chats con mensajes sin leer
                if (badge && this.chatManager) {
                    try {
                        // Obtener contadores de mensajes no leídos
                        let chatsWithUnread = 0;
                        
                        // Verificar cada chat
                        for (const [chatId, count] of this.chatManager.unreadCounts) {
                            if (count > 0) {
                                chatsWithUnread++;
                            }
                        }
                        
                        // Actualizar badge
                        if (chatsWithUnread > 0) {
                            badge.textContent = chatsWithUnread;
                            badge.classList.remove('hidden');
                        } else {
                            badge.classList.add('hidden');
                        }
                    } catch (error) {
                        console.error('Error al actualizar contador de no leídos:', error);
                        badge.classList.add('hidden');
                    }
                }
            } else {
                bar.classList.add('hidden');
            }
        }
    }
    
    // Minimizar chat
    minimizeChat(chatId) {
        const chatData = this.activeChats.get(chatId);
        if (!chatData) return;

        const chatWindow = chatData.window;
        
        // Ocultar ventana de chat
        chatWindow.style.display = 'none';
        
        // Añadir a chats minimizados
        this.minimizedChats.add(chatId);
        
        // Actualizar barra de minimizados
        this.updateMinimizedBar();
        
        // Guardar estado
        this.saveChatsState();
    }
    
    // Restaurar chat específico
    restoreChat(chatId) {
        const chatWindow = document.getElementById(`chat-window-${chatId}`);
        if (chatWindow) {
            chatWindow.style.display = 'flex';
            this.minimizedChats.delete(chatId);
            this.updateMinimizedBar();
            this.focusChatWindow(chatId);
            this.saveChatsState();
        }
    }
    
    // Restaurar todos los chats
    restoreAllChats() {
        this.minimizedChats.forEach(chatId => {
            const chatWindow = document.getElementById(`chat-window-${chatId}`);
            if (chatWindow) {
                chatWindow.style.display = 'flex';
            }
        });
        this.minimizedChats.clear();
        this.updateMinimizedBar();
        this.saveChatsState();
    }

    // Cerrar chat
    closeChat(chatId) {
        const chatWindow = document.getElementById(`chat-window-${chatId}`);
        if (chatWindow) {
            // Animar salida
            chatWindow.style.animation = 'slideOutDown 0.3s ease-out';
            setTimeout(() => {
                chatWindow.remove();
                this.activeChats.delete(chatId);
                this.minimizedChats.delete(chatId);
                this.updateMinimizedBar();
                this.saveChatsState();
                
                // Desconectar listeners si existe el chatId
                if (chatId && this.chatManager) {
                    this.chatManager.disconnectChat(chatId);
                }
            }, 300);
        }
    }

    // Enfocar ventana de chat
    focusChatWindow(chatId) {
        console.log('🎯 focusChatWindow llamado para:', chatId);
        const chatWindow = document.getElementById(`chat-window-${chatId}`);
        if (chatWindow) {
            // Asegurar que esté visible
            chatWindow.style.display = 'flex';
            
            // Quitar de minimizados si está ahí
            if (this.minimizedChats.has(chatId)) {
                console.log('📤 Quitando de minimizados:', chatId);
                this.minimizedChats.delete(chatId);
                this.updateMinimizedBar();
            }
            
            // Asegurar que esté en activos si no está ya
            if (!this.activeChats.has(chatId)) {
                // Recuperar datos del chat para agregarlo a activos
                const chatData = {
                    window: chatWindow,
                    otherUserName: chatWindow.querySelector('h3')?.textContent || 'Usuario',
                    tradeTitle: chatWindow.querySelector('.text-xs.opacity-90')?.textContent || 'Chat de intercambio'
                };
                this.activeChats.set(chatId, chatData);
            }
            
            // Traer al frente
            document.querySelectorAll('.chat-window').forEach(w => {
                w.style.zIndex = '50';
            });
            chatWindow.style.zIndex = '51';
            
            // Enfocar input
            const input = document.getElementById(`message-input-${chatId}`);
            if (input) input.focus();
            
            // Guardar estado
            this.saveChatsState();
            
            // Actualizar la lista de chats si está abierta
            const chatListModal = document.getElementById('chat-list-modal');
            if (chatListModal) {
                console.log('📋 Disparando evento para actualizar lista de chats...');
                window.dispatchEvent(new Event('chatRestored'));
            }
            
            // Actualizar el badge de navegación
            this.updateChatBadge();
            
            console.log('✅ Chat enfocado correctamente');
        } else {
            console.log('⚠️ No se encontró la ventana de chat:', chatId);
        }
    }

    // Mostrar lista de chats
    async showChatList() {
        // Limpiar cualquier interval anterior
        if (this.chatListInterval) {
            clearInterval(this.chatListInterval);
            this.chatListInterval = null;
        }
        
        // Eliminar modal anterior si existe
        const existingModal = document.getElementById('chat-list-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.id = 'chat-list-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
        
        // Función para actualizar la lista - SIMPLIFICADA
        const updateChatList = async () => {
            const container = document.getElementById('chat-list-container');
            if (!container) return;
            
            try {
                const chats = await this.chatManager.getUserChats();
                
                if (chats.length === 0) {
                    container.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 py-8">No tienes conversaciones activas</p>`;
                } else {
                    container.innerHTML = chats.map(chat => this.createChatListItem(chat)).join('');
                }
                
                // Actualizar contador
                const countBadge = document.getElementById('chat-list-count');
                if (countBadge) {
                    countBadge.textContent = chats.length > 0 ? `(${chats.length})` : '';
                }
            } catch (error) {
                console.error('Error al cargar chats:', error);
                
                // Mostrar error amigable al usuario
                container.innerHTML = `
                    <div class="text-center py-8">
                        <div class="text-red-500 mb-4">
                            <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <p class="text-gray-700 dark:text-gray-300 font-semibold mb-2">Error al cargar los chats</p>
                        <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">
                            ${error.message === 'Permission denied' ? 
                                'Permisos de Firebase no configurados correctamente' : 
                                'No se pudieron cargar las conversaciones'}
                        </p>
                        ${error.message === 'Permission denied' ? 
                            '<p class="text-xs text-gray-400 dark:text-gray-500">Actualiza las reglas en Firebase Console</p>' : 
                            ''}
                    </div>
                `;
                
                // Detener actualización automática si hay error de permisos
                if (error.message === 'Permission denied' && this.chatListInterval) {
                    clearInterval(this.chatListInterval);
                    this.chatListInterval = null;
                }
            }
        };
        
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <div class="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6">
                    <h2 class="text-2xl font-bold flex items-center">
                        <span class="mr-3">💬</span> 
                        Mis Conversaciones 
                        <span id="chat-list-count" class="ml-2 text-sm opacity-90"></span>
                    </h2>
                    <p class="text-sm mt-2 opacity-90">Gestiona todos tus chats de intercambios</p>
                </div>
                
                <div id="chat-list-container" class="overflow-y-auto max-h-[50vh] p-4">
                    <div class="text-center py-4">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                        <p class="text-gray-500 dark:text-gray-400 mt-2">Cargando chats...</p>
                    </div>
                </div>
                
                <div class="border-t border-gray-200 dark:border-gray-700 p-4 flex gap-2">
                    <button id="refresh-chat-list-btn" class="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-all">
                        🔄 Actualizar
                    </button>
                    <button id="close-chat-list-btn" class="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all">
                        Cerrar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listener delegado para clicks en items de chat
        modal.addEventListener('click', (e) => {
            const chatItem = e.target.closest('[data-chat-id]');
            if (chatItem && !e.target.closest('button')) {
                const chatId = chatItem.getAttribute('data-chat-id');
                const displayName = chatItem.getAttribute('data-display-name');
                const tradeTitle = chatItem.getAttribute('data-trade-title');
                
                console.log('📱 Chat clickeado (delegado):', { chatId, displayName, tradeTitle });
                
                if (chatId) {
                    this.openChatFromList(chatId, displayName, tradeTitle);
                }
            }
        });
        
        // Añadir event listeners a los botones
        const refreshBtn = document.getElementById('refresh-chat-list-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.disabled = true;
                refreshBtn.textContent = '⏳ Actualizando...';
                const container = document.getElementById('chat-list-container');
                if (container) {
                    container.innerHTML = '<div class="text-center py-4"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>';
                }
                
                try {
                    // Actualizar solo la lista de chats sin recargar la página
                    await updateChatList(true);
                    
                    // Actualizar badge de navegación
                    if (this.updateChatBadge) {
                        await this.updateChatBadge();
                    }
                    
                    // Mostrar notificación de éxito
                    this.showNotification('Lista de chats actualizada', 'success');
                    
                } catch (error) {
                    console.error('Error al actualizar chats:', error);
                    this.showNotification('Error al actualizar chats', 'error');
                } finally {
                    // Restaurar botón
                    refreshBtn.disabled = false;
                    refreshBtn.textContent = '🔄 Actualizar';
                }
            });
        }
        
        const closeBtn = document.getElementById('close-chat-list-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
        }
        
        // Cargar chats inicialmente
        updateChatList(true);
        
        // Actualizar cada 5 segundos
        this.chatListInterval = setInterval(() => {
            if (document.getElementById('chat-list-modal')) {
                updateChatList();
            } else {
                clearInterval(this.chatListInterval);
            }
        }, 5000);
        
        // También actualizar cuando se detecte un nuevo chat
        const handleNewChat = () => {
            console.log('📱 Nuevo chat detectado, actualizando lista...');
            updateChatList(true);
        };
        window.addEventListener('chatCreated', handleNewChat);
        
        // Actualizar cuando se elimine un chat
        const handleDeleteChat = () => {
            console.log('🗑️ Chat eliminado, actualizando lista...');
            updateChatList(true);
        };
        window.addEventListener('chatDeleted', handleDeleteChat);
        
        // Actualizar cuando se restaure un chat
        const handleRestoreChat = () => {
            console.log('♻️ Chat restaurado, actualizando lista...');
            updateChatList(true);
        };
        window.addEventListener('chatRestored', handleRestoreChat);
        
        // Debug: verificar si se disparan eventos constantemente
        const originalDispatchEvent = window.dispatchEvent;
        window.dispatchEvent = function(event) {
            if (event.type === 'chatCreated' || event.type === 'chatDeleted') {
                console.log('⚡ Evento disparado:', event.type);
            }
            return originalDispatchEvent.call(this, event);
        };
        
        // Función para limpiar todo al cerrar
        const cleanup = () => {
            window.removeEventListener('chatCreated', handleNewChat);
            window.removeEventListener('chatDeleted', handleDeleteChat);
            window.removeEventListener('chatRestored', handleRestoreChat);
            if (this.chatListInterval) {
                clearInterval(this.chatListInterval);
                this.chatListInterval = null;
            }
            modal.remove();
        };
        
        // Limpiar listeners cuando se cierre el modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal || (e.target.textContent && e.target.textContent.includes('Cerrar'))) {
                cleanup();
            }
        });
        
        // Asegurar limpieza si se cierra de otra forma
        const observer = new MutationObserver((mutations) => {
            if (!document.contains(modal)) {
                cleanup();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true });
    }

    // Crear elemento de lista de chat
    createChatListItem(chat) {
        const otherUser = chat.otherUser || {};
        const displayName = otherUser.displayName || 'Chat de Intercambio';
        const lastMessageTime = chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }) : '';
        
        // Extraer el título del intercambio si existe
        const tradeId = chat.tradeId || chat.id.replace('trade_', '');
        const tradeTitle = `Intercambio #${tradeId.substring(0, 8)}`;
        
        // Para chats de intercambio, usar el título del intercambio como nombre principal
        const chatTitle = chat.isTradeChat || chat.id.startsWith('trade_') ? tradeTitle : displayName;
        
        // Contar participantes
        const participantCount = chat.participants ? Object.keys(chat.participants).length : 0;
        const participantText = participantCount > 0 ? `${participantCount} participante${participantCount > 1 ? 's' : ''}` : '';
        
        // Escapar valores para evitar problemas con comillas
        const escapedChatId = chat.id.replace(/'/g, "\\'");
        const escapedDisplayName = displayName.replace(/'/g, "\\'");
        const escapedTradeTitle = tradeTitle.replace(/'/g, "\\'");
        
        return `
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                 data-chat-id="${chat.id}"
                 data-display-name="${displayName}"
                 data-trade-title="${tradeTitle}"
                 onclick="window.chatUI.openChatFromList('${escapedChatId}', '${escapedDisplayName}', '${escapedTradeTitle}')">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                            <span class="text-xl">💬</span>
                        </div>
                        <div class="flex-1">
                            <h4 class="font-semibold text-gray-800 dark:text-white">
                                ${chatTitle}
                            </h4>
                            <p class="text-sm text-gray-600 dark:text-gray-400">
                                ${chat.lastMessage ? this.truncateText(chat.lastMessage, 40) : 'Sin mensajes'}
                            </p>
                            ${participantText ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${participantText}</p>` : ''}
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="flex items-center justify-end gap-2 mb-1">
                            <p class="text-xs text-gray-500 dark:text-gray-400">${lastMessageTime}</p>
                                                    <button class="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold transition-colors delete-chat-btn"
                                data-chat-id="${chat.id}"
                                onclick="event.stopPropagation(); window.deleteUserChat('${escapedChatId}')">
                            ×
                        </button>
                        </div>
                        ${chat.unreadCount > 0 ? 
                            `<span class="inline-block mt-1 px-2 py-1 bg-orange-500 text-white text-xs rounded-full">
                                ${chat.unreadCount}
                            </span>` : ''
                        }
                    </div>
                </div>
            </div>
        `;
    }

    // Eliminar chat
    async deleteChat(chatId) {
        console.log('🗑️ Eliminando chat:', chatId);
        
        // Normalizar el chatId por si viene con doble prefijo
        if (chatId && chatId.startsWith('trade_trade_')) {
            chatId = chatId.replace('trade_trade_', 'trade_');
        }
        
        // Crear modal de confirmación personalizado
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4';
        
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 transform transition-all">
                <div class="text-center">
                    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 mb-4">
                        <svg class="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        ¿Eliminar conversación?
                    </h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        Esta acción eliminará permanentemente todos los mensajes de esta conversación. 
                        <strong class="text-red-600 dark:text-red-400">Esta acción no se puede deshacer.</strong>
                    </p>
                    <div class="flex gap-3 justify-center">
                        <button id="cancel-delete" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                            Cancelar
                        </button>
                        <button id="confirm-delete" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                            Eliminar Chat
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        return new Promise(async (resolve) => {
            const handleCancel = () => {
                modal.remove();
                resolve();
            };
            
            const handleConfirm = async () => {
                modal.remove();
                await this.performDeleteChat(chatId);
                resolve();
            };
            
            document.getElementById('cancel-delete').addEventListener('click', handleCancel);
            document.getElementById('confirm-delete').addEventListener('click', handleConfirm);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) handleCancel();
            });
        });
    }
    
    // Realizar la eliminación del chat
    async performDeleteChat(chatId) {
        try {
            console.log('🚀 Iniciando eliminación del chat:', chatId);
            
            // Importar módulos necesarios directamente para evitar caché
            const { getDatabase, ref, get, remove } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
            const { getAuth } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
            
            const db = getDatabase();
            const auth = getAuth();
            const currentUser = auth.currentUser;
            
            if (!currentUser) {
                throw new Error('Usuario no autenticado');
            }
            
            // Normalizar chatId
            if (chatId.startsWith('trade_trade_')) {
                chatId = chatId.replace('trade_trade_', 'trade_');
                console.log('📝 ChatId normalizado:', chatId);
            }
            
            // Cerrar ventana de chat si está abierta
            const chatWindow = document.getElementById(`chat-window-${chatId}`);
            if (chatWindow) {
                console.log('📤 Cerrando ventana de chat');
                chatWindow.remove();
                this.activeChats.delete(chatId);
                this.minimizedChats.delete(chatId);
            }
            
            // Eliminar de localStorage
            console.log('💾 Eliminando de localStorage');
            this.removeFromSavedChats(chatId);
            
            // Obtener datos del chat antes de eliminar
            const chatRef = ref(db, `chats/${chatId}`);
            console.log('👥 Obteniendo datos del chat...');
            const snapshot = await get(chatRef);
            
            if (snapshot.exists()) {
                const chatData = snapshot.val();
                console.log('📊 Datos del chat encontrados');
                
                // Eliminar referencias de userChats
                if (chatData?.metadata?.participants) {
                    const participants = Object.keys(chatData.metadata.participants);
                    console.log('👥 Participantes:', participants);
                    
                    for (const userId of participants) {
                        try {
                            const userChatRef = ref(db, `userChats/${userId}/${chatId}`);
                            console.log(`🗑️ Eliminando referencia para ${userId}`);
                            await remove(userChatRef);
                        } catch (err) {
                            console.warn(`⚠️ Error eliminando referencia de ${userId}:`, err);
                        }
                    }
                }
                
                // Eliminar el chat principal
                console.log('🔥 Eliminando chat principal...');
                await remove(chatRef);
                
                // Verificar eliminación
                console.log('🔍 Verificando eliminación...');
                const checkSnapshot = await get(chatRef);
                
                if (checkSnapshot.exists()) {
                    console.error('❌ El chat SIGUE existiendo');
                    throw new Error('No se pudo eliminar el chat');
                } else {
                    console.log('✅ Confirmado: Chat eliminado de Firebase');
                }
            } else {
                console.log('⚠️ El chat ya no existe en Firebase');
            }
            
            // Desconectar listeners si los hay
            if (this.chatManager) {
                this.chatManager.disconnectChat(chatId);
            }
            
            // Actualizar la lista con un pequeño retraso
            setTimeout(() => {
                const updateChatList = document.querySelector('#chat-list-container');
                if (updateChatList) {
                    console.log('📋 Actualizando lista de chats');
                    const event = new Event('chatDeleted');
                    window.dispatchEvent(event);
                }
            }, 500);
            
            // Actualizar UI
            this.updateMinimizedBar();
            this.updateChatBadge();
            
            // Mostrar notificación de éxito
            this.showNotification('Chat eliminado correctamente', 'success');
            console.log('✅ Chat eliminado exitosamente');
            
        } catch (error) {
            console.error('❌ Error al eliminar chat:', error);
            this.showNotification('Error al eliminar el chat. Por favor, intenta de nuevo.', 'error');
        }
    }
    
    // Mostrar notificación temporal
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
        
        notification.className = `fixed top-4 right-4 z-[101] ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Animar entrada
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 10);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Remover chat de los guardados
    removeFromSavedChats(chatId) {
        try {
            const userId = this.chatManager.auth.currentUser?.uid;
            if (!userId) return;
            
            const savedState = localStorage.getItem(`chatsState_${userId}`);
            if (savedState) {
                const chatsState = JSON.parse(savedState);
                chatsState.activeChats = chatsState.activeChats.filter(chat => chat.chatId !== chatId);
                localStorage.setItem(`chatsState_${userId}`, JSON.stringify(chatsState));
            }
        } catch (error) {
            console.error('Error al actualizar chats guardados:', error);
        }
    }
    
    // Crear elemento de lista de chat oculto
    createHiddenChatListItem(chat) {
        const otherUser = chat.otherUser || {};
        const displayName = otherUser.displayName || otherUser.email || 'Usuario';
        const lastMessage = chat.lastMessage || 'Sin mensajes';
        const lastMessageTime = chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleString() : '';
        
        // Obtener título del intercambio
        const tradeTitle = chat.displayName || chat.tradeName || `Intercambio #${chat.id.split('_')[1] || ''}`;
        
        // Escapar valores para el onclick
        const escapedChatId = chat.id.replace(/'/g, "\\'");
        const escapedDisplayName = displayName.replace(/'/g, "\\'");
        const escapedTradeTitle = tradeTitle.replace(/'/g, "\\'");
        
        return `
            <div class="bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 p-4 rounded-lg cursor-pointer transition-all relative"
                 data-chat-id="${chat.id}"
                 data-display-name="${displayName}"
                 data-trade-title="${tradeTitle}">
                <div class="flex items-center">
                    <div class="flex-shrink-0 mr-3">
                        <div class="w-12 h-12 bg-yellow-200 dark:bg-yellow-800 rounded-full flex items-center justify-center">
                            <span class="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
                                ${displayName.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div class="flex-grow">
                        <h4 class="font-semibold text-gray-900 dark:text-white">${tradeTitle}</h4>
                        <p class="text-sm text-gray-600 dark:text-gray-400">${displayName}</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                            ${this.truncateText(lastMessage, 40)}
                        </p>
                    </div>
                    <div class="text-right">
                        <div class="flex items-center justify-end gap-2 mb-1">
                            ${lastMessageTime ? `<p class="text-xs text-gray-500 dark:text-gray-400">${lastMessageTime}</p>` : ''}
                            <button class="w-5 h-5 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold transition-colors restore-chat-btn"
                                    data-chat-id="${chat.id}"
                                    onclick="event.stopPropagation(); window.chatUI.restoreHiddenChat('${escapedChatId}')">
                                ↩
                            </button>
                        </div>
                        <span class="inline-block mt-1 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded">
                            Oculto
                        </span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Restaurar chat oculto
    async restoreHiddenChat(chatId) {
        try {
            await this.chatManager.unhideChat(chatId);
            this.showNotification('Chat restaurado correctamente', 'success');
            
            // Actualizar la lista
            const event = new Event('chatDeleted');
            window.dispatchEvent(event);
        } catch (error) {
            console.error('Error al restaurar chat:', error);
            this.showNotification('Error al restaurar el chat', 'error');
        }
    }
    
    // Abrir chat desde la lista
    openChatFromList(chatId, otherUserName, tradeId) {
        console.log('🔍 openChatFromList llamado:', { chatId, otherUserName, tradeId });
        
        // Normalizar el chatId por si viene con doble prefijo
        if (chatId && chatId.startsWith('trade_trade_')) {
            console.log('⚠️ Normalizando chatId en openChatFromList');
            chatId = chatId.replace('trade_trade_', 'trade_');
        }
        
        try {
            // Cerrar modal de lista
            const modal = document.getElementById('chat-list-modal');
            if (modal) {
                console.log('📋 Cerrando modal de lista');
                modal.remove();
            }
            
            // Pequeño delay para asegurar que el modal se cierre
            setTimeout(() => {
                console.log('🚀 Abriendo chat:', chatId);
                // Abrir ventana de chat
                this.openChat(chatId, otherUserName, tradeId);
            }, 100);
            
        } catch (error) {
            console.error('❌ Error en openChatFromList:', error);
        }
    }

    // Abrir chat
    async openChat(chatId, otherUserName = 'Usuario', tradeTitle = '') {
        console.log('📂 openChat llamado con:', { chatId, otherUserName, tradeTitle });
        
        // Normalizar el chatId por si viene con doble prefijo
        if (chatId.startsWith('trade_trade_')) {
            console.log('⚠️ ChatId con doble prefijo detectado, normalizando...');
            chatId = chatId.replace('trade_trade_', 'trade_');
        }
        
        console.log('📌 ChatId normalizado:', chatId);
        
        // Verificar si el chat ya está activo
        const isNewChat = !document.getElementById(`chat-window-${chatId}`);
        console.log('🆕 Es chat nuevo?', isNewChat);
        
        // Crear ventana si no existe
        if (isNewChat) {
            this.createChatWindow(chatId, otherUserName, tradeTitle);
            
            // Solo configurar listeners si es un chat nuevo
            // Cargar mensajes
            this.chatManager.listenToMessages(chatId, (messages) => {
                this.displayMessages(chatId, messages);
            });
            
            // Marcar mensajes como leídos
            await this.chatManager.markMessagesAsRead(chatId);
            
            // Actualizar el badge del chat en la navegación
            this.updateChatBadge();
            
            // Disparar evento de nuevo chat creado
            window.dispatchEvent(new CustomEvent('chatCreated', {
                detail: { chatId, otherUserName, tradeTitle }
            }));
            console.log('📢 Evento chatCreated disparado para:', chatId);
        } else {
            // Si ya existe, solo enfocarlo
            this.focusChatWindow(chatId);
        }
        
        this.currentChatId = chatId;
        
        // Asegurar que la barra de minimizados esté visible si hay chats
        this.createMinimizedBar();
        this.updateMinimizedBar();
    }

    // Utilidades
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Actualizar badge del chat en la navegación
    async updateChatBadge() {
        try {
            const chats = await this.chatManager.getUserChats();
            const totalChats = chats.length;
            
            // Contar CHATS con mensajes sin leer (no total de chats)
            let chatsWithUnread = 0;
            for (const [chatId, count] of this.chatManager.unreadCounts) {
                if (count > 0) {
                    chatsWithUnread++;
                }
            }
            
            // Actualizar el badge en el enlace de navegación
            const chatBadge = document.getElementById('chatBadge');
            if (chatBadge) {
                if (chatsWithUnread > 0) {
                    chatBadge.textContent = chatsWithUnread;
                    chatBadge.classList.remove('hidden');
                } else {
                    chatBadge.classList.add('hidden');
                }
            }
            
            // También actualizar si el modal está abierto
            const chatListContainer = document.getElementById('chat-list-container');
            if (chatListContainer) {
                if (chats.length === 0) {
                    chatListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-8">No tienes conversaciones activas</p>';
                } else {
                    chatListContainer.innerHTML = chats.map(chat => this.createChatListItem(chat)).join('');
                }
                
                const countBadge = document.getElementById('chat-list-count');
                if (countBadge) {
                    countBadge.textContent = chats.length > 0 ? `(${chats.length})` : '';
                }
            }
        } catch (error) {
            console.error('Error al actualizar badge de chat:', error);
        }
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    showNotification(message, type = 'info') {
        // Usar el sistema de notificaciones existente si está disponible
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type, 3000);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }
}

// Hacer disponible globalmente
window.ChatUI = ChatUI;

// Estilos CSS para el chat
const chatStyles = `
<style>
@keyframes slideInUp {
    from {
        transform: translateY(100%);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

@keyframes slideOutDown {
    from {
        transform: translateY(0);
        opacity: 1;
    }
    to {
        transform: translateY(100%);
        opacity: 0;
    }
}

.typing-dots {
    display: inline-flex;
    align-items: center;
}

.typing-dots span {
    height: 8px;
    width: 8px;
    background-color: #999;
    border-radius: 50%;
    display: inline-block;
    margin: 0 2px;
    animation: typing 1.4s infinite;
}

.typing-dots span:nth-child(2) {
    animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
    animation-delay: 0.4s;
}

@keyframes typing {
    0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.5;
    }
    30% {
        transform: translateY(-10px);
        opacity: 1;
    }
}

.chat-window {
    transition: height 0.3s ease;
}

/* Scrollbar personalizado para el área de mensajes */
.chat-window [id^="messages-container-"] {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e0 #f7fafc;
}

.chat-window [id^="messages-container-"]::-webkit-scrollbar {
    width: 6px;
}

.chat-window [id^="messages-container-"]::-webkit-scrollbar-track {
    background: #f7fafc;
    border-radius: 3px;
}

.chat-window [id^="messages-container-"]::-webkit-scrollbar-thumb {
    background: #cbd5e0;
    border-radius: 3px;
}

.chat-window [id^="messages-container-"]::-webkit-scrollbar-thumb:hover {
    background: #a0aec0;
}

/* Modo oscuro */
.dark .chat-window [id^="messages-container-"] {
    scrollbar-color: #4a5568 #1a202c;
}

.dark .chat-window [id^="messages-container-"]::-webkit-scrollbar-track {
    background: #1a202c;
}

.dark .chat-window [id^="messages-container-"]::-webkit-scrollbar-thumb {
    background: #4a5568;
}

.dark .chat-window [id^="messages-container-"]::-webkit-scrollbar-thumb:hover {
    background: #718096;
}
</style>
`;

// Inyectar estilos cuando se carga el módulo
if (!document.getElementById('chat-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'chat-styles';
    styleElement.innerHTML = chatStyles;
    document.head.appendChild(styleElement.firstElementChild);
}

// Función de debug global
window.testOpenChat = function(chatId = 'trade_test123') {
    console.log('🧪 Probando apertura de chat con ID:', chatId);
    
    if (!window.chatUI) {
        console.error('❌ chatUI no está disponible');
        return;
    }
    
    try {
        window.chatUI.openChat(chatId, 'Usuario Prueba', 'Intercambio Prueba');
        console.log('✅ Llamada a openChat exitosa');
    } catch (error) {
        console.error('❌ Error al abrir chat:', error);
    }
};

// Función de prueba para eliminar chat
window.testDeleteChat = async function(chatId) {
    console.log('🧪 Probando eliminación de chat:', chatId);
    
    if (!window.chatManager) {
        console.error('❌ chatManager no está disponible');
        return;
    }
    
    try {
        await window.chatManager.deleteChat(chatId);
        console.log('✅ Chat eliminado exitosamente en la prueba');
    } catch (error) {
        console.error('❌ Error en prueba de eliminación:', error);
    }
};

// Función para verificar si el chat existe
window.checkChatExists = async function(chatId) {
    if (!window.chatManager) {
        console.error('❌ chatManager no está disponible');
        return;
    }
    
    try {
        const { getDatabase, ref, get } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        const db = getDatabase();
        const chatRef = ref(db, `chats/${chatId}`);
        const snapshot = await get(chatRef);
        
        if (snapshot.exists()) {
            console.log('✅ El chat existe:', chatId);
            console.log('📊 Datos:', snapshot.val());
        } else {
            console.log('❌ El chat NO existe:', chatId);
        }
    } catch (error) {
        console.error('❌ Error al verificar chat:', error);
    }
};

// Función de eliminación directa sin caché
window.forceDeleteChat = async function(chatId) {
    console.log('🚀 Eliminación directa de chat:', chatId);
    
    // Crear modal de confirmación
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4';
    
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 transform transition-all">
            <div class="text-center">
                <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 mb-4">
                    <svg class="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    ¿Eliminar conversación?
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Esta acción eliminará permanentemente todos los mensajes de esta conversación. 
                    <strong class="text-red-600 dark:text-red-400">Esta acción no se puede deshacer.</strong>
                </p>
                <div class="flex gap-3 justify-center">
                    <button id="cancel-delete" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                        Cancelar
                    </button>
                    <button id="confirm-delete" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                        Eliminar Chat
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Esperar confirmación
    const confirmed = await new Promise((resolve) => {
        const handleCancel = () => {
            modal.remove();
            resolve(false);
        };
        
        const handleConfirm = () => {
            modal.remove();
            resolve(true);
        };
        
        document.getElementById('cancel-delete').addEventListener('click', handleCancel);
        document.getElementById('confirm-delete').addEventListener('click', handleConfirm);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) handleCancel();
        });
    });
    
    if (!confirmed) {
        console.log('❌ Eliminación cancelada por el usuario');
        return;
    }
    
    try {
        const { getDatabase, ref, get, remove } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
        
        const db = getDatabase();
        const auth = getAuth();
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
            throw new Error('Usuario no autenticado');
        }
        
        // Normalizar chatId
        if (chatId.startsWith('trade_trade_')) {
            chatId = chatId.replace('trade_trade_', 'trade_');
            console.log('📝 ChatId normalizado:', chatId);
        }
        
        const chatRef = ref(db, `chats/${chatId}`);
        
        // Obtener participantes primero
        console.log('👥 Obteniendo datos del chat...');
        const snapshot = await get(chatRef);
        
        if (!snapshot.exists()) {
            console.log('❌ El chat no existe');
            return;
        }
        
        const chatData = snapshot.val();
        console.log('📊 Datos del chat:', chatData);
        
        // Eliminar referencias de userChats
        if (chatData?.metadata?.participants) {
            const participants = Object.keys(chatData.metadata.participants);
            console.log('👥 Participantes:', participants);
            
            for (const userId of participants) {
                try {
                    const userChatRef = ref(db, `userChats/${userId}/${chatId}`);
                    console.log(`🗑️ Eliminando referencia para ${userId}`);
                    await remove(userChatRef);
                } catch (err) {
                    console.warn(`⚠️ Error eliminando referencia de ${userId}:`, err);
                }
            }
        }
        
        // Eliminar el chat
        console.log('🔥 Eliminando chat principal...');
        await remove(chatRef);
        
        // Verificar eliminación
        console.log('🔍 Verificando eliminación...');
        const checkSnapshot = await get(chatRef);
        
        if (checkSnapshot.exists()) {
            console.error('❌ El chat SIGUE existiendo');
        } else {
            console.log('✅ Chat eliminado exitosamente');
        }
        
        // Cerrar ventana de chat si está abierta
        const chatWindow = document.getElementById(`chat-window-${chatId}`);
        if (chatWindow) {
            chatWindow.remove();
        }
        
        // Actualizar UI si está disponible
        if (window.chatUI) {
            window.chatUI.updateMinimizedBar();
            window.chatUI.updateChatBadge();
            window.chatUI.activeChats.delete(chatId);
            window.chatUI.minimizedChats.delete(chatId);
            window.chatUI.removeFromSavedChats(chatId);
            
            // Mostrar notificación de éxito
            window.chatUI.showNotification('Chat eliminado correctamente', 'success');
        }
        
        // Disparar evento
        window.dispatchEvent(new Event('chatDeleted'));
        
    } catch (error) {
        console.error('❌ Error en eliminación directa:', error);
        if (window.chatUI) {
            window.chatUI.showNotification('Error al eliminar el chat', 'error');
        }
    }
};

// Función para ocultar chat (eliminar solo para el usuario actual)
// Función para borrar chat solo para el usuario actual
window.deleteUserChat = async function(chatId) {
    console.log('🗑️ Eliminando chat para el usuario actual:', chatId);
    
    // Crear modal de confirmación
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4';
    
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 transform transition-all">
            <div class="text-center">
                <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 mb-4">
                    <svg class="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    ¿Eliminar conversación?
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Esta acción eliminará la conversación solo para ti. El otro usuario seguirá viendo el chat.
                    <br><br>
                    <strong class="text-red-600 dark:text-red-400">Esta acción no se puede deshacer.</strong>
                </p>
                <div class="flex gap-3 justify-center">
                    <button id="cancel-delete" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                        Cancelar
                    </button>
                    <button id="confirm-delete" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                        Eliminar Chat
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Esperar confirmación
    const confirmed = await new Promise((resolve) => {
        const handleCancel = () => {
            modal.remove();
            resolve(false);
        };
        
        const handleConfirm = () => {
            modal.remove();
            resolve(true);
        };
        
        document.getElementById('cancel-delete').addEventListener('click', handleCancel);
        document.getElementById('confirm-delete').addEventListener('click', handleConfirm);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) handleCancel();
        });
    });
    
    if (!confirmed) {
        console.log('❌ Eliminación cancelada por el usuario');
        return;
    }
    
    try {
        const { getDatabase, ref, remove } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
        
        const db = getDatabase();
        const auth = getAuth();
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
            throw new Error('Usuario no autenticado');
        }
        
        // Normalizar chatId
        if (chatId.startsWith('trade_trade_')) {
            chatId = chatId.replace('trade_trade_', 'trade_');
        }
        
        console.log('🗑️ Eliminando referencia userChat:', currentUser.uid);
        
        // Eliminar solo la referencia del usuario actual
        const userChatRef = ref(db, `userChats/${currentUser.uid}/${chatId}`);
        await remove(userChatRef);
        
        // También agregar a la lista de chats ocultos en localStorage para evitar que vuelva a aparecer
        const hiddenChatsKey = `hiddenChats_${currentUser.uid}`;
        let hiddenChats = [];
        try {
            hiddenChats = JSON.parse(localStorage.getItem(hiddenChatsKey) || '[]');
        } catch (e) {
            console.error('Error al leer chats ocultos:', e);
        }
        
        if (!hiddenChats.includes(chatId)) {
            hiddenChats.push(chatId);
            localStorage.setItem(hiddenChatsKey, JSON.stringify(hiddenChats));
            console.log('✅ Chat agregado a lista de chats ocultos');
        }
        
        console.log('✅ Chat eliminado para el usuario actual');
        
        // Cerrar ventana si está abierta
        const chatWindow = document.getElementById(`chat-window-${chatId}`);
        if (chatWindow) {
            chatWindow.remove();
        }
        
        // Actualizar UI
        if (window.chatUI) {
            window.chatUI.activeChats.delete(chatId);
            window.chatUI.minimizedChats.delete(chatId);
            window.chatUI.removeFromSavedChats(chatId);
            window.chatUI.updateMinimizedBar();
            window.chatUI.updateChatBadge();
            window.chatUI.showNotification('Chat eliminado correctamente', 'success');
        }
        
        // Disparar evento
        window.dispatchEvent(new Event('chatDeleted'));
        

        
    } catch (error) {
        console.error('❌ Error al eliminar chat:', error);
        if (window.chatUI) {
            window.chatUI.showNotification('Error al eliminar el chat', 'error');
        }
    }
};

// Función de diagnóstico para ver por qué no se puede eliminar
window.diagnoseChat = async function(chatId) {
    console.log('🔍 Diagnosticando chat:', chatId);
    
    try {
        const { getDatabase, ref, get } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
        
        const db = getDatabase();
        const auth = getAuth();
        const currentUser = auth.currentUser;
        
        console.log('👤 Usuario actual:', currentUser?.uid, currentUser?.email);
        
        // Normalizar chatId
        if (chatId.startsWith('trade_trade_')) {
            chatId = chatId.replace('trade_trade_', 'trade_');
        }
        
        // Obtener datos del chat
        const chatRef = ref(db, `chats/${chatId}`);
        const snapshot = await get(chatRef);
        
        if (!snapshot.exists()) {
            console.log('❌ El chat no existe');
            return;
        }
        
        const chatData = snapshot.val();
        console.log('📊 Datos del chat:', chatData);
        
        // Verificar participantes
        if (chatData?.metadata?.participants) {
            const participants = Object.entries(chatData.metadata.participants);
            console.log('👥 Participantes:');
            participants.forEach(([uid, data]) => {
                console.log(`  - ${uid}: ${data.email || data.displayName || 'Sin nombre'}`);
            });
            
            // Verificar permisos en userChats
            console.log('\n🔐 Verificando permisos de userChats:');
            for (const [userId, userData] of participants) {
                try {
                    const userChatRef = ref(db, `userChats/${userId}/${chatId}`);
                    const userChatSnap = await get(userChatRef);
                    
                    if (userChatSnap.exists()) {
                        console.log(`  ✅ userChats/${userId}/${chatId} existe`);
                    } else {
                        console.log(`  ⚠️ userChats/${userId}/${chatId} NO existe`);
                    }
                } catch (err) {
                    console.log(`  ❌ Error accediendo a userChats/${userId}:`, err.message);
                }
            }
        }
        
        // Contar mensajes
        const messageCount = Object.keys(chatData.messages || {}).length;
        console.log(`\n💬 Total de mensajes: ${messageCount}`);
        
        // Verificar creador
        console.log(`\n📝 Creado: ${new Date(chatData.metadata?.createdAt).toLocaleString()}`);
        console.log(`🏷️ Es chat de intercambio: ${chatData.metadata?.isTradeChat || false}`);
        
    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
    }
};

// Función de diagnóstico para chats ocultos
window.debugHiddenChats = function() {
    const auth = window.chatManager?.auth;
    if (!auth?.currentUser) {
        console.error('❌ Usuario no autenticado');
        return;
    }
    
    const userId = auth.currentUser.uid;
    const hiddenChatsKey = `hiddenChats_${userId}`;
    const hiddenChats = localStorage.getItem(hiddenChatsKey);
    
    console.log('🔍 Debug de Chats Ocultos:');
    console.log('👤 Usuario:', userId);
    console.log('🔑 Key localStorage:', hiddenChatsKey);
    console.log('📦 Valor en localStorage:', hiddenChats);
    console.log('📋 Chats ocultos parseados:', hiddenChats ? JSON.parse(hiddenChats) : []);
    
    // Verificar todos los items en localStorage
    console.log('\n📂 Todos los items en localStorage:');
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('hiddenChats')) {
            console.log(`  ${key}:`, localStorage.getItem(key));
        }
    }
};

// Función para limpiar chats ocultos
window.clearHiddenChats = function() {
    const auth = window.chatManager?.auth;
    if (!auth?.currentUser) {
        console.error('❌ Usuario no autenticado');
        return;
    }
    
    const userId = auth.currentUser.uid;
    const hiddenChatsKey = `hiddenChats_${userId}`;
    
    localStorage.removeItem(hiddenChatsKey);
    console.log('✅ Chats ocultos limpiados');
    
    // Actualizar la UI
    if (window.chatUI) {
        window.dispatchEvent(new Event('chatDeleted'));
    }
};

// Función para migrar y normalizar chats ocultos
window.migrateHiddenChats = function() {
    const auth = window.chatManager?.auth;
    if (!auth?.currentUser) {
        console.error('❌ Usuario no autenticado');
        return;
    }
    
    const userId = auth.currentUser.uid;
    const hiddenChatsKey = `hiddenChats_${userId}`;
    
    try {
        let hiddenChats = JSON.parse(localStorage.getItem(hiddenChatsKey) || '[]');
        console.log('📋 Chats ocultos antes de migración:', hiddenChats);
        
        // Normalizar todos los IDs
        const normalizedChats = hiddenChats.map(id => {
            if (id.startsWith('trade_trade_')) {
                const newId = id.replace('trade_trade_', 'trade_');
                console.log(`🔄 Migrando: ${id} → ${newId}`);
                return newId;
            }
            return id;
        });
        
        // Eliminar duplicados
        const uniqueChats = [...new Set(normalizedChats)];
        
        // Guardar la lista normalizada
        localStorage.setItem(hiddenChatsKey, JSON.stringify(uniqueChats));
        console.log('✅ Chats ocultos después de migración:', uniqueChats);
        
        // Actualizar UI
        window.dispatchEvent(new Event('chatDeleted'));
    } catch (e) {
        console.error('❌ Error al migrar:', e);
    }
};

// Función manual para ocultar un chat
window.manualHideChat = function(chatId) {
    const auth = window.chatManager?.auth;
    if (!auth?.currentUser) {
        console.error('❌ Usuario no autenticado');
        return;
    }
    
    // Normalizar chatId
    if (chatId.startsWith('trade_trade_')) {
        chatId = chatId.replace('trade_trade_', 'trade_');
        console.log('📝 ChatId normalizado a:', chatId);
    }
    
    const userId = auth.currentUser.uid;
    const hiddenChatsKey = `hiddenChats_${userId}`;
    
    // Obtener lista actual
    let hiddenChats = [];
    try {
        hiddenChats = JSON.parse(localStorage.getItem(hiddenChatsKey) || '[]');
    } catch (e) {
        console.error('Error al leer:', e);
    }
    
    // Añadir si no existe
    if (!hiddenChats.includes(chatId)) {
        hiddenChats.push(chatId);
        localStorage.setItem(hiddenChatsKey, JSON.stringify(hiddenChats));
        console.log('✅ Chat ocultado manualmente:', chatId);
        console.log('📋 Lista de ocultos:', hiddenChats);
        
        // Actualizar UI
        window.dispatchEvent(new Event('chatDeleted'));
        
        // Cerrar ventana si está abierta
        const chatWindow = document.getElementById(`chat-window-${chatId}`);
        if (chatWindow) chatWindow.remove();
        
        // Actualizar UI de chat
        if (window.chatUI) {
            window.chatUI.activeChats.delete(chatId);
            window.chatUI.minimizedChats.delete(chatId);
            window.chatUI.updateMinimizedBar();
            window.chatUI.updateChatBadge();
        }
    } else {
        console.log('⚠️ El chat ya estaba oculto');
    }
};

export default ChatUI;