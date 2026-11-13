// ==================== MENU TACTILE - E-SOLUTION ====================
// 🆕 v9 : Style POS complet — Catégories → Produits + Recherche dynamique + Panier fixe
// Logo logo.png intégré dans le header

var menuTableNum = null;
var menuCart = [];
var menuCategories = [];
var menuProducts = [];
var menuSelectedCategory = 'all';
var menuViewMode = 'categories'; // 'categories' | 'products'
var menuSelectedCategoryName = null;
var menuSearchQuery = '';
var menuCurrentProductId = null;

var menuEpices = ['Normal', 'Moins épicé', 'Très épicé', 'Sans épice'];
var menuSel = ['Normal', 'Moins de sel', 'Sans sel'];

var allStockData = [];

// ========== UTILITAIRES ==========
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    return str.replace(/[&<>"']/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        if (m === "'") return '&#39;';
        return m;
    });
}

function closeMenuTactile() {
    window.location.href = window.location.pathname;
}

function requestFullscreen() {
    const elem = document.documentElement;
    const method = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.msRequestFullscreen;
    if (method) {
        method.call(elem).catch(err => console.log(err));
    } else {
        alert("Ajouter à l'écran d'accueil pour le plein écran.");
    }
}

// ========== CHARGEMENT ==========
async function loadMenuData() {
    console.log('📱 Chargement des données du menu tactile E-SOLUTION...');
    var content = document.getElementById('menuTactileContent');
    if (!content) { console.error('Conteneur introuvable'); return; }

    content.innerHTML = '<div style="text-align:center;padding:80px 20px;"><i class="fas fa-spinner fa-spin" style="font-size:3rem;color:#2563EB;"></i><p style="margin-top:16px;color:#64748B;font-weight:500;">Chargement du menu...</p></div>';

    try {
        const catSnap = await db.collection('categories').get();
        menuCategories = [];
        catSnap.forEach(d => {
            menuCategories.push({
                id: d.id,
                nom: d.data().nom || 'Sans nom',
                imageBase64: d.data().imageBase64 || '',
                recette: d.data().recette || false,
                ordre: d.data().ordre || 0
            });
        });
        menuCategories.sort((a, b) => (a.ordre || 999) - (b.ordre || 999) || a.nom.localeCompare(b.nom));

        const prodSnap = await db.collection('products').get();
        menuProducts = [];
        prodSnap.forEach(d => {
            const dd = d.data();
            if (dd.disponible !== false) {
                menuProducts.push({
                    id: d.id,
                    nom: dd.nom || 'Sans nom',
                    prixVente: dd.prixVente || 0,
                    prixPromo: dd.prixPromo || 0,
                    stock: dd.stock,
                    categorie: dd.categorie || '',
                    categories: dd.categories || [],
                    imageBase64: dd.imageBase64 || ''
                });
            }
        });

        const stockSnap = await db.collection('stock').get();
        allStockData = [];
        stockSnap.forEach(d => {
            let dd = d.data();
            dd.id = d.id;
            allStockData.push(dd);
        });

        renderMenuTactile();
    } catch (e) {
        console.error('Erreur chargement:', e);
        content.innerHTML = '<div style="text-align:center;padding:50px;"><i class="fas fa-exclamation-circle" style="font-size:3rem;color:#EF4444;"></i><p style="margin-top:12px;">Erreur de chargement</p><button onclick="loadMenuData()" style="margin-top:16px;padding:10px 24px;border:none;border-radius:10px;background:#2563EB;color:#fff;font-weight:600;cursor:pointer;">Réessayer</button></div>';
    }
}

// ========== RENDU PRINCIPAL ==========
function renderMenuTactile() {
    var content = document.getElementById('menuTactileContent');
    if (!content) return;

    var total = menuCart.reduce((sum, item) => sum + (item.prixUnitaire * item.quantite), 0);
    var totalArticles = menuCart.reduce((sum, item) => sum + item.quantite, 0);

    var html = '';

    // ==================== HEADER avec LOGO ====================
    html += '<div class="menu-header">';
    html += '  <button class="menu-close-btn" onclick="closeMenuTactile()" aria-label="Fermer"><i class="fas fa-times"></i></button>';
    html += '  <div class="menu-header-content">';
    html += '    <div class="menu-logo-wrapper">';
    html += '      <img src="logo.png" alt="Logo" class="menu-logo" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<i class=\\\'fas fa-store\\\'></i>\'">';
    html += '    </div>';
    html += '    <div class="menu-title-wrapper">';
    html += '      <h1>E-<span>SOLUTION</span></h1>';
    html += '      <p><i class="fas fa-chair"></i> Table n° ' + escapeHtml(String(menuTableNum || '—')) + '</p>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    // ==================== BARRE DE RECHERCHE ====================
    html += '<div class="menu-search-wrapper">';
    html += '  <div class="menu-search-bar">';
    html += '    <i class="fas fa-search menu-search-icon"></i>';
    html += '    <input type="text" id="menuSearchInput" placeholder="🔍 Rechercher un produit..." value="' + escapeHtml(menuSearchQuery) + '" oninput="menuHandleSearch(this.value)" autocomplete="off">';
    if (menuSearchQuery) {
        html += '    <button class="menu-search-clear" onclick="menuClearSearch()" aria-label="Effacer"><i class="fas fa-times-circle"></i></button>';
    }
    html += '  </div>';
    html += '</div>';

    // ==================== ZONE CONTENU ====================
    html += '<div class="menu-main-zone">';

    if (menuSearchQuery.trim()) {
        // ============ RÉSULTATS DE RECHERCHE ============
        html += renderSearchResults();
    } else if (menuViewMode === 'categories') {
        // ============ GRILLE CATÉGORIES ============
        html += renderCategoriesGrid();
    } else {
        // ============ PRODUITS DE LA CATÉGORIE ============
        html += renderProductsGrid();
    }

    html += '</div>';

    // ==================== PANIER FIXE ====================
    html += '<div class="menu-cart-fixed ' + (menuCart.length > 0 ? 'has-items' : '') + '">';
    html += '  <div class="menu-cart-header">';
    html += '    <strong><i class="fas fa-shopping-basket"></i> Mon panier</strong>';
    html += '    <span class="menu-cart-badge">' + totalArticles + ' article' + (totalArticles > 1 ? 's' : '') + '</span>';
    html += '  </div>';

    if (menuCart.length === 0) {
        html += '  <p class="menu-cart-empty"><i class="fas fa-shopping-basket"></i> Cliquez sur un produit pour l\'ajouter</p>';
    } else {
        html += '  <div class="menu-cart-items">';
        for (var k = 0; k < menuCart.length; k++) {
            var it = menuCart[k];
            html += '    <div class="menu-cart-item">';
            html += '      <div class="menu-cart-item-info">';
            html += '        <span class="menu-cart-item-name">' + it.quantite + '× ' + escapeHtml(it.nom) + '</span>';
            html += '        <span class="menu-cart-item-price">' + (it.prixUnitaire * it.quantite).toFixed(2) + ' MAD</span>';
            html += '      </div>';
            html += '      <div class="menu-cart-qty">';
            html += '        <button onclick="menuUpdateQty(' + k + ',-1)" aria-label="Moins">−</button>';
            html += '        <span>' + it.quantite + '</span>';
            html += '        <button onclick="menuUpdateQty(' + k + ',1)" aria-label="Plus">+</button>';
            html += '      </div>';
            html += '    </div>';
        }
        html += '  </div>';
        html += '  <div class="menu-cart-total"><span>Total</span><span>' + total.toFixed(2) + ' MAD</span></div>';
        html += '  <button class="menu-btn-validate" onclick="menuValiderCommande()"><i class="fas fa-check-circle"></i> Commander</button>';
        html += '  <button class="menu-btn-clear" onclick="menuClearCart()"><i class="fas fa-trash"></i> Vider le panier</button>';
    }
    html += '</div>';

    // ==================== BOUTON PLEIN ÉCRAN ====================
    html += '<button class="menu-fullscreen-btn" onclick="requestFullscreen()" title="Plein écran"><i class="fas fa-expand"></i></button>';

    content.innerHTML = html;

    // Focus auto sur la recherche si elle était active
    if (menuSearchQuery) {
        setTimeout(function() {
            var input = document.getElementById('menuSearchInput');
            if (input) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        }, 50);
    }
}

// ========== GRILLE CATÉGORIES (comme POS) ==========
function renderCategoriesGrid() {
    var html = '<div class="menu-section-title"><i class="fas fa-folder-open"></i> Choisissez une catégorie</div>';
    html += '<div class="menu-categories-grid">';

    if (menuCategories.length === 0) {
        html += '<div class="menu-empty-state"><i class="fas fa-folder-open"></i><p>Aucune catégorie disponible</p></div>';
        html += '</div>';
        return html;
    }

    for (var i = 0; i < menuCategories.length; i++) {
        var cat = menuCategories[i];
        var count = menuProducts.filter(function(p) {
            if (p.categories && p.categories.length > 0) return p.categories.includes(cat.nom);
            return p.categorie === cat.nom;
        }).length;

        var imgContent = cat.imageBase64
            ? '<img src="' + escapeHtml(cat.imageBase64) + '" alt="' + escapeHtml(cat.nom) + '" loading="lazy">'
            : '<i class="fas fa-folder"></i>';

        html += '<div class="menu-category-card" onclick="menuSelectCategory(\'' + escapeHtml(cat.nom).replace(/'/g, "\\'") + '\')">';
        html += '  <div class="menu-category-img">' + imgContent + '</div>';
        html += '  <div class="menu-category-name">' + escapeHtml(cat.nom) + '</div>';
        html += '  <div class="menu-category-count">' + count + ' produit' + (count > 1 ? 's' : '') + '</div>';
        html += '</div>';
    }

    html += '</div>';
    return html;
}

// ========== GRILLE PRODUITS D'UNE CATÉGORIE ==========
function renderProductsGrid() {
    var html = '';

    // Barre de retour
    html += '<div class="menu-back-bar">';
    html += '  <button class="menu-back-btn" onclick="menuBackToCategories()">';
    html += '    <i class="fas fa-arrow-left"></i> Retour aux catégories';
    html += '  </button>';
    html += '  <span class="menu-current-cat-badge"><i class="fas fa-folder"></i> ' + escapeHtml(menuSelectedCategoryName || '') + '</span>';
    html += '</div>';

    // Filtre produits
    var filtered = menuProducts;
    if (menuSelectedCategoryName) {
        filtered = menuProducts.filter(function(p) {
            if (p.categories && p.categories.length > 0) return p.categories.includes(menuSelectedCategoryName);
            return p.categorie === menuSelectedCategoryName;
        });
    }
    filtered.sort(function(a, b) { return (a.nom || '').localeCompare(b.nom || ''); });

    if (filtered.length === 0) {
        html += '<div class="menu-empty-state"><i class="fas fa-box-open"></i><p>Aucun produit dans cette catégorie</p></div>';
        return html;
    }

    html += '<div class="menu-products-grid">';
    for (var j = 0; j < filtered.length; j++) {
        var p = filtered[j];
        var price = (p.prixPromo && p.prixPromo > 0) ? p.prixPromo : p.prixVente;
        var hasPromo = p.prixPromo && p.prixPromo > 0;
        var outOfStock = p.stock !== undefined && p.stock <= 0;

        html += '<div class="menu-product-card ' + (outOfStock ? 'out-of-stock' : '') + '" ' +
                (outOfStock ? '' : 'onclick="menuAddToCartOrOpenOptions(\'' + p.id + '\')"') + '>';
        html += '  <div class="menu-product-img">';
        if (p.imageBase64) {
            html += '    <img src="' + escapeHtml(p.imageBase64) + '" alt="' + escapeHtml(p.nom) + '" loading="lazy" onerror="this.parentElement.innerHTML=\'<i class=\\\'fas fa-box\\\'></i>\'">';
        } else {
            html += '    <i class="fas fa-box"></i>';
        }
        if (hasPromo) html += '    <span class="menu-product-badge promo">PROMO</span>';
        if (outOfStock) html += '    <span class="menu-product-badge out">Rupture</span>';
        html += '  </div>';
        html += '  <div class="menu-product-info">';
        html += '    <div class="menu-product-name">' + escapeHtml(p.nom) + '</div>';
        html += '    <div class="menu-product-price">';
        if (hasPromo) {
            html += '      <span class="price-promo">' + price.toFixed(2) + ' MAD</span>';
            html += '      <span class="price-old">' + p.prixVente.toFixed(2) + '</span>';
        } else {
            html += '      <span class="price-normal">' + price.toFixed(2) + ' MAD</span>';
        }
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
    }
    html += '</div>';
    return html;
}

// ========== RÉSULTATS DE RECHERCHE ==========
function renderSearchResults() {
    var html = '';
    var q = menuSearchQuery.toLowerCase().trim();

    var results = menuProducts.filter(function(p) {
        return (p.nom || '').toLowerCase().indexOf(q) !== -1
            || (p.categorie || '').toLowerCase().indexOf(q) !== -1;
    });
    results.sort(function(a, b) { return (a.nom || '').localeCompare(b.nom || ''); });

    html += '<div class="menu-section-title"><i class="fas fa-search"></i> ' + results.length + ' résultat' + (results.length > 1 ? 's' : '') + ' pour "' + escapeHtml(menuSearchQuery) + '"</div>';

    if (results.length === 0) {
        html += '<div class="menu-empty-state"><i class="fas fa-search"></i><p>Aucun produit trouvé</p></div>';
        return html;
    }

    html += '<div class="menu-products-grid">';
    for (var i = 0; i < results.length; i++) {
        var p = results[i];
        var price = (p.prixPromo && p.prixPromo > 0) ? p.prixPromo : p.prixVente;
        var hasPromo = p.prixPromo && p.prixPromo > 0;
        var outOfStock = p.stock !== undefined && p.stock <= 0;

        html += '<div class="menu-product-card ' + (outOfStock ? 'out-of-stock' : '') + '" ' +
                (outOfStock ? '' : 'onclick="menuAddToCartOrOpenOptions(\'' + p.id + '\')"') + '>';
        html += '  <div class="menu-product-img">';
        if (p.imageBase64) {
            html += '    <img src="' + escapeHtml(p.imageBase64) + '" alt="' + escapeHtml(p.nom) + '" loading="lazy" onerror="this.parentElement.innerHTML=\'<i class=\\\'fas fa-box\\\'></i>\'">';
        } else {
            html += '    <i class="fas fa-box"></i>';
        }
        if (hasPromo) html += '    <span class="menu-product-badge promo">PROMO</span>';
        if (outOfStock) html += '    <span class="menu-product-badge out">Rupture</span>';
        html += '  </div>';
        html += '  <div class="menu-product-info">';
        html += '    <div class="menu-product-name">' + escapeHtml(p.nom) + '</div>';
        html += '    <div class="menu-product-price">';
        if (hasPromo) {
            html += '      <span class="price-promo">' + price.toFixed(2) + ' MAD</span>';
        } else {
            html += '      <span class="price-normal">' + price.toFixed(2) + ' MAD</span>';
        }
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
    }
    html += '</div>';
    return html;
}

// ========== NAVIGATION ==========
function menuSelectCategory(catName) {
    menuSelectedCategoryName = catName;
    menuSelectedCategory = catName;
    menuViewMode = 'products';
    menuSearchQuery = '';
    renderMenuTactile();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function menuBackToCategories() {
    menuViewMode = 'categories';
    menuSelectedCategoryName = null;
    menuSelectedCategory = 'all';
    menuSearchQuery = '';
    renderMenuTactile();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function menuFilterCategory(cat) {
    if (cat === 'all') menuBackToCategories();
    else menuSelectCategory(cat);
}

function menuHandleSearch(value) {
    clearTimeout(window._menuSearchTimeout);
    window._menuSearchTimeout = setTimeout(function() {
        menuSearchQuery = value || '';
        renderMenuTactile();
    }, 200);
}

function menuClearSearch() {
    menuSearchQuery = '';
    renderMenuTactile();
}

// ========== PANIER ==========
function menuUpdateQty(idx, delta) {
    if (!menuCart[idx]) return;
    var nq = menuCart[idx].quantite + delta;
    if (nq <= 0) {
        menuCart.splice(idx, 1);
    } else {
        menuCart[idx].quantite = nq;
    }
    renderMenuTactile();
}

function menuClearCart() {
    if (confirm('Vider le panier ?')) {
        menuCart = [];
        renderMenuTactile();
    }
}

function menuAddToCartOrOpenOptions(pid) {
    var p = menuProducts.find(x => x.id === pid);
    if (!p) return;
    if (p.stock !== undefined && p.stock <= 0) {
        alert('⚠️ Rupture de stock.');
        return;
    }
    var cat = menuCategories.find(c => c.nom === p.categorie);
    var isRecette = cat && cat.recette === true;

    if (isRecette) {
        menuCurrentProductId = pid;
        menuOpenOptions(pid);
    } else {
        var existing = menuCart.find(x => x.id === pid);
        if (existing) {
            if (p.stock !== undefined && existing.quantite >= p.stock) {
                alert('Stock insuffisant');
                return;
            }
            existing.quantite++;
        } else {
            var price = (p.prixPromo && p.prixPromo > 0) ? p.prixPromo : p.prixVente;
            menuCart.push({
                id: p.id,
                nom: p.nom,
                prixUnitaire: price,
                quantite: 1,
                sauces: [],
                interdits: [],
                epice: 'Normal',
                sel: 'Normal'
            });
        }
        renderMenuTactile();
    }
}

// ========== OPTIONS (recettes) ==========
async function menuOpenOptions(pid) {
    var p = menuProducts.find(x => x.id === pid);
    if (!p) return;
    if (p.stock !== undefined && p.stock <= 0) { alert('⚠️ Rupture'); return; }

    var productIngredients = [];
    try {
        const doc = await db.collection('products').doc(pid).get();
        if (doc.exists) productIngredients = doc.data().ingredients || [];
    } catch (e) { console.error(e); }

    var grouped = {};
    productIngredients.forEach(function(ing) {
        var stockItem = allStockData.find(function(s) { return s.id === ing.idStock; });
        var cat = stockItem ? stockItem.categorie : 'Autre';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(ing.nom);
    });

    var order = ['Sauces', 'Légumes', 'Fruits', 'Viande', 'Poulet', 'Poisson'];
    var sortedCats = Object.keys(grouped).sort(function(a, b) {
        var idxA = order.indexOf(a), idxB = order.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    menuCurrentProductId = pid;
    var h = '<h4 style="margin:0 0 16px;font-size:1.15rem;color:#0F172A;font-weight:800;">' + escapeHtml(p.nom) + '</h4>';

    if (sortedCats.length === 0) {
        h += '<p style="margin-bottom:16px;color:#94A3B8;">Aucun ingrédient à exclure</p>';
    } else {
        sortedCats.forEach(function(cat) {
            h += '<div style="margin-bottom:14px;">';
            h += '<label style="font-weight:700;color:#334155;display:block;margin-bottom:6px;font-size:0.85rem;">🥫 ' + escapeHtml(cat) + '</label>';
            h += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
            grouped[cat].forEach(function(ing) {
                h += '<label style="display:flex;align-items:center;gap:5px;padding:7px 11px;border:1.5px solid #E2E8F0;border-radius:8px;cursor:pointer;font-size:0.8rem;background:#F8FAFC;">';
                h += '<input type="checkbox" class="menu-interdit-check" value="' + escapeHtml(ing) + '"> ' + escapeHtml(ing);
                h += '</label>';
            });
            h += '</div></div>';
        });
    }

    h += '<div style="margin-bottom:14px;"><label style="font-weight:700;color:#334155;display:block;margin-bottom:6px;font-size:0.85rem;">🌶️ Épices</label><div style="display:flex;flex-wrap:wrap;gap:6px;">';
    menuEpices.forEach(function(s, idx) {
        h += '<label style="display:flex;align-items:center;gap:5px;padding:7px 11px;border:1.5px solid #E2E8F0;border-radius:8px;cursor:pointer;font-size:0.8rem;background:#F8FAFC;"><input type="radio" name="menu-epice" value="' + s + '" ' + (idx === 0 ? 'checked' : '') + '> ' + s + '</label>';
    });
    h += '</div></div>';

    h += '<div style="margin-bottom:14px;"><label style="font-weight:700;color:#334155;display:block;margin-bottom:6px;font-size:0.85rem;">🧂 Sel</label><div style="display:flex;flex-wrap:wrap;gap:6px;">';
    menuSel.forEach(function(s, idx) {
        h += '<label style="display:flex;align-items:center;gap:5px;padding:7px 11px;border:1.5px solid #E2E8F0;border-radius:8px;cursor:pointer;font-size:0.8rem;background:#F8FAFC;"><input type="radio" name="menu-sel" value="' + s + '" ' + (idx === 0 ? 'checked' : '') + '> ' + s + '</label>';
    });
    h += '</div></div>';

    h += '<div style="text-align:right;margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">';
    h += '<button onclick="closeModal()" style="padding:10px 22px;border:1.5px solid #E2E8F0;background:#fff;border-radius:10px;font-weight:600;cursor:pointer;font-size:0.9rem;">Annuler</button>';
    h += '<button onclick="menuConfirmOptions()" style="padding:10px 22px;border:none;background:linear-gradient(135deg,#2563EB,#1D4ED8);color:#fff;border-radius:10px;font-weight:700;cursor:pointer;font-size:0.9rem;box-shadow:0 4px 14px rgba(37,99,235,0.35);">Ajouter</button>';
    h += '</div>';

    openModal('Personnaliser — ' + escapeHtml(p.nom), h);
}

function menuConfirmOptions() {
    var interdits = Array.from(document.querySelectorAll('.menu-interdit-check:checked')).map(cb => cb.value);
    var epice = document.querySelector('input[name="menu-epice"]:checked')?.value || 'Normal';
    var sel = document.querySelector('input[name="menu-sel"]:checked')?.value || 'Normal';
    var p = menuProducts.find(x => x.id === menuCurrentProductId);
    if (!p) { closeModal(); return; }

    var existing = menuCart.find(x => x.id === p.id);
    if (existing) {
        if (p.stock !== undefined && existing.quantite >= p.stock) {
            alert('Stock insuffisant'); closeModal(); return;
        }
        existing.quantite++;
    } else {
        var price = (p.prixPromo && p.prixPromo > 0) ? p.prixPromo : p.prixVente;
        menuCart.push({
            id: p.id, nom: p.nom, prixUnitaire: price, quantite: 1,
            sauces: [], interdits: interdits, epice: epice, sel: sel
        });
    }
    closeModal();
    renderMenuTactile();
}

// ========== VALIDATION COMMANDE ==========
async function menuValiderCommande() {
    if (menuCart.length === 0) { alert('⚠️ Panier vide.'); return; }
    var total = menuCart.reduce((sum, item) => sum + (item.prixUnitaire * item.quantite), 0);
    if (!confirm('📋 Confirmer la commande ?\nTable ' + menuTableNum + '\nTotal: ' + total.toFixed(2) + ' MAD')) return;

    try {
        await db.collection('commandes').add({
            items: JSON.parse(JSON.stringify(menuCart)),
            total: total,
            table: String(menuTableNum),
            clientName: 'Table ' + menuTableNum,
            statut: 'en_attente',
            source: 'menu_tactile',
            paid: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('✅ Commande envoyée !');
        menuCart = [];
        menuViewMode = 'categories';
        menuSelectedCategoryName = null;
        menuSearchQuery = '';
        renderMenuTactile();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
        alert('❌ Erreur: ' + e.message);
    }
}

// ========== INITIALISATION ==========
function initMenuTactile(tableNum) {
    console.log('🍽️ Démarrage menu tactile E-SOLUTION pour la table:', tableNum);
    menuTableNum = tableNum;

    // Injecter les styles (une seule fois)
    injectMenuStyles();

    const menuPage = document.getElementById('menuTactilePage');
    if (menuPage) {
        menuPage.classList.remove('hidden');
        menuPage.style.display = 'block';
    }

    let content = document.getElementById('menuTactileContent');
    if (!content) {
        content = document.createElement('div');
        content.id = 'menuTactileContent';
        if (menuPage) menuPage.appendChild(content);
    }

    loadMenuData();
}

// ========== STYLES (injectés une seule fois) ==========
function injectMenuStyles() {
    if (document.getElementById('menuTactileStylesV9')) return;

    var style = document.createElement('style');
    style.id = 'menuTactileStylesV9';
    style.textContent = `
    /* ===== PAGE ===== */
    #menuTactilePage {
        background: #F7F8FA !important;
        min-height: 100vh;
        min-height: 100dvh;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        -webkit-font-smoothing: antialiased;
    }
    #menuTactileContent {
        max-width: 1400px;
        margin: 0 auto;
        padding-bottom: 320px;
        position: relative;
    }

    /* ===== HEADER ===== */
    .menu-header {
        background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
        padding: clamp(16px, 2.5vw, 24px) clamp(16px, 3vw, 28px);
        border-radius: 0 0 24px 24px;
        position: sticky;
        top: 0;
        z-index: 50;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        overflow: hidden;
    }
    .menu-header::before {
        content: '';
        position: absolute;
        top: -50%; right: -30%;
        width: 150%; height: 150%;
        background: radial-gradient(circle, rgba(20, 184, 166, 0.18) 0%, transparent 60%);
        pointer-events: none;
        animation: menuFloatGlow 8s ease-in-out infinite;
    }
    @keyframes menuFloatGlow {
        0%, 100% { transform: translate(0, 0); }
        50% { transform: translate(-10%, 10%); }
    }
    .menu-header-content {
        display: flex;
        align-items: center;
        gap: clamp(12px, 2vw, 18px);
        position: relative;
        z-index: 1;
        max-width: 500px;
        margin: 0 auto;
    }
    .menu-logo-wrapper {
        width: clamp(48px, 8vw, 64px);
        height: clamp(48px, 8vw, 64px);
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.06);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid rgba(20, 184, 166, 0.4);
        overflow: hidden;
        flex-shrink: 0;
        box-shadow: 0 8px 24px rgba(20, 184, 166, 0.2);
    }
    .menu-logo {
        width: 100%; height: 100%;
        object-fit: cover;
    }
    .menu-logo-wrapper i {
        color: #14B8A6;
        font-size: clamp(20px, 3vw, 28px);
    }
    .menu-title-wrapper { min-width: 0; }
    .menu-title-wrapper h1 {
        margin: 0; color: #fff;
        font-size: clamp(1.15rem, 2.2vw, 1.6rem);
        font-weight: 800;
        letter-spacing: -0.5px;
        line-height: 1.15;
    }
    .menu-title-wrapper h1 span {
        color: #14B8A6;
        text-shadow: 0 2px 12px rgba(20, 184, 166, 0.4);
    }
    .menu-title-wrapper p {
        margin: 4px 0 0;
        color: rgba(255, 255, 255, 0.75);
        font-size: clamp(0.75rem, 1.2vw, 0.9rem);
        font-weight: 500;
    }
    .menu-close-btn {
        position: absolute;
        top: clamp(10px, 2vw, 16px);
        right: clamp(10px, 2vw, 16px);
        width: 38px; height: 38px;
        border-radius: 50%;
        border: none;
        background: rgba(0, 0, 0, 0.3);
        color: #fff;
        font-size: 1rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        z-index: 2;
    }
    .menu-close-btn:hover {
        background: rgba(0, 0, 0, 0.5);
        transform: rotate(90deg);
    }

    /* ===== BARRE DE RECHERCHE ===== */
    .menu-search-wrapper {
        padding: clamp(12px, 2vw, 18px) clamp(16px, 3vw, 24px);
        background: #F7F8FA;
        position: sticky;
        top: 88px;
        z-index: 40;
    }
    .menu-search-bar {
        display: flex;
        align-items: center;
        background: #FFFFFF;
        border: 1.5px solid #E2E8F0;
        border-radius: 14px;
        padding: 4px 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        transition: all 0.2s ease;
        max-width: 600px;
        margin: 0 auto;
    }
    .menu-search-bar:focus-within {
        border-color: #2563EB;
        box-shadow: 0 0 0 4px rgba(37,99,235,0.12), 0 2px 8px rgba(0,0,0,0.04);
    }
    .menu-search-icon {
        color: #94A3B8;
        font-size: clamp(14px, 1.5vw, 16px);
        margin-right: 10px;
    }
    .menu-search-bar:focus-within .menu-search-icon {
        color: #2563EB;
    }
    .menu-search-bar input {
        flex: 1;
        border: none;
        background: transparent;
        padding: 12px 0;
        font-size: max(16px, clamp(14px, 1.4vw, 16px));
        font-family: inherit;
        font-weight: 500;
        color: #0F172A;
        outline: none;
        min-width: 0;
    }
    .menu-search-bar input::placeholder {
        color: #94A3B8;
        font-weight: 400;
    }
    .menu-search-clear {
        background: #F1F5F9;
        border: none;
        width: 30px; height: 30px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #64748B;
        font-size: 14px;
        transition: all 0.15s ease;
        flex-shrink: 0;
    }
    .menu-search-clear:hover {
        background: #E2E8F0;
        color: #0F172A;
        transform: scale(1.05);
    }

    /* ===== ZONE PRINCIPALE ===== */
    .menu-main-zone {
        padding: 0 clamp(12px, 3vw, 24px) 24px;
    }
    .menu-section-title {
        font-size: clamp(0.9rem, 1.3vw, 1rem);
        font-weight: 700;
        color: #0F172A;
        margin: 8px 0 16px;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .menu-section-title i {
        color: #2563EB;
    }

    /* ===== GRILLE CATÉGORIES ===== */
    .menu-categories-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(clamp(120px, 18vw, 180px), 1fr));
        gap: clamp(10px, 1.5vw, 16px);
    }
    .menu-category-card {
        background: linear-gradient(135deg, #FFFFFF, #FAFBFC);
        border-radius: 18px;
        padding: clamp(12px, 2vw, 20px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        gap: 10px;
    }
    .menu-category-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 14px 32px rgba(37,99,235,0.18), 0 4px 10px rgba(37,99,235,0.08);
    }
    .menu-category-card:active {
        transform: translateY(-1px) scale(0.98);
    }
    .menu-category-img {
        width: clamp(60px, 12vw, 100px);
        height: clamp(60px, 12vw, 100px);
        border-radius: 50%;
        overflow: hidden;
        background: #F1F5F9;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    .menu-category-img img {
        width: 100%; height: 100%;
        object-fit: cover;
    }
    .menu-category-img i {
        font-size: clamp(24px, 4vw, 40px);
        color: #2563EB;
    }
    .menu-category-name {
        font-size: clamp(0.75rem, 1.3vw, 0.95rem);
        font-weight: 700;
        color: #0F172A;
        line-height: 1.25;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        min-height: 2.4em;
    }
    .menu-category-count {
        font-size: clamp(0.65rem, 1vw, 0.75rem);
        color: #64748B;
        font-weight: 600;
        background: #F1F5F9;
        padding: 3px 10px;
        border-radius: 999px;
    }

    /* ===== BARRE RETOUR ===== */
    .menu-back-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        flex-wrap: wrap;
    }
    .menu-back-btn {
        background: #FFFFFF;
        border: 1.5px solid #E2E8F0;
        border-radius: 12px;
        padding: 10px 18px;
        font-size: clamp(0.8rem, 1.2vw, 0.9rem);
        font-weight: 600;
        color: #334155;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .menu-back-btn:hover {
        background: #EFF6FF;
        border-color: #BFDBFE;
        color: #2563EB;
        transform: translateX(-2px);
    }
    .menu-current-cat-badge {
        background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
        color: #1D4ED8;
        padding: 8px 16px;
        border-radius: 12px;
        font-size: clamp(0.8rem, 1.2vw, 0.9rem);
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid #BFDBFE;
    }

    /* ===== GRILLE PRODUITS ===== */
    .menu-products-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(clamp(140px, 16vw, 180px), 1fr));
        gap: clamp(10px, 1.5vw, 16px);
    }
    .menu-product-card {
        background: linear-gradient(135deg, #FFFFFF, #FAFBFC);
        border-radius: 16px;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .menu-product-card:hover:not(.out-of-stock) {
        transform: translateY(-4px);
        box-shadow: 0 12px 28px rgba(37,99,235,0.18), 0 4px 10px rgba(37,99,235,0.10);
    }
    .menu-product-card:active:not(.out-of-stock) {
        transform: translateY(-1px) scale(0.98);
    }
    .menu-product-card.out-of-stock {
        opacity: 0.5;
        cursor: not-allowed;
        filter: grayscale(0.7);
    }
    .menu-product-img {
        position: relative;
        height: clamp(100px, 16vw, 150px);
        background: linear-gradient(135deg, #F8FAFC, #EFF6FF);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .menu-product-img img {
        width: 100%; height: 100%;
        object-fit: cover;
        transition: transform 0.25s ease;
    }
    .menu-product-card:hover:not(.out-of-stock) .menu-product-img img {
        transform: scale(1.05);
    }
    .menu-product-img i {
        font-size: clamp(28px, 4vw, 40px);
        color: #94A3B8;
    }
    .menu-product-badge {
        position: absolute;
        top: 8px;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.5px;
    }
    .menu-product-badge.promo {
        left: 8px;
        background: linear-gradient(135deg, #EF4444, #DC2626);
        color: #fff;
        box-shadow: 0 2px 8px rgba(239,68,68,0.4);
    }
    .menu-product-badge.out {
        right: 8px;
        background: #FEF2F2;
        color: #DC2626;
        border: 1px solid #FECACA;
    }
    .menu-product-info {
        padding: 10px 12px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .menu-product-name {
        font-size: clamp(0.8rem, 1.3vw, 0.95rem);
        font-weight: 700;
        color: #0F172A;
        line-height: 1.25;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        min-height: 2.4em;
    }
    .menu-product-price {
        display: flex;
        align-items: baseline;
        gap: 6px;
        flex-wrap: wrap;
    }
    .price-normal, .price-promo {
        font-size: clamp(0.85rem, 1.3vw, 1rem);
        font-weight: 800;
    }
    .price-normal { color: #2563EB; }
    .price-promo { color: #DC2626; }
    .price-old {
        font-size: 0.75rem;
        color: #94A3B8;
        text-decoration: line-through;
        font-weight: 500;
    }

    /* ===== ÉTAT VIDE ===== */
    .menu-empty-state {
        text-align: center;
        padding: 60px 20px;
        color: #94A3B8;
        grid-column: 1 / -1;
    }
    .menu-empty-state i {
        font-size: 3rem;
        margin-bottom: 12px;
        display: block;
        opacity: 0.5;
    }
    .menu-empty-state p {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 500;
    }

    /* ===== PANIER FIXE ===== */
    .menu-cart-fixed {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        z-index: 60;
        background: #FFFFFF;
        border-radius: 20px 20px 0 0;
        padding: 14px clamp(14px, 3vw, 24px) max(14px, env(safe-area-inset-bottom));
        box-shadow: 0 -4px 24px rgba(15, 23, 42, 0.12);
        max-height: 60vh;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        display: flex;
        flex-direction: column;
        gap: 10px;
        transition: transform 0.3s ease;
    }
    .menu-cart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .menu-cart-header strong {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: clamp(0.95rem, 1.4vw, 1.05rem);
        color: #0F172A;
        font-weight: 700;
    }
    .menu-cart-header strong i { color: #2563EB; }
    .menu-cart-badge {
        background: #2563EB;
        color: #fff;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 700;
    }
    .menu-cart-empty {
        margin: 8px 0;
        text-align: center;
        color: #94A3B8;
        font-size: 0.85rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
    }
    .menu-cart-empty i {
        font-size: 1.8rem;
        color: #E2E8F0;
    }
    .menu-cart-items {
        max-height: 30vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-right: 4px;
    }
    .menu-cart-items::-webkit-scrollbar { width: 4px; }
    .menu-cart-items::-webkit-scrollbar-thumb {
        background: #E2E8F0;
        border-radius: 2px;
    }
    .menu-cart-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 10px;
        background: #F8FAFC;
        border-radius: 10px;
        gap: 10px;
    }
    .menu-cart-item-info {
        flex: 1; min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .menu-cart-item-name {
        font-size: 0.85rem;
        font-weight: 600;
        color: #0F172A;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .menu-cart-item-price {
        font-size: 0.75rem;
        color: #2563EB;
        font-weight: 700;
    }
    .menu-cart-qty {
        display: flex;
        align-items: center;
        gap: 4px;
        background: #fff;
        border-radius: 8px;
        border: 1px solid #E2E8F0;
        padding: 2px;
        flex-shrink: 0;
    }
    .menu-cart-qty button {
        width: 28px; height: 28px;
        border-radius: 6px;
        border: none;
        background: #F1F5F9;
        color: #0F172A;
        font-size: 1rem;
        font-weight: 800;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
    }
    .menu-cart-qty button:hover {
        background: #2563EB;
        color: #fff;
    }
    .menu-cart-qty span {
        min-width: 22px;
        text-align: center;
        font-size: 0.85rem;
        font-weight: 700;
        color: #0F172A;
    }
    .menu-cart-total {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0 4px;
        border-top: 1px dashed #E2E8F0;
        font-size: 0.9rem;
        font-weight: 600;
        color: #64748B;
    }
    .menu-cart-total span:last-child {
        font-size: clamp(1.1rem, 1.8vw, 1.3rem);
        font-weight: 800;
        color: #2563EB;
        letter-spacing: -0.3px;
    }
    .menu-btn-validate {
        width: 100%;
        padding: 12px 20px;
        border: none;
        border-radius: 12px;
        background: linear-gradient(135deg, #2563EB, #1D4ED8);
        color: #fff;
        font-size: clamp(0.9rem, 1.4vw, 1rem);
        font-weight: 700;
        font-family: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        box-shadow: 0 4px 14px rgba(37,99,235,0.35);
        transition: all 0.2s ease;
    }
    .menu-btn-validate:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(37,99,235,0.45);
    }
    .menu-btn-clear {
        width: 100%;
        padding: 8px 16px;
        border: 1.5px solid #E2E8F0;
        border-radius: 10px;
        background: #fff;
        color: #64748B;
        font-size: 0.8rem;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.15s;
    }
    .menu-btn-clear:hover {
        border-color: #FCA5A5;
        color: #DC2626;
        background: #FEF2F2;
    }

    /* ===== BOUTON PLEIN ÉCRAN ===== */
    .menu-fullscreen-btn {
        position: fixed;
        bottom: calc(100px + env(safe-area-inset-bottom));
        right: 16px;
        width: 44px; height: 44px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg, #2563EB, #1D4ED8);
        color: #fff;
        font-size: 1.1rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 20px rgba(37,99,235,0.4);
        z-index: 55;
        transition: all 0.2s ease;
    }
    .menu-fullscreen-btn:hover {
        transform: scale(1.1) rotate(90deg);
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 380px) {
        .menu-title-wrapper h1 { font-size: 1rem; }
        .menu-title-wrapper p { font-size: 0.7rem; }
        .menu-logo-wrapper { width: 42px; height: 42px; }
        .menu-categories-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .menu-products-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
    }

    @media (max-height: 500px) and (orientation: landscape) {
        .menu-header { padding: 10px 16px; border-radius: 0 0 16px 16px; }
        .menu-logo-wrapper { width: 40px; height: 40px; }
        .menu-cart-fixed { max-height: 55vh; }
        .menu-cart-items { max-height: 15vh; }
    }

    @media (prefers-reduced-motion: reduce) {
        .menu-header::before,
        .menu-category-card, .menu-product-card, .menu-cart-qty button,
        .menu-btn-validate, .menu-fullscreen-btn, .menu-close-btn,
        .menu-product-img img, .menu-back-btn, .menu-search-clear {
            animation: none !important;
            transition: none !important;
        }
    }
    `;
    document.head.appendChild(style);
}

console.log('🚀 Menu tactile E-SOLUTION prêt (v9 - style POS avec catégories + recherche dynamique)');
