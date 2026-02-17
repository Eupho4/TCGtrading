/**
 * Authentication Module
 * Handles user authentication, registration, and session management
 */

import { 
    auth, 
    db,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateEmail,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    doc,
    setDoc,
    getDoc
} from './firebase-config.js';

import { showNotification, setCurrentUser } from './utils.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from './constants.js';

// Current user state
let currentUser = null;

/**
 * Initialize authentication state listener
 */
export function initAuth(callback) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            setCurrentUser(user);
            
            // Load user profile data
            const userProfile = await getUserProfile(user.uid);
            if (userProfile) {
                currentUser = { ...user, ...userProfile };
                setCurrentUser(currentUser);
            }
            
            updateUIForAuthenticatedUser();
        } else {
            currentUser = null;
            setCurrentUser(null);
            updateUIForUnauthenticatedUser();
        }
        
        if (callback) callback(currentUser);
    });
}

/**
 * Login user with email and password
 */
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        showNotification(SUCCESS_MESSAGES.LOGIN, 'success');
        closeAuthModal();
        return userCredential.user;
    } catch (error) {
        let errorMessage = ERROR_MESSAGES.INVALID_CREDENTIALS;
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No existe una cuenta con este email.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Contraseña incorrecta.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Email inválido.';
        }
        
        showNotification(errorMessage, 'error');
        throw error;
    }
}

/**
 * Register new user
 */
export async function registerUser(email, password, username) {
    try {
        // Create user account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create user profile in Firestore
        const userDoc = {
            uid: user.uid,
            email: user.email,
            username: username || email.split('@')[0],
            usuario: username || email.split('@')[0], // Campo bloqueado
            createdAt: new Date().toISOString(),
            name: '',
            lastName: '',
            address: '',
            phone: '',
            totalCards: 0,
            totalTrades: 0,
            completedTrades: 0
        };
        
        await setDoc(doc(db, 'users', user.uid), userDoc);
        
        showNotification(SUCCESS_MESSAGES.REGISTER, 'success');
        closeAuthModal();
        return user;
    } catch (error) {
        let errorMessage = ERROR_MESSAGES.GENERIC_ERROR;
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = ERROR_MESSAGES.USER_EXISTS;
        } else if (error.code === 'auth/weak-password') {
            errorMessage = ERROR_MESSAGES.WEAK_PASSWORD;
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Email inválido.';
        }
        
        showNotification(errorMessage, 'error');
        throw error;
    }
}

/**
 * Logout current user
 */
export async function logoutUser() {
    try {
        await signOut(auth);
        setCurrentUser(null);
        showNotification(SUCCESS_MESSAGES.LOGOUT, 'success');
        
        // Redirect to home
        window.location.href = '#';
        location.reload();
    } catch (error) {
        showNotification('Error al cerrar sesión', 'error');
    }
}

/**
 * Send password reset email
 */
export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        showNotification(SUCCESS_MESSAGES.PASSWORD_RESET, 'success');
        return true;
    } catch (error) {
        let errorMessage = 'Error al enviar el email de recuperación.';
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No existe una cuenta con este email.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Email inválido.';
        }
        
        showNotification(errorMessage, 'error');
        throw error;
    }
}

/**
 * Update user email
 */
export async function updateUserEmail(newEmail, currentPassword) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('No user logged in');
        
        // Re-authenticate user
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        
        // Update email
        await updateEmail(user, newEmail);
        
        // Update Firestore
        await setDoc(doc(db, 'users', user.uid), { email: newEmail }, { merge: true });
        
        showNotification('Email actualizado correctamente', 'success');
        return true;
    } catch (error) {
        showNotification('Error al actualizar el email', 'error');
        throw error;
    }
}

/**
 * Update user password
 */
export async function updateUserPassword(currentPassword, newPassword) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('No user logged in');
        
        // Re-authenticate user
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        
        // Update password
        await updatePassword(user, newPassword);
        
        showNotification('Contraseña actualizada correctamente', 'success');
        return true;
    } catch (error) {
        showNotification('Error al actualizar la contraseña', 'error');
        throw error;
    }
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            return userDoc.data();
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Update user profile
 */
export async function updateUserProfile(uid, profileData) {
    try {
        await setDoc(doc(db, 'users', uid), profileData, { merge: true });
        showNotification(SUCCESS_MESSAGES.PROFILE_UPDATED, 'success');
        return true;
    } catch (error) {
        showNotification('Error al actualizar el perfil', 'error');
        throw error;
    }
}

/**
 * Show authentication modal
 */
export function showAuthModal(mode = 'login') {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    
    modal.classList.add('show');
    
    // Show appropriate form
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    
    if (mode === 'login') {
        loginForm?.classList.remove('hidden');
        registerForm?.classList.add('hidden');
        forgotPasswordForm?.classList.add('hidden');
    } else if (mode === 'register') {
        loginForm?.classList.add('hidden');
        registerForm?.classList.remove('hidden');
        forgotPasswordForm?.classList.add('hidden');
    } else if (mode === 'forgot') {
        loginForm?.classList.add('hidden');
        registerForm?.classList.add('hidden');
        forgotPasswordForm?.classList.remove('hidden');
    }
}

/**
 * Close authentication modal
 */
export function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

/**
 * Update UI for authenticated user
 */
function updateUIForAuthenticatedUser() {
    // Update navigation
    document.getElementById('loginNavLink')?.classList.add('hidden');
    document.getElementById('registerNavLink')?.classList.add('hidden');
    document.getElementById('profileNavLink')?.classList.remove('hidden');
    document.getElementById('logoutNavLink')?.classList.remove('hidden');
    
    // Update user display
    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay && currentUser) {
        userDisplay.textContent = currentUser.username || currentUser.email;
    }
}

/**
 * Update UI for unauthenticated user
 */
function updateUIForUnauthenticatedUser() {
    // Update navigation
    document.getElementById('loginNavLink')?.classList.remove('hidden');
    document.getElementById('registerNavLink')?.classList.remove('hidden');
    document.getElementById('profileNavLink')?.classList.add('hidden');
    document.getElementById('logoutNavLink')?.classList.add('hidden');
    
    // Clear user display
    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay) {
        userDisplay.textContent = '';
    }
}

/**
 * Get current user
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
    return currentUser !== null;
}