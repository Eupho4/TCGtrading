# 💬 Sistema de Chat en Tiempo Real - Guía de Implementación

## 🚀 Características Implementadas

### 1. **Chat en Tiempo Real**
- Mensajería instantánea entre usuarios usando Firebase Realtime Database
- Ventanas de chat flotantes e independientes
- Múltiples chats simultáneos
- Indicador de estado online/offline
- Indicador de "escribiendo..."
- Marcado de mensajes como leídos

### 2. **Integración con Intercambios**
- Botón de chat en cada tarjeta de intercambio
- Chat contextualizado por intercambio
- Historial de conversación persistente
- Identificación automática de participantes

### 3. **Interfaz de Usuario**
- Ventanas de chat flotantes y arrastrables
- Diseño responsive y moderno
- Modo oscuro compatible
- Contador de mensajes no leídos
- Lista de conversaciones activas

### 4. **Notificaciones**
- Badge con contador de mensajes no leídos
- Actualización en tiempo real
- Notificaciones visuales en la navegación

## 📋 Componentes Creados

### Archivos JavaScript:
1. **`/js/modules/chat.js`** - Lógica del sistema de chat
   - Gestión de mensajes
   - Estado de presencia
   - Sincronización con Firebase

2. **`/js/modules/chat-ui.js`** - Interfaz de usuario del chat
   - Ventanas de chat
   - Renderizado de mensajes
   - Gestión de eventos UI

### Modificaciones en HTML:
- Importación de módulos de chat
- Botón "Chat" en tarjetas de intercambio
- Enlace "Chats" en la navegación
- Badge de mensajes no leídos

### Firebase:
- **`database.rules.json`** - Reglas de seguridad para Realtime Database
- Actualización de `firebase.json` para incluir database

## 🔧 Configuración en Firebase Console

### 1. Habilitar Realtime Database:
1. Ve a Firebase Console → Tu proyecto
2. En el menú lateral, busca "Realtime Database"
3. Click en "Crear base de datos"
4. Selecciona ubicación (ej: europe-west1)
5. Comienza en modo bloqueado (usaremos nuestras reglas)

### 2. Aplicar Reglas de Seguridad:
1. En Realtime Database → Reglas
2. Copia el contenido de `database.rules.json`
3. Pega y publica las reglas

### 3. Actualizar Configuración de Firebase:
Si necesitas la URL de la database, añádela a firebaseConfig:
```javascript
const firebaseConfig = {
    // ... configuración existente ...
    databaseURL: "https://tcgtrade-7ba27-default-rtdb.europe-west1.firebasedatabase.app"
};
```

## 💡 Cómo Usar el Sistema

### Para Usuarios:
1. **Iniciar un chat**: Click en el botón "💭 Chat" en cualquier intercambio
2. **Ver todas las conversaciones**: Click en "💬 Chats" en la navegación
3. **Enviar mensajes**: Escribir y presionar Enter o click en Enviar
4. **Minimizar chat**: Click en el botón ˅ en la ventana
5. **Cerrar chat**: Click en X en la ventana

### Para Desarrolladores:

#### Abrir un chat programáticamente:
```javascript
// Abrir chat para un intercambio
await openTradeChat(tradeId, otherUserId, tradeTitle);
```

#### Enviar mensaje programático:
```javascript
// Enviar mensaje de texto
await chatManager.sendMessage(chatId, "Hola!");

// Enviar oferta de carta
await chatManager.sendCardOffer(chatId, {
    id: "xy1-1",
    name: "Pikachu",
    imageUrl: "https://...",
    set: "XY Base"
});
```

#### Escuchar mensajes nuevos:
```javascript
chatManager.listenToMessages(chatId, (messages) => {
    console.log('Nuevos mensajes:', messages);
});
```

## 🎨 Personalización

### Colores y Estilos:
Los estilos están en `chat-ui.js`. Puedes modificar:
- Colores del header: `bg-gradient-to-r from-orange-500 to-orange-600`
- Tamaño de ventana: `w-96 h-[600px]`
- Posición: `bottom-4 right-4`

### Límites:
- Máximo de caracteres por mensaje: 500
- Mensajes cargados por chat: 50
- Timeout de "escribiendo": 3 segundos

## 🐛 Troubleshooting

### El chat no se abre:
1. Verificar que el usuario esté autenticado
2. Revisar la consola del navegador
3. Verificar que Realtime Database esté habilitada

### Mensajes no se envían:
1. Verificar reglas de seguridad en Firebase
2. Comprobar conexión a internet
3. Revisar límite de caracteres

### No aparece el indicador de "escribiendo":
- El indicador se resetea automáticamente después de 3 segundos
- Solo aparece cuando el otro usuario está escribiendo

## 🚀 Próximas Mejoras Sugeridas

1. **Envío de imágenes**: Subir fotos de cartas directamente
2. **Emojis**: Selector de emojis integrado
3. **Búsqueda**: Buscar en el historial de mensajes
4. **Notificaciones push**: Alertas del navegador
5. **Sonidos**: Notificación sonora de nuevos mensajes
6. **Videollamadas**: Integración con WebRTC
7. **Grupos**: Chats grupales para intercambios múltiples
8. **Archivos**: Compartir PDFs, listas de cartas
9. **Traducción**: Auto-traducción de mensajes
10. **Voz**: Mensajes de voz

## 📝 Notas Importantes

- Los mensajes se almacenan en Firebase Realtime Database
- El historial es persistente entre sesiones
- Los chats están vinculados a intercambios específicos
- Solo los participantes pueden ver los mensajes
- El sistema funciona en tiempo real sin necesidad de refrescar

## 🔒 Seguridad

- Solo usuarios autenticados pueden enviar mensajes
- Los usuarios solo pueden ver chats donde son participantes
- No se pueden modificar mensajes de otros usuarios
- Los IDs de chat son únicos y no predecibles

---

¡El sistema de chat está listo para usar! 🎉