# 🔥 Configuración de Firestore para TCGtrade

## ⚠️ IMPORTANTE: Desplegar Reglas de Seguridad

Para que el sistema de marcado de cartas transferibles funcione correctamente, **debes desplegar las reglas de Firestore** a tu proyecto de Firebase.

### 📋 Pasos para Configurar:

#### 1. **Acceder a Firebase Console**
- Ve a [Firebase Console](https://console.firebase.google.com/)
- Selecciona tu proyecto: `tcgtrade-7ba27`

#### 2. **Ir a Firestore Database**
- En el menú lateral, haz clic en **"Firestore Database"**
- Haz clic en la pestaña **"Rules"**

#### 3. **Reemplazar las Reglas Actuales**
Copia y pega el contenido del archivo `firestore.rules` de este repositorio en el editor de reglas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Reglas para la colección de usuarios
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Subcolecciones del usuario (my_cards, trades, ratings, etc.)
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // Reglas para colecciones de usuarios (userCollections)
    match /userCollections/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para el índice global de cartas transferibles
    // NECESARIAS para que funcione el marcado/desmarcado de cartas para intercambio
    match /transferable_cards/{cardId} {
      // Cualquier usuario autenticado puede leer (para buscar cartas disponibles)
      allow read: if request.auth != null;

      match /users/{userId} {
        // Cualquier usuario autenticado puede leer entradas de transferibles
        allow read: if request.auth != null;
        // Solo el propietario puede crear, actualizar o borrar su propia entrada
        allow write: if request.auth != null && request.auth.uid == userId;
      }
    }

    // Reglas para chats de usuarios
    match /userChats/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Reglas para notificaciones
    match /notifications/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Denegar acceso por defecto a otras colecciones
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

#### 4. **Publicar las Reglas**
- Haz clic en **"Publish"** para aplicar las nuevas reglas
- Espera a que se confirme la publicación

> 💡 **Nota**: El archivo `firestore.rules` en el repositorio contiene siempre las reglas actualizadas. Asegúrate de copiar su contenido exacto cuando actualices las reglas en Firebase Console.

### 🔍 **Estructura de Datos en Firestore:**

```
📁 users/
  └── {userId}/
      ├── 📁 my_cards/          # Colección personal
      ├── 📁 trades/            # Intercambios del usuario
      ├── 📁 ratings/           # Valoraciones del usuario
      ├── 📁 favorites/         # Cartas favoritas
      ├── 📁 wishlist/          # Lista de deseos
      └── 📁 settings/          # Configuraciones

📁 userCollections/
  └── {userId}                  # Documento de colección consolidada

📁 transferable_cards/          # Índice global de cartas para intercambio
  └── {cardId}/
      └── 📁 users/
          └── {userId}          # Entrada del usuario que ofrece esa carta

📁 chats/
  └── {chatId}                  # Chats entre usuarios

📁 userChats/
  └── {userId}                  # Referencias de chats del usuario

📁 messages/
  └── {messageId}               # Mensajes de chat
```

### ✅ **Verificación:**

Después de configurar las reglas:

1. **Recarga la aplicación** en el navegador
2. **Inicia sesión** con tu cuenta
3. **Abre la consola** del navegador (F12)
4. **Verifica los logs** de migración:
   ```
   🔄 Iniciando migración automática...
   ✅ Intercambios migrados exitosamente a Firestore
   ✅ Valoraciones migradas exitosamente a Firestore
   🎉 Migración completada exitosamente
   ```

### 🚨 **Si Sigues Teniendo Errores:**

1. **Verifica** que las reglas se publicaron correctamente
2. **Espera** 1-2 minutos para que se propaguen
3. **Limpia** el cache del navegador (Ctrl+Shift+R)
4. **Revisa** la consola para errores específicos

### 📞 **Soporte:**

Si necesitas ayuda, comparte:
- El error exacto de la consola
- La configuración actual de las reglas
- El ID de tu usuario de Firebase

---

**¡Una vez configurado, tendrás persistencia real y sincronización entre dispositivos!** 🎉