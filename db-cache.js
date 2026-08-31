// ==================== INDEXEDDB CACHE + PENDING OPERATIONS - E-SOLUTION ====================
const DB_NAME = 'ESolutionDB';
const DB_VERSION = 2; // Augmenté pour ajouter les nouveaux stores
const CACHE_STORE = 'firestore_cache';
const PENDING_STORE = 'pending_operations';
const SYNC_LOG_STORE = 'sync_log'; // Nouveau store pour le journal de synchronisation
const SETTINGS_STORE = 'app_settings'; // Nouveau store pour les paramètres

let dbInstance = null;

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
            
            // Store principal pour le cache des documents Firestore
            if (!db.objectStoreNames.contains(CACHE_STORE)) {
                const cacheStore = db.createObjectStore(CACHE_STORE, { keyPath: 'id' });
                cacheStore.createIndex('collection', 'collection', { unique: false });
                cacheStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
            
            // Store pour les opérations en attente (offline)
            if (!db.objectStoreNames.contains(PENDING_STORE)) {
                const pendingStore = db.createObjectStore(PENDING_STORE, { keyPath: 'id' });
                pendingStore.createIndex('createdAt', 'createdAt', { unique: false });
            }
            
            // Store pour le journal de synchronisation
            if (!db.objectStoreNames.contains(SYNC_LOG_STORE)) {
                const syncLogStore = db.createObjectStore(SYNC_LOG_STORE, { keyPath: 'id' });
                syncLogStore.createIndex('timestamp', 'timestamp', { unique: false });
                syncLogStore.createIndex('collection', 'collection', { unique: false });
            }
            
            // Store pour les paramètres de l'application
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
                console.warn('Échec synchro (réessaiera plus tard)', op, err);
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
        console.error(`❌ Erreur sauvegarde "${collection}":`, e);
        return [];
    }
}

async function saveAllCollections() {
    console.log('🔄 Démarrage de la sauvegarde systématique...');
    
    for (const collection of COLLECTIONS_TO_SYNC) {
        await saveCollectionToCache(collection);
    }
    
    // Mettre à jour l'horodatage de la dernière sauvegarde
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
    
    try {
        return db.collection(collection).onSnapshot(snapshot => {
            console.log(`🔔 Changement détecté dans "${collection}" (${snapshot.size} documents)`);
            
            snapshot.docChanges().forEach(change => {
                const docId = change.doc.id;
                const data = change.doc.data();
                
                if (change.type === 'added' || change.type === 'modified') {
                    cacheSet(collection, docId, data);
                } else if (change.type === 'removed') {
                    cacheDelete(collection, docId);
                }
            });
        });
    } catch(e) {
        console.error(`❌ Erreur création listener pour "${collection}":`, e);
        return null;
    }
}

function setupRealtimeSync() {
    console.log('🔄 Configuration de la synchronisation en temps réel...');
    
    const listeners = [];
    COLLECTIONS_TO_SYNC.forEach(collection => {
        const listener = createCollectionListener(collection);
        if (listener) listeners.push(listener);
    });
    
    // Sauvegarde initiale
    saveAllCollections();
    
    return listeners;
}

function isNetworkAvailable() {
    return navigator.onLine;
}

// ==================== FONCTION D'ÉCRITURE INTELLIGENTE ====================

async function writeDocument(collection, docId, data, type = 'set') {
    if (isNetworkAvailable()) {
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
            console.warn('Erreur réseau, mise en file d\'attente', err);
            const opRecord = await addPendingOperation({ type, collection, docId, data });
            await logSyncEvent(collection, type, docId || 'N/A', 'pending', { error: err.message });
            return null;
        }
    } else {
        const opRecord = await addPendingOperation({ type, collection, docId, data });
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
    
    // Nouvelles fonctions de sauvegarde systématique
    saveCollection: saveCollectionToCache,
    saveAll: saveAllCollections,
    setupRealtime: setupRealtimeSync,
    
    // Fonctions de paramètres
    setSetting,
    getSetting,
    
    // Fonctions de journal
    logSyncEvent,
    
    // Liste des collections à synchroniser
    COLLECTIONS_TO_SYNC
};

// Initialiser la sauvegarde automatique
window.addEventListener('load', () => {
    // Configurer les listeners temps réel
    setTimeout(() => {
        if (window.CacheDB) {
            window.CacheDB.setupRealtime();
        }
    }, 2000);
    
    // Synchroniser lorsque la connexion revient
    window.addEventListener('online', () => {
        console.log('🟢 Connexion rétablie – synchronisation automatique');
        if (window.CacheDB) {
            window.CacheDB.sync();
            window.CacheDB.saveAll();
        }
    });
    
    // Sauvegarde périodique (toutes les 5 minutes)
    setInterval(() => {
        if (navigator.onLine && window.CacheDB) {
            console.log('⏰ Sauvegarde périodique...');
            window.CacheDB.saveAll();
        }
    }, 5 * 60 * 1000);
});

console.log('🚀 E-SOLUTION - Cache DB avec sauvegarde systématique OK');
