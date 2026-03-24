# 🔥 Configuración de Firestore para TCGtrade

## ⚠️ IMPORTANTE: Configurar Reglas de Seguridad

Para que la migración y sincronización funcionen correctamente, necesitas configurar las reglas de seguridad de Firestore.

### 📋 Pasos para Configurar:

#### 1. **Acceder a Firebase Console**
- Ve a [Firebase Console](https://console.firebase.google.com/)
- Selecciona tu proyecto: `tcgtrade-7ba27`

#### 2. **Ir a Firestore Database**
- En el menú lateral, haz clic en **"Firestore Database"**
- Haz clic en la pestaña **"Rules"**

#### 3. **Reemplazar las Reglas Actuales**
Copia y pega el siguiente código en el editor de reglas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Reglas para colecciones de usuarios
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Subcolecciones del usuario
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // Reglas para colecciones de usuarios (userCollections)
    match /userCollections/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para el índice global de cartas transferibles
    match /transferable_cards/{cardId} {
      // Cualquier usuario autenticado puede leer (para ver cartas disponibles)
      allow read: if request.auth != null;

      match /users/{userId} {
        // Cualquier usuario autenticado puede leer entradas de transferibles
        allow read: if request.auth != null;
        // Solo el propietario puede escribir o borrar su propia entrada
        allow write, delete: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // Reglas para intercambios (trades)
    match /trades/{tradeId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.userId || 
         request.auth.uid == request.resource.data.userId);
    }
    
    // Reglas para valoraciones (ratings)
    match /ratings/{ratingId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.raterUserId || 
         request.auth.uid == request.resource.data.raterUserId);
    }
    
    // Reglas para chats (ya existentes)
    match /chats/{chatId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid in resource.data.participants || 
         request.auth.uid in request.resource.data.participants);
    }
    
    // Reglas para chats de usuarios (userChats)
    match /userChats/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para mensajes
    match /messages/{messageId} {
      allow read, write: if request.auth != null;
    }
    
    // Reglas para estadísticas de usuarios
    match /userStats/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para notificaciones
    match /notifications/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para configuraciones de usuario
    match /userSettings/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para logs de actividad
    match /activityLogs/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para favoritos
    match /favorites/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para wishlist
    match /wishlist/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para historial de búsquedas
    match /searchHistory/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para datos de migración
    match /migrationStatus/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para backups
    match /backups/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para datos temporales
    match /temp/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para datos compartidos (solo lectura para usuarios autenticados)
    match /shared/{document=**} {
      allow read: if request.auth != null;
      allow write: if false; // Solo lectura para datos compartidos
    }
    
    // Reglas para datos públicos (solo lectura)
    match /public/{document=**} {
      allow read: if true;
      allow write: if false; // Solo lectura para datos públicos
    }
    
    // Denegar todo lo demás
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

#### 4. **Publicar las Reglas**
- Haz clic en **"Publish"** para aplicar las nuevas reglas
- Espera a que se confirme la publicación

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