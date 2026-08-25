// ==================== ADMIN - GESTION DES VENTES ====================

var allVentes = [];
var filteredVentes = [];
var currentPage = 1;
var itemsPerPage = 20;
var ventesSearchQuery = '';

// ==================== VARIABLES POUR LE MODAL FACTURE ====================
var currentFactureId = null;

// ==================== CHARGEMENT DES VENTES ====================

async function loadVentesPage(container) {
    container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:var(--accent);"></i><p style="margin-top:10px;color:var(--text-secondary);">Chargement des ventes...</p></div>';
    
    try {
        // Récupérer toutes les ventes
        var snapshot = await db.collection('ventes')
            .orderBy('createdAt', 'desc')
            .get();
        
        allVentes = [];
        snapshot.forEach(function(doc) {
            var data = doc.data();
            data.id = doc.id;
            allVentes.push(data);
        });
        
        filteredVentes = [...allVentes];
        renderVentesTable(container);
        
    } catch(e) {
        console.error('Erreur chargement ventes:', e);
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);"><i class="fas fa-exclamation-triangle" style="font-size:2rem;"></i><p>Erreur lors du chargement des ventes</p></div>';
    }
}

// ==================== RECHERCHE DES VENTES ====================

function searchVentes(query) {
    ventesSearchQuery = query.toLowerCase().trim();
    currentPage = 1;
    
    if (!ventesSearchQuery) {
        filteredVentes = [...allVentes];
    } else {
        filteredVentes = allVentes.filter(function(v) {
            var factureNum = (v.factureNum || '').toLowerCase();
            var clientName = (v.clientName || '').toLowerCase();
            var vendeur = (v.vendeur || '').toLowerCase();
            var table = (v.table || '').toLowerCase();
            
            return factureNum.includes(ventesSearchQuery) ||
                   clientName.includes(ventesSearchQuery) ||
                   vendeur.includes(ventesSearchQuery) ||
                   table.includes(ventesSearchQuery);
        });
    }
    
    var container = document.getElementById('dynamicContent');
    if (container) renderVentesTable(container);
}

// ==================== RENDU TABLEAU DES VENTES ====================

function renderVentesTable(container) {
    var totalItems = filteredVentes.length;
    var totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (currentPage > totalPages) currentPage = totalPages || 1;
    
    var start = (currentPage - 1) * itemsPerPage;
    var end = start + itemsPerPage;
    var pageItems = filteredVentes.slice(start, end);
    
    var html = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:200px;background:var(--bg-card);border:2px solid var(--border);border-radius:30px;padding:4px 14px;transition:var(--transition);">
                <i class="fas fa-search" style="color:var(--text-muted);font-size:0.9rem;"></i>
                <input type="text" id="ventesSearchInput" placeholder="🔍 Rechercher par facture, client, vendeur, table..." value="${escapeHtml(ventesSearchQuery)}" onkeyup="searchVentes(this.value)" style="border:none;outline:none;padding:10px 0;width:100%;background:transparent;font-size:0.9rem;color:var(--text-primary);">
                <button onclick="document.getElementById('ventesSearchInput').value='';searchVentes('');" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1rem;display:${ventesSearchQuery ? 'block' : 'none'};">
                    <i class="fas fa-times-circle"></i>
                </button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-size:0.8rem;color:var(--text-secondary);">${totalItems} vente${totalItems > 1 ? 's' : ''}</span>
                <button onclick="exportVentesCSV()" class="btn-add" style="padding:8px 16px;font-size:0.8rem;background:var(--success);">
                    <i class="fas fa-file-csv"></i> Exporter CSV
                </button>
                <button onclick="refreshVentes()" class="btn-add" style="padding:8px 16px;font-size:0.8rem;">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>
        </div>
        
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="cursor:pointer;" onclick="sortVentes('factureNum')">Facture ${getSortIcon('factureNum')}</th>
                        <th style="cursor:pointer;" onclick="sortVentes('clientName')">Client ${getSortIcon('clientName')}</th>
                        <th style="cursor:pointer;" onclick="sortVentes('table')">Table ${getSortIcon('table')}</th>
                        <th style="cursor:pointer;" onclick="sortVentes('total')">Total ${getSortIcon('total')}</th>
                        <th style="cursor:pointer;" onclick="sortVentes('statutPaiement')">Statut ${getSortIcon('statutPaiement')}</th>
                        <th style="cursor:pointer;" onclick="sortVentes('vendeur')">Vendeur ${getSortIcon('vendeur')}</th>
                        <th style="cursor:pointer;" onclick="sortVentes('createdAt')">Date ${getSortIcon('createdAt')}</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    if (pageItems.length === 0) {
        html += `
            <tr>
                <td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">
                    <i class="fas fa-inbox" style="font-size:2rem;display:block;margin-bottom:10px;"></i>
                    Aucune vente trouvée
                </td>
            </tr>
        `;
    } else {
        pageItems.forEach(function(v) {
            var date = v.createdAt ? new Date(v.createdAt.seconds * 1000) : new Date();
            var dateStr = date.toLocaleDateString('fr-FR');
            var timeStr = date.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            
            var statusClass = 'status-success';
            var statusText = v.statutPaiement || 'payé';
            if (statusText === 'crédit') statusClass = 'status-warning';
            else if (statusText === 'partiel') statusClass = 'status-warning';
            else if (statusText === 'en_attente') statusClass = 'status-danger';
            
            html += `
                <tr>
                    <td onclick="openFactureDetails('${v.id}', '${escapeHtml(v.factureNum || 'N/A')}')" style="cursor:pointer;color:var(--accent);font-weight:600;">
                        <i class="fas fa-file-invoice"></i> ${escapeHtml(v.factureNum || 'N/A')}
                    </td>
                    <td>${escapeHtml(v.clientName || 'Passager')}</td>
                    <td>${escapeHtml(v.table || '—')}</td>
                    <td><strong>${(v.total || 0).toFixed(2)} MAD</strong></td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td>${escapeHtml(v.vendeur || 'N/A')}</td>
                    <td><small>${dateStr}<br>${timeStr}</small></td>
                    <td>
                        <button onclick="openFactureDetails('${v.id}', '${escapeHtml(v.factureNum || 'N/A')}')" class="btn-edit" title="Voir détails">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="printFacture('${v.id}')" class="btn-edit" title="Imprimer">
                            <i class="fas fa-print"></i>
                        </button>
                        <button onclick="deleteVente('${v.id}')" class="btn-delete" title="Supprimer">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    // Pagination
    if (totalPages > 1) {
        html += `
            <div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:16px;flex-wrap:wrap;">
                <button onclick="changeVentesPage(1)" class="btn-add" style="padding:6px 12px;font-size:0.75rem;" ${currentPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-angle-double-left"></i>
                </button>
                <button onclick="changeVentesPage(${currentPage - 1})" class="btn-add" style="padding:6px 12px;font-size:0.75rem;" ${currentPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-angle-left"></i>
                </button>
                <span style="font-size:0.85rem;color:var(--text-secondary);">Page ${currentPage} / ${totalPages}</span>
                <button onclick="changeVentesPage(${currentPage + 1})" class="btn-add" style="padding:6px 12px;font-size:0.75rem;" ${currentPage === totalPages ? 'disabled' : ''}>
                    <i class="fas fa-angle-right"></i>
                </button>
                <button onclick="changeVentesPage(${totalPages})" class="btn-add" style="padding:6px 12px;font-size:0.75rem;" ${currentPage === totalPages ? 'disabled' : ''}>
                    <i class="fas fa-angle-double-right"></i>
                </button>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ==================== TRI DES VENTES ====================

var ventesSortField = 'createdAt';
var ventesSortOrder = 'desc';

function sortVentes(field) {
    if (ventesSortField === field) {
        ventesSortOrder = ventesSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        ventesSortField = field;
        ventesSortOrder = 'asc';
    }
    
    filteredVentes.sort(function(a, b) {
        var va, vb;
        switch(field) {
            case 'factureNum': va = a.factureNum || ''; vb = b.factureNum || ''; break;
            case 'clientName': va = a.clientName || ''; vb = b.clientName || ''; break;
            case 'table': va = a.table || ''; vb = b.table || ''; break;
            case 'total': va = a.total || 0; vb = b.total || 0; break;
            case 'statutPaiement': va = a.statutPaiement || ''; vb = b.statutPaiement || ''; break;
            case 'vendeur': va = a.vendeur || ''; vb = b.vendeur || ''; break;
            case 'createdAt': va = a.createdAt?.seconds || 0; vb = b.createdAt?.seconds || 0; break;
            default: va = 0; vb = 0;
        }
        
        if (va < vb) return ventesSortOrder === 'asc' ? -1 : 1;
        if (va > vb) return ventesSortOrder === 'asc' ? 1 : -1;
        return 0;
    });
    
    var container = document.getElementById('dynamicContent');
    if (container) renderVentesTable(container);
}

function getSortIcon(field) {
    if (ventesSortField !== field) return '↕';
    return ventesSortOrder === 'asc' ? '▲' : '▼';
}

// ==================== PAGINATION ====================

function changeVentesPage(page) {
    var totalPages = Math.ceil(filteredVentes.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    var container = document.getElementById('dynamicContent');
    if (container) renderVentesTable(container);
}

// ==================== RAFRAÎCHIR ====================

async function refreshVentes() {
    var container = document.getElementById('dynamicContent');
    if (container) {
        await loadVentesPage(container);
    }
}

// ==================== EXPORTER CSV ====================

function exportVentesCSV() {
    if (filteredVentes.length === 0) {
        alert('Aucune vente à exporter');
        return;
    }
    
    var headers = ['Facture', 'Client', 'Table', 'Total', 'Statut', 'Vendeur', 'Date', 'Heure'];
    var rows = [headers];
    
    filteredVentes.forEach(function(v) {
        var date = v.createdAt ? new Date(v.createdAt.seconds * 1000) : new Date();
        rows.push([
            v.factureNum || 'N/A',
            v.clientName || 'Passager',
            v.table || '—',
            (v.total || 0).toFixed(2),
            v.statutPaiement || 'payé',
            v.vendeur || 'N/A',
            date.toLocaleDateString('fr-FR'),
            date.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})
        ]);
    });
    
    var csvContent = rows.map(function(row) {
        return row.join(';');
    }).join('\n');
    
    var blob = new Blob(['\uFEFF' + csvContent], {type: 'text/csv;charset=utf-8;'});
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ventes_' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

// ==================== SUPPRIMER UNE VENTE ====================

async function deleteVente(id) {
    if (!confirm('⚠️ Êtes-vous sûr de vouloir supprimer cette vente ?')) return;
    
    try {
        await db.collection('ventes').doc(id).delete();
        alert('✅ Vente supprimée');
        refreshVentes();
    } catch(e) {
        alert('❌ Erreur: ' + e.message);
    }
}

// ==================== IMPRIMER UNE FACTURE ====================

async function printFacture(id) {
    try {
        var doc = await db.collection('ventes').doc(id).get();
        if (!doc.exists) {
            alert('Facture non trouvée');
            return;
        }
        var data = doc.data();
        printFactureContent(data);
    } catch(e) {
        alert('Erreur: ' + e.message);
    }
}

function printFactureContent(data) {
    var date = data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date();
    var dateStr = date.toLocaleDateString('fr-FR');
    var timeStr = date.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
    
    var printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
        alert('Veuillez autoriser les pop-ups pour imprimer.');
        return;
    }
    
    var itemsHtml = '';
    var items = data.items || [];
    if (items.length === 0) {
        itemsHtml = '<tr><td colspan="4" style="padding:12px;text-align:center;">Aucun article</td></tr>';
    } else {
        items.forEach(function(item) {
            var prix = item.prixVente || item.prixUnitaire || 0;
            var total = prix * (item.quantite || 1);
            itemsHtml += `
                <tr>
                    <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.nom || 'Produit')}</td>
                    <td style="padding:6px 10px;text-align:center;border-bottom:1px solid #e5e7eb;">${item.quantite || 1}</td>
                    <td style="padding:6px 10px;text-align:right;border-bottom:1px solid #e5e7eb;">${prix.toFixed(2)} MAD</td>
                    <td style="padding:6px 10px;text-align:right;border-bottom:1px solid #e5e7eb;font-weight:600;">${total.toFixed(2)} MAD</td>
                </tr>
            `;
        });
    }
    
    printWindow.document.write(`
        <html>
            <head>
                <title>Facture ${data.factureNum || 'N/A'}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 30px; color: #111827; max-width: 700px; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
                    .header h1 { margin: 0; font-size: 24px; color: #111827; }
                    .header p { margin: 4px 0 0 0; color: #6b7280; font-size: 14px; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
                    .info-box { background: #f9fafb; padding: 10px 14px; border-radius: 8px; border: 1px solid #e5e7eb; }
                    .info-box .label { font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin: 0 0 2px 0; }
                    .info-box .value { font-size: 14px; font-weight: 600; color: #111827; margin: 0; }
                    .info-box .sub { font-size: 12px; color: #6b7280; margin: 2px 0 0 0; }
                    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
                    th { background: #f3f4f6; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 13px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
                    td { padding: 6px 10px; font-size: 14px; }
                    .totals { display: flex; justify-content: flex-end; margin-top: 16px; padding-top: 12px; border-top: 2px solid #e5e7eb; }
                    .totals-box { width: 250px; }
                    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
                    .totals-row.total { font-size: 18px; font-weight: 700; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 4px; }
                    .totals-row.danger { color: #ef4444; }
                    .totals-row.success { color: #10b981; }
                    .status { display: inline-block; padding: 2px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
                    .status-success { background: #ECFDF5; color: #065F46; }
                    .status-warning { background: #FEF3C7; color: #92400E; }
                    .status-danger { background: #FEE2E2; color: #991B1B; }
                    .footer { text-align: center; margin-top: 30px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
                    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: #f3f4f6; color: #6b7280; }
    `;
    
    // Ajout mode sombre si détecté
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
        printWindow.document.write(`
            body { background: #0D1117; color: #F0F6FC; }
            .info-box { background: #161B22; border-color: #30363D; }
            .info-box .value { color: #F0F6FC; }
            .info-box .label { color: #8B949E; }
            th { background: #161B22; color: #8B949E; border-bottom-color: #30363D; }
            td { border-bottom-color: #30363D; }
            .header { border-bottom-color: #30363D; }
            .header p { color: #8B949E; }
            .totals { border-top-color: #30363D; }
            .totals-row.total { border-top-color: #30363D; }
            .footer { border-top-color: #30363D; color: #8B949E; }
            .badge { background: #161B22; color: #8B949E; }
        `);
    }
    
    printWindow.document.write(`
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🧾 FACTURE</h1>
                    <p>N° ${data.factureNum || 'N/A'} - ${dateStr} à ${timeStr}</p>
                    <span class="status status-${data.statutPaiement === 'payé' ? 'success' : data.statutPaiement === 'crédit' ? 'warning' : 'danger'}">${data.statutPaiement || 'payé'}</span>
                </div>
                
                <div class="info-grid">
                    <div class="info-box">
                        <p class="label">Client</p>
                        <p class="value">${escapeHtml(data.clientName || 'Passager')}</p>
                        <p class="sub">${data.clientId ? 'ID: ' + data.clientId : 'Client non identifié'}</p>
                    </div>
                    <div class="info-box">
                        <p class="label">Table / Vendeur</p>
                        <p class="value">${escapeHtml(data.table || '—')}</p>
                        <p class="sub">👤 ${escapeHtml(data.vendeur || 'N/A')}</p>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Produit</th>
                            <th style="text-align:center;">Qté</th>
                            <th style="text-align:right;">Prix unit.</th>
                            <th style="text-align:right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                
                <div class="totals">
                    <div class="totals-box">
                        <div class="totals-row">
                            <span>Sous-total</span>
                            <span>${(data.subtotal || 0).toFixed(2)} MAD</span>
                        </div>
                        ${data.discountMAD > 0 ? `
                        <div class="totals-row danger">
                            <span>Remise</span>
                            <span>-${data.discountMAD.toFixed(2)} MAD</span>
                        </div>
                        ` : ''}
                        <div class="totals-row total">
                            <span>Total</span>
                            <span>${(data.total || 0).toFixed(2)} MAD</span>
                        </div>
                        ${data.amountGiven > 0 ? `
                        <div class="totals-row">
                            <span>Montant donné</span>
                            <span>${(data.amountGiven || 0).toFixed(2)} MAD</span>
                        </div>
                        <div class="totals-row ${data.change >= 0 ? 'success' : 'danger'}">
                            <span>${data.change >= 0 ? 'Rendu' : 'Manquant'}</span>
                            <span>${Math.abs(data.change || 0).toFixed(2)} MAD</span>
                        </div>
                        ` : ''}
                        ${data.remainingAmount > 0 ? `
                        <div class="totals-row danger">
                            <span>Reste à payer</span>
                            <span>${(data.remainingAmount || 0).toFixed(2)} MAD</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="footer">
                    <p>Merci pour votre confiance 🙏</p>
                    <p style="font-size:10px;color:#94a3b8;">E-SOLUTION - Système de gestion</p>
                </div>
            </body>
        </html>
    `);
    
    printWindow.document.close();
    setTimeout(function() {
        printWindow.print();
    }, 500);
}

// ==================== FONCTIONS POUR LE MODAL FACTURE ====================

// Fonction pour créer le modal des détails de facture
function createFactureModal() {
    // Vérifier si le modal existe déjà
    if (document.getElementById('factureDetailsModal')) {
        return;
    }
    
    var modalHTML = `
        <div id="factureDetailsModal" class="modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:9999;align-items:center;justify-content:center;padding:20px;">
            <div style="background:var(--bg-card);border-radius:var(--radius-xl);width:100%;max-width:800px;max-height:90vh;display:flex;flex-direction:column;box-shadow:var(--shadow-xl);border:1px solid var(--border);">
                <!-- HEADER -->
                <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:2px solid var(--border);flex-shrink:0;">
                    <h3 id="factureDetailsTitle" style="font-size:1.2rem;font-weight:700;color:var(--text-primary);margin:0;display:flex;align-items:center;gap:10px;">
                        <i class="fas fa-file-invoice" style="color:var(--accent);"></i>
                        📄 Facture
                    </h3>
                    <button onclick="closeFactureDetails()" style="background:none;border:none;font-size:1.8rem;cursor:pointer;color:var(--text-muted);padding:4px 12px;border-radius:8px;transition:var(--transition);display:flex;align-items:center;justify-content:center;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <!-- BODY -->
                <div id="factureDetailsBody" style="flex:1;overflow-y:auto;padding:24px;padding-top:16px;">
                    <div style="text-align:center;padding:40px;">
                        <i class="fas fa-spinner fa-spin" style="font-size:2rem;color:var(--accent);"></i>
                        <p style="color:var(--text-secondary);margin-top:12px;">Chargement...</p>
                    </div>
                </div>
                <!-- FOOTER -->
                <div style="padding:14px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;flex-shrink:0;">
                    <button onclick="closeFactureDetails()" class="btn-cancel" style="padding:10px 24px;border-radius:var(--radius);border:none;background:var(--gray-100);color:var(--text-secondary);font-weight:600;cursor:pointer;transition:var(--transition);font-size:0.9rem;">
                        Fermer
                    </button>
                    <button onclick="printFactureDetails()" class="btn-add" style="padding:10px 24px;border-radius:var(--radius);border:none;background:var(--black);color:var(--white);font-weight:600;cursor:pointer;transition:var(--transition);font-size:0.9rem;display:flex;align-items:center;gap:8px;">
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
}

// Fonction pour ouvrir le modal des détails de facture
function openFactureDetails(factureId, factureNum) {
    currentFactureId = factureId;
    
    // Créer le modal s'il n'existe pas
    createFactureModal();
    
    // Afficher le modal
    var modal = document.getElementById('factureDetailsModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('factureDetailsTitle').textContent = '📄 Facture N° ' + (factureNum || 'N/A');
        loadFactureData(factureId);
    }
}

// Fonction pour charger les données de la facture
async function loadFactureData(factureId) {
    var body = document.getElementById('factureDetailsBody');
    if (!body) return;
    
    try {
        var doc = await db.collection('ventes').doc(factureId).get();
        
        if (!doc.exists) {
            body.innerHTML = `
                <div style="text-align:center;padding:40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:2.5rem;color:var(--danger);"></i>
                    <p style="color:var(--text-secondary);margin-top:12px;">Facture non trouvée</p>
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
                <i class="fas fa-exclamation-triangle" style="font-size:2.5rem;color:var(--danger);"></i>
                <p style="color:var(--text-secondary);margin-top:12px;">Erreur lors du chargement: ${e.message}</p>
            </div>
        `;
    }
}

// Fonction pour afficher les détails de la facture
function renderFactureDetails(data) {
    var body = document.getElementById('factureDetailsBody');
    if (!body) return;
    
    var date = data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date();
    var dateStr = date.toLocaleDateString('fr-FR');
    var timeStr = date.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
    
    var statusClass = data.statutPaiement === 'payé' ? 'success' : data.statutPaiement === 'crédit' ? 'warning' : 'danger';
    var statusBg = data.statutPaiement === 'payé' ? '#ECFDF5' : data.statutPaiement === 'crédit' ? '#FEF3C7' : '#FEE2E2';
    var statusColor = data.statutPaiement === 'payé' ? '#065F46' : data.statutPaiement === 'crédit' ? '#92400E' : '#991B1B';
    
    var html = `
        <!-- EN-TÊTE FACTURE -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid var(--border);">
            <div>
                <h4 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin:0;">Facture N° ${data.factureNum || 'N/A'}</h4>
                <p style="color:var(--text-secondary);font-size:0.85rem;margin:4px 0 0 0;">
                    <i class="far fa-calendar-alt"></i> ${dateStr} à ${timeStr}
                </p>
            </div>
            <div style="text-align:right;">
                <span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:0.75rem;font-weight:600;text-transform:uppercase;background:${statusBg};color:${statusColor};">
                    ${data.statutPaiement || 'N/A'}
                </span>
            </div>
        </div>
        
        <!-- INFOS CLIENT / TABLE -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
            <div style="background:var(--bg-page);border-radius:var(--radius);padding:12px 16px;border:1px solid var(--border);">
                <p style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px 0;">Client</p>
                <p style="font-size:0.95rem;font-weight:600;color:var(--text-primary);margin:0;">${escapeHtml(data.clientName || 'Passager')}</p>
                <p style="font-size:0.8rem;color:var(--text-secondary);margin:2px 0 0 0;">${data.clientId ? 'ID: ' + data.clientId : 'Client non identifié'}</p>
            </div>
            <div style="background:var(--bg-page);border-radius:var(--radius);padding:12px 16px;border:1px solid var(--border);">
                <p style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px 0;">Table / Vendeur</p>
                <p style="font-size:0.95rem;font-weight:600;color:var(--text-primary);margin:0;">${escapeHtml(data.table || '—')}</p>
                <p style="font-size:0.8rem;color:var(--text-secondary);margin:2px 0 0 0;">👤 ${escapeHtml(data.vendeur || 'N/A')}</p>
            </div>
        </div>
        
        <!-- LISTE DES PRODUITS -->
        <div style="margin-bottom:16px;">
            <p style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px 0;">Articles</p>
            <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
                    <thead>
                        <tr style="background:var(--bg-page);">
                            <th style="padding:8px 12px;text-align:left;font-weight:600;color:var(--text-secondary);border-bottom:1px solid var(--border);">Produit</th>
                            <th style="padding:8px 12px;text-align:center;font-weight:600;color:var(--text-secondary);border-bottom:1px solid var(--border);">Qté</th>
                            <th style="padding:8px 12px;text-align:right;font-weight:600;color:var(--text-secondary);border-bottom:1px solid var(--border);">Prix unit.</th>
                            <th style="padding:8px 12px;text-align:right;font-weight:600;color:var(--text-secondary);border-bottom:1px solid var(--border);">Total</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    var items = data.items || [];
    if (items.length === 0) {
        html += `
            <tr>
                <td colspan="4" style="padding:16px;text-align:center;color:var(--text-muted);">Aucun article</td>
            </tr>
        `;
    } else {
        items.forEach(function(item) {
            var prix = item.prixVente || item.prixUnitaire || 0;
            var total = prix * (item.quantite || 1);
            html += `
                <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:8px 12px;color:var(--text-primary);">${escapeHtml(item.nom || 'Produit')}</td>
                    <td style="padding:8px 12px;text-align:center;color:var(--text-primary);">${item.quantite || 1}</td>
                    <td style="padding:8px 12px;text-align:right;color:var(--text-secondary);">${prix.toFixed(2)} MAD</td>
                    <td style="padding:8px 12px;text-align:right;font-weight:600;color:var(--text-primary);">${total.toFixed(2)} MAD</td>
                </tr>
            `;
        });
    }
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
        
        <!-- TOTAUX -->
        <div style="display:flex;justify-content:flex-end;padding-top:12px;border-top:2px solid var(--border);">
            <div style="width:250px;">
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.9rem;color:var(--text-secondary);">
                    <span>Sous-total</span>
                    <span>${(data.subtotal || 0).toFixed(2)} MAD</span>
                </div>
                ${data.discountMAD > 0 ? `
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.9rem;color:var(--danger);">
                    <span>Remise</span>
                    <span>-${data.discountMAD.toFixed(2)} MAD</span>
                </div>
                ` : ''}
                <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:1.2rem;font-weight:700;color:var(--text-primary);border-top:1px solid var(--border);margin-top:4px;">
                    <span>Total</span>
                    <span>${(data.total || 0).toFixed(2)} MAD</span>
                </div>
                ${data.amountGiven > 0 ? `
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.9rem;color:var(--text-secondary);">
                    <span>Montant donné</span>
                    <span>${(data.amountGiven || 0).toFixed(2)} MAD</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.9rem;font-weight:600;color:${data.change >= 0 ? 'var(--success)' : 'var(--danger)'};">
                    <span>${data.change >= 0 ? 'Rendu' : 'Manquant'}</span>
                    <span>${Math.abs(data.change || 0).toFixed(2)} MAD</span>
                </div>
                ` : ''}
                ${data.remainingAmount > 0 ? `
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.9rem;font-weight:600;color:var(--danger);">
                    <span>Reste à payer</span>
                    <span>${(data.remainingAmount || 0).toFixed(2)} MAD</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    body.innerHTML = html;
}

// Fonction pour fermer le modal des détails
function closeFactureDetails() {
    var modal = document.getElementById('factureDetailsModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentFactureId = null;
}

// Fonction pour imprimer les détails depuis le modal
function printFactureDetails() {
    var body = document.getElementById('factureDetailsBody');
    if (!body) return;
    
    // Récupérer l'ID de la facture actuelle
    if (currentFactureId) {
        printFacture(currentFactureId);
    } else {
        alert('Aucune facture sélectionnée');
    }
}

// ==================== ESCAPE HTML ====================

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return m;
    });
}

// ==================== EXPOSITION DES FONCTIONS GLOBALES ====================

window.loadVentesPage = loadVentesPage;
window.searchVentes = searchVentes;
window.sortVentes = sortVentes;
window.changeVentesPage = changeVentesPage;
window.refreshVentes = refreshVentes;
window.exportVentesCSV = exportVentesCSV;
window.deleteVente = deleteVente;
window.printFacture = printFacture;
window.openFactureDetails = openFactureDetails;
window.closeFactureDetails = closeFactureDetails;
window.printFactureDetails = printFactureDetails;
window.escapeHtml = escapeHtml;

console.log('📊 Admin Ventes - Chargé');
