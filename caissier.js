// ==================== CAISSIER.JS - E-SOLUTION ====================

(function() {
    let attempts = 0;
    const maxAttempts = 50;
    const interval = 300;
    let intervalId = null;

    function redirectToValidRole() {
        if (!window.currentUserData) {
            if (++attempts >= maxAttempts) {
                console.error('Impossible de détecter l\'utilisateur connecté');
                if (intervalId) clearInterval(intervalId);
                if (typeof showAuthPage === 'function') showAuthPage();
            }
            return false;
        }
        if (intervalId) clearInterval(intervalId);

        const role = window.currentUserData.userData.role;
        if (role !== 'caissier') {
            console.warn(`Rôle ${role} détecté, redirection...`);
            if (role === 'admin' && typeof showDashboard === 'function') {
                showDashboard();
            } else if (role === 'client' && typeof showClientPage === 'function') {
                showClientPage();
            } else if (typeof showAuthPage === 'function') {
                showAuthPage();
            }
            return false;
        }

        console.log('🚀 Interface caissier E-SOLUTION chargée');
        return true;
    }

    intervalId = setInterval(function() {
        redirectToValidRole();
    }, interval);
})();

function loadCaissierDashboard() {
    if (typeof loadDashboardPage === 'function') {
        loadDashboardPage(document.getElementById('dynamicContent'));
    } else {
        console.error('loadDashboardPage non définie');
    }
}

function loadCaissierPOS() {
    if (typeof loadPosPage === 'function') {
        loadPosPage(document.getElementById('dynamicContent'));
    } else {
        console.error('loadPosPage non définie');
    }
}

function loadCaissierCommandes() {
    if (typeof loadCommandesPage === 'function') {
        loadCommandesPage(document.getElementById('dynamicContent'));
    } else {
        console.error('loadCommandesPage non définie');
    }
}

function loadCaissierVentes() {
    if (typeof loadVentesPage === 'function') {
        loadVentesPage(document.getElementById('dynamicContent'));
    } else {
        console.error('loadVentesPage non définie');
    }
}

function loadCaissierCredits() {
    if (typeof loadCreditsPage === 'function') {
        loadCreditsPage(document.getElementById('dynamicContent'));
    } else {
        console.error('loadCreditsPage non définie');
    }
}

// ==================== STOCK POUR CAISSIER ====================
function loadCaissierStock(content) {
    var container = content || document.getElementById('dynamicContent');
    if (!container) {
        console.error('Conteneur non trouvé pour Stock');
        return;
    }
    
    if (typeof loadClientStockPage === 'function') {
        loadClientStockPage(container);
    } else {
        console.warn('loadClientStockPage non définie, fallback');
        container.innerHTML = `
            <div class="content-card">
                <div class="card-header">
                    <h3><i class="fas fa-boxes"></i> Gestion Stock</h3>
                    <button class="btn-add" onclick="loadCaissierStock()">
                        <i class="fas fa-sync"></i> Actualiser
                    </button>
                </div>
                <div id="caissierStockContainer">
                    <p style="text-align:center;padding:40px;">Chargement du stock...</p>
                </div>
            </div>
        `;
        loadCaissierStockFallback();
    }
}

function loadCaissierStockFallback() {
    var container = document.getElementById('caissierStockContainer');
    if (!container) return;
    
    db.collection('stock').orderBy('nom').get().then(function(snapshot) {
        if (snapshot.empty) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Aucun stock</div>';
            return;
        }
        var html = '<div class="table-container"><table class="data-table"><thead><tr>';
        html += '<th>Nom</th><th>Catégorie</th><th>Quantité</th><th>Unité</th><th>Prix unitaire</th>';
        html += '</thead><tbody>';
        snapshot.forEach(function(doc) {
            var d = doc.data();
            html += '<tr>';
            html += '<td><strong>' + escapeHtml(d.nom || '') + '</strong></td>';
            html += '<td>' + escapeHtml(d.categorie || '-') + '</td>';
            html += '<td style="font-weight:700;">' + (d.quantite || 0) + '</td>';
            html += '<td>' + escapeHtml(d.unite || '-') + '</td>';
            html += '<td>' + (d.prixUnitaire || 0).toFixed(2) + ' MAD</td>';
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    }).catch(function(e) {
        container.innerHTML = '<p style="color:#ef4444;">❌ Erreur: ' + e.message + '</p>';
    });
}

// ==================== DÉPENSES POUR CAISSIER ====================
function loadCaissierDepenses(content) {
    var container = content || document.getElementById('dynamicContent');
    if (!container) {
        console.error('Conteneur non trouvé pour Dépenses');
        return;
    }
    
    if (typeof loadClientDepensesPage === 'function') {
        loadClientDepensesPage(container);
    } else {
        console.warn('loadClientDepensesPage non définie, fallback');
        container.innerHTML = `
            <div class="content-card">
                <div class="card-header">
                    <h3><i class="fas fa-money-bill-wave"></i> Dépenses</h3>
                    <button class="btn-add" onclick="openCaissierDepenseForm()">
                        <i class="fas fa-plus"></i> Ajouter une dépense
                    </button>
                </div>
                <div id="caissierDepensesContainer">
                    <p style="text-align:center;padding:40px;">Chargement des dépenses...</p>
                </div>
            </div>
        `;
        loadCaissierDepensesFallback();
    }
}

function loadCaissierDepensesFallback() {
    var container = document.getElementById('caissierDepensesContainer');
    if (!container) return;
    
    var userId = window.currentUserData ? window.currentUserData.uid : null;
    var query = db.collection('depenses').orderBy('createdAt', 'desc').limit(100);
    
    if (userId) {
        query = query.where('createdBy', '==', userId);
    }
    
    query.get().then(function(snapshot) {
        if (snapshot.empty) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Aucune dépense</div>';
            return;
        }
        var html = '<div class="table-container"><table class="data-table"><thead><tr>';
        html += '<th>Date</th><th>Description</th><th>Montant</th><th>Catégorie</th><th>Actions</th>';
        html += '</thead><tbody>';
        var total = 0;
        snapshot.forEach(function(doc) {
            var d = doc.data();
            total += d.montant || 0;
            var date = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleDateString('fr-FR') : '-';
            html += '<tr>';
            html += '<td>' + date + '</td>';
            html += '<td><strong>' + escapeHtml(d.description || '') + '</strong></td>';
            html += '<td style="color:#ef4444;font-weight:700;">' + (d.montant || 0).toFixed(2) + ' MAD</td>';
            html += '<td>' + escapeHtml(d.categorie || '-') + '</td>';
            html += '<td>';
            if (d.createdBy === userId) {
                html += '<button class="btn-delete" onclick="deleteCaissierDepense(\'' + doc.id + '\')" style="padding:4px 8px;font-size:0.7rem;"><i class="fas fa-trash"></i></button>';
            } else {
                html += '<span style="color:#94a3b8;font-size:0.65rem;">(lecture)</span>';
            }
            html += '</td>';
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        html += '<div style="margin-top:15px;padding:15px;background:#fef2f2;border-radius:12px;text-align:center;">';
        html += '<strong>Total dépenses: ' + total.toFixed(2) + ' MAD</strong>';
        html += '</div>';
        container.innerHTML = html;
    }).catch(function(e) {
        container.innerHTML = '<p style="color:#ef4444;">❌ Erreur: ' + e.message + '</p>';
    });
}

function openCaissierDepenseForm() {
    var h = '';
    h += '<div class="form-row"><div class="form-group"><label>Description *</label><input type="text" id="caissierDepenseDescription" required></div></div>';
    h += '<div class="form-row"><div class="form-group"><label>Montant (MAD) *</label><input type="number" id="caissierDepenseMontant" step="0.01" min="0" required></div>';
    h += '<div class="form-group"><label>Catégorie</label><select id="caissierDepenseCategorie"><option value="">-</option>';
    var categories = ['Fournitures', 'Entretien', 'Alimentation', 'Électricité', 'Eau', 'Loyer', 'Transport', 'Communication', 'Marketing', 'Salaires', 'Réparation', 'Autre'];
    for (var i = 0; i < categories.length; i++) {
        h += '<option value="' + categories[i] + '">' + categories[i] + '</option>';
    }
    h += '</select></div></div>';
    h += '<div class="form-row"><div class="form-group"><label>Payé à</label><input type="text" id="caissierDepensePayeA"></div></div>';
    h += '<div style="margin-top:15px;display:flex;gap:10px;justify-content:flex-end;">';
    h += '<button class="btn-cancel" onclick="closeModal()">Annuler</button>';
    h += '<button class="btn-save" onclick="saveCaissierDepense()">Ajouter</button>';
    h += '</div>';
    
    openModal('💰 Ajouter une dépense', h);
}

function saveCaissierDepense() {
    var description = document.getElementById('caissierDepenseDescription').value.trim();
    var montant = parseFloat(document.getElementById('caissierDepenseMontant').value);
    var categorie = document.getElementById('caissierDepenseCategorie').value;
    var payeA = document.getElementById('caissierDepensePayeA').value.trim();
    
    if (!description) { alert('La description est obligatoire'); return; }
    if (isNaN(montant) || montant <= 0) { alert('Le montant doit être supérieur à 0'); return; }
    
    var userId = window.currentUserData ? window.currentUserData.uid : null;
    var userData = window.currentUserData ? window.currentUserData.userData : {};
    
    var data = {
        description: description,
        montant: montant,
        categorie: categorie || 'Autre',
        payeA: payeA || '',
        createdBy: userId,
        createdByName: (userData.prenom || '') + ' ' + (userData.nom || ''),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    CacheDB.write('depenses', null, data, 'add').then(function() {
        alert('✅ Dépense ajoutée !');
        closeModal();
        loadCaissierDepenses();
        CacheDB.sync();
    }).catch(function(e) {
        alert('Erreur: ' + e.message);
    });
}

function deleteCaissierDepense(id) {
    if (!confirm('Supprimer cette dépense ?')) return;
    CacheDB.write('depenses', id, null, 'delete').then(function() {
        alert('✅ Dépense supprimée');
        loadCaissierDepenses();
        CacheDB.sync();
    }).catch(function(e) {
        alert('Erreur: ' + e.message);
    });
}

console.log('🚀 E-SOLUTION - Caissier JS prêt (avec Stock & Dépenses)');
