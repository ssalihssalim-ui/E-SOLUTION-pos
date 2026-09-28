// ==================== CLIENT.JS - E-SOLUTION (VERSION FINALE POS IDENTIQUE) ====================
// ✅ Le client voit EXACTEMENT le même POS que l'admin/caissier
// ✅ Réutilise directement pos.js : buildFullPOS, filterProductGrid, updateCartOnly, etc.
// ✅ Barre de recherche : bouton "Afficher tout" → affiche la barre de recherche uniquement
// ✅ Étape de paiement identique (Étape 1 → Étape 2)
// ✅ SANS multi-paniers
// ✅ SANS boutons Tables / En ligne
// ✅ Mêmes dimensions / même responsive

var clientCart = [];
var clientStep = 1;
var clientIsClientMode = true;

// ==================== NAVIGATION CLIENT ====================
function clientNavigate(page) {
    var items = document.querySelectorAll('#clientPage .nav-item');
    items.forEach(function(item) { item.classList.remove('active'); });
    if (page === 'commander' && items[0]) items[0].classList.add('active');
    else if (page === 'historique' && items[1]) items[1].classList.add('active');
    else if (items[2]) items[2].classList.add('active');

    var titleEl = document.getElementById('clientPageTitle');
    if (titleEl) titleEl.textContent = page === 'commander' ? 'Commander' : page === 'historique' ? 'Mon historique' : 'Paramètres';

    if (page === 'commander') loadClientCommanderPage();
    else if (page === 'historique') loadClientHistoriquePage();
    else loadClientParametresPage();

    if (typeof closeClientSidebar === 'function') closeClientSidebar();
}

// ==================== PAGE COMMANDER (RÉUTILISE LE POS ADMIN) ====================
async function loadClientCommanderPage() {
    var c = document.getElementById('clientDynamicContent');
    if (!c) return;

    // ✅ Activer le mode client dans pos.js
    window.posIsClientMode = true;
    window.posHideMultiCarts = true;
    window.posHideTablesBtn = true;
    window.posHideEnLigneBtn = true;

    c.innerHTML = '<div style="text-align:center;padding:60px;"><i class="fas fa-spinner fa-spin" style="font-size:2.5rem;color:#14B8A6;"></i><p style="margin-top:15px;color:#64748b;">Chargement du menu...</p></div>';

    // ✅ Réinitialiser les variables pos.js pour le client
    posCart = clientCart.length > 0 ? clientCart.slice() : [];
    posStep = clientStep;
    posSelectedCategory = 'all';
    posViewMode = 'categories';
    posSelectedCategoryForView = null;
    posSearchQuery = '';
    posToolsVisible = false;
    posProductOffset = 0;

    // ✅ Pas de multi-paniers pour le client
    posMultiCarts = { 'client-panier': posCart };
    posCurrentCartId = 'client-panier';
    posMultiPaniersData = {
        'client-panier': {
            client: window.currentUserData ? {
                id: window.currentUserData.uid,
                name: window.currentUserData.userData.prenom + ' ' + window.currentUserData.userData.nom
            } : null,
            table: '',
            paymentMethod: 'espece',
            discountMAD: 0,
            amountGiven: 0,
            step: 1
        }
    };

    // ✅ Définir le client actuel
    posCurrentClient = window.currentUserData ? {
        id: window.currentUserData.uid,
        name: window.currentUserData.userData.prenom + ' ' + window.currentUserData.userData.nom
    } : null;

    // ✅ Charger les catégories et produits
    try {
        let cachedCategories = await CacheDB.getAll('categories');
        let cachedProducts = await CacheDB.getAll('products');

        if (cachedCategories.length) {
            posCategoriesList = cachedCategories.map(function(cat) {
                return { id: cat.id, nom: cat.nom, imageBase64: cat.imageBase64, recette: cat.recette || false, ordre: cat.ordre || 0 };
            });
        }
        if (cachedProducts.length) {
            posProductsList = cachedProducts.filter(function(p) { return p.disponible !== false; });
            productIndexBuilt = false;
        }
        if (posCategoriesList.length || posProductsList.length) {
            renderClientPOS();
        }
    } catch(e) { console.warn('Erreur cache client:', e); }

    // ✅ Puis Firestore
    try {
        const [cs, ps] = await Promise.all([
            db.collection('categories').get(),
            db.collection('products').get()
        ]);

        posCategoriesList = [];
        cs.forEach(function(d) {
            var dd = d.data();
            var cat = { id: d.id, nom: dd.nom, imageBase64: dd.imageBase64, recette: dd.recette || false, ordre: dd.ordre || 0 };
            posCategoriesList.push(cat);
            CacheDB.set('categories', d.id, cat);
        });

        posProductsList = [];
        ps.forEach(function(d) {
            var dd = d.data();
            if (dd.disponible !== false) {
                var prod = {
                    id: d.id,
                    nom: dd.nom || '',
                    description: dd.description || '',
                    prixVente: dd.prixVente || 0,
                    prixPromo: dd.prixPromo || 0,
                    prixAchat: dd.prixAchat || 0,
                    stock: dd.stock,
                    categorie: dd.categorie || '',
                    categories: dd.categories || [],
                    imageBase64: dd.imageBase64 || '',
                    favori: dd.favori || false
                };
                posProductsList.push(prod);
                CacheDB.set('products', d.id, prod);
            }
        });
        productIndexBuilt = false;

        renderClientPOS();
    } catch(e) {
        console.error('Erreur chargement catalogue:', e);
        renderClientPOS();
    }
}

// ==================== RENDU POS CLIENT (UTILISE buildFullPOS DE POS.JS) ====================
function renderClientPOS() {
    var c = document.getElementById('clientDynamicContent');
    if (!c) return;

    if (posProductsList.length === 0 && posCategoriesList.length === 0) {
        c.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#14B8A6;"></i><p>Chargement...</p></div>';
        return;
    }

    // ✅ Synchroniser le panier client avec posCart
    clientCart = posCart.slice();
    clientStep = posStep;

    // ✅ Appeler buildFullPOS de pos.js (IDENTIQUE à l'admin)
    if (typeof buildFullPOS === 'function') {
        buildFullPOS(c);
        // ✅ Après le rendu, masquer les boutons multi-paniers, tables, en ligne
        setTimeout(masquerElementsAdminDansClient, 50);
    } else {
        c.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;">Erreur : POS non chargé</div>';
    }
}

// ==================== MASQUER LES ÉLÉMENTS ADMIN DANS LE CLIENT ====================
function masquerElementsAdminDansClient() {
    // ✅ Masquer la barre multi-paniers
    var multiCartBar = document.querySelector('#clientDynamicContent .pos-multi-carts-bar');
    if (multiCartBar) multiCartBar.style.display = 'none';

    // ✅ Masquer le bouton Tables
    var tablesBtn = document.getElementById('posTablesBtn');
    if (tablesBtn) tablesBtn.style.display = 'none';

    // ✅ Masquer le bouton En ligne
    var enligneBtn = document.getElementById('posEnLigneBtn');
    if (enligneBtn) enligneBtn.style.display = 'none';

    // ✅ Masquer le champ Vendeur (pas nécessaire pour le client)
    var vendeurGroup = document.getElementById('posVendeur');
    if (vendeurGroup) {
        var parent = vendeurGroup.closest('div[style*="margin-bottom"]');
        if (parent) parent.style.display = 'none';
    }

    // ✅ Masquer le champ Table (le client n'a pas besoin de table)
    var tableInput = document.getElementById('posTableNum');
    if (tableInput) {
        var parent = tableInput.closest('div[style*="margin-bottom"]');
        if (parent) parent.style.display = 'none';
    }

    // ✅ Masquer le séparateur "— OU —"
    var separator = document.querySelector('#clientDynamicContent div[style*="OU"]');
    if (separator) separator.style.display = 'none';

    // ✅ Masquer le bouton "Nouveau client" (le client ne crée pas de clients)
    var nouveauBtn = document.querySelector('#clientDynamicContent button[onclick*="posAjouterNouveauClient"]');
    if (nouveauBtn) nouveauBtn.style.display = 'none';

    // ✅ Masquer le champ de recherche client (le client est déjà identifié)
    var clientSearchInput = document.getElementById('posClientSearchInput');
    if (clientSearchInput) {
        var parent = clientSearchInput.closest('div[style*="position:relative"]');
        if (parent) parent.style.display = 'none';
    }
    var clientLabel = document.querySelector('#clientDynamicContent label');
    // Masquer le label "Client" associé
    var allLabels = document.querySelectorAll('#clientDynamicContent label');
    allLabels.forEach(function(lbl) {
        if (lbl.textContent.trim() === 'Client') {
            var parentDiv = lbl.closest('div[style*="display:flex"]');
            if (parentDiv) parentDiv.style.display = 'none';
        }
    });

    // ✅ Masquer le bouton Crédit et Partiel (le client paie en espèces uniquement)
    var creditBtn = document.getElementById('posCreditBtn');
    if (creditBtn) creditBtn.style.display = 'none';
    var partielBtn = document.getElementById('posPartielBtn');
    if (partielBtn) partielBtn.style.display = 'none';

    // ✅ Changer le texte du bouton "Finaliser" en "Commander"
    var finalizeBtn = document.querySelector('#clientDynamicContent .pos-finalize-btn');
    if (finalizeBtn) {
        finalizeBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer la commande';
    }

    // ✅ Changer le titre "Panier" (déjà bon)
    // ✅ Changer le titre "Paiement" en "Confirmation"
    var paymentHeader = document.querySelector('#clientDynamicContent .pos-cart-header h3');
    if (paymentHeader && paymentHeader.textContent.indexOf('Paiement') !== -1) {
        paymentHeader.innerHTML = '<i class="fas fa-clipboard-check"></i> Confirmation';
    }
}

// ==================== SURCHARGER posFinalizeSale POUR LE CLIENT ====================
window.posFinalizeSaleOriginal = window.posFinalizeSale;
window.posFinalizeSale = async function() {
    // ✅ Si on est en mode client, envoyer une commande au lieu de finaliser une vente
    if (window.posIsClientMode) {
        return await clientValidateOrder();
    }
    // Sinon comportement admin normal
    if (typeof window.posFinalizeSaleOriginal === 'function') {
        return await window.posFinalizeSaleOriginal();
    }
};

// ==================== VALIDATION COMMANDE CLIENT ====================
async function clientValidateOrder() {
    if (posCart.length === 0) {
        alert('❌ Votre panier est vide. Ajoutez des articles avant de commander.');
        return;
    }

    // ✅ Confirmation
    if (!confirm('Voulez-vous envoyer votre commande ?\n\nTotal: ' + posCalculateTotal().toFixed(2) + ' MAD')) {
        return;
    }

    var total = posCalculateTotal();
    var ud = window.currentUserData ? window.currentUserData.userData : {};

    var orderData = {
        items: JSON.parse(JSON.stringify(posCart)),
        total: total,
        clientId: window.currentUserData ? window.currentUserData.uid : null,
        clientName: (ud.prenom || '') + ' ' + (ud.nom || ''),
        clientEmail: ud.email || '',
        clientTelephone: ud.telephone || '',
        statut: 'en_attente',
        source: 'client',
        paymentMethod: 'espece',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await CacheDB.write('commandes', null, orderData, 'add');
        alert('✅ Commande envoyée !\n\nTotal: ' + total.toFixed(2) + ' MAD\n\nNous vous contacterons bientôt.');

        // ✅ Réinitialiser
        posCart = [];
        clientCart = [];
        posStep = 1;
        clientStep = 1;
        posMultiCarts['client-panier'] = [];
        renderClientPOS();

        CacheDB.sync();

        if (typeof CacheDB !== 'undefined' && CacheDB.saveCollection) {
            setTimeout(function() {
                CacheDB.saveCollection('commandes');
            }, 500);
        }
    } catch(e) {
        console.error('❌ Erreur commande:', e);
        alert('❌ Erreur lors de l\'envoi: ' + e.message);
    }
}

// ==================== SURCHARGER posResetCart POUR LE CLIENT ====================
window.posResetCartOriginal = window.posResetCart;
window.posResetCart = function() {
    if (window.posIsClientMode) {
        posCart = [];
        clientCart = [];
        posMultiCarts['client-panier'] = [];
        posDiscountMAD = 0;
        posAmountGiven = 0;
        posCurrentClient = window.currentUserData ? {
            id: window.currentUserData.uid,
            name: window.currentUserData.userData.prenom + ' ' + window.currentUserData.userData.nom
        } : null;
        posCurrentTable = '';
        posPaymentMethod = 'espece';
        if (typeof renderClientPOS === 'function') renderClientPOS();
        return;
    }
    if (typeof window.posResetCartOriginal === 'function') {
        return window.posResetCartOriginal();
    }
};

// ==================== SURCHARGER posGoToStep2 POUR LE CLIENT ====================
window.posGoToStep2Original = window.posGoToStep2;
window.posGoToStep2 = function() {
    if (window.posIsClientMode) {
        posMultiCarts['client-panier'] = posCart.slice();
        posStep = 2;
        clientStep = 2;
        clientCart = posCart.slice();
        renderClientPOS();
        return;
    }
    if (typeof window.posGoToStep2Original === 'function') {
        return window.posGoToStep2Original();
    }
};

// ==================== SURCHARGER posGoToStep1 POUR LE CLIENT ====================
window.posGoToStep1Original = window.posGoToStep1;
window.posGoToStep1 = function() {
    if (window.posIsClientMode) {
        posStep = 1;
        clientStep = 1;
        posCart = posMultiCarts['client-panier'] || [];
        clientCart = posCart.slice();
        renderClientPOS();
        return;
    }
    if (typeof window.posGoToStep1Original === 'function') {
        return window.posGoToStep1Original();
    }
};

// ==================== SURCHARGER renderPOS POUR LE CLIENT ====================
window.renderPOSOriginal = window.renderPOS;
window.renderPOS = function() {
    if (window.posIsClientMode) {
        return renderClientPOS();
    }
    if (typeof window.renderPOSOriginal === 'function') {
        return window.renderPOSOriginal();
    }
};

// ==================== SURCHARGER filterProductGrid POUR LE CLIENT ====================
// (pour s'assurer que le rendu se fait dans #clientDynamicContent)
window.filterProductGridOriginal = window.filterProductGrid;
window.filterProductGrid = function() {
    if (window.posIsClientMode) {
        // Utiliser la grille dans #clientDynamicContent
        var grid = document.getElementById('posProductGrid');
        if (grid) {
            // Le code de filterProductGrid utilise document.getElementById('posProductGrid')
            // qui est unique, donc ça fonctionne tel quel
        }
    }
    if (typeof window.filterProductGridOriginal === 'function') {
        return window.filterProductGridOriginal();
    }
};

// ==================== SURCHARGER updateCartOnly POUR LE CLIENT ====================
window.updateCartOnlyOriginal = window.updateCartOnly;
window.updateCartOnly = function() {
    if (window.posIsClientMode) {
        clientCart = posCart.slice();
    }
    if (typeof window.updateCartOnlyOriginal === 'function') {
        return window.updateCartOnlyOriginal();
    }
};

// ==================== SURCHARGER posToggleTools POUR LE CLIENT ====================
// ✅ Le client veut : bouton "Afficher tout" → affiche UNIQUEMENT la barre de recherche + le micro
// ✅ Masque : barre des catégories slide, btn Tables, btn En ligne
window.posToggleToolsOriginal = window.posToggleTools;
window.posToggleTools = function() {
    if (window.posIsClientMode) {
        posToolsVisible = !posToolsVisible;
        var toolsContainer = document.getElementById('posToolsContainer');
        var toggleBtn = document.getElementById('posToggleToolsBtn');

        if (toolsContainer) {
            if (posToolsVisible) {
                toolsContainer.style.display = 'flex';
                toolsContainer.style.flexDirection = 'column';
                toolsContainer.style.gap = '8px';
                toolsContainer.style.marginBottom = '8px';
                toolsContainer.style.padding = '8px 12px';
                toolsContainer.style.background = 'var(--bg-page)';
                toolsContainer.style.borderRadius = '8px';
                toolsContainer.style.border = '1px solid var(--border)';
                toolsContainer.classList.add('visible');
            } else {
                toolsContainer.style.display = 'none';
                toolsContainer.classList.remove('visible');
            }
        }

        if (toggleBtn) {
            toggleBtn.innerHTML = posToolsVisible ? '✕ Masquer' : '🔍 Afficher tout';
            toggleBtn.style.background = posToolsVisible ? '#ef4444' : '#14B8A6';
        }

        // ✅ Afficher UNIQUEMENT la barre de recherche
        var searchInput = document.getElementById('posSearchInput');
        if (searchInput) {
            searchInput.style.display = posToolsVisible ? 'flex' : 'none';
            if (posToolsVisible) {
                setTimeout(function() { searchInput.focus(); }, 100);
            }
        }

        // ✅ Afficher le micro
        var micBtn = document.getElementById('posMicBtn');
        if (micBtn) {
            micBtn.style.display = posToolsVisible ? 'flex' : 'none';
        }

        // ✅ MASQUER les boutons Tables et En ligne
        var tablesBtn = document.getElementById('posTablesBtn');
        if (tablesBtn) tablesBtn.style.display = 'none';
        var enligneBtn = document.getElementById('posEnLigneBtn');
        if (enligneBtn) enligneBtn.style.display = 'none';

        // ✅ MASQUER la barre des catégories (slide)
        var categoriesBar = document.querySelector('#clientDynamicContent .pos-categories-bar');
        if (categoriesBar) categoriesBar.style.display = 'none';

        // ✅ Si on masque, revenir aux catégories (cartes)
        if (!posToolsVisible) {
            posViewMode = 'categories';
            posSelectedCategoryForView = null;
            posSelectedCategory = 'all';
            posSearchQuery = '';
            posProductOffset = 0;

            var searchInput2 = document.getElementById('posSearchInput');
            if (searchInput2) searchInput2.value = '';

            var clearBtn = document.getElementById('posSearchClearBtn');
            if (clearBtn) clearBtn.style.display = 'none';

            if (typeof filterProductGrid === 'function') filterProductGrid();
        }
        return;
    }
    if (typeof window.posToggleToolsOriginal === 'function') {
        return window.posToggleToolsOriginal();
    }
};

// ==================== PAGE HISTORIQUE ====================
async function loadClientHistoriquePage() {
    var c = document.getElementById('clientDynamicContent');
    if (!c) return;

    // ✅ Désactiver le mode client POS
    window.posIsClientMode = false;

    c.innerHTML = '<div class="content-card"><div class="card-header"><h3><i class="fas fa-history"></i> Mon historique</h3></div><div id="clientOrdersList" style="text-align:center;padding:20px;">Chargement...</div></div>';

    if (!window.currentUserData) {
        var cont0 = document.getElementById('clientOrdersList');
        if (cont0) cont0.innerHTML = '<p>Non connecté</p>';
        return;
    }

    var uid = window.currentUserData.uid;

    try {
        var cmdSnap = await db.collection('commandes').where('clientId', '==', uid).get();
        var all = [];
        cmdSnap.forEach(function(d) {
            var cmd = d.data();
            all.push({ type: 'commande', data: cmd, date: cmd.createdAt });
        });
        all.sort(function(a, b) { return (b.date?.seconds || 0) - (a.date?.seconds || 0); });
        all = all.slice(0, 50);

        var cont = document.getElementById('clientOrdersList');
        if (!cont) return;

        if (all.length === 0) {
            cont.innerHTML = '<p style="padding:40px;color:#94a3b8;text-align:center;"><i class="fas fa-inbox" style="font-size:2rem;display:block;margin-bottom:10px;"></i>Aucune commande</p>';
            return;
        }

        var h = '<div class="table-container"><table class="data-table"><thead><tr><th>Date</th><th>Articles</th><th>Total</th><th>Statut</th></tr></thead><tbody>';
        all.forEach(function(item) {
            var d = item.data;
            var date = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleString('fr-FR') : '';
            var arts = d.items ? d.items.map(function(it) { return it.quantite + 'x ' + escapeHtml(it.nom); }).join('<br>') : '-';
            var statut = d.statut === 'valide' ? '<span class="status-success">✅ Validée</span>'
                       : d.statut === 'payé' ? '<span class="status-success">💵 Payée</span>'
                       : '<span class="status-warning">⏳ En attente</span>';
            h += '<tr><td>' + date + '</td><td>' + arts + '</td><td><strong>' + (d.total || 0).toFixed(2) + ' MAD</strong></td><td>' + statut + '</td></tr>';
        });
        h += '</tbody></table></div>';
        cont.innerHTML = h;
    } catch(e) {
        console.error('Erreur historique:', e);
        var cont2 = document.getElementById('clientOrdersList');
        if (cont2) cont2.innerHTML = '<p style="color:#ef4444;">Erreur de chargement</p>';
    }
}

// ==================== PAGE PARAMÈTRES ====================
async function loadClientParametresPage() {
    var c = document.getElementById('clientDynamicContent');
    if (!c) return;

    // ✅ Désactiver le mode client POS
    window.posIsClientMode = false;

    if (!window.currentUserData) { c.innerHTML = '<div class="content-card"><p>Non connecté</p></div>'; return; }

    var clientData = null, clientDocId = null;
    var userEmail = window.currentUserData.userData.email;
    try {
        var clientSnap = await db.collection('clients').where('email', '==', userEmail).get();
        if (!clientSnap.empty) { clientDocId = clientSnap.docs[0].id; clientData = clientSnap.docs[0].data(); }
    } catch(e) { console.error(e); }
    if (!clientData) clientData = window.currentUserData.userData;

    var dateCreated = clientData.createdAt ? new Date(clientData.createdAt.seconds * 1000).toLocaleString('fr-FR') : 'N/A';

    var h = '<div class="content-card"><div class="card-header"><h3><i class="fas fa-user-circle"></i> Mon Profil</h3></div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;font-size:0.9rem;">';
    h += '<div><strong>Nom:</strong> ' + escapeHtml(clientData.nom || '') + '</div>';
    h += '<div><strong>Prénom:</strong> ' + escapeHtml(clientData.prenom || '') + '</div>';
    h += '<div><strong>Email:</strong> ' + escapeHtml(clientData.email || '') + '</div>';
    h += '<div><strong>Tél:</strong> ' + escapeHtml(clientData.telephone || '-') + '</div>';
    h += '<div><strong>Adresse:</strong> ' + escapeHtml(clientData.adresse || '-') + '</div>';
    h += '<div><strong>Points Fidélité:</strong> ' + (clientData.pointsFidelite || 0) + '</div>';
    h += '</div>';
    h += '<div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">';
    h += '<button class="btn-add" onclick="clientOpenEditProfile()"><i class="fas fa-edit"></i> Modifier mon profil</button>';
    h += '<button class="btn-save" onclick="clientOpenChangePassword()"><i class="fas fa-lock"></i> Changer mot de passe</button>';
    h += '</div></div>';
    c.innerHTML = h;
    window.clientProfileData = clientData;
    window.clientProfileDocId = clientDocId;
}

function clientOpenEditProfile() {
    var data = window.clientProfileData || window.currentUserData.userData;
    var h = '';
    h += '<div class="form-row"><div class="form-group"><label>Nom *</label><input type="text" id="clientEditNom" value="' + escapeHtml(data.nom || '') + '"></div><div class="form-group"><label>Prénom *</label><input type="text" id="clientEditPrenom" value="' + escapeHtml(data.prenom || '') + '"></div></div>';
    h += '<div class="form-row"><div class="form-group"><label>Téléphone</label><input type="text" id="clientEditTel" value="' + escapeHtml(data.telephone || '') + '"></div><div class="form-group"><label>Adresse</label><input type="text" id="clientEditAdresse" value="' + escapeHtml(data.adresse || '') + '"></div></div>';
    h += '<button class="btn-cancel" onclick="closeModal()">Annuler</button><button class="btn-save" onclick="clientSaveProfile()">Enregistrer</button>';
    openModal('✏️ Modifier mon profil', h);
}

async function clientSaveProfile() {
    var nom = document.getElementById('clientEditNom').value.trim();
    var prenom = document.getElementById('clientEditPrenom').value.trim();
    if (!nom || !prenom) { alert('Nom et Prénom obligatoires'); return; }
    var updatedData = {
        nom: nom, prenom: prenom,
        telephone: document.getElementById('clientEditTel').value,
        adresse: document.getElementById('clientEditAdresse').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        var docId = window.clientProfileDocId;
        if (docId) {
            await CacheDB.write('clients', docId, updatedData, 'update');
            await CacheDB.write('users', window.currentUserData.uid, { nom: nom, prenom: prenom, telephone: updatedData.telephone }, 'update');
        } else {
            updatedData.email = window.currentUserData.userData.email;
            updatedData.username = window.currentUserData.userData.username;
            updatedData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            var newDocId = await CacheDB.write('clients', null, updatedData, 'add');
            window.clientProfileDocId = newDocId;
        }
        window.currentUserData.userData.nom = nom;
        window.currentUserData.userData.prenom = prenom;
        window.clientProfileData = updatedData;
        alert('✅ Profil mis à jour !');
        closeModal();
        loadClientParametresPage();
        CacheDB.sync();
    } catch(e) { alert('Erreur: ' + e.message); }
}

function clientOpenChangePassword() {
    var h = '<div class="form-row"><div class="form-group"><label>Mot de passe actuel</label><input type="password" id="clientOldPassword"></div></div>';
    h += '<div class="form-row"><div class="form-group"><label>Nouveau mot de passe</label><input type="password" id="clientNewPassword"></div></div>';
    h += '<div class="form-row"><div class="form-group"><label>Confirmer</label><input type="password" id="clientConfirmPassword"></div></div>';
    h += '<button class="btn-cancel" onclick="closeModal()">Annuler</button><button class="btn-save" onclick="clientChangePassword()">Changer</button>';
    openModal('🔒 Changer mot de passe', h);
}

async function clientChangePassword() {
    var oldPass = document.getElementById('clientOldPassword').value;
    var newPass = document.getElementById('clientNewPassword').value;
    var confirmPass = document.getElementById('clientConfirmPassword').value;
    if (!oldPass || !newPass || !confirmPass) { alert('Tous les champs obligatoires'); return; }
    if (newPass.length < 6) { alert('6 caractères minimum'); return; }
    if (newPass !== confirmPass) { alert('Ne correspondent pas'); return; }
    var user = auth.currentUser;
    if (!user) { alert('Non connecté'); return; }
    try {
        await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email, oldPass));
        await user.updatePassword(newPass);
        alert('✅ Mot de passe changé');
        closeModal();
    } catch(e) {
        if (e.code === 'auth/wrong-password') alert('❌ Mot de passe actuel incorrect');
        else alert('Erreur: ' + e.message);
    }
}

// ==================== EXPORTS GLOBAUX ====================
window.clientNavigate = clientNavigate;
window.loadClientCommanderPage = loadClientCommanderPage;
window.renderClientPOS = renderClientPOS;
window.clientValidateOrder = clientValidateOrder;
window.loadClientHistoriquePage = loadClientHistoriquePage;
window.loadClientParametresPage = loadClientParametresPage;
window.clientOpenEditProfile = clientOpenEditProfile;
window.clientSaveProfile = clientSaveProfile;
window.clientOpenChangePassword = clientOpenChangePassword;
window.clientChangePassword = clientChangePassword;
window.masquerElementsAdminDansClient = masquerElementsAdminDansClient;

console.log('🚀 E-SOLUTION - Client JS chargé (POS identique à l\'admin)');
console.log('✅ Réutilise buildFullPOS de pos.js');
console.log('✅ Barre de recherche via bouton "Afficher tout" + micro uniquement');
console.log('✅ Sans catégories slide, sans Tables, sans En ligne');
console.log('✅ Étape de paiement identique');
console.log('✅ Sans multi-paniers');
console.log('✅ Mêmes dimensions / même responsive');
