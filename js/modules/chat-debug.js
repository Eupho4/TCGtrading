// Módulo de Debug para el Sistema de Chat
// Ayuda a diagnosticar problemas de bidireccionalidad

export class ChatDebugger {
    constructor(chatManager) {
        this.chatManager = chatManager;
        window.chatDebug = this; // Hacer disponible globalmente para debugging
    }
    
    // Verificar conexión con Firebase
    async testFirebaseConnection() {
        console.log('🔍 Probando conexión con Firebase Realtime Database...');
        
        try {
            // Usar la sintaxis correcta de Firebase v9
            const { ref, set } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
            const testRef = ref(this.chatManager.realtimeDb, 'test/connection');
            await set(testRef, {
                timestamp: Date.now(),
                user: this.chatManager.auth.currentUser?.uid || 'anonymous'
            });
            
            console.log('✅ Conexión con Firebase exitosa');
            return true;
        } catch (error) {
            console.error('❌ Error de conexión con Firebase:', error);
            return false;
        }
    }
    
    // Verificar que el chat existe y es accesible
    async verifyChatAccess(tradeId) {
        const chatId = `trade_${tradeId}`;
        console.log(`🔍 Verificando acceso al chat: ${chatId}`);
        
        try {
            const { ref, get } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
            const chatRef = ref(this.chatManager.realtimeDb, `chats/${chatId}`);
            const snapshot = await get(chatRef);
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                console.log('✅ Chat encontrado:', data);
                
                // Verificar participantes
                const participants = data.metadata?.participants || {};
                console.log('👥 Participantes:', Object.keys(participants));
                
                // Verificar mensajes
                const messages = data.messages || {};
                console.log(`💬 Número de mensajes: ${Object.keys(messages).length}`);
                
                return true;
            } else {
                console.log('⚠️ El chat no existe todavía');
                return false;
            }
        } catch (error) {
            console.error('❌ Error al verificar chat:', error);
            return false;
        }
    }
    
    // Enviar mensaje de prueba
    async sendTestMessage(tradeId, message = 'Mensaje de prueba') {
        const chatId = `trade_${tradeId}`;
        console.log(`📤 Enviando mensaje de prueba al chat: ${chatId}`);
        
        try {
            const messageId = await this.chatManager.sendMessage(chatId, message);
            console.log('✅ Mensaje enviado con ID:', messageId);
            return messageId;
        } catch (error) {
            console.error('❌ Error al enviar mensaje:', error);
            return null;
        }
    }
    
    // Escuchar mensajes en tiempo real y mostrar en consola
    async listenToChat(tradeId) {
        const chatId = `trade_${tradeId}`;
        console.log(`👂 Escuchando mensajes del chat: ${chatId}`);
        
        try {
            const { ref, onChildAdded, onChildChanged } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js');
            const messagesRef = ref(this.chatManager.realtimeDb, `chats/${chatId}/messages`);
            
            onChildAdded(messagesRef, (snapshot) => {
                const message = snapshot.val();
                const messageId = snapshot.key;
                
                console.log('📨 Nuevo mensaje recibido:', {
                    id: messageId,
                    sender: message.senderId,
                    text: message.message,
                    timestamp: message.timestamp ? new Date(message.timestamp).toLocaleString() : 'Sin timestamp'
                });
            });
            
            onChildChanged(messagesRef, (snapshot) => {
                const message = snapshot.val();
                const messageId = snapshot.key;
                
                console.log('✏️ Mensaje actualizado:', {
                    id: messageId,
                    read: message.read,
                    delivered: message.delivered
                });
            });
        } catch (error) {
            console.error('❌ Error al escuchar mensajes:', error);
        }
    }
    
    // Verificar estado actual del usuario
    checkUserStatus() {
        const user = this.chatManager.auth.currentUser;
        
        if (user) {
            console.log('👤 Usuario actual:', {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName
            });
        } else {
            console.log('⚠️ No hay usuario autenticado');
        }
        
        return user;
    }
    
    // Listar todos los chats del usuario
    async listUserChats() {
        console.log('📋 Obteniendo lista de chats...');
        
        try {
            const chats = await this.chatManager.getUserChats();
            
            if (chats.length === 0) {
                console.log('📭 No hay chats');
            } else {
                console.log(`📬 ${chats.length} chats encontrados:`);
                chats.forEach(chat => {
                    console.log(`  - ${chat.id}: ${chat.lastMessage || 'Sin mensajes'}`);
                });
            }
            
            return chats;
        } catch (error) {
            console.error('❌ Error al obtener chats:', error);
            return [];
        }
    }
    
    // Diagnóstico completo
    async runFullDiagnostic(tradeId) {
        console.log('🏥 Ejecutando diagnóstico completo del sistema de chat...');
        console.log('=' .repeat(50));
        
        // 1. Verificar usuario
        const user = this.checkUserStatus();
        if (!user) {
            console.error('❌ Debes estar autenticado para usar el chat');
            return;
        }
        
        // 2. Verificar conexión con Firebase
        const connected = await this.testFirebaseConnection();
        if (!connected) {
            console.error('❌ No hay conexión con Firebase');
            return;
        }
        
        // 3. Verificar acceso al chat
        if (tradeId) {
            const hasAccess = await this.verifyChatAccess(tradeId);
            
            // 4. Si el chat existe, escuchar mensajes
            if (hasAccess) {
                this.listenToChat(tradeId);
            }
            
            // 5. Enviar mensaje de prueba
            console.log('📝 ¿Quieres enviar un mensaje de prueba? Ejecuta:');
            console.log(`   chatDebug.sendTestMessage('${tradeId}', 'Tu mensaje aquí')`);
        }
        
        // 6. Listar todos los chats
        await this.listUserChats();
        
        console.log('=' .repeat(50));
        console.log('✅ Diagnóstico completado');
    }
}

// Hacer disponible globalmente
window.ChatDebugger = ChatDebugger;