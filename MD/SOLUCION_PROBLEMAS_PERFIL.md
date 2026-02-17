# Solución a Problemas de Guardado en "Mi Perfil" y "Configuración"

## 🔍 Diagnóstico de Problemas

### Problemas Identificados:
1. **Guardado de datos personales** en la pestaña "Mi Perfil" no funciona
2. **Cambio de contraseña** en la pestaña "Configuración > Seguridad" no funciona
3. **Falta de información** sobre dónde se almacenan los datos

## 📊 Estructura de Almacenamiento de Datos

### 🔐 Credenciales de Acceso (Firebase Authentication)
- **Ubicación**: Firebase Console > Authentication > Users
- **Datos almacenados**:
  - Email del usuario
  - Contraseña (hasheada y segura)
  - UID único del usuario
  - Fecha de creación de la cuenta
  - Último inicio de sesión

### 👤 Datos del Perfil (Firestore Database)
- **Ubicación**: Firebase Console > Firestore Database > users/{uid}
- **Estructura del documento**:
```json
{
  "username": "usuario123",
  "email": "usuario@email.com",
  "name": "Nombre",
  "lastName": "Apellidos",
  "address": "Dirección completa",
  "birthDate": "1990-01-01",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 🃏 Colección de Cartas (Firestore Database)
- **Ubicación**: Firebase Console > Firestore Database > users/{uid}/cards
- **Estructura del documento**:
```json
{
  "id": "base1-1",
  "name": "Alakazam",
  "number": "1",
  "imageUrl": "https://images.pokemontcg.io/base1/1.png",
  "set": "Base Set",
  "series": "Base",
  "language": "Spanish",
  "addedAt": "2024-01-01T00:00:00.000Z"
}
```

### 📈 Estadísticas (Calculadas en Tiempo Real)
- **Total de cartas**: Contadas desde la colección de cartas
- **Cartas por set**: Agrupadas por el campo "set"
- **Intercambios completados**: Futuro - se almacenarán en colección separada

## 🔧 Pasos para Debuggear los Problemas

### 1. Verificar Conexión con Firebase
1. Ve a la aplicación web
2. Inicia sesión con tu cuenta
3. Ve a "Mi Perfil" > "Mi Perfil" (primera pestaña)
4. Haz clic en "🔧 Probar Conexión Firebase"
5. Revisa el mensaje que aparece

### 2. Verificar Consola del Navegador
1. Abre las herramientas de desarrollador (F12)
2. Ve a la pestaña "Console"
3. Intenta guardar cambios en el perfil
4. Busca mensajes que empiecen con:
   - `🔧 saveProfileData iniciada`
   - `🔧 changePassword iniciada`
   - `❌ Error al guardar datos del perfil`
   - `❌ Error al cambiar contraseña`

### 3. Verificar Reglas de Firestore
1. Ve a Firebase Console > Firestore Database > Rules
2. Asegúrate de que las reglas permitan lectura/escritura para usuarios autenticados:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir acceso a usuarios autenticados
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Permitir acceso a subcolecciones
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // Regla para documentos de prueba
    match /test/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🛠️ Soluciones Implementadas

### Mejoras en Debugging:
1. **Logs detallados** en `saveProfileData()` y `changePassword()`
2. **Verificación de inicialización** de Firebase Auth y Firestore
3. **Mensajes de error específicos** para diferentes tipos de errores
4. **Función de prueba de conexión** mejorada con información detallada

### Validaciones Añadidas:
1. **Verificación de usuario autenticado**
2. **Validación de campos obligatorios**
3. **Validación de formato de email**
4. **Verificación de Firebase inicializado**

## 🚨 Posibles Causas de Error

### 1. Problemas de Autenticación
- **Síntoma**: "Debes iniciar sesión para guardar cambios"
- **Solución**: Cerrar sesión y volver a iniciar sesión

### 2. Problemas de Permisos en Firestore
- **Síntoma**: "No tienes permisos para guardar estos datos"
- **Solución**: Verificar reglas de Firestore en Firebase Console

### 3. Problemas de Conexión
- **Síntoma**: "Servicio temporalmente no disponible"
- **Solución**: Verificar conexión a internet y estado de Firebase

### 4. Problemas de Reautenticación
- **Síntoma**: "Por seguridad, debes volver a iniciar sesión"
- **Solución**: Cerrar sesión y volver a iniciar sesión

## 📋 Pasos para Probar

### Prueba 1: Guardado de Perfil
1. Inicia sesión en la aplicación
2. Ve a "Mi Perfil" > "Mi Perfil"
3. Completa los campos obligatorios (Nombre, Apellidos, Email)
4. Haz clic en "💾 Guardar Cambios"
5. Revisa la consola del navegador para mensajes de debug
6. Verifica que aparece el mensaje de éxito

### Prueba 2: Cambio de Contraseña
1. Ve a "Mi Perfil" > "Configuración" > "Seguridad"
2. Completa los campos:
   - Contraseña actual
   - Nueva contraseña (mínimo 6 caracteres)
   - Confirmar nueva contraseña
3. Haz clic en "🔐 Cambiar Contraseña"
4. Revisa la consola del navegador para mensajes de debug
5. Verifica que aparece el mensaje de éxito

### Prueba 3: Conexión Firebase
1. Haz clic en "🔧 Probar Conexión Firebase"
2. Revisa el mensaje que aparece
3. Si hay errores, revisa la consola del navegador

## 📞 Contacto para Soporte

Si los problemas persisten después de seguir estos pasos:

1. **Captura de pantalla** del mensaje de error
2. **Logs de la consola** del navegador
3. **Descripción detallada** de los pasos realizados
4. **Información del navegador** (Chrome, Firefox, etc.)

## 🔄 Próximos Pasos

Una vez que se resuelvan los problemas de guardado:

1. **Implementar "Mi Colección"** - Mostrar cartas del usuario con filtros
2. **Implementar "Mis Intercambios"** - Historial de intercambios
3. **Sistema de Reputación** - Puntuación y comentarios
4. **Logros y Badges** - Sistema de gamificación
5. **Notificaciones** - Alertas de nuevos intercambios