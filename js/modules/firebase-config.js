/**
 * Firebase Configuration Module
 * Handles Firebase initialization and exports instances
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCkgz6_Zpu0VOW6GgJxOxd9QlVccsBXnog",
    authDomain: "tcgtrade-7ba27.firebaseapp.com",
    projectId: "tcgtrade-7ba27",
    storageBucket: "tcgtrade-7ba27.firebasestorage.app",
    messagingSenderId: "207150886257",
    appId: "1:207150886257:web:26edebbeb7df7a1d935ad0",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// App configuration
export const appId = 'tcgtrade-pokemon-app';

// Export Firebase methods for use in other modules
export { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    signInAnonymously, 
    signInWithCustomToken, 
    updateEmail, 
    updatePassword, 
    reauthenticateWithCredential, 
    EmailAuthProvider, 
    sendPasswordResetEmail 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

export { 
    doc, 
    setDoc, 
    getDoc, 
    collection, 
    getDocs, 
    deleteDoc 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';