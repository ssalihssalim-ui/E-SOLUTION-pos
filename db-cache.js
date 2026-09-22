// ==================== INDEXEDDB CACHE + PENDING OPERATIONS - E-SOLUTION ====================
// ✅ VERSION CORRIGÉE : ne démarre la sync qu'après connexion utilisateur

const DB_NAME = 'ESolutionDB';
const DB_VERSION = 2;
const CACHE_STORE = 'firestore_cache';
const PENDING_STORE = 'pending_operations';
const SYNC_LOG_STORE = 'sync_log';
const SETTINGS_STORE = 'app_settings';

let dbInstance = null;
let realtimeListeners = []; // ✅ Stocke les listeners pour pouvoir les fermer

// ==================== HELPER : Vérifier si connecté ====================
function isUserConnected() {
    try {
        return typeof firebase !== 'undefined' 
            && firebase.auth 
            && firebase.auth().currentUser !== null;
    } catch(e) {
        return false;
    }
}

function openDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance && dbInstance.name === DB_NAME) {
            resolve(dbInstance);
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains(CACHE_STORE)) {
                const cacheStore = db.createObjectStore(CACHE_STORE, { keyPath: 'id' });
                cacheStore.createIndex('collection', 'collection', { unique: false });
                cacheStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
            if (!db.objectStoreNames.contains(PENDING_STORE)) {
                const pendingStore = db.createObjectStore(PENDING_STORE, { keyPath: 'id' });
                pendingStore.createIndex('createdAt', 'createdAt', { unique: false });
            }
            if (!db.objectStoreNames.contains(SYNC_LOG_STORE)) {
                const syncLogStore = db.createObjectStore(SYNC_LOG_STORE, { keyPath: 'id' });
                syncLogStore.createIndex('timestamp', 'timestamp', { unique: false });
                syncLogStore.createIndex('collection', 'collection', { unique: false });
            }
            if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
                db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
            }
        };
    });
}

// ==================== FONCTIONS DE BASE DU CACHE ====================

async function cacheSet(collection, docId, data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, 'readwrite');
        const store = tx.objectStore(CACHE_STORE);
        const record = {
            id: `${collection}_${docId}`,
            collection,
            docId,
            data,
            updatedAt: Date.now()
        };
        const request = store.put(record);
        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error);
    });
}

async function cacheGet(collection, docId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, 'readonly');
        const store = tx.objectStore(CACHE_STORE);
        const request = store.get(`${collection}_${docId}`);
        request.onsuccess = () => resolve(request.result ? request.result.data : null);
        request.onerror = () => reject(request.error);
    });
}

async function cacheGetAll(collection) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, 'readonly');
        const store = tx.objectStore(CACHE_STORE);
        const index = store.index('collection');
        const request = index.getAll(collection);
        request.onsuccess = () => {
            const results = request.result;
            resolve(results.map(r => ({ id: r.docId, ...r.data })));
        };
        request.onerror = () => reject(request.error);
    });
}

async function cacheDelete(collection, docId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, 'readwrite');
        const store = tx.objectStore(CACHE_STORE);
        const request = store.delete(`${collection}_${docId}`);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function cacheClear() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, 'readwrite');
        const store = tx.objectStore(CACHE_STORE);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ==================== SYSTÈME DE SYNCHRONISATION ====================

let isProcessing = false;

function addPendingOperation(operation) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const tx = db.transaction(PENDING_STORE, 'readwrite');
        const store = tx.objectStore(PENDING_STORE);
        const id = Date.now() + '-' + Math.random().toString(36).substr(2, 6);
        const record = { id, ...operation, createdAt: Date.now() };
        const request = store.add(record);
        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error);
    });
}

async function getAllPendingOperations() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(PENDING_STORE, 'readonly');
        const store = tx.objectStore(PENDING_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function removePendingOperation(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(PENDING_STORE, 'readwrite');
        const store = tx.objectStore(PENDING_STORE);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function logSyncEvent(collection, action, docId, status, details = {}) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SYNC_LOG_STORE, 'readwrite');
        const store = tx.objectStore(SYNC_LOG_STORE);
        const record = {
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            collection,
            action,
            docId,
            status,
            details,
            timestamp: Date.now()
        };
        const request = store.add(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function processPendingOperations() {
    if (isProcessing) return;
    // ✅ Ne pas synchroniser si pas connecté
    if (!isUserConnected()) {
        console.log('⏭️ Sync ignorée : utilisateur non connecté');
        return;
    }
    isProcessing = true;
    try {
        const pending = await getAllPendingOperations();
        for (const op of pending) {
            try {
                let ref;
                if (op.type === 'add') {
                    ref = await db.collection(op.collection).add(op.data);
                    const newDoc = { id: ref.id, ...op.data };
                    await cacheSet(op.collection, ref.id, newDoc);
                    await logSyncEvent(op.collection, 'add', ref.id, 'success');
                } else if (op.type === 'set') {
                    await db.collection(op.collection).doc(op.docId).set(op.data, { merge: true });
                    const newDoc = { id: op.docId, ...op.data };
                    await cacheSet(op.collection, op.docId, newDoc);
                    await logSyncEvent(op.collection, 'set', op.docId, 'success');
                } else if (op.type === 'update') {
                    await db.collection(op.collection).doc(op.docId).update(op.data);
                    const existing = await cacheGet(op.collection, op.docId);
                    const updated = { ...existing, ...op.data };
                    await cacheSet(op.collection, op.docId, updated);
                    await logSyncEvent(op.collection, 'update', op.docId, 'success');
                } else if (op.type === 'delete') {
                    await db.collection(op.collection).doc(op.docId).delete();
                    await cacheDelete(op.collection, op.docId);
                    await logSyncEvent(op.collection, 'delete', op.docId, 'success');
                }
                await removePendingOperation(op.id);
            } catch (err) {
                console.warn('Échec synchro (réessaiera plus tard)', op, err.message);
                await logSyncEvent(op.collection, op.type, op.docId || 'N/A', 'error', { error: err.message });
            }
        }
    } finally {
        isProcessing = false;
    }
}

// ==================== SAUVEGARDE SYSTÉMATIQUE DES DONNÉES ====================

const COLLECTIONS_TO_SYNC = [
    'categories', 
    'products', 
    'clients', 
    'fournisseurs', 
    'ventes', 
    'credits', 
    'depenses', 
    'stock',
    'personnel',
    'commandes',
    'users'
];

async function saveCollectionToCache(collection) {
    // ✅ PROTECTION : rien si pas connecté
    if (!isUserConnected()) {
        return [];
    }
    
    try {
        console.log(`💾 Sauvegarde de la collection "${collection}" en cache...`);
        const snapshot = await db.collection(collection).get();
        const items = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            items.push({ id: doc.id, ...data });
            cacheSet(collection, doc.id, data);
        });
        
        console.log(`✅ ${items.length} documents sauvegardés pour "${collection}"`);
        return items;
    } catch(e) {
        // ✅ Ne pas spammer la console pour les erreurs de permission
        if (e.code === 'permission-denied') {
            console.warn(`⚠️ Accès refusé à "${collection}" (vérifier règles Firestore)`);
        } else {
            console.error(`❌ Erreur sauvegarde "${collection}":`, e.message);
        }
        return [];
    }
}

async function saveAllCollections() {
    // ✅ PROTECTION : rien si pas connecté
    if (!isUserConnected()) {
        console.log('⏭️ Sauvegarde ignorée : aucun utilisateur connecté');
        return false;
    }
    
    console.log('🔄 Démarrage de la sauvegarde systématique...');
    
    for (const collection of COLLECTIONS_TO_SYNC) {
        await saveCollectionToCache(collection);
    }
    
    await setSetting('last_full_sync', new Date().toISOString());
    console.log('✅ Sauvegarde systématique terminée');
    return true;
}

// ==================== GESTION DES PARAMÈTRES ====================

async function setSetting(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SETTINGS_STORE, 'readwrite');
        const store = tx.objectStore(SETTINGS_STORE);
        const record = { id: key, value };
        const request = store.put(record);
        request.onsuccess = () => resolve(value);
        request.onerror = () => reject(request.error);
    });
}

async function getSetting(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SETTINGS_STORE, 'readonly');
        const store = tx.objectStore(SETTINGS_STORE);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ? request.result.value : null);
        request.onerror = () => reject(request.error);
    });
}

// ==================== OUTILS DE SURVEILLANCE ====================

function createCollectionListener(collection) {
    if (!db || typeof db.collection !== 'function') return null;
    
    // ✅ PROTECTION : pas de listener si pas connecté
    if (!isUserConnected()) return null;
    
    try {
        return db.collection(collection).onSnapshot(
            snapshot => {
                // Log discret
                snapshot.docChanges().forEach(change => {
                    const docId = change.doc.id;
                    const data = change.doc.data();
                    
                    if (change.type === 'added' || change.type === 'modified') {
                        cacheSet(collection, docId, data);
                    } else if (change.type === 'removed') {
                        cacheDelete(collection, docId);
                    }
                });
            },
            error => {
                // ✅ Gestion silencieuse des erreurs de permission
                if (error.code === 'permission-denied') {
                    console.warn(`⚠️ Listener "${collection}" refusé par Firestore`);
                } else {
                    console.warn(`⚠️ Listener "${collection}":`, error.message);
                }
            }
        );
    } catch(e) {
        console.error(`❌ Erreur création listener "${collection}":`, e.message);
        return null;
    }
}

function setupRealtimeSync() {
    // ✅ PROTECTION : rien si pas connecté
    if (!isUserConnected()) {
        console.log('⏭️ Sync temps réel ignorée : pas connecté');
        return [];
    }
    
    console.log('🔄 Configuration de la synchronisation en temps réel...');
    
    // Fermer les anciens listeners
    realtimeListeners.forEach(l => {
        try { if (typeof l === 'function') l(); } catch(e) {}
    });
    realtimeListeners = [];
    
    COLLECTIONS_TO_SYNC.forEach(collection => {
        const listener = createCollectionListener(collection);
        if (listener) realtimeListeners.push(listener);
    });
    
    saveAllCollections();
    return realtimeListeners;
}

function stopRealtimeSync() {
    console.log('🛑 Arrêt de la synchronisation temps réel');
    realtimeListeners.forEach(l => {
        try { if (typeof l === 'function') l(); } catch(e) {}
    });
    realtimeListeners = [];
}

function isNetworkAvailable() {
    return navigator.onLine;
}

// ==================== FONCTION D'ÉCRITURE INTELLIGENTE ====================

async function writeDocument(collection, docId, data, type = 'set') {
    if (isNetworkAvailable() && isUserConnected()) {
        try {
            if (type === 'add') {
                const ref = await db.collection(collection).add(data);
                const newDoc = { id: ref.id, ...data };
                await cacheSet(collection, ref.id, newDoc);
                await logSyncEvent(collection, 'add', ref.id, 'success');
                return ref.id;
            } else if (type === 'set') {
                await db.collection(collection).doc(docId).set(data, { merge: true });
                const newDoc = { id: docId, ...data };
                await cacheSet(collection, docId, newDoc);
                await logSyncEvent(collection, 'set', docId, 'success');
                return docId;
            } else if (type === 'update') {
                await db.collection(collection).doc(docId).update(data);
                const existing = await cacheGet(collection, docId);
                const updated = { ...existing, ...data };
                await cacheSet(collection, docId, updated);
                await logSyncEvent(collection, 'update', docId, 'success');
                return docId;
            } else if (type === 'delete') {
                await db.collection(collection).doc(docId).delete();
                await cacheDelete(collection, docId);
                await logSyncEvent(collection, 'delete', docId, 'success');
                return docId;
            }
        } catch (err) {
            console.warn('Erreur réseau, mise en file d\'attente', err.message);
            await addPendingOperation({ type, collection, docId, data });
            await logSyncEvent(collection, type, docId || 'N/A', 'pending', { error: err.message });
            return null;
        }
    } else {
        await addPendingOperation({ type, collection, docId, data });
        await logSyncEvent(collection, type, docId || 'N/A', 'pending', { reason: 'offline' });
        return null;
    }
}

// ==================== EXPORTATION API ====================

window.CacheDB = {
    set: cacheSet,
    get: cacheGet,
    getAll: cacheGetAll,
    delete: cacheDelete,
    clear: cacheClear,
    sync: processPendingOperations,
    write: writeDocument,
    addPendingOperation,
    isOnline: () => navigator.onLine,
    
    saveCollection: saveCollectionToCache,
    saveAll: saveAllCollections,
    setupRealtime: setupRealtimeSync,
    stopRealtime: stopRealtimeSync,
    
    setSetting,
    getSetting,
    logSyncEvent,
    
    COLLECTIONS_TO_SYNC,
    
    // ✅ NOUVELLES FONCTIONS À APPELER DEPUIS AUTH.JS
    startAfterLogin: function() {
        console.log('🚀 Démarrage du cache après login...');
        this.setupRealtime();
        this.saveAll();
    },
    stopAfterLogout: function() {
        console.log('🛑 Arrêt du cache après logout');
        this.stopRealtime();
    }
};

// ==================== INITIALISATION ====================
// ✅ AUCUN démarrage automatique de sync : on attend le login

// Synchroniser quand la connexion réseau revient (SEULEMENT si connecté)
window.addEventListener('online', () => {
    if (isUserConnected()) {
        console.log('🟢 Connexion réseau rétablie');
        window.CacheDB.sync();
        window.CacheDB.saveAll();
    }
});

// Sauvegarde périodique : TOUTES LES 5 MIN, SEULEMENT SI CONNECTÉ
setInterval(() => {
    if (navigator.onLine && isUserConnected() && window.CacheDB) {
        console.log('⏰ Sauvegarde périodique (utilisateur connecté)...');
        window.CacheDB.saveAll();
    }
}, 5 * 60 * 1000);

console.log('🚀 E-SOLUTION - Cache DB prêt (démarrage conditionnel après login)');
