// ==================== ADMIN-VENTES.JS - E-SOLUTION ====================
// Version : Design PRO - Facture/Date/Client en colonnes séparées
// ✅ BOUTONS AVEC ICÔNES CORRIGÉS - Font Awesome fonctionnel
// ✅ SÉLECTION EN MASSE
// ✅ DÉTAILS FACTURE MODAL AVEC X POUR FERMER - FONT SIZE AGRANDI

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
<div class="facture-cell">
<i class="fas fa-receipt"></i>
<span class="facture-number">#${factureNum}</span>
</div>
`;
}

function renderDateCell(vente) {
const dt = vente.createdAt ? formatDateHeure(vente.createdAt.seconds) : { date: '-', time: '-', full: '-' };
return `
<div class="date-cell">
<div class="date-line">
<i class="far fa-calendar-alt"></i>
<span>${dt.date}</span>
</div>
<div class="time-line">
<i class="far fa-clock"></i>
<span>${dt.time}</span>
</div>
</div>
`;
}

function renderClientCell(vente) {
var clientName = vente._clientDisplayName || vente.clientName || vente.table || 'Client inconnu';
return `
<div class="client-cell">
<i class="fas fa-user-circle"></i>
<span>${escapeHtml(clientName)}</span>
</div>
`;
}

function renderCommandeFactureCell(commande) {
const cmdId = commande.id?.substring(0, 8) || '---';
return `
<div class="facture-cell">
<i class="fas fa-shopping-basket"></i>
<span class="facture-number">#CMD-${cmdId}</span>
</div>
`;
}

function injectVentesStyles() {
const styleId = 'ventes-pro-styles-final';
if (document.getElementById(styleId)) return;

const styles = `
<style id="${styleId}">
#ventesPage, #commandesPage,
#ventesPage *, #commandesPage * {
font-size: 22px !important;
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}

#ventesPage .stat-label, #commandesPage .stat-label,
#ventesPage .filter-group label, #commandesPage .filter-group label,
#ventesPage .total-label, #commandesPage .total-label {
font-size: 16px !important;
}

#ventesPage .btn-add, #commandesPage .btn-add,
#ventesPage .btn-edit, #commandesPage .btn-edit,
#ventesPage .btn-delete, #commandesPage .btn-delete,
#ventesPage .btn-save, #commandesPage .btn-save,
#ventesPage .btn-cancel, #commandesPage .btn-cancel {
font-size: 18px !important;
}

#ventesPage .status-success, #commandesPage .status-success,
#ventesPage .status-warning, #commandesPage .status-warning,
#ventesPage .status-danger, #commandesPage .status-danger {
font-size: 18px !important;
padding: 6px 16px !important;
}

.voice-display-field {
padding: 8px 12px !important;
border: 2px solid #14B8A6 !important;
border-radius: 8px !important;
width: 180px !important;
background: #f0fdf4 !important;
color: #0D9488 !important;
font-weight: 600 !important;
font-size: 22px !important;
min-height: 48px !important;
}

.facture-cell {
display: flex;
align-items: center;
gap: 10px;
font-weight: 800;
font-size: 22px !important;
color: var(--text-primary);
padding: 4px 12px;
border-radius: 8px;
border-left: 3px solid var(--accent);
background: var(--gray-50);
}

.facture-cell i {
color: var(--accent);
font-size: 20px !important;
}

.facture-cell .facture-number {
color: var(--black);
font-weight: 900;
font-size: 22px !important;
background: var(--white);
padding: 0 10px;
border-radius: 4px;
}

.date-cell {
display: flex;
flex-direction: column;
gap: 2px;
padding: 2px 0;
}

.date-cell .date-line,
.date-cell .time-line {
display: flex;
align-items: center;
gap: 8px;
font-size: 20px !important;
color: var(--text-secondary);
font-weight: 500;
}

.date-cell .date-line i,
.date-cell .time-line i {
font-size: 16px !important;
color: var(--accent);
opacity: 0.7;
width: 18px;
}

.client-cell {
display: flex;
align-items: center;
gap: 10px;
font-weight: 700;
font-size: 22px !important;
color: var(--text-primary);
background: rgba(20, 184, 166, 0.05);
padding: 4px 12px;
border-radius: 8px;
}

.client-cell i {
color: var(--accent);
font-size: 20px !important;
}

#ventesPage .data-table,
#commandesPage .data-table {
font-size: 22px !important;
border-collapse: separate;
border-spacing: 0 4px;
width: 100%;
}

#ventesPage .data-table thead th,
#commandesPage .data-table thead th {
font-size: 18px !important;
padding: 14px 18px !important;
background: var(--gray-50) !important;
color: var(--text-secondary) !important;
font-weight: 700 !important;
text-transform: uppercase;
letter-spacing: 0.6px;
border-bottom: 2px solid var(--border);
position: sticky;
top: 0;
z-index: 2;
white-space: nowrap;
}

#ventesPage .data-table thead th i,
#commandesPage .data-table thead th i {
font-size: 16px !important;
margin-right: 6px;
}

#ventesPage .data-table tbody td,
#commandesPage .data-table tbody td {
padding: 14px 16px !important;
font-size: 22px !important;
vertical-align: middle;
background: var(--white);
border-bottom: 1px solid var(--gray-100);
}

#ventesPage .data-table tbody tr:hover td,
#commandesPage .data-table tbody tr:hover td {
background: var(--gray-50);
}

.amount-total {
font-weight: 800 !important;
font-size: 24px !important;
color: var(--black) !important;
letter-spacing: -0.3px;
}

.search-bar-pro {
display: flex;
align-items: center;
gap: 6px;
background: var(--white);
border: 2px solid var(--border);
border-radius: 12px;
padding: 4px 4px 4px 18px;
transition: var(--transition);
flex: 1;
min-width: 220px;
position: relative;
}

.search-bar-pro:focus-within {
border-color: var(--black);
box-shadow: 0 0 0 4px rgba(0,0,0,0.04);
}

.search-bar-pro i.fa-search {
color: var(--text-muted);
font-size: 20px !important;
}

.search-bar-pro input {
flex: 1;
border: none;
background: transparent;
padding: 14px 8px;
font-size: 22px !important;
font-family: 'Inter', sans-serif;
outline: none;
color: var(--text-primary);
min-width: 100px;
}

.search-bar-pro input::placeholder {
color: var(--text-muted);
font-weight: 400;
font-size: 20px !important;
}

.search-clear-btn {
width: 35px !important;
height: 35px !important;
min-width: 35px !important;
border-radius: 50% !important;
border: none !important;
background: var(--gray-200) !important;
color: var(--text-secondary) !important;
font-size: 18px !important;
cursor: pointer !important;
display: flex !important;
align-items: center !important;
justify-content: center !important;
transition: var(--transition) !important;
padding: 0 !important;
margin: 0 2px !important;
}

.search-clear-btn:hover {
background: var(--gray-300) !important;
color: var(--black) !important;
transform: scale(1.05);
}

.search-clear-btn.hidden {
display: none !important;
}

#ventesPage .action-buttons,
#commandesPage .action-buttons {
display: flex !important;
align-items: center !important;
justify-content: center !important;
gap: 6px !important;
flex-wrap: nowrap !important;
min-width: 180px !important;
}

#ventesPage .action-buttons .btn-edit,
#ventesPage .action-buttons .btn-delete,
#ventesPage .action-buttons .btn-add,
#commandesPage .action-buttons .btn-edit,
#commandesPage .action-buttons .btn-delete,
#commandesPage .action-buttons .btn-add {
width: 44px !important;
height: 44px !important;
min-width: 44px !important;
min-height: 44px !important;
border-radius: 10px !important;
display: inline-flex !important;
align-items: center !important;
justify-content: center !important;
padding: 0 !important;
font-size: 18px !important;
transition: all 0.2s ease !important;
border: none !important;
background: var(--gray-50) !important;
color: var(--text-secondary) !important;
cursor: pointer !important;
flex-shrink: 0 !important;
box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;
}

#ventesPage .action-buttons .btn-edit i,
#ventesPage .action-buttons .btn-delete i,
#ventesPage .action-buttons .btn-add i,
#commandesPage .action-buttons .btn-edit i,
#commandesPage .action-buttons .btn-delete i,
#commandesPage .action-buttons .btn-add i {
font-size: 20px !important;
pointer-events: none !important;
line-height: 1 !important;
}

#ventesPage .action-buttons .btn-edit:hover,
#commandesPage .action-buttons .btn-edit:hover {
background: var(--gray-200) !important;
color: var(--black) !important;
transform: translateY(-2px) !important;
box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
}

#ventesPage .action-buttons .btn-delete,
#commandesPage .action-buttons .btn-delete {
color: #ef4444 !important;
background: rgba(239, 68, 68, 0.08) !important;
}

#ventesPage .action-buttons .btn-delete:hover,
#commandesPage .action-buttons .btn-delete:hover {
background: rgba(239, 68, 68, 0.15) !important;
transform: translateY(-2px) !important;
box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15) !important;
}

#ventesPage .action-buttons .btn-add,
#commandesPage .action-buttons .btn-add {
background: var(--black) !important;
color: var(--white) !important;
}

#ventesPage .action-buttons .btn-add:hover,
#commandesPage .action-buttons .btn-add:hover {
background: var(--primary-hover) !important;
transform: translateY(-2px) !important;
box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
}

#ventesPage .action-buttons .btn-edit.whatsapp-btn,
#commandesPage .action-buttons .btn-edit.whatsapp-btn {
color: #25D366 !important;
background: rgba(37, 211, 102, 0.08) !important;
}

#ventesPage .action-buttons .btn-edit.whatsapp-btn:hover,
#commandesPage .action-buttons .btn-edit.whatsapp-btn:hover {
background: rgba(37, 211, 102, 0.15) !important;
transform: translateY(-2px) !important;
box-shadow: 0 4px 12px rgba(37, 211, 102, 0.15) !important;
}

#ventesPage .action-buttons .btn-edit.whatsapp-btn i,
#commandesPage .action-buttons .btn-edit.whatsapp-btn i {
font-size: 22px !important;
}

#ventesPage .action-buttons .btn-add.payer-btn,
#commandesPage .action-buttons .btn-add.payer-btn {
background: #10B981 !important;
color: #fff !important;
font-size: 14px !important;
padding: 0 12px !important;
width: auto !important;
min-width: 60px !important;
border-radius: 8px !important;
gap: 4px !important;
}

#ventesPage .action-buttons .btn-add.payer-btn:hover,
#commandesPage .action-buttons .btn-add.payer-btn:hover {
background: #059669 !important;
transform: translateY(-2px) !important;
}

#ventesPage .action-buttons .btn-add.payer-btn i,
#commandesPage .action-buttons .btn-add.payer-btn i {
font-size: 14px !important;
}

#ventesPage .filter-group,
#commandesPage .filter-group {
display: flex;
align-items: center;
gap: 10px;
}

#ventesPage .filter-group label,
#commandesPage .filter-group label {
font-size: 16px !important;
font-weight: 600;
color: var(--text-secondary);
text-transform: uppercase;
letter-spacing: 0.5px;
}

#ventesPage .filter-group select,
#commandesPage .filter-group select {
padding: 10px 16px;
border: 2px solid var(--border);
border-radius: 10px;
font-size: 20px !important;
font-family: 'Inter', sans-serif;
background: var(--white);
color: var(--text-primary);
transition: var(--transition);
min-width: 140px;
}

#ventesPage .filter-group select:focus,
#commandesPage .filter-group select:focus {
border-color: var(--black);
outline: none;
box-shadow: 0 0 0 3px rgba(0,0,0,0.04);
}

#ventesPage .total-row-pro,
#commandesPage .total-row-pro {
display: flex;
justify-content: flex-end;
align-items: center;
gap: 32px;
padding: 18px 24px;
background: var(--gray-50);
border-radius: 14px;
margin-top: 18px;
border: 1px solid var(--border);
flex-wrap: wrap;
}

#ventesPage .total-row-pro .total-label,
#commandesPage .total-row-pro .total-label {
font-size: 16px !important;
font-weight: 700;
color: var(--text-secondary);
text-transform: uppercase;
letter-spacing: 0.5px;
}

#ventesPage .total-row-pro .total-amount,
#commandesPage .total-row-pro .total-amount {
font-size: 28px !important;
font-weight: 900;
color: var(--black);
letter-spacing: -0.5px;
}

#ventesPage .total-row-pro .total-amount i,
#commandesPage .total-row-pro .total-amount i {
color: var(--accent);
font-size: 22px !important;
margin-right: 6px;
}

.ventes-select-buttons {
display: flex;
gap: 8px;
align-items: center;
flex-wrap: wrap;
}

#selectedVentesCount {
font-size: 16px;
color: #64748b;
display: none;
font-weight: 600;
padding: 4px 12px;
background: #f1f5f9;
border-radius: 20px;
}

#selectAllVentesBtn {
font-size: 16px;
padding: 8px 16px;
background: #2563eb;
color: #fff;
border: none;
border-radius: 8px;
cursor: pointer;
transition: all 0.2s;
}

#selectAllVentesBtn:hover {
background: #1d4ed8;
transform: scale(1.02);
}

#deleteSelectedVentesBtn {
font-size: 16px;
padding: 8px 16px;
background: #ef4444;
color: #fff;
border: none;
border-radius: 8px;
cursor: pointer;
display: none;
transition: all 0.2s;
}

#deleteSelectedVentesBtn:hover {
background: #dc2626;
transform: scale(1.02);
}

@media(max-width:1024px) {
#ventesPage .action-buttons,
#commandesPage .action-buttons {
min-width: 140px !important;
gap: 4px !important;
}

#ventesPage .action-buttons .btn-edit,
#ventesPage .action-buttons .btn-delete,
#ventesPage .action-buttons .btn-add,
#commandesPage .action-buttons .btn-edit,
#commandesPage .action-buttons .btn-delete,
#commandesPage .action-buttons .btn-add {
width: 38px !important;
height: 38px !important;
min-width: 38px !important;
min-height: 38px !important;
font-size: 16px !important;
}

#ventesPage .action-buttons .btn-add.payer-btn,
#commandesPage .action-buttons .btn-add.payer-btn {
min-width: 50px !important;
font-size: 12px !important;
padding: 0 10px !important;
}
}

@media(max-width:768px) {
#ventesPage .data-table tbody td,
#commandesPage .data-table tbody td {
font-size: 18px !important;
padding: 10px 12px !important;
}

.facture-cell {
font-size: 18px !important;
padding: 2px 8px !important;
}

.facture-cell .facture-number {
font-size: 18px !important;
}

.date-cell .date-line,
.date-cell .time-line {
font-size: 16px !important;
}

.client-cell {
font-size: 18px !important;
padding: 2px 8px !important;
}

.search-bar-pro input {
font-size: 18px !important;
}

.search-clear-btn {
width: 32px !important;
height: 32px !important;
min-width: 32px !important;
font-size: 16px !important;
}

.voice-display-field {
font-size: 18px !important;
width: 140px !important;
}

#ventesPage .action-buttons,
#commandesPage .action-buttons {
min-width: 120px !important;
gap: 4px !important;
}

#ventesPage .action-buttons .btn-edit,
#ventesPage .action-buttons .btn-delete,
#ventesPage .action-buttons .btn-add,
#commandesPage .action-buttons .btn-edit,
#commandesPage .action-buttons .btn-delete,
#commandesPage .action-buttons .btn-add {
width: 34px !important;
height: 34px !important;
min-width: 34px !important;
min-height: 34px !important;
font-size: 14px !important;
border-radius: 8px !important;
}

#ventesPage .action-buttons .btn-edit i,
#ventesPage .action-buttons .btn-delete i,
#ventesPage .action-buttons .btn-add i,
#commandesPage .action-buttons .btn-edit i,
#commandesPage .action-buttons .btn-delete i,
#commandesPage .action-buttons .btn-add i {
font-size: 16px !important;
}
}

@media(max-width:500px) {
#ventesPage .data-table tbody td,
#commandesPage .data-table tbody td {
font-size: 15px !important;
padding: 8px 10px !important;
}

.facture-cell {
font-size: 15px !important;
padding: 2px 6px !important;
}

.facture-cell .facture-number {
font-size: 15px !important;
}

.date-cell .date-line,
.date-cell .time-line {
font-size: 13px !important;
gap: 4px !important;
}

.date-cell .date-line i,
.date-cell .time-line i {
font-size: 12px !important;
width: 14px !important;
}

.client-cell {
font-size: 15px !important;
padding: 2px 6px !important;
}

.search-bar-pro input {
font-size: 15px !important;
padding: 10px 6px !important;
}

.search-clear-btn {
width: 28px !important;
height: 28px !important;
min-width: 28px !important;
font-size: 14px !important;
}

#ventesPage .filter-group select,
#commandesPage .filter-group select {
font-size: 16px !important;
padding: 8px 12px !important;
}

.voice-display-field {
font-size: 15px !important;
width: 100px !important;
padding: 6px 8px !important;
}

#ventesPage .action-buttons,
#commandesPage .action-buttons {
min-width: 90px !important;
gap: 2px !important;
}

#ventesPage .action-buttons .btn-edit,
#ventesPage .action-buttons .btn-delete,
#ventesPage .action-buttons .btn-add,
#commandesPage .action-buttons .btn-edit,
#commandesPage .action-buttons .btn-delete,
#commandesPage .action-buttons .btn-add {
width: 28px !important;
height: 28px !important;
min-width: 28px !important;
min-height: 28px !important;
font-size: 12px !important;
border-radius: 6px !important;
}

#ventesPage .action-buttons .btn-add.payer-btn,
#commandesPage .action-buttons .btn-add.payer-btn {
min-width: 40px !important;
font-size: 10px !important;
padding: 0 6px !important;
height: 28px !important;
}

#ventesPage .action-buttons .btn-edit i,
#ventesPage .action-buttons .btn-delete i,
#ventesPage .action-buttons .btn-add i,
#commandesPage .action-buttons .btn-edit i,
#commandesPage .action-buttons .btn-delete i,
#commandesPage .action-buttons .btn-add i {
font-size: 12px !important;
}
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', styles);
}

// ==================== COMMANDES EN LIGNE ====================
function loadCommandesPage(c) {
injectVentesStyles();

c.innerHTML = `
<div class="content-card" id="commandesPage">
<div class="card-header">
<h3 style="font-size:26px !important;"><i class="fas fa-shopping-basket"></i> Commandes en ligne</h3>
<div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
<div class="search-bar-pro">
<i class="fas fa-search"></i>
<input type="text" id="commandesSearchInput"
placeholder="Rechercher (client, email, tél, produit)..."
onkeyup="window.commandesSearch = this.value; window.currentPages.commandes=1; handleSearchInput('commandes'); applyCommandesFilters();">
<button class="search-clear-btn hidden" id="commandesClearBtn" onclick="clearSearch('commandes')" title="Effacer la recherche">
<i class="fas fa-times"></i>
</button>
</div>
<div class="filter-group">
<label><i class="far fa-calendar-alt"></i> Période</label>
<select id="commandesPeriodSelect" onchange="window.commandesPeriod = this.value; window.currentPages.commandes=1; applyCommandesFilters();">
${getPeriodOptions('all')}
</select>
</div>
<button class="btn-add" onclick="loadCommandes()" style="font-size:20px !important;padding:10px 20px !important;">
<i class="fas fa-sync-alt"></i> Actualiser
</button>
</div>
</div>
<div id="commandesTableContainer"></div>
<div id="commandesPagination" style="margin-top:12px;"></div>
</div>
`;
loadCommandes();
}

async function loadCommandes() {
try {
const snapshot = await db.collection('commandes').orderBy('createdAt', 'desc').limit(500).get();
window.allCommandesData = [];
snapshot.forEach(dc => {
var d = dc.data();
d.id = dc.id;
if (d.source === 'client') window.allCommandesData.push(d);
});
} catch (e) {
console.error('Erreur chargement commandes en ligne :', e);
const fallback = await db.collection('commandes').get();
window.allCommandesData = [];
fallback.forEach(dc => {
var d = dc.data();
if (d.source === 'client') {
d.id = dc.id;
window.allCommandesData.push(d);
}
});
window.allCommandesData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}
window.currentPages.commandes = 1;
applyCommandesFilters();
}

function applyCommandesFilters() {
var filtered = filterByPeriod(window.allCommandesData, window.commandesPeriod);
filtered = filterBySearch(filtered, window.commandesSearch, ['clientName', 'clientEmail', 'clientTelephone', 'items.nom']);
if (!window.sortOrders.commandes || !window.sortOrders.commandes.createdAt) {
filtered.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
} else {
filtered = applySort('commandes', filtered, 'createdAt');
}
window.filteredCommandes = filtered;
renderCommandesTablePro();
}

function renderCommandesTablePro() {
var cont = document.getElementById('commandesTableContainer');
if (!cont) return;
var data = (window.filteredCommandes || window.allCommandesData).slice();
if (!window.sortOrders.commandes || !window.sortOrders.commandes.createdAt) {
data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
} else {
data = applySort('commandes', data, 'createdAt');
}
var pageData = getPageData('commandes', data);
if (pageData.length === 0) {
cont.innerHTML = `
<div style="text-align:center;padding:60px 20px;">
<i class="fas fa-inbox" style="font-size:3rem;color:#d1d5db;"></i>
<p style="margin-top:16px;color:#6b7280;font-size:24px !important;">Aucune commande trouvée</p>
</div>
`;
document.getElementById('commandesPagination').innerHTML = '';
return;
}

var h = `
<div class="table-container">
<table class="data-table">
<thead>
<tr>
<th style="min-width:160px;"><i class="fas fa-receipt"></i> Facture</th>
<th style="min-width:150px;"><i class="far fa-calendar-alt"></i> Date / Heure</th>
<th style="min-width:180px;"><i class="fas fa-user"></i> Client</th>
<th><i class="fas fa-envelope"></i> Email</th>
<th><i class="fas fa-phone"></i> Tél</th>
<th><i class="fas fa-box"></i> Articles</th>
<th><i class="fas fa-cog"></i> Options</th>
${makeSortableHeader('commandes', 'total', '💰 Total', 'renderCommandesTablePro')}
${makeSortableHeader('commandes', 'statut', '📌 Statut', 'renderCommandesTablePro')}
<th style="min-width:200px;"><i class="fas fa-tools"></i> Actions</th>
</tr>
</thead>
<tbody>
`;

pageData.forEach(function(d) {
const factureHtml = renderCommandeFactureCell(d);
const dt = d.createdAt ? formatDateHeure(d.createdAt.seconds) : { date: '-', time: '-', full: '-' };
const dateHtml = `
<div class="date-cell">
<div class="date-line"><i class="far fa-calendar-alt"></i> ${dt.date}</div>
<div class="time-line"><i class="far fa-clock"></i> ${dt.time}</div>
</div>
`;
const clientHtml = `
<div class="client-cell">
<i class="fas fa-user-circle"></i> ${escapeHtml(d.clientName || 'Client inconnu')}
</div>
`;
var arts = d.items ? d.items.map(function(it) {
return '<strong>' + it.quantite + 'x</strong> ' + escapeHtml(it.nom);
}).join('<br>') : '-';

var opts = d.items ? d.items.map(function(it) {
var o = [];
if (it.sauces && it.sauces.length) o.push('<span style="color:#14B8A6;">🥫' + escapeHtml(it.sauces.join(',')) + '</span>');
if (it.interdits && it.interdits.length) o.push('<span style="color:#ef4444;">🚫' + escapeHtml(it.interdits.join(',')) + '</span>');
if (it.epice && it.epice !== 'Normal') o.push('<span style="color:#d97706;">🌶️' + escapeHtml(it.epice) + '</span>');
if (it.sel && it.sel !== 'Normal') o.push('<span style="color:#4f46e5;">🧂' + escapeHtml(it.sel) + '</span>');
return o.length ? o.join(' | ') : '<span style="color:#9ca3af;">Aucune option</span>';
}).join('<br>') : '-';

var statutMap = {
'payé': { class: 'status-success', label: 'Payée', icon: 'fa-check-circle' },
'valide': { class: 'status-success', label: 'Validée', icon: 'fa-check' },
'en_attente': { class: 'status-warning', label: 'En attente', icon: 'fa-clock' },
'annule': { class: 'status-danger', label: 'Annulée', icon: 'fa-times-circle' }
};
var st = statutMap[d.statut] || { class: 'status-warning', label: d.statut || 'Inconnu', icon: 'fa-question-circle' };

var act = '';
if (d.statut === 'en_attente') {
act = `
<div class="action-buttons">
<button class="btn-add" onclick="validateCommande('${d.id}')" title="Valider">
<i class="fas fa-check"></i>
</button>
<button class="btn-edit" onclick="payCommande('${d.id}')" title="Payer" style="background:#10B981;color:#fff;">
<i class="fas fa-money-bill-wave"></i>
</button>
<button class="btn-delete" onclick="cancelCommande('${d.id}')" title="Annuler">
<i class="fas fa-times"></i>
</button>
</div>
`;
} else if (d.statut === 'valide') {
act = `
<div class="action-buttons">
<button class="btn-edit" onclick="payCommande('${d.id}')" title="Payer" style="background:#10B981;color:#fff;">
<i class="fas fa-money-bill-wave"></i>
</button>
</div>
`;
} else if (d.statut === 'payé') {
act = `<span style="color:#10B981;font-weight:600;font-size:20px !important;"><i class="fas fa-check-circle"></i> Payée</span>`;
} else {
act = `<span style="color:#9ca3af;">${d.statut || '-'}</span>`;
}

h += `
<tr>
<td>${factureHtml}</td>
<td>${dateHtml}</td>
<td>${clientHtml}</td>
<td>${escapeHtml(d.clientEmail || '-')}</td>
<td>${escapeHtml(d.clientTelephone || '-')}</td>
<td>${arts}</td>
<td>${opts}</td>
<td><span class="amount-total">${d.total.toFixed(2)} MAD</span></td>
<td><span class="${st.class}"><i class="fas ${st.icon}"></i> ${st.label}</span></td>
<td>${act}</td>
</tr>
`;
});

h += `
</tbody>
</table>
</div>
<div class="total-row-pro">
<span class="total-label">Total des commandes</span>
<span class="total-amount"><i class="fas fa-dollar-sign"></i> ${data.reduce((sum, d) => sum + (d.total || 0), 0).toFixed(2)} MAD</span>
</div>
`;
cont.innerHTML = h;
document.getElementById('commandesPagination').innerHTML = getPaginationHTML('commandes', data.length);
}

async function validateCommande(cid) {
if (!confirm('Valider cette commande ?')) return;
await CacheDB.write('commandes', cid, {
statut: 'valide',
validatedAt: firebase.firestore.FieldValue.serverTimestamp(),
validatedBy: window.currentUserData ? window.currentUserData.userData.prenom + ' ' + window.currentUserData.userData.nom : 'Admin'
}, 'update');
alert('✅ Validée !');
loadCommandes();
CacheDB.sync();
}

async function payCommande(cid) {
if (!confirm('Payer cette commande ? Redirection vers le POS...')) return;
var dc = await db.collection('commandes').doc(cid).get();
if (!dc.exists) { alert('Introuvable'); return; }
var cmd = dc.data();
localStorage.setItem('posCommandeData', JSON.stringify({
commandeId: cid,
clientId: cmd.clientId,
clientName: cmd.clientName,
items: cmd.items,
total: cmd.total,
table: cmd.table || ''
}));
navigateTo('pos');
}

function cancelCommande(cid) {
if (confirm('Annuler ?')) {
CacheDB.write('commandes', cid, { statut: 'annule' }, 'update').then(function() {
alert('❌ Annulée');
loadCommandes();
CacheDB.sync();
});
}
}

// ==================== VENTES ====================
function loadVentesPage(c) {
injectVentesStyles();

loadClientsForSearch();

window.ventesPeriod = 'all';
window.ventesSearch = '';
window.venteSelectionMode = false;
window.venteSelectedIndex = -1;
if (!window.sortOrders.ventes) window.sortOrders.ventes = {};
if (!window.sortOrders.ventes.createdAt) { window.sortOrders.ventes.createdAt = 'desc'; }

c.innerHTML = `
<div class="content-card" id="ventesPage">
<div class="card-header">
<h3 style="font-size:26px !important;"><i class="fas fa-shopping-cart"></i> Ventes</h3>
<div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
<div class="search-bar-pro">
<i class="fas fa-search"></i>
<input type="text" id="ventesSearchInput"
placeholder="Rechercher (client, produit, description)..."
onkeyup="handleVentesSearch(this.value);">
<button class="search-clear-btn hidden" id="ventesClearBtn" onclick="clearVentesSearch()" title="Effacer la recherche">
<i class="fas fa-times"></i>
</button>
</div>
<input type="text" id="ventesVoiceDisplay" placeholder="🎤 Audio..." class="voice-display-field" readonly>
<div class="filter-group">
<label><i class="far fa-calendar-alt"></i> Période</label>
<select id="ventesPeriodSelect" onchange="window.ventesPeriod = this.value; window.currentPages.ventes=1; applyVentesFilters();">
${getPeriodOptions('all')}
</select>
</div>
<div class="filter-group">
<label><i class="fas fa-filter"></i> Statut</label>
<select id="ventesStatusFilter" onchange="applyVentesFilters();">
<option value="all">Tous</option>
<option value="payé">Payé</option>
<option value="crédit">Crédit</option>
<option value="partiel">Partiel</option>
<option value="en_attente">En attente</option>
</select>
</div>
<button class="btn-add" onclick="loadVentes()" style="font-size:20px !important;padding:10px 20px !important;">
<i class="fas fa-sync-alt"></i> Actualiser
</button>
</div>
</div>
<div id="ventesTableContainer"></div>
<div id="ventesPagination" style="margin-top:12px;"></div>
</div>
`;

ajouterBoutonsSelectionVentes();
loadVentes();
}

function ajouterBoutonsSelectionVentes() {
var header = document.querySelector('#ventesPage .card-header');
if (!header) {
setTimeout(ajouterBoutonsSelectionVentes, 500);
return;
}

if (document.getElementById('selectAllVentesBtn')) return;

var btnContainer = document.createElement('div');
btnContainer.className = 'ventes-select-buttons';
btnContainer.style.cssText = 'display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-left:auto;';

var countSpan = document.createElement('span');
countSpan.id = 'selectedVentesCount';
countSpan.textContent = '0 sélectionnée(s)';

var selectAllBtn = document.createElement('button');
selectAllBtn.id = 'selectAllVentesBtn';
selectAllBtn.textContent = '✅ Tout sélectionner';
selectAllBtn.onclick = toggleAllVentesSelection;

var deleteBtn = document.createElement('button');
deleteBtn.id = 'deleteSelectedVentesBtn';
deleteBtn.textContent = '🗑️ Supprimer les sélectionnés';
deleteBtn.style.display = 'none';
deleteBtn.onclick = deleteSelectedVentes;

btnContainer.appendChild(selectAllBtn);
btnContainer.appendChild(deleteBtn);
btnContainer.appendChild(countSpan);

header.appendChild(btnContainer);
}

function handleVentesSearch(value) {
window.ventesSearch = value;
window.currentPages.ventes = 1;
handleSearchInput('ventes');
applyVentesFilters();
}

function clearVentesSearch() {
var searchField = document.getElementById('ventesSearchInput');
if (searchField) {
searchField.value = '';
window.ventesSearch = '';
applyVentesFilters();
var clearBtn = document.getElementById('ventesClearBtn');
if (clearBtn) {
clearBtn.classList.add('hidden');
}
}
}

function processVentesSearchFromVoice(text) {
var searchField = document.getElementById('ventesSearchInput');
var periodSelect = document.getElementById('ventesPeriodSelect');
var voiceDisplay = document.getElementById('ventesVoiceDisplay');

if (!searchField || !periodSelect) return;

var detectedFilter = detectPeriodFilterVentes(text);
if (detectedFilter) {
periodSelect.value = detectedFilter;
window.ventesPeriod = detectedFilter;
window.currentPages.ventes = 1;

searchField.value = '';
window.ventesSearch = '';

if (voiceDisplay) {
var filterLabels = {
'today': '📅 Aujourd\'hui',
'week': '📅 Cette semaine',
'month': '📅 Ce mois',
'year': '📅 Cette année',
'all': '📅 Toutes les ventes'
};
voiceDisplay.value = filterLabels[detectedFilter] || '📅 Filtre appliqué';
setTimeout(function() { voiceDisplay.value = ''; }, 2000);
}

applyVentesFilters();

var clearBtn = document.getElementById('ventesClearBtn');
if (clearBtn) clearBtn.classList.add('hidden');

return true;
}

searchField.value = text;
window.ventesSearch = text;
window.currentPages.ventes = 1;
applyVentesFilters();

return false;
}

async function loadVentes() {
var isAdmin = window.currentUserData && window.currentUserData.userData.role === 'admin';
var vendeurCaissier = '';
if (!isAdmin && window.currentUserData) {
vendeurCaissier = window.currentUserData.userData.prenom + ' ' + window.currentUserData.userData.nom;
}
try {
const snapshot = await db.collection('ventes').orderBy('createdAt', 'desc').limit(2000).get();
window.allVentesData = [];
snapshot.forEach(dc => {
var d = dc.data(); d.id = dc.id;
var achat = 0, profit = 0;
if (d.items) {
d.items.forEach(function(it) {
var pa = it.prixAchat || 0, pv = it.prixVente || 0, pp = it.prixPromo || 0,
pvr = (pp > 0) ? pp : pv, q = it.quantite || 1;
achat += pa * q;
profit += (pvr - pa) * q;
});
}
d.achat = achat; d.profit = profit;
window.allVentesData.push(d);
});
if (!isAdmin) {
window.allVentesData = window.allVentesData.filter(function(d) { return d.vendeur === vendeurCaissier; });
}
if (!window.sortOrders.ventes) window.sortOrders.ventes = {};
if (!window.sortOrders.ventes.createdAt) { window.sortOrders.ventes.createdAt = 'desc'; }
} catch (e) { console.error('Erreur chargement ventes:', e); }
window.currentPages.ventes = 1;
applyVentesFilters();
}

function applyVentesFilters() {
var filtered = filterByPeriod(window.allVentesData, window.ventesPeriod);

if (window.ventesSearch && window.ventesSearch.trim() !== '') {
filtered = filterVentesBySearchWithDescription(filtered, window.ventesSearch);
} else {
filtered.forEach(function(d) {
delete d._clientDisplayName;
});
}

var statusFilter = document.getElementById('ventesStatusFilter');
if (statusFilter && statusFilter.value !== 'all') {
filtered = filtered.filter(function(d) {
return (d.statutPaiement || (d.paid ? 'payé' : 'impayé')) === statusFilter.value;
});
}

if (!window.sortOrders.ventes || !window.sortOrders.ventes.createdAt) {
filtered.sort(function(a, b) {
var da = a.createdAt?.seconds || 0;
var db = b.createdAt?.seconds || 0;
return db - da;
});
} else {
filtered = applySort('ventes', filtered, 'createdAt');
}
window.filteredVentes = filtered;
renderVentesTablePro();
}

function renderVentesTablePro() {
var cont = document.getElementById('ventesTableContainer');
if (!cont) return;
var isAdmin = window.currentUserData && window.currentUserData.userData.role === 'admin';
var data = (window.filteredVentes || window.allVentesData).slice();

if (window.sortOrders.ventes && window.sortOrders.ventes.createdAt) {
data = applySort('ventes', data, 'createdAt');
} else {
data.sort(function(a, b) {
var da = a.createdAt?.seconds || 0;
var db = b.createdAt?.seconds || 0;
return db - da;
});
}

var pageData = getPageData('ventes', data);
if (pageData.length === 0) {
cont.innerHTML = `
<div style="text-align:center;padding:60px 20px;">
<i class="fas fa-inbox" style="font-size:3rem;color:#d1d5db;"></i>
<p style="margin-top:16px;color:#6b7280;font-size:24px !important;">Aucune vente trouvée</p>
</div>
`;
document.getElementById('ventesPagination').innerHTML = '';
return;
}

var tv = 0, tProfit = 0, tAchat = 0;

var h = `
<div class="table-container">
<table class="data-table">
<thead>
<tr>
<th style="width:40px; text-align:center;">
<input type="checkbox" id="ventesSelectAllCheckbox" onchange="toggleAllVentesSelection()" title="Tout sélectionner">
</th>
<th style="min-width:160px;"><i class="fas fa-receipt"></i> Facture</th>
<th style="min-width:150px;"><i class="far fa-calendar-alt"></i> Date / Heure</th>
<th style="min-width:180px;"><i class="fas fa-user"></i> Client</th>
${isAdmin ? `<th><i class="fas fa-box"></i> Articles</th><th><i class="fas fa-cog"></i> Options</th>` : ''}
${isAdmin ? `<th><i class="fas fa-coins"></i> Achat</th><th><i class="fas fa-chart-line"></i> Profit</th>` : ''}
<th><i class="fas fa-tag"></i> Total</th>
<th><i class="fas fa-percent"></i> Remise</th>
<th><i class="fas fa-hand-holding-usd"></i> Donné</th>
<th><i class="fas fa-undo-alt"></i> Rendu</th>
${isAdmin ? `<th><i class="fas fa-user-tie"></i> Vendeur</th>` : ''}
<th><i class="fas fa-credit-card"></i> Paiement</th>
<th><i class="fas fa-circle"></i> Statut</th>
<th style="min-width:200px;"><i class="fas fa-tools"></i> Actions</th>
</tr>
</thead>
<tbody>
`;

pageData.forEach(function(d, index) {
var isChecked = ventesSelectionnees.has(d.id) ? 'checked' : '';
const factureNum = d.factureNum || d.id?.substring(0, 8) || '---';
const factureHtml = `
<div class="facture-cell">
<i class="fas fa-receipt"></i>
<span class="facture-number">#${factureNum}</span>
</div>
`;
const dateHtml = renderDateCell(d);
const clientHtml = renderClientCell(d);

var arts = d.items ? d.items.map(function(it) {
return '<strong>' + it.quantite + 'x</strong> ' + escapeHtml(it.nom);
}).join('<br>') : '-';

var opts = d.items ? d.items.map(function(it) {
var o = [];
if (it.sauces && it.sauces.length) o.push('<span style="color:#14B8A6;">🥫' + escapeHtml(it.sauces.join(',')) + '</span>');
if (it.interdits && it.interdits.length) o.push('<span style="color:#ef4444;">🚫' + escapeHtml(it.interdits.join(',')) + '</span>');
if (it.epice && it.epice !== 'Normal') o.push('<span style="color:#d97706;">🌶️' + escapeHtml(it.epice) + '</span>');
if (it.sel && it.sel !== 'Normal') o.push('<span style="color:#4f46e5;">🧂' + escapeHtml(it.sel) + '</span>');
return o.length ? o.join(' | ') : '<span style="color:#9ca3af;">Aucune option</span>';
}).join('<br>') : '-';

tv += d.total || 0;
tProfit += d.profit || 0;
tAchat += d.achat || 0;

var statutMap = {
'payé': { class: 'status-success', label: 'Payé', icon: 'fa-check-circle' },
'crédit': { class: 'status-warning', label: 'Crédit', icon: 'fa-hand-holding-usd' },
'partiel': { class: 'status-warning', label: 'Partiel', icon: 'fa-clock' },
'en_attente': { class: 'status-danger', label: 'En attente', icon: 'fa-hourglass-half' }
};
var st = statutMap[d.statutPaiement] || { class: 'status-warning', label: d.statutPaiement || 'Inconnu', icon: 'fa-question-circle' };

var actions = `
<div class="action-buttons">
<button class="btn-edit" onclick="printFacture('${d.id}')" title="Imprimer / PDF">
<i class="fas fa-print"></i>
</button>
<button class="btn-edit whatsapp-btn" onclick="sendWhatsApp('${d.id}')" title="Envoyer WhatsApp">
<i class="fab fa-whatsapp"></i>
</button>
`;
if (!d.paid) {
actions += `<button class="btn-add payer-btn" onclick="payerVente('${d.id}')" title="Payer">
<i class="fas fa-check"></i> Payer
</button>`;
}
if (isAdmin) {
actions += `
<button class="btn-edit" onclick="editVente('${d.id}')" title="Modifier">
<i class="fas fa-edit"></i>
</button>
<button class="btn-delete" onclick="deleteVente('${d.id}')" title="Supprimer">
<i class="fas fa-trash-alt"></i>
</button>
`;
}
actions += `</div>`;

h += `
<tr>
<td style="text-align:center; vertical-align:middle;">
<input type="checkbox" class="vente-checkbox" data-id="${d.id}" ${isChecked} onchange="toggleVenteSelection('${d.id}')">
</td>
<td onclick="openFactureDetails('${d.id}', '${escapeHtml(factureNum)}')" style="cursor:pointer;">
${factureHtml}
</td>
<td>${dateHtml}</td>
<td>${clientHtml}</td>
${isAdmin ? `<td>${arts}</td><td>${opts}</td>` : ''}
${isAdmin ? `<td>${(d.achat || 0).toFixed(2)}</td><td style="color:#14B8A6;font-weight:700;">${(d.profit || 0).toFixed(2)}</td>` : ''}
<td><span class="amount-total">${(d.total || 0).toFixed(2)} MAD</span></td>
<td>${(d.discountMAD || 0).toFixed(2)}</td>
<td>${(d.amountGiven || 0).toFixed(2)}</td>
<td>${(d.change || 0).toFixed(2)}</td>
${isAdmin ? `<td>${escapeHtml(d.vendeur || '-')}</td>` : ''}
<td>${escapeHtml(d.paymentMethod || '-')}</td>
<td><span class="${st.class}"><i class="fas ${st.icon}"></i> ${st.label}</span></td>
<td>${actions}</td>
</tr>
`;
});

h += `
</tbody>
</table>
</div>
<div class="total-row-pro">
<div style="display:flex;gap:32px;flex-wrap:wrap;justify-content:flex-end;width:100%;">
<div>
<span class="total-label">Total Ventes</span>
<span class="total-amount"><i class="fas fa-dollar-sign"></i> ${tv.toFixed(2)} MAD</span>
</div>
${isAdmin ? `
<div>
<span class="total-label">Total Achat</span>
<span class="total-amount" style="color:#6b7280;"><i class="fas fa-coins"></i> ${tAchat.toFixed(2)} MAD</span>
</div>
<div>
<span class="total-label">Profit Total</span>
<span class="total-amount" style="color:#14B8A6;"><i class="fas fa-chart-line"></i> ${tProfit.toFixed(2)} MAD</span>
</div>
` : ''}
</div>
</div>
`;
cont.innerHTML = h;
document.getElementById('ventesPagination').innerHTML = getPaginationHTML('ventes', data.length);
updateVenteSelectionUI();
}

function editVente(did) {
db.collection('ventes').doc(did).get().then(function(doc) {
if (doc.exists) {
window.editingId = did;
window.currentCollection = 'ventes';
var d = doc.data();
var h = `
<div class="form-row">
<div class="form-group">
<label><i class="fas fa-circle"></i> Statut paiement</label>
<select id="editStatut">
<option value="payé" ${d.statutPaiement === 'payé' ? 'selected' : ''}>Payé</option>
<option value="crédit" ${d.statutPaiement === 'crédit' ? 'selected' : ''}>Crédit</option>
<option value="partiel" ${d.statutPaiement === 'partiel' ? 'selected' : ''}>Partiel</option>
<option value="en_attente" ${d.statutPaiement === 'en_attente' ? 'selected' : ''}>En attente</option>
</select>
</div>
<div class="form-group">
<label><i class="fas fa-hand-holding-usd"></i> Montant donné</label>
<input type="number" id="editAmountGiven" value="${d.amountGiven || 0}" step="0.01">
</div>
</div>
<div class="form-row">
<div class="form-group">
<label><i class="fas fa-undo-alt"></i> Montant rendu</label>
<input type="number" id="editChange" value="${d.change || 0}" step="0.01">
</div>
<div class="form-group">
<label><i class="fas fa-hourglass-half"></i> Reste à payer</label>
<input type="number" id="editRemaining" value="${d.remainingAmount || 0}" step="0.01">
</div>
</div>
<button class="btn-cancel" onclick="closeModal()">Annuler</button>
<button class="btn-save" onclick="saveEditVente()"><i class="fas fa-save"></i> Enregistrer</button>
`;
openModal('Modifier vente ' + (d.factureNum || ''), h);
}
});
}

function saveEditVente() {
var statut = document.getElementById('editStatut').value;
var amountGiven = parseFloat(document.getElementById('editAmountGiven').value) || 0;
var change = parseFloat(document.getElementById('editChange').value) || 0;
var remaining = parseFloat(document.getElementById('editRemaining').value) || 0;
var paid = (statut === 'payé');
var data = {
statutPaiement: statut,
amountGiven: amountGiven,
change: change,
remainingAmount: paid ? 0 : remaining,
paid: paid,
updatedAt: firebase.firestore.FieldValue.serverTimestamp()
};
saveDocument('ventes', data, function() { closeModal(); loadVentes(); });
}

function deleteVente(did) {
if (confirm('Supprimer définitivement cette vente ?')) {
CacheDB.write('ventes', did, null, 'delete').then(function() {
alert('✅ Supprimé');
loadVentes();
CacheDB.sync();
});
}
}

async function payerVente(did) {
if (!confirm('Payer cette vente ? Redirection vers le POS...')) return;
var dc = await db.collection('ventes').doc(did).get();
if (!dc.exists) { alert('Introuvable'); return; }
var d = dc.data();
localStorage.setItem('posPayerVente', JSON.stringify({
venteId: did,
clientId: d.clientId,
clientName: d.clientName,
items: d.items,
total: d.total,
table: d.table || ''
}));
navigateTo('pos');
}

function printFacture(did) {
db.collection('ventes').doc(did).get().then(function(dc) {
if (dc.exists) imprimerFacture(dc.data(), dc.id);
else {
db.collection('credits').doc(did).get().then(function(cd) {
if (cd.exists) imprimerFacture(cd.data(), cd.id);
});
}
});
}

function imprimerFacture(d, id) {
var ih = '';
if (d.items) {
d.items.forEach(function(it) {
var o = '';
if (it.interdits && it.interdits.length > 0) o += ' 🚫' + it.interdits.join(',');
if (it.permis && it.permis.length > 0) o += ' ✅' + it.permis.join(',');
if (it.epice && it.epice !== 'Normal') o += ' 🌶️' + it.epice;
ih += `<tr><td>${escapeHtml(it.nom)}${o}</td><td>${it.quantite}</td><td>${(it.prixVente || 0).toFixed(2)}</td><td>${((it.prixVente || 0) * it.quantite).toFixed(2)}</td></tr>`;
});
}
var w = window.open('', '_blank', 'width=400,height=600');
w.document.write(`
<html><head><title>Facture E-SOLUTION</title>
<style>
body{font-family:'Inter',Arial,sans-serif;padding:24px;background:#f9fafb;}
.invoice{background:#fff;padding:24px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06);}
h2{text-align:center;color:#111827;}
.header-info{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0;font-size:0.9rem;}
table{width:100%;border-collapse:collapse;margin:16px 0;}
th{background:#f3f4f6;padding:8px 12px;text-align:left;font-weight:600;font-size:0.8rem;}
td{padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:0.85rem;}
.total{font-size:1.2rem;font-weight:800;text-align:right;margin-top:16px;padding-top:16px;border-top:2px solid #111827;}
.footer{text-align:center;color:#6b7280;font-size:0.75rem;margin-top:20px;}
</style>
</head><body>
<div class="invoice">
<h2>🛒 E-SOLUTION</h2>
<div class="header-info">
<div><strong>Facture:</strong> ${d.factureNum || id.substring(0, 8)}</div>
<div><strong>Date:</strong> ${d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleString('fr-FR') : ''}</div>
<div><strong>Client:</strong> ${d.clientName || d.table || '-'}</div>
<div><strong>Vendeur:</strong> ${d.vendeur || '-'}</div>
</div>
<table>
<tr><th>Article</th><th>Qté</th><th>Prix</th><th>Total</th></tr>
${ih}
</table>
${d.discountMAD > 0 ? `<p><strong>Remise:</strong> -${d.discountMAD.toFixed(2)} MAD</p>` : ''}
<div class="total">Total: ${d.total.toFixed(2)} MAD</div>
<div class="footer">Merci de votre visite ! 🌟</div>
</div>
</body></html>
`);
w.document.close();
setTimeout(function() { w.print(); }, 500);
}

async function sendWhatsApp(did) {
try {
const doc = await db.collection('ventes').doc(did).get();
if (!doc.exists) { alert('Vente introuvable'); return; }
const vente = doc.data();

let phone = '';

const allClients = (window.posAllClients && window.posAllClients.length)
? window.posAllClients
: (window.allClientsData || []);
let client = null;

if (vente.clientId) {
client = allClients.find(c => c.id === vente.clientId);
} else if (vente.clientName) {
const normalized = (vente.clientName || '')
.normalize('NFD')
.replace(/[\u0300-\u036f]/g, '')
.toLowerCase()
.trim();
client = allClients.find(c => {
const full = ((c.nom || '') + ' ' + (c.prenom || ''))
.normalize('NFD')
.replace(/[\u0300-\u036f]/g, '')
.toLowerCase()
.trim();
return full === normalized;
});
}

if (client) {
phone = client.whatsapp || client.telephone || '';
}

if (!phone && vente.clientId) {
try {
const clientDoc = await db.collection('clients').doc(vente.clientId).get();
if (clientDoc.exists) {
const cdata = clientDoc.data();
phone = cdata.whatsapp || cdata.telephone || '';
}
} catch (e) {}
}

phone = phone.replace(/[^\d+]/g, '').trim();
if (phone.startsWith('0')) {
phone = '+212' + phone.substring(1);
} else if (!phone.startsWith('+')) {
phone = '+' + phone;
}

if (!phone || phone === '+') {
alert('❌ Aucun numéro WhatsApp trouvé.');
return;
}

var msg = '🧾 *FACTURE E-SOLUTION*\n';
msg += '━━━━━━━━━━━━━━━━━━\n';
msg += '📄 ' + (vente.factureNum || did.substring(0, 8)) + '\n';
msg += '📅 ' + (vente.createdAt ? new Date(vente.createdAt.seconds * 1000).toLocaleDateString('fr-FR') : '') + '\n';
msg += '👤 ' + (vente.clientName || '-') + '\n';
msg += '━━━━━━━━━━━━━━━━━━\n';
if (vente.items) {
vente.items.forEach(function(it) {
var opt = '';
if (it.interdits && it.interdits.length) opt += ' 🚫' + it.interdits.join(',');
if (it.epice && it.epice !== 'Normal') opt += ' 🌶️' + it.epice;
if (it.sel && it.sel !== 'Normal') opt += ' 🧂' + it.sel;
msg += it.quantite + 'x ' + it.nom + opt + ' → ' + ((it.prixVente || 0) * it.quantite).toFixed(2) + ' MAD\n';
});
}
msg += '━━━━━━━━━━━━━━━━━━\n';
if (vente.discountMAD > 0) msg += 'Remise: -' + vente.discountMAD.toFixed(2) + ' MAD\n';
msg += '*💰 TOTAL: ' + vente.total.toFixed(2) + ' MAD*\n';
if (vente.paymentMethod === 'crédit') msg += '📋 Reste à payer: ' + (vente.remainingAmount || vente.total).toFixed(2) + ' MAD\n';
msg += '━━━━━━━━━━━━━━━━━━\n';
msg += '🙏 Merci de votre visite !\n';
msg += '🛒 E-SOLUTION';

var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg);

var w = window.open(url, '_blank');
if (!w || w.closed) {
var modalHtml = `
<div style="text-align:center;padding:10px;">
<i class="fab fa-whatsapp" style="font-size:4rem;color:#25D366;"></i>
<p style="margin:16px 0;font-size:1.1rem;">Cliquez sur le bouton ci-dessous pour envoyer la facture</p>
<a href="${url}" target="_blank" rel="noopener noreferrer"
style="display:inline-block;padding:14px 32px;background:#25D366;color:#fff;
border-radius:12px;font-weight:700;text-decoration:none;font-size:1.1rem;">
<i class="fab fa-whatsapp"></i> Envoyer sur WhatsApp
</a>
</div>
`;
openModal('📱 Envoyer WhatsApp', modalHtml);
}

} catch (e) {
console.error('WhatsApp:', e);
alert('❌ Erreur lors de l\'envoi WhatsApp');
}
}

function clearSearch(target) {
if (target === 'ventes') {
clearVentesSearch();
} else if (target === 'commandes') {
const searchField = document.getElementById('commandesSearchInput');
if (searchField) {
searchField.value = '';
window.commandesSearch = '';
applyCommandesFilters();
const clearBtn = document.getElementById('commandesClearBtn');
if (clearBtn) clearBtn.classList.add('hidden');
}
}
}

function handleSearchInput(target) {
const searchField = document.getElementById(target + 'SearchInput');
const clearBtn = document.getElementById(target + 'ClearBtn');
if (searchField && clearBtn) {
if (searchField.value.length > 0) {
clearBtn.classList.remove('hidden');
} else {
clearBtn.classList.add('hidden');
}
}
}

// ==================== FONCTIONS POUR LE MODAL DÉTAILS FACTURE (FONT SIZE AGRANDI) ====================

// Variable pour stocker l'ID de la facture en cours
var currentFactureId = null;

// Fonction pour ouvrir le modal des détails de facture
function openFactureDetails(factureId, factureNum) {
    // Créer le modal s'il n'existe pas
    var modal = document.getElementById('factureDetailsModal');
    if (!modal) {
        var modalHTML = `
            <div id="factureDetailsModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:9999;align-items:center;justify-content:center;padding:20px;">
                <div style="background:var(--bg-card);border-radius:var(--radius-xl);width:100%;max-width:900px;max-height:90vh;display:flex;flex-direction:column;box-shadow:var(--shadow-xl);border:1px solid var(--border);">
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 24px;border-bottom:2px solid var(--border);flex-shrink:0;">
                        <h3 id="factureDetailsTitle" style="font-size:1.4rem;font-weight:700;color:var(--text-primary);margin:0;display:flex;align-items:center;gap:10px;">
                            <i class="fas fa-file-invoice" style="color:var(--accent);font-size:1.4rem;"></i>
                            📄 Détails de la facture
                        </h3>
                        <button onclick="closeFactureDetails()" style="background:none;border:none;font-size:2rem;cursor:pointer;color:var(--text-muted);padding:0 14px;border-radius:8px;transition:var(--transition);display:flex;align-items:center;justify-content:center;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div id="factureDetailsBody" style="flex:1;overflow-y:auto;padding:24px;padding-top:16px;">
                        <div style="text-align:center;padding:40px;">
                            <i class="fas fa-spinner fa-spin" style="font-size:2.5rem;color:var(--accent);"></i>
                            <p style="color:var(--text-secondary);margin-top:12px;font-size:1.1rem;">Chargement...</p>
                        </div>
                    </div>
                    <div style="padding:12px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;flex-shrink:0;">
                        <button onclick="closeFactureDetails()" style="padding:12px 28px;border-radius:var(--radius);border:none;background:var(--gray-100);color:var(--text-secondary);font-weight:600;cursor:pointer;transition:var(--transition);font-size:1rem;">
                            Fermer
                        </button>
                        <button onclick="printFactureDetails()" style="padding:12px 28px;border-radius:var(--radius);border:none;background:var(--black);color:var(--white);font-weight:600;cursor:pointer;transition:var(--transition);font-size:1rem;display:flex;align-items:center;gap:8px;">
                            <i class="fas fa-print"></i> Imprimer
                        </button>
                    </div>
                </div>
            </div>
        `;
        var div = document.createElement('div');
        div.innerHTML = modalHTML;
        document.body.appendChild(div.firstElementChild);
        
        // Fermer en cliquant à l'extérieur
        document.getElementById('factureDetailsModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeFactureDetails();
            }
        });
        
        modal = document.getElementById('factureDetailsModal');
    }
    
    // Afficher le modal
    modal.style.display = 'flex';
    document.getElementById('factureDetailsTitle').textContent = '📄 Détails facture N° ' + (factureNum || 'N/A');
    currentFactureId = factureId;
    loadFactureDetails(factureId);
}

// Fonction pour fermer le modal des détails
function closeFactureDetails() {
    var modal = document.getElementById('factureDetailsModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentFactureId = null;
}

// Fonction pour charger les données de la facture
async function loadFactureDetails(factureId) {
    var body = document.getElementById('factureDetailsBody');
    if (!body) return;
    
    try {
        var doc = await db.collection('ventes').doc(factureId).get();
        
        if (!doc.exists) {
            body.innerHTML = `
                <div style="text-align:center;padding:40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--danger);"></i>
                    <p style="color:var(--text-secondary);margin-top:12px;font-size:1.1rem;">Facture non trouvée</p>
                </div>
            `;
            return;
        }
        
        var data = doc.data();
        renderFactureDetails(data);
        
    } catch(e) {
        console.error('Erreur chargement facture:', e);
        body.innerHTML = `
            <div style="text-align:center;padding:40px;">
                <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:var(--danger);"></i>
                <p style="color:var(--text-secondary);margin-top:12px;font-size:1.1rem;">Erreur lors du chargement: ${e.message}</p>
            </div>
        `;
    }
}

// Fonction pour afficher les détails de la facture - FONT SIZE AGRANDI
function renderFactureDetails(data) {
    var body = document.getElementById('factureDetailsBody');
    if (!body) return;
    
    var date = data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date();
    var dateStr = date.toLocaleDateString('fr-FR');
    var timeStr = date.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
    
    var statusBg = data.statutPaiement === 'payé' ? '#ECFDF5' : data.statutPaiement === 'crédit' ? '#FEF3C7' : '#FEE2E2';
    var statusColor = data.statutPaiement === 'payé' ? '#065F46' : data.statutPaiement === 'crédit' ? '#92400E' : '#991B1B';
    
    var html = `
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid var(--border);">
            <div>
                <h4 style="font-size:1.4rem;font-weight:700;color:var(--text-primary);margin:0;">Facture N° ${data.factureNum || 'N/A'}</h4>
                <p style="color:var(--text-secondary);font-size:1.1rem;margin:6px 0 0 0;">
                    <i class="far fa-calendar-alt"></i> ${dateStr} à ${timeStr}
                </p>
            </div>
            <span style="display:inline-block;padding:6px 18px;border-radius:20px;font-size:1rem;font-weight:600;text-transform:uppercase;background:${statusBg};color:${statusColor};">
                ${data.statutPaiement || 'N/A'}
            </span>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
            <div style="background:var(--bg-page);border-radius:var(--radius);padding:14px 18px;border:1px solid var(--border);">
                <p style="font-size:0.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin:0 0 6px 0;">Client</p>
                <p style="font-size:1.2rem;font-weight:600;color:var(--text-primary);margin:0;">${escapeHtml(data.clientName || 'Passager')}</p>
                <p style="font-size:1rem;color:var(--text-secondary);margin:4px 0 0 0;">${data.clientId ? 'ID: ' + data.clientId : 'Client non identifié'}</p>
            </div>
            <div style="background:var(--bg-page);border-radius:var(--radius);padding:14px 18px;border:1px solid var(--border);">
                <p style="font-size:0.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin:0 0 6px 0;">Table / Vendeur</p>
                <p style="font-size:1.2rem;font-weight:600;color:var(--text-primary);margin:0;">${escapeHtml(data.table || '—')}</p>
                <p style="font-size:1rem;color:var(--text-secondary);margin:4px 0 0 0;">👤 ${escapeHtml(data.vendeur || 'N/A')}</p>
            </div>
        </div>
        
        <div style="margin-bottom:18px;">
            <p style="font-size:0.9rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin:0 0 10px 0;">Articles</p>
            <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;font-size:1rem;">
                    <thead>
                        <tr style="background:var(--bg-page);">
                            <th style="padding:10px 14px;text-align:left;font-weight:600;color:var(--text-secondary);border-bottom:2px solid var(--border);font-size:0.9rem;">Produit</th>
                            <th style="padding:10px 14px;text-align:center;font-weight:600;color:var(--text-secondary);border-bottom:2px solid var(--border);font-size:0.9rem;">Qté</th>
                            <th style="padding:10px 14px;text-align:right;font-weight:600;color:var(--text-secondary);border-bottom:2px solid var(--border);font-size:0.9rem;">Prix unit.</th>
                            <th style="padding:10px 14px;text-align:right;font-weight:600;color:var(--text-secondary);border-bottom:2px solid var(--border);font-size:0.9rem;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    var items = data.items || [];
    if (items.length === 0) {
        html += '<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--text-muted);font-size:1rem;">Aucun article</td></tr>';
    } else {
        items.forEach(function(item) {
            var prix = item.prixVente || item.prixUnitaire || 0;
            var total = prix * (item.quantite || 1);
            var opts = '';
            if (item.interdits && item.interdits.length) opts += ' 🚫' + escapeHtml(item.interdits.join(','));
            if (item.epice && item.epice !== 'Normal') opts += ' 🌶️' + escapeHtml(item.epice);
            if (item.sel && item.sel !== 'Normal') opts += ' 🧂' + escapeHtml(item.sel);
            
            html += `
                <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:10px 14px;color:var(--text-primary);font-size:1.05rem;">${escapeHtml(item.nom || 'Produit')}${opts}</td>
                    <td style="padding:10px 14px;text-align:center;color:var(--text-primary);font-size:1.05rem;">${item.quantite || 1}</td>
                    <td style="padding:10px 14px;text-align:right;color:var(--text-secondary);font-size:1.05rem;">${prix.toFixed(2)} MAD</td>
                    <td style="padding:10px 14px;text-align:right;font-weight:600;color:var(--text-primary);font-size:1.05rem;">${total.toFixed(2)} MAD</td>
                </tr>
            `;
        });
    }
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
        
        <div style="display:flex;justify-content:flex-end;padding-top:16px;border-top:2px solid var(--border);">
            <div style="width:280px;">
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:1.1rem;color:var(--text-secondary);">
                    <span>Sous-total</span>
                    <span>${(data.subtotal || 0).toFixed(2)} MAD</span>
                </div>
                ${data.discountMAD > 0 ? `
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:1.1rem;color:var(--danger);">
                    <span>Remise</span>
                    <span>-${data.discountMAD.toFixed(2)} MAD</span>
                </div>
                ` : ''}
                <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:1.5rem;font-weight:700;color:var(--text-primary);border-top:2px solid var(--border);margin-top:6px;">
                    <span>Total</span>
                    <span>${(data.total || 0).toFixed(2)} MAD</span>
                </div>
                ${data.amountGiven > 0 ? `
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:1.1rem;color:var(--text-secondary);">
                    <span>Montant donné</span>
                    <span>${(data.amountGiven || 0).toFixed(2)} MAD</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:1.1rem;font-weight:600;color:${data.change >= 0 ? 'var(--success)' : 'var(--danger)'};">
                    <span>${data.change >= 0 ? 'Rendu' : 'Manquant'}</span>
                    <span>${Math.abs(data.change || 0).toFixed(2)} MAD</span>
                </div>
                ` : ''}
                ${data.remainingAmount > 0 ? `
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:1.1rem;font-weight:600;color:var(--danger);">
                    <span>Reste à payer</span>
                    <span>${(data.remainingAmount || 0).toFixed(2)} MAD</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    body.innerHTML = html;
}

// Fonction pour imprimer depuis le modal
function printFactureDetails() {
    if (currentFactureId) {
        printFacture(currentFactureId);
    } else {
        alert('Aucune facture sélectionnée');
    }
}

// ==================== EXPOSITION DES FONCTIONS GLOBALES ====================

window.loadCommandesPage = loadCommandesPage;
window.loadCommandes = loadCommandes;
window.applyCommandesFilters = applyCommandesFilters;
window.renderCommandesTablePro = renderCommandesTablePro;
window.validateCommande = validateCommande;
window.payCommande = payCommande;
window.cancelCommande = cancelCommande;
window.loadVentesPage = loadVentesPage;
window.loadVentes = loadVentes;
window.applyVentesFilters = applyVentesFilters;
window.renderVentesTablePro = renderVentesTablePro;
window.editVente = editVente;
window.saveEditVente = saveEditVente;
window.deleteVente = deleteVente;
window.payerVente = payerVente;
window.printFacture = printFacture;
window.imprimerFacture = imprimerFacture;
window.sendWhatsApp = sendWhatsApp;
window.clearSearch = clearSearch;
window.handleSearchInput = handleSearchInput;
window.injectVentesStyles = injectVentesStyles;
window.detectPeriodFilterVentes = detectPeriodFilterVentes;
window.processVentesSearchFromVoice = processVentesSearchFromVoice;
window.handleVentesSearch = handleVentesSearch;
window.clearVentesSearch = clearVentesSearch;
window.loadClientsForSearch = loadClientsForSearch;
window.filterVentesBySearchWithDescription = filterVentesBySearchWithDescription;
window.toggleVenteSelection = toggleVenteSelection;
window.toggleAllVentesSelection = toggleAllVentesSelection;
window.deleteSelectedVentes = deleteSelectedVentes;
window.updateVenteSelectionUI = updateVenteSelectionUI;
window.ajouterBoutonsSelectionVentes = ajouterBoutonsSelectionVentes;

// ✅ AJOUT DES FONCTIONS MODAL FACTURE
window.openFactureDetails = openFactureDetails;
window.closeFactureDetails = closeFactureDetails;
window.loadFactureDetails = loadFactureDetails;
window.renderFactureDetails = renderFactureDetails;
window.printFactureDetails = printFactureDetails;

console.log('🚀 E-SOLUTION - Admin Ventes PRO chargé');
console.log('✅ Détails facture modal ajouté - Font size agrandi');
