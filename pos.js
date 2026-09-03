// ==================== POS.JS - E-SOLUTION (VERSION COMPLÈTE AVEC MODE CATÉGORIES) ====================
// Point de vente complet avec mode catégories
// ✅ Nom produit peut sauter à la ligne
// ✅ Image taille fixe et conteneur agrandi
// ✅ Pas de scroll horizontal
// ✅ Panier 20% - Produits 80% en hauteur
// ✅ Espace en dessous du bouton Valider
// ✅ Clic sur "Panier" scroll vers le bas
// ✅ Bouton flèche ↑ scroll vers le haut
// ✅ Vente impossible si panier vide
// ✅ Retour automatique à l'étape 1 après finalisation
// ✅ CA et Profit client mis à jour (FORCE UPDATE)
// ✅ Bouton "Afficher tout" corrigé
// ✅ Affichage crédit client cliquable - REDIRECTION VERS PAGE CRÉDITS AVEC SAUVEGARDE D'ÉTAT

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

// ✅ MODE CATÉGORIES / PRODUITS
var posViewMode = 'categories';
var posSelectedCategoryForView = null;

// ======================================================
// ✅ FONCTION DE FORCE POUR METTRE À JOUR LE CLIENT
// ======================================================
async function forceUpdateClient(clientId, total, profitTotal) {
try {
console.log('🔥 FORCE UPDATE CLIENT:', clientId);
console.log(' - CA à ajouter:', total);
console.log(' - Profit à ajouter:', profitTotal);

if (!clientId) {
console.warn('⚠️ Client ID manquant');
return false;
}

const docRef = db.collection('clients').doc(clientId);
const doc = await docRef.get();

if (!doc.exists) {
console.error('❌ Client non trouvé:', clientId);
return false;
}

const data = doc.data();
const ancienCA = data.ca || 0;
const ancienProfit = data.profit || 0;
const nouveauCA = ancienCA + total;
const nouveauProfit = ancienProfit + profitTotal;

console.log(' - Ancien CA:', ancienCA, '→ Nouveau CA:', nouveauCA);
console.log(' - Ancien Profit:', ancienProfit, '→ Nouveau Profit:', nouveauProfit);

await docRef.update({
ca: nouveauCA,
profit: nouveauProfit,
updatedAt: firebase.firestore.FieldValue.serverTimestamp()
});
console.log('✅ Firestore mis à jour');

const updatedData = {
...data,
ca: nouveauCA,
profit: nouveauProfit,
updatedAt: new Date()
};
await CacheDB.set('clients', clientId, updatedData);
console.log('✅ Cache mis à jour');

const clientIndex = posAllClients.findIndex(c => c.id === clientId);
if (clientIndex !== -1) {
posAllClients[clientIndex].ca = nouveauCA;
posAllClients[clientIndex].profit = nouveauProfit;
console.log('✅ posAllClients mis à jour');
}

const filteredIndex = posFilteredClients.findIndex(c => c.id === clientId);
if (filteredIndex !== -1) {
posFilteredClients[filteredIndex].ca = nouveauCA;
posFilteredClients[filteredIndex].profit = nouveauProfit;
}

if (posCurrentClient && posCurrentClient.id === clientId) {
posCurrentClient.ca = nouveauCA;
posCurrentClient.profit = nouveauProfit;
console.log('✅ posCurrentClient mis à jour');
}

if (window.allClientsData) {
const adminIndex = window.allClientsData.findIndex(c => c.id === clientId);
if (adminIndex !== -1) {
window.allClientsData[adminIndex].ca = nouveauCA;
window.allClientsData[adminIndex].profit = nouveauProfit;
console.log('✅ window.allClientsData mis à jour');
}
}

console.log('✅ Client mis à jour avec succès !');
console.log('📊 NOUVELLES VALEURS - CA:', nouveauCA, 'Profit:', nouveauProfit);

return true;

} catch(e) {
console.error('❌ Erreur forceUpdateClient:', e);
return false;
}
}

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

// ==================== OPTIMISATION : PRÉCHARGEMENT DU POS ====================
async function preloadPosData() {
    if (typeof CacheDB === 'undefined') return;
    
    try {
        const results = await Promise.allSettled([
            CacheDB.getAll('categories'),
            CacheDB.getAll('products'),
            CacheDB.getAll('clients'),
            CacheDB.getAll('stock')
        ]);
        
        console.log('⚡ Données POS préchargées en parallèle:', results.length, 'collections');
    } catch(e) {
        console.warn('Erreur préchargement POS:', e);
    }
}

// Lancer le préchargement immédiatement
preloadPosData();

// ==================== TOGGLE OUTILS POS - CORRIGÉ ====================
function posToggleTools() {
    posToolsVisible = !posToolsVisible;
    var toolsContainer = document.getElementById('posToolsContainer');
    var toggleBtn = document.getElementById('posToggleToolsBtn');

    console.log('🔍 Toggle outils POS - État:', posToolsVisible);

    if (toolsContainer) {
        if (posToolsVisible) {
            toolsContainer.style.display = 'flex';
            toolsContainer.style.flexDirection = 'column';
            toolsContainer.style.gap = '4px';
            toolsContainer.style.marginBottom = '4px';
            toolsContainer.style.padding = '5px 8px';
            toolsContainer.style.background = 'var(--bg-page)';
            toolsContainer.style.borderRadius = '6px';
            toolsContainer.style.border = '1px solid var(--border)';
            var children = toolsContainer.querySelectorAll('*');
            children.forEach(function(child) {
                child.style.display = '';
            });
        } else {
            toolsContainer.style.display = 'none';
        }
    }

    if (toggleBtn) {
        toggleBtn.innerHTML = posToolsVisible ? '✕ Masquer tout' : '🔍 Afficher tout';
        toggleBtn.style.background = posToolsVisible ? '#ef4444' : '#14B8A6';
    }

    var searchInput = document.getElementById('posSearchInput');
    if (searchInput) {
        searchInput.style.display = posToolsVisible ? '' : 'none';
        if (posToolsVisible) {
            setTimeout(function() { searchInput.focus(); }, 100);
        }
    }

    var micBtn = document.getElementById('posMicBtn');
    if (micBtn) {
        micBtn.style.display = posToolsVisible ? '' : 'none';
    }

    var tablesBtn = document.querySelector('button[onclick*="posAfficherCommandesTables"]');
    if (tablesBtn) {
        tablesBtn.style.display = posToolsVisible ? '' : 'none';
    }

    var enligneBtn = document.querySelector('button[onclick*="navigateTo(\'commandes\')"]');
    if (enligneBtn) {
        enligneBtn.style.display = posToolsVisible ? '' : 'none';
    }

    var categoriesBar = document.querySelector('.pos-categories-bar');
    if (categoriesBar) {
        categoriesBar.style.display = posToolsVisible ? '' : 'none';
    }
}

// ==================== APPLIQUER LE SCROLL SUR DYNAMICCONTENT ====================
function applyDynamicContentScroll() {
var container = document.getElementById('dynamicContent');
if (container) {
container.style.overflowY = 'auto';
container.style.overflowX = 'hidden';
container.style.height = '100vh';
container.style.maxHeight = '100vh';
container.style.paddingBottom = '20px';
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

// ✅ VERSION MODIFIÉE : affichage crédit cliquable - REDIRECTION VERS PAGE CRÉDITS AVEC SAUVEGARDE D'ÉTAT
async function updateClientCreditDisplay(clientId) {
    var displayEl = document.getElementById('clientCreditDisplay');
    if (!displayEl) return;
    if (!clientId) {
        displayEl.textContent = '';
        displayEl.style.display = 'none';
        displayEl.onclick = null;
        return;
    }
    var total = await loadClientCredits(clientId);
    if (total > 0) {
        displayEl.textContent = '💳 Crédit: ' + total.toFixed(2) + ' MAD (cliquez pour voir)';
        displayEl.style.display = 'block';
        displayEl.style.color = '#ef4444';
        displayEl.style.fontWeight = '700';
        displayEl.style.fontSize = '28px';
        displayEl.style.cursor = 'pointer';
        displayEl.style.textDecoration = 'underline';
        displayEl.style.textDecorationStyle = 'dotted';
        displayEl.onclick = function() {
            // ✅ SAUVEGARDER L'ÉTAT COMPLET DU POS AVANT DE QUITTER
            var posState = {
                cart: posCart,
                step: posStep,
                client: posCurrentClient,
                table: posCurrentTable,
                paymentMethod: posPaymentMethod,
                discountMAD: posDiscountMAD,
                amountGiven: posAmountGiven,
                timestamp: Date.now()
            };
            localStorage.setItem('posSavedState', JSON.stringify(posState));
            console.log('💾 État POS sauvegardé:', posState);
            
            // Sauvegarder le client sélectionné pour la page crédits
            var clientName = posCurrentClient ? posCurrentClient.name : '';
            var clientId = posCurrentClient ? posCurrentClient.id : '';
            localStorage.setItem('posSelectedCreditClientId', clientId);
            localStorage.setItem('posSelectedCreditClientName', clientName);
            
            // Naviguer vers la page crédits
            navigateTo('credits');
        };
    } else {
        displayEl.textContent = '✅ Aucun crédit';
        displayEl.style.display = 'block';
        displayEl.style.color = '#14B8A6';
        displayEl.style.fontWeight = '700';
        displayEl.style.fontSize = '28px';
        displayEl.style.cursor = 'default';
        displayEl.style.textDecoration = 'none';
        displayEl.onclick = null;
    }
}

// ============================================================
// ✅ loadPosPage - VERSION CORRIGÉE AVEC RESTAURATION AVANT RESET
// ============================================================
async function loadPosPage(c){
applyDynamicContentScroll();

// ✅ RESTAURER L'ÉTAT POS AVANT TOUT
var savedState = localStorage.getItem('posSavedState');
var shouldRestore = false;
var restoredState = null;

if (savedState) {
    try {
        var state = JSON.parse(savedState);
        if (state.timestamp && (Date.now() - state.timestamp) < 300000) {
            shouldRestore = true;
            restoredState = state;
            console.log('🔄 État POS trouvé pour restauration:', state);
        } else {
            localStorage.removeItem('posSavedState');
        }
    } catch(e) {
        console.warn('⚠️ Erreur lecture état POS:', e);
        localStorage.removeItem('posSavedState');
    }
}

// ✅ Si on restaure, on NE réinitialise PAS le panier
if (!shouldRestore) {
    posResetCart();
    posStep = 1;
} else {
    // ✅ Restaurer l'état sans réinitialiser
    posCart = restoredState.cart || [];
    posStep = restoredState.step || 1;
    posCurrentClient = restoredState.client || null;
    posCurrentTable = restoredState.table || '';
    posPaymentMethod = restoredState.paymentMethod || 'espece';
    posDiscountMAD = restoredState.discountMAD || 0;
    posAmountGiven = restoredState.amountGiven || 0;
    
    console.log('✅ État POS restauré avec succès');
    console.log('📦 Panier:', posCart.length, 'articles');
    console.log('👤 Client:', posCurrentClient ? posCurrentClient.name : 'Aucun');
    console.log('💳 Mode paiement:', posPaymentMethod);
    console.log('💰 Montant donné:', posAmountGiven);
}

posCommandesFilterText=''; posCommandesSortField='createdAt'; posCommandesSortOrder='desc'; posSearchQuery=''; productIndexBuilt=false; posProductOffset=0; posToolsVisible=false;
posCategoriesList=[]; posProductsList=[]; posAllClients=[]; posFilteredClients=[];
c.innerHTML='<div style="text-align:center;padding:60px;"><i class="fas fa-spinner fa-spin" style="font-size:2.5rem;color:#14B8A6;"></i><p style="margin-top:15px;color:#64748b;">Chargement du POS...</p></div>';
setStaticBackButtonVisibility(false);

// ✅ Nettoyer l'état sauvegardé après restauration (pour éviter double restauration)
if (shouldRestore) {
    localStorage.removeItem('posSavedState');
}

// ✅ OPTIMISATION : Charger depuis le cache en PRIORITÉ (RAPIDE)
try {
    let [cc, cp, cl] = await Promise.all([
        CacheDB.getAll('categories'),
        CacheDB.getAll('products'),
        CacheDB.getAll('clients')
    ]);
    
    if (cc.length) { 
        posCategoriesList = cc.map(x => ({ id: x.id, nom: x.nom, imageBase64: x.imageBase64, recette: x.recette || false, ordre: x.ordre || 0 })); 
    }
    if (cp.length) { 
        posProductsList = cp.filter(x => x.disponible !== false).map(x => ({ ...x, description: x.description || '' })); 
        productIndexBuilt = false; 
    }
    if (cl.length) { 
        posAllClients = cl.map(x => ({ id: x.id, nom: x.nom, prenom: x.prenom, telephone: x.telephone, description: x.description || '' })); 
        posFilteredClients = [...posAllClients]; 
    }
    
    if (isOnPOSPage()) renderPOS();
    if (typeof window.buildClientIndex === 'function') window.buildClientIndex();
    if (typeof window.buildProductIndex === 'function') window.buildProductIndex();
} catch(e) { console.error(e); }

// ✅ Mettre à jour depuis Firestore en arrière-plan (SYNCHRONISATION)
setTimeout(async function(){
try{
const [cs, ps, cl] = await Promise.all([
    db.collection('categories').get(),
    db.collection('products').get(),
    db.collection('clients').limit(500).get()
]);

posCategoriesList=[]; cs.forEach(d=>{ let cat={id:d.id,nom:d.data().nom,imageBase64:d.data().imageBase64,recette:d.data().recette||false,ordre:d.data().ordre||0}; posCategoriesList.push(cat); CacheDB.set('categories',d.id,cat); });
posProductsList=[]; ps.forEach(d=>{ let dd=d.data(); if(dd.disponible!==false){ let prod={id:d.id,nom:dd.nom||'',description:dd.description||'',prixVente:dd.prixVente||0,prixPromo:dd.prixPromo||0,prixAchat:dd.prixAchat||0,stock:dd.stock,categorie:dd.categorie||'',categories:dd.categories||[],imageBase64:dd.imageBase64||'',favori:dd.favori||false}; posProductsList.push(prod); CacheDB.set('products',d.id,prod); } }); productIndexBuilt=false;
posAllClients=[]; cl.forEach(d=>{ let data=d.data(),cli={id:d.id,nom:data.nom,prenom:data.prenom,telephone:data.telephone,description:data.description||''}; posAllClients.push(cli); CacheDB.set('clients',d.id,cli); }); posFilteredClients=[...posAllClients];
if(isOnPOSPage()) renderPOS();
if (typeof window.buildClientIndex === 'function') window.buildClientIndex();
if (typeof window.buildProductIndex === 'function') window.buildProductIndex();
}catch(e){ console.error(e); }
}, 300);

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

// ✅ Si on a restauré l'état et qu'on est à l'étape 2, remplir les champs
if (shouldRestore && posStep === 2) {
    setTimeout(function() {
        var amountInput = document.getElementById('posAmountGiven');
        if (amountInput && posAmountGiven > 0) {
            amountInput.value = posAmountGiven.toFixed(2);
            if (typeof posCalculateChange === 'function') posCalculateChange();
        }
        if (posCurrentClient && posCurrentClient.id) {
            updateClientCreditDisplay(posCurrentClient.id);
        }
        if (posCurrentClient && posCurrentClient.name) { 
            var ci = document.getElementById('posClientSearchInput'); 
            if (ci) ci.value = posCurrentClient.name; 
        }
        if (typeof window.updatePaymentButtons === 'function') window.updatePaymentButtons();
    }, 500);
}

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

// ==================== AFFICHER LES CATÉGORIES - VERSION CORRIGÉE ====================
function afficherCategories(grid) {
var isMobile = window.innerWidth < 700;
var isTablette = window.innerWidth >= 700 && window.innerWidth <= 1024;
var isPC = window.innerWidth > 1024;

var gridCols = isMobile ? 'repeat(3, 1fr)' : (isTablette ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)');
grid.style.gridTemplateColumns = gridCols;
grid.style.overflowX = 'hidden';
grid.style.overflowY = 'auto';
grid.style.flexWrap = 'wrap';
grid.style.alignContent = 'start';

var html = '';

html += '<div style="grid-column:1/-1;padding:6px 8px;font-size:0.9rem;font-weight:700;color:var(--text-primary);">';
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

var imgSize, cardMinHeight, cardMaxHeight, folderSize, nameSize, countSize;

if (isPC) {
imgSize = '140px';
cardMinHeight = '160px';
cardMaxHeight = '200px';
folderSize = '65px';
nameSize = '16px';
countSize = '12px';
} else if (isTablette) {
imgSize = '130px';
cardMinHeight = '150px';
cardMaxHeight = '180px';
folderSize = '60px';
nameSize = '13px';
countSize = '10px';
} else {
imgSize = '45px';
cardMinHeight = '65px';
cardMaxHeight = '80px';
folderSize = '20px';
nameSize = '8px';
countSize = '7px';
}

if (window.innerWidth < 400) {
imgSize = '35px';
cardMinHeight = '50px';
cardMaxHeight = '65px';
folderSize = '16px';
nameSize = '7px';
countSize = '6px';
}

for (var i = 0; i < sortedCategories.length; i++) {
var cat = sortedCategories[i];
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
imgContent = '<i class="fas fa-folder" style="font-size:' + folderSize + ';color:var(--accent);"></i>';
}

var cardStyle = 'min-height:' + cardMinHeight + ';max-height:' + cardMaxHeight + ';' +
'padding:8px 4px;border-radius:10px;' +
'border:2px solid transparent;' +
'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
'width:100%;background:var(--bg-page);cursor:pointer;' +
'transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1);gap:2px;';

var imgStyle = 'width:' + imgSize + ';height:' + imgSize + ';' +
'border-radius:50%;overflow:hidden;flex-shrink:0;' +
'background:var(--gray-100);display:flex;align-items:center;justify-content:center;' +
'margin-bottom:2px;border:2px solid var(--gray-200);';

var nameStyle = 'font-size:' + nameSize + ';font-weight:700;text-align:center;' +
'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
'max-width:100%;color:var(--text-primary);margin-top:2px;line-height:1.2;display:block;';

var countStyle = 'font-size:' + countSize + ';color:var(--text-muted);' +
'font-weight:500;display:block;margin-top:0px;';

html += '<div class="pos-category-card" data-cat-name="' + escapeHtml(cat.nom) + '" style="' + cardStyle + '" ' +
'onclick="selectionnerCategorie(\'' + escapeHtml(cat.nom).replace(/'/g, "\\'") + '\')"' +
'onmouseover="if(!this.classList.contains(\'active\')){this.style.borderColor=\'var(--accent)\';this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'var(--shadow-md)\';}"' +
'onmouseout="if(!this.classList.contains(\'active\')){this.style.borderColor=\'transparent\';this.style.transform=\'translateY(0)\';this.style.boxShadow=\'none\';}">' +
'<div style="' + imgStyle + '">' + imgContent + '</div>' +
'<span style="' + nameStyle + '">' + escapeHtml(cat.nom) + '</span>' +
'<span style="' + countStyle + '">' + count + ' produit' + (count > 1 ? 's' : '') + '</span>' +
'</div>';
}
}

grid.innerHTML = html;
}

// ==================== SÉLECTIONNER UNE CATÉGORIE - AVEC BORDURE VERTE ====================
function selectionnerCategorie(catName) {
document.querySelectorAll('.pos-category-card').forEach(function(card) {
card.classList.remove('active');
card.style.borderColor = 'transparent';
card.style.transform = 'translateY(0)';
card.style.boxShadow = 'none';
});

document.querySelectorAll('.pos-category-card').forEach(function(card) {
var nameSpan = card.querySelector('span:first-of-type');
var catNameAttr = card.getAttribute('data-cat-name');
if (nameSpan && nameSpan.textContent.trim() === catName) {
card.classList.add('active');
card.style.borderColor = '#14B8A6';
card.style.transform = 'translateY(-2px)';
card.style.boxShadow = '0 4px 12px rgba(20,184,166,0.25)';
}
});

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
document.querySelectorAll('.pos-category-card').forEach(function(card) {
card.classList.remove('active');
card.style.borderColor = 'transparent';
card.style.transform = 'translateY(0)';
card.style.boxShadow = 'none';
});

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

// ==================== updateCartOnly - NOM SUR UNE LIGNE ====================
function updateCartOnly(){
if(!isOnPOSPage()) return;
var ci=document.querySelector('.pos-cart-items');
if(!ci) return;
var html='';
if(posCart.length===0) {
html='<div class="pos-cart-empty"><i class="fas fa-shopping-basket"></i><p>Panier vide</p></div>';
} else {
var isMobile = window.innerWidth < 700;

for(var k=0;k<posCart.length;k++){
var it=posCart[k], opts='';
if(it.interdits&&it.interdits.length) opts+=' <span style="color:#ef4444;font-size:0.5rem;">🚫'+escapeHtml(it.interdits.join(','))+'</span>';
if(it.epice&&it.epice!=='Normal') opts+=' <span style="color:#d97706;font-size:0.5rem;">🌶️'+escapeHtml(it.epice)+'</span>';
if(it.sel&&it.sel!=='Normal') opts+=' <span style="color:#4f46e5;font-size:0.5rem;">🧂'+escapeHtml(it.sel)+'</span>';

var btnSize = isMobile ? '28px' : '24px';
var fontSize = isMobile ? '0.6rem' : '0.5rem';
var qtySize = isMobile ? '0.8rem' : '0.65rem';
var nameSize = isMobile ? '13px' : '0.7rem';
var priceSize = isMobile ? '0.5rem' : '0.5rem';
var totalSize = isMobile ? '14px' : '0.65rem';

html+='<div class="pos-cart-item" style="display:flex;align-items:center;justify-content:space-between;padding:4px 2px;border-bottom:1px solid var(--border);gap:4px;">' +
'<div class="pos-cart-item-info" style="flex:1;min-width:0;display:flex;flex-direction:column;">' +
'<span class="pos-cart-item-name" style="font-size:'+nameSize+';font-weight:600;display:block;word-break:break-word;white-space:normal;line-height:1.3;">'+escapeHtml(it.nom)+opts+'</span>' +
'<span class="pos-cart-item-price" style="font-size:'+priceSize+';color:var(--text-secondary);">'+it.prixUnitaire.toFixed(2)+' MAD</span>' +
'</div>' +
'<div class="pos-cart-item-actions" style="display:flex;align-items:center;gap:3px;flex-shrink:0;">' +
'<button class="pos-qty-btn" onclick="posUpdateQty('+k+',-1)" style="width:'+btnSize+';height:'+btnSize+';border-radius:50%;border:2px solid var(--border);background:var(--white);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:'+fontSize+';transition:all 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.05);"><i class="fas fa-minus"></i></button>' +
'<span class="pos-qty-value" style="font-size:'+qtySize+';font-weight:700;min-width:20px;text-align:center;">'+it.quantite+'</span>' +
'<button class="pos-qty-btn" onclick="posUpdateQty('+k+',1)" style="width:'+btnSize+';height:'+btnSize+';border-radius:50%;border:2px solid var(--border);background:var(--white);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:'+fontSize+';transition:all 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.05);"><i class="fas fa-plus"></i></button>' +
'<button class="pos-remove-btn" onclick="posRemoveItem('+k+')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:2px;font-size:0.8rem;transition:all 0.2s;"><i class="fas fa-times"></i></button>' +
'</div>' +
'<span class="pos-cart-item-total" style="font-size:'+totalSize+';font-weight:700;min-width:50px;text-align:right;flex-shrink:0;">'+(it.prixUnitaire*it.quantite).toFixed(2)+' MAD</span>' +
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

// ==================== buildFullPOS AVEC HAUTEURS CORRIGÉES ====================
function buildFullPOS(c){
if(posProductsList.length===0&&posCategoriesList.length===0){ c.innerHTML='<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#14B8A6;"></i><p>Chargement...</p></div>'; return; }
var st=posCalculateTotal(),t=st-posDiscountMAD;
var isMobile = window.innerWidth < 700;
var productPanelStyle = posStep===2 ? ' style="display:none;"' : '';

var stepSize = isMobile ? '16px' : '18px';
var stepNumberSize = isMobile ? '16px' : '18px';
var stepNumberSize2 = isMobile ? '22px' : '26px';
var stepGap = isMobile ? '8px' : '12px';

var stepIndicator = '<div class="pos-steps-nav" style="display:flex; justify-content:center; gap:'+stepGap+'; margin-bottom:4px; padding:4px 10px; background:var(--bg-page); border-radius:var(--radius); cursor:default;">' +
'<div class="pos-step ' + (posStep === 1 ? 'active' : '') + '" style="display:flex; align-items:center; gap:4px; font-size:'+stepSize+'; font-weight:600; color:' + (posStep === 1 ? 'var(--black)' : 'var(--text-muted)') + '; cursor:pointer;" onclick="posNaviguerEtape(1)">' +
'<span class="step-number" style="display:inline-flex; align-items:center; justify-content:center; width:'+stepNumberSize2+'; height:'+stepNumberSize2+'; border-radius:50%; background:' + (posStep === 1 ? 'var(--black)' : 'var(--gray-200)') + '; color:' + (posStep === 1 ? 'var(--white)' : 'var(--text-muted)') + '; font-size:'+stepNumberSize+'; font-weight:700;">1</span>' +
'<span style="font-size:'+stepSize+'; font-weight:600;">Panier</span>' +
'</div>' +
'<div class="pos-step ' + (posStep === 2 ? 'active' : '') + '" style="display:flex; align-items:center; gap:4px; font-size:'+stepSize+'; font-weight:600; color:' + (posStep === 2 ? 'var(--black)' : 'var(--text-muted)') + '; cursor:pointer;" onclick="posNaviguerEtape(2)">' +
'<span class="step-number" style="display:inline-flex; align-items:center; justify-content:center; width:'+stepNumberSize2+'; height:'+stepNumberSize2+'; border-radius:50%; background:' + (posStep === 2 ? 'var(--black)' : 'var(--gray-200)') + '; color:' + (posStep === 2 ? 'var(--white)' : 'var(--text-muted)') + '; font-size:'+stepNumberSize+'; font-weight:700;">2</span>' +
'<span style="font-size:'+stepSize+'; font-weight:600;">Paiement</span>' +
'</div>' +
'</div>';

var productPanelDisplay = (posStep === 2) ? 'display:none;' : '';

// ✅ Mobile : forcer panier en dessous
var mobileCartStyle = '';
if (isMobile) {
    mobileCartStyle = 'width:100% !important;max-height:35vh !important;min-height:150px !important;margin-top:4px !important;flex:1 !important;';
}

var productsPanelMaxHeight = 'none';

var gridCols = isMobile ? 'repeat(5, 1fr)' : 'repeat(auto-fill, minmax(110px, 1fr))';
var gridGap = isMobile ? '4px' : '8px';
var gridPadding = isMobile ? '2px' : '4px';
var panelPadding = isMobile ? '8px' : '12px';

var h='<div class="pos-container' + (posStep===2 ? ' pos-container-full' : '') + '" style="display:flex;flex-direction:column;gap:6px;height:auto;padding-bottom:30px;">' +
stepIndicator +
'<div class="pos-row" style="display:flex;flex-direction:column;gap:8px;width:100%;height:auto;">' +

'<div class="pos-products-panel" style="' + productPanelDisplay + ' padding:'+panelPadding+'; width:100%; background:var(--bg-card); border-radius:var(--radius-xl); box-shadow:var(--shadow-xs); border:1px solid var(--border); display:flex; flex-direction:column; height:auto; overflow:visible; min-height:350px; max-height:80vh; flex:8;">' +

'<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:6px;">' +
'<div style="display:flex;justify-content:center;align-items:center;margin-bottom:2px;">' +
'<button id="posToggleToolsBtn" onclick="posToggleTools()" style="background:#14B8A6;color:#fff;border:none;border-radius:6px;padding:5px 20px;font-size:0.75rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;margin:0 auto;">🔍 Afficher tout</button>' +
'</div>' +

'<div id="posToolsContainer" style="display:none;flex-direction:column;gap:4px;margin-bottom:4px;padding:5px 8px;background:var(--bg-page);border-radius:6px;border:1px solid var(--border);">' +

'<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">' +
'<div style="flex:1;min-width:80px;display:flex;align-items:center;background:#fff;border:2px solid #e2e8f0;border-radius:40px;padding:1px 6px;position:relative;height:'+(isMobile?'30px':'34px')+';">' +
'<i class="fas fa-search" style="color:#94a3b8;margin-right:3px;font-size:'+(isMobile?'12px':'14px')+';"></i>' +
'<input type="text" id="posSearchInput" placeholder="🔍 Rechercher..." value="'+escapeHtml(posSearchQuery)+'" onkeyup="posSearchProducts(this.value); updateClearButtonVisibility();" oninput="updateClearButtonVisibility();" style="border:none;outline:none;padding:0;width:100%;background:transparent;font-size:'+(isMobile?'12px':'16px')+';padding-right:24px;height:'+(isMobile?'30px':'34px')+';">' +
'<button id="posSearchClearBtn" onclick="clearPosSearch()" style="display:'+(posSearchQuery ? 'flex' : 'none')+';position:absolute;right:4px;background:none;border:none;cursor:pointer;padding:1px;color:#94a3b8;font-size:'+(isMobile?'14px':'16px')+';align-items:center;justify-content:center;" title="Effacer"><i class="fas fa-times-circle"></i></button>' +
'</div>' +
'<button id="posMicBtn" title="Micro" style="background:#dcfce7;border:2px solid #14B8A6;border-radius:50%;width:'+(isMobile?'30px':'34px')+';height:'+(isMobile?'30px':'34px')+';cursor:pointer;font-size:'+(isMobile?'12px':'14px')+';" onclick="posToggleVoiceSearch()"><i class="fas fa-microphone"></i></button>' +
'<div style="display:flex;gap:2px;"><button onclick="posAfficherCommandesTables()" style="background:#fff;border:2px solid #e2e8f0;border-radius:50px;padding:2px 6px;font-weight:600;font-size:'+(isMobile?'0.4rem':'0.5rem')+';">🍽️ Tables <span style="background:#ef4444;color:#fff;border-radius:20px;padding:1px 4px;font-size:'+(isMobile?'0.3rem':'0.4rem')+';">'+posCommandesTablesCount+'</span></button><button onclick="navigateTo(\'commandes\')" style="background:#fff;border:2px solid #e2e8f0;border-radius:50px;padding:2px 6px;font-weight:600;font-size:'+(isMobile?'0.4rem':'0.5rem')+';">🌐 En ligne <span style="background:#ef4444;color:#fff;border-radius:20px;padding:1px 4px;font-size:'+(isMobile?'0.3rem':'0.4rem')+';">'+posCommandesEnLigneCount+'</span></button></div>' +
'</div>' +

'<div class="pos-categories-bar" style="display:flex;flex-wrap:wrap;gap:3px;">' +
'<button class="pos-cat-btn '+(posSelectedCategory==='all'?'active':'')+'" onclick="posFilterCategory(\'all\')" style="padding:'+(isMobile?'3px 6px':'4px 10px')+';font-size:'+(isMobile?'9px':'0.65rem')+';gap:'+(isMobile?'2px':'4px')+';border-radius:16px;border:2px solid '+(posSelectedCategory==='all'?'#14B8A6':'#e2e8f0')+';background:'+(posSelectedCategory==='all'?'#f0fdf4':'#fff')+';cursor:pointer;font-weight:600;transition:all 0.2s;">📋 Tous</button>';
var sortedCategories = posCategoriesList.slice().sort(function(a, b) {
var ordreA = (a.ordre !== undefined && a.ordre !== null) ? parseInt(a.ordre) : 9999;
var ordreB = (b.ordre !== undefined && b.ordre !== null) ? parseInt(b.ordre) : 9999;
if (ordreA !== ordreB) return ordreA - ordreB;
return (a.nom || '').localeCompare(b.nom || '');
});
for(var i=0;i<sortedCategories.length;i++){
var ca = sortedCategories[i];
var ac = posSelectedCategory===ca.nom?'active':'';
var ih = ca.imageBase64?'<img src="'+escapeHtml(ca.imageBase64)+'" loading="lazy" style="max-width:18px;max-height:18px;border-radius:4px;">':'<i class="fas fa-folder" style="font-size:'+(isMobile?'9px':'11px')+';"></i>';
h+='<button class="pos-cat-btn '+ac+'" onclick="posFilterCategory(\''+escapeHtml(ca.nom).replace(/'/g,"\\'")+'\')" style="padding:'+(isMobile?'3px 6px':'4px 10px')+';font-size:'+(isMobile?'9px':'0.65rem')+';gap:'+(isMobile?'2px':'4px')+';border-radius:16px;border:2px solid '+(posSelectedCategory===ca.nom?'#14B8A6':'#e2e8f0')+';background:'+(posSelectedCategory===ca.nom?'#f0fdf4':'#fff')+';cursor:pointer;font-weight:600;transition:all 0.2s;display:flex;align-items:center;">'+ih+' '+escapeHtml(ca.nom)+'</button>';
}
h+='</div>';
h+='</div>';
h+='</div>' +

'<div class="pos-products-grid" id="posProductGrid" style="grid-template-columns:'+gridCols+';gap:'+gridGap+';padding:'+gridPadding+';overflow-x:hidden;overflow-y:auto;flex-wrap:wrap;align-content:start;flex:1;"></div>' +
'</div>' +

'<div class="pos-cart-panel" style="' + (isMobile ? mobileCartStyle : 'width:100%;background:var(--bg-card);border-radius:var(--radius-xl);box-shadow:var(--shadow-xs);border:1px solid var(--border);display:flex;flex-direction:column;margin-top:4px;max-height:35vh;flex:2;min-height:120px;') + '">';

if(posStep===1){
h+='<div class="pos-cart-header" style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:1px solid var(--border);flex-shrink:0;"><h3 style="font-size:'+(isMobile?'18px':'0.9rem')+';cursor:pointer;" onclick="document.querySelector(\'.pos-cart-panel\').scrollIntoView({behavior:\'smooth\',block:\'start\'})"><i class="fas fa-shopping-cart"></i> Panier <span class="pos-cart-badge" style="background:#14B8A6;color:#fff;border-radius:50%;padding:1px 6px;font-size:'+(isMobile?'12px':'0.6rem')+';">'+posCart.length+'</span></h3><button class="pos-clear-btn" onclick="posResetCart()" style="font-size:'+(isMobile?'12px':'0.7rem')+';background:#ef4444;color:#fff;border:none;border-radius:4px;padding:'+(isMobile?'3px 8px':'4px 10px')+';cursor:pointer;"><i class="fas fa-trash-alt"></i> Vider</button></div><div class="pos-cart-items" style="flex:1;overflow-y:auto;padding:4px 8px;min-height:60px;max-height:180px;">';
if(posCart.length===0){ h+='<div class="pos-cart-empty" style="text-align:center;padding:15px 8px;color:#94a3b8;"><i class="fas fa-shopping-basket" style="font-size:'+(isMobile?'22px':'28px')+';"></i><p style="font-size:'+(isMobile?'12px':'0.8rem')+';">Panier vide</p></div>'; }
else{
for(var k=0;k<posCart.length;k++){
var it=posCart[k], opts='';
if(it.interdits&&it.interdits.length) opts+=' <span style="color:#ef4444;font-size:0.4rem;">🚫'+escapeHtml(it.interdits.join(','))+'</span>';
if(it.epice&&it.epice!=='Normal') opts+=' <span style="color:#d97706;font-size:0.4rem;">🌶️'+escapeHtml(it.epice)+'</span>';
if(it.sel&&it.sel!=='Normal') opts+=' <span style="color:#4f46e5;font-size:0.4rem;">🧂'+escapeHtml(it.sel)+'</span>';
var btnSize = isMobile ? '28px' : '22px';
var fontSize = isMobile ? '0.6rem' : '0.5rem';
var qtySize = isMobile ? '0.8rem' : '0.65rem';
var nameSize = isMobile ? '13px' : '0.7rem';
var priceSize = isMobile ? '0.5rem' : '0.5rem';
var totalSize = isMobile ? '14px' : '0.65rem';
h+='<div class="pos-cart-item" style="display:flex;align-items:center;justify-content:space-between;padding:4px 2px;border-bottom:1px solid var(--border);gap:4px;">' +
'<div class="pos-cart-item-info" style="flex:1;min-width:0;display:flex;flex-direction:column;">' +
'<span class="pos-cart-item-name" style="font-size:'+nameSize+';font-weight:600;display:block;word-break:break-word;white-space:normal;line-height:1.3;">'+escapeHtml(it.nom)+opts+'</span>' +
'<span class="pos-cart-item-price" style="font-size:'+priceSize+';color:var(--text-secondary);">'+it.prixUnitaire.toFixed(2)+' MAD</span>' +
'</div>' +
'<div class="pos-cart-item-actions" style="display:flex;align-items:center;gap:3px;flex-shrink:0;">' +
'<button class="pos-qty-btn" onclick="posUpdateQty('+k+',-1)" style="width:'+btnSize+';height:'+btnSize+';border-radius:50%;border:2px solid var(--border);background:var(--white);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:'+fontSize+';transition:all 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.05);"><i class="fas fa-minus"></i></button>' +
'<span class="pos-qty-value" style="font-size:'+qtySize+';font-weight:700;min-width:20px;text-align:center;">'+it.quantite+'</span>' +
'<button class="pos-qty-btn" onclick="posUpdateQty('+k+',1)" style="width:'+btnSize+';height:'+btnSize+';border-radius:50%;border:2px solid var(--border);background:var(--white);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:'+fontSize+';transition:all 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.05);"><i class="fas fa-plus"></i></button>' +
'<button class="pos-remove-btn" onclick="posRemoveItem('+k+')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:2px;font-size:0.8rem;transition:all 0.2s;"><i class="fas fa-times"></i></button>' +
'</div>' +
'<span class="pos-cart-item-total" style="font-size:'+totalSize+';font-weight:700;min-width:50px;text-align:right;flex-shrink:0;">'+(it.prixUnitaire*it.quantite).toFixed(2)+' MAD</span>' +
'</div>';
}
}
h+='</div><div style="padding:2px 0;display:flex;gap:3px;align-items:center;flex-shrink:0;"><label style="font-size:'+(isMobile?'12px':'0.7rem')+';">Remise:</label><input type="number" id="posDiscountMAD" value="'+posDiscountMAD+'" min="0" step="0.01" onchange="posUpdateDiscountMAD(this.value)" style="width:50px;padding:2px;border:2px solid #e2e8f0;border-radius:4px;font-size:'+(isMobile?'12px':'0.7rem')+';"></div><div class="pos-cart-footer" style="padding:2px 0;flex-shrink:0;">'+(posDiscountMAD>0?'<div style="display:flex;justify-content:space-between;font-size:'+(isMobile?'12px':'0.8rem')+';"><span>Sous-total</span><span>'+st.toFixed(2)+'</span></div><div style="display:flex;justify-content:space-between;color:#ef4444;font-size:'+(isMobile?'12px':'0.8rem')+';"><span>Remise</span><span>-'+posDiscountMAD.toFixed(2)+'</span></div>':'')+'<div class="pos-cart-total-row" style="display:flex;justify-content:space-between;font-size:'+(isMobile?'18px':'20px')+';font-weight:700;padding:3px 0;border-top:2px solid var(--border);"><span>Total</span><span>'+t.toFixed(2)+' MAD</span></div>' +

'<button class="pos-validate-btn" onclick="posGoToStep2()" '+(posCart.length===0?'disabled':'')+' style="width:100%;padding:10px;background:#14B8A6;color:#fff;border:none;border-radius:8px;font-size:18px;font-weight:700;height:40px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:12px;"><i class="fas fa-check-circle"></i> Valider</button>' +

'<button onclick="document.querySelector(\'.pos-steps-nav\').scrollIntoView({behavior:\'smooth\',block:\'start\'})" style="position:fixed;bottom:20px;right:20px;width:70px;height:70px;border-radius:50%;background:#14B8A6;color:#fff;border:none;font-size:28px;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.25);z-index:9999;display:flex;align-items:center;justify-content:center;transition:all 0.3s;" onmouseover="this.style.transform=\'scale(1.1)\';this.style.boxShadow=\'0 6px 25px rgba(0,0,0,0.35)\';" onmouseout="this.style.transform=\'scale(1)\';this.style.boxShadow=\'0 4px 15px rgba(0,0,0,0.25)\';"><i class="fas fa-arrow-up"></i></button>' +

'</div>';
}else{
var canCredit=posCurrentClient&&posCurrentClient.id;
var creditDisplay = '';
if (posCurrentClient && posCurrentClient.id) {
creditDisplay = '<div id="clientCreditDisplay" style="font-size:20px;font-weight:700;padding:2px 0;text-align:right;"></div>';
}
h+='<div class="pos-cart-header" style="padding:6px 10px;border-bottom:1px solid var(--border);flex-shrink:0;"><h3 style="font-size:'+(isMobile?'16px':'0.85rem')+';"><i class="fas fa-credit-card"></i> Paiement</h3></div><div class="pos-payment-form" style="padding:6px 10px;flex:1;overflow-y:auto;max-height:400px;"><div style="margin-bottom:3px;"><label style="font-size:'+(isMobile?'12px':'0.7rem')+';font-weight:600;">Client</label><div style="position:relative;">' +
'<div style="display:flex;align-items:center;background:#fff;border:2px solid #e2e8f0;border-radius:6px;padding:2px 8px;position:relative;">' +
'<input type="text" id="posClientSearchInput" placeholder="🔍 Cliquez et tapez..." onkeyup="posSearchClient(this.value)" onfocus="if(this.value)posSearchClient(this.value)" autocomplete="off" value="'+(posCurrentClient?escapeHtml(posCurrentClient.name):'')+'" style="border:none;outline:none;padding:4px 0;width:100%;background:transparent;font-size:18px !important;font-weight:700 !important;padding-right:24px;">' +
'<button id="posClientClearBtn" onclick="clearClientSearch()" style="display:'+((posCurrentClient && posCurrentClient.name) ? 'flex' : 'none')+';position:absolute;right:4px;background:none;border:none;cursor:pointer;padding:2px;color:#94a3b8;font-size:1rem;align-items:center;justify-content:center;" title="Effacer le client"><i class="fas fa-times-circle"></i></button>' +
'</div>' +
'<div id="posClientDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:2px solid #e2e8f0;border-radius:0 0 6px 6px;max-height:150px;overflow-y:auto;z-index:50;"></div></div>'+creditDisplay+'</div><div style="margin:2px 0;font-size:0.5rem;text-align:center;">— OU —</div><div style="margin-bottom:3px;"><label style="font-size:'+(isMobile?'12px':'0.7rem')+';font-weight:600;">Table</label><input type="text" id="posTableNum" value="'+escapeHtml(posCurrentTable)+'" onchange="posSetTable(this.value)" style="width:100%;padding:4px;border:2px solid #e2e8f0;border-radius:4px;font-size:'+(isMobile?'14px':'0.85rem')+';"></div><div style="margin-bottom:3px;"><div style="padding:4px;background:#f8fafc;border-radius:4px;">' +
'<div style="font-size:'+(isMobile?'18px':'20px')+';font-weight:600;">Articles: '+posCart.length+'</div>' +
(posDiscountMAD>0?'<div style="color:#ef4444;font-size:'+(isMobile?'16px':'18px')+';">Remise: -'+posDiscountMAD.toFixed(2)+'</div>':'') +
'<div style="font-size:'+(isMobile?'18px':'20px')+';font-weight:700;">Total: '+t.toFixed(2)+' MAD</div></div></div><div style="margin-bottom:3px;"><label style="font-size:'+(isMobile?'12px':'0.7rem')+';font-weight:600;">Vendeur</label><input type="text" id="posVendeur" value="'+(window.currentUserData?escapeHtml(window.currentUserData.userData.prenom+' '+window.currentUserData.userData.nom):'')+'" style="width:100%;padding:4px;border:2px solid #e2e8f0;border-radius:4px;font-size:'+(isMobile?'14px':'0.85rem')+';"></div><div style="margin-bottom:3px;"><div style="display:flex;gap:3px;">' +
'<button class="pos-payment-btn '+(posPaymentMethod==='espece'?'active':'')+'" onclick="posSetPaymentMethod(\'espece\')" style="font-size:'+(isMobile?'14px':'0.9rem')+' !important;font-weight:700 !important;padding:6px 10px;height:auto;min-height:36px;"><i class="fas fa-money-bill-wave"></i> Espèces</button>' +
'<button class="pos-payment-btn '+(posPaymentMethod==='credit'?'active':'')+'" onclick="posSetPaymentMethod(\'credit\')" id="posCreditBtn" '+(canCredit?'':'disabled style="opacity:0.4;"')+' style="font-size:'+(isMobile?'14px':'0.9rem')+' !important;font-weight:700 !important;padding:6px 10px;height:auto;min-height:36px;"><i class="fas fa-credit-card"></i> Crédit</button>' +
'<button class="pos-payment-btn '+(posPaymentMethod==='partiel'?'active':'')+'" onclick="posSetPaymentMethod(\'partiel\')" id="posPartielBtn" '+(canCredit?'':'disabled style="opacity:0.4;"')+' style="font-size:'+(isMobile?'14px':'0.9rem')+' !important;font-weight:700 !important;padding:6px 10px;height:auto;min-height:36px;"><i class="fas fa-hand-holding-usd"></i> Partiel</button>' +
'</div></div>';
if(posPaymentMethod==='espece'||posPaymentMethod==='partiel') {
h+='<div style="margin-bottom:3px;"><label style="font-size:'+(isMobile?'12px':'0.7rem')+';font-weight:600;">Montant donné</label><input type="number" id="posAmountGiven" placeholder="0.00" value="'+(posAmountGiven>0?posAmountGiven:'')+'" onkeyup="posCalculateChange()" style="width:100%;padding:6px;border:2px solid #e2e8f0;border-radius:4px;font-size:24px !important;font-weight:700 !important;"><div id="posChangeDisplay" style="font-size:22px;font-weight:700;padding:2px 0;margin-right:6px;"></div></div>';
}
h+='<button class="pos-finalize-btn" onclick="posFinalizeSale()" style="width:100%;padding:8px;margin-top:4px;background:#14B8A6;color:#fff;border:none;border-radius:8px;font-size:16px !important;font-weight:700 !important;min-height:40px;margin-bottom:12px;"><i class="fas fa-check-circle"></i> Finaliser</button>' +

'<button onclick="document.querySelector(\'.pos-steps-nav\').scrollIntoView({behavior:\'smooth\',block:\'start\'})" style="position:fixed;bottom:20px;right:20px;width:70px;height:70px;border-radius:50%;background:#14B8A6;color:#fff;border:none;font-size:28px;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.25);z-index:9999;display:flex;align-items:center;justify-content:center;transition:all 0.3s;" onmouseover="this.style.transform=\'scale(1.1)\';this.style.boxShadow=\'0 6px 25px rgba(0,0,0,0.35)\';" onmouseout="this.style.transform=\'scale(1)\';this.style.boxShadow=\'0 4px 15px rgba(0,0,0,0.25)\';"><i class="fas fa-arrow-up"></i></button>' +

'</div>';
}
h+='</div></div></div></div>'; c.innerHTML=h;

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
cd.innerHTML='<div style="font-size:24px;font-weight:700;color:#16a34a;display:flex;align-items:center;justify-content:flex-start;"><span>✅ Rendu</span><span style="margin-left:12px;margin-right:12px;">'+c.toFixed(2)+' MAD</span></div>';
} else {
cd.innerHTML='<div style="font-size:24px;font-weight:700;color:#ef4444;display:flex;align-items:center;justify-content:flex-start;"><span>❌ Manquant</span><span style="margin-left:12px;margin-right:12px;">'+Math.abs(c).toFixed(2)+' MAD</span></div>';
}
} else {
cd.innerHTML='';
}
}

async function updateClientFidelityAsync(clientId, total, profitTotal) {
try {
return await forceUpdateClient(clientId, total, profitTotal);
} catch(e) {
console.error('❌ Erreur updateClientFidelityAsync:', e);
return false;
}
}

async function posFinalizeSale(){
if(posCart.length === 0){
alert('❌ Le panier est vide. Ajoutez des articles avant de finaliser.');
return;
}

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

// ✅ Nettoyer l'état sauvegardé après finalisation
localStorage.removeItem('posSavedState');

if(posCurrentClient && posCurrentClient.id && paid) {
try {
const success = await forceUpdateClient(posCurrentClient.id, t, profitTotal);
if (success) {
console.log('✅ Client mis à jour avec succès !');
} else {
console.warn('⚠️ Échec de la mise à jour client');
}
} catch(e) {
console.warn('⚠️ Erreur mise à jour client:', e);
}
}

if (posCurrentClient && posCurrentClient.id) {
clientCreditsCache[posCurrentClient.id] = undefined;
}
var venteId = ventesRef.id;
if (typeof window.sendWhatsApp === 'function') {
var originalCloseModal = window.closeModal;
window.closeModal = function() {
posResetCart();
posStep = 1;
window.posStep = 1;
if(isOnPOSPage()) renderPOS();
if(navigator.onLine) setTimeout(function(){ CacheDB.sync().catch(function(){}); },500);
window.closeModal = originalCloseModal;
var o = document.getElementById('modalOverlay');
if (o) o.classList.add('hidden');
window.editingId = null;
};
var modalHtml = '<p style="text-align:center;">Voulez-vous envoyer la facture par WhatsApp ?</p><div style="display:flex;justify-content:center;gap:10px;margin-top:15px;"><button class="btn-save" id="whatsappYesBtn">✅ Oui</button><button class="btn-cancel" id="whatsappNoBtn">❌ Non</button></div>';
openModal('📱 Envoyer la facture WhatsApp', modalHtml);
setTimeout(function() {
var yesBtn = document.getElementById('whatsappYesBtn'), noBtn = document.getElementById('whatsappNoBtn');
if (yesBtn) { yesBtn.addEventListener('click', function() {
window.closeModal = originalCloseModal;
closeModal();
if (typeof window.posStopVoiceSearch === 'function') window.posStopVoiceSearch();
window.sendWhatsApp(venteId);
setTimeout(function() {
posResetCart();
posStep = 1;
window.posStep = 1;
if(isOnPOSPage()) renderPOS();
if(navigator.onLine) setTimeout(function(){ CacheDB.sync().catch(function(){}); },500);
}, 500);
}); }
if (noBtn) { noBtn.addEventListener('click', function() {
window.closeModal = originalCloseModal;
closeModal();
posResetCart();
posStep = 1;
window.posStep = 1;
if(isOnPOSPage()) renderPOS();
if(navigator.onLine) setTimeout(function(){ CacheDB.sync().catch(function(){}); },500);
}); }
}, 100);
} else {
posResetCart();
posStep = 1;
window.posStep = 1;
if(isOnPOSPage()) renderPOS();
if(navigator.onLine) setTimeout(function(){ CacheDB.sync().catch(function(){}); },500);
}

// ✅ AJOUT : Sauvegarde du cache après chaque vente
if (typeof CacheDB !== 'undefined' && CacheDB.saveCollection) {
setTimeout(function() {
    CacheDB.saveCollection('ventes');
    CacheDB.saveCollection('products');
    CacheDB.saveCollection('clients');
    CacheDB.saveCollection('credits');
}, 500);
}

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

// ✅ Nettoyer l'état sauvegardé lors du reset
localStorage.removeItem('posSavedState');

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

// ==================== CORRECTION MOBILE PANIER EN BAS ====================
function corrigerDispositionMobile() {
    if (window.innerWidth <= 700) {
        var row = document.querySelector('.pos-row');
        var produits = document.querySelector('.pos-products-panel');
        var panier = document.querySelector('.pos-cart-panel');
        
        if (row && produits && panier) {
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            row.style.flexWrap = 'nowrap';
            
            produits.style.width = '100%';
            produits.style.maxWidth = '100%';
            produits.style.minWidth = '100%';
            produits.style.height = 'auto';
            produits.style.minHeight = '300px';
            produits.style.maxHeight = '60vh';
            produits.style.flex = '1';
            
            panier.style.width = '100%';
            panier.style.maxWidth = '100%';
            panier.style.minWidth = '100%';
            panier.style.height = 'auto';
            panier.style.minHeight = '150px';
            panier.style.maxHeight = '35vh';
            panier.style.marginTop = '4px';
            panier.style.position = 'static';
        }
    }
}

var ancienBuildFullPOS = window.buildFullPOS;
window.buildFullPOS = function(c) {
    ancienBuildFullPOS(c);
    setTimeout(corrigerDispositionMobile, 100);
};

window.addEventListener('load', corrigerDispositionMobile);
window.addEventListener('resize', corrigerDispositionMobile);

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
window.forceUpdateClient = forceUpdateClient;
window.corrigerDispositionMobile = corrigerDispositionMobile;

console.log('🚀 E-SOLUTION - POS chargé avec corrections');
console.log('✅ forceUpdateClient disponible');
console.log('✅ Bouton "Afficher tout" corrigé');
console.log('✅ Correction mobile panier en bas');
console.log('✅ Crédit client cliquable - REDIRECTION VERS PAGE CRÉDITS AVEC SAUVEGARDE D\'ÉTAT');
