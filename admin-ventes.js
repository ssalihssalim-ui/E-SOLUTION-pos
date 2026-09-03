// ==================== ADMIN-VENTES.JS - E-SOLUTION ====================
// Version : Design PRO - Facture/Date/Client en colonnes séparées
// ✅ BOUTONS AVEC ICÔNES CORRIGÉS - Font Awesome fonctionnel
// ✅ SÉLECTION EN MASSE
// ✅ DÉTAILS FACTURE MODAL AVEC X POUR FERMER - FONT SIZE AGRANDI
// ✅ PAGINATION CORRIGÉE - SANS ICÔNES

// ========== VARIABLES GLOBALES ==========
window.commandesSearch = window.commandesSearch || '';
window.commandesPeriod = window.commandesPeriod || 'all';
window.ventesSearch = window.ventesSearch || '';
window.ventesPeriod = window.ventesPeriod || 'all';
window.allVentesData = window.allVentesData || [];
window.allCommandesData = window.allCommandesData || [];
window.filteredVentes = window.filteredVentes || null;
window.filteredCommandes = window.filteredCommandes || null;
window.venteSelectionMode = window.venteSelectionMode || false;
window.venteSelectedIndex = window.venteSelectedIndex || -1;
window.clientsDataForSearch = window.clientsDataForSearch || [];

// ========== SELECTION EN MASSE ==========
var ventesSelectionnees = new Set();

function toggleVenteSelection(id) {
if (ventesSelectionnees.has(id)) {
ventesSelectionnees.delete(id);
} else {
ventesSelectionnees.add(id);
}
updateVenteSelectionUI();
}

function toggleAllVentesSelection() {
var checkboxes = document.querySelectorAll('.vente-checkbox');
var allChecked = true;
checkboxes.forEach(function(cb) {
if (!cb.checked) allChecked = false;
});

checkboxes.forEach(function(cb) {
cb.checked = !allChecked;
var id = cb.getAttribute('data-id');
if (cb.checked) {
ventesSelectionnees.add(id);
} else {
ventesSelectionnees.delete(id);
}
});
updateVenteSelectionUI();
}

function updateVenteSelectionUI() {
var count = ventesSelectionnees.size;
var btn = document.getElementById('deleteSelectedVentesBtn');
var selectAllBtn = document.getElementById('selectAllVentesBtn');
var countDisplay = document.getElementById('selectedVentesCount');

if (btn) {
btn.style.display = count > 0 ? 'inline-block' : 'none';
btn.textContent = '🗑️ Supprimer ' + count + ' vente(s)';
}
if (countDisplay) {
countDisplay.textContent = count + ' sélectionnée(s)';
countDisplay.style.display = count > 0 ? 'inline-block' : 'none';
}
if (selectAllBtn) {
var checkboxes = document.querySelectorAll('.vente-checkbox');
var allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
selectAllBtn.textContent = allChecked ? '❌ Désélectionner tout' : '✅ Tout sélectionner';
}
}

async function deleteSelectedVentes() {
if (ventesSelectionnees.size === 0) {
alert('Aucune vente sélectionnée.');
return;
}

var count = ventesSelectionnees.size;
if (!confirm(`⚠️ Supprimer ${count} vente(s) sélectionnée(s) ? Cette action est IRRÉVERSIBLE.`)) return;

try {
var batch = db.batch();
var batchCount = 0;
var totalDeleted = 0;
var ids = Array.from(ventesSelectionnees);

for (var id of ids) {
var ref = db.collection('ventes').doc(id);
batch.delete(ref);
batchCount++;
totalDeleted++;

if (batchCount >= 500) {
await batch.commit();
console.log(`✅ ${totalDeleted} ventes supprimées...`);
batch = db.batch();
batchCount = 0;
}
}
if (batchCount > 0) {
await batch.commit();
}

ventesSelectionnees.clear();
alert(`✅ ${totalDeleted} vente(s) supprimée(s) !`);
loadVentes();

// ✅ AJOUT : Sauvegarde du cache après suppression en masse
if (typeof CacheDB !== 'undefined' && CacheDB.saveCollection) {
    CacheDB.saveCollection('ventes');
}

} catch(e) {
console.error('❌ Erreur :', e);
alert('❌ Erreur : ' + e.message);
}
}

// ========== FONCTIONS UTILITAIRES ==========
function escapeHtml(str) {
if (!str) return '';
return str.replace(/[&<>]/g, function(m) {
if (m === '&') return '&amp;';
if (m === '<') return '&lt;';
if (m === '>') return '&gt;';
return m;
});
}

function formatDateHeure(seconds) {
if (!seconds) return { date: '-', time: '-', full: '-' };
const d = new Date(seconds * 1000);
const date = d.toLocaleDateString('fr-FR', {
day: '2-digit',
month: '2-digit',
year: 'numeric'
});
const time = d.toLocaleTimeString('fr-FR', {
hour: '2-digit',
minute: '2-digit'
});
return { date, time, full: date + ' ' + time };
}

function detectPeriodFilterVentes(text) {
var cleaned = text.toLowerCase().trim();
if (cleaned.includes("aujourd'hui") || cleaned.includes("aujourd hui") || cleaned.includes("today") || cleaned.includes("ajourdhui") || cleaned.includes("aujourd")) {
return 'today';
}
if (cleaned.includes("ce mois") || cleaned.includes("cemois") || cleaned.includes("mois en cours") || cleaned.includes("ce mois ci") || cleaned.includes("mois")) {
return 'month';
}
if (cleaned.includes("cette semaine") || cleaned.includes("cettesemaine") || cleaned.includes("semaine") || cleaned.includes("7 jours") || cleaned.includes("7j") || cleaned.includes("sept jours")) {
return 'week';
}
if (cleaned.includes("cette année") || cleaned.includes("cetteannee") || cleaned.includes("cette annee") || cleaned.includes("annee") || cleaned.includes("année") || cleaned.includes("1 an") || cleaned.includes("1an")) {
return 'year';
}
if (cleaned.includes("tout") || cleaned.includes("toutes") || cleaned.includes("all") || cleaned.includes("tous") || cleaned.includes("toute les ventes") || cleaned.includes("tout les ventes")) {
return 'all';
}
return null;
}

async function loadClientsForSearch() {
try {
const snapshot = await db.collection('clients').limit(2000).get();
window.clientsDataForSearch = [];
snapshot.forEach(doc => {
var d = doc.data();
d.id = doc.id;
window.clientsDataForSearch.push(d);
});
console.log('📋 Clients chargés pour recherche description:', window.clientsDataForSearch.length);
} catch(e) {
console.warn('Erreur chargement clients pour recherche:', e);
window.clientsDataForSearch = [];
}
}

function filterVentesBySearchWithDescription(data, query) {
if (!query || query.trim() === '') return data;

var q = query.toLowerCase().trim();
var results = [];
var clientsMap = {};

window.clientsDataForSearch.forEach(function(c) {
clientsMap[c.id] = c;
});

data.forEach(function(vente) {
var match = false;
var clientInfo = null;

if (vente.clientName && vente.clientName.toLowerCase().indexOf(q) !== -1) {
match = true;
}

if (!match && vente.items) {
for (var i = 0; i < vente.items.length; i++) {
if (vente.items[i].nom && vente.items[i].nom.toLowerCase().indexOf(q) !== -1) {
match = true;
break;
}
}
}

if (!match && vente.clientId && clientsMap[vente.clientId]) {
var client = clientsMap[vente.clientId];
var description = client.description || '';
if (description.toLowerCase().indexOf(q) !== -1) {
match = true;
clientInfo = client;
}
}

if (!match && vente.clientName && !vente.clientId) {
for (var id in clientsMap) {
var c = clientsMap[id];
var fullName = (c.nom || '') + ' ' + (c.prenom || '');
if (fullName.trim().toLowerCase() === vente.clientName.toLowerCase()) {
var desc = c.description || '';
if (desc.toLowerCase().indexOf(q) !== -1) {
match = true;
clientInfo = c;
break;
}
}
}
}

if (match) {
if (clientInfo) {
vente._clientDisplayName = (clientInfo.nom || '') + ' ' + (clientInfo.prenom || '');
} else if (vente.clientId && clientsMap[vente.clientId]) {
var c = clientsMap[vente.clientId];
vente._clientDisplayName = (c.nom || '') + ' ' + (c.prenom || '');
} else {
vente._clientDisplayName = vente.clientName || vente.table || 'Client inconnu';
}
results.push(vente);
}
});

return results;
}

function renderFactureCell(vente) {
const factureNum = vente.factureNum || vente.id?.substring(0, 8) || '---';
return `
