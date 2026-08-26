// ==================== POS.JS - VERSION CORRIGÉE ====================
// ✅ Panier à DROITE sur PC/Tablette (layout horizontal)
// ✅ Barre de recherche + boutons masqués par défaut
// ✅ Bouton "🔍 Afficher outils" pour révéler les outils
// ✅ Catégories avec espacement corrigé

var posCart = [];
var posStep = 1;
var posCategoriesList = [];
var posProductsList = [];
var posSelectedCategory = 'all';
var posCurrentClient = null;
var posCurrentTable = '';
var posPaymentMethod = 'espece';
var posAmountGiven = 0;
var posDiscountMAD = 0;
var posAllClients = [];
var posFilteredClients = [];
var posCurrentProductId = null;
var posSearchQuery = '';
var posToolsVisible = false; // 👈 NOUVEAU : contrôle visibilité des outils

var productNameIndex = {};
var productIndexBuilt = false;
var factureCounter = parseInt(localStorage.getItem('factureCounter')) || 0;
var fideliteSettingsCache = null;

var posCommandesTables = [];
var posCommandesTablesCount = 0;
var posCommandesEnLigneCount = 0;
var posCommandesFilterText = '';
var posCommandesSortField = 'createdAt';
var posCommandesSortOrder = 'desc';

var posEpicesList = ['Normal', 'Moins épicé', 'Très épicé', 'Sans épice'];
var posSelList = ['Normal', 'Moins de sel', 'Sans sel'];
var posCurrentProductIngredients = [];
var allStockData = [];

var posIsRendering = false;
var posLastRenderTime = 0;
var isFinalizing = false;

var posProductOffset = 0;
var posProductBatchSize = 50;
var posHasMoreProducts = false;

var clientCreditsCache = {};
var clientSearchTimeout = null;

var posViewMode = 'categories';
var posSelectedCategoryForView = null;

function escapeHtml(str) { if(!str) return ''; return str.replace(/[&<>]/g,function(m){ if(m==='&') return '&amp;'; if(m==='<') return '&lt;'; if(m==='>') return '&gt;'; return m; }); }
function toDate(val) { if(!val) return null; if(val.toDate) return val.toDate(); if(val.seconds) return new Date(val.seconds*1000); if(typeof val==='string') return new Date(val); if(val instanceof Date) return val; return null; }

function buildProductIndex() { if(productIndexBuilt) return; productNameIndex={}; posProductsList.forEach(function(p){ if(!p.nom) return; p.nom.toLowerCase().split(' ').forEach(function(w){ if(w.length<2) return; if(!productNameIndex[w]) productNameIndex[w]=[]; productNameIndex[w].push(p); }); }); productIndexBuilt=true; }
function fastSearch(query) { if(!query) return posProductsList; buildProductIndex(); var words=query.toLowerCase().split(' '),results=[],seen={}; words.forEach(function(w){ if(w.length<2) return; (productNameIndex[w]||[]).forEach(function(p){ if(!seen[p.id]){ seen[p.id]=true; results.push(p); } }); }); if(results.length===0) return posProductsList.filter(function(p){ return (p.nom||'').toLowerCase().indexOf(query)!==-1||(p.categorie||'').toLowerCase().indexOf(query)!==-1||(p.description||'').toLowerCase().indexOf(query)!==-1; }); return results; }
function posEnrichirItemsAvecPrixAchat(items){ return items.map(function(item){ var produit=posProductsList.find(function(p){ return p.id===item.id; }); var prixAchat=(produit&&produit.prixAchat!=null)?produit.prixAchat:(item.prixAchat||0); return Object.assign({},item,{prixAchat:prixAchat}); }); }
function isOnPOSPage(){ var pt=document.getElementById('pageTitle')?.textContent||''; return pt==='POS'||pt==='Dashboard'; }

function setStaticBackButtonVisibility(visible) {
var btn = document.getElementById('posStaticBackBtn');
if (btn) { btn.style.display = visible ? 'block' : 'none'; }
}

// ==================== TOGGLE OUTILS POS ====================
function posToggleTools() {
    posToolsVisible = !posToolsVisible;
    var toolsContainer = document.getElementById('posToolsContainer');
    var toggleBtn = document.getElementById('posToggleToolsBtn');
    if (toolsContainer) {
        toolsContainer.style.display = posToolsVisible ? 'flex' : 'none';
    }
    if (toggleBtn) {
        toggleBtn.innerHTML = posToolsVisible ? '✕ Masquer outils' : '🔍 Afficher outils';
        toggleBtn.style.background = posToolsVisible ? '#ef4444' : '#14B8A6';
    }
    if (isOnPOSPage()) renderPOS();
}

async function loadClientCredits(clientId) {
if (!clientId) return 0;
if (clientCreditsCache[clientId] !== undefined) return clientCreditsCache[clientId];
try {
const snapshot = await db.collection('credits')
.where('clientId', '==', clientId)
.where('paid', '==', false)
.get();
let total = 0;
snapshot.forEach(doc => {
const data = doc.data();
total += data.remainingAmount || data.total || 0;
});
clientCreditsCache[clientId] = total;
return total;
} catch(e) {
console.warn('Erreur chargement crédits client:', e);
return 0;
}
}

async function updateClientCreditDisplay(clientId) {
var displayEl = document.getElementById('clientCreditDisplay');
if (!displayEl) return;
if (!clientId) {
displayEl.textContent = '';
displayEl.style.display = 'none';
return;
}
var total = await loadClientCredits(clientId);
if (total > 0) {
displayEl.textContent = '💳 Crédit: ' + total.toFixed(2) + ' MAD';
displayEl.style.display = 'block';
displayEl.style.color = '#ef4444';
displayEl.style.fontWeight = '700';
displayEl.style.fontSize = '28px';
} else {
displayEl.textContent = '✅ Aucun crédit';
displayEl.style.display = 'block';
displayEl.style.color = '#14B8A6';
displayEl.style.fontWeight = '700';
displayEl.style.fontSize = '28px';
}
}

async function loadPosPage(c){
posResetCart(); posStep=1; posCommandesFilterText=''; posCommandesSortField='createdAt'; posCommandesSortOrder='desc'; posSearchQuery=''; productIndexBuilt=false; posProductOffset=0; posToolsVisible=false;
posCategoriesList=[]; posProductsList=[]; posAllClients=[]; posFilteredClients=[];
c.innerHTML='<div style="text-align:center;padding:60px;"><i class="fas fa-spinner fa-spin" style="font-size:2.5rem;color:#14B8A6;"></i><p style="margin-top:15px;color:#64748b;">Chargement du POS...</p></div>';
setStaticBackButtonVisibility(false);
try{
let cc=await CacheDB.getAll('categories'),cp=await CacheDB.getAll('products'),cl=await CacheDB.getAll('clients');
if(cc.length){ posCategoriesList=cc.map(x=>({id:x.id,nom:x.nom,imageBase64:x.imageBase64,recette:x.recette||false,ordre:x.ordre||0})); }
if(cp.length){ posProductsList=cp.filter(x=>x.disponible!==false).map(x=>({...x,description:x.description||''})); productIndexBuilt=false; }
if(cl.length){ posAllClients=cl.map(x=>({id:x.id,nom:x.nom,prenom:x.prenom,telephone:x.telephone,description:x.description||''})); posFilteredClients=[...posAllClients]; }
if(isOnPOSPage()) renderPOS();
if (typeof window.buildClientIndex === 'function') window.buildClientIndex();
if (typeof window.buildProductIndex === 'function') window.buildProductIndex();
}catch(e){ console.error(e); }
setTimeout(async function(){
try{
const[cs,ps,cl]=await Promise.all([db.collection('categories').get(),db.collection('products').get(),db.collection('clients').limit(500).get()]);
posCategoriesList=[]; cs.forEach(d=>{ let cat={id:d.id,nom:d.data().nom,imageBase64:d.data().imageBase64,recette:d.data().recette||false,ordre:d.data().ordre||0}; posCategoriesList.push(cat); CacheDB.set('categories',d.id,cat); });
posProductsList=[]; ps.forEach(d=>{ let dd=d.data(); if(dd.disponible!==false){ let prod={id:d.id,nom:dd.nom||'',description:dd.description||'',prixVente:dd.prixVente||0,prixPromo:dd.prixPromo||0,prixAchat:dd.prixAchat||0,stock:dd.stock,categorie:dd.categorie||'',categories:dd.categories||[],imageBase64:dd.imageBase64||'',favori:dd.favori||false}; posProductsList.push(prod); CacheDB.set('products',d.id,prod); } }); productIndexBuilt=false;
posAllClients=[]; cl.forEach(d=>{ let data=d.data(),cli={id:d.id,nom:data.nom,prenom:data.prenom,telephone:data.telephone,description:data.description||''}; posAllClients.push(cli); CacheDB.set('clients',d.id,cli); }); posFilteredClients=[...posAllClients];
if(isOnPOSPage()) renderPOS();
if (typeof window.buildClientIndex === 'function') window.buildClientIndex();
if (typeof window.buildProductIndex === 'function') window.buildProductIndex();
}catch(e){ console.error(e); }
},300);
await posChargerCommandesTables(); await posChargerCommandesEnLigneCount();
var cmdData=localStorage.getItem('posCommandeData'),payData=localStorage.getItem('posPayerVente');
var creditData = localStorage.getItem('posPayerCredit');
if(cmdData){ var cmd=JSON.parse(cmdData); localStorage.removeItem('posCommandeData'); posCart=[]; if(cmd.items){ posEnrichirItemsAvecPrixAchat(cmd.items).forEach(function(item){ posCart.push({id:item.id,nom:item.nom,prixUnitaire:item.prixVente||item.prixUnitaire||0,prixAchat:item.prixAchat||0,prixPromo:item.prixPromo||0,prixVente:item.prixVente||item.prixUnitaire||0,quantite:item.quantite||1,categorie:item.categorie||'',imageBase64:item.imageBase64||'',sauces:item.sauces||[],interdits:item.interdits||[],epice:item.epice||'Normal',sel:item.sel||'Normal'}); }); } if(cmd.clientId&&cmd.clientName) posCurrentClient={id:cmd.clientId,name:cmd.clientName}; posCurrentTable=cmd.table||''; posStep=2; posDiscountMAD=0; posPaymentMethod='espece'; window.posCommandeId=cmd.commandeId; if(isOnPOSPage()) renderPOS(); return; }
if(payData){ var v=JSON.parse(payData); localStorage.removeItem('posPayerVente'); posCart=[]; if(v.items){ posEnrichirItemsAvecPrixAchat(v.items).forEach(function(item){ posCart.push({id:item.id,nom:item.nom,prixUnitaire:item.prixVente||0,prixAchat:item.prixAchat||0,prixPromo:item.prixPromo||0,prixVente:item.prixVente||0,quantite:item.quantite||1,categorie:'',imageBase64:'',sauces:item.sauces||[],interdits:item.interdits||[],epice:item.epice||'Normal',sel:item.sel||'Normal'}); }); } if(v.clientId&&v.clientName) posCurrentClient={id:v.clientId,name:v.clientName}; posCurrentTable=v.table||''; posStep=2; posDiscountMAD=0; posPaymentMethod='espece'; window.posVenteId=v.venteId; if(isOnPOSPage()) renderPOS(); return; }
if(creditData){
try {
var data = JSON.parse(creditData);
localStorage.removeItem('posPayerCredit');
posCart = [];
if (data.clientName) { posCurrentClient = { id: data.clientId, name: data.clientName }; }
if (data.items && data.items.length > 0) {
data.items.forEach(function(item) {
posCart.push({id: item.id || 'credit-' + Date.now(),nom: item.nom || item.name || 'Produit',prixUnitaire: item.prixVente || item.price || 0,quantite: item.quantite || 1,prixAchat: item.prixAchat || 0,prixPromo: item.prixPromo || 0,prixVente: item.prixVente || item.price || 0,categorie: item.categorie || '',imageBase64: item.imageBase64 || '',sauces: item.sauces || [],interdits: item.interdits || [],epice: item.epice || 'Normal',sel: item.sel || 'Normal'});
});
}
var total = data.total || 0;
if (total > 0) { posAmountGiven = total; posDiscountMAD = 0; }
posStep = 2; window.posStep = 2; posPaymentMethod = 'espece';
if (typeof window.setVoiceMode === 'function') { window.setVoiceMode('payment', '💳 Paiement crédit', null); }
} catch(e) { console.warn('❌ Erreur chargement crédit:', e); }
}
if(isOnPOSPage()) renderPOS();
if (posStep === 2 && posAmountGiven > 0) {
setTimeout(function() {
var input = document.getElementById('posAmountGiven');
if (input) { input.value = posAmountGiven.toFixed(2); if (typeof posCalculateChange === 'function') posCalculateChange(); }
if (posCurrentClient && posCurrentClient.id) {
updateClientCreditDisplay(posCurrentClient.id);
}
if (posCurrentClient && posCurrentClient.name) { var ci = document.getElementById('posClientSearchInput'); if (ci) ci.value = posCurrentClient.name; }
if (typeof window.updatePaymentButtons === 'function') window.updatePaymentButtons();
}, 500);
}
}

function posSearchProducts(query){ 
    clearTimeout(window._searchTimeout);
    window._searchTimeout = setTimeout(function(){
        posProductOffset = 0;
        posSearchQuery = query.toLowerCase().trim();
        
        if (posViewMode === 'categories' && posSearchQuery.length > 0) {
            posViewMode = 'products';
            posSelectedCategoryForView = null;
        }
        
        if(isOnPOSPage()) filterProductGrid();
    }, 150);
}

function clearPosSearch() {
var input = document.getElementById('posSearchInput');
if (input) {
input.value = '';
posSearchQuery = '';
posProductOffset = 0;
if (isOnPOSPage()) {
filterProductGrid();
}
input.focus();
var clearBtn = document.getElementById('posSearchClearBtn');
if (clearBtn) clearBtn.style.display = 'none';
}
}

function clearClientSearch() {
var input = document.getElementById('posClientSearchInput');
if (input) {
input.value = '';
posCurrentClient = null;
posCurrentTable = '';
var dropdown = document.getElementById('posClientDropdown');
if (dropdown) dropdown.style.display = 'none';
var creditDisplay = document.getElementById('clientCreditDisplay');
if (creditDisplay) creditDisplay.style.display = 'none';
updatePaymentButtons();
if (isOnPOSPage()) renderPOS();
input.focus();
var clearBtn = document.getElementById('posClientClearBtn');
if (clearBtn) clearBtn.style.display = 'none';
}
}

function loadMoreProducts(){ posProductOffset+=posProductBatchSize; filterProductGrid(); }

// ==================== FILTER PRODUCT GRID AVEC MODE CATÉGORIES ====================
function filterProductGrid(){
    if(!isOnPOSPage() || posStep !== 1) return;
    
    var grid = document.getElementById('posProductGrid') || document.querySelector('.pos-products-grid');
    if(!grid) return;

    if (posViewMode === 'categories') {
        afficherCategories(grid);
        return;
    }

    var f = fastSearch(posSearchQuery);
    
    if (posSelectedCategoryForView) {
        f = f.filter(function(p) {
            if (p.categories && p.categories.length > 0) {
                return p.categories.includes(posSelectedCategoryForView);
            }
            return p.categorie === posSelectedCategoryForView;
        });
    } else if (posSelectedCategory !== 'all') {
        f = f.filter(function(p) {
            if (p.categories && p.categories.length > 0) {
                return p.categories.includes(posSelectedCategory);
            }
            return p.categorie === posSelectedCategory;
        });
    }
    
    f.sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); });

    var totalProducts = f.length;
    var displayProducts = f.slice(0, posProductOffset + posProductBatchSize);
    posHasMoreProducts = (posProductOffset + posProductBatchSize) < totalProducts;

    var isMobile = window.innerWidth < 700;
    var gridCols = isMobile ? 'repeat(5, 1fr)' : 'repeat(auto-fill, minmax(110px, 1fr))';
    grid.style.gridTemplateColumns = gridCols;
    grid.style.overflowX = 'hidden';
    grid.style.overflowY = 'auto';
    grid.style.flexWrap = 'wrap';
    grid.style.alignContent = 'start';

    var html = '';

    html += '<div style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;padding:4px 6px;margin-bottom:4px;background:var(--bg-page);border-radius:8px;">';
    html += '<button onclick="retournerCategories()" style="display:flex;align-items:center;gap:6px;background:var(--black);color:var(--white);border:none;border-radius:8px;padding:6px 14px;font-size:0.8rem;font-weight:600;cursor:pointer;">';
    html += '<i class="fas fa-arrow-left"></i> Retour aux catégories';
    html += '</button>';
    if (posSelectedCategoryForView) {
        html += '<span style="font-weight:700;font-size:0.9rem;color:var(--text-primary);">📂 ' + escapeHtml(posSelectedCategoryForView) + '</span>';
    }
    html += '</div>';

    if(totalProducts === 0){
        html += '<div style="grid-column:1/-1;text-align:center;padding:40px 10px;">';
        html += '<i class="fas fa-search" style="font-size:2.5rem;color:#94a3b8;"></i>';
        html += '<p style="color:#94a3b8;margin-top:10px;">Aucun produit dans cette catégorie</p>';
        html += '</div>';
    } else {
        if(posSearchQuery) {
            html += '<div style="grid-column:1/-1;padding:3px 8px;font-size:0.75rem;color:#94a3b8;">' + totalProducts + ' résultat' + (totalProducts>1?'s':'') + '</div>';
        }
        
        for(var j = 0; j < displayProducts.length; j++){ 
            var p = displayProducts[j];
            var pr = p.prixPromo && p.prixPromo > 0 ? p.prixPromo : p.prixVente;
            var hp = p.prixPromo && p.prixPromo > 0;
            var sc = '', stt = ''; 
            if(p.stock !== undefined){ 
                if(p.stock <= 0){ sc = 'pos-out-of-stock'; stt = ' (Rupture)'; } 
                else if(p.stock <= 5) stt = ' (' + p.stock + ' rest.)'; 
            }
            
            var dn = escapeHtml(p.nom); 
            if(posSearchQuery) {
                dn = dn.replace(new RegExp('(' + posSearchQuery.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')','gi'), '<mark style="background:#fef3c7;border-radius:3px;color:#111827;">$1</mark>');
            }

            var isMobile = window.innerWidth < 700;
            
            var cardStyle = isMobile ? 
                'padding:4px 2px;min-height:110px;max-height:140px;aspect-ratio:1/1;border-radius:6px;border-width:1px;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;' : 
                'padding:6px 8px;min-height:150px;max-height:190px;aspect-ratio:1/1;border-radius:8px;border-width:2px;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;';
            
            var imgStyle = isMobile ? 
                'height:55px;width:55px;margin-bottom:4px;border-radius:6px;overflow:hidden;flex-shrink:0;background:var(--gray-200);display:flex;align-items:center;justify-content:center;' : 
                'height:75px;width:75px;margin-bottom:6px;border-radius:8px;overflow:hidden;flex-shrink:0;background:var(--gray-200);display:flex;align-items:center;justify-content:center;';
            
            var nameStyle = isMobile ? 
                'font-size:9px !important;font-weight:600 !important;line-height:1.3;text-align:center;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:var(--text-primary);margin:1px 0;' : 
                'font-size:0.75rem !important;font-weight:600 !important;line-height:1.3;text-align:center;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:var(--text-primary);margin:2px 0;';
            
            var priceStyle = isMobile ? 
                'font-size:10px !important;font-weight:700 !important;color:var(--text-primary);' : 
                'font-size:0.8rem !important;font-weight:700 !important;color:var(--text-primary);';

            var imgContent = '';
            if (p.imageBase64) {
                imgContent = '<img src="' + escapeHtml(p.imageBase64) + '" loading="lazy" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">';
            } else {
                imgContent = '<i class="fas fa-box" style="' + (isMobile ? 'font-size:18px;color:var(--text-muted);' : 'font-size:26px;color:var(--text-muted);') + '"></i>';
            }

            html += '<div class="pos-product-card ' + sc + '" style="' + cardStyle + '" onclick="posAddToCartOrOpenOptions(\'' + p.id + '\')">' +
                '<div class="pos-product-img" style="' + imgStyle + '">' + imgContent + '</div>' +
                '<div class="pos-product-info" style="display:flex;flex-direction:column;align-items:center;width:100%;flex:1;justify-content:center;overflow:hidden;min-height:0;">' +
                '<span class="pos-product-name" style="' + nameStyle + '">' + dn + stt + '</span>' +
                '<span class="pos-product-price" style="' + priceStyle + '">' + 
                    (hp ? '<span class="pos-old-price" style="' + (isMobile ? 'font-size:7px;' : 'font-size:0.6rem;') + 'text-decoration:line-through;color:var(--text-muted);">' + p.prixVente.toFixed(2) + '</span> <span class="pos-promo-price" style="' + (isMobile ? 'font-size:10px;color:var(--danger);' : 'font-size:0.8rem;color:var(--danger);') + '">' + pr.toFixed(2) + ' MAD</span>' : pr.toFixed(2) + ' MAD') +
                '</span>' +
                '</div>' +
                '</div>'; 
        }
        
        if(posHasMoreProducts){ 
            html += '<div style="grid-column:1/-1;text-align:center;padding:10px;">' +
                '<button class="btn-add" onclick="loadMoreProducts()" style="font-size:0.8rem;">Afficher plus (' + (totalProducts - displayProducts.length) + ' produits restants)</button>' +
                '</div>'; 
        }
    }
    grid.innerHTML = html;
    updateClearButtonVisibility();
}

// ==================== AFFICHER LES CATÉGORIES (ESPACEMENT CORRIGÉ) ====================
function afficherCategories(grid) {
    var isMobile = window.innerWidth < 700;
    var gridCols = isMobile ? 'repeat(4, 1fr)' : 'repeat(auto-fill, minmax(150px, 1fr))';
    grid.style.gridTemplateColumns = gridCols;
    grid.style.overflowX = 'hidden';
    grid.style.overflowY = 'auto';
    grid.style.flexWrap = 'wrap';
    grid.style.alignContent = 'start';
    grid.style.gap = isMobile ? '8px' : '16px';
    grid.style.padding = isMobile ? '4px' : '12px';

    var html = '';
    
    html += '<div style="grid-column:1/-1;padding:8px 10px;font-size:1rem;font-weight:700;color:var(--text-primary);">';
    html += '📂 Choisissez une catégorie';
    html += '</div>';

    if (posCategoriesList.length === 0) {
        html += '<div style="grid-column:1/-1;text-align:center;padding:40px 10px;">';
        html += '<i class="fas fa-folder-open" style="font-size:2.5rem;color:#94a3b8;"></i>';
        html += '<p style="color:#94a3b8;margin-top:10px;">Aucune catégorie disponible</p>';
        html += '</div>';
    } else {
        var sortedCategories = posCategoriesList.slice().sort(function(a, b) {
            var ordreA = (a.ordre !== undefined && a.ordre !== null) ? parseInt(a.ordre) : 9999;
            var ordreB = (b.ordre !== undefined && b.ordre !== null) ? parseInt(b.ordre) : 9999;
            if (ordreA !== ordreB) return ordreA - ordreB;
            return (a.nom || '').localeCompare(b.nom || '');
        });

        for (var i = 0; i < sortedCategories.length; i++) {
            var cat = sortedCategories[i];
            
            var cardStyle = isMobile ? 
                'padding:10px 4px;min-height:90px;max-height:120px;border-radius:10px;border:2px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;aspect-ratio:1/1;background:var(--bg-card);cursor:pointer;transition:var(--transition);' : 
                'padding:16px 10px;min-height:150px;max-height:180px;border-radius:14px;border:2px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;aspect-ratio:1/1;background:var(--bg-card);cursor:pointer;transition:var(--transition);';
            
            var imgSize = isMobile ? '50px' : '70px';
            var imgStyle = 'width:'+imgSize+';height:'+imgSize+';border-radius:50%;margin-bottom:6px;overflow:hidden;flex-shrink:0;background:var(--gray-100);display:flex;align-items:center;justify-content:center;';
            
            var nameSize = isMobile ? '11px' : '14px';
            var nameStyle = 'font-size:'+nameSize+' !important;font-weight:600 !important;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;color:var(--text-primary);margin-top:4px;display:block;';
            
            var countSize = isMobile ? '9px' : '12px';
            var countStyle = 'font-size:'+countSize+' !important;color:var(--text-muted);font-weight:500;display:block;margin-top:2px;';

            var count = posProductsList.filter(function(p) {
                if (p.categories && p.categories.length > 0) {
                    return p.categories.includes(cat.nom);
                }
                return p.categorie === cat.nom;
            }).length;

            var imgContent = '';
            if (cat.imageBase64) {
                imgContent = '<img src="' + escapeHtml(cat.imageBase64) + '" loading="lazy" alt="' + escapeHtml(cat.nom) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
            } else {
                imgContent = '<i class="fas fa-folder" style="font-size:' + (isMobile ? '22px' : '32px') + ';color:var(--accent);"></i>';
            }

            html += '<div class="pos-category-card" style="' + cardStyle + '" onclick="selectionnerCategorie(\'' + escapeHtml(cat.nom).replace(/'/g, "\\'") + '\')" onmouseover="this.style.borderColor=\'var(--accent)\';this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'var(--shadow-md)\';" onmouseout="this.style.borderColor=\'var(--border)\';this.style.transform=\'none\';this.style.boxShadow=\'none\';">' +
                '<div style="' + imgStyle + '">' + imgContent + '</div>' +
                '<span style="' + nameStyle + '">' + escapeHtml(cat.nom) + '</span>' +
                '<span style="' + countStyle + '">' + count + ' produit' + (count > 1 ? 's' : '') + '</span>' +
                '</div>';
        }
    }

    grid.innerHTML = html;
}

function selectionnerCategorie(catName) {
    posSelectedCategoryForView = catName;
    posViewMode = 'products';
    posProductOffset = 0;
    posSearchQuery = '';
    posSelectedCategory = catName;
    
    var catBtns = document.querySelectorAll('.pos-cat-btn');
    catBtns.forEach(function(btn) {
        btn.classList.remove('active');
        if (btn.textContent.trim() === catName) {
            btn.classList.add('active');
        }
    });
    
    var searchInput = document.getElementById('posSearchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    
    if (isOnPOSPage()) {
        filterProductGrid();
    }
}

function retournerCategories() {
    posViewMode = 'categories';
    posSelectedCategoryForView = null;
    posSelectedCategory = 'all';
    posSearchQuery = '';
    posProductOffset = 0;
    
    var catBtns = document.querySelectorAll('.pos-cat-btn');
    catBtns.forEach(function(btn) {
        btn.classList.remove('active');
    });
    var allBtn = document.querySelector('.pos-cat-btn[onclick*="all"]');
    if (allBtn) allBtn.classList.add('active');
    
    var searchInput = document.getElementById('posSearchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    
    if (isOnPOSPage()) {
        filterProductGrid();
    }
}

function posSearchClient(query){
var q = query.toLowerCase().trim();
posCurrentClient = null;
var dropdown = document.getElementById('posClientDropdown');
var clearBtn = document.getElementById('posClientClearBtn');
if (!q) {
posFilteredClients = posAllClients.slice();
if (dropdown) dropdown.style.display = 'none';
document.getElementById('clientCreditDisplay').style.display = 'none';
if (clearBtn) clearBtn.style.display = 'none';
updatePaymentButtons();
if (isOnPOSPage()) renderPOS();
return;
}
if (clearBtn) clearBtn.style.display = 'flex';
posFilteredClients = posAllClients.filter(function(c){
return (c.nom||'').toLowerCase().indexOf(q)!==-1 ||
(c.prenom||'').toLowerCase().indexOf(q)!==-1 ||
(c.telephone||'').toLowerCase().indexOf(q)!==-1 ||
(c.description||'').toLowerCase().indexOf(q)!==-1;
});
if (posFilteredClients.length === 1) {
var client = posFilteredClients[0];
posCurrentClient = { id: client.id, name: client.nom + ' ' + client.prenom };
var input = document.getElementById('posClientSearchInput');
if (input) input.value = posCurrentClient.name;
if (dropdown) dropdown.style.display = 'none';
if (clearBtn) clearBtn.style.display = 'flex';
updateClientCreditDisplay(client.id);
updatePaymentButtons();
if (isOnPOSPage()) renderPOS();
setTimeout(function() {
if (posStep === 1 && isOnPOSPage()) {
posGoToStep2();
}
}, 300);
return;
}
if (posFilteredClients.length > 0) {
renderClientDropdown();
} else {
if (dropdown) dropdown.style.display = 'none';
}
}

function renderClientDropdown(){
var d = document.getElementById('posClientDropdown');
if (!d) return;
var h = '';
if (posFilteredClients.length === 0) {
h = '<div style="padding:8px;color:#94a3b8;text-align:center;font-size:24px;">Aucun</div>';
} else {
posFilteredClients.forEach(function(c){
h += '<div onclick="posSelectClientFromDropdown(\''+c.id+'\',\''+escapeHtml(c.nom)+' '+escapeHtml(c.prenom)+'\')" style="padding:8px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:24px;">'+
escapeHtml(c.nom)+' '+escapeHtml(c.prenom)+
' <span style="color:#94a3b8;font-size:20px;">('+(c.telephone||'')+')</span></div>';
});
}
d.innerHTML = h;
d.style.display = 'block';
}

function posSelectClientFromDropdown(cid,cn){
posCurrentClient={id:cid,name:cn};
posCurrentTable='';
var s=document.getElementById('posClientSearchInput');
var t=document.getElementById('posTableNum');
var d=document.getElementById('posClientDropdown');
var clearBtn=document.getElementById('posClientClearBtn');
if(s) s.value=cn;
if(t) t.value='';
if(d) d.style.display='none';
if(clearBtn) clearBtn.style.display='flex';
updatePaymentButtons();
updateClientCreditDisplay(cid);
if(isOnPOSPage()) renderPOS();
setTimeout(function() {
if (posStep === 1 && isOnPOSPage()) {
posGoToStep2();
}
}, 300);
}

document.addEventListener('click',function(e){
var d=document.getElementById('posClientDropdown');
var s=document.getElementById('posClientSearchInput');
if(d && s && !s.contains(e.target) && !d.contains(e.target)) {
d.style.display='none';
if (posCurrentClient && posCurrentClient.name) {
s.value = posCurrentClient.name;
}
}
});

function updatePaymentButtons(){ setTimeout(function(){ var cb=document.getElementById('posCreditBtn'),pb=document.getElementById('posPartielBtn'),cc=posCurrentClient&&posCurrentClient.id; if(cb){ cb.disabled=!cc; cb.style.opacity=cc?'1':'0.4'; } if(pb){ pb.disabled=!cc; pb.style.opacity=cc?'1':'0.4'; } },300); }
function posSetTable(v){ posCurrentTable=v.trim(); if(posCurrentTable){ posCurrentClient=null; posPaymentMethod='espece'; var s=document.getElementById('posClientSearchInput'); if(s) s.value=''; document.getElementById('clientCreditDisplay').style.display='none'; var clearBtn=document.getElementById('posClientClearBtn'); if(clearBtn) clearBtn.style.display='none'; } }

function posAddToCartOrOpenOptions(pid){ var p=posProductsList.find(function(x){ return x.id===pid; }); if(!p) return; if(p.stock!==undefined&&p.stock<=0){ alert('Rupture'); return; } var cat=posCategoriesList.find(function(c){ return c.nom===p.categorie; }),isRecette=cat&&cat.recette===true; if(isRecette){ posCurrentProductId=pid; posOpenOptionsModal(pid); }else{ var ex=posCart.find(function(x){ return x.id===pid; }); if(ex){ if(p.stock!==undefined&&ex.quantite>=p.stock){ alert('Stock insuffisant'); return; } ex.quantite+=1; }else{ var pr=p.prixPromo&&p.prixPromo>0?p.prixPromo:p.prixVente; posCart.push({id:p.id,nom:p.nom,prixUnitaire:pr,prixAchat:p.prixAchat||0,prixPromo:p.prixPromo||0,prixVente:p.prixVente||0,quantite:1,categorie:p.categorie||'',imageBase64:p.imageBase64||'',sauces:[],interdits:[],epice:'Normal',sel:'Normal'}); } if(typeof window.onProductAdded==='function') window.onProductAdded(p.id); updateCartOnly(); } }

async function posOpenOptionsModal(pid) {
    var p = posProductsList.find(function(x) { return x.id === pid; });
    if (!p) return;
    if (p.stock !== undefined && p.stock <= 0) {
        alert('Rupture');
        return;
    }

    try {
        var doc = await db.collection('products').doc(pid).get();
        if (doc.exists) {
            posCurrentProductIngredients = doc.data().ingredients || [];
        } else {
            posCurrentProductIngredients = [];
        }
    } catch(e) {
        console.error('Erreur chargement ingrédients:', e);
        posCurrentProductIngredients = [];
    }

    if (typeof allStockData === 'undefined' || allStockData.length === 0) {
        try {
            const snap = await db.collection('stock').orderBy('nom').get();
            allStockData = [];
            snap.forEach(function(d) {
                var dd = d.data();
                dd.id = d.id;
                allStockData.push(dd);
            });
        } catch(e) {
            console.error('Erreur chargement stock:', e);
        }
    }

    var grouped = {};
    posCurrentProductIngredients.forEach(function(ing) {
        var stockItem = allStockData.find(function(s) { return s.id === ing.idStock; });
        var cat = stockItem ? (stockItem.categorie || 'Ingrédients') : 'Ingrédients';
        if (!grouped[cat]) grouped[cat] = [];
        
        var stockDisponible = stockItem ? (stockItem.quantite || 0) : 0;
        
        grouped[cat].push({
            nom: ing.nom,
            idStock: ing.idStock,
            quantite: ing.quantite || 1,
            unite: ing.unite || '',
            stockDisponible: stockDisponible
        });
    });

    var order = ['Sauces', 'Légumes', 'Fruits', 'Viande', 'Poulet', 'Poisson', 'Ingrédients'];
    var sortedCats = Object.keys(grouped).sort(function(a, b) {
        var ia = order.indexOf(a), ib = order.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
    });

    posCurrentProductId = pid;
    
    var h = '<h4 style="font-size:1.2rem;margin-bottom:12px;">' + escapeHtml(p.nom) + '</h4>';
    h += '<p style="color:#64748b;font-size:0.85rem;margin-bottom:12px;">Sélectionnez les ingrédients à conserver (décochez pour exclure) :</p>';

    if (sortedCats.length === 0) {
        h += '<div style="color:#94a3b8;padding:12px;">Aucun ingrédient pour ce produit</div>';
    } else {
        sortedCats.forEach(function(cat) {
            h += '<div style="margin-bottom:14px;">';
            h += '<label style="font-weight:700;font-size:0.9rem;display:block;margin-bottom:4px;">🥫 ' + escapeHtml(cat) + '</label>';
            h += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
            
            grouped[cat].forEach(function(ing) {
                var disabled = ing.stockDisponible <= 0 ? 'disabled' : '';
                var styleDisabled = ing.stockDisponible <= 0 ? 'opacity:0.5;' : '';
                
                h += '<label style="display:flex;align-items:center;gap:6px;padding:8px 12px;border:2px solid #e2e8f0;border-radius:8px;cursor:' + (ing.stockDisponible <= 0 ? 'not-allowed' : 'pointer') + ';' + styleDisabled + '">';
                h += '<input type="checkbox" class="pos-interdit-check" value="' + escapeHtml(ing.nom) + '" ' + disabled + ' checked>';
                h += ' ' + escapeHtml(ing.nom);
                if (ing.unite) h += ' (' + escapeHtml(ing.unite) + ')';
                if (ing.stockDisponible > 0) {
                    h += ' <span style="font-size:0.7rem;color:#94a3b8;">stock: ' + ing.stockDisponible + '</span>';
                } else {
                    h += ' <span style="font-size:0.7rem;color:#ef4444;">❌ rupture</span>';
                }
                h += '</label>';
            });
            
            h += '</div></div>';
        });
    }

    h += '<div style="margin-bottom:12px;"><label style="font-weight:700;font-size:0.9rem;">🌶️ Épices:</label><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">';
    posEpicesList.forEach(function(s, idx) {
        h += '<label style="padding:6px 12px;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:0.85rem;"><input type="radio" name="pos-epice" value="' + s + '" ' + (idx === 0 ? 'checked' : '') + '> ' + s + '</label>';
    });
    h += '</div></div>';

    h += '<div style="margin-bottom:12px;"><label style="font-weight:700;font-size:0.9rem;">🧂 Sel:</label><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">';
    posSelList.forEach(function(s, idx) {
        h += '<label style="padding:6px 12px;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:0.85rem;"><input type="radio" name="pos-sel" value="' + s + '" ' + (idx === 0 ? 'checked' : '') + '> ' + s + '</label>';
    });
    h += '</div></div>';

    h += '<div style="text-align:right;margin-top:16px;display:flex;gap:10px;justify-content:flex-end;">';
    h += '<button class="btn-cancel" onclick="closeModal()" style="font-size:0.9rem;padding:10px 20px;">Annuler</button>';
    h += '<button class="btn-save" onclick="posConfirmOptions()" style="font-size:0.9rem;padding:10px 24px;"><i class="fas fa-check"></i> Ajouter au panier</button>';
    h += '</div>';

    openModal('Personnaliser - ' + escapeHtml(p.nom), h);
}

function posConfirmOptions() {
    var interdits = [];
    document.querySelectorAll('.pos-interdit-check:checked').forEach(function(cb) {
        interdits.push(cb.value);
    });
    var epice = (document.querySelector('input[name="pos-epice"]:checked') || {}).value || 'Normal';
    var sel = (document.querySelector('input[name="pos-sel"]:checked') || {}).value || 'Normal';
    var p = posProductsList.find(function(x) { return x.id === posCurrentProductId; });
    if (!p) { closeModal(); return; }

    var ingredientsExclus = [];
    document.querySelectorAll('.pos-interdit-check:checked').forEach(function(cb) {
        ingredientsExclus.push(cb.value.toLowerCase().trim());
    });

    var ex = posCart.find(function(x) { return x.id === posCurrentProductId; });
    if (ex) {
        if (p.stock !== undefined && ex.quantite >= p.stock) {
            alert('Stock insuffisant');
            closeModal();
            return;
        }
        ex.quantite += 1;
    } else {
        var pr = p.prixPromo && p.prixPromo > 0 ? p.prixPromo : p.prixVente;
        posCart.push({
            id: p.id,
            nom: p.nom,
            prixUnitaire: pr,
            prixAchat: p.prixAchat || 0,
            prixPromo: p.prixPromo || 0,
            prixVente: p.prixVente || 0,
            quantite: 1,
            categorie: p.categorie || '',
            imageBase64: p.imageBase64 || '',
            sauces: [],
            interdits: interdits,
            epice: epice,
            sel: sel,
            ingredientsExclus: ingredientsExclus
        });
    }

    decrementerIngredientsStock(posCurrentProductId, ingredientsExclus);

    if (typeof window.onProductAdded === 'function') {
        window.onProductAdded(p.id);
    }
    closeModal();
    updateCartOnly();
}

function decrementerIngredientsStock(productId, ingredientsExclus) {
    db.collection('products').doc(productId).get().then(function(doc) {
        if (!doc.exists) return;
        var productData = doc.data();
        var ingredients = productData.ingredients || [];

        ingredients.forEach(function(ing) {
            var isExcluded = ingredientsExclus.some(function(excl) {
                return excl === ing.nom.toLowerCase().trim();
            });

            if (!isExcluded && ing.idStock) {
                var quantite = ing.quantite || 1;
                
                db.collection('stock').doc(ing.idStock).get().then(function(stockDoc) {
                    if (!stockDoc.exists) return;
                    var stockData = stockDoc.data();
                    var nouveauStock = Math.max(0, (stockData.quantite || 0) - quantite);
                    
                    db.collection('stock').doc(ing.idStock).update({
                        quantite: nouveauStock,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }).then(function() {
                        var stockItem = allStockData.find(function(s) { return s.id === ing.idStock; });
                        if (stockItem) {
                            stockItem.quantite = nouveauStock;
                            CacheDB.set('stock', ing.idStock, stockItem);
                        }
                        if (typeof renderStockTable === 'function') {
                            renderStockTable();
                        }
                        console.log('✅ Stock mis à jour: ' + ing.nom + ' → ' + nouveauStock);
                    }).catch(function(err) {
                        console.error('❌ Erreur mise à jour stock:', err);
                    });
                }).catch(function(err) {
                    console.error('❌ Erreur récupération stock:', err);
                });
            }
        });
    }).catch(function(err) {
        console.error('❌ Erreur récupération produit:', err);
    });
}

function updateCartOnly(){
if(!isOnPOSPage()) return;
var ci=document.querySelector('.pos-cart-items');
if(!ci) return;
var html='';
if(posCart.length===0) {
html='<div class="pos-cart-empty"><i class="fas fa-shopping-basket"></i><p>Panier vide</p></div>';
} else {
var isMobile = window.innerWidth < 700;
var btnSize = isMobile ? '40px' : '28px';
var fontSize = isMobile ? '1.2rem' : '0.7rem';
var qtySize = isMobile ? '1.3rem' : '0.85rem';
var nameSize = isMobile ? '22px' : '0.85rem';
var priceSize = isMobile ? '0.7rem' : '0.7rem';
var totalSize = isMobile ? '24px' : '0.8rem';

for(var k=0;k<posCart.length;k++){
var it=posCart[k],opts='';
if(it.interdits&&it.interdits.length) opts+=' <span style="color:#ef4444;font-size:0.6rem;">🚫'+escapeHtml(it.interdits.join(','))+'</span>';
if(it.epice&&it.epice!=='Normal') opts+=' <span style="color:#d97706;font-size:0.6rem;">🌶️'+escapeHtml(it.epice)+'</span>';
if(it.sel&&it.sel!=='Normal') opts+=' <span style="color:#4f46e5;font-size:0.6rem;">🧂'+escapeHtml(it.sel)+'</span>';

html+='<div class="pos-cart-item" style="display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--border);gap:8px;">' +
'<div class="pos-cart-item-info" style="flex:1;min-width:0;">' +
'<span class="pos-cart-item-name" style="font-size:'+nameSize+';font-weight:600;display:block;margin-right:10px;word-break:break-word;">'+escapeHtml(it.nom)+opts+'</span>' +
'<span class="pos-cart-item-price" style="font-size:'+priceSize+';color:var(--text-secondary);">'+it.prixUnitaire.toFixed(2)+' MAD/u</span>' +
'</div>' +
'<div class="pos-cart-item-actions" style="display:flex;align-items:center;gap:6px;flex-shrink:0;">' +
'<button class="pos-qty-btn" onclick="posUpdateQty('+k+',-1)" style="width:'+btnSize+';height:'+btnSize+';border-radius:50%;border:2px solid var(--border);background:var(--white);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:'+fontSize+';transition:all 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.05);"><i class="fas fa-minus"></i></button>' +
'<span class="pos-qty-value" style="font-size:'+qtySize+';font-weight:700;min-width:32px;text-align:center;">'+it.quantite+'</span>' +
'<button class="pos-qty-btn" onclick="posUpdateQty('+k+',1)" style="width:'+btnSize+';height:'+btnSize+';border-radius:50%;border:2px solid var(--border);background:var(--white);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:'+fontSize+';transition:all 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.05);"><i class="fas fa-plus"></i></button>' +
'<button class="pos-remove-btn" onclick="posRemoveItem('+k+')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:4px;font-size:1.1rem;transition:all 0.2s;"><i class="fas fa-times"></i></button>' +
'</div>' +
'<span class="pos-cart-item-total" style="font-size:'+totalSize+';font-weight:700;min-width:80px;text-align:right;flex-shrink:0;">'+(it.prixUnitaire*it.quantite).toFixed(2)+' MAD</span>' +
'</div>';
}
}
ci.innerHTML=html;
var badge=document.querySelector('.pos-cart-badge');
if(badge) badge.textContent=posCart.length;
var tr=document.querySelector('.pos-cart-total-row span:last-child');
if(tr){
var st=posCalculateTotal(),t=st-posDiscountMAD;
tr.textContent=t.toFixed(2)+' MAD';
}
var vb=document.querySelector('.pos-validate-btn');
if(vb) {
vb.disabled=posCart.length===0;
vb.style.height = '60px';
vb.style.fontSize = '26px';
vb.style.fontWeight = '700';
vb.style.padding = '16px';
vb.style.borderRadius = '12px';
vb.style.background = '#14B8A6';
vb.style.color = '#fff';
vb.style.border = 'none';
vb.style.cursor = 'pointer';
vb.style.transition = 'all 0.2s';
}
}

function getNextFactureNum(){ factureCounter=parseInt(localStorage.getItem('factureCounter'))||0; factureCounter++; localStorage.setItem('factureCounter',factureCounter); return 'FACT-'+new Date().getFullYear()+'-'+String(factureCounter).padStart(5,'0'); }

function renderPOS(){
if(!isOnPOSPage()) return;
var now=Date.now(); if(now-posLastRenderTime<100&&posCart.length>0) return; posLastRenderTime=now;
var c=document.getElementById('dynamicContent'); if(!c) return;
if(posCart.length===0&&posStep===1){ buildFullPOS(c); return; }
if(document.querySelector('.pos-container')&&posStep===1&&posCart.length>0){
var productPanel = document.querySelector('.pos-products-panel');
if (productPanel) productPanel.style.display = 'flex';
updateCartOnly();
filterProductGrid();
var tr=document.querySelector('.pos-cart-total-row span:last-child');
if(tr){ var st=posCalculateTotal(),t=st-posDiscountMAD; tr.textContent=t.toFixed(2)+' MAD'; }
return;
}
buildFullPOS(c);
}

// ==================== BUILD FULL POS AVEC LAYOUT CORRIGÉ ====================
function buildFullPOS(c){
if(posProductsList.length===0&&posCategoriesList.length===0){ c.innerHTML='<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#14B8A6;"></i><p>Chargement...</p></div>'; return; }
var st=posCalculateTotal(),t=st-posDiscountMAD;
var isMobile = window.innerWidth < 700;
var productPanelStyle = posStep===2 ? ' style="display:none;"' : '';

var stepSize = isMobile ? '22px' : '28px';
var stepNumberSize = isMobile ? '22px' : '28px';
var stepNumberSize2 = isMobile ? '26px' : '38px';
var stepGap = isMobile ? '12px' : '20px';

var stepIndicator = '<div class="pos-steps-nav" style="display:flex; justify-content:center; gap:'+stepGap+'; margin-bottom:4px; padding:4px 12px; background:var(--bg-page); border-radius:var(--radius); cursor:default;">' +
'<div class="pos-step ' + (posStep === 1 ? 'active' : '') + '" style="display:flex; align-items:center; gap:6px; font-size:'+stepSize+'; font-weight:600; color:' + (posStep === 1 ? 'var(--black)' : 'var(--text-muted)') + '; cursor:pointer;" onclick="posNaviguerEtape(1)">' +
'<span class="step-number" style="display:inline-flex; align-items:center; justify-content:center; width:'+stepNumberSize2+'; height:'+stepNumberSize2+'; border-radius:50%; background:' + (posStep === 1 ? 'var(--black)' : 'var(--gray-200)') + '; color:' + (posStep === 1 ? 'var(--white)' : 'var(--text-muted)') + '; font-size:'+stepNumberSize+';">1</span>' +
'<span style="font-size:'+stepSize+';">🛒</span> Panier' +
'</div>' +
'<div class="pos-step ' + (posStep === 2 ? 'active' : '') + '" style="display:flex; align-items:center; gap:6px; font-size:'+stepSize+'; font-weight:600; color:' + (posStep === 2 ? 'var(--black)' : 'var(--text-muted)') + '; cursor:pointer;" onclick="posNaviguerEtape(2)">' +
'<span class="step-number" style="display:inline-flex; align-items:center; justify-content:center; width:'+stepNumberSize2+'; height:'+stepNumberSize2+'; border-radius:50%; background:' + (posStep === 2 ? 'var(--black)' : 'var(--gray-200)') + '; color:' + (posStep === 2 ? 'var(--white)' : 'var(--text-muted)') + '; font-size:'+stepNumberSize+';">2</span>' +
'<span style="font-size:'+stepSize+';">💳</span> Paiement' +
'</div>' +
'</div>';

var productPanelDisplay = (posStep === 2) ? 'display:none;' : '';

// 👇 LAYOUT CORRIGÉ : Panier à DROITE sur PC/Tablette
var layoutStyle = isMobile ? 
    '' : 
    'display:flex;flex-direction:row;gap:12px;align-items:flex-start;';

var cartPanelWidth = isMobile ? '100%' : '320px';
var productPanelFlex = isMobile ? '1' : '1';

var h = '<div class="pos-container' + (posStep===2 ? ' pos-container-full' : '') + '" style="' + layoutStyle + '">' +
stepIndicator;

// ========== PANEL PRODUITS (GAUCHE) ==========
h += '<div class="pos-products-panel" style="' + productPanelDisplay + ' flex:'+productPanelFlex+'; min-width:0; background:var(--bg-card); border-radius:var(--radius-xl); box-shadow:var(--shadow-xs); border:1px solid var(--border); display:flex; flex-direction:column; height:100%; overflow:hidden; min-height:400px; max-height:calc(100vh - 200px); padding:'+(isMobile?'8px':'12px')+';">';

// ===== BOUTON AFFICHER OUTILS =====
h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
h += '<button id="posToggleToolsBtn" onclick="posToggleTools()" style="background:#14B8A6;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:0.8rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">🔍 Afficher outils</button>';
h += '<span style="font-size:0.7rem;color:#94a3b8;">' + posProductsList.length + ' produits</span>';
h += '</div>';

// ===== OUTILS (MASQUÉS PAR DÉFAUT) =====
var toolsDisplay = posToolsVisible ? 'flex' : 'none';
h += '<div id="posToolsContainer" style="display:'+toolsDisplay+';flex-direction:column;gap:6px;margin-bottom:8px;padding:6px 8px;background:var(--bg-page);border-radius:8px;border:1px solid var(--border);">';

// Barre de recherche
h += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
'<div style="flex:1;min-width:80px;display:flex;align-items:center;background:#fff;border:2px solid #e2e8f0;border-radius:40px;padding:2px 8px;position:relative;height:'+(isMobile?'34px':'40px')+';">' +
'<i class="fas fa-search" style="color:#94a3b8;margin-right:4px;font-size:'+(isMobile?'14px':'18px')+';"></i>' +
'<input type="text" id="posSearchInput" placeholder="🔍 Rechercher..." value="'+escapeHtml(posSearchQuery)+'" onkeyup="posSearchProducts(this.value); updateClearButtonVisibility();" oninput="updateClearButtonVisibility();" style="border:none;outline:none;padding:0;width:100%;background:transparent;font-size:'+(isMobile?'14px':'20px')+';padding-right:28px;height:'+(isMobile?'34px':'40px')+';">' +
'<button id="posSearchClearBtn" onclick="clearPosSearch()" style="display:'+(posSearchQuery ? 'flex' : 'none')+';position:absolute;right:6px;background:none;border:none;cursor:pointer;padding:2px;color:#94a3b8;font-size:'+(isMobile?'18px':'20px')+';align-items:center;justify-content:center;" title="Effacer"><i class="fas fa-times-circle"></i></button>' +
'</div>' +
'<button id="posMicBtn" title="Micro" style="background:#dcfce7;border:3px solid #14B8A6;border-radius:50%;width:'+(isMobile?'36px':'40px')+';height:'+(isMobile?'36px':'40px')+';cursor:pointer;font-size:'+(isMobile?'14px':'18px')+';" onclick="posToggleVoiceSearch()"><i class="fas fa-microphone"></i></button>' +
'<div style="display:flex;gap:3px;"><button onclick="posAfficherCommandesTables()" style="background:#fff;border:2px solid #e2e8f0;border-radius:50px;padding:3px 8px;font-weight:600;font-size:'+(isMobile?'0.5rem':'0.6rem')+';">🍽️ Tables <span style="background:#ef4444;color:#fff;border-radius:20px;padding:1px 5px;font-size:'+(isMobile?'0.4rem':'0.5rem')+';">'+posCommandesTablesCount+'</span></button><button onclick="navigateTo(\'commandes\')" style="background:#fff;border:2px solid #e2e8f0;border-radius:50px;padding:3px 8px;font-weight:600;font-size:'+(isMobile?'0.5rem':'0.6rem')+';">🌐 En ligne <span style="background:#ef4444;color:#fff;border-radius:20px;padding:1px 5px;font-size:'+(isMobile?'0.4rem':'0.5rem')+';">'+posCommandesEnLigneCount+'</span></button></div>' +
'</div>';

// Catégories
h += '<div class="pos-categories-bar" style="display:flex;flex-wrap:wrap;gap:4px;">' +
'<button class="pos-cat-btn '+(posSelectedCategory==='all'?'active':'')+'" onclick="posFilterCategory(\'all\')" style="padding:'+(isMobile?'4px 8px':'6px 12px')+';font-size:'+(isMobile?'11px':'0.75rem')+';gap:'+(isMobile?'3px':'6px')+';border-radius:20px;border:2px solid '+(posSelectedCategory==='all'?'#14B8A6':'#e2e8f0')+';background:'+(posSelectedCategory==='all'?'#f0fdf4':'#fff')+';cursor:pointer;font-weight:600;transition:all 0.2s;">📋 Tous</button>';
var sortedCategories = posCategoriesList.slice().sort(function(a, b) {
var ordreA = (a.ordre !== undefined && a.ordre !== null) ? parseInt(a.ordre) : 9999;
var ordreB = (b.ordre !== undefined && b.ordre !== null) ? parseInt(b.ordre) : 9999;
if (ordreA !== ordreB) return ordreA - ordreB;
return (a.nom || '').localeCompare(b.nom || '');
});
for(var i=0;i<sortedCategories.length;i++){
var ca = sortedCategories[i];
var ac = posSelectedCategory===ca.nom?'active':'';
var ih = ca.imageBase64?'<img src="'+escapeHtml(ca.imageBase64)+'" loading="lazy" style="max-width:24px;max-height:24px;border-radius:4px;">':'<i class="fas fa-folder" style="font-size:'+(isMobile?'11px':'13px')+';"></i>';
h+='<button class="pos-cat-btn '+ac+'" onclick="posFilterCategory(\''+escapeHtml(ca.nom).replace(/'/g,"\\'")+'\')" style="padding:'+(isMobile?'4px 8px':'6px 12px')+';font-size:'+(isMobile?'11px':'0.75rem')+';gap:'+(isMobile?'3px':'6px')+';border-radius:20px;border:2px solid '+(posSelectedCategory===ca.nom?'#14B8A6':'#e2e8f0')+';background:'+(posSelectedCategory===ca.nom?'#f0fdf4':'#fff')+';cursor:pointer;font-weight:600;transition:all 0.2s;display:flex;align-items:center;">'+ih+' '+escapeHtml(ca.nom)+'</button>';
}
h += '</div>';

h += '</div>'; // Fin tools container

// Grille produits
var gridCols = isMobile ? 'repeat(5, 1fr)' : 'repeat(auto-fill, minmax(110px, 1fr))';
h += '<div class="pos-products-grid" id="posProductGrid" style="grid-template-columns:'+gridCols+';gap:'+(isMobile?'4px':'8px')+';padding:'+(isMobile?'2px':'4px')+';overflow-x:hidden;overflow-y:auto;flex-wrap:wrap;align-content:start;flex:1;"></div>';
h += '</div>'; // Fin products panel

// ========== PANEL PANIER (DROITE sur PC/Tablette, BAS sur Mobile) ==========
var cartOrder = isMobile ? '' : 'order:2;';
h += '<div class="pos-cart-panel" style="' + cartOrder + ' width:'+cartPanelWidth+'; flex-shrink:0; background:var(--bg-card); border-radius:var(--radius-xl); box-shadow:var(--shadow-xs); border:1px solid var(--border); display:flex; flex-direction:column; max-height:calc(100vh - 200px); ' + (isMobile ? 'margin-top:8px;' : '') + '">';

if(posStep===1){
h+='<div class="pos-cart-header" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border);flex-shrink:0;"><h3 style="font-size:'+(isMobile?'20px':'1rem')+';"><i class="fas fa-shopping-cart"></i> Panier <span class="pos-cart-badge" style="background:#14B8A6;color:#fff;border-radius:50%;padding:1px 8px;font-size:'+(isMobile?'16px':'0.7rem')+';">'+posCart.length+'</span></h3><button class="pos-clear-btn" onclick="posResetCart()" style="font-size:'+(isMobile?'14px':'0.85rem')+';background:#ef4444;color:#fff;border:none;border-radius:6px;padding:'+(isMobile?'4px 10px':'6px 14px')+';cursor:pointer;"><i class="fas fa-trash-alt"></i> Vider</button></div><div class="pos-cart-items" style="flex:1;overflow-y:auto;padding:4px 8px;min-height:80px;">';
if(posCart.length===0){ h+='<div class="pos-cart-empty" style="text-align:center;padding:20px 10px;color:#94a3b8;"><i class="fas fa-shopping-basket" style="font-size:'+(isMobile?'28px':'36px')+';"></i><p style="font-size:'+(isMobile?'16px':'0.9rem')+';">Panier vide</p></div>'; }
else{
for(var k=0;k<posCart.length;k++){
var it=posCart[k],opts='';
if(it.interdits&&it.interdits.length) opts+=' <span style="color:#ef4444;font-size:0.6rem;">🚫'+escapeHtml(it.interdits.join(','))+'</span>';
if(it.epice&&it.epice!=='Normal') opts+=' <span style="color:#d97706;font-size:0.6rem;">🌶️'+escapeHtml(it.epice)+'</span>';
if(it.sel&&it.sel!=='Normal') opts+=' <span style="color:#4f46e5;font-size:0.6rem;">🧂'+escapeHtml(it.sel)+'</span>';
var btnSize = isMobile ? '32px' : '24px';
var fontSize = isMobile ? '1rem' : '0.65rem';
var qtySize = isMobile ? '1.1rem' : '0.8rem';
var nameSize = isMobile ? '18px' : '0.8rem';
var priceSize = isMobile ? '0.65rem' : '0.65rem';
var totalSize = isMobile ? '20px' : '0.75rem';
h+='<div class="pos-cart-item" style="display:flex;align-items:center;justify-content:space-between;padding:6px 2px;border-bottom:1px solid var(--border);gap:4px;">' +
'<div class="pos-cart-item-info" style="flex:1;min-width:0;">' +
'<span class="pos-cart-item-name" style="font-size:'+nameSize+';font-weight:600;display:block;margin-right:6px;word-break:break-word;">'+escapeHtml(it.nom)+opts+'</span>' +
'<span class="pos-cart-item-price" style="font-size:'+priceSize+';color:var(--text-secondary);">'+it.prixUnitaire.toFixed(2)+' MAD/u</span>' +
'</div>' +
'<div class="pos-cart-item-actions" style="display:flex;align-items:center;gap:4px;flex-shrink:0;">' +
'<button class="pos-qty-btn" onclick="posUpdateQty('+k+',-1)" style="width:'+btnSize+';height:'+btnSize+';border-radius:50%;border:2px solid var(--border);background:var(--white);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:'+fontSize+';transition:all 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.05);"><i class="fas fa-minus"></i></button>' +
'<span class="pos-qty-value" style="font-size:'+qtySize+';font-weight:700;min-width:28px;text-align:center;">'+it.quantite+'</span>' +
'<button class="pos-qty-btn" onclick="posUpdateQty('+k+',1)" style="width:'+btnSize+';height:'+btnSize+';border-radius:50%;border:2px solid var(--border);background:var(--white);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:'+fontSize+';transition:all 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.05);"><i class="fas fa-plus"></i></button>' +
'<button class="pos-remove-btn" onclick="posRemoveItem('+k+')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:2px;font-size:1rem;transition:all 0.2s;"><i class="fas fa-times"></i></button>' +
'</div>' +
'<span class="pos-cart-item-total" style="font-size:'+totalSize+';font-weight:700;min-width:70px;text-align:right;flex-shrink:0;">'+(it.prixUnitaire*it.quantite).toFixed(2)+' MAD</span>' +
'</div>';
}
}
h+='</div><div class="pos-cart-total-row" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-top:2px solid var(--border);flex-shrink:0;"><span style="font-weight:700;font-size:'+(isMobile?'20px':'0.9rem')+';">Total:</span><span style="font-weight:700;font-size:'+(isMobile?'22px':'1rem')+';color:#14B8A6;">'+t.toFixed(2)+' MAD</span></div>';
h+='<button class="pos-validate-btn" onclick="posGoToStep2()" style="width:100%;height:60px;background:#14B8A6;color:#fff;border:none;border-radius:0 0 12px 12px;font-size:26px;font-weight:700;padding:16px;cursor:'+(posCart.length>0?'pointer':'not-allowed')+';opacity:'+(posCart.length>0?'1':'0.5')+';flex-shrink:0;"><i class="fas fa-arrow-right"></i> Valider le panier</button>';
}
else if(posStep===2){
h+=posBuildPaymentPanel();
}
h+='</div></div>';
c.innerHTML=h;
if(posStep===1){
filterProductGrid();
updateCartOnly();
if(posSearchQuery) {
var clearBtn = document.getElementById('posSearchClearBtn');
if(clearBtn) clearBtn.style.display = 'flex';
}
// Appliquer la visibilité des outils
var toolsContainer = document.getElementById('posToolsContainer');
var toggleBtn = document.getElementById('posToggleToolsBtn');
if (toolsContainer) {
toolsContainer.style.display = posToolsVisible ? 'flex' : 'none';
}
if (toggleBtn) {
toggleBtn.innerHTML = posToolsVisible ? '✕ Masquer outils' : '🔍 Afficher outils';
toggleBtn.style.background = posToolsVisible ? '#ef4444' : '#14B8A6';
}
} else if(posStep===2) {
posSetupPaymentPanel();
}
var vb=document.querySelector('.pos-validate-btn');
if(vb) {
vb.disabled=posCart.length===0;
vb.style.height = '60px';
vb.style.fontSize = '26px';
vb.style.fontWeight = '700';
vb.style.padding = '16px';
vb.style.borderRadius = (posStep===1) ? '0 0 12px 12px' : '12px';
vb.style.background = '#14B8A6';
vb.style.color = '#fff';
vb.style.border = 'none';
vb.style.cursor = 'pointer';
vb.style.transition = 'all 0.2s';
}
if (posStep===2 && posAmountGiven>0) {
setTimeout(function() {
var input = document.getElementById('posAmountGiven');
if (input) { input.value = posAmountGiven.toFixed(2); if (typeof posCalculateChange === 'function') posCalculateChange(); }
}, 500);
}
}

// ==================== LE RESTE DES FONCTIONS (inchangé) ====================
function posBuildPaymentPanel(){
var st=posCalculateTotal(), t=st - posDiscountMAD;
var isMobile = window.innerWidth < 700;
var fontSize = isMobile ? '24px' : '1.2rem';
var fontSize2 = isMobile ? '22px' : '1rem';

var clientDisplay = '';
if (posCurrentClient) {
clientDisplay = '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#f0fdf4;border-radius:8px;margin-bottom:16px;">' +
'<span style="font-weight:600;font-size:'+fontSize2+';">👤 ' + escapeHtml(posCurrentClient.name) + '</span>' +
'<span style="font-size:'+fontSize2+';color:#14B8A6;">💳 ' + (posCurrentClient.id ? 'Client ID: ' + posCurrentClient.id.substring(0,8) : '') + '</span>' +
'</div>';
} else if (posCurrentTable) {
clientDisplay = '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#fef3c7;border-radius:8px;margin-bottom:16px;">' +
'<span style="font-weight:600;font-size:'+fontSize2+';">🍽️ Table: ' + escapeHtml(posCurrentTable) + '</span>' +
'</div>';
}

var html = '<div class="pos-payment-panel" style="padding:'+(isMobile?'8px':'16px')+';flex:1;display:flex;flex-direction:column;">' +
'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
'<h3 style="font-size:'+(isMobile?'22px':'1.2rem')+';"><i class="fas fa-credit-card"></i> Paiement</h3>' +
'<button class="btn-back" onclick="posGoToStep1()" style="font-size:'+(isMobile?'18px':'0.85rem')+';background:var(--bg-secondary);border:2px solid var(--border);border-radius:8px;padding:'+(isMobile?'6px 12px':'8px 16px')+';cursor:pointer;"><i class="fas fa-arrow-left"></i> Retour</button>' +
'</div>' +
'<div style="display:flex;flex-direction:column;gap:12px;flex:1;">' +
clientDisplay +
'<div style="display:flex;flex-direction:column;gap:6px;">' +
'<label style="font-weight:600;font-size:'+fontSize2+';">Remise (MAD)</label>' +
'<input type="number" id="posDiscountInput" value="'+posDiscountMAD+'" onchange="posUpdateDiscount(this.value)" style="padding:8px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:'+fontSize2+';width:100%;" min="0" step="0.01">' +
'</div>' +
'<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;border-top:2px solid var(--border);border-bottom:2px solid var(--border);">' +
'<span style="font-weight:700;font-size:'+fontSize+';">Total à payer:</span>' +
'<span style="font-weight:700;font-size:'+(isMobile?'26px':'1.4rem')+';color:#14B8A6;">'+t.toFixed(2)+' MAD</span>' +
'</div>' +
'<div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;">' +
'<button onclick="posSetPaymentMethod(\'espece\')" style="flex:1;min-width:80px;padding:'+(isMobile?'8px 4px':'10px')+';border:2px solid '+(posPaymentMethod==='espece'?'#14B8A6':'#e2e8f0')+';background:'+(posPaymentMethod==='espece'?'#f0fdf4':'#fff')+';border-radius:8px;cursor:pointer;font-weight:600;font-size:'+(isMobile?'16px':'0.9rem')+';">💵 Espèces</button>' +
'<button onclick="posSetPaymentMethod(\'carte\')" style="flex:1;min-width:80px;padding:'+(isMobile?'8px 4px':'10px')+';border:2px solid '+(posPaymentMethod==='carte'?'#14B8A6':'#e2e8f0')+';background:'+(posPaymentMethod==='carte'?'#f0fdf4':'#fff')+';border-radius:8px;cursor:pointer;font-weight:600;font-size:'+(isMobile?'16px':'0.9rem')+';">💳 Carte</button>' +
'<button onclick="posSetPaymentMethod(\'virement\')" style="flex:1;min-width:80px;padding:'+(isMobile?'8px 4px':'10px')+';border:2px solid '+(posPaymentMethod==='virement'?'#14B8A6':'#e2e8f0')+';background:'+(posPaymentMethod==='virement'?'#f0fdf4':'#fff')+';border-radius:8px;cursor:pointer;font-weight:600;font-size:'+(isMobile?'16px':'0.9rem')+';">🏦 Virement</button>' +
'<button id="posCreditBtn" onclick="posPayerAvecCredit()" style="flex:1;min-width:80px;padding:'+(isMobile?'8px 4px':'10px')+';border:2px solid '+(posPaymentMethod==='credit'?'#14B8A6':'#e2e8f0')+';background:'+(posPaymentMethod==='credit'?'#f0fdf4':'#fff')+';border-radius:8px;cursor:'+(posCurrentClient?'pointer':'not-allowed')+';opacity:'+(posCurrentClient?'1':'0.4')+';font-weight:600;font-size:'+(isMobile?'16px':'0.9rem')+';">💳 Crédit</button>' +
'<button id="posPartielBtn" onclick="posPaiementPartiel()" style="flex:1;min-width:80px;padding:'+(isMobile?'8px 4px':'10px')+';border:2px solid '+(posPaymentMethod==='partiel'?'#14B8A6':'#e2e8f0')+';background:'+(posPaymentMethod==='partiel'?'#f0fdf4':'#fff')+';border-radius:8px;cursor:'+(posCurrentClient?'pointer':'not-allowed')+';opacity:'+(posCurrentClient?'1':'0.4')+';font-weight:600;font-size:'+(isMobile?'16px':'0.9rem')+';">🔸 Partiel</button>' +
'</div>' +
'<div id="posCreditDisplay" style="font-size:28px;font-weight:700;text-align:center;display:none;"></div>' +
'<div style="display:flex;flex-direction:column;gap:6px;">' +
'<label style="font-weight:600;font-size:'+fontSize2+';">Montant reçu (MAD)</label>' +
'<input type="number" id="posAmountGiven" value="" onchange="posCalculateChange()" oninput="posCalculateChange()" style="padding:8px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:'+fontSize2+';width:100%;" min="0" step="0.01" placeholder="0.00">' +
'</div>' +
'<div style="display:flex;justify-content:space-between;padding:8px 4px;background:#f8fafc;border-radius:8px;">' +
'<span style="font-weight:600;font-size:'+fontSize2+';">Monnaie:</span>' +
'<span id="posChangeDisplay" style="font-weight:700;font-size:'+(isMobile?'24px':'1.2rem')+';color:#14B8A6;">0.00 MAD</span>' +
'</div>' +
'<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">' +
'<label style="font-weight:600;font-size:'+fontSize2+';">Notes / Référence</label>' +
'<input type="text" id="posPaymentNote" placeholder="Référence de paiement, note..." style="padding:8px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:'+fontSize2+';width:100%;">' +
'</div>' +
'<button onclick="posFinaliserVente()" style="width:100%;padding:16px;background:#14B8A6;color:#fff;border:none;border-radius:12px;font-size:'+(isMobile?'24px':'1.2rem')+';font-weight:700;cursor:'+(posCart.length>0?'pointer':'not-allowed')+';opacity:'+(posCart.length>0?'1':'0.5')+';margin-top:8px;flex-shrink:0;"><i class="fas fa-check"></i> Finaliser la vente</button>' +
'</div></div>';
return html;
}

function posSetupPaymentPanel() {
if (posCurrentClient && posCurrentClient.id) {
updateClientCreditDisplay(posCurrentClient.id);
}
var input = document.getElementById('posAmountGiven');
if (input && posAmountGiven > 0) {
input.value = posAmountGiven.toFixed(2);
posCalculateChange();
}
updatePaymentButtons();
}

function posUpdateDiscount(val) {
posDiscountMAD = parseFloat(val) || 0;
if (posDiscountMAD < 0) posDiscountMAD = 0;
var st = posCalculateTotal();
var t = st - posDiscountMAD;
if (t < 0) posDiscountMAD = st;
var tr = document.querySelector('.pos-cart-total-row span:last-child');
if (tr) {
var st2 = posCalculateTotal();
var t2 = st2 - posDiscountMAD;
tr.textContent = t2.toFixed(2) + ' MAD';
}
var totalDisplay = document.querySelector('.pos-payment-panel .pos-cart-total-row span:last-child');
if (totalDisplay) {
var st3 = posCalculateTotal();
var t3 = st3 - posDiscountMAD;
totalDisplay.textContent = t3.toFixed(2) + ' MAD';
}
posCalculateChange();
}

function posCalculateChange() {
var amountGiven = parseFloat(document.getElementById('posAmountGiven')?.value) || 0;
var st = posCalculateTotal();
var total = st - posDiscountMAD;
var change = amountGiven - total;
if (change < 0) change = 0;
var display = document.getElementById('posChangeDisplay');
if (display) display.textContent = change.toFixed(2) + ' MAD';
}

function posSetPaymentMethod(method) {
posPaymentMethod = method;
if (method === 'credit' && !posCurrentClient) {
alert('Veuillez sélectionner un client pour utiliser le crédit.');
posPaymentMethod = 'espece';
}
posSetupPaymentPanel();
}

function posPayerAvecCredit() {
if (!posCurrentClient) {
alert('Veuillez sélectionner un client.');
return;
}
var st = posCalculateTotal();
var total = st - posDiscountMAD;
if (total <= 0) {
alert('Montant invalide.');
return;
}
if (confirm('Payer ' + total.toFixed(2) + ' MAD avec le crédit du client ' + posCurrentClient.name + ' ?')) {
posPaymentMethod = 'credit';
posFinaliserVente();
}
}

function posPaiementPartiel() {
if (!posCurrentClient) {
alert('Veuillez sélectionner un client.');
return;
}
posPaymentMethod = 'partiel';
var input = document.getElementById('posAmountGiven');
if (input) input.focus();
alert('Mode paiement partiel activé. Entrez le montant reçu et finalisez.');
}

function posFinaliserVente() {
if (isFinalizing) return;
isFinalizing = true;
try {
if (posCart.length === 0) {
alert('Panier vide');
isFinalizing = false;
return;
}
var st = posCalculateTotal();
var total = st - posDiscountMAD;
if (total <= 0) {
alert('Le total doit être supérieur à 0');
isFinalizing = false;
return;
}
var amountGiven = parseFloat(document.getElementById('posAmountGiven')?.value) || 0;
var note = document.getElementById('posPaymentNote')?.value || '';
if (posPaymentMethod === 'credit') {
if (!posCurrentClient) {
alert('Client requis pour le crédit');
isFinalizing = false;
return;
}
if (confirm('Confirmer le paiement par crédit de ' + total.toFixed(2) + ' MAD pour ' + posCurrentClient.name + ' ?')) {
enregistrerVente('credit', total, 0, note);
}
} else if (posPaymentMethod === 'partiel') {
if (!posCurrentClient) {
alert('Client requis pour le paiement partiel');
isFinalizing = false;
return;
}
if (amountGiven <= 0) {
alert('Entrez un montant reçu valide');
isFinalizing = false;
return;
}
var restant = total - amountGiven;
if (restant < 0) {
alert('Le montant reçu ne peut pas dépasser le total.');
isFinalizing = false;
return;
}
var conf = confirm('Paiement partiel de ' + amountGiven.toFixed(2) + ' MAD, reste ' + restant.toFixed(2) + ' MAD à payer pour ' + posCurrentClient.name + ' ?');
if (conf) {
enregistrerVentePartielle('partiel', amountGiven, restant, note);
}
} else {
if (amountGiven < total) {
alert('Le montant reçu est insuffisant. Total: ' + total.toFixed(2) + ' MAD, reçu: ' + amountGiven.toFixed(2) + ' MAD');
isFinalizing = false;
return;
}
if (confirm('Confirmer la vente de ' + total.toFixed(2) + ' MAD ?')) {
enregistrerVente(posPaymentMethod, total, amountGiven - total, note);
}
}
} catch(e) {
console.error('Erreur finalisation:', e);
alert('Erreur lors de la finalisation: ' + e.message);
isFinalizing = false;
}
}

function enregistrerVente(method, total, change, note) {
var items = posCart.map(function(item) {
return {
id: item.id,
nom: item.nom,
prixUnitaire: item.prixUnitaire,
quantite: item.quantite,
prixAchat: item.prixAchat || 0,
prixPromo: item.prixPromo || 0,
prixVente: item.prixVente || item.prixUnitaire,
categorie: item.categorie || '',
imageBase64: item.imageBase64 || '',
sauces: item.sauces || [],
interdits: item.interdits || [],
epice: item.epice || 'Normal',
sel: item.sel || 'Normal',
ingredientsExclus: item.ingredientsExclus || []
};
});
var venteData = {
items: items,
total: total,
discount: posDiscountMAD,
method: method,
change: change || 0,
note: note || '',
clientId: posCurrentClient ? posCurrentClient.id : null,
clientName: posCurrentClient ? posCurrentClient.name : null,
table: posCurrentTable || '',
createdAt: firebase.firestore.FieldValue.serverTimestamp(),
facture: getNextFactureNum()
};
console.log('Vente:', venteData);
posResetCart();
posGoToStep1();
alert('✅ Vente enregistrée ! ' + (change > 0 ? 'Monnaie: ' + change.toFixed(2) + ' MAD' : ''));
isFinalizing = false;
}

function enregistrerVentePartielle(method, amountReceived, remaining, note) {
var items = posCart.map(function(item) {
return {
id: item.id,
nom: item.nom,
prixUnitaire: item.prixUnitaire,
quantite: item.quantite,
prixAchat: item.prixAchat || 0,
prixPromo: item.prixPromo || 0,
prixVente: item.prixVente || item.prixUnitaire,
categorie: item.categorie || '',
imageBase64: item.imageBase64 || '',
sauces: item.sauces || [],
interdits: item.interdits || [],
epice: item.epice || 'Normal',
sel: item.sel || 'Normal',
ingredientsExclus: item.ingredientsExclus || []
};
});
var venteData = {
items: items,
total: posCalculateTotal() - posDiscountMAD,
amountReceived: amountReceived,
remaining: remaining,
discount: posDiscountMAD,
method: method,
note: note || '',
clientId: posCurrentClient ? posCurrentClient.id : null,
clientName: posCurrentClient ? posCurrentClient.name : null,
table: posCurrentTable || '',
createdAt: firebase.firestore.FieldValue.serverTimestamp(),
facture: getNextFactureNum()
};
console.log('Vente partielle:', venteData);
if (remaining > 0) {
var creditData = {
clientId: posCurrentClient.id,
clientName: posCurrentClient.name,
amount: remaining,
reason: 'Paiement partiel - ' + (note || ''),
createdAt: firebase.firestore.FieldValue.serverTimestamp(),
paid: false,
total: remaining,
remainingAmount: remaining
};
db.collection('credits').add(creditData).then(function(docRef) {
console.log('Crédit créé:', docRef.id);
alert('✅ Paiement partiel enregistré. Reste ' + remaining.toFixed(2) + ' MAD en crédit.');
posResetCart();
posGoToStep1();
isFinalizing = false;
}).catch(function(err) {
console.error('Erreur création crédit:', err);
alert('⚠️ Erreur: ' + err.message);
isFinalizing = false;
});
} else {
alert('✅ Paiement partiel enregistré (solde réglé).');
posResetCart();
posGoToStep1();
isFinalizing = false;
}
}

function posCalculateTotal() {
var total = 0;
for (var i = 0; i < posCart.length; i++) {
total += posCart[i].prixUnitaire * posCart[i].quantite;
}
return total;
}

function posUpdateQty(index, delta) {
if (index < 0 || index >= posCart.length) return;
var item = posCart[index];
var newQty = item.quantite + delta;
if (newQty <= 0) {
posCart.splice(index, 1);
} else {
var p = posProductsList.find(function(x) { return x.id === item.id; });
if (p && p.stock !== undefined && newQty > p.stock) {
alert('Stock insuffisant. Disponible: ' + p.stock);
return;
}
item.quantite = newQty;
}
updateCartOnly();
renderPOS();
}

function posRemoveItem(index) {
if (index < 0 || index >= posCart.length) return;
posCart.splice(index, 1);
updateCartOnly();
renderPOS();
}

function posResetCart() {
posCart = [];
posCurrentClient = null;
posCurrentTable = '';
posDiscountMAD = 0;
posAmountGiven = 0;
posPaymentMethod = 'espece';
clientCreditsCache = {};
var creditDisplay = document.getElementById('clientCreditDisplay');
if (creditDisplay) creditDisplay.style.display = 'none';
if (isOnPOSPage()) renderPOS();
}

function posGoToStep1() {
posStep = 1;
posAmountGiven = 0;
var input = document.getElementById('posAmountGiven');
if (input) input.value = '';
var changeDisplay = document.getElementById('posChangeDisplay');
if (changeDisplay) changeDisplay.textContent = '0.00 MAD';
if (isOnPOSPage()) renderPOS();
}

function posGoToStep2() {
if (posCart.length === 0) {
alert('Panier vide');
return;
}
posStep = 2;
if (isOnPOSPage()) renderPOS();
setTimeout(function() {
posSetupPaymentPanel();
}, 100);
}

function posNaviguerEtape(step) {
if (step === 1) {
posGoToStep1();
} else if (step === 2) {
posGoToStep2();
}
}

function posFilterCategory(cat) {
posSelectedCategory = cat;
posViewMode = 'products';
posSelectedCategoryForView = cat === 'all' ? null : cat;
posProductOffset = 0;
posSearchQuery = '';
var searchInput = document.getElementById('posSearchInput');
if (searchInput) searchInput.value = '';
if (isOnPOSPage()) filterProductGrid();
var catBtns = document.querySelectorAll('.pos-cat-btn');
catBtns.forEach(function(btn) {
btn.classList.remove('active');
if (btn.textContent.trim() === cat || (cat === 'all' && btn.textContent.trim() === '📋 Tous')) {
btn.classList.add('active');
}
});
}

function updateClearButtonVisibility() {
var input = document.getElementById('posSearchInput');
var btn = document.getElementById('posSearchClearBtn');
if (input && btn) {
btn.style.display = (input.value && input.value.length > 0) ? 'flex' : 'none';
}
}

async function posChargerCommandesTables() {
try {
var snapshot = await db.collection('commandesTables').where('statut', '==', 'en_cours').get();
posCommandesTables = [];
snapshot.forEach(function(doc) {
var data = doc.data();
data.id = doc.id;
posCommandesTables.push(data);
});
posCommandesTablesCount = posCommandesTables.length;
} catch(e) {
console.error('Erreur chargement commandes tables:', e);
}
}

async function posChargerCommandesEnLigneCount() {
try {
var snapshot = await db.collection('commandes').where('statut', '==', 'nouvelle').get();
posCommandesEnLigneCount = snapshot.size;
} catch(e) {
console.error('Erreur chargement commandes en ligne:', e);
}
}

function posAfficherCommandesTables() {
if (posCommandesTables.length === 0) {
alert('Aucune commande table en cours.');
return;
}
var msg = '🍽️ Commandes tables en cours:\n\n';
posCommandesTables.forEach(function(cmd) {
msg += 'Table ' + (cmd.table || '?') + ' - ' + (cmd.items ? cmd.items.length : 0) + ' articles\n';
});
alert(msg);
}

function posToggleVoiceSearch() {
if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
alert('Votre navigateur ne supporte pas la reconnaissance vocale.');
return;
}
var recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'fr-FR';
recognition.continuous = false;
recognition.interimResults = false;
recognition.onresult = function(event) {
var transcript = event.results[0][0].transcript;
var input = document.getElementById('posSearchInput');
if (input) {
input.value = transcript;
posSearchProducts(transcript);
}
};
recognition.start();
}

console.log('✅ POS.js chargé - Layout corrigé: Panier à droite, outils masqués par défaut');
