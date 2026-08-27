// ==================== POS.JS - VERSION AVEC PANIER EN DESSOUS ====================
// ✅ Panier en dessous des produits (scroll vers le bas)
// ✅ Page plus grande pour voir tout le contenu
// ✅ Panier bien organisé avec colonnes
// ✅ Tout le reste inchangé

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
var posToolsVisible = false;

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
if (btn) {
btn.style.display = visible ? 'block' : 'none';
}
}

function posToggleTools() {
    posToolsVisible = !posToolsVisible;
    var toolsContainer = document.getElementById('posToolsContainer');
    var toggleBtn = document.getElementById('posToggleToolsBtn');
    if (toolsContainer) {
        toolsContainer.style.display = posToolsVisible ? 'flex' : 'none';
    }
    if (toggleBtn) {
        toggleBtn.innerHTML = posToolsVisible ? '✕ Masquer tout' : '🔍 Afficher tout';
        toggleBtn.style.background = posToolsVisible ? '#ef4444' : '#14B8A6';
    }
}

function applyDynamicContentScroll() {
    var container = document.getElementById('dynamicContent');
    if (container) {
        container.style.overflowY = 'auto';
        container.style.overflowX = 'hidden';
        container.style.height = '100vh';
        container.style.maxHeight = '100vh';
        container.style.paddingBottom = '30px';
        container.style.position = 'relative';
    }
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
    applyDynamicContentScroll();
    
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
    var gridCols = isMobile ? 'repeat(5, 1fr)' : 'repeat(auto-fill, minmax(100px, 1fr))';
    grid.style.gridTemplateColumns = gridCols;
    grid.style.overflowX = 'hidden';
    grid.style.overflowY = 'auto';
    grid.style.flexWrap = 'wrap';
    grid.style.alignContent = 'start';

    var html = '';

    html += '<div style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;padding:2px 6px;margin-bottom:2px;background:var(--bg-page);border-radius:6px;">';
    html += '<button onclick="retournerCategories()" style="display:flex;align-items:center;gap:4px;background:var(--black);color:var(--white);border:none;border-radius:6px;padding:4px 10px;font-size:0.7rem;font-weight:600;cursor:pointer;">';
    html += '<i class="fas fa-arrow-left"></i> Retour';
    html += '</button>';
    if (posSelectedCategoryForView) {
        html += '<span style="font-weight:700;font-size:0.8rem;color:var(--text-primary);">📂 ' + escapeHtml(posSelectedCategoryForView) + '</span>';
    }
    html += '</div>';

    if(totalProducts === 0){
        html += '<div style="grid-column:1/-1;text-align:center;padding:30px 10px;">';
        html += '<i class="fas fa-search" style="font-size:2rem;color:#94a3b8;"></i>';
        html += '<p style="color:#94a3b8;margin-top:8px;">Aucun produit dans cette catégorie</p>';
        html += '</div>';
    } else {
        if(posSearchQuery) {
            html += '<div style="grid-column:1/-1;padding:2px 6px;font-size:0.65rem;color:#94a3b8;">' + totalProducts + ' résultat' + (totalProducts>1?'s':'') + '</div>';
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
                'padding:3px 2px;min-height:85px;max-height:110px;aspect-ratio:1/1;border-radius:6px;border-width:1px;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;' : 
                'padding:4px 4px;min-height:100px;max-height:130px;aspect-ratio:1/1;border-radius:8px;border-width:2px;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;';
            
            var imgStyle = isMobile ? 
                'height:40px;width:40px;margin-bottom:3px;border-radius:6px;overflow:hidden;flex-shrink:0;background:var(--gray-200);display:flex;align-items:center;justify-content:center;' : 
                'height:55px;width:55px;margin-bottom:3px;border-radius:8px;overflow:hidden;flex-shrink:0;background:var(--gray-200);display:flex;align-items:center;justify-content:center;';
            
            var nameStyle = isMobile ? 
                'font-size:7px !important;font-weight:600 !important;line-height:1.2;text-align:center;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:var(--text-primary);margin:1px 0;' : 
                'font-size:0.6rem !important;font-weight:600 !important;line-height:1.2;text-align:center;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:var(--text-primary);margin:1px 0;';
            
            var priceStyle = isMobile ? 
                'font-size:7px !important;font-weight:700 !important;color:var(--text-primary);' : 
                'font-size:0.65rem !important;font-weight:700 !important;color:var(--text-primary);';

            var imgContent = '';
            if (p.imageBase64) {
                imgContent = '<img src="' + escapeHtml(p.imageBase64) + '" loading="lazy" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">';
            } else {
                imgContent = '<i class="fas fa-box" style="' + (isMobile ? 'font-size:14px;color:var(--text-muted);' : 'font-size:20px;color:var(--text-muted);') + '"></i>';
            }

            html += '<div class="pos-product-card ' + sc + '" style="' + cardStyle + '" onclick="posAddToCartOrOpenOptions(\'' + p.id + '\')">' +
                '<div class="pos-product-img" style="' + imgStyle + '">' + imgContent + '</div>' +
                '<div class="pos-product-info" style="display:flex;flex-direction:column;align-items:center;width:100%;flex:1;justify-content:center;overflow:hidden;min-height:0;">' +
                '<span class="pos-product-name" style="' + nameStyle + '">' + dn + stt + '</span>' +
                '<span class="pos-product-price" style="' + priceStyle + '">' + 
                    (hp ? '<span class="pos-old-price" style="' + (isMobile ? 'font-size:5px;' : 'font-size:0.45rem;') + 'text-decoration:line-through;color:var(--text-muted);">' + p.prixVente.toFixed(2) + '</span> <span class="pos-promo-price" style="' + (isMobile ? 'font-size:7px;color:var(--danger);' : 'font-size:0.6rem;color:var(--danger);') + '">' + pr.toFixed(2) + ' MAD</span>' : pr.toFixed(2) + ' MAD') +
                '</span>' +
                '</div>' +
                '</div>'; 
        }
        
        if(posHasMoreProducts){ 
            html += '<div style="grid-column:1/-1;text-align:center;padding:4px;">' +
                '<button class="btn-add" onclick="loadMoreProducts()" style="font-size:0.6rem;padding:3px 10px;">Afficher plus (' + (totalProducts - displayProducts.length) + ')</button>' +
                '</div>'; 
        }
    }
    grid.innerHTML = html;
    updateClearButtonVisibility();
}

function afficherCategories(grid) {
    var isMobile = window.innerWidth < 700;
    var gridCols = isMobile ? 'repeat(5, 1fr)' : 'repeat(auto-fill, minmax(100px, 1fr))';
    grid.style.gridTemplateColumns = gridCols;
    grid.style.overflowX = 'hidden';
    grid.style.overflowY = 'auto';
    grid.style.flexWrap = 'wrap';
    grid.style.alignContent = 'start';
    grid.style.gap = isMobile ? '4px' : '5px';
    grid.style.padding = isMobile ? '2px' : '3px';

    var html = '';
    
    html += '<div style="grid-column:1/-1;padding:2px 6px;font-size:0.7rem;font-weight:700;color:var(--text-primary);">';
    html += '📂 Choisissez une catégorie';
    html += '</div>';

    if (posCategoriesList.length === 0) {
        html += '<div style="grid-column:1/-1;text-align:center;padding:30px 10px;">';
        html += '<i class="fas fa-folder-open" style="font-size:2rem;color:#94a3b8;"></i>';
        html += '<p style="color:#94a3b8;margin-top:8px;">Aucune catégorie disponible</p>';
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
                'padding:3px 2px;min-height:85px;max-height:110px;aspect-ratio:1/1;border-radius:6px;border-width:1px;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;' : 
                'padding:4px 4px;min-height:100px;max-height:130px;aspect-ratio:1/1;border-radius:8px;border-width:2px;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;';
            
            var imgSize = isMobile ? '40px' : '55px';
            var imgStyle = 'width:'+imgSize+';height:'+imgSize+';border-radius:50%;margin-bottom:3px;overflow:hidden;flex-shrink:0;background:var(--gray-100);display:flex;align-items:center;justify-content:center;';
            
            var nameSize = isMobile ? '7px' : '0.6rem';
            var nameStyle = 'font-size:'+nameSize+' !important;font-weight:600 !important;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;color:var(--text-primary);margin-top:1px;display:block;';
            
            var countSize = isMobile ? '6px' : '0.45rem';
            var countStyle = 'font-size:'+countSize+' !important;color:var(--text-muted);font-weight:500;display:block;margin-top:1px;';

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
                imgContent = '<i class="fas fa-folder" style="font-size:' + (isMobile ? '14px' : '20px') + ';color:var(--accent);"></i>';
            }

            html += '<div class="pos-category-card" style="' + cardStyle + 'background:var(--bg-page);border:2px solid var(--border);cursor:pointer;transition:var(--transition);" onclick="selectionnerCategorie(\'' + escapeHtml(cat.nom).replace(/'/g, "\\'") + '\')">' +
                '<div style="' + imgStyle + '">' + imgContent + '</div>' +
                '<span style="' + nameStyle + '">' + escapeHtml(cat.nom) + '</span>' +
                '<span style="' + countStyle + '">' + count + '</span>' +
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
html='<div class="pos-cart-empty" style="text-align:center;padding:15px 10px;color:#94a3b8;"><i class="fas fa-shopping-basket" style="font-size:28px;"></i><p style="font-size:0.9rem;">Panier vide</p></div>';
} else {
var isMobile = window.innerWidth < 700;

// ✅ PANIER BIEN ORGANISÉ AVEC COLONNES
html += '<div style="display:grid;grid-template-columns:1fr 80px 30px;gap:4px;padding:4px 6px;font-weight:700;font-size:0.6rem;color:var(--text-muted);border-bottom:2px solid var(--border);">';
html += '<span>Article</span>';
html += '<span style="text-align:center;">Qté</span>';
html += '<span style="text-align:right;">Total</span>';
html += '</div>';

for(var k=0;k<posCart.length;k++){
var it=posCart[k],opts='';
if(it.interdits&&it.interdits.length) opts+=' <span style="color:#ef4444;font-size:0.3rem;">🚫'+escapeHtml(it.interdits.join(','))+'</span>';
if(it.epice&&it.epice!=='Normal') opts+=' <span style="color:#d97706;font-size:0.3rem;">🌶️'+escapeHtml(it.epice)+'</span>';
if(it.sel&&it.sel!=='Normal') opts+=' <span style="color:#4f46e5;font-size:0.3rem;">🧂'+escapeHtml(it.sel)+'</span>';

html+='<div class="pos-cart-item" style="display:grid;grid-template-columns:1fr 80px 30px;gap:4px;align-items:center;padding:3px 0;border-bottom:1px solid var(--border);font-size:0.55rem;">' +
'<div style="display:flex;flex-direction:column;overflow:hidden;min-width:0;">' +
'<span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escapeHtml(it.nom)+opts+'</span>' +
'<span style="color:var(--text-secondary);font-size:0.45rem;">'+it.prixUnitaire.toFixed(2)+' MAD</span>' +
'</div>' +
'<div style="display:flex;align-items:center;justify-content:center;gap:4px;">' +
'<button class="pos-qty-btn" onclick="posUpdateQty('+k+',-1)" style="width:22px;height:22px;border-radius:50%;border:2px solid var(--border);background:var(--white);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.5rem;transition:all 0.2s;"><i class="fas fa-minus"></i></button>' +
'<span style="font-weight:700;min-width:20px;text-align:center;font-size:0.55rem;">'+it.quantite+'</span>' +
'<button class="pos-qty-btn" onclick="posUpdateQty('+k+',1)" style="width:22px;height:22px;border-radius:50%;border:2px solid var(--border);background:var(--white);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.5rem;transition:all 0.2s;"><i class="fas fa-plus"></i></button>' +
'</div>' +
'<div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;">' +
'<span style="font-weight:700;font-size:0.55rem;">'+(it.prixUnitaire*it.quantite).toFixed(2)+' MAD</span>' +
'<button class="pos-remove-btn" onclick="posRemoveItem('+k+')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:2px;font-size:0.7rem;transition:all 0.2s;"><i class="fas fa-times"></i></button>' +
'</div>' +
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
vb.style.height = '44px';
vb.style.fontSize = '20px';
vb.style.fontWeight = '700';
vb.style.padding = '10px';
vb.style.borderRadius = '8px';
vb.style.background = '#14B8A6';
vb.style.color = '#fff';
vb.style.border = 'none';
vb.style.cursor = 'pointer';
vb.style.transition = 'all 0.2s';
}
}

function getNextFactureNum(){ factureCounter=parseInt(localStorage.getItem('factureCounter'))||0; factureCounter++; localStorage.setItem('factureCounter',factureCounter); return 'FACT-'+new Date().getFullYear()+'-'+String(factureCounter).padStart(5,'0'); }

function renderPOS(){
    applyDynamicContentScroll();
    
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

// ==================== buildFullPOS - PANIER EN DESSOUS (SCROLL) ====================
function buildFullPOS(c){
if(posProductsList.length===0&&posCategoriesList.length===0){ c.innerHTML='<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#14B8A6;"></i><p>Chargement...</p></div>'; return; }
var st=posCalculateTotal(),t=st-posDiscountMAD;
var isMobile = window.innerWidth < 700;
var productPanelStyle = posStep===2 ? ' style="display:none;"' : '';

var stepSize = isMobile ? '16px' : '18px';
var stepNumberSize = isMobile ? '16px' : '18px';
var stepNumberSize2 = isMobile ? '20px' : '24px';
var stepGap = isMobile ? '6px' : '10px';

var stepIndicator = '<div class="pos-steps-nav" style="display:flex; justify-content:center; gap:'+stepGap+'; margin-bottom:4px; padding:4px 10px; background:var(--bg-card); border-radius:var(--radius-xl); box-shadow:var(--shadow-xs); border:1px solid var(--border);">' +
'<div class="pos-step ' + (posStep === 1 ? 'active' : '') + '" style="display:flex; align-items:center; gap:3px; font-size:'+stepSize+'; font-weight:600; color:' + (posStep === 1 ? 'var(--text-primary)' : 'var(--text-muted)') + '; cursor:pointer; padding:4px 10px; border-radius:var(--radius); transition:var(--transition);" onclick="posNaviguerEtape(1)">' +
'<span class="step-number" style="display:inline-flex; align-items:center; justify-content:center; width:'+stepNumberSize2+'; height:'+stepNumberSize2+'; border-radius:50%; background:' + (posStep === 1 ? 'var(--accent)' : 'var(--gray-200)') + '; color:' + (posStep === 1 ? '#fff' : 'var(--text-muted)') + '; font-size:'+stepNumberSize+'; font-weight:700;">1</span>' +
'<span style="font-size:'+stepSize+'; font-weight:600;">🛒 Panier</span>' +
'</div>' +
'<div class="pos-step ' + (posStep === 2 ? 'active' : '') + '" style="display:flex; align-items:center; gap:3px; font-size:'+stepSize+'; font-weight:600; color:' + (posStep === 2 ? 'var(--text-primary)' : 'var(--text-muted)') + '; cursor:pointer; padding:4px 10px; border-radius:var(--radius); transition:var(--transition);" onclick="posNaviguerEtape(2)">' +
'<span class="step-number" style="display:inline-flex; align-items:center; justify-content:center; width:'+stepNumberSize2+'; height:'+stepNumberSize2+'; border-radius:50%; background:' + (posStep === 2 ? 'var(--accent)' : 'var(--gray-200)') + '; color:' + (posStep === 2 ? '#fff' : 'var(--text-muted)') + '; font-size:'+stepNumberSize+'; font-weight:700;">2</span>' +
'<span style="font-size:'+stepSize+'; font-weight:600;">💳 Paiement</span>' +
'</div>' +
'</div>';

var productPanelDisplay = (posStep === 2) ? 'display:none;' : '';

// ✅ PAGE PLUS GRANDE - PANIER EN DESSOUS
var gridCols = isMobile ? 'repeat(5, 1fr)' : 'repeat(auto-fill, minmax(100px, 1fr))';
var gridGap = isMobile ? '3px' : '4px';
var gridPadding = isMobile ? '2px' : '2px';
var panelPadding = isMobile ? '4px' : '6px';

var h='<div class="pos-container" style="display:flex;flex-direction:column;gap:4px;padding-bottom:20px;">' +
stepIndicator +

// ===== PANEL PRODUITS =====
'<div class="pos-products-panel" style="' + productPanelDisplay + ' padding:'+panelPadding+'; width:100%; background:var(--bg-card); border-radius:var(--radius-xl); box-shadow:var(--shadow-xs); border:1px solid var(--border); display:flex; flex-direction:column; overflow:hidden; min-height:300px;">' +

'<div style="display:flex;flex-direction:column;gap:3px;margin-bottom:3px;flex-shrink:0;">' +
'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1px;">' +
'<button id="posToggleToolsBtn" onclick="posToggleTools()" style="background:#14B8A6;color:#fff;border:none;border-radius:4px;padding:4px 12px;font-size:0.6rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:3px;">🔍 Afficher tout</button>' +
'<span style="font-size:0.55rem;color:#94a3b8;">' + posProductsList.length + ' produits</span>' +
'</div>' +

'<div id="posToolsContainer" style="display:none;flex-direction:column;gap:3px;margin-bottom:2px;padding:3px 4px;background:var(--bg-page);border-radius:4px;border:1px solid var(--border);">' +

'<div style="display:flex;align-items:center;gap:3px;flex-wrap:wrap;">' +
'<div style="flex:1;min-width:60px;display:flex;align-items:center;background:#fff;border:2px solid #e2e8f0;border-radius:30px;padding:1px 5px;position:relative;height:'+(isMobile?'26px':'30px')+';">' +
'<i class="fas fa-search" style="color:#94a3b8;margin-right:2px;font-size:'+(isMobile?'10px':'12px')+';"></i>' +
'<input type="text" id="posSearchInput" placeholder="🔍 Rechercher..." value="'+escapeHtml(posSearchQuery)+'" onkeyup="posSearchProducts(this.value); updateClearButtonVisibility();" oninput="updateClearButtonVisibility();" style="border:none;outline:none;padding:0;width:100%;background:transparent;font-size:'+(isMobile?'11px':'14px')+';padding-right:20px;height:'+(isMobile?'26px':'30px')+';">' +
'<button id="posSearchClearBtn" onclick="clearPosSearch()" style="display:'+(posSearchQuery ? 'flex' : 'none')+';position:absolute;right:3px;background:none;border:none;cursor:pointer;padding:1px;color:#94a3b8;font-size:'+(isMobile?'12px':'14px')+';align-items:center;justify-content:center;"><i class="fas fa-times-circle"></i></button>' +
'</div>' +
'<button id="posMicBtn" title="Micro" style="background:#dcfce7;border:2px solid #14B8A6;border-radius:50%;width:'+(isMobile?'26px':'30px')+';height:'+(isMobile?'26px':'30px')+';cursor:pointer;font-size:'+(isMobile?'10px':'12px')+';" onclick="posToggleVoiceSearch()"><i class="fas fa-microphone"></i></button>' +
'<div style="display:flex;gap:2px;"><button onclick="posAfficherCommandesTables()" style="background:#fff;border:2px solid #e2e8f0;border-radius:50px;padding:2px 5px;font-weight:600;font-size:'+(isMobile?'0.35rem':'0.45rem')+';">🍽️ Tables <span style="background:#ef4444;color:#fff;border-radius:20px;padding:1px 3px;font-size:'+(isMobile?'0.3rem':'0.35rem')+';">'+posCommandesTablesCount+'</span></button><button onclick="navigateTo(\'commandes\')" style="background:#fff;border:2px solid #e2e8f0;border-radius:50px;padding:2px 5px;font-weight:600;font-size:'+(isMobile?'0.35rem':'0.45rem')+';">🌐 En ligne <span style="background:#ef4444;color:#fff;border-radius:20px;padding:1px 3px;font-size:'+(isMobile?'0.3rem':'0.35rem')+';">'+posCommandesEnLigneCount+'</span></button></div>' +
'</div>' +

'<div class="pos-categories-bar" style="display:flex;flex-wrap:wrap;gap:2px;">' +
'<button class="pos-cat-btn '+(posSelectedCategory==='all'?'active':'')+'" onclick="posFilterCategory(\'all\')" style="padding:'+(isMobile?'2px 5px':'3px 8px')+';font-size:'+(isMobile?'8px':'0.55rem')+';gap:'+(isMobile?'2px':'3px')+';border-radius:14px;border:2px solid '+(posSelectedCategory==='all'?'#14B8A6':'#e2e8f0')+';background:'+(posSelectedCategory==='all'?'#f0fdf4':'#fff')+';cursor:pointer;font-weight:600;transition:all 0.2s;">📋 Tous</button>';
var sortedCategories = posCategoriesList.slice().sort(function(a, b) {
var ordreA = (a.ordre !== undefined && a.ordre !== null) ? parseInt(a.ordre) : 9999;
var ordreB = (b.ordre !== undefined && b.ordre !== null) ? parseInt(b.ordre) : 9999;
if (ordreA !== ordreB) return ordreA - ordreB;
return (a.nom || '').localeCompare(b.nom || '');
});
for(var i=0;i<sortedCategories.length;i++){
var ca = sortedCategories[i];
var ac = posSelectedCategory===ca.nom?'active':'';
var ih = ca.imageBase64?'<img src="'+escapeHtml(ca.imageBase64)+'" loading="lazy" style="max-width:16px;max-height:16px;border-radius:3px;">':'<i class="fas fa-folder" style="font-size:'+(isMobile?'8px':'10px')+';"></i>';
h+='<button class="pos-cat-btn '+ac+'" onclick="posFilterCategory(\''+escapeHtml(ca.nom).replace(/'/g,"\\'")+'\')" style="padding:'+(isMobile?'2px 5px':'3px 8px')+';font-size:'+(isMobile?'8px':'0.55rem')+';gap:'+(isMobile?'2px':'3px')+';border-radius:14px;border:2px solid '+(posSelectedCategory===ca.nom?'#14B8A6':'#e2e8f0')+';background:'+(posSelectedCategory===ca.nom?'#f0fdf4':'#fff')+';cursor:pointer;font-weight:600;transition:all 0.2s;display:flex;align-items:center;">'+ih+' '+escapeHtml(ca.nom)+'</button>';
}
h+='</div>';
h+='</div>'; // Fin tools container
h+='</div>' +

'<div class="pos-products-grid" id="posProductGrid" style="grid-template-columns:'+gridCols+';gap:'+gridGap+';padding:'+gridPadding+';overflow-x:hidden;overflow-y:auto;flex-wrap:wrap;align-content:start;flex:1;max-height:400px;"></div>' +
'</div>' +

// ===== PANIER EN DESSOUS =====
'<div class="pos-cart-panel" style="width:100%;background:var(--bg-card);border-radius:var(--radius-xl);box-shadow:var(--shadow-xs);border:1px solid var(--border);display:flex;flex-direction:column;margin-top:6px;">';

if(posStep===1){
h+='<div class="pos-cart-header" style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:1px solid var(--border);flex-shrink:0;">' +
'<h3 style="font-size:0.8rem;"><i class="fas fa-shopping-cart"></i> Panier <span class="pos-cart-badge" style="background:#14B8A6;color:#fff;border-radius:50%;padding:1px 6px;font-size:0.55rem;">'+posCart.length+'</span></h3>' +
'<button class="pos-clear-btn" onclick="posResetCart()" style="font-size:0.6rem;background:#ef4444;color:#fff;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;"><i class="fas fa-trash-alt"></i> Vider</button>' +
'</div>' +

'<div class="pos-cart-items" style="padding:4px 6px;max-height:250px;overflow-y:auto;">';
if(posCart.length===0){ 
h+='<div class="pos-cart-empty" style="text-align:center;padding:15px 10px;color:#94a3b8;"><i class="fas fa-shopping-basket" style="font-size:22px;"></i><p style="font-size:0.7rem;">Panier vide</p></div>'; 
} else {
// ✅ PANIER ORGANISÉ AVEC COLONNES
h+='<div style="display:grid;grid-template-columns:1fr 80px 80px;gap:4px;padding:3px 0;font-weight:700;font-size:0.55rem;color:var(--text-muted);border-bottom:2px solid var(--border);">';
h+='<span>Article</span>';
h+='<span style="text-align:center;">Qté</span>';
h+='<span style="text-align:right;">Total</span>';
h+='</div>';

for(var k=0;k<posCart.length;k++){
var it=posCart[k],opts='';
if(it.interdits&&it.interdits.length) opts+=' <span style="color:#ef4444;font-size:0.25rem;">🚫'+escapeHtml(it.interdits.join(','))+'</span>';
if(it.epice&&it.epice!=='Normal') opts+=' <span style="color:#d97706;font-size:0.25rem;">🌶️'+escapeHtml(it.epice)+'</span>';
if(it.sel&&it.sel!=='Normal') opts+=' <span style="color:#4f46e5;font-size:0.25rem;">🧂'+escapeHtml(it.sel)+'</span>';

h+='<div style="display:grid;grid-template-columns:1fr 80px 80px;gap:4px;align-items:center;padding:3px 0;border-bottom:1px solid var(--border);font-size:0.5rem;">' +
'<div style="display:flex;flex-direction:column;overflow:hidden;">' +
'<span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.5rem;">'+escapeHtml(it.nom)+opts+'</span>' +
'<span style="color:var(--text-secondary);font-size:0.4rem;">'+it.prixUnitaire.toFixed(2)+' MAD</span>' +
'</div>' +
'<div style="display:flex;align-items:center;justify-content:center;gap:3px;">' +
'<button onclick="posUpdateQty('+k+',-1)" style="width:20px;height:20px;border-radius:50%;border:2px solid var(--border);background:var(--white);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.4rem;transition:all 0.2s;"><i class="fas fa-minus"></i></button>' +
'<span style="font-weight:700;min-width:18px;text-align:center;font-size:0.5rem;">'+it.quantite+'</span>' +
'<button onclick="posUpdateQty('+k+',1)" style="width:20px;height:20px;border-radius:50%;border:2px solid var(--border);background:var(--white);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.4rem;transition:all 0.2s;"><i class="fas fa-plus"></i></button>' +
'</div>' +
'<div style="display:flex;align-items:center;justify-content:flex-end;gap:3px;">' +
'<span style="font-weight:700;font-size:0.5rem;">'+(it.prixUnitaire*it.quantite).toFixed(2)+' MAD</span>' +
'<button onclick="posRemoveItem('+k+')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:1px;font-size:0.6rem;transition:all 0.2s;"><i class="fas fa-times"></i></button>' +
'</div>' +
'</div>';
}
}
h+='</div>' +

'<div style="padding:4px 8px;display:flex;gap:4px;align-items:center;flex-shrink:0;border-top:1px solid var(--border);">' +
'<label style="font-size:0.55rem;font-weight:600;">Remise:</label>' +
'<input type="number" id="posDiscountMAD" value="'+posDiscountMAD+'" min="0" step="0.01" onchange="posUpdateDiscountMAD(this.value)" style="width:50px;padding:2px 4px;border:2px solid #e2e8f0;border-radius:4px;font-size:0.55rem;">' +
'</div>' +

'<div class="pos-cart-footer" style="padding:4px 8px;flex-shrink:0;border-top:1px solid var(--border);">' +
(posDiscountMAD>0?'<div style="display:flex;justify-content:space-between;font-size:0.6rem;"><span>Sous-total</span><span>'+st.toFixed(2)+' MAD</span></div><div style="display:flex;justify-content:space-between;color:#ef4444;font-size:0.6rem;"><span>Remise</span><span>-'+posDiscountMAD.toFixed(2)+' MAD</span></div>':'') +
'<div class="pos-cart-total-row" style="display:flex;justify-content:space-between;font-size:1rem;font-weight:700;padding:4px 0;"><span>Total</span><span style="color:#14B8A6;">'+t.toFixed(2)+' MAD</span></div>' +
'<button class="pos-validate-btn" onclick="posGoToStep2()" '+(posCart.length===0?'disabled':'')+' style="width:100%;padding:10px;background:#14B8A6;color:#fff;border:none;border-radius:8px;font-size:18px;font-weight:700;height:44px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:4px;"><i class="fas fa-check-circle"></i> Valider le panier</button>' +
'</div>';
}else{
// ÉTAPE PAIEMENT
var canCredit=posCurrentClient&&posCurrentClient.id;
var creditDisplay = '';
if (posCurrentClient && posCurrentClient.id) {
creditDisplay = '<div id="clientCreditDisplay" style="font-size:18px;font-weight:700;padding:2px 0;text-align:right;"></div>';
}
h+='<div class="pos-cart-header" style="padding:6px 10px;border-bottom:1px solid var(--border);flex-shrink:0;"><h3 style="font-size:0.8rem;"><i class="fas fa-credit-card"></i> Paiement</h3></div><div class="pos-payment-form" style="padding:6px 10px;flex:1;overflow-y:auto;"><div style="margin-bottom:3px;"><label style="font-size:0.6rem;font-weight:600;">Client</label><div style="position:relative;">' +
'<div style="display:flex;align-items:center;background:#fff;border:2px solid #e2e8f0;border-radius:4px;padding:1px 6px;position:relative;">' +
'<input type="text" id="posClientSearchInput" placeholder="🔍 Cliquez..." onkeyup="posSearchClient(this.value)" onfocus="if(this.value)posSearchClient(this.value)" autocomplete="off" value="'+(posCurrentClient?escapeHtml(posCurrentClient.name):'')+'" style="border:none;outline:none;padding:3px 0;width:100%;background:transparent;font-size:16px !important;font-weight:700 !important;padding-right:20px;">' +
'<button id="posClientClearBtn" onclick="clearClientSearch()" style="display:'+((posCurrentClient && posCurrentClient.name) ? 'flex' : 'none')+';position:absolute;right:3px;background:none;border:none;cursor:pointer;padding:1px;color:#94a3b8;font-size:0.9rem;align-items:center;justify-content:center;"><i class="fas fa-times-circle"></i></button>' +
'</div>' +
'<div id="posClientDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:2px solid #e2e8f0;border-radius:0 0 4px 4px;max-height:120px;overflow-y:auto;z-index:50;"></div></div>'+creditDisplay+'</div><div style="margin:2px 0;font-size:0.4rem;text-align:center;">— OU —</div><div style="margin-bottom:3px;"><label style="font-size:0.6rem;font-weight:600;">Table</label><input type="text" id="posTableNum" value="'+escapeHtml(posCurrentTable)+'" onchange="posSetTable(this.value)" style="width:100%;padding:3px;border:2px solid #e2e8f0;border-radius:4px;font-size:0.7rem;"></div><div style="margin-bottom:3px;"><div style="padding:4px;background:#f8fafc;border-radius:4px;">' +
'<div style="font-size:1rem;font-weight:600;">Articles: '+posCart.length+'</div>' +
(posDiscountMAD>0?'<div style="color:#ef4444;font-size:0.9rem;">Remise: -'+posDiscountMAD.toFixed(2)+' MAD</div>':'') +
'<div style="font-size:1.1rem;font-weight:700;">Total: '+t.toFixed(2)+' MAD</div></div></div><div style="margin-bottom:3px;"><label style="font-size:0.6rem;font-weight:600;">Vendeur</label><input type="text" id="posVendeur" value="'+(window.currentUserData?escapeHtml(window.currentUserData.userData.prenom+' '+window.currentUserData.userData.nom):'')+'" style="width:100%;padding:3px;border:2px solid #e2e8f0;border-radius:4px;font-size:0.7rem;"></div><div style="margin-bottom:3px;"><div style="display:flex;gap:3px;">' +
'<button class="pos-payment-btn '+(posPaymentMethod==='espece'?'active':'')+'" onclick="posSetPaymentMethod(\'espece\')" style="font-size:0.8rem !important;font-weight:700 !important;padding:4px 8px;height:auto;min-height:30px;"><i class="fas fa-money-bill-wave"></i> Espèces</button>' +
'<button class="pos-payment-btn '+(posPaymentMethod==='credit'?'active':'')+'" onclick="posSetPaymentMethod(\'credit\')" id="posCreditBtn" '+(canCredit?'':'disabled style="opacity:0.4;"')+' style="font-size:0.8rem !important;font-weight:700 !important;padding:4px 8px;height:auto;min-height:30px;"><i class="fas fa-credit-card"></i> Crédit</button>' +
'<button class="pos-payment-btn '+(posPaymentMethod==='partiel'?'active':'')+'" onclick="posSetPaymentMethod(\'partiel\')" id="posPartielBtn" '+(canCredit?'':'disabled style="opacity:0.4;"')+' style="font-size:0.8rem !important;font-weight:700 !important;padding:4px 8px;height:auto;min-height:30px;"><i class="fas fa-hand-holding-usd"></i> Partiel</button>' +
'</div></div>';
if(posPaymentMethod==='espece'||posPaymentMethod==='partiel') {
h+='<div style="margin-bottom:3px;"><label style="font-size:0.6rem;font-weight:600;">Montant donné</label><input type="number" id="posAmountGiven" placeholder="0.00" value="'+(posAmountGiven>0?posAmountGiven:'')+'" onkeyup="posCalculateChange()" style="width:100%;padding:4px;border:2px solid #e2e8f0;border-radius:4px;font-size:1.2rem !important;font-weight:700 !important;"><div id="posChangeDisplay" style="font-size:1.1rem;font-weight:700;padding:2px 0;margin-right:4px;"></div></div>';
}
h+='<button class="pos-finalize-btn" onclick="posFinalizeSale()" style="width:100%;padding:8px;margin-top:4px;background:#14B8A6;color:#fff;border:none;border-radius:8px;font-size:1rem !important;font-weight:700 !important;min-height:40px;"><i class="fas fa-check-circle"></i> Finaliser</button></div>';
}
h+='</div></div>'; c.innerHTML=h;

setStaticBackButtonVisibility(posStep === 2);

if(posStep===1) {
posViewMode = 'categories';
posSelectedCategoryForView = null;
filterProductGrid();
var toolsContainer = document.getElementById('posToolsContainer');
var toggleBtn = document.getElementById('posToggleToolsBtn');
if (toolsContainer) {
toolsContainer.style.display = posToolsVisible ? 'flex' : 'none';
}
if (toggleBtn) {
toggleBtn.innerHTML = posToolsVisible ? '✕ Masquer tout' : '🔍 Afficher tout';
toggleBtn.style.background = posToolsVisible ? '#ef4444' : '#14B8A6';
}
}
if(posStep===2) {
setTimeout(function() {
posCalculateChange();
if (posCurrentClient && posCurrentClient.id) {
updateClientCreditDisplay(posCurrentClient.id);
var clearBtn = document.getElementById('posClientClearBtn');
if (clearBtn) clearBtn.style.display = 'flex';
}
}, 200);
}
}

function posNaviguerEtape(etape) {
console.log('🔄 Navigation vers étape', etape);
if (etape === 1) {
posGoToStep1();
} else if (etape === 2) {
posGoToStep2();
}
}

function posFilterCategory(ca){ 
    if (ca === 'all') {
        retournerCategories();
    } else {
        selectionnerCategorie(ca);
    }
}
function posUpdateDiscountMAD(v){ posDiscountMAD=parseFloat(v)||0; if(posDiscountMAD<0) posDiscountMAD=0; if(isOnPOSPage()) renderPOS(); }
function posUpdateQty(i,ch){ var it=posCart[i]; if(!it) return; var p=posProductsList.find(function(x){ return x.id===it.id; }),nq=it.quantite+ch; if(nq<=0) posCart.splice(i,1); else{ if(p&&p.stock!==undefined&&nq>p.stock){ alert('Max: '+p.stock); return; } it.quantite=nq; } updateCartOnly(); }
function posRemoveItem(i){ posCart.splice(i,1); updateCartOnly(); }
function posCalculateTotal(){ var t=0; for(var i=0;i<posCart.length;i++) t+=posCart[i].prixUnitaire*posCart[i].quantite; return t; }

function posGoToStep2(){
posStep = 2;
window.posStep = 2;
setStaticBackButtonVisibility(true);
if (posCurrentClient && posCurrentClient.id) {
updateClientCreditDisplay(posCurrentClient.id);
}
if (typeof window.setVoiceMode === 'function') {
if (typeof window.lastAddedProductId !== 'undefined') { window.lastAddedProductId = null; }
window.setVoiceMode('payment', '🎤 Mode paiement', null);
}
if(isOnPOSPage()) renderPOS();
}

function posGoToStep1(){
console.log('🔄 Retour à l\'étape 1 (panier)');
posStep = 1;
window.posStep = 1;
delete window.posCommandeId;
delete window.posVenteId;
setStaticBackButtonVisibility(false);
if (typeof window.setVoiceMode === 'function') {
window.setVoiceMode('search', '🎤 Recherche vocale active', null);
}
if (typeof showVoiceResult === 'function') {
showVoiceResult('↩️ Retour au panier');
}
var c = document.getElementById('dynamicContent');
if (c && isOnPOSPage()) {
buildFullPOS(c);
}
}

function posSetPaymentMethod(m){ if((m==='credit'||m==='partiel')&&(!posCurrentClient||!posCurrentClient.id)){ alert('Client requis'); return; } posPaymentMethod=m; posAmountGiven=0; if(isOnPOSPage()) renderPOS(); }

function posCalculateChange(){
var ai=document.getElementById('posAmountGiven');
var cd=document.getElementById('posChangeDisplay');
if(!ai||!cd) return;
var st=posCalculateTotal();
var t=st-posDiscountMAD;
posAmountGiven=parseFloat(ai.value)||0;
var c=posAmountGiven-t;
if(posAmountGiven>0) {
if(c>=0) {
cd.innerHTML='<div style="font-size:1.1rem;font-weight:700;color:#16a34a;display:flex;align-items:center;justify-content:flex-start;"><span>✅ Rendu</span><span style="margin-left:8px;margin-right:8px;">'+c.toFixed(2)+' MAD</span></div>';
} else {
cd.innerHTML='<div style="font-size:1.1rem;font-weight:700;color:#ef4444;display:flex;align-items:center;justify-content:flex-start;"><span>❌ Manquant</span><span style="margin-left:8px;margin-right:8px;">'+Math.abs(c).toFixed(2)+' MAD</span></div>';
}
} else {
cd.innerHTML='';
}
}

async function updateClientFidelityAsync(clientId,total,profitTotal){ try{ if(!fideliteSettingsCache){ var fDoc=await db.collection('settings').doc('fidelite').get(); fideliteSettingsCache=fDoc.exists?fDoc.data():{active:true,pointsParVente:1}; } if(!fideliteSettingsCache.active) return; var cr=await db.collection('clients').doc(clientId).get(); if(!cr.exists) return; var cd=cr.data(),points=parseInt(fideliteSettingsCache.pointsParVente)||1; await CacheDB.write('clients',clientId,{ca:(cd.ca||0)+total,profit:(cd.profit||0)+profitTotal,pointsFidelite:(cd.pointsFidelite||0)+points,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},'update'); }catch(e){ console.warn(e); } }

async function posFinalizeSale(){
if(isFinalizing) return;
var st=posCalculateTotal(), t=st-posDiscountMAD;
if(!posCurrentClient && !posCurrentTable){ posCurrentClient = { id: null, name: 'Passager' }; }
if(posCurrentTable && (posPaymentMethod==='credit'||posPaymentMethod==='partiel')){ alert('Table = espèces uniquement.'); return; }
if((posPaymentMethod==='credit'||posPaymentMethod==='partiel') && !posCurrentClient){ alert('Client requis pour crédit/partiel.'); return; }
if(posPaymentMethod==='espece' || posPaymentMethod==='partiel'){
var amountInput = document.getElementById('posAmountGiven');
var givenAmount = parseFloat(amountInput ? amountInput.value : 0) || 0;
if (givenAmount <= 0) { posAmountGiven = t; if (amountInput) amountInput.value = t.toFixed(2); }
else { posAmountGiven = givenAmount; }
if(posPaymentMethod==='espece' && posAmountGiven < t){ alert('Montant insuffisant.'); return; }
}
isFinalizing=true;
var fb=document.querySelector('.pos-finalize-btn');
if(fb){ fb.disabled=true; fb.textContent='⏳...'; }
var vendeur=document.getElementById('posVendeur').value.trim()||(window.currentUserData?window.currentUserData.userData.prenom+' '+window.currentUserData.userData.nom:'');
try{
var fn=getNextFactureNum(), remaining=0, paid=true, statutPaiement='payé', change=0;
if(posPaymentMethod==='credit'){ paid=false; remaining=t; statutPaiement='crédit'; }
else if(posPaymentMethod==='partiel'){ remaining = t - posAmountGiven; paid = false; statutPaiement='partiel'; change = Math.max(0, posAmountGiven - t); }
else { change = posAmountGiven - t; }
if(posCurrentTable && !posCurrentClient){ paid=false; statutPaiement='en_attente'; remaining=t; }
var profitTotal=0, itemsDetail=posCart.map(function(it){
var pa=it.prixAchat||0, pvn=it.prixVente||0, pp=it.prixPromo||0, pvr=pp>0?pp:pvn, prof=(pvr-pa)*it.quantite;
profitTotal+=prof;
return {id:it.id, nom:it.nom, quantite:it.quantite, prixVente:pvr, prixAchat:pa, prixPromo:pp, profit:prof, sauces:[], interdits:it.interdits||[], epice:it.epice||'Normal', sel:it.sel||'Normal'};
});
var sd={factureNum:fn, items:itemsDetail, subtotal:st, discountMAD:posDiscountMAD, total:t, clientId:posCurrentClient ? posCurrentClient.id : null, clientName:posCurrentClient ? posCurrentClient.name : 'Passager', table:posCurrentTable || null, vendeur:vendeur, paymentMethod:posPaymentMethod, statutPaiement:statutPaiement, amountGiven:posAmountGiven, change:change, paid:paid, remainingAmount:remaining, profitTotal:profitTotal, createdAt:firebase.firestore.FieldValue.serverTimestamp()};
var batch=db.batch(), ventesRef=db.collection('ventes').doc();
batch.set(ventesRef,sd);
if(!paid){ var creditsRef=db.collection('credits').doc(); batch.set(creditsRef,sd); }
if(window.posCommandeId){ batch.update(db.collection('commandes').doc(window.posCommandeId), {statut:'payé', paidAt:firebase.firestore.FieldValue.serverTimestamp(), factureNum:fn}); delete window.posCommandeId; }
if(window.posVenteId){ batch.update(db.collection('ventes').doc(window.posVenteId), {paid:true, statutPaiement:'payé', remainingAmount:0, paidAt:firebase.firestore.FieldValue.serverTimestamp()}); delete window.posVenteId; }
for(var i=0;i<posCart.length;i++){ var it=posCart[i]; batch.update(db.collection('products').doc(it.id), {stock:firebase.firestore.FieldValue.increment(-it.quantite), vendues:firebase.firestore.FieldValue.increment(it.quantite), ca:firebase.firestore.FieldValue.increment(it.prixUnitaire*it.quantite)}); }
await batch.commit();
if(posCurrentClient && posCurrentClient.id && paid) updateClientFidelityAsync(posCurrentClient.id, t, profitTotal);
if (posCurrentClient && posCurrentClient.id) {
clientCreditsCache[posCurrentClient.id] = undefined;
}
var venteId = ventesRef.id;
if (typeof window.sendWhatsApp === 'function') {
var originalCloseModal = window.closeModal;
window.closeModal = function() { posResetCart(); if(isOnPOSPage()) renderPOS(); if(navigator.onLine) setTimeout(function(){ CacheDB.sync().catch(function(){}); },500); window.closeModal = originalCloseModal; var o = document.getElementById('modalOverlay'); if (o) o.classList.add('hidden'); window.editingId = null; };
var modalHtml = '<p style="text-align:center;">Voulez-vous envoyer la facture par WhatsApp ?</p><div style="display:flex;justify-content:center;gap:10px;margin-top:15px;"><button class="btn-save" id="whatsappYesBtn">✅ Oui</button><button class="btn-cancel" id="whatsappNoBtn">❌ Non</button></div>';
openModal('📱 Envoyer la facture WhatsApp', modalHtml);
setTimeout(function() {
var yesBtn = document.getElementById('whatsappYesBtn'), noBtn = document.getElementById('whatsappNoBtn');
if (yesBtn) { yesBtn.addEventListener('click', function() { window.closeModal = originalCloseModal; closeModal(); if (typeof window.posStopVoiceSearch === 'function') window.posStopVoiceSearch(); window.sendWhatsApp(venteId); setTimeout(function() { posResetCart(); if(isOnPOSPage()) renderPOS(); if(navigator.onLine) setTimeout(function(){ CacheDB.sync().catch(function(){}); },500); }, 500); }); }
if (noBtn) { noBtn.addEventListener('click', function() { window.closeModal = originalCloseModal; closeModal(); posResetCart(); if(isOnPOSPage()) renderPOS(); if(navigator.onLine) setTimeout(function(){ CacheDB.sync().catch(function(){}); },500); }); }
}, 100);
} else { posResetCart(); if(isOnPOSPage()) renderPOS(); if(navigator.onLine) setTimeout(function(){ CacheDB.sync().catch(function(){}); },500); }
}catch(e){ alert('Erreur: '+e.message); }
finally { isFinalizing=false; if(fb){ fb.disabled=false; fb.innerHTML='<i class="fas fa-check-circle"></i> Finaliser'; } }
}

function posResetCart() {
    posCart = [];
    posDiscountMAD = 0;
    posAmountGiven = 0;
    posCurrentClient = null;
    posCurrentTable = '';
    posPaymentMethod = 'espece';
    delete window.posCommandeId;
    delete window.posVenteId;
    if (document.getElementById('posClientSearchInput')) {
        document.getElementById('posClientSearchInput').value = '';
    }
    if (document.getElementById('clientCreditDisplay')) {
        document.getElementById('clientCreditDisplay').style.display = 'none';
    }
    if (isOnPOSPage()) renderPOS();
}

function posChargerCommandesTables() {
    posCommandesTablesCount = 0;
}

function posChargerCommandesEnLigneCount() {
    posCommandesEnLigneCount = 0;
}

function posAfficherCommandesTables() {
    alert('Fonction à implémenter selon votre logique');
}

function posToggleVoiceSearch() {
    if (typeof window.toggleVoiceSearch === 'function') {
        window.toggleVoiceSearch();
    } else {
        alert('Fonction de recherche vocale non disponible');
    }
}

function updateClearButtonVisibility() {
    var input = document.getElementById('posSearchInput');
    var btn = document.getElementById('posSearchClearBtn');
    if (input && btn) {
        btn.style.display = (input.value && input.value.length > 0) ? 'flex' : 'none';
    }
}

function goBackToPOS(){ if(window.currentUserData&&(window.currentUserData.userData.role==='caissier'||window.currentUserData.userData.role==='admin')){ if(posCart.length>0&&posStep===1){ if(!confirm('⚠️ '+posCart.length+' article(s) dans le panier. Garder ?')) posResetCart(); } navigateTo('pos'); } }

window.posCart=posCart; window.posStep=posStep; window.posProductsList=posProductsList; window.posAllClients=posAllClients; window.posCurrentClient=posCurrentClient; window.posCurrentTable=posCurrentTable; window.posDiscountMAD=posDiscountMAD; window.posAmountGiven=posAmountGiven; window.posPaymentMethod=posPaymentMethod; window.posResetCart=posResetCart; window.posAddToCartOrOpenOptions=posAddToCartOrOpenOptions; window.posSetPaymentMethod=posSetPaymentMethod; window.posCalculateTotal=posCalculateTotal; window.posFinalizeSale=posFinalizeSale; window.posGoToStep2=posGoToStep2; window.posGoToStep1=posGoToStep1; window.posSearchProducts=posSearchProducts; window.clearPosSearch=clearPosSearch; window.clearClientSearch=clearClientSearch; window.updateClearButtonVisibility=updateClearButtonVisibility; window.updateCartOnly=updateCartOnly; window.renderPOS=renderPOS; window.updatePaymentButtons=updatePaymentButtons; window.loadMoreProducts=loadMoreProducts; window.loadClientCredits=loadClientCredits; window.updateClientCreditDisplay=updateClientCreditDisplay; window.posCalculateChange=posCalculateChange; window.onProductAdded=window.onProductAdded||function(pid){ console.log('Produit ajouté:',pid); };
window.posNaviguerEtape = posNaviguerEtape;
window.buildFullPOS = buildFullPOS;
window.decrementerIngredientsStock = decrementerIngredientsStock;
window.afficherCategories = afficherCategories;
window.selectionnerCategorie = selectionnerCategorie;
window.retournerCategories = retournerCategories;
window.posFilterCategory = posFilterCategory;
window.posViewMode = posViewMode;
window.posSelectedCategoryForView = posSelectedCategoryForView;
window.posToggleTools = posToggleTools;
window.posToolsVisible = posToolsVisible;
window.applyDynamicContentScroll = applyDynamicContentScroll;

console.log('🚀 E-SOLUTION - POS chargé - Panier en dessous');
