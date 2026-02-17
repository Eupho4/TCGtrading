# Información de la Base de Datos - TCGtrade

## 📊 Estructura de la Base de Datos

### Firebase Firestore Collections

#### 1. **users** Collection
**Ruta:** `users/{userId}`

**Datos almacenados:**
- `username` (string) - Nombre de usuario único (solo lectura)
- `email` (string) - Correo electrónico del usuario
- `name` (string) - Nombre real del usuario
- `lastName` (string) - Apellidos del usuario
- `address` (string) - Dirección del usuario (opcional)
- `birthDate` (string) - Fecha de nacimiento (opcional)
- `createdAt` (timestamp) - Fecha de creación de la cuenta
- `updatedAt` (timestamp) - Fecha de última actualización

**Ejemplo de documento:**
```json
{
  "username": "usuario123",
  "email": "usuario@email.com",
  "name": "Juan",
  "lastName": "Pérez",
  "address": "Calle Principal 123",
  "birthDate": "1990-01-01",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

#### 2. **artifacts** Collection
**Ruta:** `artifacts/{appId}/users/{userId}/my_cards/{cardId}`

**Datos almacenados:**
- `id` (string) - ID único de la carta
- `name` (string) - Nombre de la carta
- `number` (string) - Número de la carta
- `series` (string) - Serie de la carta
- `set` (string) - Expansión de la carta
- `language` (string) - Idioma de la carta
- `imageUrl` (string) - URL de la imagen
- `addedAt` (timestamp) - Fecha de adición a la colección

### Firebase Authentication

**Datos almacenados en Firebase Auth:**
- `uid` (string) - ID único del usuario
- `email` (string) - Correo electrónico
- `password` (string) - Contraseña (hasheada)
- `emailVerified` (boolean) - Si el email está verificado
- `createdAt` (timestamp) - Fecha de creación
- `lastSignInAt` (timestamp) - Último inicio de sesión

## 🔧 Configuración de Firebase

### Proyecto: `tcgtrade-7ba27`
- **Project ID:** tcgtrade-7ba27
- **Auth Domain:** tcgtrade-7ba27.firebaseapp.com
- **Storage Bucket:** tcgtrade-7ba27.firebasestorage.app

### Reglas de Seguridad Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuarios pueden leer y escribir sus propios datos
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Usuarios pueden leer y escribir sus propias cartas
    match /artifacts/{appId}/users/{userId}/my_cards/{cardId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 🚨 Problemas Comunes y Soluciones

### 1. **Error al guardar datos del perfil**

**Síntomas:**
- Mensaje "Error al guardar los cambios"
- Datos no se actualizan en la base de datos

**Posibles causas:**
- Usuario no autenticado
- Problemas de conectividad con Firebase
- Reglas de seguridad incorrectas
- Datos de formulario inválidos

**Soluciones:**
1. Verificar que el usuario esté logueado
2. Hacer clic en "🔧 Probar Conexión Firebase" en la sección de perfil
3. Revisar la consola del navegador para errores específicos
4. Verificar que todos los campos obligatorios estén completos

### 2. **Error al cambiar contraseña**

**Síntomas:**
- Mensaje "Error al cambiar la contraseña"
- Contraseña no se actualiza

**Posibles causas:**
- Contraseña actual incorrecta
- Nueva contraseña muy débil
- Sesión expirada (requiere reautenticación)
- Problemas de conectividad

**Soluciones:**
1. Verificar que la contraseña actual sea correcta
2. Asegurar que la nueva contraseña tenga al menos 6 caracteres
3. Si aparece error de "requires-recent-login", cerrar sesión y volver a iniciar
4. Hacer clic en "🔧 Probar Conexión Firebase" para verificar conectividad

### 3. **Datos no se cargan en el perfil**

**Síntomas:**
- Campos del perfil aparecen vacíos
- Información no se muestra

**Posibles causas:**
- Usuario no tiene datos guardados en Firestore
- Problemas de lectura de la base de datos
- Errores en la función `loadUserInfo()`

**Soluciones:**
1. Verificar que el usuario haya completado su perfil previamente
2. Revisar la consola del navegador para errores
3. Intentar guardar datos nuevamente

## 🔍 Debugging

### 1. **Verificar conexión con Firebase**
Hacer clic en el botón "🔧 Probar Conexión Firebase" en cualquier sección del perfil.

### 2. **Revisar consola del navegador**
1. Abrir las herramientas de desarrollador (F12)
2. Ir a la pestaña "Console"
3. Buscar mensajes que empiecen con 🔧, ✅, o ❌

### 3. **Verificar estado de autenticación**
En la consola del navegador, escribir:
```javascript
console.log('Usuario actual:', currentUser);
console.log('Firebase Auth:', auth);
console.log('Firestore DB:', db);
```

## 📝 Flujo de Datos

### Registro de Usuario
1. Usuario completa formulario de registro
2. Se valida que el username sea único
3. Se crea cuenta en Firebase Auth
4. Se guarda información básica en Firestore (`users/{uid}`)

### Actualización de Perfil
1. Usuario modifica datos en "Mi Perfil"
2. Se validan los datos del formulario
3. Se actualiza documento en Firestore
4. Si el email cambió, se actualiza en Firebase Auth
5. Se muestra mensaje de éxito/error

### Cambio de Contraseña
1. Usuario ingresa contraseña actual y nueva
2. Se valida que la contraseña actual sea correcta
3. Se reautentica al usuario
4. Se actualiza la contraseña en Firebase Auth
5. Se muestra mensaje de éxito/error

## 🛠️ Mantenimiento

### Backup de Datos
Los datos se almacenan automáticamente en Firebase y se pueden exportar desde la consola de Firebase.

### Monitoreo
- Revisar logs de Firebase Console
- Monitorear uso de Firestore
- Verificar reglas de seguridad

### Escalabilidad
- Firestore escala automáticamente
- Límites de lectura/escritura: 1M operaciones/día (gratis)
- Para mayor uso, considerar plan de pago