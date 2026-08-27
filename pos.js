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

async function updateClientFidelityAsync(clientId,total,profitTotal){ try{ if(!fideliteSettingsCache){ var fDoc=await db.collection('settings').doc('fidelite').get(); fideliteSettingsCache=fDoc.exists?fDoc.data():{active:true,pointsParVente:1}; } if(!fideliteSettingsCache.active) return; var cr=await db.collection('clients').doc(clientId).get(); if(!cr.exists) return; var cd=cr.data(),points=parseInt(fideliteSettingsCache.pointsParVente)||1; await CacheDB.write('clients',clientId,{ca:(cd.ca||0)+total,profit:(cd.profit||0)+profitTotal,pointsFidelite:(cd.pointsFidelite||0)+points,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},'update'); }catch(e){ console.warn(e); } }

// ==================== POS FINALIZE SALE AVEC CORRECTION UNIQUE ====================
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

// ✅ CORRECTION UNIQUE : MISE À JOUR DU CLIENT AVEC await
if(posCurrentClient && posCurrentClient.id && paid) {
    try {
        await updateClientFidelityAsync(posCurrentClient.id, t, profitTotal);
        console.log('✅ Client mis à jour:', posCurrentClient.id, 'CA:', t, 'Profit:', profitTotal);
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

console.log('🚀 E-SOLUTION - POS chargé avec corrections');
console.log('✅ Cliquez sur le titre "Panier" pour scroller vers le bas');
console.log('✅ Cliquez sur le bouton flèche ↑ (en bas à droite) pour remonter en haut');
console.log('✅ Cliquez sur "🔍 Afficher tout" pour afficher la barre de recherche');
console.log('✅ Le chiffre d\'affaire et le profit du client sont mis à jour');
