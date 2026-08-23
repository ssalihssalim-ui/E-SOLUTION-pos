// ==================== FIREBASE CONFIGURATION - E-SOLUTION ====================
// 🔥 PROJET : E-SOLUTION-pos

const firebaseConfig = {
    apiKey: "VOTRE_API_KEY",
    authDomain: "VOTRE_PROJECT_ID.firebaseapp.com",
    projectId: "VOTRE_PROJECT_ID",
    storageBucket: "VOTRE_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "VOTRE_SENDER_ID",
    appId: "VOTRE_APP_ID"
};

// Initialisation Firebase (version compat)
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase initialisé avec le projet:', firebaseConfig.projectId);
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Activer la persistance offline
db.enablePersistence()
    .then(() => console.log('📱 Mode hors ligne activé'))
    .catch(err => console.warn('⚠️ Persistance désactivée:', err));

console.log('🚀 E-SOLUTION - Point de Vente');
console.log('✓ Projet:', firebaseConfig.projectId);
console.log('✓ Auth Domain:', firebaseConfig.authDomain);
