# 🔥 Firebase - Configuración Completa y Base de Datos

## 📍 **Dónde Se Almacenan Todos Los Datos**

### 🗄️ **Firebase Firestore Database**

#### **1. Colección: `users/{uid}`**
```
📁 users/
├── {uid_usuario_1}/
│   ├── name: "Juan"
│   ├── lastName: "Pérez"
│   ├── email: "juan@ejemplo.com"
│   ├── address: "Calle Principal 123"
│   ├── birthDate: "1990-01-01"
│   ├── createdAt: Timestamp
│   └── updatedAt: Timestamp
│
├── {uid_usuario_2}/
│   ├── name: "María"
│   ├── lastName: "García"
│   ├── email: "maria@ejemplo.com"
│   └── ...
```

#### **2. Subcolección: `users/{uid}/my_cards/{cardId}`**
```
📁 users/{uid}/my_cards/
├── base1-1/
│   ├── id: "base1-1"
│   ├── name: "Alakazam"
│   ├── imageUrl: "https://images.pokemontcg.io/base1/1.png"
│   ├── set: "Base Set"
│   ├── series: "Base"
│   ├── number: "1"
│   ├── language: "Español"
│   ├── setId: "base1"
│   └── addedAt: Timestamp
│
├── base1-2/
│   ├── id: "base1-2"
│   ├── name: "Blastoise"
│   └── ...
```

### 🔐 **Firebase Authentication**

#### **Datos de Usuario Autenticado:**
```
📁 Authentication/
├── Users/
│   ├── {uid_usuario_1}/
│   │   ├── email: "juan@ejemplo.com"
│   │   ├── emailVerified: true/false
│   │   ├── displayName: null
│   │   ├── photoURL: null
│   │   ├── disabled: false
│   │   ├── metadata/
│   │   │   ├── creationTime: "2024-01-01T00:00:00Z"
│   │   │   └── lastSignInTime: "2024-01-15T12:00:00Z"
│   │   └── providerData/
│   │       └── [0]/
│   │           ├── uid: "juan@ejemplo.com"
│   │           ├── email: "juan@ejemplo.com"
│   │           └── providerId: "password"
│   │
│   └── {uid_usuario_2}/
│       └── ...
```

## ⚙️ **Configuración de Firebase**

### **1. Proyecto Firebase Actual**
```
Proyecto: tcgtrade-7ba27
ID del Proyecto: tcgtrade-7ba27
Dominio de Auth: tcgtrade-7ba27.firebaseapp.com
```

### **2. Configuración en el Código**
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyCkgz6_Zpu0VOW6GgJxOxd9QlVccsBXnog",
    authDomain: "tcgtrade-7ba27.firebaseapp.com",
    projectId: "tcgtrade-7ba27",
    storageBucket: "tcgtrade-7ba27.firebasestorage.app",
    messagingSenderId: "207150886257",
    appId: "1:207150886257:web:26edebbeb7df7a1d935ad0",
};
```

## 🔧 **Reglas de Seguridad de Firestore**

### **Archivo: `firestore.rules`**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Reglas para la colección de usuarios
    match /users/{userId} {
      // Permitir lectura y escritura solo al propietario del documento
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Reglas para la subcolección de cartas del usuario
      match /my_cards/{cardId} {
        // Permitir lectura y escritura solo al propietario
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // Reglas para otras colecciones (si las hay)
    match /{document=**} {
      // Denegar acceso por defecto a otras colecciones
      allow read, write: if false;
    }
  }
}
```

## 🚀 **Cómo Configurar Firebase Correctamente**

### **Paso 1: Acceder a Firebase Console**
1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Selecciona tu proyecto `tcgtrade-7ba27`

### **Paso 2: Configurar Firestore Database**
1. Ve a "Firestore Database" en el menú lateral
2. Si no está creada, haz clic en "Create database"
3. Selecciona "Start in test mode" (temporalmente)
4. Elige la ubicación más cercana (ej: `us-central1`)

### **Paso 3: Configurar Reglas de Seguridad**
1. Ve a "Firestore Database" → "Rules"
2. Reemplaza las reglas existentes con el contenido de `firestore.rules`
3. Haz clic en "Publish"

### **Paso 4: Configurar Authentication**
1. Ve a "Authentication" en el menú lateral
2. Ve a la pestaña "Sign-in method"
3. Habilita "Email/Password"
4. Configura las opciones según necesites

### **Paso 5: Verificar Configuración**
1. Ve a "Project settings" (ícono de engranaje)
2. En "General", verifica que la configuración coincida con el código
3. En "Service accounts", puedes generar claves adicionales si es necesario

## 🔍 **Solución de Problemas de Permisos**

### **Error: "No tienes suficientes permisos"**

#### **Causas Comunes:**
1. **Reglas de Firestore no configuradas**
2. **Usuario no autenticado**
3. **UID no coincide**
4. **Reglas demasiado restrictivas**

#### **Soluciones:**

##### **1. Verificar Reglas de Firestore**
```javascript
// Reglas temporales para testing (NO usar en producción)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // PERMITIR TODO (solo para testing)
    }
  }
}
```

##### **2. Verificar Autenticación**
```javascript
// En la consola del navegador
console.log('Usuario actual:', currentUser);
console.log('UID:', currentUser?.uid);
console.log('Email:', currentUser?.email);
```

##### **3. Verificar Estructura de Datos**
```javascript
// Verificar que la ruta sea correcta
console.log('Ruta del documento:', `users/${currentUser.uid}`);
```

### **Error: "Error al cambiar contraseña"**

#### **Causas Comunes:**
1. **Usuario no reautenticado**
2. **Contraseña actual incorrecta**
3. **Nueva contraseña muy débil**
4. **Sesión expirada**

#### **Soluciones:**

##### **1. Reautenticación Manual**
```javascript
// Forzar reautenticación
const credential = EmailAuthProvider.credential(email, password);
await reauthenticateWithCredential(currentUser, credential);
```

##### **2. Verificar Contraseña**
- Asegúrate de que la contraseña actual sea correcta
- La nueva contraseña debe tener al menos 6 caracteres

##### **3. Cerrar y Volver a Iniciar Sesión**
```javascript
// Cerrar sesión y volver a iniciar
await signOut(auth);
// Luego iniciar sesión nuevamente
```

## 📊 **Estructura Completa de Datos**

### **Flujo de Datos:**
```
1. Usuario se registra → Firebase Auth crea usuario
2. Se crea documento en Firestore → users/{uid}
3. Usuario añade cartas → users/{uid}/my_cards/{cardId}
4. Usuario modifica perfil → Actualiza users/{uid}
5. Usuario cambia contraseña → Actualiza Firebase Auth
```

### **Datos Sincronizados:**
- **Firebase Auth**: Email, contraseña, metadata
- **Firestore**: Perfil completo, colección de cartas
- **Sesión**: Datos en memoria durante la sesión

## 🛠️ **Comandos de Firebase CLI**

### **Instalar Firebase CLI:**
```bash
npm install -g firebase-tools
```

### **Inicializar Proyecto:**
```bash
firebase login
firebase init
```

### **Deploy de Reglas:**
```bash
firebase deploy --only firestore:rules
```

### **Ver Reglas Actuales:**
```bash
firebase firestore:rules:get
```

## 🔒 **Seguridad Recomendada**

### **Reglas de Producción:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /my_cards/{cardId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

### **Validaciones Adicionales:**
- Verificar email verificado
- Límites de tamaño de documentos
- Validación de datos en frontend y backend

## 📞 **Soporte Técnico**

### **Si los problemas persisten:**
1. Verifica la consola del navegador para errores
2. Revisa los logs de Firebase Console
3. Verifica que las reglas estén publicadas
4. Asegúrate de que el usuario esté autenticado
5. Prueba con reglas temporales para aislar el problema

### **Recursos Útiles:**
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Auth](https://firebase.google.com/docs/auth)