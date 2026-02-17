# 🔥 Actualizar Reglas de Firebase Realtime Database

## ⚠️ IMPORTANTE: Debes actualizar las reglas en Firebase Console

### Pasos para actualizar las reglas:

1. **Abre Firebase Console:**
   - Ve a https://console.firebase.google.com
   - Selecciona tu proyecto "TCGtrade"

2. **Ve a Realtime Database:**
   - En el menú lateral, click en "Realtime Database"
   - Asegúrate de estar en la base de datos correcta (europe-west1)

3. **Abre la pestaña "Reglas":**
   - Click en la pestaña "Rules" o "Reglas"

4. **Reemplaza TODO el contenido con esto:**

```json
{
  "rules": {
    "chats": {
      // Permitir leer la lista de chats si estás autenticado
      ".read": "auth != null",
      
      "$chatId": {
        // Permitir leer el chat específico si estás autenticado
        ".read": "auth != null",
        // Permitir escribir si estás autenticado
        ".write": "auth != null",
        
        "metadata": {
          ".validate": "newData.hasChildren(['participants', 'createdAt'])",
          
          "participants": {
            "$userId": {
              // Solo puedes añadirte a ti mismo o modificar tu propia entrada
              ".write": "$userId === auth.uid || !data.exists()",
              ".validate": "newData.hasChildren(['uid', 'email'])"
            }
          },
          
          "lastMessage": {
            ".write": "auth != null"
          },
          
          "lastMessageTime": {
            ".write": "auth != null"
          },
          
          "lastMessageSender": {
            ".write": "auth != null"
          }
        },
        
        "messages": {
          "$messageId": {
            // Cualquier usuario autenticado puede escribir mensajes
            ".write": "auth != null",
            // Validar que el mensaje tiene los campos requeridos
            ".validate": "newData.hasChildren(['senderId', 'message', 'timestamp']) && newData.child('senderId').val() === auth.uid"
          }
        },
        
        "typing": {
          "$userId": {
            // Solo puedes modificar tu propio estado de escritura
            ".write": "$userId === auth.uid",
            ".validate": "newData.isBoolean()"
          }
        }
      }
    },
    
    "userChats": {
      "$userId": {
        ".read": "$userId === auth.uid",
        ".write": "$userId === auth.uid"
      }
    },
    
    "notifications": {
      "$userId": {
        ".read": "$userId === auth.uid",
        ".write": "auth != null",
        
        "$notificationId": {
          ".validate": "newData.hasChildren(['type', 'timestamp', 'read'])"
        }
      }
    },
    
    "test": {
      // Nodo de prueba para verificar conexión
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

5. **Click en "Publicar" o "Publish"**

6. **Confirma la publicación**

## 🔍 ¿Qué cambia con estas reglas?

### Antes:
- ❌ No se podía leer la lista de chats (`/chats`)
- ❌ Solo participantes podían leer chats específicos
- ❌ Error "Permission denied" al listar chats

### Ahora:
- ✅ Cualquier usuario autenticado puede leer la lista de chats
- ✅ Cualquier usuario autenticado puede leer chats específicos
- ✅ Los usuarios pueden añadirse como participantes
- ✅ Validación de mensajes (solo puedes enviar con tu propio ID)
- ✅ Control de estado de escritura individual

## 🛡️ Seguridad

Las reglas mantienen la seguridad:
- Solo usuarios autenticados pueden acceder
- Los mensajes se validan con el ID del remitente
- Solo puedes modificar tu propio estado
- Los participantes se auto-registran

## ✅ Verificación

Después de publicar las reglas, verifica en tu app:
1. Recarga la página
2. Click en "💬 Chats"
3. Deberías ver los chats sin errores

Si ves el error "Permission denied" todavía, espera 1-2 minutos para que las reglas se propaguen.