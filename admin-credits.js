// ==================== ADMIN-CREDITS.JS - E-SOLUTION ====================
// Version : Design PRO - Facture/Date/Client en colonnes séparées
// BOUTONS AVEC ICÔNES CORRIGÉS - Font Awesome fonctionnel
// Version FINALE

// ========== VARIABLES GLOBALES ==========
window.creditsPeriod = window.creditsPeriod || 'all';
window.creditsSearch = window.creditsSearch || '';
window.creditSelectionMode = false;
window.creditSelectedIds = [];
window.allCreditsData = window.allCreditsData || [];
window.clientsDataForSearch = window.clientsDataForSearch || [];

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

function normalize(str) {
return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function detectPeriodFilterCredits(text) {
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
if (cleaned.includes("tout") || cleaned.includes("toutes") || cleaned.includes("all") || cleaned.includes("tous") || cleaned.includes("toute les credits") || cleaned.includes("tout les crédits")) {
return 'all';
}
return null;
}

async function loadClientsForSearchCredits() {
try {
const snapshot = await db.collection('clients').limit(2000).get();
window.clientsDataForSearch = [];
snapshot.forEach(doc => {
var d = doc.data();
d.id = doc.id;
window.clientsDataForSearch.push(d);
});
console.log('📋 Clients chargés pour recherche description (Crédits):', window.clientsDataForSearch.length);
} catch(e) {
console.warn('Erreur chargement clients pour recherche:', e);
window.clientsDataForSearch = [];
}
}

function filterCreditsBySearchWithDescription(data, query) {
if (!query || query.trim() === '') return data;

var q = query.toLowerCase().trim();
var results = [];
var clientsMap = {};

window.clientsDataForSearch.forEach(function(c) {
clientsMap[c.id] = c;
});

data.forEach(function(credit) {
var match = false;
var clientInfo = null;

if (credit.clientName && credit.clientName.toLowerCase().indexOf(q) !== -1) {
match = true;
}

if (!match && credit.items) {
for (var i = 0; i < credit.items.length; i++) {
if (credit.items[i].nom && credit.items[i].nom.toLowerCase().indexOf(q) !== -1) {
match = true;
break;
}
}
}

if (!match && credit.clientId && clientsMap[credit.clientId]) {
var client = clientsMap[credit.clientId];
var description = client.description || '';
if (description.toLowerCase().indexOf(q) !== -1) {
match = true;
clientInfo = client;
}
}

if (!match && credit.clientName && !credit.clientId) {
for (var id in clientsMap) {
var c = clientsMap[id];
var fullName = (c.nom || '') + ' ' + (c.prenom || '');
if (fullName.trim().toLowerCase() === credit.clientName.toLowerCase()) {
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
credit._clientDisplayName = (clientInfo.nom || '') + ' ' + (clientInfo.prenom || '');
} else if (credit.clientId && clientsMap[credit.clientId]) {
var c = clientsMap[credit.clientId];
credit._clientDisplayName = (c.nom || '') + ' ' + (c.prenom || '');
} else {
credit._clientDisplayName = credit.clientName || credit.table || 'Client inconnu';
}
results.push(credit);
}
});

return results;
}

function renderCreditFactureCell(credit) {
const factureNum = credit.factureNum || credit.id?.substring(0, 8) || '---';
return `
<div class="facture-cell">
<i class="fas fa-file-invoice"></i>
<span class="facture-number">#${factureNum}</span>
</div>
`;
}

function renderCreditDateCell(credit) {
const dt = credit.createdAt ? formatDateHeure(credit.createdAt.seconds) : { date: '-', time: '-', full: '-' };
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

function renderCreditClientCell(credit) {
var clientName = credit._clientDisplayName || credit.clientName || credit.table || 'Client inconnu';
return `
<div class="client-cell">
<i class="fas fa-user-circle"></i>
<span>${escapeHtml(clientName)}</span>
</div>
`;
}

function injectCreditsStyles() {
const styleId = 'credits-pro-styles-final';
if (document.getElementById(styleId)) return;

const styles = `
<style id="${styleId}">
#creditsPage,
#creditsPage * {
font-size: 22px !important;
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}

#creditsPage .stat-label,
#creditsPage .filter-group label,
#creditsPage .total-label {
font-size: 16px !important;
}

#creditsPage .btn-add,
#creditsPage .btn-edit,
#creditsPage .btn-delete,
#creditsPage .btn-save,
#creditsPage .btn-cancel {
font-size: 18px !important;
}

#creditsPage .status-success,
#creditsPage .status-warning,
#creditsPage .status-danger {
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

#creditsPage .data-table {
font-size: 22px !important;
border-collapse: separate;
border-spacing: 0 4px;
width: 100%;
}

#creditsPage .data-table thead th {
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

#creditsPage .data-table thead th i {
font-size: 16px !important;
margin-right: 6px;
}

#creditsPage .data-table tbody td {
padding: 14px 16px !important;
font-size: 22px !important;
vertical-align: middle;
background: var(--white);
border-bottom: 1px solid var(--gray-100);
}

#creditsPage .data-table tbody tr:hover td {
background: var(--gray-50);
}

.amount-total {
font-weight: 800 !important;
font-size: 24px !important;
color: var(--black) !important;
letter-spacing: -0.3px;
}

.amount-remaining {
font-weight: 800 !important;
font-size: 24px !important;
color: var(--danger) !important;
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

#creditsPage .action-buttons {
display: flex !important;
align-items: center !important;
justify-content: center !important;
gap: 6px !important;
flex-wrap: nowrap !important;
min-width: 180px !important;
}

#creditsPage .action-buttons .btn-edit,
#creditsPage .action-buttons .btn-delete,
#creditsPage .action-buttons .btn-add {
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

#creditsPage .action-buttons .btn-edit i,
#creditsPage .action-buttons .btn-delete i,
#creditsPage .action-buttons .btn-add i {
font-size: 20px !important;
pointer-events: none !important;
line-height: 1 !important;
}

#creditsPage .action-buttons .btn-edit:hover {
background: var(--gray-200) !important;
color: var(--black) !important;
transform: translateY(-2px) !important;
box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
}

#creditsPage .action-buttons .btn-delete {
color: #ef4444 !important;
background: rgba(239, 68, 68, 0.08) !important;
}

#creditsPage .action-buttons .btn-delete:hover {
background: rgba(239, 68, 68, 0.15) !important;
transform: translateY(-2px) !important;
box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15) !important;
}

#creditsPage .action-buttons .btn-add {
background: var(--black) !important;
color: var(--white) !important;
}

#creditsPage .action-buttons .btn-add:hover {
background: var(--primary-hover) !important;
transform: translateY(-2px) !important;
box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
}

#creditsPage .action-buttons .btn-add.payer-btn {
background: #10B981 !important;
color: #fff !important;
font-size: 14px !important;
padding: 0 12px !important;
width: auto !important;
min-width: 60px !important;
border-radius: 8px !important;
gap: 4px !important;
}

#creditsPage .action-buttons .btn-add.payer-btn:hover {
background: #059669 !important;
transform: translateY(-2px) !important;
}

#creditsPage .action-buttons .btn-add.payer-btn i {
font-size: 14px !important;
}

#creditsPage .filter-group {
display: flex;
align-items: center;
gap: 10px;
}

#creditsPage .filter-group label {
font-size: 16px !important;
font-weight: 600;
color: var(--text-secondary);
text-transform: uppercase;
letter-spacing: 0.5px;
}

#creditsPage .filter-group select {
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

#creditsPage .filter-group select:focus {
border-color: var(--black);
outline: none;
box-shadow: 0 0 0 3px rgba(0,0,0,0.04);
}

#creditsPage .total-row-pro {
display: flex;
justify-content: flex-end;
align-items: center;
gap: 32px;
padding: 18px 24px;
background: #fef2f2;
border-radius: 14px;
margin-top: 18px;
border: 1px solid #fecaca;
flex-wrap: wrap;
}

#creditsPage .total-row-pro .total-label {
font-size: 16px !important;
font-weight: 700;
color: var(--text-secondary);
text-transform: uppercase;
letter-spacing: 0.5px;
}

#creditsPage .total-row-pro .total-amount {
font-size: 28px !important;
font-weight: 900;
color: var(--danger);
letter-spacing: -0.5px;
}

#creditsPage .total-row-pro .total-amount i {
color: var(--danger);
font-size: 22px !important;
margin-right: 6px;
}

@media(max-width:1024px) {
#creditsPage .action-buttons {
min-width: 140px !important;
gap: 4px !important;
}

#creditsPage .action-buttons .btn-edit,
#creditsPage .action-buttons .btn-delete,
#creditsPage .action-buttons .btn-add {
width: 38px !important;
height: 38px !important;
min-width: 38px !important;
min-height: 38px !important;
font-size: 16px !important;
}

#creditsPage .action-buttons .btn-add.payer-btn {
min-width: 50px !important;
font-size: 12px !important;
padding: 0 10px !important;
}
}

@media(max-width:768px) {
#creditsPage .data-table tbody td {
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

#creditsPage .action-buttons {
min-width: 120px !important;
gap: 4px !important;
}

#creditsPage .action-buttons .btn-edit,
#creditsPage .action-buttons .btn-delete,
#creditsPage .action-buttons .btn-add {
width: 34px !important;
height: 34px !important;
min-width: 34px !important;
min-height: 34px !important;
font-size: 14px !important;
border-radius: 8px !important;
}

#creditsPage .action-buttons .btn-edit i,
#creditsPage .action-buttons .btn-delete i,
#creditsPage .action-buttons .btn-add i {
font-size: 16px !important;
}
}

@media(max-width:500px) {
#creditsPage .data-table tbody td {
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

#creditsPage .filter-group select {
font-size: 16px !important;
padding: 8px 12px !important;
}

.voice-display-field {
font-size: 15px !important;
width: 100px !important;
padding: 6px 8px !important;
}

#creditsPage .action-buttons {
min-width: 90px !important;
gap: 2px !important;
}

#creditsPage .action-buttons .btn-edit,
#creditsPage .action-buttons .btn-delete,
#creditsPage .action-buttons .btn-add {
width: 28px !important;
height: 28px !important;
min-width: 28px !important;
min-height: 28px !important;
font-size: 12px !important;
border-radius: 6px !important;
}

#creditsPage .action-buttons .btn-add.payer-btn {
min-width: 40px !important;
font-size: 10px !important;
padding: 0 6px !important;
height: 28px !important;
}

#creditsPage .action-buttons .btn-edit i,
#creditsPage .action-buttons .btn-delete i,
#creditsPage .action-buttons .btn-add i {
font-size: 12px !important;
}
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', styles);
}

// ==================== PAGE CRÉDITS ====================
async function loadCreditsPage(c) {
injectCreditsStyles();

await loadClientsForSearchCredits();

window.creditsPeriod = 'all';
window.creditsSearch = '';
window.creditSelectionMode = false;
window.creditSelectedIds = [];

if (!window.sortOrders.credits) window.sortOrders.credits = {};
if (!window.sortOrders.credits.createdAt) window.sortOrders.credits.createdAt = 'desc';

c.innerHTML = `
<div class="content-card" id="creditsPage">
<div class="card-header">
<h3 style="font-size:26px !important;"><i class="fas fa-credit-card"></i> Crédits</h3>
<div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
<div class="search-bar-pro">
<i class="fas fa-search"></i>
<input type="text" id="creditsSearchInput"
placeholder="Rechercher (client, produit, description)..."
onkeyup="handleCreditsSearch(this.value);">
<button class="search-clear-btn hidden" id="creditsClearBtn" onclick="clearCreditsSearch()" title="Effacer la recherche">
<i class="fas fa-times"></i>
</button>
</div>
<input type="text" id="creditsVoiceDisplay" placeholder="🎤 Audio..." class="voice-display-field" readonly>
<div class="filter-group">
<label><i class="far fa-calendar-alt"></i> Période</label>
<select id="creditsPeriodSelect" onchange="window.creditsPeriod = this.value; window.currentPages.credits=1; applyCreditsFilters();">
${getPeriodOptions('all')}
</select>
</div>
<button class="btn-add" onclick="loadCredits()" style="font-size:20px !important;padding:10px 20px !important;">
<i class="fas fa-sync-alt"></i> Actualiser
</button>
<button id="toggleSelectionBtn" class="btn-add" onclick="toggleCreditSelectionMode()" style="font-size:18px !important;padding:10px 16px !important;">
<i class="fas fa-check-square"></i> Sélectionner
</button>
<button id="selectAllBtn" class="btn-add" onclick="toggleSelectAllVisible()" style="display:none; background:#4f46e5; font-size:18px !important;padding:10px 16px !important;">
<i class="fas fa-check-double"></i> Tout sélectionner
</button>
<button id="deleteSelectedBtn" class="btn-delete" onclick="deleteSelectedCredits()" style="display:none; background:#fee2e2; color:#b91c1c; font-size:18px !important;padding:10px 16px !important;">
<i class="fas fa-trash"></i> Supprimer
</button>
</div>
</div>
<div id="creditsTableContainer"></div>
<div id="creditsPagination" style="margin-top:12px;"></div>
</div>
`;

loadCredits();
}

function handleCreditsSearch(value) {
window.creditsSearch = value;
window.currentPages.credits = 1;
handleSearchInputCredits('credits');
applyCreditsFilters();
}

function clearCreditsSearch() {
var searchField = document.getElementById('creditsSearchInput');
if (searchField) {
searchField.value = '';
window.creditsSearch = '';
applyCreditsFilters();
var clearBtn = document.getElementById('creditsClearBtn');
if (clearBtn) {
clearBtn.classList.add('hidden');
}
}
}

function processCreditsSearchFromVoice(text) {
var searchField = document.getElementById('creditsSearchInput');
var periodSelect = document.getElementById('creditsPeriodSelect');
var voiceDisplay = document.getElementById('creditsVoiceDisplay');

if (!searchField || !periodSelect) return;

var detectedFilter = detectPeriodFilterCredits(text);
if (detectedFilter) {
periodSelect.value = detectedFilter;
window.creditsPeriod = detectedFilter;
window.currentPages.credits = 1;

searchField.value = '';
window.creditsSearch = '';

if (voiceDisplay) {
var filterLabels = {
'today': '📅 Aujourd\'hui',
'week': '📅 Cette semaine',
'month': '📅 Ce mois',
'year': '📅 Cette année',
'all': '📅 Tous les crédits'
};
voiceDisplay.value = filterLabels[detectedFilter] || '📅 Filtre appliqué';
setTimeout(function() { voiceDisplay.value = ''; }, 2000);
}

applyCreditsFilters();

var clearBtn = document.getElementById('creditsClearBtn');
if (clearBtn) clearBtn.classList.add('hidden');

return true;
}

searchField.value = text;
window.creditsSearch = text;
window.currentPages.credits = 1;
applyCreditsFilters();

return false;
}

function handleSearchInputCredits(target) {
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

async function loadCredits() {
var isAdmin = window.currentUserData && window.currentUserData.userData.role === 'admin';
var vendeurCaissier = '';
if (!isAdmin && window.currentUserData) {
vendeurCaissier = window.currentUserData.userData.prenom + ' ' + window.currentUserData.userData.nom;
}

const cached = await CacheDB.getAll('credits');
if (cached.length) {
window.allCreditsData = cached;
if (!isAdmin) {
window.allCreditsData = window.allCreditsData.filter(function(d) {
return d.vendeur === vendeurCaissier;
});
}
if (!window.sortOrders.credits) window.sortOrders.credits = {};
if (!window.sortOrders.credits.createdAt) window.sortOrders.credits.createdAt = 'desc';
window.currentPages.credits = 1;
applyCreditsFilters();
}

if (navigator.onLine) {
try {
const snapshot = await db.collection('credits').orderBy('createdAt', 'desc').limit(2000).get();
window.allCreditsData = [];
snapshot.forEach(function(dc) {
var d = dc.data();
d.id = dc.id;
window.allCreditsData.push(d);
});

if (!isAdmin) {
window.allCreditsData = window.allCreditsData.filter(function(d) {
return d.vendeur === vendeurCaissier;
});
}

for (let doc of window.allCreditsData) {
await CacheDB.set('credits', doc.id, doc);
}

if (!window.sortOrders.credits) window.sortOrders.credits = {};
if (!window.sortOrders.credits.createdAt) window.sortOrders.credits.createdAt = 'desc';
} catch (e) {
console.error('Erreur chargement crédits:', e);
}
}

window.currentPages.credits = 1;
applyCreditsFilters();
}

function applyCreditsFilters() {
var filtered = filterByPeriod(window.allCreditsData, window.creditsPeriod);

if (window.creditsSearch && window.creditsSearch.trim() !== '') {
filtered = filterCreditsBySearchWithDescription(filtered, window.creditsSearch);
} else {
filtered.forEach(function(d) {
delete d._clientDisplayName;
});
}

if (!window.sortOrders.credits || !window.sortOrders.credits.createdAt) {
filtered.sort(function(a, b) {
var da = a.createdAt?.seconds || 0;
var db = b.createdAt?.seconds || 0;
return db - da;
});
} else {
filtered = applySort('credits', filtered, 'createdAt');
}

window.filteredCredits = filtered;
renderCreditsTablePro();
}

function renderCreditsTablePro() {
var cont = document.getElementById('creditsTableContainer');
if (!cont) return;

var data = (window.filteredCredits || window.allCreditsData).slice();

if (window.sortOrders.credits && window.sortOrders.credits.createdAt) {
data = applySort('credits', data, 'createdAt');
} else {
data.sort(function(a, b) {
var da = a.createdAt?.seconds || 0;
var db = b.createdAt?.seconds || 0;
return db - da;
});
}

var pageData = getPageData('credits', data);

if (pageData.length === 0) {
cont.innerHTML = `
<div style="text-align:center;padding:60px 20px;">
<i class="fas fa-inbox" style="font-size:3rem;color:#d1d5db;"></i>
<p style="margin-top:16px;color:#6b7280;font-size:24px !important;">Aucun crédit trouvé</p>
</div>
`;
document.getElementById('creditsPagination').innerHTML = '';
return;
}

var tc = 0;
var isAdmin = window.currentUserData && window.currentUserData.userData.role === 'admin';

var h = `
<div class="table-container">
<table class="data-table">
<thead>
<tr>
<th style="min-width:160px;"><i class="fas fa-file-invoice"></i> Facture</th>
<th style="min-width:150px;"><i class="far fa-calendar-alt"></i> Date / Heure</th>
<th style="min-width:180px;"><i class="fas fa-user"></i> Client</th>
<th><i class="fas fa-box"></i> Articles</th>
<th><i class="fas fa-tag"></i> Total</th>
<th><i class="fas fa-hand-holding-usd"></i> Payé</th>
<th><i class="fas fa-hourglass-half"></i> Restant</th>
<th><i class="fas fa-credit-card"></i> Mode</th>
${isAdmin ? `<th><i class="fas fa-user-tie"></i> Vendeur</th>` : ''}
<th style="min-width:200px;"><i class="fas fa-tools"></i> Actions</th>
${window.creditSelectionMode ? '<th style="width:40px;">☑️</th>' : ''}
</tr>
</thead>
<tbody>
`;

pageData.forEach(function(d, index) {
var reste = d.remainingAmount || d.total || 0;
if (!d.paid) tc += reste;

const factureHtml = renderCreditFactureCell(d);
const dateHtml = renderCreditDateCell(d);
const clientHtml = renderCreditClientCell(d);

var articlesHtml = '';
if (d.items && d.items.length > 0) {
articlesHtml = d.items.map(function(it) {
return '<strong>' + (it.quantite || 1) + 'x</strong> ' + escapeHtml(it.nom || '');
}).join('<br>');
} else {
articlesHtml = '-';
}

var mode = d.paymentMethod || '-';
var amountPaid = d.amountGiven || 0;

var actions = `
<div class="action-buttons">
<button class="btn-edit" onclick="printFacture('${d.id}')" title="Imprimer / PDF">
<i class="fas fa-print"></i>
</button>
`;
if (!d.paid) {
actions += `<button class="btn-add payer-btn" onclick="payerCredit('${d.id}')" title="Payer">
<i class="fas fa-check"></i> Payer
</button>`;
}
if (isAdmin) {
actions += `
<button class="btn-edit" onclick="editCredit('${d.id}')" title="Modifier">
<i class="fas fa-edit"></i>
</button>
<button class="btn-delete" onclick="if(confirm('Supprimer définitivement ce crédit ?')) deleteCredit('${d.id}')" title="Supprimer">
<i class="fas fa-trash-alt"></i>
</button>
`;
}
actions += `</div>`;

var isSelected = window.creditSelectedIds.includes(d.id);
var rowClass = isSelected ? ' style="background:#fef3c7; border-left:4px solid #d97706;"' : '';

h += `<tr${rowClass}>
<td>${factureHtml}</td>
<td>${dateHtml}</td>
<td>${clientHtml}</td>
<td>${articlesHtml}</td>
<td><span class="amount-total">${d.total.toFixed(2)} MAD</span></td>
<td>${amountPaid.toFixed(2)} MAD</td>
<td><span class="amount-remaining">${reste.toFixed(2)} MAD</span></td>
<td>${escapeHtml(mode)}</td>
${isAdmin ? `<td>${escapeHtml(d.vendeur || '-')}</td>` : ''}
<td>${actions}</td>
${window.creditSelectionMode ? `<td style="text-align:center;"><input type="checkbox" class="credit-select-check" data-id="${d.id}" ${isSelected ? 'checked' : ''} onchange="toggleCreditSelection('${d.id}')" style="transform:scale(1.5);width:24px;height:24px;"></td>` : ''}
</tr>`;
});

h += `
</tbody>
</table>
</div>
<div class="total-row-pro">
<span class="total-label">Total Impayés</span>
<span class="total-amount"><i class="fas fa-exclamation-triangle"></i> ${tc.toFixed(2)} MAD</span>
</div>
`;

cont.innerHTML = h;
document.getElementById('creditsPagination').innerHTML = getPaginationHTML('credits', data.length);
}

function toggleCreditSelectionMode() {
window.creditSelectionMode = !window.creditSelectionMode;
window.creditSelectedIds = [];
var selectAllBtn = document.getElementById('selectAllBtn');
if (selectAllBtn) {
selectAllBtn.innerHTML = '<i class="fas fa-check-double"></i> Tout sélectionner';
selectAllBtn.style.background = '#4f46e5';
}
window.selectAllBtnState = false;

var selectBtn = document.getElementById('toggleSelectionBtn');
var deleteBtn = document.getElementById('deleteSelectedBtn');
if (selectBtn) {
if (window.creditSelectionMode) {
selectBtn.innerHTML = '<i class="fas fa-times-circle"></i> Annuler';
} else {
selectBtn.innerHTML = '<i class="fas fa-check-square"></i> Sélectionner';
}
}
if (selectAllBtn) {
selectAllBtn.style.display = window.creditSelectionMode ? 'inline-block' : 'none';
}
if (deleteBtn) {
deleteBtn.style.display = 'none';
}
renderCreditsTablePro();
}

function toggleCreditSelection(id) {
var idx = window.creditSelectedIds.indexOf(id);
if (idx === -1) {
window.creditSelectedIds.push(id);
} else {
window.creditSelectedIds.splice(idx, 1);
}
updateDeleteButtonVisibility();
renderCreditsTablePro();
}

function updateDeleteButtonVisibility() {
var deleteBtn = document.getElementById('deleteSelectedBtn');
if (deleteBtn) {
if (window.creditSelectedIds.length === 0) {
deleteBtn.style.display = 'none';
} else {
deleteBtn.style.display = 'inline-block';
}
}
}

window.selectAllBtnState = false;

function selectAllVisibleCredits() {
var data = window.filteredCredits || window.allCreditsData;
var pageData = getPageData('credits', data);
window.creditSelectedIds = pageData.map(function(d) { return d.id; });
updateDeleteButtonVisibility();
renderCreditsTablePro();
}

function deselectAllVisibleCredits() {
window.creditSelectedIds = [];
updateDeleteButtonVisibility();
renderCreditsTablePro();
}

function toggleSelectAllVisible() {
if (window.selectAllBtnState) {
deselectAllVisibleCredits();
} else {
selectAllVisibleCredits();
}
window.selectAllBtnState = !window.selectAllBtnState;
var btn = document.getElementById('selectAllBtn');
if (btn) {
if (window.selectAllBtnState) {
btn.innerHTML = '<i class="fas fa-times"></i> Tout décocher';
btn.style.background = '#ef4444';
} else {
btn.innerHTML = '<i class="fas fa-check-double"></i> Tout sélectionner';
btn.style.background = '#4f46e5';
}
}
}

function deleteSelectedCredits() {
if (window.creditSelectedIds.length === 0) {
alert('Aucun crédit sélectionné.');
return;
}
if (!confirm('Supprimer définitivement les ' + window.creditSelectedIds.length + ' crédits sélectionnés ?')) return;

var promises = window.creditSelectedIds.map(function(id) {
return db.collection('credits').doc(id).delete().then(function() {
window.allCreditsData = window.allCreditsData.filter(function(c) { return c.id !== id; });
});
});

Promise.all(promises).then(function() {
alert('✅ ' + window.creditSelectedIds.length + ' crédit(s) supprimé(s).');
window.creditSelectedIds = [];
window.creditSelectionMode = false;
var selectBtn = document.getElementById('toggleSelectionBtn');
var deleteBtn = document.getElementById('deleteSelectedBtn');
var selectAllBtn = document.getElementById('selectAllBtn');
if (selectBtn) selectBtn.innerHTML = '<i class="fas fa-check-square"></i> Sélectionner';
if (deleteBtn) deleteBtn.style.display = 'none';
if (selectAllBtn) selectAllBtn.style.display = 'none';
loadCredits();
CacheDB.sync();
}).catch(function(e) {
alert('❌ Erreur: ' + e.message);
});
}

async function payerCredit(creditId) {
var data = window.filteredCredits || window.allCreditsData || [];
var credit = data.find(function(c) { return c.id === creditId; });
if (!credit) {
alert('Crédit introuvable');
return;
}

localStorage.setItem('posPayerCredit', JSON.stringify({
creditId: credit.id,
clientId: credit.clientId || null,
clientName: credit.clientName || '',
items: credit.items || [],
total: credit.total || 0,
table: credit.table || '',
amountGiven: credit.amountGiven || 0,
remainingAmount: credit.remainingAmount || credit.total || 0,
factureNum: credit.factureNum || ''
}));

if (typeof navigateTo === 'function') {
navigateTo('pos');
} else {
window.location.href = '#';
}
}

function printFacture(did) {
db.collection('credits').doc(did).get().then(function(dc) {
if (dc.exists) imprimerFactureCredit(dc.data(), dc.id);
});
}

function imprimerFactureCredit(d, id) {
var ih = '';
if (d.items) {
d.items.forEach(function(it) {
var o = '';
if (it.interdits && it.interdits.length > 0) o += ' 🚫' + it.interdits.join(',');
if (it.epice && it.epice !== 'Normal') o += ' 🌶️' + it.epice;
if (it.sel && it.sel !== 'Normal') o += ' 🧂' + it.sel;
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
.remaining{font-size:1rem;font-weight:700;text-align:right;color:#ef4444;margin-top:8px;}
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
<div><strong>Mode:</strong> ${d.paymentMethod || '-'}</div>
</div>
<table>
<tr><th>Article</th><th>Qté</th><th>Prix</th><th>Total</th></tr>
${ih}
</table>
${d.discountMAD > 0 ? `<p><strong>Remise:</strong> -${d.discountMAD.toFixed(2)} MAD</p>` : ''}
<div class="total">Total: ${d.total.toFixed(2)} MAD</div>
<div class="remaining">💰 Restant: ${(d.remainingAmount || d.total || 0).toFixed(2)} MAD</div>
<div class="footer">Merci de votre visite ! 🌟</div>
</div>
</body></html>
`);
w.document.close();
setTimeout(function() { w.print(); }, 500);
}

async function editCredit(id) {
try {
var doc = await db.collection('credits').doc(id).get();
if (!doc.exists) {
alert('Crédit introuvable');
return;
}
var d = doc.data();
window.editingId = id;
window.currentCollection = 'credits';

var h = `
<div class="form-row">
<div class="form-group">
<label><i class="fas fa-user"></i> Client</label>
<input type="text" id="editCreditClient" value="${escapeHtml(d.clientName || '')}" style="font-size:22px;padding:14px;">
</div>
<div class="form-group">
<label><i class="fas fa-tag"></i> Total (MAD)</label>
<input type="number" id="editCreditTotal" value="${(d.total || 0)}" step="0.01" style="font-size:22px;padding:14px;">
</div>
</div>
<div class="form-row">
<div class="form-group">
<label><i class="fas fa-hand-holding-usd"></i> Payé (MAD)</label>
<input type="number" id="editCreditPaid" value="${(d.amountGiven || 0)}" step="0.01" style="font-size:22px;padding:14px;">
</div>
<div class="form-group">
<label><i class="fas fa-hourglass-half"></i> Restant (MAD)</label>
<input type="number" id="editCreditRemaining" value="${(d.remainingAmount || 0)}" step="0.01" style="font-size:22px;padding:14px;">
</div>
</div>
<div class="form-row">
<div class="form-group">
<label><i class="fas fa-credit-card"></i> Mode de paiement</label>
<input type="text" id="editCreditMode" value="${escapeHtml(d.paymentMethod || '')}" style="font-size:22px;padding:14px;">
</div>
<div class="form-group">
<label><i class="fas fa-circle"></i> Statut</label>
<select id="editCreditStatut" style="font-size:22px;padding:14px;">
<option value="0" ${!d.paid ? 'selected' : ''}>Impayé</option>
<option value="1" ${d.paid ? 'selected' : ''}>Payé</option>
</select>
</div>
</div>
<button class="btn-cancel" onclick="closeModal()">Annuler</button>
<button class="btn-save" onclick="saveEditCredit()"><i class="fas fa-save"></i> Enregistrer</button>
`;

openModal('Modifier Crédit ' + (d.factureNum || id.substring(0, 8)), h);
} catch (e) {
console.error('Erreur editCredit:', e);
alert('Erreur lors du chargement du crédit');
}
}

async function saveEditCredit() {
var clientName = document.getElementById('editCreditClient').value.trim();
var total = parseFloat(document.getElementById('editCreditTotal').value) || 0;
var amountGiven = parseFloat(document.getElementById('editCreditPaid').value) || 0;
var remainingAmount = parseFloat(document.getElementById('editCreditRemaining').value) || 0;
var paymentMethod = document.getElementById('editCreditMode').value.trim();
var paid = document.getElementById('editCreditStatut').value === '1';

var data = {
clientName: clientName,
total: total,
amountGiven: amountGiven,
remainingAmount: paid ? 0 : remainingAmount,
paymentMethod: paymentMethod,
paid: paid,
updatedAt: firebase.firestore.FieldValue.serverTimestamp()
};

try {
await CacheDB.write('credits', window.editingId, data, 'update');
closeModal();
loadCredits();
CacheDB.sync();
alert('✅ Crédit mis à jour');
} catch (e) {
alert('❌ Erreur: ' + e.message);
}
}

async function deleteCredit(id) {
try {
await db.collection('credits').doc(id).delete();
window.allCreditsData = (window.allCreditsData || []).filter(function(c) { return c.id !== id; });
if (typeof loadCredits === 'function') loadCredits();
CacheDB.sync();
} catch (e) {
console.error('Erreur deleteCredit:', e);
throw e;
}
}

window.loadCreditsPage = loadCreditsPage;
window.loadCredits = loadCredits;
window.applyCreditsFilters = applyCreditsFilters;
window.renderCreditsTablePro = renderCreditsTablePro;
window.editCredit = editCredit;
window.deleteCredit = deleteCredit;
window.saveEditCredit = saveEditCredit;
window.payerCredit = payerCredit;
window.printFacture = printFacture;
window.imprimerFactureCredit = imprimerFactureCredit;
window.normalize = normalize;

window.toggleCreditSelectionMode = toggleCreditSelectionMode;
window.toggleCreditSelection = toggleCreditSelection;
window.deleteSelectedCredits = deleteSelectedCredits;
window.updateDeleteButtonVisibility = updateDeleteButtonVisibility;
window.toggleSelectAllVisible = toggleSelectAllVisible;
window.selectAllVisibleCredits = selectAllVisibleCredits;
window.deselectAllVisibleCredits = deselectAllVisibleCredits;
window.closeCreditSelection = closeCreditSelection;
window.clearCreditsSearch = clearCreditsSearch;
window.handleCreditsSearch = handleCreditsSearch;
window.handleSearchInputCredits = handleSearchInputCredits;
window.processCreditsSearchFromVoice = processCreditsSearchFromVoice;
window.detectPeriodFilterCredits = detectPeriodFilterCredits;
window.loadClientsForSearchCredits = loadClientsForSearchCredits;
window.filterCreditsBySearchWithDescription = filterCreditsBySearchWithDescription;
window.injectCreditsStyles = injectCreditsStyles;
window.renderCreditFactureCell = renderCreditFactureCell;
window.renderCreditDateCell = renderCreditDateCell;
window.renderCreditClientCell = renderCreditClientCell;

console.log('🚀 E-SOLUTION - Admin Credits PRO chargé');
