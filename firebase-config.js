// ==================== FIREBASE CONFIGURATION - E-SOLUTION ====================
// 🔥 PROJET : E-SOLUTION-pos-58f41

const firebaseConfig = {
    apiKey: "AIzaSyDt_qhcNBn-2kOj3RRwo1fu_WH02veIku0",
    authDomain: "e-solution-pos-58f41.firebaseapp.com",
    projectId: "e-solution-pos-58f41",
    storageBucket: "e-solution-pos-58f41.firebasestorage.app",
    messagingSenderId: "764968610205",
    appId: "1:764968610205:web:a023239ba77f09f7a0a774"
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
