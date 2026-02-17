import { getFirestore, doc, setDoc, getDoc, collection, getDocs, updateDoc, deleteDoc, serverTimestamp, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

class DataMigration {
    constructor(auth, db) {
        this.auth = auth;
        this.db = db;
        this.isMigrating = false;
    }

    // Migrar colección personal del usuario
    async migrateUserCollection() {
        const user = this.auth.currentUser;
        if (!user) {
            console.log('❌ No hay usuario autenticado para migrar colección');
            return false;
        }

        try {
            console.log('🔄 Iniciando migración de colección personal...');
            
            // Obtener datos del localStorage
            const userCardsKey = `userCards_${user.uid}`;
            const localCards = JSON.parse(localStorage.getItem(userCardsKey) || '[]');
            
            if (localCards.length === 0) {
                console.log('📭 No hay cartas en localStorage para migrar');
                return true;
            }

            console.log(`📦 Migrando ${localCards.length} cartas a Firestore...`);

            // Crear documento de colección en Firestore
            const collectionRef = doc(this.db, 'userCollections', user.uid);
            const collectionData = {
                userId: user.uid,
                userEmail: user.email,
                cards: localCards,
                totalCards: localCards.length,
                lastUpdated: serverTimestamp(),
                migratedAt: serverTimestamp(),
                migrationVersion: '1.0'
            };

            await setDoc(collectionRef, collectionData);
            console.log('✅ Colección migrada exitosamente a Firestore');

            // Marcar como migrado en localStorage
            localStorage.setItem(`collectionMigrated_${user.uid}`, 'true');
            
            return true;

        } catch (error) {
            console.error('❌ Error al migrar colección:', error);
            return false;
        }
    }

    // Limpiar y validar datos de intercambios
    cleanTradeData(trades) {
        return trades.filter(trade => {
            // Verificar que tenga los campos mínimos necesarios
            if (!trade.id || !trade.name) {
                console.warn('⚠️ Intercambio inválido (falta ID o nombre):', trade);
                return false;
            }
            
            // Limpiar campos que puedan causar problemas
            if (trade.id.includes('undefined') || trade.id.includes('null')) {
                console.warn('⚠️ Intercambio con ID inválido:', trade);
                return false;
            }
            
            return true;
        }).map(trade => ({
            ...trade,
            // Asegurar que los campos requeridos estén presentes
            id: trade.id.toString(),
            name: trade.name || 'Intercambio sin nombre',
            createdAt: trade.createdAt || new Date(),
            status: trade.status || 'pending'
        }));
    }

    // Migrar intercambios del usuario
    async migrateUserTrades() {
        const user = this.auth.currentUser;
        if (!user) {
            console.log('❌ No hay usuario autenticado para migrar intercambios');
            return false;
        }

        try {
            console.log('🔄 Iniciando migración de intercambios...');
            
            // Obtener datos del localStorage
            const userTradesKey = `userTrades_${user.uid}`;
            const localTrades = JSON.parse(localStorage.getItem(userTradesKey) || '[]');
            
            if (localTrades.length === 0) {
                console.log('📭 No hay intercambios en localStorage para migrar');
                return true;
            }

            // Limpiar y validar datos
            const cleanTrades = this.cleanTradeData(localTrades);
            console.log(`📦 Migrando ${cleanTrades.length} intercambios válidos a Firestore (${localTrades.length - cleanTrades.length} inválidos filtrados)...`);

            // Migrar cada intercambio individualmente usando la estructura de subcolección
            let successCount = 0;
            let errorCount = 0;
            
            for (const trade of cleanTrades) {
                try {
                    // Verificar que el trade tenga un ID válido
                    if (!trade.id) {
                        console.warn(`⚠️ Intercambio sin ID válido, saltando:`, trade);
                        errorCount++;
                        continue;
                    }
                    
                    // Usar subcolección del usuario para evitar problemas de permisos
                    const tradeRef = doc(this.db, 'users', user.uid, 'trades', trade.id);
                    const tradeData = {
                        ...trade,
                        userId: user.uid,
                        userEmail: user.email,
                        lastUpdated: serverTimestamp(),
                        migratedAt: serverTimestamp(),
                        migrationVersion: '1.0'
                    };

                    await setDoc(tradeRef, tradeData);
                    console.log(`✅ Intercambio ${trade.id} migrado`);
                    successCount++;
                } catch (tradeError) {
                    console.error(`❌ Error al migrar intercambio ${trade.id}:`, tradeError);
                    console.error(`   Detalles del intercambio:`, trade);
                    errorCount++;
                    // Continuar con el siguiente intercambio
                }
            }
            
            console.log(`📊 Migración de intercambios completada: ${successCount} exitosos, ${errorCount} errores`);

            console.log('✅ Intercambios migrados exitosamente a Firestore');

            // Marcar como migrado en localStorage
            localStorage.setItem(`tradesMigrated_${user.uid}`, 'true');
            
            return true;

        } catch (error) {
            console.error('❌ Error al migrar intercambios:', error);
            return false;
        }
    }

    // Migrar valoraciones del usuario
    async migrateUserRatings() {
        const user = this.auth.currentUser;
        if (!user) {
            console.log('❌ No hay usuario autenticado para migrar valoraciones');
            return false;
        }

        try {
            console.log('🔄 Iniciando migración de valoraciones...');
            
            // Obtener todas las valoraciones del localStorage
            const ratings = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('ratings_')) {
                    const userId = key.replace('ratings_', '');
                    const userRatings = JSON.parse(localStorage.getItem(key) || '[]');
                    ratings.push(...userRatings.map(rating => ({
                        ...rating,
                        ratedUserId: userId,
                        raterUserId: user.uid,
                        raterEmail: user.email
                    })));
                }
            }
            
            if (ratings.length === 0) {
                console.log('📭 No hay valoraciones en localStorage para migrar');
                return true;
            }

            console.log(`📦 Migrando ${ratings.length} valoraciones a Firestore...`);

            // Migrar cada valoración individualmente usando subcolección
            for (const rating of ratings) {
                try {
                    // Usar subcolección del usuario para evitar problemas de permisos
                    const ratingRef = doc(this.db, 'users', user.uid, 'ratings', `${rating.ratedUserId}_${rating.tradeId}`);
                    const ratingData = {
                        ...rating,
                        lastUpdated: serverTimestamp(),
                        migratedAt: serverTimestamp(),
                        migrationVersion: '1.0'
                    };

                    await setDoc(ratingRef, ratingData);
                    console.log(`✅ Valoración ${rating.ratedUserId}_${rating.tradeId} migrada`);
                } catch (ratingError) {
                    console.error(`❌ Error al migrar valoración ${rating.ratedUserId}_${rating.tradeId}:`, ratingError);
                    // Continuar con la siguiente valoración
                }
            }

            console.log('✅ Valoraciones migradas exitosamente a Firestore');

            // Marcar como migrado en localStorage
            localStorage.setItem(`ratingsMigrated_${user.uid}`, 'true');
            
            return true;

        } catch (error) {
            console.error('❌ Error al migrar valoraciones:', error);
            return false;
        }
    }

    // Verificar si ya se migró
    isAlreadyMigrated(dataType) {
        const user = this.auth.currentUser;
        if (!user) return false;

        const migrationKey = `${dataType}Migrated_${user.uid}`;
        return localStorage.getItem(migrationKey) === 'true';
    }

    // Migración completa
    async migrateAllData() {
        if (this.isMigrating) {
            console.log('⚠️ Migración ya en progreso...');
            return false;
        }

        this.isMigrating = true;
        console.log('🚀 Iniciando migración completa de datos...');

        try {
            const results = {
                collection: false,
                trades: false,
                ratings: false
            };

            // Migrar colección si no está migrada
            if (!this.isAlreadyMigrated('collection')) {
                results.collection = await this.migrateUserCollection();
            } else {
                console.log('✅ Colección ya migrada');
                results.collection = true;
            }

            // Migrar intercambios si no están migrados
            if (!this.isAlreadyMigrated('trades')) {
                results.trades = await this.migrateUserTrades();
            } else {
                console.log('✅ Intercambios ya migrados');
                results.trades = true;
            }

            // Migrar valoraciones si no están migradas
            if (!this.isAlreadyMigrated('ratings')) {
                results.ratings = await this.migrateUserRatings();
            } else {
                console.log('✅ Valoraciones ya migradas');
                results.ratings = true;
            }

            const allMigrated = Object.values(results).every(result => result === true);
            
            if (allMigrated) {
                console.log('🎉 ¡Migración completa exitosa!');
                localStorage.setItem(`fullMigrationCompleted_${this.auth.currentUser.uid}`, 'true');
            } else {
                console.log('⚠️ Migración parcial completada');
            }

            return allMigrated;

        } catch (error) {
            console.error('❌ Error en migración completa:', error);
            return false;
        } finally {
            this.isMigrating = false;
        }
    }

    // Obtener datos de Firestore
    async getUserCollection() {
        const user = this.auth.currentUser;
        if (!user) return [];

        try {
            const collectionRef = doc(this.db, 'userCollections', user.uid);
            const collectionSnap = await getDoc(collectionRef);
            
            if (collectionSnap.exists()) {
                return collectionSnap.data().cards || [];
            }
            
            return [];
        } catch (error) {
            console.error('❌ Error al obtener colección:', error);
            return [];
        }
    }

    async getUserTrades() {
        const user = this.auth.currentUser;
        if (!user) return [];

        try {
            const tradesRef = collection(this.db, 'users', user.uid, 'trades');
            const querySnapshot = await getDocs(tradesRef);
            
            const trades = [];
            querySnapshot.forEach((doc) => {
                trades.push({ id: doc.id, ...doc.data() });
            });
            
            return trades;
        } catch (error) {
            console.error('❌ Error al obtener intercambios:', error);
            return [];
        }
    }

    async getUserRatings() {
        const user = this.auth.currentUser;
        if (!user) return [];

        try {
            const ratingsRef = collection(this.db, 'users', user.uid, 'ratings');
            const querySnapshot = await getDocs(ratingsRef);
            
            const ratings = [];
            querySnapshot.forEach((doc) => {
                ratings.push({ id: doc.id, ...doc.data() });
            });
            
            return ratings;
        } catch (error) {
            console.error('❌ Error al obtener valoraciones:', error);
            return [];
        }
    }

    // Guardar datos en Firestore
    async saveUserCollection(cards) {
        const user = this.auth.currentUser;
        if (!user) return false;

        try {
            const collectionRef = doc(this.db, 'userCollections', user.uid);
            const collectionData = {
                userId: user.uid,
                userEmail: user.email,
                cards: cards,
                totalCards: cards.length,
                lastUpdated: serverTimestamp()
            };

            await setDoc(collectionRef, collectionData);
            return true;
        } catch (error) {
            console.error('❌ Error al guardar colección:', error);
            return false;
        }
    }

    async saveUserTrade(trade) {
        const user = this.auth.currentUser;
        if (!user) return false;

        try {
            const tradeRef = doc(this.db, 'users', user.uid, 'trades', trade.id);
            const tradeData = {
                ...trade,
                userId: user.uid,
                userEmail: user.email,
                lastUpdated: serverTimestamp()
            };

            await setDoc(tradeRef, tradeData);
            return true;
        } catch (error) {
            console.error('❌ Error al guardar intercambio:', error);
            return false;
        }
    }

    async saveUserRating(rating) {
        const user = this.auth.currentUser;
        if (!user) return false;

        try {
            const ratingRef = doc(this.db, 'users', user.uid, 'ratings', `${rating.ratedUserId}_${rating.tradeId}`);
            const ratingData = {
                ...rating,
                raterUserId: user.uid,
                raterEmail: user.email,
                lastUpdated: serverTimestamp()
            };

            await setDoc(ratingRef, ratingData);
            return true;
        } catch (error) {
            console.error('❌ Error al guardar valoración:', error);
            return false;
        }
    }
}

export default DataMigration;