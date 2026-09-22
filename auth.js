// ==================== AUTH.JS - E-SOLUTION (CORRIGÉ) ====================
var currentUser = null;
var currentUserData = null;

// ==================== CONNEXION ====================
function handleLogin(event) {
    event.preventDefault();
    var email = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value;
    var btn = document.getElementById('loginBtn');
    
    if (!email || !password) { 
        showLoginError('Veuillez remplir tous les champs'); 
        return false; 
    }
    
    btn.disabled = true; 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';
    hideLoginError();
    
    auth.signInWithEmailAndPassword(email, password)
        .then(function(uc) { 
            return db.collection('users').doc(uc.user.uid).get(); 
        })
        .then(async function(doc) {
            if (!doc.exists) { 
                auth.signOut(); 
                showLoginError('Compte introuvable'); 
                return; 
            }
            
            var userData = doc.data();
            
            if (userData.authorized !== 'yes') { 
                auth.signOut(); 
                showLoginError('Compte en attente de validation'); 
                return; 
            }
            
            window.currentUserData = { uid: doc.id, userData: userData };
            await CacheDB.set('users', doc.id, window.currentUserData);
            
            // 🔥 DÉMARRER LE CACHE APRÈS LOGIN RÉUSSI
            if (window.CacheDB && window.CacheDB.startAfterLogin) {
                setTimeout(function() { 
                    window.CacheDB.startAfterLogin(); 
                }, 300);
            }
            
            if (userData.role === 'client') showClientPage(); 
            else showDashboard();
        })
        .catch(function(error) {
            var msg = 'Erreur de connexion';
            if (error.code === 'auth/user-not-found') msg = 'Email introuvable';
            else if (error.code === 'auth/wrong-password') msg = 'Mot de passe incorrect';
            else if (error.code === 'auth/invalid-email') msg = 'Email invalide';
            else if (error.code === 'auth/too-many-requests') msg = 'Trop de tentatives, réessayez plus tard';
            else if (error.code === 'auth/network-request-failed') msg = 'Problème de connexion réseau';
            else if (error.code === 'auth/invalid-login-credentials') msg = 'Email ou mot de passe incorrect';
            showLoginError(msg);
        })
        .finally(function() { 
            btn.disabled = false; 
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Se connecter'; 
        });
    return false;
}

// ==================== ERREURS LOGIN ====================
function showLoginError(msg) {
    var el = document.getElementById('loginError');
    if (!el) { 
        el = document.createElement('div'); 
        el.id = 'loginError'; 
        el.style.cssText = 'background:#fee2e2;color:#991b1b;padding:12px 15px;border-radius:12px;margin-bottom:15px;font-size:0.9rem;text-align:center;border:2px solid #fecaca;'; 
        var form = document.getElementById('loginForm'); 
        if (form) form.parentNode.insertBefore(el, form); 
    }
    el.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + msg; 
    el.style.display = 'block';
}

function hideLoginError() { 
    var e = document.getElementById('loginError'); 
    if (e) e.style.display = 'none'; 
}

// ==================== INSCRIPTION ====================
function handleRegister(event) {
    event.preventDefault();
    var nom = document.getElementById('regNom').value.trim(), 
        prenom = document.getElementById('regPrenom').value.trim(), 
        username = document.getElementById('regUsername').value.trim(), 
        email = document.getElementById('regEmail').value.trim(), 
        telephone = document.getElementById('regTelephone').value.trim(), 
        role = document.getElementById('regRole').value, 
        password = document.getElementById('regPassword').value, 
        btn = document.getElementById('registerBtn');
    
    var msgBox = document.getElementById('registerMsgBox');
    if (!msgBox) { 
        msgBox = document.createElement('div'); 
        msgBox.id = 'registerMsgBox'; 
        msgBox.style.cssText = 'padding:12px 15px;border-radius:12px;margin-bottom:15px;font-size:0.9rem;text-align:center;display:none;'; 
        var container = document.querySelector('#registerContainer .register-form'); 
        if (container) container.insertBefore(msgBox, container.firstChild); 
    }
    msgBox.style.display = 'none';
    
    if (!nom || !prenom || !username || !email || !telephone || !role || !password) { 
        msgBox.style.background = '#fee2e2'; 
        msgBox.style.color = '#991b1b'; 
        msgBox.style.border = '2px solid #fecaca'; 
        msgBox.innerHTML = 'Tous les champs sont obligatoires'; 
        msgBox.style.display = 'block'; 
        return false; 
    }
    
    if (password.length < 6) { 
        msgBox.style.background = '#fee2e2'; 
        msgBox.style.color = '#991b1b'; 
        msgBox.style.border = '2px solid #fecaca'; 
        msgBox.innerHTML = 'Mot de passe: 6 caractères minimum'; 
        msgBox.style.display = 'block'; 
        return false; 
    }
    
    btn.disabled = true; 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Création...';
    
    auth.createUserWithEmailAndPassword(email, password)
        .then(function(uc) { 
            return db.collection('users').doc(uc.user.uid).set({ 
                nom: nom, 
                prenom: prenom, 
                username: username, 
                email: email, 
                telephone: telephone, 
                role: role, 
                authorized: 'no', 
                createdAt: firebase.firestore.FieldValue.serverTimestamp() 
            }); 
        })
        .then(async function() {
            btn.disabled = false; 
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Créer mon compte';
            msgBox.style.background = '#dcfce7'; 
            msgBox.style.color = '#16a34a'; 
            msgBox.style.border = '2px solid #bbf7d0';
            msgBox.innerHTML = '✅ Compte créé avec succès ! En attente de validation.'; 
            msgBox.style.display = 'block';
            document.getElementById('registerForm').reset();
            setTimeout(function() { showLogin(); }, 2000);
        })
        .catch(function(error) {
            btn.disabled = false; 
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Créer mon compte';
            var msg = 'Erreur'; 
            if (error.code === 'auth/email-already-in-use') msg = 'Cet email est déjà utilisé'; 
            else if (error.code === 'auth/weak-password') msg = 'Mot de passe trop faible';
            else if (error.code === 'auth/invalid-email') msg = 'Email invalide';
            msgBox.style.background = '#fee2e2'; 
            msgBox.style.color = '#991b1b'; 
            msgBox.style.border = '2px solid #fecaca'; 
            msgBox.innerHTML = msg; 
            msgBox.style.display = 'block';
        });
    return false;
}

// ==================== DÉCONNEXION ====================
function handleLogout() { 
    auth.signOut().then(function() { 
        window.currentUser = null; 
        window.currentUserData = null; 
        
        // 🛑 ARRÊTER LE CACHE
        if (window.CacheDB && window.CacheDB.stopAfterLogout) {
            window.CacheDB.stopAfterLogout();
        }
        
        showAuthPage(); 
    }); 
}

// ==================== NAVIGATION ENTRE PAGES ====================
function showLogin() { 
    document.getElementById('loginContainer').classList.remove('hidden'); 
    document.getElementById('registerContainer').classList.add('hidden'); 
    hideLoginError(); 
}

function showRegister() { 
    document.getElementById('loginContainer').classList.add('hidden'); 
    document.getElementById('registerContainer').classList.remove('hidden'); 
    hideLoginError(); 
}

function showAuthPage() { 
    document.getElementById('authPage').classList.remove('hidden'); 
    document.getElementById('dashboardPage').classList.add('hidden'); 
    document.getElementById('clientPage').classList.add('hidden'); 
}

console.log('🚀 E-SOLUTION - Auth JS OK (corrigé avec CacheDB.startAfterLogin)');
