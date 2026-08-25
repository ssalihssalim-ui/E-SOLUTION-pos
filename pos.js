// ==================== POS.JS - E-SOLUTION ====================
// Point de vente complet avec mode catégories
// ✅ 4 colonnes catégories sur mobile ET PC
// ✅ 4 colonnes produits sur mobile ET PC
// ✅ Nom produit 16px bold, Prix produit 18px bold

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

// ✅ MODE CATÉGORIES / PRODUITS
var posViewMode = 'categories';
var posSelectedCategoryForView = null;

// ✅ ÉTAT POUR AFFICHER/MASQUER LA BARRE DE RECHERCHE
var posShowSearchBar = false;

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

function toggleSearchBar() {
    posShowSearchBar = !posShowSearchBar;
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
displayEl.style.color = '#16a34a';
displayEl.style.fontWeight = '700';
displayEl.style.fontSize = '28px';
}
}

async function loadPosPage(c){
posResetCart(); posStep=1; posCommandesFilterText=''; posCommandesSortField='createdAt'; posCommandesSortOrder='desc'; posSearchQuery=''; productIndexBuilt=false; posProductOffset=0;
posCategoriesList=[]; posProductsList=[]; posAllClients=[]; posFilteredClients=[];
c.innerHTML='<div style="text-align:center;padding:60px;"><i class="fas fa-spinner fa-spin" style="font-size:2.5rem;color:#2E7D32;"></i><p style="margin-top:15px;color:#64748b;">Chargement du POS...</p></div>';
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

function posSearchProducts(query){ clearTimeout(window._searchTimeout); window._searchTimeout=setTimeout(function(){ posProductOffset=0; posSearchQuery=query.toLowerCase().trim(); 
if (posViewMode === 'categories' && posSearchQuery.length > 0) {
    posViewMode = 'products';
    posSelectedCategoryForView = null;
}
if(isOnPOSPage()) filterProductGrid(); },150); }

function clearPosSearch() {
var input = document.getElementById('posSearchInput');
if (input) {
input.value = '';
posSearchQuery = '';
posProductOffset = 0;
posViewMode = 'categories';
posSelectedCategoryForView = null;
posSelectedCategory = 'all';
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

// ==================== AFFICHER LES CATÉGORIES - 4 COLONNES ====================
function afficherCategories(grid) {
    var isMobile = window.innerWidth < 700;
    // ✅ 4 colonnes partout
    var gridCols = 'repeat(4, 1fr)';
    grid.style.gridTemplateColumns = gridCols;
    grid.style.overflowX = 'auto';
    grid.style.flexWrap = 'wrap';
    grid.style.alignContent = 'start';
    grid.style.gap = isMobile ? '8px' : '14px';
    grid.style.padding = isMobile ? '6px' : '12px';
    grid.style.justifyContent = 'center';

    var html = '';
    
    html += '<div style="grid-column:1/-1;padding:8px 10px;font-size:1.1rem;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px;">';
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
                'padding:10px 4px;min-height:95px;max-height:120px;border-radius:10px;border:2px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;aspect-ratio:1/1;background:var(--bg-card);cursor:pointer;transition:var(--transition);' : 
                'padding:14px 8px;min-height:160px;max-height:190px;border-radius:14px;border:2px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;aspect-ratio:1/1;background:var(--bg-card);cursor:pointer;transition:var(--transition);';
            
            var imgSize = isMobile ? '48px' : '70px';
            var imgStyle = 'width:'+imgSize+';height:'+imgSize+';border-radius:50%;margin-bottom:6px;overflow:hidden;flex-shrink:0;background:var(--gray-100);display:flex;align-items:center;justify-content:center;';
            
            var nameSize = isMobile ? '11px' : '15px';
            var nameStyle = 'font-size:'+nameSize+' !important;font-weight:700 !important;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;color:var(--text-primary);margin-top:4px;display:block;line-height:1.3;';
            
            var countSize = isMobile ? '9px' : '12px';
            var countStyle = 'font-size:'+countSize+' !important;color:var(--text-secondary);font-weight:500;display:block;margin-top:2px;';

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
                imgContent = '<i class="fas fa-folder" style="font-size:' + (isMobile ? '18px' : '28px') + ';color:var(--accent);"></i>';
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

// ==================== SÉLECTIONNER UNE CATÉGORIE ====================
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

// ==================== RETOURNER AUX CATÉGORIES ====================
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

// ==================== FILTER PRODUCT GRID - 4 COLONNES ====================
function filterProductGrid(){
if(!isOnPOSPage() || posStep !== 1) return;
var grid=document.getElementById('posProductGrid')||document.querySelector('.pos-products-grid'); if(!grid) return;

if (posViewMode === 'categories') {
    afficherCategories(grid);
    return;
}

var f=fastSearch(posSearchQuery);

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
// ✅ 4 colonnes partout
var gridCols = 'repeat(4, 1fr)';
grid.style.gridTemplateColumns = gridCols;
grid.style.overflowX = 'auto';
grid.style.flexWrap = 'wrap';
grid.style.gap = isMobile ? '6px' : '12px';
grid.style.padding = isMobile ? '4px' : '10px';
grid.style.justifyContent = 'center';

var html='';

// ✅ BANDEAU RETOUR
html += '<div style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;margin-bottom:10px;background:var(--bg-card);border-radius:12px;border:2px solid var(--border);flex-wrap:wrap;gap:8px;box-shadow:var(--shadow-xs);">';

html += '<div style="display:flex;align-items:center;gap:8px;">';
html += '<button onclick="retournerCategories()" style="display:flex;align-items:center;gap:6px;background:var(--black);color:var(--white);border:none;border-radius:8px;padding:8px 16px;font-size:0.85rem;font-weight:600;cursor:pointer;transition:var(--transition);">';
html += '<i class="fas fa-arrow-left"></i> Retour';
html += '</button>';
html += '</div>';

if (posSelectedCategoryForView) {
    var count = posProductsList.filter(function(p) {
        if (p.categories && p.categories.length > 0) {
            return p.categories.includes(posSelectedCategoryForView);
        }
        return p.categorie === posSelectedCategoryForView;
    }).length;
    
    html += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">';
    html += '<span style="font-weight:700;font-size:1rem;color:var(--text-primary);">📂 ' + escapeHtml(posSelectedCategoryForView) + '</span>';
    html += '<span style="font-size:0.8rem;color:var(--text-secondary);background:var(--gray-100);padding:3px 14px;border-radius:20px;font-weight:600;">' + count + ' produit' + (count > 1 ? 's' : '') + '</span>';
    html += '</div>';
}

html += '<div style="min-width:20px;"></div>';
html += '</div>';

if(totalProducts===0){ html+='<div style="grid-column:1/-1;text-align:center;padding:40px 10px;"><i class="fas fa-search" style="font-size:2.5rem;color:#94a3b8;"></i><p style="color:#94a3b8;">'+(posSearchQuery?'Aucun produit pour "'+escapeHtml(posSearchQuery)+'"':'Aucun produit')+'</p>'+(posSearchQuery?'<button class="btn-add" onclick="clearPosSearch()">Effacer</button>':'')+'</div>'; }
else{
if(posSearchQuery) html+='<div style="grid-column:1/-1;padding:3px 8px;font-size:0.75rem;color:#94a3b8;">'+totalProducts+' résultat'+(totalProducts>1?'s':'')+'</div>';
for(var j=0;j<displayProducts.length;j++){ 
var p=displayProducts[j];
var pr=p.prixPromo&&p.prixPromo>0?p.prixPromo:p.prixVente;
var hp=p.prixPromo&&p.prixPromo>0;
var sc='', stt=''; 
if(p.stock!==undefined){ 
    if(p.stock<=0){sc='pos-out-of-stock';stt=' (Rupture)';}else if(p.stock<=5) stt=' ('+p.stock+' rest.)'; 
} 
var dn=escapeHtml(p.nom); 
if(posSearchQuery) dn=dn.replace(new RegExp('('+posSearchQuery.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark style="background:#fef3c7;border-radius:3px;">$1</mark>');

// ✅ STYLES - 4 colonnes, font-size fixe
var cardStyle = isMobile ? 
    'padding:6px 3px;min-height:100px;border-radius:10px;border:2px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg-card);cursor:pointer;transition:var(--transition);' : 
    'padding:12px 8px;min-height:190px;border-radius:14px;border:2px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg-card);cursor:pointer;transition:var(--transition);';

var imgStyle = isMobile ? 
    'height:40px;width:100%;margin-bottom:4px;border-radius:8px;overflow:hidden;background:var(--gray-100);flex-shrink:0;' : 
    'height:80px;width:100%;margin-bottom:8px;border-radius:10px;overflow:hidden;background:var(--gray-100);flex-shrink:0;';

// ✅ Nom produit: 16px bold sur mobile ET PC
var nameStyle = isMobile ? 
    'font-size:16px !important;font-weight:700 !important;text-transform:uppercase;line-height:1.2;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;display:block;color:var(--text-primary);' : 
    'font-size:16px !important;font-weight:700 !important;line-height:1.3;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;display:block;color:var(--text-primary);';

// ✅ Prix produit: 18px bold sur mobile ET PC
var priceStyle = isMobile ? 
    'font-size:18px !important;font-weight:700;display:block;text-align:center;margin-top:2px;color:var(--text-primary);' : 
    'font-size:18px !important;font-weight:700;display:block;text-align:center;margin-top:4px;color:var(--text-primary);';

var oldPriceStyle = isMobile ? 
    'font-size:12px;text-decoration:line-through;color:var(--text-muted);margin-right:4px;' : 
    'font-size:12px;text-decoration:line-through;color:var(--text-muted);margin-right:4px;';

var promoPriceStyle = isMobile ? 
    'font-size:18px;color:var(--danger);' : 
    'font-size:18px;color:var(--danger);';

var imgContent = '';
if (p.imageBase64) {
    imgContent = '<img src="' + escapeHtml(p.imageBase64) + '" loading="lazy" alt="" style="width:100%;height:100%;object-fit:cover;">';
} else {
    imgContent = '<i class="fas fa-box" style="font-size:' + (isMobile ? '18px' : '28px') + ';color:var(--text-muted);"></i>';
}

html+='<div class="pos-product-card '+sc+'" style="'+cardStyle+'" onclick="posAddToCartOrOpenOptions(\''+p.id+'\')">'+
    '<div class="pos-product-img" style="'+imgStyle+'display:flex;align-items:center;justify-content:center;">'+imgContent+'</div>'+
    '<div class="pos-product-info" style="display:flex;flex-direction:column;align-items:center;width:100%;flex:1;justify-content:center;overflow:hidden;">'+
        '<span class="pos-product-name" style="'+nameStyle+'">'+dn+stt+'</span>'+
        '<span class="pos-product-price" style="'+priceStyle+'">'+
            (hp ? 
                '<span class="pos-old-price" style="'+oldPriceStyle+'">'+p.prixVente.toFixed(2)+'</span> <span class="pos-promo-price" style="'+promoPriceStyle+'">'+pr.toFixed(2)+' MAD</span>' : 
                pr.toFixed(2)+' MAD'
            )+
        '</span>'+
    '</div>'+
'</div>'; 
}
if(posHasMoreProducts){ html+='<div style="grid-column:1/-1;text-align:center;padding:10px;"><button class="btn-add" onclick="loadMoreProducts()" style="font-size:0.8rem;">Afficher plus ('+(totalProducts-displayProducts.length)+' produits restants)</button></div>'; }
}
grid.innerHTML=html;
updateClearButtonVisibility();
}

function updateClearButtonVisibility() {
var clearBtn = document.getElementById('posSearchClearBtn');
var input = document.getElementById('posSearchInput');
if (clearBtn && input) {
clearBtn.style.display = (input.value && input.value.length > 0) ? 'flex' : 'none';
}
}

async function posChargerCommandesTables(){ try{ var snap=await db.collection('commandes').where('statut','==','en_attente').where('source','==','menu_tactile').get(); posCommandesTables=[]; snap.forEach(function(doc){ var d=doc.data();d.id=doc.id;posCommandesTables.push(d); }); posCommandesTables.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)); posCommandesTablesCount=posCommandesTables.length; }catch(e){ posCommandesTablesCount=0; } }
async function posChargerCommandesEnLigneCount(){ try{ var snap=await db.collection('commandes').where('statut','==','en_attente').where('source','==','client').get(); posCommandesEnLigneCount=snap.size; }catch(e){ posCommandesEnLigneCount=0; } }
function posTriCommandesTables(field){ posCommandesSortOrder=(posCommandesSortField===field)?(posCommandesSortOrder==='asc'?'desc':'asc'):'asc'; posCommandesSortField=field; posAfficherCommandesTables(); }
function posApplyCommandesFilter(value){ posCommandesFilterText=value; posAfficherCommandesTables(); }

function posAfficherCommandesTables(){
if(posCommandesTables.length===0){ alert('Aucune commande table en attente.'); return; }
var fd=posCommandesTables.slice(); if(posCommandesFilterText.trim()){ var q=posCommandesFilterText.toLowerCase().trim(); fd=fd.filter(function(cmd){ if((cmd.table||'').toLowerCase().includes(q)) return true; if(cmd.items&&cmd.items.some(function(it){ return (it.nom||'').toLowerCase().includes(q)||((it.interdits||[]).concat(it.epice!=='Normal'?[it.epice]:[],it.sel!=='Normal'?[it.sel]:[])).some(function(o){ return o.toLowerCase().includes(q); }); })) return true; return false; }); }
fd.sort(function(a,b){ var va,vb; switch(posCommandesSortField){ case'table':va=(a.table||'').toLowerCase();vb=(b.table||'').toLowerCase();break; case'total':va=a.total||0;vb=b.total||0;break; case'createdAt':va=a.createdAt?.seconds||0;vb=b.createdAt?.seconds||0;break; default:va=0;vb=0; } return (va<vb)?(posCommandesSortOrder==='asc'?-1:1):(va>vb)?(posCommandesSortOrder==='asc'?1:-1):0; });
function rsh(label,field){ var icon=''; if(posCommandesSortField===field) icon=posCommandesSortOrder==='asc'?' ▲':' ▼'; return '<th style="cursor:pointer;" onclick="posTriCommandesTables(\''+field+'\')">'+label+icon+'</th>'; }
var html='<div style="margin-bottom:12px;display:flex;gap:8px;"><input type="text" id="posCmdFilterInput" placeholder="🔍 Filtrer..." style="flex:1;padding:8px 12px;border:2px solid var(--border);border-radius:30px;font-size:0.8rem;background:var(--bg-card);color:var(--text-primary);" value="'+escapeHtml(posCommandesFilterText)+'" onkeyup="posApplyCommandesFilter(this.value)"><button class="btn-add" onclick="posApplyCommandesFilter(\'\')">❌</button></div><div style="max-height:60vh;overflow-y:auto;"><table class="data-table" style="width:100%;font-size:0.7rem;"><thead><tr>'+rsh('Table','table')+'<th>Produits</th><th>Options</th>'+rsh('Total','total')+rsh('Date','createdAt')+'<th>Actions</th></thead><tbody>';
if(fd.length===0) html+='<tr><td colspan="6" style="text-align:center;padding:20px;">Aucune</td></tr>';
else fd.forEach(function(cmd){ var table=cmd.table||'?',dh=cmd.createdAt?new Date(cmd.createdAt.seconds*1000).toLocaleString('fr-FR'):'N/A',prod=cmd.items?cmd.items.map(function(it){ return '<strong>'+it.quantite+'x</strong> '+escapeHtml(it.nom); }).join('<br>'):'-',opts=cmd.items?cmd.items.map(function(it){ var o=[]; if(it.interdits&&it.interdits.length) o.push('<span style="color:var(--danger);">🚫 '+escapeHtml(it.interdits.join(', '))+'</span>'); if(it.epice&&it.epice!=='Normal') o.push('<span style="color:#d97706;">🌶️ '+escapeHtml(it.epice)+'</span>'); if(it.sel&&it.sel!=='Normal') o.push('<span style="color:#4f46e5;">🧂 '+escapeHtml(it.sel)+'</span>'); return o.length?o.join(' | '):'<span style="color:var(--text-muted);">-</span>'; }).join('<br>'):'-'; html+='<tr><td><strong>🍽️ '+escapeHtml(table)+'</strong></td><td>'+prod+'</td><td><small>'+opts+'</small></td><td><strong style="color:var(--accent);">'+cmd.total.toFixed(2)+' MAD</strong></td><td><small>'+dh+'</small></td><td><button class="btn-add" style="padding:3px 6px;font-size:0.65rem;" onclick="posChargerCommandeTable(\''+cmd.id+'\')">Accepter</button> <button class="btn-save" style="padding:3px 6px;font-size:0.65rem;" onclick="posPayerCommandeTable(\''+cmd.id+'\')">Payé</button></td></tr>'; });
html+='</tbody></table></div>'; openModal('🛎️ Commandes tables ('+fd.length+')',html);
}
function posChargerCommandeTable(cid){ var cmd=posCommandesTables.find(function(c){ return c.id===cid; }); if(!cmd) return; posCart=[]; posEnrichirItemsAvecPrixAchat(cmd.items).forEach(function(item){ posCart.push({id:item.id,nom:item.nom,prixUnitaire:item.prixUnitaire||item.prixVente||0,prixAchat:item.prixAchat||0,prixPromo:item.prixPromo||0,prixVente:item.prixVente||item.prixUnitaire||0,quantite:item.quantite||1,categorie:item.categorie||'',imageBase64:item.imageBase64||'',sauces:[],interdits:item.interdits||[],epice:item.epice||'Normal',sel:item.sel||'Normal'}); }); posCurrentTable='Table '+(cmd.table||'?'); posCurrentClient=null; posPaymentMethod='espece'; posDiscountMAD=0; window.posCommandeId=cid; closeModal(); posStep=2; if(isOnPOSPage()) renderPOS(); }
async function posPayerCommandeTable(cid){ if(!confirm('Marquer comme payée ?')) return; try{ await CacheDB.write('commandes',cid,{statut:'payé',paidAt:firebase.firestore.FieldValue.serverTimestamp()},'update'); alert('✅ Payée !'); await posChargerCommandesTables(); closeModal(); if(isOnPOSPage()) renderPOS(); CacheDB.sync(); }catch(e){ alert('❌ '+e.message); } }

function posResetCart(){ posCart=[]; posStep=1; posSelectedCategory='all'; posCurrentClient=null; posCurrentTable=''; posPaymentMethod='espece'; posAmountGiven=0; posDiscountMAD=0; posSearchQuery=''; posProductOffset=0; posFilteredClients=posAllClients.slice(); clientCreditsCache = {}; delete window.posCommandeId; delete window.posVenteId; var si=document.getElementById('posSearchInput'); if(si) si.value=''; if(isOnPOSPage()) renderPOS(); }

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
h = '<div style="padding:8px;color:var(--text-muted);text-align:center;font-size:24px;">Aucun</div>';
} else {
posFilteredClients.forEach(function(c){
h += '<div onclick="posSelectClientFromDropdown(\''+c.id+'\',\''+escapeHtml(c.nom)+' '+escapeHtml(c.prenom)+'\')" style="padding:8px;cursor:pointer;border-bottom:1px solid var(--border);font-size:24px;color:var(--text-primary);">'+
escapeHtml(c.nom)+' '+escapeHtml(c.prenom)+
' <span style="color:var(--text-muted);font-size:20px;">('+(c.telephone||'')+')</span></div>';
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
async function posOpenOptionsModal(pid){ var p=posProductsList.find(function(x){ return x.id===pid; }); if(!p) return; if(p.stock!==undefined&&p.stock<=0){ alert('Rupture'); return; } if(typeof allStockData==='undefined'||allStockData.length===0){ try{ var snap=await db.collection('stock').orderBy('nom').get(); allStockData=[]; snap.forEach(function(d){ var dd=d.data();dd.id=d.id;allStockData.push(dd); }); }catch(e){} } try{ var doc=await db.collection('products').doc(pid).get(); posCurrentProductIngredients=doc.exists?(doc.data().ingredients||[]):[]; }catch(e){ posCurrentProductIngredients=[]; } var grouped={}; posCurrentProductIngredients.forEach(function(ing){ var si=allStockData.find(function(s){ return s.id===ing.idStock; }),cat=si?si.categorie:'Autre'; if(!grouped[cat]) grouped[cat]=[]; grouped[cat].push(ing.nom); }); var order=['Sauces','Légumes','Fruits','Viande','Poulet','Poisson'],sortedCats=Object.keys(grouped).sort(function(a,b){ var ia=order.indexOf(a),ib=order.indexOf(b); if(ia!==-1&&ib!==-1) return ia-ib; if(ia!==-1) return -1; if(ib!==-1) return 1; return a.localeCompare(b); }); posCurrentProductId=pid; var h='<h4>'+escapeHtml(p.nom)+'</h4>'; if(sortedCats.length===0) h+='<div style="color:var(--text-muted);">Aucun ingrédient</div>'; else sortedCats.forEach(function(cat){ h+='<div style="margin-bottom:10px;"><label style="font-weight:600;">🥫 '+escapeHtml(cat)+'</label><div style="display:flex;flex-wrap:wrap;gap:4px;">'; grouped[cat].forEach(function(ing){ h+='<label style="display:flex;align-items:center;gap:3px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:0.7rem;"><input type="checkbox" class="pos-interdit-check" value="'+escapeHtml(ing)+'"> '+escapeHtml(ing)+'</label>'; }); h+='</div></div>'; }); h+='<div><label>🌶️ Épices:</label><div style="display:flex;flex-wrap:wrap;gap:4px;">'; posEpicesList.forEach(function(s,idx){ h+='<label style="padding:4px 6px;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:0.7rem;"><input type="radio" name="pos-epice" value="'+s+'" '+(idx===0?'checked':'')+'> '+s+'</label>'; }); h+='</div></div><div><label>🧂 Sel:</label><div style="display:flex;flex-wrap:wrap;gap:4px;">'; posSelList.forEach(function(s,idx){ h+='<label style="padding:4px 6px;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:0.7rem;"><input type="radio" name="pos-sel" value="'+s+'" '+(idx===0?'checked':'')+'> '+s+'</label>'; }); h+='</div></div>'; h+='<div style="text-align:right;margin-top:15px;"><button class="btn-cancel" onclick="closeModal()">Annuler</button> <button class="btn-save" onclick="posConfirmOptions()">Ajouter</button></div>'; openModal('Personnaliser',h); }
function posConfirmOptions(){ var interdits=[]; document.querySelectorAll('.pos-interdit-check:checked').forEach(function(cb){ interdits.push(cb.value); }); var epice=(document.querySelector('input[name="pos-epice"]:checked')||{}).value||'Normal',sel=(document.querySelector('input[name="pos-sel"]:checked')||{}).value||'Normal',p=posProductsList.find(function(x){ return x.id===posCurrentProductId; }); if(!p){ closeModal(); return; } var ex=posCart.find(function(x){ return x.id===posCurrentProductId; }); if(ex){ if(p.stock!==undefined&&ex.quantite>=p.stock){ alert('Stock insuffisant'); closeModal(); return; } ex.quantite+=1; }else{ var pr=p.prixPromo&&p.prixPromo>0?p.prixPromo:p.prixVente; posCart.push({id:p.id,nom:p.nom,prixUnitaire:pr,prixAchat:p.prixAchat||0,prixPromo:p.prixPromo||0,prixVente:p.prixVente||0,quantite:1,categorie:p.categorie||'',imageBase64:p.imageBase64||'',sauces:[],interdits:interdits,epice:epice,sel:sel}); } if(typeof window.onProductAdded==='function') window.onProductAdded(p.id); closeModal(); updateCartOnly(); }

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
if(it.interdits&&it.interdits.length) opts+=' <span style="color:var(--danger);font-size:0.6rem;">🚫'+escapeHtml(it.interdits.join(','))+'</span>';
if(it.epice&&it.epice!=='Normal') opts+=' <span style="color:#d97706;font-size:0.6rem;">🌶️'+escapeHtml(it.epice)+'</span>';
if(it.sel&&it.sel!=='Normal') opts+=' <span style="color:#4f46e5;font-size:0.6rem;">🧂'+escapeHtml(it.sel)+'</span>';

html+='<div class="pos-cart-item" style="display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--border);gap:8px;">' +
'<div class="pos-cart-item-info" style="flex:1;min-width:0;">' +
'<span class="pos-cart-item-name" style="font-size:'+nameSize+';font-weight:600;display:block;margin-right:10px;word-break:break-word;color:var(--text-primary);">'+escapeHtml(it.nom)+opts+'</span>' +
'<span class="pos-cart-item-price" style="font-size:'+priceSize+';color:var(--text-secondary);">'+it.prixUnitaire.toFixed(2)+' MAD/u</span>' +
'</div>' +
'<div class="pos-cart-item-actions" style="display:flex;align-items:center;gap:6px;flex-shrink:0;">' +
'<button class="pos-qty-btn" onclick="posUpdateQty('+k+',-1)" style="width:'+btnSize+';height:'+btnSize+';border-radius:50%;border:2px solid var(--border);background:var(--bg-card);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:'+fontSize+';transition:var(--transition);box-shadow:var(--shadow-xs);color:var(--text-primary);"><i class="fas fa-minus"></i></button>' +
'<span class="pos-qty-value" style="font-size:'+qtySize+';font-weight:700;min-width:32px;text-align:center;color:var(--text-primary);">'+it.quantite+'</span>' +
'<button class="pos-qty-btn" onclick="posUpdateQty('+k+',1)" style="width:'+btnSize+';height:'+btnSize+';border-radius:50%;border:2px solid var(--border);background:var(--bg-card);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:'+fontSize+';transition:var(--transition);box-shadow:var(--shadow-xs);color:var(--text-primary);"><i class="fas fa-plus"></i></button>' +
'<button class="pos-remove-btn" onclick="posRemoveItem('+k+')" style="background:none;border:none;color:var(--danger);cursor:pointer;padding:4px;font-size:1.1rem;transition:var(--transition);"><i class="fas fa-times"></i></button>' +
'</div>' +
'<span class="pos-cart-item-total" style="font-size:'+totalSize+';font-weight:700;min-width:80px;text-align:right;flex-shrink:0;color:var(--text-primary);">'+(it.prixUnitaire*it.quantite).toFixed(2)+' MAD</span>' +
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
vb.style.background = 'var(--accent)';
vb.style.color = '#fff';
vb.style.border = 'none';
vb.style.cursor = 'pointer';
vb.style.transition = 'var(--transition)';
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

function buildFullPOS(c){
if(posProductsList.length===0&&posCategoriesList.length===0){ c.innerHTML='<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:var(--accent);"></i><p>Chargement...</p></div>'; return; }
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

var gridGap = isMobile ? '6px' : '12px';
var gridPadding = isMobile ? '4px' : '10px';
var panelPadding = isMobile ? '10px' : '24px';

var h='<div class="pos-container' + (posStep===2 ? ' pos-container-full' : '') + '">' +
stepIndicator +
'<div class="pos-products-panel" style="' + productPanelDisplay + ' padding:'+panelPadding+'; flex:1; min-width:200px; max-width:100%; min-height:700px; background:var(--bg-card); border-radius:var(--radius-xl); box-shadow:var(--shadow-xs); border:1px solid var(--border); display:flex; flex-direction:column; height:100%; overflow:hidden;">' +
'<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;">';

// ✅ BOUTON "AFFICHER PLUS"
h += '<div style="display:flex;justify-content:center;padding:4px 0;">';
h += '<button onclick="toggleSearchBar()" style="display:flex;align-items:center;gap:8px;background:var(--accent);color:#ffffff;border:none;border-radius:30px;padding:8px 24px;font-size:0.85rem;font-weight:600;cursor:pointer;transition:var(--transition);box-shadow:0 2px 8px rgba(20,184,166,0.3);">';
h += '<i class="fas fa-' + (posShowSearchBar ? 'chevron-up' : 'chevron-down') + '"></i>';
h += posShowSearchBar ? 'Masquer les options' : 'Afficher plus';
h += '</button>';
h += '</div>';

// ✅ BARRE DE RECHERCHE + BOUTONS + SLIDE CATÉGORIES (CACHÉS PAR DÉFAUT)
var searchBarStyle = posShowSearchBar ? 'display:flex;flex-direction:column;gap:8px;' : 'display:none;flex-direction:column;gap:8px;';

h += '<div style="' + searchBarStyle + '">';
h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
'<div style="flex:1;min-width:120px;display:flex;align-items:center;background:var(--bg-card);border:2px solid var(--border);border-radius:40px;padding:2px 10px;position:relative;height:'+(isMobile?'38px':'44px')+';">' +
'<i class="fas fa-search" style="color:var(--text-muted);margin-right:6px;font-size:'+(isMobile?'16px':'20px')+';"></i>' +
'<input type="text" id="posSearchInput" placeholder="🔍 Rechercher..." value="'+escapeHtml(posSearchQuery)+'" onkeyup="posSearchProducts(this.value); updateClearButtonVisibility();" oninput="updateClearButtonVisibility();" style="border:none;outline:none;padding:0;width:100%;background:transparent;font-size:'+(isMobile?'16px':'24px')+';padding-right:30px;height:'+(isMobile?'38px':'44px')+';color:var(--text-primary);">' +
'<button id="posSearchClearBtn" onclick="clearPosSearch()" style="display:'+(posSearchQuery ? 'flex' : 'none')+';position:absolute;right:8px;background:none;border:none;cursor:pointer;padding:4px;color:var(--text-muted);font-size:'+(isMobile?'20px':'24px')+';align-items:center;justify-content:center;" title="Effacer la recherche"><i class="fas fa-times-circle"></i></button>' +
'</div>' +
'<button id="posMicBtn" title="Micro" style="background:var(--gray-100);border:3px solid var(--accent);border-radius:50%;width:'+(isMobile?'40px':'46px')+';height:'+(isMobile?'40px':'46px')+';cursor:pointer;color:var(--accent);" onclick="posToggleVoiceSearch()"><i class="fas fa-microphone"></i></button>' +
'<div style="display:flex;gap:4px;"><button onclick="posAfficherCommandesTables()" style="background:var(--bg-card);border:2px solid var(--border);border-radius:50px;padding:4px 10px;font-weight:600;font-size:'+(isMobile?'0.6rem':'0.7rem')+';color:var(--text-primary);cursor:pointer;">🍽️ Tables <span style="background:var(--danger);color:#fff;border-radius:20px;padding:1px 6px;">'+posCommandesTablesCount+'</span></button><button onclick="navigateTo(\'commandes\')" style="background:var(--bg-card);border:2px solid var(--border);border-radius:50px;padding:4px 10px;font-weight:600;font-size:'+(isMobile?'0.6rem':'0.7rem')+';color:var(--text-primary);cursor:pointer;">🌐 En ligne <span style="background:var(--danger);color:#fff;border-radius:20px;padding:1px 6px;">'+posCommandesEnLigneCount+'</span></button></div>' +
'</div>';

// ✅ SLIDE DES CATÉGORIES
h += '<div class="pos-categories-bar"><button class="pos-cat-btn '+(posSelectedCategory==='all'?'active':'')+'" onclick="posFilterCategory(\'all\')"><i class="fas fa-th-large"></i> Tous</button>';
var sortedCategories = posCategoriesList.slice().sort(function(a, b) {
var ordreA = (a.ordre !== undefined && a.ordre !== null) ? parseInt(a.ordre) : 9999;
var ordreB = (b.ordre !== undefined && b.ordre !== null) ? parseInt(b.ordre) : 9999;
if (ordreA !== ordreB) return ordreA - ordreB;
return (a.nom || '').localeCompare(b.nom || '');
});
for(var i=0;i<sortedCategories.length;i++){
var ca = sortedCategories[i];
var ac = posSelectedCategory===ca.nom?'active':'';
var ih = ca.imageBase64?'<img src="'+escapeHtml(ca.imageBase64)+'" loading="lazy">':'<i class="fas fa-folder"></i>';
h+='<button class="pos-cat-btn '+ac+'" onclick="posFilterCategory(\''+escapeHtml(ca.nom).replace(/'/g,"\\'")+'\')" style="padding:'+(isMobile?'4px 8px':'12px 24px')+';font-size:'+(isMobile?'16px':'0.9rem')+';gap:'+(isMobile?'4px':'10px')+';">'+ih+' '+escapeHtml(ca.nom)+'</button>';
}
h+='</div></div></div>';

// ✅ GRILLE PRODUITS - 4 colonnes partout
var gridCols = 'repeat(4, 1fr)';
h += '<div class="pos-products-grid" id="posProductGrid" style="grid-template-columns:'+gridCols+';gap:'+gridGap+';padding:'+gridPadding+';overflow-x:auto;flex-wrap:wrap;justify-content:center;"></div></div><div class="pos-cart-panel">';

if(posStep===1){
h+='<div class="pos-cart-header" style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;"><h3 style="font-size:'+(isMobile?'24px':'1rem')+';color:var(--text-primary);"><i class="fas fa-shopping-cart"></i> Panier <span class="pos-cart-badge" style="background:var(--accent);color:#fff;border-radius:50%;padding:2px 10px;font-size:'+(isMobile?'20px':'0.7rem')+';">'+posCart.length+'</span></h3><button class="pos-clear-btn" onclick="posResetCart()" style="font-size:'+(isMobile?'18px':'0.9rem')+';background:var(--danger);color:#fff;border:none;border-radius:8px;padding:'+(isMobile?'6px 12px':'8px 16px')+';cursor:pointer;"><i class="fas fa-trash-alt"></i> Vider</button></div><div class="pos-cart-items" style="max-height:'+(isMobile?'200px':'300px')+';overflow-y:auto;padding:4px;">';
if(posCart.length===0){ h+='<div class="pos-cart-empty" style="text-align:center;padding:20px;color:var(--text-muted);"><i class="fas fa-shopping-basket" style="font-size:'+(isMobile?'32px':'40px')+';"></i><p style="font-size:'+(isMobile?'20px':'1rem')+';">Panier vide</p></div>'; }
else{
for(var k=0;k<posCart.length;k++){
var it=posCart[k],opts='';
if(it.interdits&&it.interdits.length) opts+=' <span style="color:var(--danger);font-size:0.6rem;">🚫'+escapeHtml(it.interdits.join(','))+'</span>';
if(it.epice&&it.epice!=='Normal') opts+=' <span style="color:#d97706;font-size:0.6rem;">🌶️'+escapeHtml(it.epice)+'</span>';
if(it.sel&&it.sel!=='Normal') opts+=' <span style="color:#4f46e5;font-size:0.6rem;">🧂'+escapeHtml(it.sel)+'</span>';
var btnSize = isMobile ? '36px' : '28px';
var fontSize = isMobile ? '1.1rem' : '0.7rem';
var qtySize = isMobile ? '1.2rem' : '0.85rem';
var nameSize = isMobile ? '22px' : '0.85rem';
var priceSize = isMobile ? '0.7rem' : '0.7rem';
var totalSize = isMobile ? '24px' : '0.8rem';
h+='<div class="pos-cart-item" style="display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--border);gap:8px;">' +
'<div class="pos-cart-item-info" style="flex:1;min-width:0;">' +
'<span class="pos-cart-item-name" style="font-size:'+nameSize+';font-weight:600;display:block;margin-right:10px;word-break:break-word;color:var(--text-primary);">'+escapeHtml(it.nom)+opts+'</span>' +
'<span class="pos-cart-item-price" style="font-size:'+priceSize+';color:var(--text-secondary);">'+it.prixUnitaire.toFixed(2)+' MAD/u</span>' +
'</div>' +
'<div class="pos-cart-item-actions" style="display:flex;align-items:center;gap:6px;flex-shrink:0;">' +
'<button class="pos-qty-btn" onclick="posUpdateQty('+k+',-1)" style="width:'+btnSize+';height:'+btnSize+';border-radius:50%;border:2px solid var(--border);background:var(--bg-card);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:'+fontSize+';transition:var(--transition);box-shadow:var(--shadow-xs);color:var(--text-primary);"><i class="fas fa-minus"></i></button>' +
'<span class="pos-qty-value" style="font-size:'+qtySize+';font-weight:700;min-width:32px;text-align:center;color:var(--text-primary);">'+it.quantite+'</span>' +
'<button class="pos-qty-btn" onclick="posUpdateQty('+k+',1)" style="width:'+btnSize+';height:'+btnSize+';border-radius:50%;border:2px solid var(--border);background:var(--bg-card);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:'+fontSize+';transition:var(--transition);box-shadow:var(--shadow-xs);color:var(--text-primary);"><i class="fas fa-plus"></i></button>' +
'<button class="pos-remove-btn" onclick="posRemoveItem('+k+')" style="background:none;border:none;color:var(--danger);cursor:pointer;padding:4px;font-size:1.1rem;transition:var(--transition);"><i class="fas fa-times"></i></button>' +
'</div>' +
'<span class="pos-cart-item-total" style="font-size:'+totalSize+';font-weight:700;min-width:80px;text-align:right;flex-shrink:0;color:var(--text-primary);">'+(it.prixUnitaire*it.quantite).toFixed(2)+' MAD</span>' +
'</div>';
}
}
h+='</div><div style="padding:8px 0;display:flex;gap:8px;align-items:center;"><label style="font-size:'+(isMobile?'20px':'1rem')+';color:var(--text-primary);">Remise:</label><input type="number" id="posDiscountMAD" value="'+posDiscountMAD+'" min="0" step="0.01" onchange="posUpdateDiscountMAD(this.value)" style="width:80px;padding:6px;border:2px solid var(--border);border-radius:6px;font-size:'+(isMobile?'20px':'1rem')+';background:var(--bg-card);color:var(--text-primary);"></div><div class="pos-cart-footer" style="padding:8px 0;">'+(posDiscountMAD>0?'<div style="display:flex;justify-content:space-between;font-size:'+(isMobile?'20px':'1.1rem')+';color:var(--text-primary);"><span>Sous-total</span><span>'+st.toFixed(2)+'</span></div><div style="display:flex;justify-content:space-between;color:var(--danger);font-size:'+(isMobile?'20px':'1.1rem')+';"><span>Remise</span><span>-'+posDiscountMAD.toFixed(2)+'</span></div>':'')+'<div class="pos-cart-total-row" style="display:flex;justify-content:space-between;font-size:'+(isMobile?'28px':'30px')+';font-weight:700;padding:8px 0;border-top:2px solid var(--border);color:var(--text-primary);"><span>Total</span><span>'+t.toFixed(2)+' MAD</span></div>' +
'<button class="pos-validate-btn" onclick="posGoToStep2()" '+(posCart.length===0?'disabled':'')+' style="width:100%;padding:16px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:26px;font-weight:700;height:60px;cursor:pointer;transition:var(--transition);display:flex;align-items:center;justify-content:center;gap:8px;"><i class="fas fa-check-circle"></i> Valider</button></div>';
}else{
var canCredit=posCurrentClient&&posCurrentClient.id;
var creditDisplay = '';
if (posCurrentClient && posCurrentClient.id) {
creditDisplay = '<div id="clientCreditDisplay" style="font-size:28px;font-weight:700;padding:4px 0;text-align:right;color:var(--text-primary);"></div>';
}
h+='<div class="pos-cart-header"><h3 style="color:var(--text-primary);"><i class="fas fa-credit-card"></i> Paiement</h3></div><div class="pos-payment-form"><div style="margin-bottom:4px;"><label style="font-size:20px;font-weight:600;color:var(--text-secondary);">Client</label><div style="position:relative;">' +
'<div style="display:flex;align-items:center;background:var(--bg-card);border:2px solid var(--border);border-radius:8px;padding:2px 12px;position:relative;">' +
'<input type="text" id="posClientSearchInput" placeholder="🔍 Cliquez et tapez..." onkeyup="posSearchClient(this.value)" onfocus="if(this.value)posSearchClient(this.value)" autocomplete="off" value="'+(posCurrentClient?escapeHtml(posCurrentClient.name):'')+'" style="border:none;outline:none;padding:8px 0;width:100%;background:transparent;font-size:28px !important;font-weight:700 !important;padding-right:30px;color:var(--text-primary);">' +
'<button id="posClientClearBtn" onclick="clearClientSearch()" style="display:'+((posCurrentClient && posCurrentClient.name) ? 'flex' : 'none')+';position:absolute;right:8px;background:none;border:none;cursor:pointer;padding:4px;color:var(--text-muted);font-size:1.3rem;align-items:center;justify-content:center;" title="Effacer le client"><i class="fas fa-times-circle"></i></button>' +
'</div>' +
'<div id="posClientDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-card);border:2px solid var(--border);border-radius:0 0 8px 8px;max-height:200px;overflow-y:auto;z-index:50;"></div></div>'+creditDisplay+'</div><div style="margin:2px 0;font-size:0.7rem;text-align:center;color:var(--text-muted);">— OU —</div><div style="margin-bottom:4px;"><label style="font-size:20px;font-weight:600;color:var(--text-secondary);">Table</label><input type="text" id="posTableNum" value="'+escapeHtml(posCurrentTable)+'" onchange="posSetTable(this.value)" style="width:100%;padding:8px;border:2px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text-primary);"></div><div style="margin-bottom:4px;"><div style="padding:8px;background:var(--bg-page);border-radius:8px;border:1px solid var(--border);">' +
'<div style="font-size:30px;font-weight:600;color:var(--text-primary);">Articles: '+posCart.length+'</div>' +
(posDiscountMAD>0?'<div style="color:var(--danger);font-size:30px;font-weight:600;">Remise: -'+posDiscountMAD.toFixed(2)+'</div>':'') +
'<div style="font-size:30px;font-weight:700;color:var(--text-primary);">Total: '+t.toFixed(2)+' MAD</div></div></div><div style="margin-bottom:4px;"><label style="font-size:20px;font-weight:600;color:var(--text-secondary);">Vendeur</label><input type="text" id="posVendeur" value="'+(window.currentUserData?escapeHtml(window.currentUserData.userData.prenom+' '+window.currentUserData.userData.nom):'')+'" style="width:100%;padding:8px;border:2px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text-primary);"></div><div style="margin-bottom:4px;"><div style="display:flex;gap:6px;">' +
'<button class="pos-payment-btn '+(posPaymentMethod==='espece'?'active':'')+'" onclick="posSetPaymentMethod(\'espece\')" style="font-size:24px !important;font-weight:700 !important;padding:16px 20px;height:auto;min-height:65px;"><i class="fas fa-money-bill-wave"></i> Espèces</button>' +
'<button class="pos-payment-btn '+(posPaymentMethod==='credit'?'active':'')+'" onclick="posSetPaymentMethod(\'credit\')" id="posCreditBtn" '+(canCredit?'':'disabled style="opacity:0.4;"')+' style="font-size:24px !important;font-weight:700 !important;padding:16px 20px;height:auto;min-height:65px;"><i class="fas fa-credit-card"></i> Crédit</button>' +
'<button class="pos-payment-btn '+(posPaymentMethod==='partiel'?'active':'')+'" onclick="posSetPaymentMethod(\'partiel\')" id="posPartielBtn" '+(canCredit?'':'disabled style="opacity:0.4;"')+' style="font-size:24px !important;font-weight:700 !important;padding:16px 20px;height:auto;min-height:65px;"><i class="fas fa-hand-holding-usd"></i> Partiel</button>' +
'</div></div>';
if(posPaymentMethod==='espece'||posPaymentMethod==='partiel') {
h+='<div style="margin-bottom:4px;"><label style="font-size:20px;font-weight:600;color:var(--text-secondary);">Montant donné</label><input type="number" id="posAmountGiven" placeholder="0.00" value="'+(posAmountGiven>0?posAmountGiven:'')+'" onkeyup="posCalculateChange()" style="width:100%;padding:14px;border:2px solid var(--border);border-radius:8px;font-size:36px !important;font-weight:700 !important;background:var(--bg-card);color:var(--text-primary);"><div id="posChangeDisplay" style="font-size:40px;font-weight:700;padding:8px 0;margin-right:20px;color:var(--text-primary);"></div></div>';
}
h+='<button class="pos-finalize-btn" onclick="posFinalizeSale()" style="width:100%;padding:16px;margin-top:8px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:24px !important;font-weight:700 !important;min-height:65px;cursor:pointer;transition:var(--transition);"><i class="fas fa-check-circle"></i> Finaliser</button></div>';
}
h+='</div></div>'; c.innerHTML=h;

setStaticBackButtonVisibility(posStep === 2);

if(posStep===1) {
posViewMode = 'categories';
posSelectedCategoryForView = null;
filterProductGrid();
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
cd.innerHTML='<div style="font-size:40px;font-weight:700;color:#16a34a;display:flex;align-items:center;justify-content:flex-start;"><span>✅ Rendu</span><span style="margin-left:20px;margin-right:20px;">'+c.toFixed(2)+' MAD</span></div>';
} else {
cd.innerHTML='<div style="font-size:40px;font-weight:700;color:var(--danger);display:flex;align-items:center;justify-content:flex-start;"><span>❌ Manquant</span><span style="margin-left:20px;margin-right:20px;">'+Math.abs(c).toFixed(2)+' MAD</span></div>';
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
var modalHtml = '<p style="text-align:center;color:var(--text-primary);">Voulez-vous envoyer la facture par WhatsApp ?</p><div style="display:flex;justify-content:center;gap:10px;margin-top:15px;"><button class="btn-save" id="whatsappYesBtn">✅ Oui</button><button class="btn-cancel" id="whatsappNoBtn">❌ Non</button></div>';
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

function goBackToPOS(){ if(window.currentUserData&&(window.currentUserData.userData.role==='caissier'||window.currentUserData.userData.role==='admin')){ if(posCart.length>0&&posStep===1){ if(!confirm('⚠️ '+posCart.length+' article(s) dans le panier. Garder ?')) posResetCart(); } navigateTo('pos'); } }
if(!window._posKeydownListenerAdded){ window._posKeydownListenerAdded=true; document.addEventListener('keydown',function(event){ if(event.key==='Escape'){ var cp=document.getElementById('pageTitle')?.textContent||''; if(cp!=='POS'&&cp!=='Dashboard'&&cp!=='') goBackToPOS(); } if(event.ctrlKey&&(event.key==='p'||event.key==='P')){ event.preventDefault(); if((document.getElementById('pageTitle')?.textContent||'')!=='POS') navigateTo('pos'); } }); }

function posToggleVoiceSearch() {
    if (typeof window.toggleVoiceSearch === 'function') {
        window.toggleVoiceSearch();
    } else {
        alert('Fonction de recherche vocale non disponible');
    }
}

window.posCart=posCart; window.posStep=posStep; window.posProductsList=posProductsList; window.posAllClients=posAllClients; window.posCurrentClient=posCurrentClient; window.posCurrentTable=posCurrentTable; window.posDiscountMAD=posDiscountMAD; window.posAmountGiven=posAmountGiven; window.posPaymentMethod=posPaymentMethod; window.posResetCart=posResetCart; window.posAddToCartOrOpenOptions=posAddToCartOrOpenOptions; window.posSetPaymentMethod=posSetPaymentMethod; window.posCalculateTotal=posCalculateTotal; window.posFinalizeSale=posFinalizeSale; window.posGoToStep2=posGoToStep2; window.posGoToStep1=posGoToStep1; window.posSearchProducts=posSearchProducts; window.clearPosSearch=clearPosSearch; window.clearClientSearch=clearClientSearch; window.updateClearButtonVisibility=updateClearButtonVisibility; window.updateCartOnly=updateCartOnly; window.renderPOS=renderPOS; window.updatePaymentButtons=updatePaymentButtons; window.loadMoreProducts=loadMoreProducts; window.loadClientCredits=loadClientCredits; window.updateClientCreditDisplay=updateClientCreditDisplay; window.posCalculateChange=posCalculateChange; window.onProductAdded=window.onProductAdded||function(pid){ console.log('Produit ajouté:',pid); };
window.posNaviguerEtape = posNaviguerEtape;
window.buildFullPOS = buildFullPOS;
window.afficherCategories = afficherCategories;
window.selectionnerCategorie = selectionnerCategorie;
window.retournerCategories = retournerCategories;
window.posFilterCategory = posFilterCategory;
window.posViewMode = posViewMode;
window.posSelectedCategoryForView = posSelectedCategoryForView;
window.posToggleVoiceSearch = posToggleVoiceSearch;
window.toggleSearchBar = toggleSearchBar;

console.log('🚀 E-SOLUTION - POS chargé (4 colonnes partout)');
