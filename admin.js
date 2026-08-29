// ==================== ADMIN.JS - MIXMAX MINIMARKET (COMPLET CORRIGÉ) ====================
// Toutes les variables globales utilisent window. pour compatibilité

// ==================== VARIABLES GLOBALES ====================
window.editingId = window.editingId || null;
window.currentCollection = window.currentCollection || '';
window.selectedCategoryFilter = window.selectedCategoryFilter || '';
window.sortOrders = window.sortOrders || {};
window.clientSearchQuery = window.clientSearchQuery || '';
window.pendingUsersData = window.pendingUsersData || [];

window.allCategoriesData = window.allCategoriesData || [];
window.allProductsData = window.allProductsData || [];
window.allClientsData = window.allClientsData || [];
window.allFournisseursData = window.allFournisseursData || [];
window.allDepensesData = window.allDepensesData || [];
window.allCommandesData = window.allCommandesData || [];
window.allVentesData = window.allVentesData || [];
window.allCreditsData = window.allCreditsData || [];
window.allUsersData = window.allUsersData || [];

window.currentPages = window.currentPages || {
categories: 1, products: 1, clients: 1, fournisseurs: 1,
depenses: 1, commandes: 1, ventes: 1, credits: 1, users: 1
};
window.itemsPerPage = window.itemsPerPage || 15;

window.ventesPeriod = window.ventesPeriod || 'all';
window.ventesSearch = window.ventesSearch || '';
window.creditsPeriod = window.creditsPeriod || 'all';
window.creditsSearch = window.creditsSearch || '';
window.commandesPeriod = window.commandesPeriod || 'all';
window.commandesSearch = window.commandesSearch || '';
window.usersSearchQuery = window.usersSearchQuery || '';

window.fournisseurCategoriesList = ['Alimentaire', 'Boissons', 'Emballage', 'Entretien', 'Viandes', 'Légumes', 'Sauces', 'Autre'];
window.allStockData = window.allStockData || [];
window.editCategoryData = window.editCategoryData || null;
window.filteredVentes = window.filteredVentes || null;
window.filteredCredits = window.filteredCredits || null;
window.filteredCommandes = window.filteredCommandes || null;
window.filteredUsers = window.filteredUsers || null;

// ==================== FONCTIONS UTILITAIRES ====================
function escapeHtml(str) {
if (!str) return '';
return str.replace(/[&<>]/g, function(m) {
if (m === '&') return '&amp;';
if (m === '<') return '&lt;';
if (m === '>') return '&gt;';
return m;
});
}

function toDate(val) {
if (!val) return null;
if (val.toDate && typeof val.toDate === 'function') return val.toDate();
if (val.seconds) return new Date(val.seconds * 1000);
if (typeof val === 'string') return new Date(val);
if (val instanceof Date) return val;
return null;
}

// ==================== MODAL & CRUD ====================
function openModal(t, b) {
var titleEl = document.getElementById('modalTitle');
var bodyEl = document.getElementById('modalBody');
var overlayEl = document.getElementById('modalOverlay');
if (titleEl) titleEl.textContent = t;
if (bodyEl) bodyEl.innerHTML = b;
if (overlayEl) overlayEl.classList.remove('hidden');
}

function closeModal() {
var overlay = document.getElementById('modalOverlay');
if (overlay) overlay.classList.add('hidden');
window.editingId = null;
window.currentCollection = '';
window.editCategoryData = null;
}

function fileToBase64(file, callback, maxWidth, maxHeight, quality) {
if (!file) { callback(null); return; }
maxWidth = maxWidth || 600;
maxHeight = maxHeight || 600;
quality = quality || 0.6;
if (!file.type.startsWith('image/')) {
var reader = new FileReader();
reader.onload = function(e) { callback(e.target.result); };
reader.readAsDataURL(file);
return;
}
var reader = new FileReader();
reader.onload = function(e) {
var img = new Image();
img.onload = function() {
var width = img.width, height = img.height;
if (width > maxWidth || height > maxHeight) {
var ratio = Math.min(maxWidth / width, maxHeight / height);
width = Math.floor(width * ratio);
height = Math.floor(height * ratio);
}
var canvas = document.createElement('canvas');
canvas.width = width;
canvas.height = height;
var ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0, width, height);
var compressedBase64 = canvas.toDataURL('image/jpeg', quality);
callback(compressedBase64);
};
img.src = e.target.result;
};
reader.readAsDataURL(file);
}

function previewImage(inp, pid) {
var p = document.getElementById(pid);
if (!p) return;
if (inp.files && inp.files[0]) {
var r = new FileReader();
r.onload = function(e) { p.innerHTML = '<img src="' + e.target.result + '" style="max-width:100px;margin-top:5px;border-radius:8px;">'; };
r.readAsDataURL(inp.files[0]);
}
}

async function saveDocument(cn, data, cb) {
try {
let resultId;
if (window.editingId) {
data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
resultId = await CacheDB.write(cn, window.editingId, data, 'update');
} else {
data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
resultId = await CacheDB.write(cn, null, data, 'add');
}
if (cb) cb(resultId);
CacheDB.sync();
} catch (err) { alert('Erreur: ' + err.message); }
}

async function deleteDocument(cn, id) {
if (confirm('Confirmer la suppression ?')) {
await CacheDB.write(cn, id, null, 'delete');
if (cn === 'categories') {
window.allCategoriesData = window.allCategoriesData.filter(function(x) { return x.id !== id; });
renderCategoriesTable();
} else if (cn === 'products') {
window.allProductsData = window.allProductsData.filter(function(x) { return x.id !== id; });
renderProductsTable();
} else if (cn === 'clients') {
window.allClientsData = window.allClientsData.filter(function(x) { return x.id !== id; });
renderClientsTable();
} else {
if (typeof refreshCurrentPage === 'function') refreshCurrentPage();
}
alert('Supprimé');
CacheDB.sync();
}
}

function refreshCurrentPage() {
var t = document.getElementById('pageTitle')?.textContent || '';
var m = { 'Catégories': 'categories', 'Produits': 'products', 'Clients': 'clients', 'Fournisseurs': 'fournisseurs', 'Dépenses': 'depenses', 'Ventes': 'ventes', 'Crédits': 'credits', 'Commandes en ligne': 'commandes' };
if (typeof navigateTo === 'function') navigateTo(m[t] || 'dashboard');
}

function editDocument(cn, id) {
db.collection(cn).doc(id).get().then(function(doc) {
if (doc.exists) { window.editingId = id; window.currentCollection = cn; openEditForm(cn, doc.data()); }
}).catch(e => console.error(e));
}

function openEditForm(cn, data) {
if (cn === 'categories') openCategoryForm(data);
else if (cn === 'products') openProductForm(data);
else if (cn === 'clients') openClientForm(data);
else if (cn === 'fournisseurs') openFournisseurForm(data);
else if (cn === 'depenses') openDepenseForm(data);
}

// ==================== SYSTÈME DE TRI ====================
function sortTableData(tableName, field, loadFn) {
if (!window.sortOrders[tableName]) window.sortOrders[tableName] = {};
if (!window.sortOrders[tableName][field]) window.sortOrders[tableName][field] = 'asc';
else window.sortOrders[tableName][field] = window.sortOrders[tableName][field] === 'asc' ? 'desc' : 'asc';
Object.keys(window.sortOrders[tableName]).forEach(function(k) { if (k !== field) window.sortOrders[tableName][k] = null; });
if (typeof loadFn === 'string') window[loadFn]();
else if (typeof loadFn === 'function') loadFn();
}

function getSortIcon(tableName, field) {
if (!window.sortOrders[tableName] || !window.sortOrders[tableName][field]) return '<i class="fas fa-sort" style="font-size:0.5rem;margin-left:2px;opacity:0.3;cursor:pointer;"></i>';
return window.sortOrders[tableName][field] === 'asc' ? '<i class="fas fa-sort-up" style="font-size:0.55rem;margin-left:2px;color:#A67C52;"></i>' : '<i class="fas fa-sort-down" style="font-size:0.55rem;margin-left:2px;color:#A67C52;"></i>';
}

function applySort(tableName, data, defaultField) {
if (!window.sortOrders[tableName]) window.sortOrders[tableName] = {};
var activeField = Object.keys(window.sortOrders[tableName]).find(function(k) { return window.sortOrders[tableName][k]; });
if (!activeField) activeField = defaultField;
var order = window.sortOrders[tableName][activeField] || 'asc';
return data.sort(function(a, b) {
var va = a[activeField], vb = b[activeField];
if (va === undefined || va === null) va = '';
if (vb === undefined || vb === null) vb = '';
if (typeof va === 'number' && typeof vb === 'number') return order === 'asc' ? va - vb : vb - va;
va = String(va).toLowerCase();
vb = String(vb).toLowerCase();
if (order === 'asc') return va > vb ? 1 : (va < vb ? -1 : 0);
else return va < vb ? 1 : (va > vb ? -1 : 0);
});
}

function makeSortableHeader(tableName, field, label, loadFnName) {
return '<th onclick="sortTableData(\'' + tableName + '\',\'' + field + '\', \'' + loadFnName + '\')" style="cursor:pointer;white-space:nowrap;">' + label + ' ' + getSortIcon(tableName, field) + '</th>';
}

// ==================== PAGINATION ====================
function getPaginationHTML(tableName, totalItems) {
var totalPages = Math.ceil(totalItems / window.itemsPerPage);
if (totalPages <= 1) return '';
var page = window.currentPages[tableName] || 1;
var html = '<div style="display:flex; justify-content:center; align-items:center; gap:10px; margin-top:15px; flex-wrap:wrap;">';
html += '<button onclick="changePage(\'' + tableName + '\', ' + (page - 1) + ')" ' + (page <= 1 ? 'disabled' : '') + ' style="padding:8px 16px; border:1px solid #e2e8f0; border-radius:8px; background:white; cursor:pointer;">« Précédent</button>';
html += '<span style="font-weight:600;">Page ' + page + ' / ' + totalPages + '</span>';
html += '<button onclick="changePage(\'' + tableName + '\', ' + (page + 1) + ')" ' + (page >= totalPages ? 'disabled' : '') + ' style="padding:8px 16px; border:1px solid #e2e8f0; border-radius:8px; background:white; cursor:pointer;">Suivant »</button>';
html += '</div>';
return html;
}

function changePage(tableName, newPage) {
var renderFunctions = {
categories: renderCategoriesTable, products: renderProductsTable, clients: renderClientsTable,
fournisseurs: renderFournisseursTable, depenses: renderDepensesTable, commandes: renderCommandesTable,
ventes: renderVentesTable, credits: renderCreditsTable, users: renderUsersTable
};
var dataArrays = {
categories: window.allCategoriesData, products: window.allProductsData, clients: window.allClientsData,
fournisseurs: window.allFournisseursData, depenses: window.allDepensesData,
commandes: window.filteredCommandes || window.allCommandesData,
ventes: window.filteredVentes || window.allVentesData,
credits: window.filteredCredits || window.allCreditsData,
users: window.filteredUsers || window.allUsersData
};
var totalItems = (dataArrays[tableName] || []).length;
var totalPages = Math.ceil(totalItems / window.itemsPerPage);
if (newPage < 1 || newPage > totalPages) return;
window.currentPages[tableName] = newPage;
if (renderFunctions[tableName]) renderFunctions[tableName]();
}

function getPageData(tableName, dataArray) {
var page = window.currentPages[tableName] || 1;
var start = (page - 1) * window.itemsPerPage;
return dataArray.slice(start, start + window.itemsPerPage);
}

// ==================== FILTRES ====================
function getPeriodOptions(selected) {
var periods = [
{ value: 'all', text: 'Toutes les dates' }, { value: 'today', text: 'Aujourd\'hui' },
{ value: '7', text: '7 jours' }, { value: '30', text: '30 jours' },
{ value: '90', text: '3 mois' }, { value: '365', text: '1 an' }
];
return periods.map(p => '<option value="' + p.value + '" ' + (selected == p.value ? 'selected' : '') + '>' + p.text + '</option>').join('');
}

function filterByPeriod(data, period) {
if (!period || period === 'all') return data;
var now = Date.now();
if (period === 'today') {
var today = new Date(); today.setHours(0,0,0,0);
return data.filter(function(d) { return d.createdAt && d.createdAt.seconds * 1000 >= today.getTime(); });
}
var days = parseInt(period);
if (isNaN(days)) return data;
var cutoff = now - days * 86400000;
return data.filter(function(d) { return d.createdAt && d.createdAt.seconds && d.createdAt.seconds * 1000 >= cutoff; });
}

function filterBySearch(data, query, fields) {
if (!query) return data;
var q = query.toLowerCase().trim();
return data.filter(function(d) {
for (var i = 0; i < fields.length; i++) {
var val = fields[i];
if (val.startsWith('items.')) {
var itemField = val.split('.')[1];
if (d.items && Array.isArray(d.items)) {
for (var j = 0; j < d.items.length; j++) {
if (d.items[j][itemField] && String(d.items[j][itemField]).toLowerCase().indexOf(q) !== -1) return true;
}
}
} else {
if (d[val] && String(d[val]).toLowerCase().indexOf(q) !== -1) return true;
}
}
return false;
});
}

// ==================== DASHBOARD ====================
function loadDashboardPage(c) {
c.innerHTML = '<div class="stats-grid">' +
'<div class="stat-card"><div class="stat-icon"><i class="fas fa-coffee"></i></div><div class="stat-info"><span class="stat-label">Produits</span><span class="stat-value" id="productsCount">0</span></div></div>' +
'<div class="stat-card"><div class="stat-icon"><i class="fas fa-users"></i></div><div class="stat-info"><span class="stat-label">Clients</span><span class="stat-value" id="clientsCount">0</span></div></div>' +
'<div class="stat-card"><div class="stat-icon"><i class="fas fa-layer-group"></i></div><div class="stat-info"><span class="stat-label">Catégories</span><span class="stat-value" id="categoriesCount">0</span></div></div>' +
'<div class="stat-card"><div class="stat-icon"><i class="fas fa-shopping-cart"></i></div><div class="stat-info"><span class="stat-label">Ventes</span><span class="stat-value" id="ventesCount">0</span></div></div>' +
'</div>' +
'<div class="content-card">' +
'<div class="card-header"><h3><i class="fas fa-bell"></i> Inscriptions en attente</h3><button class="btn-add" onclick="loadPendingRegistrations()"><i class="fas fa-sync"></i> Actualiser</button></div>' +
'<div id="pendingRegistrations">Chargement...</div>' +
'</div>';
loadDashboardStats();
loadPendingRegistrations();
}

function loadDashboardStats() {
db.collection('products').get().then(function(s) { var e = document.getElementById('productsCount'); if (e) e.textContent = s.size; });
db.collection('clients').get().then(function(s) { var e = document.getElementById('clientsCount'); if (e) e.textContent = s.size; });
db.collection('categories').get().then(function(s) { var e = document.getElementById('categoriesCount'); if (e) e.textContent = s.size; });
db.collection('ventes').get().then(function(s) { var e = document.getElementById('ventesCount'); if (e) e.textContent = s.size; });
}

// ==================== INSCRIPTIONS EN ATTENTE (CORRIGÉ) ====================
function loadPendingRegistrations() {
var d = document.getElementById('pendingRegistrations');
if (!d) return;

d.innerHTML = `
<div class="table-container">
<table class="data-table" id="pendingTable">
<thead>
<tr>
<th style="font-size:22px;">Utilisateur</th>
<th style="font-size:22px;">Email</th>
<th style="font-size:22px;">Rôle</th>
<th style="font-size:22px;">Date</th>
<th style="font-size:22px;">Actions</th>
</tr>
</thead>
<tbody></tbody>
</table>
</div>
`;

// 🔥 Utiliser Firestore directement (pas le cache)
db.collection('users')
.where('authorized', '==', 'no')
.orderBy('createdAt', 'desc')
.get()
.then(function(snapshot) {
window.pendingUsersData = [];
snapshot.forEach(function(dc) {
var u = dc.data();
window.pendingUsersData.push({
id: dc.id,
prenom: (u.prenom || '') + ' ' + (u.nom || ''),
email: u.email || '',
role: u.role || 'client',
createdAt: u.createdAt,
data: u
});
});
renderPendingTable();
})
.catch(function(err) {
console.error('❌ Erreur chargement pending:', err);
window.pendingUsersData = [];
renderPendingTable();
});
}

function renderPendingTable() {
var tb = document.querySelector('#pendingTable tbody');
if (!tb) return;
tb.innerHTML = '';

var data = window.pendingUsersData || [];

if (data.length === 0) {
tb.innerHTML = `
<tr>
<td colspan="5" style="text-align:center;padding:40px;color:#16a34a;font-size:24px;">
✅ Aucune inscription en attente
</td>
</tr>
`;
return;
}

for (var i = 0; i < data.length; i++) {
var x = data[i];
var dt = x.createdAt ? new Date(x.createdAt.seconds * 1000).toLocaleDateString('fr-FR') + ' ' +
new Date(x.createdAt.seconds * 1000).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) : 'N/A';

tb.innerHTML += `
<tr>
<td style="font-size:22px;"><strong>${escapeHtml(x.prenom)}</strong></td>
<td style="font-size:22px;">${escapeHtml(x.email)}</td>
<td style="font-size:22px;"><span class="status-warning">${escapeHtml(x.role)}</span></td>
<td style="font-size:22px;">${dt}</td>
<td style="font-size:22px;">
<button class="btn-add" style="padding:8px 16px;font-size:20px;margin-right:8px;" onclick="approveUser('${x.id}')">
✅ Accepter
</button>
<button class="btn-delete" style="padding:8px 16px;font-size:20px;" onclick="rejectUser('${x.id}')">
❌ Refuser
</button>
</td>
</tr>
`;
}
}

// ==================== APPROVE USER (CORRIGÉ) ====================
async function approveUser(uid) {
if (!confirm('Accepter cet utilisateur ?')) return;

try {
// 1. Vérifier que le document existe
const doc = await db.collection('users').doc(uid).get();
if (!doc.exists) {
alert('❌ Utilisateur introuvable');
return;
}

const userData = doc.data();

// 2. Mettre à jour DIRECTEMENT dans Firestore (pas via CacheDB)
await db.collection('users').doc(uid).update({
authorized: 'yes',
updatedAt: firebase.firestore.FieldValue.serverTimestamp()
});

// 3. Mettre à jour le cache local
const updatedUser = { ...userData, authorized: 'yes', updatedAt: new Date() };
await CacheDB.set('users', uid, { uid: uid, userData: updatedUser });

// 4. Si c'est un client, créer son profil client
if (userData.role === 'client') {
const clientData = {
nom: userData.nom || '',
prenom: userData.prenom || '',
email: userData.email || '',
telephone: userData.telephone || '',
username: userData.username || '',
authorized: 'yes',
pointsFidelite: 0,
ca: 0,
profit: 0,
createdAt: firebase.firestore.FieldValue.serverTimestamp(),
updatedAt: firebase.firestore.FieldValue.serverTimestamp()
};

const clientDoc = await db.collection('clients').doc(uid).get();
if (clientDoc.exists) {
await db.collection('clients').doc(uid).update(clientData);
} else {
await db.collection('clients').doc(uid).set(clientData);
}
await CacheDB.set('clients', uid, { id: uid, ...clientData });
}

// 5. Mettre à jour le cache "current" si c'est l'utilisateur actuel
if (window.currentUserData && window.currentUserData.uid === uid) {
window.currentUserData.userData.authorized = 'yes';
await CacheDB.set('users', 'current', window.currentUserData);
}

// 6. Synchroniser
await CacheDB.sync();

alert('✅ Utilisateur accepté avec succès !');

// 7. Rafraîchir les listes
if (typeof loadPendingRegistrations === 'function') {
loadPendingRegistrations();
}
if (typeof loadUsersList === 'function') {
loadUsersList();
}
if (typeof loadClients === 'function') {
loadClients();
}

} catch (e) {
console.error('❌ Erreur approveUser:', e);
alert('❌ Erreur : ' + e.message);
}
}

// ==================== REJECT USER (CORRIGÉ) ====================
async function rejectUser(uid) {
if (!confirm('Refuser et supprimer cet utilisateur ?')) return;

try {
// 1. Supprimer directement de Firestore
await db.collection('users').doc(uid).delete();

// 2. Supprimer du cache
await CacheDB.delete('users', uid);

// 3. Supprimer aussi le client associé si existe
const clientDoc = await db.collection('clients').doc(uid).get();
if (clientDoc.exists) {
await db.collection('clients').doc(uid).delete();
await CacheDB.delete('clients', uid);
}

// 4. Synchroniser
await CacheDB.sync();

alert('✅ Utilisateur supprimé');

// 5. Rafraîchir
if (typeof loadPendingRegistrations === 'function') {
loadPendingRegistrations();
}
if (typeof loadUsersList === 'function') {
loadUsersList();
}
if (typeof loadClients === 'function') {
loadClients();
}

} catch (e) {
console.error('❌ Erreur rejectUser:', e);
alert('❌ Erreur : ' + e.message);
}
}

// ==================== OPTIONS ====================
function loadOptionsPage(c) {
if (!window.currentUserData || window.currentUserData.userData.role !== 'admin') {
c.innerHTML = '<div class="content-card"><p style="text-align:center;padding:40px;color:#ef4444;">Accès réservé à l\'administrateur</p></div>';
return;
}
c.innerHTML = '<div class="stats-grid">' +
'<div class="stat-card"><div class="stat-icon" style="background:#fef3c7;"><i class="fas fa-clock" style="color:#d97706;"></i></div><div class="stat-info"><span>En attente</span><span class="stat-value" id="pendingCount">0</span></div></div>' +
'<div class="stat-card"><div class="stat-icon" style="background:#dcfce7;"><i class="fas fa-check-circle" style="color:#16a34a;"></i></div><div class="stat-info"><span>Autorisés</span><span class="stat-value" id="authorizedCount">0</span></div></div>' +
'<div class="stat-card"><div class="stat-icon" style="background:#e0e7ff;"><i class="fas fa-users" style="color:#4f46e5;"></i></div><div class="stat-info"><span>Total</span><span class="stat-value" id="totalUsers">0</span></div></div>' +
'</div>' +
'<div class="content-card"><div class="card-header"><h3><i class="fas fa-lock"></i> Sécurité</h3><button class="btn-add" onclick="toggleChangePasswordForm()"><i class="fas fa-key"></i> Changer le mot de passe</button></div><div id="changePasswordForm" class="hidden" style="margin-top:15px;"><div class="form-row"><div class="form-group"><label>Mot de passe actuel</label><input type="password" id="currentPassword"></div></div><div class="form-row"><div class="form-group"><label>Nouveau mot de passe</label><input type="password" id="newPassword"></div><div class="form-group"><label>Confirmer</label><input type="password" id="confirmPassword"></div></div><button class="btn-save" onclick="changeAdminPassword()">Changer le mot de passe</button></div></div>' +
'<div class="content-card"><div class="card-header"><h3><i class="fas fa-bullhorn"></i> Fidélité</h3><button class="btn-add" onclick="toggleMarketingProgram()"><i class="fas fa-cog"></i> Gérer</button></div><div id="marketingProgramContent" class="hidden" style="margin-top:15px;"><div style="display:flex;align-items:flex-end;gap:20px;"><div class="form-group"><label>Activer</label><select id="fideliteActifSelect"><option value="1">✅ Actif</option><option value="0">❌ Inactif</option></select></div><div class="form-group"><label>Points/vente</label><input type="number" id="fidelitePointsInput" value="1" min="1" style="width:80px;"></div><button class="btn-save" onclick="saveFideliteSettings()">Enregistrer</button></div></div></div>' +
'<div class="content-card"><div class="card-header"><h3><i class="fas fa-users"></i> Utilisateurs</h3><div style="display:flex;gap:10px;"><input type="text" id="usersSearchInput" placeholder="🔍 Rechercher..." style="padding:8px 12px;border:2px solid #e2e8f0;border-radius:8px;width:220px;" onkeyup="window.usersSearchQuery=this.value.trim().toLowerCase();renderUsersTable();"><button class="btn-add" onclick="loadUsersList()">Actualiser</button></div></div><div class="table-container"><table class="data-table" id="usersTable"><thead><tr><th>Username</th><th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr></thead><tbody></tbody></table></div></div>';
loadUsersList();
loadFideliteSettings();
}

function loadUsersList() {
db.collection('users').get().then(function(sn) {
window.allUsersData = [];
sn.forEach(function(dc) { var d = dc.data(); d.id = dc.id; d.fullName = (d.prenom + ' ' + d.nom).toLowerCase(); window.allUsersData.push(d); });
var p = window.allUsersData.filter(function(u) { return u.authorized === 'no'; }).length;
var a = window.allUsersData.filter(function(u) { return u.authorized === 'yes'; }).length;
document.getElementById('pendingCount').textContent = p;
document.getElementById('authorizedCount').textContent = a;
document.getElementById('totalUsers').textContent = window.allUsersData.length;
renderUsersTable();
});
}

function renderUsersTable() {
var tb = document.querySelector('#usersTable tbody');
if (!tb) return;
var data = window.allUsersData.slice();
if (window.usersSearchQuery) { data = data.filter(function(u) { return (u.email || '').toLowerCase().indexOf(window.usersSearchQuery) !== -1 || (u.username || '').toLowerCase().indexOf(window.usersSearchQuery) !== -1 || (u.fullName || '').indexOf(window.usersSearchQuery) !== -1; }); }
tb.innerHTML = '';
if (data.length === 0) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">Aucun</td></tr>'; return; }
data.forEach(function(u) {
var badge = u.authorized === 'yes' ? '<span class="status-success">✅ OK</span>' : '<span class="status-warning">⏳ En attente</span>';
var act = u.authorized === 'no' ?
'<button class="btn-add" style="padding:4px 8px;font-size:0.7rem;margin-right:4px;" onclick="approveUser(\'' + u.id + '\')">✔</button><button class="btn-delete" style="padding:4px 8px;font-size:0.7rem;" onclick="rejectUser(\'' + u.id + '\')">✖</button>'
: '<button style="padding:4px 8px;font-size:0.7rem;margin-right:4px;color:#d97706;border:none;background:#fef3c7;border-radius:6px;cursor:pointer;" onclick="blockUser(\'' + u.id + '\')">⛔ Bloquer</button><button class="btn-delete" style="padding:4px 8px;font-size:0.7rem;" onclick="deleteUserPermanently(\'' + u.id + '\')">🗑</button>';
tb.innerHTML += '<tr><td><strong>@' + escapeHtml(u.username || '') + '</strong></td><td>' + escapeHtml(u.prenom || '') + ' ' + escapeHtml(u.nom || '') + '</td><td>' + escapeHtml(u.email || '') + '</td><td>' + escapeHtml(u.role || '') + '</td><td>' + badge + '</td><td>' + act + '</td></tr>';
});
}

function blockUser(uid) { if (confirm('Bloquer ?')) { CacheDB.write('users', uid, { authorized: 'no' }, 'update').then(function() { loadUsersList(); loadPendingRegistrations(); CacheDB.sync(); }); } }
function deleteUserPermanently(uid) { if (confirm('Supprimer ?')) { CacheDB.write('users', uid, null, 'delete').then(function() { loadUsersList(); loadPendingRegistrations(); CacheDB.sync(); }); } }

function toggleChangePasswordForm() { document.getElementById('changePasswordForm').classList.toggle('hidden'); }

async function changeAdminPassword() {
var cp = document.getElementById('currentPassword').value.trim();
var np = document.getElementById('newPassword').value.trim();
var conf = document.getElementById('confirmPassword').value.trim();
if (!cp || !np || !conf) { alert('Tous les champs obligatoires'); return; }
if (np.length < 6) { alert('6 caractères minimum'); return; }
if (np !== conf) { alert('Ne correspondent pas'); return; }
var user = auth.currentUser;
if (!user) { alert('Non connecté'); return; }
try {
await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email, cp));
await user.updatePassword(np);
alert('✅ Mot de passe changé');
document.getElementById('currentPassword').value = '';
document.getElementById('newPassword').value = '';
document.getElementById('confirmPassword').value = '';
toggleChangePasswordForm();
} catch (e) {
if (e.code === 'auth/wrong-password') alert('❌ Mot de passe actuel incorrect');
else alert('Erreur: ' + e.message);
}
}

function toggleMarketingProgram() { var d = document.getElementById('marketingProgramContent'); if (d) { d.classList.toggle('hidden'); if (!d.classList.contains('hidden')) loadFideliteSettings(); } }

async function loadFideliteSettings() {
var a = true, p = 1;
try { var doc = await db.collection('settings').doc('fidelite').get(); if (doc.exists) { a = doc.data().active === true; p = doc.data().pointsParVente || 1; } } catch (e) {}
document.getElementById('fideliteActifSelect').value = a ? '1' : '0';
document.getElementById('fidelitePointsInput').value = p;
}

async function saveFideliteSettings() {
var a = document.getElementById('fideliteActifSelect').value === '1';
var p = parseInt(document.getElementById('fidelitePointsInput').value) || 1;
try { await db.collection('settings').doc('fidelite').set({ active: a, pointsParVente: p }, { merge: true }); } catch (e) {}
localStorage.setItem('fidelite_active', a); localStorage.setItem('fidelite_points', p);
alert('✅ Enregistré');
}

// ==================== NAVIGATION ====================
function navigateTo(page) {
console.log('📍 Navigation vers:', page);

var content = document.getElementById('dynamicContent');
if (!content) return;

var titles = {
'dashboard': 'Dashboard',
'pos': 'POS',
'commandes': 'Commandes en ligne',
'categories': 'Catégories',
'products': 'Produits',
'clients': 'Clients',
'fournisseurs': 'Fournisseurs',
'ventes': 'Ventes',
'credits': 'Crédits',
'depenses': 'Dépenses',
'statistiques': 'Statistiques',
'options': 'Options'
};

var icons = {
'dashboard': 'fa-chart-line',
'pos': 'fa-cash-register',
'commandes': 'fa-shopping-basket',
'categories': 'fa-layer-group',
'products': 'fa-coffee',
'clients': 'fa-users',
'fournisseurs': 'fa-truck',
'ventes': 'fa-shopping-cart',
'credits': 'fa-credit-card',
'depenses': 'fa-money-bill-wave',
'statistiques': 'fa-chart-bar',
'options': 'fa-cog'
};

var titleEl = document.getElementById('pageTitle');
if (titleEl) titleEl.textContent = titles[page] || page;

var iconEl = document.querySelector('.header-title i');
if (iconEl && icons[page]) iconEl.className = 'fas ' + icons[page];

// ✅ Gestion du POS
if (page === 'pos') {
if (typeof window.loadPosPage === 'function') {
window.loadPosPage(content);
} else if (typeof loadPosPage === 'function') {
loadPosPage(content);
} else {
content.innerHTML = `
<div class="content-card">
<p style="text-align:center;padding:40px;">
<i class="fas fa-cash-register" style="font-size:3rem;display:block;color:#A67C52;margin-bottom:15px;"></i>
Chargement du POS...
</p>
</div>
`;
setTimeout(function() {
if (typeof window.loadPosPage === 'function') {
window.loadPosPage(content);
}
}, 500);
}
closeSidebar();
return;
}

// ✅ Autres pages
var pageFunctions = {
'dashboard': window.loadDashboardPage || loadDashboardPage,
'commandes': window.loadCommandesPage || loadCommandesPage,
'categories': window.loadCategoriesPage || loadCategoriesPage,
'products': window.loadProductsPage || loadProductsPage,
'clients': window.loadClientsPage || loadClientsPage,
'fournisseurs': window.loadFournisseursPage || loadFournisseursPage,
'ventes': window.loadVentesPage || loadVentesPage,
'credits': window.loadCreditsPage || loadCreditsPage,
'depenses': window.loadDepensesPage || loadDepensesPage,
'statistiques': window.loadStatistiquesPage || loadStatistiquesPage,
'options': window.loadOptionsPage || loadOptionsPage
};

var fn = pageFunctions[page];
if (fn && typeof fn === 'function') {
try {
fn(content);
} catch(e) {
console.error('Erreur chargement page:', e);
content.innerHTML = '<div class="content-card"><p style="text-align:center;padding:40px;color:#ef4444;">Erreur de chargement: ' + e.message + '</p></div>';
}
} else {
content.innerHTML = '<div class="content-card"><p style="text-align:center;padding:40px;color:#94a3b8;">Page en développement</p></div>';
}

closeSidebar();
}

// ==================== CRÉDITS ====================
function loadCreditsPage(c) {
console.log('📋 Chargement de la page Crédits...');

c.innerHTML = `
<div class="content-card">
<div class="card-header">
<h3><i class="fas fa-credit-card"></i> Crédits</h3>
<div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
<input type="text" id="creditsSearchInput" placeholder="🔍 Rechercher..." style="padding:8px 12px; border:2px solid #e2e8f0; border-radius:8px; width:200px;" onkeyup="window.creditsSearch = this.value; window.currentPages.credits=1; applyCreditsFilters();">
<select id="creditsPeriodSelect" style="padding:8px 12px; border:2px solid #e2e8f0; border-radius:8px;" onchange="window.creditsPeriod = this.value; window.currentPages.credits=1; applyCreditsFilters();">
${getPeriodOptions('all')}
</select>
<button class="btn-add" onclick="loadCreditsData()"><i class="fas fa-sync"></i> Actualiser</button>
</div>
</div>
<div id="creditsTableContainer">
<p style="text-align:center;padding:40px;">Chargement des crédits...</p>
</div>
<div id="creditsPagination"></div>
</div>
`;

loadCreditsData();
}

async function loadCreditsData() {
console.log('📋 Chargement des crédits depuis Firestore...');
try {
var snapshot = await db.collection('credits').orderBy('createdAt', 'desc').limit(100).get();

var container = document.getElementById('creditsTableContainer');
if (!container) return;

if (snapshot.empty) {
container.innerHTML = '<p style="text-align:center;padding:40px;color:#94a3b8;">Aucun crédit trouvé. Créez un crédit depuis le POS.</p>';
return;
}

var html = '<div class="table-container"><table class="data-table"><thead><tr>';
html += '<th>Client</th><th>Total</th><th>Payé</th><th>Restant</th><th>Mode</th><th>Date</th><th>Actions</th>';
html += '</thead><tbody>';

var totalImpayes = 0;
var count = 0;
snapshot.forEach(function(doc) {
var d = doc.data();
var reste = d.remainingAmount || d.total || 0;
var paye = d.amountGiven || 0;
if (reste > 0) totalImpayes += reste;
count++;

html += '<tr>';
html += '<td><strong>' + escapeHtml(d.clientName || '-') + '</strong></td>';
html += '<td>' + (d.total || 0).toFixed(2) + ' MAD</td>';
html += '<td>' + paye.toFixed(2) + ' MAD</td>';
html += '<td style="color:' + (reste > 0 ? '#ef4444' : '#16a34a') + ';font-weight:700;">' + reste.toFixed(2) + ' MAD</td>';
html += '<td>' + escapeHtml(d.paymentMethod || '-') + '</td>';
html += '<td>' + (d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleDateString('fr-FR') : '-') + '</td>';
html += '<td>';
if (reste > 0) {
html += '<button class="btn-add" style="padding:4px 8px;font-size:0.65rem;" onclick="payerCreditVersPOS(\'' + d.id + '\')">💳 Payer</button> ';
}
html += '<button class="btn-edit" onclick="alert(\'Voir détail\')"><i class="fas fa-eye"></i></button>';
html += '</td>';
html += '</tr>';
});

html += '</tbody></table></div>';
html += '<div style="margin-top:15px;padding:15px;background:#fef2f2;border-radius:12px;text-align:center;">';
html += '<strong>Total crédits: ' + count + ' | Impayés: ' + totalImpayes.toFixed(2) + ' MAD</strong>';
html += '</div>';

container.innerHTML = html;

var pagination = document.getElementById('creditsPagination');
if (pagination) {
pagination.innerHTML = getPaginationHTML('credits', count);
}

} catch(e) {
console.error('Erreur chargement crédits:', e);
var container = document.getElementById('creditsTableContainer');
if (container) {
container.innerHTML = '<p style="color:#ef4444;">❌ Erreur: ' + e.message + '</p>';
}
}
}

function applyCreditsFilters() {
loadCreditsData();
}

// ==================== EXPORTS ====================
window.openModal = openModal;
window.closeModal = closeModal;
window.fileToBase64 = fileToBase64;
window.previewImage = previewImage;
window.saveDocument = saveDocument;
window.deleteDocument = deleteDocument;
window.refreshCurrentPage = refreshCurrentPage;
window.editDocument = editDocument;
window.sortTableData = sortTableData;
window.applySort = applySort;
window.makeSortableHeader = makeSortableHeader;
window.getPaginationHTML = getPaginationHTML;
window.changePage = changePage;
window.getPageData = getPageData;
window.getPeriodOptions = getPeriodOptions;
window.filterByPeriod = filterByPeriod;
window.filterBySearch = filterBySearch;
window.loadDashboardPage = loadDashboardPage;
window.loadDashboardStats = loadDashboardStats;
window.loadPendingRegistrations = loadPendingRegistrations;
window.renderPendingTable = renderPendingTable;
window.approveUser = approveUser;
window.rejectUser = rejectUser;
window.loadOptionsPage = loadOptionsPage;
window.loadUsersList = loadUsersList;
window.renderUsersTable = renderUsersTable;
window.blockUser = blockUser;
window.deleteUserPermanently = deleteUserPermanently;
window.toggleChangePasswordForm = toggleChangePasswordForm;
window.changeAdminPassword = changeAdminPassword;
window.toggleMarketingProgram = toggleMarketingProgram;
window.loadFideliteSettings = loadFideliteSettings;
window.saveFideliteSettings = saveFideliteSettings;
window.navigateTo = navigateTo;
window.loadCreditsPage = loadCreditsPage;
window.loadCreditsData = loadCreditsData;
window.applyCreditsFilters = applyCreditsFilters;

console.log('☕ Mixmax Minimarket - Admin JS complet (corrigé window.)');
