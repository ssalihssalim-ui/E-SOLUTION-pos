// ==================== ADMIN-CRUD.JS - E-SOLUTION ====================
// Contient : Catégories, Produits, Clients, Fournisseurs
// ✅ Police 24px sur toutes les pages d'administration
// ✅ Module Achats fournisseur avec modal 90% (écran)
// ✅ Reconnaissance par Gemini (IA)
// ✅ Gestion du stock, prix boîte, date d'expiration

// ====================================================
//  🔑  CONFIGURATION GEMINI
// ====================================================
const GEMINI_API_KEY = 'VOTRE_CLE_GEMINI';
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ========== INITIALISATION DE LA RECHERCHE PRODUIT ==========
window.productSearchQuery = window.productSearchQuery || '';

// ========== FONCTIONS UTILITAIRES ==========
function updateSelectedCategories() {
    var select = document.getElementById('prodCategoriesSelect');
    var display = document.getElementById('selectedCategoriesDisplay');
    if (!select || !display) return;
    var selected = Array.from(select.selectedOptions).map(opt => opt.value);
    display.innerHTML = selected.map(function(cat) {
        return '<span style="background:#111827; color:#fff; padding:8px 14px; border-radius:24px; font-size:20px; display:inline-flex; align-items:center; gap:8px;">' +
            escapeHtml(cat) +
            '<span onclick="event.stopPropagation(); this.parentElement.remove(); deselectCategory(\'' + escapeHtml(cat.replace(/'/g, "\\'")) + '\')" style="cursor:pointer; font-weight:bold; margin-left:6px; font-size:22px;">×</span>' +
            '</span>';
    }).join('');
}

function deselectCategory(catName) {
    var select = document.getElementById('prodCategoriesSelect');
    if (!select) return;
    for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].value === catName) {
            select.options[i].selected = false;
            break;
        }
    }
    updateSelectedCategories();
}

window.updateSelectedCategories = updateSelectedCategories;
window.deselectCategory = deselectCategory;

// ==================== CATÉGORIES ====================
function loadCategoriesPage(c) {
    c.innerHTML = '<div class="content-card">' +
        '<div class="card-header"><h3 style="font-size:28px;"><i class="fas fa-layer-group"></i> Catégories</h3><button class="btn-add" onclick="openCategoryForm()" style="font-size:24px; padding:14px 24px;"><i class="fas fa-plus"></i> Nouvelle</button></div>' +
        '<div class="table-container"><table class="data-table" id="categoriesTable" style="font-size:22px;"><thead><tr><th style="font-size:22px; padding:14px 10px;">Image</th>' +
        makeSortableHeader('categories', 'nom', 'Nom', 'loadCategories') +
        makeSortableHeader('categories', 'description', 'Description', 'loadCategories') +
        makeSortableHeader('categories', 'ordre', 'Ordre', 'loadCategories') +
        makeSortableHeader('categories', 'ca', 'CA', 'loadCategories') +
        makeSortableHeader('categories', 'profit', 'Profit', 'loadCategories') +
        '<th style="font-size:22px; padding:14px 10px;">Nb Produits</th><th style="font-size:22px; padding:14px 10px;">Recette</th><th style="font-size:22px; padding:14px 10px;">Actions</th>' +
        '</thead><tbody style="font-size:22px;"></tbody></div><div id="categoriesPagination"></div></div>';
    loadCategories();
}

// ✅ CORRECTION : Toujours recharger les données à chaque visite
async function loadCategories() {
    // ✅ 1. Toujours recharger depuis le cache (rapide)
    const cached = await CacheDB.getAll('categories');
    if (cached.length) {
        allCategoriesData = cached;
        renderCategoriesTable();
    }
    
    // ✅ 2. Mettre à jour depuis Firestore si nécessaire (données manquantes ou rafraîchissement)
    if (allCategoriesData.length === 0) {
        try {
            const snapshot = await db.collection('categories').get();
            allCategoriesData = [];
            snapshot.forEach(d => allCategoriesData.push({ id: d.id, ...d.data() }));
            for (let doc of allCategoriesData) await CacheDB.set('categories', doc.id, doc);
            renderCategoriesTable();
        } catch (e) { console.error(e); }
    }
}

// ✅ CORRECTION MAJEURE : SUPPRESSION DES REQUÊTES FIRESTORE EN BOUCLE
async function renderCategoriesTable() {
    var tb = document.querySelector('#categoriesTable tbody');
    if (!tb) return;
    var data = applySort('categories', allCategoriesData.slice(), 'nom');
    var pageData = getPageData('categories', data);
    tb.innerHTML = '';
    if (pageData.length === 0) {
        tb.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;font-size:24px;">Aucune catégorie</td></tr>';
        document.getElementById('categoriesPagination').innerHTML = ''; return;
    }
    
    // ✅ CORRECTION : Créer un dictionnaire pour compter les produits en mémoire
    var counts = {};
    (window.allProductsData || []).forEach(function(p) {
        // On compte pour toutes les catégories
        if (p.categorie) {
            if (!counts[p.categorie]) counts[p.categorie] = 0;
            counts[p.categorie]++;
        }
        // On compte aussi pour les catégories multiples (si utilisées)
        if (p.categories) {
            p.categories.forEach(function(cat) {
                if (!counts[cat]) counts[cat] = 0;
                counts[cat]++;
            });
        }
    });

    // ✅ CORRECTION : Utiliser le dictionnaire au lieu d'une requête Firestore
    for (var i = 0; i < pageData.length; i++) {
        var d = pageData[i];
        // On récupère le nombre depuis le dictionnaire
        var pc = counts[d.nom] || 0; 

        var im = d.imageBase64 ? '<img src="' + d.imageBase64 + '" style="width:50px;height:50px;object-fit:cover;border-radius:8px;">' : '<i class="fas fa-folder fa-3x" style="color:#14B8A6;"></i>';
        var pcol = (d.profit || 0) >= 0 ? '#14B8A6' : '#dc2626';
        var recetteBadge = d.recette ? '<span class="status-success" style="font-size:20px; padding:6px 14px;">✅ Oui</span>' : '<span class="status-warning" style="font-size:20px; padding:6px 14px;">❌ Non</span>';
        tb.innerHTML += '<tr><td style="padding:14px 10px;">' + im + '</td><td style="padding:14px 10px; font-size:24px; font-weight:600;"><strong>' + escapeHtml(d.nom || '') + '</strong></td><td style="padding:14px 10px; font-size:22px;">' + escapeHtml(d.description || '-') + '</td><td style="padding:14px 10px; font-size:22px;">' + (d.ordre || 0) + '</td><td style="padding:14px 10px; font-size:22px;">' + (d.ca || 0).toFixed(2) + ' MAD</td><td style="padding:14px 10px; font-size:22px; color:' + pcol + ';">' + (d.profit || 0).toFixed(2) + ' MAD</td><td style="padding:14px 10px; font-size:22px;">' + pc + '</td><td style="padding:14px 10px;">' + recetteBadge + '</td><td style="padding:14px 10px;"><button class="btn-edit" onclick="editDocument(\'categories\',\'' + d.id + '\')" style="font-size:22px; padding:10px 16px;"><i class="fas fa-edit"></i></button> <button class="btn-delete" onclick="deleteDocument(\'categories\',\'' + d.id + '\')" style="font-size:22px; padding:10px 16px;"><i class="fas fa-trash"></i></button></td></tr>';
    }
    document.getElementById('categoriesPagination').innerHTML = getPaginationHTML('categories', data.length);
}

function openCategoryForm(data) {
    data = data || {}; editCategoryData = data;
    var recetteChecked = data.recette ? 'checked' : '';
    var h = '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Image</label><input type="file" id="catImage" onchange="previewImage(this,\'catPreview\')" style="font-size:20px; padding:10px;"><div id="catPreview">' + (data.imageBase64 ? '<img src="' + data.imageBase64 + '" style="max-width:120px;">' : '') + '</div></div></div>' +
        '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Nom *</label><input type="text" id="catNom" value="' + escapeHtml(data.nom || '') + '" required style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">Ordre d\'affichage</label><input type="number" id="catOrdre" value="' + (data.ordre || 0) + '" min="0" step="1" placeholder="0 = fin de liste" style="font-size:22px; padding:14px;"></div></div>' +
        '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Description</label><textarea id="catDesc" style="font-size:22px; padding:14px;">' + escapeHtml(data.description || '') + '</textarea></div><div class="form-group"><label style="font-size:22px;">CA</label><input type="number" id="catCA" value="' + (data.ca || 0) + '" step="0.01" style="font-size:22px; padding:14px;"></div></div>' +
        '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Profit</label><input type="number" id="catProfit" value="' + (data.profit || 0) + '" step="0.01" style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">Recette</label><div style="display:flex; align-items:center; gap:12px; margin-top:6px;"><input type="checkbox" id="catRecette" ' + recetteChecked + ' style="width:28px; height:28px;"><span style="font-size:22px;">Activer la personnalisation</span></div></div></div>' +
        '<div style="display:flex; gap:12px; margin-top:20px;"><button class="btn-cancel" onclick="closeModal()" style="font-size:22px; padding:14px 28px;">Annuler</button><button class="btn-save" onclick="saveCategory()" style="font-size:22px; padding:14px 28px;">Enregistrer</button></div>';
    currentCollection = 'categories';
    openModal(editingId ? 'Modifier Catégorie' : 'Nouvelle Catégorie', h);
}

function saveCategory() {
    var n = document.getElementById('catNom').value;
    if (!n) { alert('Nom obligatoire'); return; }
    var f = document.getElementById('catImage').files[0];
    var recette = document.getElementById('catRecette').checked;
    var existingImage = (editingId && editCategoryData) ? editCategoryData.imageBase64 : null;
    var sf = function(img) {
        var d = {
            nom: n,
            description: document.getElementById('catDesc').value,
            ca: parseFloat(document.getElementById('catCA').value) || 0,
            profit: parseFloat(document.getElementById('catProfit').value) || 0,
            recette: recette,
            ordre: parseInt(document.getElementById('catOrdre').value) || 0
        };
        d.imageBase64 = img || existingImage;
        saveDocument('categories', d, function() { 
            closeModal(); 
            refreshCurrentPage(); 
            
            // ✅ AJOUT : Sauvegarde du cache
            if (typeof CacheDB !== 'undefined' && CacheDB.saveCollection) {
                CacheDB.saveCollection('categories');
            }
        });
    };
    if (f) fileToBase64(f, sf); else sf(null);
}

// ==================== PRODUITS ====================
async function loadStockForProductForm() {
    if (typeof allStockData === 'undefined' || allStockData.length === 0) {
        try { const snap = await db.collection('stock').orderBy('nom').get(); allStockData = []; snap.forEach(d => { let dd = d.data(); dd.id = d.id; allStockData.push(dd); }); } catch (e) { console.error(e); }
    }
}

async function loadFournisseursForForm() {
    let fournisseurs = [];
    try {
        const cached = await CacheDB.getAll('fournisseurs');
        if (cached.length) {
            fournisseurs = cached;
        } else {
            const snapshot = await db.collection('fournisseurs').orderBy('nom').get();
            snapshot.forEach(d => { let dd = d.data(); dd.id = d.id; fournisseurs.push(dd); });
            for (let doc of fournisseurs) await CacheDB.set('fournisseurs', doc.id, doc);
        }
    } catch (e) { console.error(e); }
    return fournisseurs;
}

function renderIngredientRow(index, ing) {
    ing = ing || {};
    var stockOptions = '<option value="">-- Choisir --</option>';
    if (typeof allStockData !== 'undefined') { allStockData.forEach(function(s) { var selected = (ing.idStock === s.id) ? 'selected' : ''; stockOptions += '<option value="' + s.id + '" ' + selected + '>' + escapeHtml(s.nom) + ' (' + (s.unite || '') + ')</option>'; }); }
    return '<div class="ingredient-row" style="display:flex; gap:12px; align-items:center; margin-bottom:8px;">' +
        '<select class="ingredient-select" style="flex:1; padding:14px; border:2px solid #e2e8f0; border-radius:8px; font-size:20px;" onchange="updateIngredientUnit(this)">' + stockOptions + '</select>' +
        '<input type="number" class="ingredient-qty" placeholder="Qté" value="' + (ing.quantite || '') + '" step="any" style="width:120px; padding:14px; border:2px solid #e2e8f0; border-radius:8px; font-size:20px;">' +
        '<span class="ingredient-unit" style="min-width:80px; text-align:center; font-size:20px;">' + (ing.unite || '') + '</span>' +
        '<button type="button" class="btn-delete" onclick="this.parentElement.remove()" style="font-size:22px; padding:12px 16px;"><i class="fas fa-times"></i></button></div>';
}

function addIngredientRow() { var container = document.getElementById('productIngredientsList'); if (container) { container.insertAdjacentHTML('beforeend', renderIngredientRow(container.children.length, {})); } }

function updateIngredientUnit(selectEl) {
    var row = selectEl.closest('.ingredient-row'); var unitSpan = row.querySelector('.ingredient-unit');
    var selectedId = selectEl.value; var stockItem = allStockData.find(function(s) { return s.id === selectedId; });
    if (stockItem) { unitSpan.textContent = stockItem.unite || ''; } else { unitSpan.textContent = ''; }
}

function calculatePrixAchat() {
    var boxPrice = parseFloat(document.getElementById('prodBoxPrice').value) || 0;
    var boxUnit = parseFloat(document.getElementById('prodBoxUnit').value) || 1;
    if (boxUnit <= 0) boxUnit = 1;
    var prixAchat = boxPrice / boxUnit;
    document.getElementById('prodPA').value = prixAchat.toFixed(2);
}

function loadProductsPage(c) {
    c.innerHTML = '<div class="content-card"><div class="card-header" style="flex-wrap:wrap; gap:12px;"><h3 style="font-size:28px;"><i class="fas fa-box"></i> Produits</h3><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">' +
        '<input type="text" id="productSearchInput" placeholder="🔍 Rechercher un produit..." style="padding:14px 18px; border:2px solid #e2e8f0; border-radius:12px; width:280px; font-size:22px; min-height:60px;" onkeyup="window.productSearchQuery = this.value.trim().toLowerCase(); window.currentPages.products=1; renderProductsTable();">' +
        '<select id="categoryFilter" onchange="filterProducts()" style="padding:14px 18px; border:2px solid #e2e8f0; border-radius:12px; font-size:22px; min-height:60px; min-width:200px;"><option value="">Toutes catégories</option></select>' +
        '<button class="btn-add" onclick="openProductForm()" style="font-size:22px; padding:14px 24px; min-height:60px;"><i class="fas fa-plus"></i> Nouveau</button>' +
        '<button class="btn-success" onclick="openAchatModal()" style="font-size:22px; padding:14px 24px; min-height:60px; background:#2563eb; color:#fff; border:none; border-radius:12px; cursor:pointer;"><i class="fas fa-shopping-cart"></i> Effectuer des achats</button>' +
        '</div></div>' +
        '<div class="table-container" style="overflow-x:auto;"><table class="data-table" id="productsTable" style="font-size:20px; width:100%;"><thead><tr style="font-size:22px;">' +
        '<th style="padding:14px 10px;">Img</th>' +
        makeSortableHeader('products', 'nom', 'Nom', 'loadProducts') + '<th style="padding:14px 10px;">Catégories</th>' +
        '<th style="padding:14px 10px;">Marque</th><th style="padding:14px 10px;">Prix boîte</th><th style="padding:14px 10px;">Unités/boîte</th><th style="padding:14px 10px;">Fournisseur</th>' +
        makeSortableHeader('products', 'prixAchat', 'Achat', 'loadProducts') + makeSortableHeader('products', 'prixVente', 'Vente', 'loadProducts') +
        makeSortableHeader('products', 'prixPromo', 'Promo', 'loadProducts') + makeSortableHeader('products', 'profit', 'Profit', 'loadProducts') +
        makeSortableHeader('products', 'stock', 'Stock', 'loadProducts') + makeSortableHeader('products', 'vendues', 'Vendues', 'loadProducts') +
        makeSortableHeader('products', 'ca', 'CA', 'loadProducts') + makeSortableHeader('products', 'disponible', 'Dispo', 'loadProducts') +
        '<th style="padding:14px 10px;">Temps</th><th style="padding:14px 10px;">Desc</th><th style="padding:14px 10px;">Actions</th></thead><tbody style="font-size:20px;"></tbody></div><div id="productsPagination"></div></div>';
    loadCategoriesInFilter(); loadProducts();
}

async function loadCategoriesInFilter() {
    var s = document.getElementById('categoryFilter'); if (!s) return;
    try { var sn = await db.collection('categories').get(); s.innerHTML = '<option value="">Toutes catégories</option>'; sn.forEach(function(d) { s.innerHTML += '<option value="' + escapeHtml(d.data().nom) + '">' + escapeHtml(d.data().nom) + '</option>'; }); } catch (e) { }
}

function filterProducts() { selectedCategoryFilter = document.getElementById('categoryFilter').value; currentPages.products = 1; renderProductsTable(); }

// ✅ CORRECTION DÉFINITIVE ANTI-DOUBLONS
var _productsLoaded = false; // 🔒 Verrou anti-doublons

async function loadProducts() {
    // 🔒 Si déjà chargé, ne pas recharger
    if (_productsLoaded) return;
    _productsLoaded = true;
    
    // ✅ 1. Charger depuis le cache (RAPIDE)
    const cached = await CacheDB.getAll('products');
    if (cached.length) {
        window.allProductsData = cached;
        renderProductsTable();
    }
    
    // ✅ 2. Mettre à jour depuis Firestore SEULEMENT si le cache est vide
    if (window.allProductsData.length === 0) {
        try {
            const snapshot = await db.collection('products').get();
            window.allProductsData = [];
            snapshot.forEach(d => { let dd = d.data(); dd.id = d.id; let prix = (dd.prixPromo && dd.prixPromo > 0) ? dd.prixPromo : (dd.prixVente || 0); dd.profit = (prix - (dd.prixAchat || 0)); window.allProductsData.push(dd); });
            for (let doc of window.allProductsData) await CacheDB.set('products', doc.id, doc);
            renderProductsTable();
        } catch (e) { console.error(e); }
    }
}

function renderProductsTable() {
    var tb = document.querySelector('#productsTable tbody'); if (!tb) return;
    var data = window.allProductsData.slice();
    if (selectedCategoryFilter) {
        data = data.filter(function(d) {
            if (d.categories && d.categories.length > 0) return d.categories.includes(selectedCategoryFilter);
            return d.categorie === selectedCategoryFilter;
        });
    }
    if (window.productSearchQuery) {
        var q = window.productSearchQuery;
        data = data.filter(function(d) {
            return (d.nom || '').toLowerCase().indexOf(q) !== -1 || (d.description || '').toLowerCase().indexOf(q) !== -1;
        });
    }
    data = applySort('products', data, 'nom'); var pageData = getPageData('products', data);
    tb.innerHTML = '';
    if (pageData.length === 0) { tb.innerHTML = '<tr><td colspan="18" style="text-align:center;padding:40px;font-size:24px;">Aucun produit</td></tr>'; document.getElementById('productsPagination').innerHTML = ''; return; }
    for (var i = 0; i < pageData.length; i++) {
        var d = pageData[i];
        var im = d.imageBase64 ? '<img src="' + d.imageBase64 + '" style="width:50px;height:50px;object-fit:cover;border-radius:8px;">' : '<i class="fas fa-box" style="color:#94a3b8; font-size:28px;"></i>';
        var disp = d.disponible !== false ? '<span class="status-success" style="font-size:20px; padding:4px 12px;">Oui</span>' : '<span class="status-danger" style="font-size:20px; padding:4px 12px;">Non</span>';
        var profitVal = (d.profit !== undefined && !isNaN(d.profit)) ? d.profit : 0; var pc = profitVal >= 0 ? '#14B8A6' : '#dc2626';
        var categoriesDisplay = (d.categories && d.categories.length > 0) ? d.categories.join(', ') : (d.categorie || '-');
        var fournisseurDisplay = d.fournisseurNom || d.fournisseurId || '-';
        tb.innerHTML += '<tr>' +
            '<td style="padding:14px 10px;">' + im + '</td>' +
            '<td style="padding:14px 10px; font-size:22px; font-weight:600;"><strong>' + escapeHtml(d.nom || '') + '</strong></td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + escapeHtml(categoriesDisplay) + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + escapeHtml(d.brand || '-') + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + ((d.box_price || 0).toFixed(2)) + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + (d.box_unit || 1) + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + escapeHtml(fournisseurDisplay) + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + ((d.prixAchat || 0).toFixed(2)) + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + ((d.prixVente || 0).toFixed(2)) + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + ((d.prixPromo || 0).toFixed(2)) + '</td>' +
            '<td style="padding:14px 10px; font-size:20px; color:' + pc + '; font-weight:600;">' + profitVal.toFixed(2) + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + (d.stock || 0) + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + (d.vendues || 0) + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + ((d.ca || 0).toFixed(2)) + '</td>' +
            '<td style="padding:14px 10px;">' + disp + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + (d.tempsPrep || '-') + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + (d.description || '-') + '</td>' +
            '<td style="padding:14px 10px;"><button class="btn-edit" onclick="editDocument(\'products\',\'' + d.id + '\')" style="font-size:20px; padding:10px 16px;"><i class="fas fa-edit"></i></button> <button class="btn-delete" onclick="deleteDocument(\'products\',\'' + d.id + '\')" style="font-size:20px; padding:10px 16px;"><i class="fas fa-trash"></i></button></td></tr>';
    }
    document.getElementById('productsPagination').innerHTML = getPaginationHTML('products', data.length);
}

async function openProductForm(data) {
    data = data || {}; await loadStockForProductForm();

    var selectOptions = '';
    var preselected = data.categories || (data.categorie ? [data.categorie] : []);
    try {
        var cs = await db.collection('categories').get();
        cs.forEach(function(d) {
            var catName = d.data().nom;
            var selected = preselected.includes(catName) ? 'selected' : '';
            selectOptions += '<option value="' + escapeHtml(catName) + '" ' + selected + ' style="font-size:20px; padding:10px;">' + escapeHtml(catName) + '</option>';
        });
    } catch (e) { }

    var categoriesHtml = 
        '<div class="form-group" style="min-width:100%;">' +
            '<label style="font-size:22px; font-weight:600;">Catégories</label>' +
            '<select id="prodCategoriesSelect" multiple size="5" style="width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:12px; font-size:20px; min-height:120px;" onchange="updateSelectedCategories()">' +
                selectOptions +
            '</select>' +
            '<div id="selectedCategoriesDisplay" style="margin-top:12px; display:flex; flex-wrap:wrap; gap:10px;"></div>' +
        '</div>';

    const fournisseurs = await loadFournisseursForForm();
    var datalistOptions = '';
    fournisseurs.forEach(f => {
        var label = f.nom + (f.prenom ? ' ' + f.prenom : '') + (f.societe ? ' (' + f.societe + ')' : '');
        datalistOptions += '<option value="' + escapeHtml(label) + '" data-id="' + f.id + '">';
    });

    var fournisseurValue = '';
    if (data.fournisseurNom) {
        fournisseurValue = data.fournisseurNom;
    } else if (data.fournisseurId) {
        var found = fournisseurs.find(f => f.id === data.fournisseurId);
        if (found) fournisseurValue = found.nom + (found.prenom ? ' ' + found.prenom : '') + (found.societe ? ' (' + found.societe + ')' : '');
    }

    var ip = data.imageBase64 ? '<img src="' + data.imageBase64 + '" style="max-width:120px;">' : '';
    var dy = data.disponible !== false ? 'selected' : '', dn = data.disponible === false ? 'selected' : '';

    var h = '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Image</label><input type="file" id="prodImage" onchange="previewImage(this,\'prodPreview\')" style="font-size:20px; padding:10px;"><div id="prodPreview">' + ip + '</div></div></div>' +
        '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Nom *</label><input type="text" id="prodNom" value="' + escapeHtml(data.nom || '') + '" required style="font-size:22px; padding:14px;"></div></div>' +
        categoriesHtml +
        '<div class="form-row">' +
            '<div class="form-group"><label style="font-size:22px;">Marque</label><input type="text" id="prodBrand" value="' + escapeHtml(data.brand || '') + '" style="font-size:22px; padding:14px;"></div>' +
            '<div class="form-group"><label style="font-size:22px;">Prix boîte (MAD)</label><input type="number" id="prodBoxPrice" step="0.01" value="' + (data.box_price || 0) + '" oninput="calculatePrixAchat()" style="font-size:22px; padding:14px;"></div>' +
        '</div>' +
        '<div class="form-row">' +
            '<div class="form-group"><label style="font-size:22px;">Unités par boîte</label><input type="number" id="prodBoxUnit" step="1" min="1" value="' + (data.box_unit || 1) + '" oninput="calculatePrixAchat()" style="font-size:22px; padding:14px;"></div>' +
            '<div class="form-group"><label style="font-size:22px;">Prix d\'achat unitaire (calculé)</label><input type="number" id="prodPA" step="0.01" value="' + (data.prixAchat || 0) + '" readonly style="background:#f3f4f6; font-size:22px; padding:14px;"></div>' +
        '</div>' +
        '<div class="form-row">' +
            '<div class="form-group" style="min-width:100%;">' +
                '<label style="font-size:22px;">Fournisseur</label>' +
                '<input list="fournisseurList" id="prodFournisseur" class="form-control" placeholder="Tapez un nom pour rechercher..." value="' + escapeHtml(fournisseurValue) + '" style="width:100%; padding:14px; border:2px solid #e2e8f0; border-radius:12px; font-size:22px;">' +
                '<datalist id="fournisseurList">' + datalistOptions + '</datalist>' +
            '</div>' +
        '</div>' +
        '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Prix Vente</label><input type="number" id="prodPV" value="' + (data.prixVente || 0) + '" step="0.01" style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">Prix Promo</label><input type="number" id="prodPromo" value="' + (data.prixPromo || 0) + '" step="0.01" style="font-size:22px; padding:14px;"></div></div>' +
        '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Stock</label><input type="number" id="prodStock" value="' + (data.stock || 0) + '" style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">Temps Prep</label><input type="text" id="prodTemps" value="' + escapeHtml(data.tempsPrep || '') + '" placeholder="15 min" style="font-size:22px; padding:14px;"></div></div>' +
        '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Disponible</label><select id="prodDispo" style="font-size:22px; padding:14px;"><option value="1" ' + dy + '>Oui</option><option value="0" ' + dn + '>Non</option></select></div><div class="form-group"><label style="font-size:22px;">Description</label><textarea id="prodDesc" style="font-size:22px; padding:14px;">' + escapeHtml(data.description || '') + '</textarea></div></div>' +
        '<div class="form-row" style="flex-direction:column;"><label style="font-weight:600; font-size:22px; margin-bottom:12px;">🧾 Recette (ingrédients du stock)</label><div id="productIngredientsList" style="display:flex; flex-direction:column; gap:10px;">';
    if (data.ingredients && data.ingredients.length > 0) { data.ingredients.forEach(function(ing, idx) { h += renderIngredientRow(idx, ing); }); }
    h += '</div><button type="button" class="btn-add" onclick="addIngredientRow()" style="margin-top:12px; width:auto; font-size:20px; padding:12px 20px;"><i class="fas fa-plus"></i> Ajouter un ingrédient</button></div>' +
        '<div style="display:flex; gap:12px; margin-top:20px;"><button class="btn-cancel" onclick="closeModal()" style="font-size:22px; padding:14px 28px;">Annuler</button><button class="btn-save" onclick="saveProduct()" style="font-size:22px; padding:14px 28px;">Enregistrer</button></div>';
    currentCollection = 'products';
    openModal(editingId ? 'Modifier Produit' : 'Nouveau Produit', h);

    setTimeout(function() {
        if (typeof updateSelectedCategories === 'function') updateSelectedCategories();
        calculatePrixAchat();
    }, 50);
}

function saveProduct() {
    var n = document.getElementById('prodNom').value; if (!n) { alert('Nom obligatoire'); return; }
    var f = document.getElementById('prodImage').files[0]; var ingredients = [];
    var rows = document.querySelectorAll('#productIngredientsList .ingredient-row');
    rows.forEach(function(row) {
        var select = row.querySelector('.ingredient-select'); var qtyInput = row.querySelector('.ingredient-qty');
        if (select && select.value && qtyInput && parseFloat(qtyInput.value) > 0) {
            var stockId = select.value; var stockItem = allStockData.find(function(s) { return s.id === stockId; });
            ingredients.push({ idStock: stockId, nom: stockItem ? stockItem.nom : '', quantite: parseFloat(qtyInput.value), unite: stockItem ? stockItem.unite : '' });
        }
    });

    var select = document.getElementById('prodCategoriesSelect');
    var selectedCategories = select ? Array.from(select.selectedOptions).map(opt => opt.value) : [];

    var fournisseurInput = document.getElementById('prodFournisseur');
    var fournisseurValue = fournisseurInput ? fournisseurInput.value.trim() : '';
    var fournisseurId = null;
    var fournisseurNom = fournisseurValue;

    var datalist = document.getElementById('fournisseurList');
    if (datalist && fournisseurValue) {
        var options = datalist.options;
        for (var opt of options) {
            if (opt.value.toLowerCase() === fournisseurValue.toLowerCase()) {
                fournisseurId = opt.getAttribute('data-id');
                break;
            }
        }
        if (fournisseurId) {
            fournisseurNom = fournisseurValue;
        }
    }
    if (!fournisseurId && fournisseurValue) {
        fournisseurId = null;
    }

    var prixAchat = parseFloat(document.getElementById('prodPA').value) || 0;
    var prixVente = parseFloat(document.getElementById('prodPV').value) || 0;
    var prixPromo = parseFloat(document.getElementById('prodPromo').value) || 0;
    var prix = (prixPromo > 0) ? prixPromo : prixVente;
    var profit = prix - prixAchat;

    var sf = function(img) {
        var d = {
            nom: n,
            brand: document.getElementById('prodBrand').value.trim(),
            box_price: parseFloat(document.getElementById('prodBoxPrice').value) || 0,
            box_unit: parseFloat(document.getElementById('prodBoxUnit').value) || 1,
            prixAchat: prixAchat,
            prixVente: prixVente,
            prixPromo: prixPromo,
            profit: profit,
            stock: parseInt(document.getElementById('prodStock').value) || 0,
            vendues: 0,
            ca: 0,
            tempsPrep: document.getElementById('prodTemps').value,
            disponible: document.getElementById('prodDispo').value === '1',
            description: document.getElementById('prodDesc').value,
            categories: selectedCategories,
            categorie: selectedCategories.length > 0 ? selectedCategories[0] : '',
            ingredients: ingredients,
            fournisseurId: fournisseurId,
            fournisseurNom: fournisseurNom
        };
        if (img) d.imageBase64 = img;
        if (editingId) { 
            CacheDB.write('products', editingId, d, 'update').then(function() { 
                var idx = window.allProductsData.findIndex(function(x) { return x.id === editingId; }); 
                if (idx !== -1) window.allProductsData[idx] = Object.assign({}, window.allProductsData[idx], d, { id: editingId }); 
                closeModal(); renderProductsTable(); CacheDB.sync(); 
                
                // ✅ AJOUT : Sauvegarde du cache
                if (typeof CacheDB !== 'undefined' && CacheDB.saveCollection) {
                    CacheDB.saveCollection('products');
                }
            }); 
        }
        else { 
            CacheDB.write('products', null, d, 'add').then(function(newId) { 
                d.id = newId; 
                window.allProductsData.push(d); 
                closeModal(); renderProductsTable(); CacheDB.sync(); 
                
                // ✅ AJOUT : Sauvegarde du cache
                if (typeof CacheDB !== 'undefined' && CacheDB.saveCollection) {
                    CacheDB.saveCollection('products');
                }
            }); 
        }
    };
    if (f) fileToBase64(f, sf); else sf(null);
}

// ==================== CLIENTS ====================
function loadClientsPage(c) {
    c.innerHTML = '<div class="content-card"><div class="card-header" style="flex-wrap:wrap; gap:12px;"><h3 style="font-size:28px;"><i class="fas fa-users"></i> Clients</h3><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">' +
        '<div class="input-group" style="width:350px;min-width:250px;margin-bottom:0;background:#fff;border:2px solid var(--border);border-radius:12px;"><i class="fas fa-search" style="color:#94a3b8; font-size:22px;"></i><input type="text" id="clientSearchInput" placeholder="Rechercher..." onkeyup="clientSearch(this.value)" style="border:none;padding:14px; font-size:22px; width:100%;"></div>' +
        '<button class="btn-add" onclick="openClientForm()" style="font-size:22px; padding:14px 24px; min-height:60px;"><i class="fas fa-plus"></i> Ajouter</button></div></div>' +
        '<div class="table-container" style="overflow-x:auto;"><table class="data-table" id="clientsTable" style="font-size:20px; width:100%;"><thead><tr style="font-size:22px;">' +
        makeSortableHeader('clients', 'id', 'ID', 'loadClients') + makeSortableHeader('clients', 'nom', 'Nom', 'loadClients') +
        makeSortableHeader('clients', 'prenom', 'Prénom', 'loadClients') + makeSortableHeader('clients', 'username', 'Username', 'loadClients') +
        makeSortableHeader('clients', 'genre', 'Genre', 'loadClients') + makeSortableHeader('clients', 'adresse', 'Adresse', 'loadClients') +
        makeSortableHeader('clients', 'email', 'Email', 'loadClients') + makeSortableHeader('clients', 'telephone', 'Tél', 'loadClients') +
        makeSortableHeader('clients', 'whatsapp', 'WhatsApp', 'loadClients') + makeSortableHeader('clients', 'facebook', 'Facebook', 'loadClients') +
        makeSortableHeader('clients', 'instagram', 'Instagram', 'loadClients') + makeSortableHeader('clients', 'ca', 'CA', 'loadClients') +
        makeSortableHeader('clients', 'profit', 'Profit', 'loadClients') + makeSortableHeader('clients', 'pointsFidelite', 'Points Fid', 'loadClients') +
        makeSortableHeader('clients', 'allergies', 'Allergies', 'loadClients') + makeSortableHeader('clients', 'aime', 'Aime', 'loadClients') +
        makeSortableHeader('clients', 'deteste', 'Déteste', 'loadClients') + makeSortableHeader('clients', 'createdAt', 'Date créé', 'loadClients') +
        makeSortableHeader('clients', 'description', 'Description', 'loadClients') + '<th style="padding:14px 10px;">Actions</th></thead><tbody style="font-size:20px;"></tbody></div><div id="clientsPagination"></div></div>';
    loadClients();
}

function clientSearch(query) { clientSearchQuery = query.toLowerCase().trim(); currentPages.clients = 1; renderClientsTable(); }

// ✅ CORRECTION DÉFINITIVE ANTI-DOUBLONS
var _clientsLoaded = false; // 🔒 Verrou anti-doublons

async function loadClients() {
    // 🔒 Si déjà chargé, ne pas recharger
    if (_clientsLoaded) return;
    _clientsLoaded = true;
    
    // ✅ 1. Charger depuis le cache (RAPIDE)
    const cached = await CacheDB.getAll('clients');
    if (cached.length) {
        allClientsData = cached;
        renderClientsTable();
    }
    
    // ✅ 2. Mettre à jour depuis Firestore SEULEMENT si le cache est vide
    if (allClientsData.length === 0) {
        try {
            const snapshot = await db.collection('clients').get();
            allClientsData = [];
            snapshot.forEach(d => { let dd = d.data(); dd.id = d.id; allClientsData.push(dd); });
            for (let doc of allClientsData) await CacheDB.set('clients', doc.id, doc);
            renderClientsTable();
        } catch (e) { console.error(e); }
    }
}

function renderClientsTable() {
    var tb = document.querySelector('#clientsTable tbody'); if (!tb) return;
    var data = allClientsData.slice();
    if (clientSearchQuery) { data = data.filter(function(d) { return (d.nom || '').toLowerCase().indexOf(clientSearchQuery) !== -1 || (d.prenom || '').toLowerCase().indexOf(clientSearchQuery) !== -1 || (d.username || '').toLowerCase().indexOf(clientSearchQuery) !== -1 || (d.email || '').toLowerCase().indexOf(clientSearchQuery) !== -1 || (d.telephone || '').toLowerCase().indexOf(clientSearchQuery) !== -1 || (d.description || '').toLowerCase().indexOf(clientSearchQuery) !== -1; }); }
    data = applySort('clients', data, 'nom'); var pageData = getPageData('clients', data);
    tb.innerHTML = '';
    if (pageData.length === 0) { tb.innerHTML = '<tr><td colspan="20" style="text-align:center;padding:40px;font-size:24px;">Aucun client</td></tr>'; document.getElementById('clientsPagination').innerHTML = ''; return; }
    for (var i = 0; i < pageData.length; i++) {
        var d = pageData[i];
        var dateCreated = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleDateString('fr-FR') + ' ' + new Date(d.createdAt.seconds * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-';
        var row = '<tr>' +
            '<td style="padding:14px 10px; font-size:20px;"><small>' + (d.id || '').substring(0, 6) + '</small></td>' +
            '<td style="padding:14px 10px; font-size:22px; font-weight:600;"><strong>' + escapeHtml(d.nom || '') + '</strong></td>' +
            '<td style="padding:14px 10px; font-size:22px;">' + escapeHtml(d.prenom || '') + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">@' + escapeHtml(d.username || '') + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + escapeHtml(d.genre || '-') + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;"><small>' + escapeHtml(d.adresse || '-') + '</small></td>' +
            '<td style="padding:14px 10px; font-size:20px;"><small>' + escapeHtml(d.email || '-') + '</small></td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + escapeHtml(d.telephone || '-') + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + escapeHtml(d.whatsapp || '-') + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + escapeHtml(d.facebook || '-') + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + escapeHtml(d.instagram || '-') + '</td>' +
            '<td style="padding:14px 10px; font-size:20px; color:#14B8A6; font-weight:600;">' + (d.ca || 0).toFixed(2) + '</td>' +
            '<td style="padding:14px 10px; font-size:20px; color:#14B8A6;">' + (d.profit || 0).toFixed(2) + '</td>' +
            '<td style="padding:14px 10px; font-size:20px; color:#14B8A6; font-weight:600;">' + (d.pointsFidelite || 0) + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;"><small>' + (d.allergies ? d.allergies.join(', ') : '-') + '</small></td>' +
            '<td style="padding:14px 10px; font-size:20px;"><small>' + (d.aime ? d.aime.join(', ') : '-') + '</small></td>' +
            '<td style="padding:14px 10px; font-size:20px;"><small>' + (d.deteste ? d.deteste.join(', ') : '-') + '</small></td>' +
            '<td style="padding:14px 10px; font-size:20px;"><small>' + dateCreated + '</small></td>' +
            '<td style="padding:14px 10px; font-size:20px;"><small>' + escapeHtml(d.description || '-') + '</small></td>' +
            '<td style="padding:14px 10px;"><button class="btn-edit" onclick="editClient(\'' + d.id + '\')" style="font-size:20px; padding:10px 16px;"><i class="fas fa-edit"></i></button> <button class="btn-delete" onclick="deleteClient(\'' + d.id + '\')" style="font-size:20px; padding:10px 16px;"><i class="fas fa-trash"></i></button></td></tr>';
        tb.innerHTML += row;
    }
    document.getElementById('clientsPagination').innerHTML = getPaginationHTML('clients', data.length);
}

function openClientForm(data) {
    data = data || {};
    var h = '';
    h += '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Nom *</label><input type="text" id="cliNom" value="' + escapeHtml(data.nom || '') + '" required style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">Prénom *</label><input type="text" id="cliPrenom" value="' + escapeHtml(data.prenom || '') + '" required style="font-size:22px; padding:14px;"></div></div>';
    h += '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Username</label><input type="text" id="cliUsername" value="' + escapeHtml(data.username || '') + '" style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">Genre</label><select id="cliGenre" style="font-size:22px; padding:14px;"><option value="">-</option><option value="M" ' + (data.genre === 'M' ? 'selected' : '') + '>M</option><option value="F" ' + (data.genre === 'F' ? 'selected' : '') + '>F</option></select></div></div>';
    h += '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Adresse</label><input type="text" id="cliAdresse" value="' + escapeHtml(data.adresse || '') + '" style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">Email</label><input type="email" id="cliEmail" value="' + escapeHtml(data.email || '') + '" style="font-size:22px; padding:14px;"></div></div>';
    h += '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Téléphone</label><input type="text" id="cliTel" value="' + escapeHtml(data.telephone || '') + '" style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">WhatsApp</label><input type="text" id="cliWhatsapp" value="' + escapeHtml(data.whatsapp || '') + '" style="font-size:22px; padding:14px;"></div></div>';
    h += '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Facebook</label><input type="text" id="cliFacebook" value="' + escapeHtml(data.facebook || '') + '" style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">Instagram</label><input type="text" id="cliInstagram" value="' + escapeHtml(data.instagram || '') + '" style="font-size:22px; padding:14px;"></div></div>';
    h += '<div class="form-row"><div class="form-group"><label style="font-size:22px;">CA</label><input type="number" id="cliCA" value="' + (data.ca || 0) + '" step="0.01" style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">Profit</label><input type="number" id="cliProfit" value="' + (data.profit || 0) + '" step="0.01" style="font-size:22px; padding:14px;"></div></div>';
    h += '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Points Fidélité</label><input type="number" id="cliPoints" value="' + (data.pointsFidelite || 0) + '" style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">Description</label><textarea id="cliDesc" style="font-size:22px; padding:14px;">' + escapeHtml(data.description || '') + '</textarea></div></div>';
    h += '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Allergies (virgules)</label><input type="text" id="cliAllergies" value="' + (data.allergies ? data.allergies.join(', ') : '') + '" placeholder="gluten, lactose" style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">Aime (virgules)</label><input type="text" id="cliAime" value="' + (data.aime ? data.aime.join(', ') : '') + '" placeholder="café, thé" style="font-size:22px; padding:14px;"></div></div>';
    h += '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Déteste (virgules)</label><input type="text" id="cliDeteste" value="' + (data.deteste ? data.deteste.join(', ') : '') + '" placeholder="sucre, lactose" style="font-size:22px; padding:14px;"></div></div>';
    h += '<div style="display:flex; gap:12px; margin-top:20px;"><button class="btn-cancel" onclick="closeModal()" style="font-size:22px; padding:14px 28px;">Annuler</button><button class="btn-save" onclick="saveClient()" style="font-size:22px; padding:14px 28px;">Enregistrer</button></div>';
    currentCollection = 'clients'; openModal(editingId ? 'Modifier Client' : 'Nouveau Client', h);
}

function saveClient() {
    var n = document.getElementById('cliNom').value, p = document.getElementById('cliPrenom').value;
    if (!n || !p) { alert('Nom et Prénom obligatoires'); return; }
    var d = { nom: n, prenom: p, username: document.getElementById('cliUsername').value, genre: document.getElementById('cliGenre').value, adresse: document.getElementById('cliAdresse').value, email: document.getElementById('cliEmail').value, telephone: document.getElementById('cliTel').value, whatsapp: document.getElementById('cliWhatsapp').value, facebook: document.getElementById('cliFacebook').value, instagram: document.getElementById('cliInstagram').value, ca: parseFloat(document.getElementById('cliCA').value) || 0, profit: parseFloat(document.getElementById('cliProfit').value) || 0, pointsFidelite: parseInt(document.getElementById('cliPoints').value) || 0, allergies: document.getElementById('cliAllergies').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean), aime: document.getElementById('cliAime').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean), deteste: document.getElementById('cliDeteste').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean), description: document.getElementById('cliDesc').value };
    if (!editingId) d.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    saveDocument('clients', d, function() { 
        closeModal(); 
        loadClients(); 
        
        // ✅ AJOUT : Sauvegarde du cache
        if (typeof CacheDB !== 'undefined' && CacheDB.saveCollection) {
            CacheDB.saveCollection('clients');
        }
    });
}

function editClient(id) { db.collection('clients').doc(id).get().then(function(doc) { if (doc.exists) { editingId = id; currentCollection = 'clients'; openClientForm(doc.data()); } }); }
function deleteClient(id) { if (confirm('Supprimer ce client ?')) { CacheDB.write('clients', id, null, 'delete').then(function() { alert('Supprimé'); loadClients(); CacheDB.sync(); }); } }

// ==================== FOURNISSEURS ====================
function loadFournisseursPage(c) {
    c.innerHTML = '<div class="content-card"><div class="card-header" style="flex-wrap:wrap; gap:12px;"><h3 style="font-size:28px;"><i class="fas fa-truck"></i> Fournisseurs</h3><button class="btn-add" onclick="openFournisseurForm()" style="font-size:22px; padding:14px 24px; min-height:60px;"><i class="fas fa-plus"></i> Ajouter</button></div>' +
        '<div class="table-container" style="overflow-x:auto;"><table class="data-table" id="fournisseursTable" style="font-size:20px; width:100%;"><thead><tr style="font-size:22px;">' +
        makeSortableHeader('fournisseurs', 'id', 'ID', 'loadFournisseurs') + makeSortableHeader('fournisseurs', 'nom', 'Nom', 'loadFournisseurs') +
        makeSortableHeader('fournisseurs', 'prenom', 'Prénom', 'loadFournisseurs') + makeSortableHeader('fournisseurs', 'societe', 'Société', 'loadFournisseurs') +
        makeSortableHeader('fournisseurs', 'telephone', 'Tél', 'loadFournisseurs') + makeSortableHeader('fournisseurs', 'whatsapp', 'WhatsApp', 'loadFournisseurs') +
        makeSortableHeader('fournisseurs', 'email', 'Email', 'loadFournisseurs') + makeSortableHeader('fournisseurs', 'adresse', 'Adresse', 'loadFournisseurs') +
        makeSortableHeader('fournisseurs', 'description', 'Description', 'loadFournisseurs') + makeSortableHeader('fournisseurs', 'ca', 'CA', 'loadFournisseurs') +
        '<th style="padding:14px 10px;">Catégories</th>' + makeSortableHeader('fournisseurs', 'createdAt', 'Date créé', 'loadFournisseurs') + '<th style="padding:14px 10px;">Actions</th></thead><tbody style="font-size:20px;"></tbody></div><div id="fournisseursPagination"></div></div>';
    loadFournisseurs();
}

// ✅ CORRECTION DÉFINITIVE ANTI-DOUBLONS
var _fournisseursLoaded = false; // 🔒 Verrou anti-doublons

async function loadFournisseurs() {
    // 🔒 Si déjà chargé, ne pas recharger
    if (_fournisseursLoaded) return;
    _fournisseursLoaded = true;
    
    // ✅ 1. Charger depuis le cache (RAPIDE)
    const cached = await CacheDB.getAll('fournisseurs');
    if (cached.length) {
        allFournisseursData = cached;
        renderFournisseursTable();
    }
    
    // ✅ 2. Mettre à jour depuis Firestore SEULEMENT si le cache est vide
    if (allFournisseursData.length === 0) {
        try {
            const snapshot = await db.collection('fournisseurs').get();
            allFournisseursData = [];
            snapshot.forEach(d => { let dd = d.data(); dd.id = d.id; allFournisseursData.push(dd); });
            for (let doc of allFournisseursData) await CacheDB.set('fournisseurs', doc.id, doc);
            renderFournisseursTable();
        } catch (e) { console.error(e); }
    }
}

function renderFournisseursTable() {
    var tb = document.querySelector('#fournisseursTable tbody'); if (!tb) return;
    var data = applySort('fournisseurs', allFournisseursData.slice(), 'nom'); var pageData = getPageData('fournisseurs', data);
    tb.innerHTML = '';
    if (pageData.length === 0) { tb.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:40px;font-size:24px;">Aucun fournisseur</td></tr>'; document.getElementById('fournisseursPagination').innerHTML = ''; return; }
    for (var i = 0; i < pageData.length; i++) {
        var d = pageData[i];
        var dateCreated = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleDateString('fr-FR') + ' ' + new Date(d.createdAt.seconds * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-';
        var categories = d.categories ? d.categories.join(', ') : '-';
        tb.innerHTML += '<tr>' +
            '<td style="padding:14px 10px; font-size:20px;"><small>' + (d.id || '').substring(0, 6) + '</small></td>' +
            '<td style="padding:14px 10px; font-size:22px; font-weight:600;"><strong>' + escapeHtml(d.nom || '') + '</strong></td>' +
            '<td style="padding:14px 10px; font-size:22px;">' + escapeHtml(d.prenom || '') + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + escapeHtml(d.societe || '-') + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + escapeHtml(d.telephone || '-') + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + escapeHtml(d.whatsapp || '-') + '</td>' +
            '<td style="padding:14px 10px; font-size:20px;"><small>' + escapeHtml(d.email || '-') + '</small></td>' +
            '<td style="padding:14px 10px; font-size:20px;"><small>' + escapeHtml(d.adresse || '-') + '</small></td>' +
            '<td style="padding:14px 10px; font-size:20px;"><small>' + escapeHtml(d.description || '-') + '</small></td>' +
            '<td style="padding:14px 10px; font-size:20px;">' + (d.ca || 0).toFixed(2) + ' MAD</td>' +
            '<td style="padding:14px 10px; font-size:20px;"><small>' + escapeHtml(categories) + '</small></td>' +
            '<td style="padding:14px 10px; font-size:20px;"><small>' + dateCreated + '</small></td>' +
            '<td style="padding:14px 10px;"><button class="btn-edit" onclick="editFournisseur(\'' + d.id + '\')" style="font-size:20px; padding:10px 16px;"><i class="fas fa-edit"></i></button> <button class="btn-delete" onclick="deleteFournisseur(\'' + d.id + '\')" style="font-size:20px; padding:10px 16px;"><i class="fas fa-trash"></i></button></td></tr>';
    }
    document.getElementById('fournisseursPagination').innerHTML = getPaginationHTML('fournisseurs', data.length);
}

function openFournisseurForm(data) {
    data = data || {}; var selectedCategories = data.categories || [];
    var h = '';
    h += '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Nom *</label><input type="text" id="fourNom" value="' + escapeHtml(data.nom || '') + '" required style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">Prénom</label><input type="text" id="fourPrenom" value="' + escapeHtml(data.prenom || '') + '" style="font-size:22px; padding:14px;"></div></div>';
    h += '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Société</label><input type="text" id="fourSociete" value="' + escapeHtml(data.societe || '') + '" style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">Téléphone</label><input type="text" id="fourTel" value="' + escapeHtml(data.telephone || '') + '" style="font-size:22px; padding:14px;"></div></div>';
    h += '<div class="form-row"><div class="form-group"><label style="font-size:22px;">WhatsApp</label><input type="text" id="fourWhatsapp" value="' + escapeHtml(data.whatsapp || '') + '" style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">Email</label><input type="email" id="fourEmail" value="' + escapeHtml(data.email || '') + '" style="font-size:22px; padding:14px;"></div></div>';
    h += '<div class="form-row"><div class="form-group"><label style="font-size:22px;">Adresse</label><input type="text" id="fourAdresse" value="' + escapeHtml(data.adresse || '') + '" style="font-size:22px; padding:14px;"></div><div class="form-group"><label style="font-size:22px;">CA</label><input type="number" id="fourCA" value="' + (data.ca || 0) + '" step="0.01" style="font-size:22px; padding:14px;"></div></div>';
    h += '<div class="form-row"><div class="form-group" style="min-width:100%;"><label style="font-size:22px;">Description</label><textarea id="fourDesc" style="font-size:22px; padding:14px;">' + escapeHtml(data.description || '') + '</textarea></div></div>';
    h += '<div class="form-row"><div class="form-group" style="min-width:100%;"><label style="font-size:22px;">Catégories</label><div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;">';
    fournisseurCategoriesList.forEach(function(cat) { var checked = selectedCategories.indexOf(cat) !== -1 ? 'checked' : ''; h += '<label style="display:flex;align-items:center;gap:8px;padding:10px 16px;border:2px solid #e2e8f0;border-radius:10px;cursor:pointer;font-size:20px;"><input type="checkbox" class="four-cat-check" value="' + cat + '" ' + checked + ' style="width:22px; height:22px;"> ' + cat + '</label>'; });
    h += '</div></div></div>';
    var schemaStr = data.factureSchema ? JSON.stringify(data.factureSchema, null, 2) : '{\n  "type": "table",\n  "columns": [\n    { "name": "produit", "index": 0 },\n    { "name": "quantite", "index": 1 }\n  ],\n  "skipRows": 1,\n  "separator": "tab"\n}';
    h += '<div class="form-row"><div class="form-group" style="min-width:100%;"><label style="font-size:22px;">Schéma de facture (JSON)</label>' +
        '<textarea id="fourSchema" style="width:100%;padding:14px;font-size:20px;border:2px solid #e2e8f0;border-radius:8px;" rows="8">' + escapeHtml(schemaStr) + '</textarea>' +
        '<p style="font-size:16px;color:#64748b;margin-top:4px;">Définissez les colonnes et leur index (0 = première colonne). Séparateur possible : tab, comma, space.</p></div></div>';
    h += '<div style="display:flex; gap:12px; margin-top:20px;"><button class="btn-cancel" onclick="closeModal()" style="font-size:22px; padding:14px 28px;">Annuler</button><button class="btn-save" onclick="saveFournisseur()" style="font-size:22px; padding:14px 28px;">Enregistrer</button></div>';
    currentCollection = 'fournisseurs'; openModal(editingId ? 'Modifier Fournisseur' : 'Nouveau Fournisseur', h);
}

function saveFournisseur() {
    var nom = document.getElementById('fourNom').value; if (!nom) { alert('Nom obligatoire'); return; }
    var categories = []; document.querySelectorAll('.four-cat-check:checked').forEach(function(cb) { categories.push(cb.value); });
    var schemaText = document.getElementById('fourSchema').value;
    var factureSchema = null;
    try { factureSchema = JSON.parse(schemaText); } catch(e) { console.warn('Schéma JSON invalide'); }
    var d = { 
        nom: nom, 
        prenom: document.getElementById('fourPrenom').value, 
        societe: document.getElementById('fourSociete').value, 
        telephone: document.getElementById('fourTel').value, 
        whatsapp: document.getElementById('fourWhatsapp').value, 
        email: document.getElementById('fourEmail').value, 
        adresse: document.getElementById('fourAdresse').value, 
        ca: parseFloat(document.getElementById('fourCA').value) || 0, 
        description: document.getElementById('fourDesc').value, 
        categories: categories,
        factureSchema: factureSchema
    };
    if (!editingId) d.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    saveDocument('fournisseurs', d, function() { 
        closeModal(); 
        loadFournisseurs(); 
        
        // ✅ AJOUT : Sauvegarde du cache
        if (typeof CacheDB !== 'undefined' && CacheDB.saveCollection) {
            CacheDB.saveCollection('fournisseurs');
        }
    });
}

function editFournisseur(id) { db.collection('fournisseurs').doc(id).get().then(function(doc) { if (doc.exists) { editingId = id; currentCollection = 'fournisseurs'; openFournisseurForm(doc.data()); } }); }
function deleteFournisseur(id) { if (confirm('Supprimer ce fournisseur ?')) { CacheDB.write('fournisseurs', id, null, 'delete').then(function() { alert('Supprimé'); loadFournisseurs(); CacheDB.sync(); }); } }

// ==================== MODULE ACHATS FOURNISSEURS ====================
var fournisseurAchatSelectionne = null;
var produitsAchatList = [];
var achatLignes = [];

function openAchatModal() {
    if (typeof allFournisseursData === 'undefined' || allFournisseursData.length === 0) {
        loadFournisseurs().then(function() { openAchatModalForm(); });
    } else {
        openAchatModalForm();
    }
}

function openAchatModalForm() {
    var options = '<option value="">-- Choisir --</option>';
    allFournisseursData.forEach(function(f) {
        options += '<option value="' + f.id + '">' + escapeHtml(f.nom) + ' ' + escapeHtml(f.prenom || '') + (f.societe ? ' (' + f.societe + ')' : '') + '</option>';
    });

    var html = `
        <div id="achatModalOverlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; overflow:auto;">
            <div style="background:#fff; width:90%; max-width:1400px; height:90%; border-radius:20px; padding:20px; box-shadow:0 20px 60px rgba(0,0,0,0.3); display:flex; flex-direction:column; position:relative;">
                <button onclick="fermerAchatModal()" style="position:absolute; top:15px; right:20px; background:none; border:none; font-size:32px; cursor:pointer; color:#64748b; z-index:10;">×</button>
                <h3 style="font-size:28px; margin:0 0 10px 0; display:flex; align-items:center; gap:10px;">
                    <i class="fas fa-shopping-cart"></i> Effectuer des achats
                </h3>
                <div style="display:flex; gap:15px; flex-wrap:wrap; margin-bottom:15px;">
                    <div style="flex:2; min-width:250px;">
                        <label style="font-size:20px; font-weight:600;">Fournisseur</label>
                        <select id="achatFournisseurSelect" style="width:100%; padding:12px; font-size:20px; border-radius:10px; border:2px solid #e2e8f0;" onchange="chargerProduitsFournisseurAchat()">
                            ${options}
                        </select>
                    </div>
                    <div style="flex:1; display:flex; align-items:flex-end; gap:10px;">
                        <button class="btn-add" onclick="ouvrirCameraFacture()" style="font-size:20px; padding:12px 24px; background:#2563eb; color:#fff; border:none; border-radius:10px; cursor:pointer; display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-camera"></i> Scanner avec Gemini
                        </button>
                    </div>
                </div>
                <div style="flex:1; overflow-y:auto; border:1px solid #e2e8f0; border-radius:12px; padding:10px; background:#f8fafc;">
                    <div id="produitsAchatContainer">
                        <p style="text-align:center; color:#94a3b8; font-size:22px; padding:40px;">Choisissez un fournisseur</p>
                    </div>
                </div>
                <div style="display:flex; gap:12px; margin-top:15px; justify-content:flex-end;">
                    <button class="btn-cancel" onclick="fermerAchatModal()" style="font-size:22px; padding:14px 28px;">Annuler</button>
                    <button class="btn-save" onclick="validerAchats()" style="font-size:22px; padding:14px 28px; background:#14B8A6;">✅ Valider les achats</button>
                </div>
            </div>
        </div>
    `;
    var oldOverlay = document.getElementById('achatModalOverlay');
    if (oldOverlay) oldOverlay.remove();
    document.body.insertAdjacentHTML('beforeend', html);
}

function fermerAchatModal() {
    var overlay = document.getElementById('achatModalOverlay');
    if (overlay) overlay.remove();
}

function chargerProduitsFournisseurAchat() {
    var select = document.getElementById('achatFournisseurSelect');
    var fournisseurId = select.value;
    if (!fournisseurId) {
        document.getElementById('produitsAchatContainer').innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:22px; padding:40px;">Choisissez un fournisseur</p>';
        fournisseurAchatSelectionne = null;
        produitsAchatList = [];
        achatLignes = [];
        return;
    }
    fournisseurAchatSelectionne = allFournisseursData.find(f => f.id === fournisseurId);
    if (!fournisseurAchatSelectionne) return;
    var produits = window.allProductsData.filter(function(p) {
        return p.fournisseurId === fournisseurId || p.fournisseurNom === fournisseurAchatSelectionne.nom;
    });
    produitsAchatList = produits;
    afficherProduitsAchat(produits);
}

function afficherProduitsAchat(produits) {
    var container = document.getElementById('produitsAchatContainer');
    if (!container) return;
    if (!produits || produits.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:22px; padding:40px;">Aucun produit pour ce fournisseur.</p>';
        return;
    }
    achatLignes = produits.map(function(p) {
        return {
            id: p.id,
            nom: p.nom,
            stockActuel: p.stock || 0,
            prixActuel: p.box_price || 0,
            quantite: 0,
            nouveauPrix: 0,
            dateExpiration: '',
            total: 0
        };
    });

    var html = `
        <table style="width:100%; border-collapse:collapse; font-size:18px;">
            <thead>
                <tr style="background:#e2e8f0; position:sticky; top:0; z-index:5;">
                    <th style="padding:12px 8px; text-align:left;">ID</th>
                    <th style="padding:12px 8px; text-align:left;">Nom</th>
                    <th style="padding:12px 8px; text-align:center;">Stock actuel</th>
                    <th style="padding:12px 8px; text-align:center;">Prix boîte (MAD)</th>
                    <th style="padding:12px 8px; text-align:center;">Qté achetée</th>
                    <th style="padding:12px 8px; text-align:center;">Nouveau prix (MAD)</th>
                    <th style="padding:12px 8px; text-align:center;">Date expiration</th>
                    <th style="padding:12px 8px; text-align:center;">Total</th>
                </tr>
            </thead>
            <tbody>
    `;
    produits.forEach(function(p, index) {
        var ligne = achatLignes[index];
        html += `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:10px 8px; font-weight:600;">${p.id ? p.id.substring(0,6) : '-'}</td>
                <td style="padding:10px 8px; font-weight:500;">${escapeHtml(p.nom)}</td>
                <td style="padding:10px 8px; text-align:center;">${ligne.stockActuel}</td>
                <td style="padding:10px 8px; text-align:center;">${ligne.prixActuel.toFixed(2)}</td>
                <td style="padding:10px 8px; text-align:center;">
                    <input type="number" class="achat-qte" data-index="${index}" value="0" min="0" step="1" style="width:70px; padding:6px; font-size:18px; border:2px solid #e2e8f0; border-radius:6px; text-align:center;" onchange="calculerTotalLigne(${index})">
                </td>
                <td style="padding:10px 8px; text-align:center;">
                    <input type="number" class="achat-prix" data-index="${index}" value="0" step="0.01" min="0" style="width:90px; padding:6px; font-size:18px; border:2px solid #e2e8f0; border-radius:6px; text-align:center;" onchange="calculerTotalLigne(${index})">
                </td>
                <td style="padding:10px 8px; text-align:center;">
                    <input type="date" class="achat-date" data-index="${index}" style="padding:6px; font-size:18px; border:2px solid #e2e8f0; border-radius:6px;">
                </td>
                <td style="padding:10px 8px; text-align:center; font-weight:600;" id="total-${index}">0.00</td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function calculerTotalLigne(index) {
    var qteInput = document.querySelector(`.achat-qte[data-index="${index}"]`);
    var prixInput = document.querySelector(`.achat-prix[data-index="${index}"]`);
    var totalSpan = document.getElementById(`total-${index}`);
    if (!qteInput || !prixInput || !totalSpan) return;
    var qte = parseFloat(qteInput.value) || 0;
    var prix = parseFloat(prixInput.value) || 0;
    var total = qte * prix;
    totalSpan.textContent = total.toFixed(2);
    if (achatLignes[index]) {
        achatLignes[index].quantite = qte;
        achatLignes[index].nouveauPrix = prix;
        achatLignes[index].total = total;
        var dateInput = document.querySelector(`.achat-date[data-index="${index}"]`);
        if (dateInput) achatLignes[index].dateExpiration = dateInput.value;
    }
}

function remplirDepuisOCR(produitsReconnus) {
    var inputsQte = document.querySelectorAll('.achat-qte');
    inputsQte.forEach(function(input) {
        var idx = parseInt(input.getAttribute('data-index'));
        var produit = produitsAchatList[idx];
        if (!produit) return;
        var found = produitsReconnus.find(function(p) {
            return p.nom.toLowerCase().includes(produit.nom.toLowerCase()) || produit.nom.toLowerCase().includes(p.nom.toLowerCase());
        });
        if (found) {
            input.value = found.quantite || 0;
            var prixInput = document.querySelector(`.achat-prix[data-index="${idx}"]`);
            if (prixInput && found.prix) {
                prixInput.value = found.prix;
            }
            calculerTotalLigne(idx);
        }
    });
}

async function validerAchats() {
    if (!fournisseurAchatSelectionne) {
        alert('Veuillez choisir un fournisseur.');
        return;
    }
    var misesAJour = [];
    achatLignes.forEach(function(ligne, index) {
        var qte = parseInt(document.querySelector(`.achat-qte[data-index="${index}"]`)?.value) || 0;
        var prix = parseFloat(document.querySelector(`.achat-prix[data-index="${index}"]`)?.value) || 0;
        var date = document.querySelector(`.achat-date[data-index="${index}"]`)?.value || '';
        if (qte > 0) {
            misesAJour.push({
                id: ligne.id,
                quantite: qte,
                nouveauPrix: prix,
                dateExpiration: date
            });
        }
    });
    if (misesAJour.length === 0) {
        alert('Aucune quantité saisie.');
        return;
    }
    var details = '';
    for (var item of misesAJour) {
        var produit = window.allProductsData.find(p => p.id === item.id);
        var boxUnit = produit ? (produit.box_unit || 1) : 1;
        var stockToAdd = item.quantite * boxUnit;
        var prixBoite = item.nouveauPrix > 0 ? item.nouveauPrix : (produit ? produit.box_price || 0 : 0);
        details += `${produit.nom} : ${item.quantite} boîtes × ${boxUnit} = ${stockToAdd} pièces, nouveau prix boîte = ${prixBoite.toFixed(2)} MAD\n`;
    }
    if (!confirm(`Ajouter au stock ?\n\n${details}`)) return;

    var batch = db.batch();
    for (var item of misesAJour) {
        var prodRef = db.collection('products').doc(item.id);
        var produit = window.allProductsData.find(p => p.id === item.id);
        var boxUnit = produit ? (produit.box_unit || 1) : 1;
        var stockToAdd = item.quantite * boxUnit;
        var updateData = {
            stock: firebase.firestore.FieldValue.increment(stockToAdd)
        };
        if (item.nouveauPrix > 0) {
            updateData.box_price = item.nouveauPrix;
            var prixUnitaire = item.nouveauPrix / boxUnit;
            updateData.prixAchat = prixUnitaire;
            updateData.prixVente = prixUnitaire * 1.3;
            updateData.profit = updateData.prixVente - prixUnitaire;
        }
        if (item.dateExpiration) {
            updateData.dateExpiration = item.dateExpiration;
        }
        batch.update(prodRef, updateData);
    }
    try {
        await batch.commit();
        alert('✅ Stock et prix mis à jour !');
        fermerAchatModal();
        if (typeof loadProducts === 'function') loadProducts();
        else if (typeof renderProductsTable === 'function') renderProductsTable();
        
        // ✅ AJOUT : Sauvegarde du cache après achat
        if (typeof CacheDB !== 'undefined' && CacheDB.saveCollection) {
            CacheDB.saveCollection('products');
            CacheDB.saveCollection('fournisseurs');
        }
    } catch(e) {
        alert('❌ Erreur : ' + e.message);
    }
}

// ==================== RECONNAISSANCE AVEC GEMINI ====================
function ouvrirCameraFacture() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(event) {
                var imgData = event.target.result;
                reconnaitreFactureGemini(imgData);
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
}

async function reconnaitreFactureGemini(imgData) {
    var container = document.getElementById('produitsAchatContainer');
    try {
        if (!GEMINI_API_KEY || GEMINI_API_KEY.length < 10) {
            alert('❌ Clé API Gemini manquante.');
            return;
        }

        var productNames = produitsAchatList.map(p => p.nom);
        var productListStr = productNames.map(n => '"' + n + '"').join(', ');

        var prompt = `
            Voici une photo d'une facture fournisseur.
            La liste des produits existants pour ce fournisseur est : [${productListStr}].
            Extrais de la facture les quantités achetées pour chacun de ces produits.
            Retourne UNIQUEMENT un tableau JSON où chaque objet a les propriétés "nom" (exactement le nom du produit tel que dans la liste ci-dessus) et "quantite" (nombre).
            Si un produit de la liste n'apparaît pas, ne le mentionne pas.
            Exemple de format attendu :
            [
                { "nom": "Coca-Cola 1.5L", "quantite": 5 },
                { "nom": "Fanta Orange", "quantite": 3 }
            ]
            Si aucun produit n'est identifié, retourne un tableau vide.
        `;

        var requestBody = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: imgData.split(',')[1]
                        }
                    }
                ]
            }]
        };

        var response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            var errorData = await response.json();
            throw new Error(`Erreur ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        var data = await response.json();
        console.log('Réponse Gemini :', data);

        var rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        var cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        var produitsReconnus = [];

        try {
            produitsReconnus = JSON.parse(cleaned);
            if (!Array.isArray(produitsReconnus)) throw new Error('Pas un tableau');
        } catch(e) {
            var regex = /["']nom["']\s*:\s*["']([^"']+)["']\s*,\s*["']quantite["']\s*:\s*(\d+)/gi;
            var match;
            while ((match = regex.exec(cleaned)) !== null) {
                produitsReconnus.push({ nom: match[1].trim(), quantite: parseInt(match[2]) });
            }
        }

        if (produitsReconnus.length === 0) {
            alert('Aucun produit reconnu par Gemini.');
            return;
        }

        remplirDepuisOCR(produitsReconnus);
        alert(`✅ ${produitsReconnus.length} produit(s) reconnus et pré-remplis.`);

    } catch(e) {
        alert('❌ Erreur Gemini : ' + e.message);
        console.error(e);
    }
}

window.openAchatModal = openAchatModal;
window.fermerAchatModal = fermerAchatModal;
window.chargerProduitsFournisseurAchat = chargerProduitsFournisseurAchat;
window.validerAchats = validerAchats;
window.calculerTotalLigne = calculerTotalLigne;
window.ouvrirCameraFacture = ouvrirCameraFacture;

// ✅ AJOUT : Exposer les fonctions de rendu globalement
window.renderCategoriesTable = renderCategoriesTable;
window.renderProductsTable = renderProductsTable;
window.renderClientsTable = renderClientsTable;
window.renderFournisseursTable = renderFournisseursTable;

console.log('🚀 E-SOLUTION - Admin CRUD - Module achats pro avec Gemini');
