// ==================== FIREBASE CONFIGURATION - E-SOLUTION ====================
// 🔥 PROJET : E-SOLUTION-pos

const firebaseConfig = {
    apiKey: "AIzaSyVOTRE_CLE_API",
    authDomain: "e-solution-pos.firebaseapp.com",
    projectId: "e-solution-pos",
    storageBucket: "e-solution-pos.firebasestorage.app",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};

// Initialisation Firebase
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
