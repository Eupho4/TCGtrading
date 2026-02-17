# Estructura de Datos - TCGtrade App

## 🔥 Firebase Firestore - Estructura de Base de Datos

### 📁 Colección: `users`
Cada usuario tiene un documento único identificado por su `uid` de Firebase Auth.

#### Documento: `users/{uid}`
```javascript
{
  name: "Nombre del usuario",
  lastName: "Apellidos del usuario", 
  email: "usuario@ejemplo.com",
  address: "Dirección del usuario (opcional)",
  birthDate: "1990-01-01 (opcional)",
  createdAt: Timestamp, // Fecha de creación del perfil
  updatedAt: Timestamp  // Última actualización del perfil
}
```

### 📁 Subcolección: `users/{uid}/my_cards`
Cada usuario tiene una subcolección con sus cartas de Pokémon TCG.

#### Documento: `users/{uid}/my_cards/{cardId}`
```javascript
{
  id: "base1-1", // ID único de la carta
  name: "Alakazam",
  imageUrl: "https://images.pokemontcg.io/base1/1.png",
  set: "Base Set",
  series: "Base",
  number: "1",
  language: "Español",
  setId: "base1", // ID del set extraído del cardId
  addedAt: Timestamp // Fecha cuando se añadió a la colección
}
```

## 🔐 Firebase Authentication

### Usuarios Registrados
- **Email/Password**: Autenticación tradicional
- **Datos almacenados**: Email, UID único, metadata de creación

### Datos de Sesión
- Se mantienen en memoria durante la sesión
- Se sincronizan con Firestore al cargar el perfil

## 🛠️ Funciones Principales

### 1. Registro de Usuario
```javascript
// Al registrar un usuario:
await setDoc(doc(db, 'users', user.uid), {
  name: username,
  email: user.email,
  createdAt: new Date(),
  updatedAt: new Date()
});
```

### 2. Actualización de Perfil
```javascript
// Al guardar cambios del perfil:
await setDoc(doc(db, 'users', currentUser.uid), profileData, { merge: true });
```

### 3. Añadir Carta a Colección
```javascript
// Al añadir una carta:
await setDoc(doc(db, `users/${currentUser.uid}/my_cards/${cardId}`), cardData);
```

### 4. Eliminar Carta de Colección
```javascript
// Al eliminar una carta:
await deleteDoc(doc(db, `users/${currentUser.uid}/my_cards/${cardId}`));
```

### 5. Cargar Colección del Usuario
```javascript
// Al cargar las cartas del usuario:
const myCardsCollectionRef = collection(db, `users/${userId}/my_cards`);
const querySnapshot = await getDocs(myCardsCollectionRef);
```

## 🔧 Problemas Corregidos

### ❌ Problemas Anteriores:
1. **Estructura inconsistente**: Se usaba `artifacts/${appId}/users/` en lugar de `users/`
2. **Campos incorrectos**: Se usaba `username` en lugar de `name`
3. **Manejo de errores**: Mensajes de error poco descriptivos
4. **Validaciones**: Faltaban validaciones en formularios

### ✅ Soluciones Implementadas:
1. **Estructura unificada**: Todos los datos usan `users/{uid}`
2. **Campos correctos**: Se usa `name` y `lastName` consistentemente
3. **Manejo de errores mejorado**: Mensajes específicos por tipo de error
4. **Validaciones completas**: Validación de email, contraseñas, campos obligatorios

## 📊 Flujo de Datos

### Registro → Perfil → Colección
1. **Registro**: Se crea documento en `users/{uid}`
2. **Perfil**: Se cargan/actualizan datos del documento
3. **Colección**: Se gestionan cartas en subcolección `my_cards`

### Autenticación → Sincronización
1. **Login**: Se verifica usuario en Firebase Auth
2. **Carga**: Se obtienen datos de Firestore
3. **Sincronización**: Se mantienen datos actualizados

## 🔒 Seguridad

### Reglas de Firestore (Recomendadas)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuarios solo pueden acceder a sus propios datos
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Subcolección de cartas
      match /my_cards/{cardId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## 🚀 Despliegue

### Variables de Entorno Necesarias:
- `POKEMON_TCG_API_KEY`: Para acceder a la API de Pokémon TCG
- Configuración de Firebase ya incluida en el código

### Plataformas Soportadas:
- **Railway**: Configurado con `railway.json`
- **Netlify**: Configurado con `netlify.toml`
- **Vercel**: Configurado con `vercel.json`

## 📝 Notas Importantes

1. **Firebase Auth**: Maneja la autenticación de usuarios
2. **Firestore**: Almacena datos del perfil y colección de cartas
3. **Estructura unificada**: Todos los datos siguen el mismo patrón
4. **Manejo de errores**: Mensajes específicos para cada tipo de error
5. **Validaciones**: Completas en todos los formularios