// ==================== MENU TACTILE - E-SOLUTION ====================
// 🆕 v10 : Reproduction EXACTE du style POS (variables CSS + couleurs + structure)
// Logo logo.png + Catégories → Produits + Recherche dynamique + Panier fixe

var menuTableNum = null;
var menuCart = [];
var menuCategories = [];
var menuProducts = [];
var menuSelectedCategory = 'all';
var menuViewMode = 'categories';
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
    console.log('📱 Chargement menu tactile E-SOLUTION...');
    var content = document.getElementById('menuTactileContent');
    if (!content) return;

    content.innerHTML = '<div style="text-align:center;padding:60px;"><i class="fas fa-spinner fa-spin" style="font-size:2.5rem;color:#14B8A6;"></i><p style="margin-top:15px;color:#64748b;">Chargement du menu...</p></div>';

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
        console.log('✅ Menu chargé:', menuCategories.length, 'catégories,', menuProducts.length, 'produits');
    } catch (e) {
        console.error('❌ Erreur:', e);
        content.innerHTML = '<div style="text-align:center;padding:50px;"><i class="fas fa-exclamation-circle" style="font-size:3rem;color:#ef4444;"></i><p>Erreur de chargement</p><button onclick="loadMenuData()" class="btn-add" style="margin-top:16px;">Réessayer</button></div>';
    }
}

// ========== RENDU PRINCIPAL ==========
function renderMenuTactile() {
    var content = document.getElementById('menuTactileContent');
    if (!content) return;

    var total = menuCart.reduce((sum, item) => sum + (item.prixUnitaire * item.quantite), 0);
    var totalArticles = menuCart.reduce((sum, item) => sum + item.quantite, 0);

    var html = '';

    // ==================== HEADER ====================
    html += '<div class="menu-header">';
    html += '  <button class="menu-close-btn" onclick="closeMenuTactile()" aria-label="Fermer">&times;</button>';
    html += '  <div class="menu-header-content">';
    html += '    <div class="menu-logo-wrapper">';
    html += '      <img src="logo.png" alt="Logo" class="menu-logo" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<i class=\\\'fas fa-store\\\'></i>\'">';
    html += '    </div>';
    html += '    <div class="menu-title-wrapper">';
    html += '      <h1>E-<span>SOLUTION</span></h1>';
    html += '      <p>🍽️ Table n° ' + escapeHtml(String(menuTableNum || '—')) + '</p>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    // ==================== RECHERCHE ====================
    html += '<div class="menu-search-wrapper">';
    html += '  <div class="menu-search-bar">';
    html += '    <i class="fas fa-search menu-search-icon"></i>';
    html += '    <input type="text" id="menuSearchInput" placeholder="🔍 Rechercher un produit..." value="' + escapeHtml(menuSearchQuery) + '" oninput="menuHandleSearch(this.value)" autocomplete="off">';
    if (menuSearchQuery) {
        html += '    <button class="menu-search-clear" onclick="menuClearSearch()"><i class="fas fa-times-circle"></i></button>';
    }
    html += '  </div>';
    html += '</div>';

    // ==================== ZONE PRINCIPALE ====================
    html += '<div class="menu-main-zone">';

    if (menuSearchQuery.trim()) {
        html += renderSearchResults();
    } else if (menuViewMode === 'categories') {
        html += renderCategoriesGrid();
    } else {
        html += renderProductsGrid();
    }

    html += '</div>';

    // ==================== PANIER FIXE ====================
    html += '<div class="menu-cart-fixed">';
    html += '  <div class="menu-cart-header">';
    html += '    <h3><i class="fas fa-shopping-cart"></i> Panier <span class="menu-cart-badge">' + totalArticles + '</span></h3>';
    html += '  </div>';

    if (menuCart.length === 0) {
        html += '  <div class="menu-cart-empty"><i class="fas fa-shopping-basket"></i><p>Panier vide</p></div>';
    } else {
        html += '  <div class="menu-cart-items">';
        for (var k = 0; k < menuCart.length; k++) {
            var it = menuCart[k];
            html += '    <div class="menu-cart-item">';
            html += '      <div class="menu-cart-item-info">';
            html += '        <span class="menu-cart-item-name">' + it.quantite + '× ' + escapeHtml(it.nom) + '</span>';
            html += '        <span class="menu-cart-item-price">' + it.prixUnitaire.toFixed(2) + ' MAD</span>';
            html += '      </div>';
            html += '      <div class="menu-cart-qty">';
            html += '        <button onclick="menuUpdateQty(' + k + ',-1)"><i class="fas fa-minus"></i></button>';
            html += '        <span>' + it.quantite + '</span>';
            html += '        <button onclick="menuUpdateQty(' + k + ',1)"><i class="fas fa-plus"></i></button>';
            html += '        <button class="menu-cart-remove" onclick="menuRemoveItem(' + k + ')"><i class="fas fa-times"></i></button>';
            html += '      </div>';
            html += '      <span class="menu-cart-item-total">' + (it.prixUnitaire * it.quantite).toFixed(2) + ' MAD</span>';
            html += '    </div>';
        }
        html += '  </div>';
        html += '  <div class="menu-cart-total"><span>Total</span><span>' + total.toFixed(2) + ' MAD</span></div>';
        html += '  <button class="menu-btn-validate" onclick="menuValiderCommande()"><i class="fas fa-check-circle"></i> Commander</button>';
        html += '  <button class="menu-btn-clear" onclick="menuClearCart()"><i class="fas fa-trash-alt"></i> Vider</button>';
    }
    html += '</div>';

    // ==================== PLEIN ÉCRAN ====================
    html += '<button class="menu-fullscreen-btn" onclick="requestFullscreen()" title="Plein écran"><i class="fas fa-expand"></i></button>';

    content.innerHTML = html;

    if (menuSearchQuery) {
        setTimeout(function() {
            var input = document.getElementById('menuSearchInput');
            if (input) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        }, 30);
    }
}

// ========== GRILLE CATÉGORIES (style POS) ==========
function renderCategoriesGrid() {
    var html = '<div style="grid-column:1/-1;padding:6px 8px;font-size:0.9rem;font-weight:700;color:var(--text-primary);">📂 Choisissez une catégorie</div>';

    if (menuCategories.length === 0) {
        return '<div class="menu-empty-state"><i class="fas fa-folder-open"></i><p>Aucune catégorie</p></div>';
    }

    var isMobile = window.innerWidth < 700;
    var isTablette = window.innerWidth >= 700 && window.innerWidth <= 1024;
    var isPC = window.innerWidth > 1024;

    var gridCols = isMobile ? 'repeat(3, 1fr)' : (isTablette ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)');

    html += '<div class="menu-categories-grid" style="grid-template-columns:' + gridCols + ';">';

    var sorted = menuCategories.slice().sort((a, b) => {
        var oA = a.ordre || 9999, oB = b.ordre || 9999;
        return oA - oB || (a.nom || '').localeCompare(b.nom || '');
    });

    var imgSize, cardMinHeight, cardMaxHeight, folderSize, nameSize, countSize;
    if (isPC) { imgSize='140px'; cardMinHeight='160px'; cardMaxHeight='200px'; folderSize='65px'; nameSize='16px'; countSize='12px'; }
    else if (isTablette) { imgSize='130px'; cardMinHeight='150px'; cardMaxHeight='180px'; folderSize='60px'; nameSize='13px'; countSize='10px'; }
    else { imgSize='45px'; cardMinHeight='65px'; cardMaxHeight='80px'; folderSize='20px'; nameSize='8px'; countSize='7px'; }

    for (var i = 0; i < sorted.length; i++) {
        var cat = sorted[i];
        var count = menuProducts.filter(p => {
            if (p.categories && p.categories.length > 0) return p.categories.includes(cat.nom);
            return p.categorie === cat.nom;
        }).length;

        var imgContent = cat.imageBase64
            ? '<img src="' + escapeHtml(cat.imageBase64) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
            : '<i class="fas fa-folder" style="font-size:' + folderSize + ';color:var(--accent);"></i>';

        html += '<div class="pos-category-card menu-cat-card" data-cat-name="' + escapeHtml(cat.nom) + '" ' +
                'style="min-height:' + cardMinHeight + ';max-height:' + cardMaxHeight + ';padding:8px 4px;border-radius:10px;border:2px solid transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;background:#FFFFFF;cursor:pointer;transition:all 0.2s cubic-bezier(0.4,0,0.2,1);gap:2px;" ' +
                'onclick="menuSelectCategory(\'' + escapeHtml(cat.nom).replace(/'/g, "\\'") + '\')" ' +
                'onmouseover="if(!this.classList.contains(\'active\')){this.style.borderColor=\'var(--accent)\';this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 4px 12px rgba(20,184,166,0.15)\';}" ' +
                'onmouseout="if(!this.classList.contains(\'active\')){this.style.borderColor=\'transparent\';this.style.transform=\'translateY(0)\';this.style.boxShadow=\'none\';}">' +
                '<div style="width:' + imgSize + ';height:' + imgSize + ';border-radius:50%;overflow:hidden;flex-shrink:0;background:var(--gray-100);display:flex;align-items:center;justify-content:center;margin-bottom:2px;border:2px solid var(--gray-200);">' + imgContent + '</div>' +
                '<span style="font-size:' + nameSize + ';font-weight:700;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;color:#000000;margin-top:2px;line-height:1.2;display:block;">' + escapeHtml(cat.nom) + '</span>' +
                '<span style="font-size:' + countSize + ';color:var(--text-muted);font-weight:500;display:block;margin-top:0px;">' + count + ' produit' + (count > 1 ? 's' : '') + '</span>' +
                '</div>';
    }

    html += '</div>';
    return html;
}

// ========== GRILLE PRODUITS (style POS) ==========
function renderProductsGrid() {
    var html = '';

    html += '<div style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;padding:4px 6px;margin-bottom:4px;background:var(--bg-page);border-radius:8px;">';
    html += '<button onclick="menuBackToCategories()" style="display:flex;align-items:center;gap:6px;background:var(--black);color:var(--white);border:none;border-radius:8px;padding:6px 14px;font-size:0.8rem;font-weight:600;cursor:pointer;"><i class="fas fa-arrow-left"></i> Retour aux catégories</button>';
    html += '<span style="font-weight:700;font-size:0.9rem;color:#000000;background:#FFFFFF;padding:4px 12px;border-radius:6px;border:1px solid #14B8A6;">📂 ' + escapeHtml(menuSelectedCategoryName || '') + '</span>';
    html += '</div>';

    var filtered = menuProducts;
    if (menuSelectedCategoryName) {
        filtered = menuProducts.filter(p => {
            if (p.categories && p.categories.length > 0) return p.categories.includes(menuSelectedCategoryName);
            return p.categorie === menuSelectedCategoryName;
        });
    }
    filtered.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));

    if (filtered.length === 0) {
        return html + '<div class="menu-empty-state"><i class="fas fa-box-open"></i><p>Aucun produit</p></div>';
    }

    var isMobile = window.innerWidth < 700;
    var gridCols = isMobile ? 'repeat(5, 1fr)' : 'repeat(auto-fill, minmax(110px, 1fr))';
    var gridGap = isMobile ? '4px' : '8px';

    html += '<div class="menu-products-grid" style="grid-template-columns:' + gridCols + ';gap:' + gridGap + ';">';

    for (var j = 0; j < filtered.length; j++) {
        var p = filtered[j];
        var pr = (p.prixPromo && p.prixPromo > 0) ? p.prixPromo : p.prixVente;
        var hp = p.prixPromo && p.prixPromo > 0;
        var outOfStock = p.stock !== undefined && p.stock <= 0;
        var stt = '';
        if (p.stock !== undefined) {
            if (p.stock <= 0) stt = ' (Rupture)';
            else if (p.stock <= 5) stt = ' (' + p.stock + ' rest.)';
        }

        var cardStyle = isMobile
            ? 'padding:4px 2px;min-height:110px;max-height:140px;aspect-ratio:1/1;border-radius:6px;border-width:1px;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;'
            : 'padding:6px 8px;min-height:150px;max-height:190px;aspect-ratio:1/1;border-radius:8px;border-width:2px;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;';

        var imgStyle = isMobile
            ? 'height:55px;width:55px;margin-bottom:4px;border-radius:6px;overflow:hidden;flex-shrink:0;background:var(--gray-200);display:flex;align-items:center;justify-content:center;'
            : 'height:75px;width:75px;margin-bottom:6px;border-radius:8px;overflow:hidden;flex-shrink:0;background:var(--gray-200);display:flex;align-items:center;justify-content:center;';

        var nameStyle = isMobile
            ? 'font-size:9px !important;font-weight:600 !important;line-height:1.3;text-align:center;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:var(--text-primary);margin:1px 0;'
            : 'font-size:0.75rem !important;font-weight:600 !important;line-height:1.3;text-align:center;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:var(--text-primary);margin:2px 0;';

        var priceStyle = isMobile
            ? 'font-size:10px !important;font-weight:700 !important;color:var(--text-primary);'
            : 'font-size:0.8rem !important;font-weight:700 !important;color:var(--text-primary);';

        var imgContent = p.imageBase64
            ? '<img src="' + escapeHtml(p.imageBase64) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">'
            : '<i class="fas fa-box" style="' + (isMobile ? 'font-size:18px;' : 'font-size:26px;') + 'color:var(--text-muted);"></i>';

        html += '<div class="pos-product-card ' + (outOfStock ? 'pos-out-of-stock' : '') + '" ' +
                'style="' + cardStyle + '" ' +
                (outOfStock ? '' : 'onclick="menuAddToCartOrOpenOptions(\'' + p.id + '\')"') + '>' +
                '<div class="pos-product-img" style="' + imgStyle + '">' + imgContent + '</div>' +
                '<div class="pos-product-info" style="display:flex;flex-direction:column;align-items:center;width:100%;flex:1;justify-content:center;overflow:hidden;min-height:0;">' +
                '<span class="pos-product-name" style="' + nameStyle + '">' + escapeHtml(p.nom) + stt + '</span>' +
                '<span class="pos-product-price" style="' + priceStyle + '">' +
                (hp
                    ? '<span style="' + (isMobile ? 'font-size:7px;' : 'font-size:0.6rem;') + 'text-decoration:line-through;color:var(--text-muted);">' + p.prixVente.toFixed(2) + '</span> <span style="' + (isMobile ? 'font-size:10px;' : 'font-size:0.8rem;') + 'color:var(--danger);">' + pr.toFixed(2) + ' MAD</span>'
                    : pr.toFixed(2) + ' MAD') +
                '</span></div></div>';
    }

    html += '</div>';
    return html;
}

// ========== RÉSULTATS RECHERCHE ==========
function renderSearchResults() {
    var q = menuSearchQuery.toLowerCase().trim();
    var results = menuProducts.filter(p =>
        (p.nom || '').toLowerCase().indexOf(q) !== -1 ||
        (p.categorie || '').toLowerCase().indexOf(q) !== -1
    ).sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));

    var html = '<div style="grid-column:1/-1;padding:6px 8px;font-size:0.9rem;font-weight:700;color:var(--text-primary);"><i class="fas fa-search"></i> ' + results.length + ' résultat' + (results.length > 1 ? 's' : '') + ' pour "' + escapeHtml(menuSearchQuery) + '"</div>';

    if (results.length === 0) {
        return html + '<div class="menu-empty-state"><i class="fas fa-search"></i><p>Aucun produit trouvé</p></div>';
    }

    var isMobile = window.innerWidth < 700;
    var gridCols = isMobile ? 'repeat(5, 1fr)' : 'repeat(auto-fill, minmax(110px, 1fr))';
    var gridGap = isMobile ? '4px' : '8px';

    html += '<div class="menu-products-grid" style="grid-template-columns:' + gridCols + ';gap:' + gridGap + ';">';

    for (var i = 0; i < results.length; i++) {
        var p = results[i];
        var pr = (p.prixPromo && p.prixPromo > 0) ? p.prixPromo : p.prixVente;
        var hp = p.prixPromo && p.prixPromo > 0;
        var outOfStock = p.stock !== undefined && p.stock <= 0;

        var cardStyle = isMobile
            ? 'padding:4px 2px;min-height:110px;max-height:140px;aspect-ratio:1/1;border-radius:6px;border-width:1px;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;'
            : 'padding:6px 8px;min-height:150px;max-height:190px;aspect-ratio:1/1;border-radius:8px;border-width:2px;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;';

        var imgStyle = isMobile
            ? 'height:55px;width:55px;margin-bottom:4px;border-radius:6px;overflow:hidden;flex-shrink:0;background:var(--gray-200);display:flex;align-items:center;justify-content:center;'
            : 'height:75px;width:75px;margin-bottom:6px;border-radius:8px;overflow:hidden;flex-shrink:0;background:var(--gray-200);display:flex;align-items:center;justify-content:center;';

        var nameStyle = isMobile
            ? 'font-size:9px !important;font-weight:600 !important;line-height:1.3;text-align:center;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:var(--text-primary);margin:1px 0;'
            : 'font-size:0.75rem !important;font-weight:600 !important;line-height:1.3;text-align:center;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:var(--text-primary);margin:2px 0;';

        var priceStyle = isMobile ? 'font-size:10px !important;font-weight:700 !important;color:var(--text-primary);' : 'font-size:0.8rem !important;font-weight:700 !important;color:var(--text-primary);';

        var imgContent = p.imageBase64
            ? '<img src="' + escapeHtml(p.imageBase64) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">'
            : '<i class="fas fa-box" style="' + (isMobile ? 'font-size:18px;' : 'font-size:26px;') + 'color:var(--text-muted);"></i>';

        html += '<div class="pos-product-card ' + (outOfStock ? 'pos-out-of-stock' : '') + '" ' +
                'style="' + cardStyle + '" ' +
                (outOfStock ? '' : 'onclick="menuAddToCartOrOpenOptions(\'' + p.id + '\')"') + '>' +
                '<div class="pos-product-img" style="' + imgStyle + '">' + imgContent + '</div>' +
                '<div class="pos-product-info" style="display:flex;flex-direction:column;align-items:center;width:100%;flex:1;justify-content:center;overflow:hidden;min-height:0;">' +
                '<span class="pos-product-name" style="' + nameStyle + '">' + escapeHtml(p.nom) + '</span>' +
                '<span class="pos-product-price" style="' + priceStyle + '">' +
                (hp
                    ? '<span style="' + (isMobile ? 'font-size:7px;' : 'font-size:0.6rem;') + 'text-decoration:line-through;color:var(--text-muted);">' + p.prixVente.toFixed(2) + '</span> <span style="' + (isMobile ? 'font-size:10px;' : 'font-size:0.8rem;') + 'color:var(--danger);">' + pr.toFixed(2) + ' MAD</span>'
                    : pr.toFixed(2) + ' MAD') +
                '</span></div></div>';
    }

    html += '</div>';
    return html;
}

// ========== NAVIGATION ==========
function menuSelectCategory(catName) {
    // Marquer la carte active
    document.querySelectorAll('.menu-cat-card').forEach(function(card) {
        card.classList.remove('active');
        card.style.borderColor = 'transparent';
        card.style.background = '#FFFFFF';
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
        var span = card.querySelector('span:first-of-type');
        if (span) span.style.color = '#000000';
    });

    document.querySelectorAll('.menu-cat-card').forEach(function(card) {
        if (card.getAttribute('data-cat-name') === catName) {
            card.classList.add('active');
            card.style.borderColor = '#14B8A6';
            card.style.background = '#FFFFFF';
            card.style.transform = 'translateY(-2px)';
            card.style.boxShadow = '0 4px 12px rgba(20,184,166,0.25)';
            var span = card.querySelector('span:first-of-type');
            if (span) span.style.color = '#000000';
        }
    });

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
    if (nq <= 0) menuCart.splice(idx, 1);
    else menuCart[idx].quantite = nq;
    renderMenuTactile();
}

function menuRemoveItem(idx) {
    menuCart.splice(idx, 1);
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
                id: p.id, nom: p.nom, prixUnitaire: price, quantite: 1,
                sauces: [], interdits: [], epice: 'Normal', sel: 'Normal'
            });
        }
        renderMenuTactile();
    }
}

// ========== OPTIONS RECETTES ==========
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
        var stockItem = allStockData.find(s => s.id === ing.idStock);
        var cat = stockItem ? (stockItem.categorie || 'Autre') : 'Autre';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(ing.nom);
    });

    var order = ['Sauces', 'Légumes', 'Fruits', 'Viande', 'Poulet', 'Poisson'];
    var sortedCats = Object.keys(grouped).sort(function(a, b) {
        var iA = order.indexOf(a), iB = order.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1;
        if (iB !== -1) return 1;
        return a.localeCompare(b);
    });

    menuCurrentProductId = pid;
    var h = '<h4 style="margin:0 0 16px;font-size:1.15rem;color:#0F172A;font-weight:800;">' + escapeHtml(p.nom) + '</h4>';

    if (sortedCats.length === 0) {
        h += '<p style="margin-bottom:16px;color:#94A3B8;">Aucun ingrédient à exclure</p>';
    } else {
        sortedCats.forEach(function(cat) {
            h += '<div style="margin-bottom:14px;"><label style="font-weight:700;color:#334155;display:block;margin-bottom:6px;font-size:0.85rem;">🥫 ' + escapeHtml(cat) + '</label><div style="display:flex;flex-wrap:wrap;gap:6px;">';
            grouped[cat].forEach(function(ing) {
                h += '<label style="display:flex;align-items:center;gap:5px;padding:7px 11px;border:1.5px solid #E2E8F0;border-radius:8px;cursor:pointer;font-size:0.8rem;background:#F8FAFC;"><input type="checkbox" class="menu-interdit-check" value="' + escapeHtml(ing) + '"> ' + escapeHtml(ing) + '</label>';
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
    h += '<button onclick="menuConfirmOptions()" style="padding:10px 22px;border:none;background:#14B8A6;color:#fff;border-radius:10px;font-weight:700;cursor:pointer;font-size:0.9rem;">Ajouter</button>';
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
        if (p.stock !== undefined && existing.quantite >= p.stock) { alert('Stock insuffisant'); closeModal(); return; }
        existing.quantite++;
    } else {
        var price = (p.prixPromo && p.prixPromo > 0) ? p.prixPromo : p.prixVente;
        menuCart.push({ id: p.id, nom: p.nom, prixUnitaire: price, quantite: 1, sauces: [], interdits: interdits, epice: epice, sel: sel });
    }
    closeModal();
    renderMenuTactile();
}

// ========== VALIDATION ==========
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
    console.log('🍽️ Démarrage menu tactile pour table:', tableNum);
    menuTableNum = tableNum;

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

// ========== STYLES ==========
function injectMenuStyles() {
    if (document.getElementById('menuTactileStylesV10')) return;
    var style = document.createElement('style');
    style.id = 'menuTactileStylesV10';
    style.textContent = `
    #menuTactilePage {
        background: #f8fafc !important;
        min-height: 100vh;
        min-height: 100dvh;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        -webkit-font-smoothing: antialiased;
    }
    #menuTactileContent {
        max-width: 1400px;
        margin: 0 auto;
        padding-bottom: 280px;
    }
    .menu-header {
        background: linear-gradient(135deg, #0A0D12, #1a1a2e);
        color: #fff;
        border-radius: 0 0 24px 24px;
        padding: 20px 15px;
        position: sticky;
        top: 0;
        z-index: 50;
        text-align: center;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .menu-header-content {
        display: flex;
        align-items: center;
        gap: 14px;
        justify-content: center;
        max-width: 500px;
        margin: 0 auto;
    }
    .menu-logo-wrapper {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: #14B8A6;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid rgba(255,255,255,0.2);
        overflow: hidden;
        flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(20,184,166,0.3);
    }
    .menu-logo { width: 100%; height: 100%; object-fit: cover; }
    .menu-logo-wrapper i { color: #fff; font-size: 24px; }
    .menu-title-wrapper { text-align: left; min-width: 0; }
    .menu-title-wrapper h1 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 800;
        letter-spacing: -0.5px;
        line-height: 1.15;
    }
    .menu-title-wrapper h1 span { color: #14B8A6; }
    .menu-title-wrapper p { margin: 3px 0 0; font-size: 0.85rem; color: rgba(255,255,255,0.8); }
    .menu-close-btn {
        position: absolute;
        top: 12px; right: 14px;
        width: 38px; height: 38px;
        border-radius: 50%;
        border: none;
        background: rgba(0,0,0,0.35);
        color: #fff;
        font-size: 1.5rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        transition: all 0.2s ease;
    }
    .menu-close-btn:hover { background: rgba(0,0,0,0.55); transform: rotate(90deg); }

    .menu-search-wrapper {
        padding: 12px 14px;
        background: #f8fafc;
        position: sticky;
        top: 92px;
        z-index: 40;
    }
    .menu-search-bar {
        display: flex;
        align-items: center;
        background: #FFFFFF;
        border: 2px solid #e2e8f0;
        border-radius: 40px;
        padding: 4px 14px;
        max-width: 600px;
        margin: 0 auto;
        transition: all 0.2s ease;
    }
    .menu-search-bar:focus-within {
        border-color: #14B8A6;
        box-shadow: 0 0 0 4px rgba(20,184,166,0.12);
    }
    .menu-search-icon { color: #94A3B8; margin-right: 10px; font-size: 15px; }
    .menu-search-bar:focus-within .menu-search-icon { color: #14B8A6; }
    .menu-search-bar input {
        flex: 1;
        border: none;
        background: transparent;
        padding: 10px 0;
        font-size: 16px;
        font-family: inherit;
        font-weight: 500;
        color: #0F172A;
        outline: none;
        min-width: 0;
    }
    .menu-search-bar input::placeholder { color: #94A3B8; font-weight: 400; }
    .menu-search-clear {
        background: #F1F5F9;
        border: none;
        width: 30px; height: 30px;
        border-radius: 50%;
        cursor: pointer;
        color: #64748B;
        font-size: 14px;
        transition: all 0.15s ease;
        flex-shrink: 0;
    }
    .menu-search-clear:hover { background: #E2E8F0; color: #0F172A; }

    .menu-main-zone { padding: 0 10px 24px; }

    .menu-categories-grid {
        display: grid;
        gap: 10px;
        padding: 10px;
    }

    .menu-products-grid {
        display: grid;
        gap: 8px;
        padding: 4px;
    }

    .menu-empty-state {
        text-align: center;
        padding: 60px 20px;
        color: #94A3B8;
        grid-column: 1 / -1;
    }
    .menu-empty-state i { font-size: 3rem; margin-bottom: 12px; display: block; opacity: 0.5; }
    .menu-empty-state p { margin: 0; font-size: 0.95rem; }

    .menu-cart-fixed {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        z-index: 60;
        background: #FFFFFF;
        border-radius: 20px 20px 0 0;
        padding: 12px 14px max(12px, env(safe-area-inset-bottom));
        box-shadow: 0 -2px 15px rgba(0,0,0,0.15);
        max-height: 55vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .menu-cart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .menu-cart-header h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #0F172A;
    }
    .menu-cart-header h3 i { color: #14B8A6; }
    .menu-cart-badge {
        background: #14B8A6;
        color: #fff;
        border-radius: 50%;
        padding: 1px 8px;
        font-size: 0.75rem;
        font-weight: 700;
    }
    .menu-cart-empty {
        text-align: center;
        padding: 10px;
        color: #94A3B8;
        font-size: 0.85rem;
    }
    .menu-cart-empty i { font-size: 1.5rem; display: block; margin-bottom: 4px; color: #E2E8F0; }
    .menu-cart-items {
        max-height: 25vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .menu-cart-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 4px;
        border-bottom: 1px solid #F1F5F9;
    }
    .menu-cart-item-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
    }
    .menu-cart-item-name {
        font-size: 0.85rem;
        font-weight: 600;
        color: #0F172A;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .menu-cart-item-price { font-size: 0.7rem; color: #64748B; }
    .menu-cart-qty {
        display: flex;
        align-items: center;
        gap: 3px;
        flex-shrink: 0;
    }
    .menu-cart-qty button {
        width: 26px; height: 26px;
        border-radius: 50%;
        border: 2px solid #e2e8f0;
        background: #fff;
        color: #0F172A;
        font-size: 0.7rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
    }
    .menu-cart-qty button:hover { background: #14B8A6; color: #fff; border-color: #14B8A6; }
    .menu-cart-qty span { font-size: 0.85rem; font-weight: 700; min-width: 20px; text-align: center; }
    .menu-cart-remove {
        background: none !important;
        border: none !important;
        color: #ef4444 !important;
    }
    .menu-cart-remove:hover { color: #dc2626 !important; }
    .menu-cart-item-total {
        font-size: 0.8rem;
        font-weight: 700;
        color: #0F172A;
        min-width: 65px;
        text-align: right;
        flex-shrink: 0;
    }
    .menu-cart-total {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-top: 2px solid #e2e8f0;
        font-size: 1.1rem;
        font-weight: 700;
        color: #0F172A;
    }
    .menu-cart-total span:last-child { color: #14B8A6; font-size: 1.3rem; }
    .menu-btn-validate {
        width: 100%;
        padding: 12px;
        border: none;
        border-radius: 10px;
        background: #14B8A6;
        color: #fff;
        font-size: 1.05rem;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(20,184,166,0.3);
    }
    .menu-btn-validate:hover { background: #0D9488; transform: translateY(-2px); }
    .menu-btn-validate:disabled { opacity: 0.5; cursor: not-allowed; }
    .menu-btn-clear {
        width: 100%;
        padding: 8px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #fff;
        color: #ef4444;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
    }
    .menu-btn-clear:hover { background: #FEF2F2; border-color: #FCA5A5; }

    .menu-fullscreen-btn {
        position: fixed;
        bottom: calc(55vh + 10px);
        right: 15px;
        width: 45px; height: 45px;
        border-radius: 50%;
        border: none;
        background: #14B8A6;
        color: #fff;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 55;
        transition: all 0.2s;
    }
    .menu-fullscreen-btn:hover { transform: scale(1.1) rotate(90deg); }

    .menu-cat-card.active { border-color: #14B8A6 !important; }

    @media (max-width: 380px) {
        .menu-title-wrapper h1 { font-size: 1rem; }
        .menu-title-wrapper p { font-size: 0.7rem; }
        .menu-logo-wrapper { width: 42px; height: 42px; }
    }
    @media (max-height: 500px) and (orientation: landscape) {
        .menu-header { padding: 10px 16px; }
        .menu-logo-wrapper { width: 40px; height: 40px; }
        .menu-cart-fixed { max-height: 50vh; }
    }
    `;
    document.head.appendChild(style);
}

console.log('🚀 Menu tactile E-SOLUTION v10 (style POS exact)');
