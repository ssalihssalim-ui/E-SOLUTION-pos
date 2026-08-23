// ==================== POS-AUDIO.JS v10 – E-SOLUTION ====================
// Reconnaissance vocale avec retour visuel intégré

var voiceRecognition = null;
var isRecording = false;
var voiceMode = 'search';
var lastAddedProductId = null;
var voiceModeMessage = '🎤 Recherche vocale active';
var micPermissionGranted = false;

// ========== INDEX CLIENT ==========
var clientSearchIndex = {};
var clientIndexBuilt = false;

// ========== INDEX PRODUIT ==========
var productNameIndex = {};
var productIndexBuilt = false;

// ========== PAYMENT STATE MACHINE ==========
window.voicePaymentState = 0;

var paymentKeywords = {
    'espece': ['espèces', 'espece', 'argent', 'cash', 'comptant', 'liquide', 'espèce'],
    'credit': ['crédit', 'credit', 'à crédit', 'acredit', 'dette', 'avance', 'crédit'],
    'partiel': ['partiel', 'partielle', 'acompte', 'moitié', 'partial', 'part', 'partiel']
};

var numberMap = {
    'wahed': 1, 'ouais': 1, 'wad': 1, 'un': 1, 'une': 1,
    'juge': 2, 'joue': 2, 'george': 2, 'souche': 2, 'deux': 2,
    'claud': 3, 'cl': 3, 'trois': 3, 'clé': 3, 'clea': 3, 'play': 3,
    'rabah': 4, 'quatre': 4, 'arba': 4, 'abba': 4, 'rabat': 4, 'rabats': 4, 'alba': 4,
    'cinq': 5, 'hamza': 5, 'rama': 5, 'comme ça': 5,
    'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
    'onze': 11, 'douze': 12, 'douz': 12, 'treize': 13, 'quatorze': 14,
    'quinze': 15, 'seize': 16, 'vingt': 20, 'trente': 30, 'quarante': 40,
    'cinquante': 50, 'soixante': 60, 'cent': 100
};

function ensureVoiceDisplay() {
    if (!document.getElementById('voiceDisplay')) {
        var div = document.createElement('div');
        div.id = 'voiceDisplay';
        div.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#fff; padding:10px 24px; border-radius:40px; z-index:9999; font-weight:600; display:none; white-space:nowrap;';
        document.body.appendChild(div);
    }
}

function showVoiceResult(msg) {
    ensureVoiceDisplay();
    var el = document.getElementById('voiceDisplay');
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(window._voiceTimeout);
    window._voiceTimeout = setTimeout(function() {
        el.style.display = 'none';
    }, 2000);
}

function showVoiceModeIndicator() {
    var mb = document.getElementById('posMicBtn');
    if (mb && isRecording) {
        mb.style.background = '#fee2e2';
        mb.style.borderColor = '#ef4444';
    }
}

function hideVoiceFlowIndicator() {}

function showVoiceFlowIndicator(phase) {
    var labels = {
        'product': 'Dites le nom du produit',
        'quantity': 'Dites la quantité',
        'payment_mode': 'Mode de paiement ?',
        'payment_amount': 'Montant donné ?'
    };
    if (labels[phase]) showVoiceResult(labels[phase]);
}

function showProcessingIndicator() {}

function escapeHtml(str) { return str ? str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]) : ''; }
function isIOSStandalone() { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream && (window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches); }
function checkVoiceSupport() { var i = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; if (i && isIOSStandalone()) return { supported: false, reason: 'Ouvrez dans Safari' }; if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return { supported: false, reason: 'Non supporté' }; return { supported: true }; }
async function requestMicrophonePermission() { if (micPermissionGranted) return true; try { if (!navigator.mediaDevices?.getUserMedia) return false; const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach(t => t.stop()); micPermissionGranted = true; return true; } catch (e) { return false; } }

function buildClientIndex() {
    if (clientIndexBuilt || !window.posAllClients?.length) return;
    clientSearchIndex = {};
    window.posAllClients.forEach(c => {
        if (!c?.id) return;
        const allText = (c.nom + ' ' + c.prenom + ' ' + c.telephone + ' ' + (c.description || '')).toLowerCase();
        allText.split(/[\s,;.]+/).forEach(mot => {
            mot = mot.trim();
            if (mot.length >= 1) {
                if (!clientSearchIndex[mot]) clientSearchIndex[mot] = [];
                if (!clientSearchIndex[mot].includes(c)) clientSearchIndex[mot].push(c);
            }
        });
        const fullName = (c.nom + ' ' + c.prenom).toLowerCase().trim();
        if (fullName.length >= 2) {
            if (!clientSearchIndex[fullName]) clientSearchIndex[fullName] = [];
            if (!clientSearchIndex[fullName].includes(c)) clientSearchIndex[fullName].push(c);
        }
        if (c.description) {
            const descWords = c.description.toLowerCase().trim().split(/[\s,;.]+/);
            descWords.forEach(mot => {
                mot = mot.trim();
                if (mot.length >= 2) {
                    if (!clientSearchIndex[mot]) clientSearchIndex[mot] = [];
                    if (!clientSearchIndex[mot].includes(c)) clientSearchIndex[mot].push(c);
                }
            });
        }
    });
    clientIndexBuilt = true;
}

function fastFindClient(query) {
    buildClientIndex();
    const q = (query || '').toLowerCase().trim();
    if (!q) return window.posAllClients?.slice() || [];
    const normalized = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const mots = normalized.split(/[\s,;.]+/);
    const seen = {}, results = [];
    mots.forEach(mot => {
        mot = mot.trim();
        if (!mot) return;
        (clientSearchIndex[mot] || []).forEach(c => { if (!seen[c.id]) { seen[c.id] = true; results.push(c); } });
    });
    if (results.length === 0 && window.posAllClients) {
        results.push(...window.posAllClients.filter(c => {
            const nom = (c.nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const prenom = (c.prenom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const desc = (c.description || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const tel = (c.telephone || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            return nom.includes(normalized) || prenom.includes(normalized) || desc.includes(normalized) || tel.includes(normalized);
        }));
    }
    return results;
}

function invalidateClientIndex() { clientIndexBuilt = false; clientSearchIndex = {}; }

function buildProductIndex() {
    if (productIndexBuilt || !window.posProductsList?.length) return;
    productNameIndex = {};
    window.posProductsList.forEach(function(p) {
        if (!p.nom) return;
        var nomNormalized = p.nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        var mots = nomNormalized.split(/[\s,;.]+/);
        mots.forEach(function(mot) {
            mot = mot.trim();
            if (mot.length < 2) return;
            if (!productNameIndex[mot]) productNameIndex[mot] = [];
            if (!productNameIndex[mot].includes(p)) productNameIndex[mot].push(p);
        });
        var descNormalized = (p.description || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        descNormalized.split(/[\s,;.]+/).forEach(function(mot) {
            mot = mot.trim();
            if (mot.length < 2) return;
            if (!productNameIndex[mot]) productNameIndex[mot] = [];
            if (!productNameIndex[mot].includes(p)) productNameIndex[mot].push(p);
        });
    });
    productIndexBuilt = true;
}

function fastFindProduct(query) {
    buildProductIndex();
    if (!query) return [];
    var cleaned = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    var mots = cleaned.split(/[\s,;.]+/);
    if (mots.length === 0) return [];

    var firstWord = mots[0];
    var searchTerm = firstWord;
    if (mots.length >= 2) {
        searchTerm = firstWord + ' ' + mots[1];
    }

    var candidates = productNameIndex[firstWord] || [];
    if (candidates.length === 0) return [];

    var filtered = candidates.filter(function(p) {
        var nom = (p.nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return nom.indexOf(searchTerm) !== -1;
    });

    if (filtered.length === 0) {
        return [candidates[0]];
    }

    if (filtered.length === 1) return filtered;

    var exact = filtered.find(function(p) {
        var nom = (p.nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return nom === searchTerm;
    });
    if (exact) return [exact];

    filtered.sort(function(a, b) { return (a.nom||'').length - (b.nom||'').length; });
    return [filtered[0]];
}

function buildProductAdminIndex() {
    if (window.productAdminIndexBuilt) return;
    window.productAdminIndex = {};
    var products = window.allProductsData || window.posProductsList || [];
    products.forEach(function(p) {
        if (!p.nom) return;
        var nomNormalized = p.nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        var mots = nomNormalized.split(/[\s,;.]+/);
        mots.forEach(function(mot) {
            mot = mot.trim();
            if (mot.length < 2) return;
            if (!window.productAdminIndex[mot]) window.productAdminIndex[mot] = [];
            if (!window.productAdminIndex[mot].includes(p)) window.productAdminIndex[mot].push(p);
        });
        var descNormalized = (p.description || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        descNormalized.split(/[\s,;.]+/).forEach(function(mot) {
            mot = mot.trim();
            if (mot.length < 2) return;
            if (!window.productAdminIndex[mot]) window.productAdminIndex[mot] = [];
            if (!window.productAdminIndex[mot].includes(p)) window.productAdminIndex[mot].push(p);
        });
    });
    window.productAdminIndexBuilt = true;
}

function fastFindProductAdmin(query) {
    buildProductAdminIndex();
    if (!query) return [];
    var cleaned = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    var mots = cleaned.split(/[\s,;.]+/);
    if (mots.length === 0) return [];

    var firstWord = mots[0];
    var searchTerm = firstWord;
    if (mots.length >= 2) {
        searchTerm = firstWord + ' ' + mots[1];
    }

    var candidates = window.productAdminIndex[firstWord] || [];
    if (candidates.length === 0) return [];

    var filtered = candidates.filter(function(p) {
        var nom = (p.nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return nom.indexOf(searchTerm) !== -1;
    });

    if (filtered.length === 0) {
        return [candidates[0]];
    }

    if (filtered.length === 1) return filtered;

    var exact = filtered.find(function(p) {
        var nom = (p.nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return nom === searchTerm;
    });
    if (exact) return [exact];

    filtered.sort(function(a, b) { return (a.nom||'').length - (b.nom||'').length; });
    return [filtered[0]];
}

function extractNumberFromTranscript(transcript) {
    const cleaned = transcript.toLowerCase().trim();
    const digits = cleaned.match(/\b\d+\b/);
    if (digits) return parseInt(digits[0]);
    for (const word in numberMap) {
        if (cleaned.includes(word)) return numberMap[word];
    }
    return null;
}

function detectPeriodFilter(transcript) {
    var cleaned = transcript.toLowerCase().trim();
    if (cleaned.includes("aujourd'hui") || cleaned.includes("aujourd hui") || cleaned.includes("today")) {
        return 'today';
    }
    if (cleaned.includes("ce mois") || cleaned.includes("cemois") || cleaned.includes("mois en cours") || cleaned.includes("ce mois ci")) {
        return '30';
    }
    if (cleaned.includes("7 jours") || cleaned.includes("7j") || cleaned.includes("sept jours") || cleaned.includes("semaine") || cleaned.includes("7 jour")) {
        return '7';
    }
    if (cleaned.includes("15 jours") || cleaned.includes("15j") || cleaned.includes("quinze jours") || cleaned.includes("15 jour")) {
        return '15';
    }
    if (cleaned.includes("30 jours") || cleaned.includes("30j") || cleaned.includes("trente jours") || cleaned.includes("30 jour")) {
        return '30';
    }
    if (cleaned.includes("3 mois") || cleaned.includes("3mois") || cleaned.includes("trois mois") || cleaned.includes("trimestre") || cleaned.includes("3 moi")) {
        return '90';
    }
    if (cleaned.includes("6 mois") || cleaned.includes("6mois") || cleaned.includes("six mois") || cleaned.includes("semestre") || cleaned.includes("6 moi")) {
        return '180';
    }
    if (cleaned.includes("1 an") || cleaned.includes("1an") || cleaned.includes("un an") || cleaned.includes("annee") || cleaned.includes("année") || cleaned.includes("1 ans") || cleaned.includes("un ans")) {
        return '365';
    }
    if (cleaned.includes("tout") || cleaned.includes("toutes") || cleaned.includes("all") || cleaned.includes("tous")) {
        return 'all';
    }
    return null;
}

function parseVoiceCommand(transcript) {
    var cleaned = transcript.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var currentPage = document.getElementById('pageTitle')?.textContent || '';
    var posStep = window.posStep || 1;

    // NAVIGATION
    if (cleaned.includes('crédits') || cleaned.includes('impayés') || cleaned.includes('liste des crédits') || cleaned.includes('dettes') || cleaned.includes('ardoises')) {
        return { type: 'navigate', page: 'credits' };
    }
    if (cleaned.includes('ventes') || cleaned.includes('vente') || cleaned.includes('historique ventes') || cleaned.includes('recettes')) {
        return { type: 'navigate', page: 'ventes' };
    }
    if (cleaned.includes('dashboard') || cleaned.includes('accueil') || cleaned.includes('home') || cleaned.includes('sommaire') || cleaned.includes('tableau de bord')) {
        return { type: 'navigate', page: 'dashboard' };
    }
    if (cleaned.includes('produits') || cleaned.includes('catalogue') || cleaned.includes('liste des produits')) {
        return { type: 'navigate', page: 'products' };
    }
    if (cleaned.includes('clients') || cleaned.includes('clientèle')) {
        return { type: 'navigate', page: 'clients' };
    }
    if (cleaned.includes('commandes')) {
        return { type: 'navigate', page: 'commandes' };
    }
    if (cleaned.includes('catégories')) {
        return { type: 'navigate', page: 'categories' };
    }
    if (cleaned.includes('point de vente') || cleaned.includes('pos') || cleaned.includes('caisse') || cleaned.includes('encaissement')) {
        return { type: 'navigate', page: 'pos' };
    }
    if (cleaned.includes('dépenses') || cleaned.includes('depenses')) {
        return { type: 'navigate', page: 'depenses' };
    }
    if (cleaned.includes('statistiques') || cleaned.includes('stats')) {
        return { type: 'navigate', page: 'statistiques' };
    }
    if (cleaned.includes('options') || cleaned.includes('paramètres') || cleaned.includes('settings')) {
        return { type: 'navigate', page: 'options' };
    }

    // Période
    var period = detectPeriodFilter(cleaned);
    if (period !== null) {
        return { type: 'period_filter', period: period };
    }

    // MODE QUANTITÉ
    if (voiceMode === 'quantity') {
        var num = extractNumberFromTranscript(cleaned);
        if (num !== null && num > 0) return { type: 'number', value: num };
        return { type: 'ignore' };
    }

    // ÉTAPE 2 : MODE PAIEMENT
    if ((posStep === 2 || voiceMode === 'payment') && (currentPage === 'POS' || currentPage === 'Dashboard')) {
        switch (window.voicePaymentState) {
            case 0:
                if (window.posAllClients) {
                    var clients = fastFindClient(cleaned);
                    if (clients.length === 1) {
                        return { type: 'client', client: clients[0] };
                    }
                    if (clients.length > 1) {
                        var best = clients.find(function(c) { 
                            return (c.nom + ' ' + c.prenom).toLowerCase().indexOf(cleaned) !== -1; 
                        }) || clients[0];
                        return { type: 'client', client: best };
                    }
                }
                var pm0 = detectPaymentMode(cleaned);
                if (pm0) return { type: 'payment_mode', mode: pm0 };
                return { type: 'ignore' };
            case 1:
                var pm = detectPaymentMode(cleaned);
                if (pm) return { type: 'payment_mode', mode: pm };
                return { type: 'ignore' };
            case 2:
                var n = extractNumberFromTranscript(cleaned);
                if (n !== null && n > 0) return { type: 'number', value: n };
                if (cleaned.includes('valide') || cleaned.includes('validé') || cleaned.includes('valider') || 
                    cleaned.includes('confirmer') || cleaned.includes('ok') || cleaned.includes('finaliser')) {
                    return { type: 'validate' };
                }
                return { type: 'ignore' };
        }
    }

    // ÉTAPE 1 : RECHERCHE PRODUIT (POS)
    if (voiceMode === 'search' || posStep === 1) {
        if ((currentPage === 'POS' || currentPage === 'Dashboard') && posStep === 1) {
            var products = window.posProductsList || [];
            if (products.length) {
                var best = fastFindProduct(cleaned)[0];
                if (best) return { type: 'search_product', product: best, page: 'pos' };
            }
            if (cleaned.includes('passe') || cleaned.includes('passer') || cleaned.includes('suivant') || cleaned.includes('z') || cleaned.includes('zip')) {
                return { type: 'next' };
            }
            if (cleaned.includes('valide') || cleaned.includes('validé') || cleaned.includes('valider') || 
                cleaned.includes('confirmer') || cleaned.includes('ok')) {
                return { type: 'validate' };
            }
            if (cleaned.includes('annule') || cleaned.includes('annuler')) return { type: 'cancel' };
            if (cleaned.includes('efface') || cleaned.includes('vider')) return { type: 'clear' };
            if (cleaned.includes('termine') || cleaned.includes('terminer') || cleaned.includes('fin')) return { type: 'finalize' };
        }
        else if (currentPage === 'Produits') {
            var bestAdmin = fastFindProductAdmin(cleaned)[0];
            if (bestAdmin) return { type: 'search_product', product: bestAdmin, page: 'products' };
        }
    }

    return { type: 'ignore' };
}

function detectPaymentMode(transcript) {
    var t = transcript.toLowerCase().trim();
    for (var mode in paymentKeywords) {
        if (paymentKeywords[mode].some(function(kw) { return t.indexOf(kw) !== -1; })) return mode;
    }
    return null;
}

function handleVoiceCommand(cmd) {
    var cp = document.getElementById('pageTitle')?.textContent || '';
    switch (cmd.type) {
        case 'period_filter':
            var period = cmd.period;
            var periodLabels = {
                'today': "Aujourd'hui",
                '7': "7 jours",
                '15': "15 jours",
                '30': "30 jours",
                '90': "3 mois",
                '180': "6 mois",
                '365': "1 an",
                'all': "Tout"
            };

            if (cp === 'Crédits') {
                var periodSelect = document.getElementById('creditsPeriodSelect');
                if (periodSelect) {
                    periodSelect.value = period;
                    window.creditsPeriod = period;
                    window.currentPages.credits = 1;
                    if (window.allCreditsData.length === 0) {
                        if (typeof loadCredits === 'function') loadCredits();
                    } else {
                        if (typeof applyCreditsFilters === 'function') applyCreditsFilters();
                    }
                    showVoiceResult('📅 ' + (periodLabels[period] || period));
                }
            } else if (cp === 'Ventes') {
                var periodSelect = document.getElementById('ventesPeriodSelect');
                if (periodSelect) {
                    periodSelect.value = period;
                    window.ventesPeriod = period;
                    window.currentPages.ventes = 1;
                    if (window.allVentesData.length === 0) {
                        if (typeof loadVentes === 'function') loadVentes();
                    } else {
                        if (typeof applyVentesFilters === 'function') applyVentesFilters();
                    }
                    showVoiceResult('📅 ' + (periodLabels[period] || period));
                }
            } else if (cp === 'Dépenses') {
                var periodSelect = document.getElementById('globalPeriodSelect');
                if (periodSelect) {
                    periodSelect.value = period;
                    globalPeriod = period;
                    if (typeof loadDepenses === 'function') loadDepenses();
                    if (typeof loadPersonnel === 'function') loadPersonnel();
                    showVoiceResult('📅 ' + (periodLabels[period] || period));
                }
            } else if (cp === 'Commandes en ligne') {
                var periodSelect = document.getElementById('commandesPeriodSelect');
                if (periodSelect) {
                    periodSelect.value = period;
                    window.commandesPeriod = period;
                    window.currentPages.commandes = 1;
                    if (window.allCommandesData.length === 0) {
                        if (typeof loadCommandes === 'function') loadCommandes();
                    } else {
                        if (typeof applyCommandesFilters === 'function') applyCommandesFilters();
                    }
                    showVoiceResult('📅 ' + (periodLabels[period] || period));
                }
            } else if (cp === 'Statistiques') {
                var periodSelect = document.getElementById('statPeriodSelect');
                if (periodSelect) {
                    periodSelect.value = period;
                    var event = new Event('change', { bubbles: true });
                    periodSelect.dispatchEvent(event);
                    showVoiceResult('📅 ' + (periodLabels[period] || period));
                }
            } else if (cp === 'POS' || cp === 'Dashboard') {
                if (typeof navigateTo === 'function') {
                    navigateTo('credits');
                    setTimeout(function() {
                        var periodSelect = document.getElementById('creditsPeriodSelect');
                        if (periodSelect) {
                            periodSelect.value = period;
                            window.creditsPeriod = period;
                            window.currentPages.credits = 1;
                            if (window.allCreditsData.length === 0) {
                                if (typeof loadCredits === 'function') loadCredits();
                            } else {
                                if (typeof applyCreditsFilters === 'function') applyCreditsFilters();
                            }
                            showVoiceResult('📅 ' + (periodLabels[period] || period));
                        }
                    }, 500);
                }
            }
            hideVoiceFlowIndicator();
            break;

        case 'search_product':
            if (cmd.page === 'products' || cp === 'Produits') {
                var adminInput = document.getElementById('productSearchInput');
                if (adminInput && cmd.product) {
                    adminInput.value = cmd.product.nom;
                    window.productSearchQuery = cmd.product.nom.toLowerCase().trim();
                    if (typeof renderProductsTable === 'function') renderProductsTable();
                    showVoiceResult('🔍 ' + cmd.product.nom + ' – filtré');
                }
            } else {
                var searchInput = document.getElementById('posSearchInput');
                if (searchInput && cmd.product) {
                    searchInput.value = cmd.product.nom;
                    if (cmd.product.categorie && typeof window.posFilterCategory === 'function') {
                        window.posFilterCategory(cmd.product.categorie);
                    }
                    setTimeout(function() {
                        var cards = document.querySelectorAll('.pos-product-card');
                        for (var i = 0; i < cards.length; i++) {
                            var card = cards[i];
                            var nameEl = card.querySelector('.pos-product-name');
                            if (nameEl && nameEl.textContent.trim().toLowerCase() === cmd.product.nom.toLowerCase()) {
                                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                card.style.boxShadow = '0 0 0 3px #14B8A6';
                                setTimeout(function() { card.style.boxShadow = ''; }, 1500);
                                break;
                            }
                        }
                    }, 300);
                    showVoiceResult('🔍 ' + cmd.product.nom);
                }
            }
            hideVoiceFlowIndicator();
            break;
        case 'number':
            if (voiceMode === 'quantity' && lastAddedProductId) {
                var qty = cmd.value, it = window.posCart?.find(function(x) { return x.id === lastAddedProductId; });
                if (it) {
                    var p = window.posProductsList?.find(function(x) { return x.id === lastAddedProductId; });
                    if (p && p.stock !== undefined && qty > p.stock) { showVoiceResult('⚠️ Stock max: ' + p.stock); return; }
                    it.quantite = qty; lastAddedProductId = null;
                    setVoiceMode('search', '🎤 Recherche vocale active', null);
                    if (typeof window.updateCartOnly === 'function') window.updateCartOnly();
                    showVoiceResult('✅ Qté: ' + qty);
                }
            } else if (voiceMode === 'payment' && window.voicePaymentState === 2) {
                window.posAmountGiven = cmd.value;
                var ce = document.getElementById('posChangeDisplay');
                if (ce) {
                    var st = typeof window.posCalculateTotal === 'function' ? window.posCalculateTotal() : 0;
                    var t = st - (window.posDiscountMAD || 0);
                    var c = window.posAmountGiven - t;
                    ce.innerHTML = c >= 0 ? '<div class="pos-change-positive"><span>Rendu</span><span>' + c.toFixed(2) + ' MAD</span></div>' : '<div class="pos-change-negative"><span>Manquant</span><span>' + Math.abs(c).toFixed(2) + ' MAD</span></div>';
                }
                var ai = document.getElementById('posAmountGiven');
                if (ai) ai.value = window.posAmountGiven;
                showVoiceResult('💰 ' + window.posAmountGiven.toFixed(2) + ' MAD');
            }
            hideVoiceFlowIndicator();
            break;
        
        case 'client':
            window.posCurrentClient = { id: cmd.client.id, name: cmd.client.nom + ' ' + cmd.client.prenom };
            window.posCurrentTable = '';
            
            var ci = document.getElementById('posClientSearchInput');
            if (ci) {
                ci.value = window.posCurrentClient.name;
                var evt = new Event('input', { bubbles: true });
                ci.dispatchEvent(evt);
            }
            
            if (typeof window.updateClientCreditDisplay === 'function') {
                window.updateClientCreditDisplay(cmd.client.id);
            }
            
            if (typeof window.updatePaymentButtons === 'function') {
                window.updatePaymentButtons();
            }
            
            var creditDisplay = document.getElementById('clientCreditDisplay');
            if (creditDisplay) {
                if (typeof window.loadClientCredits === 'function') {
                    window.loadClientCredits(cmd.client.id).then(function(amount) {
                        if (amount > 0) {
                            creditDisplay.textContent = '💳 Crédit: ' + amount.toFixed(2) + ' MAD';
                            creditDisplay.style.color = '#ef4444';
                            creditDisplay.style.fontWeight = '700';
                        } else {
                            creditDisplay.textContent = '✅ Aucun crédit';
                            creditDisplay.style.color = '#14B8A6';
                            creditDisplay.style.fontWeight = '600';
                        }
                        creditDisplay.style.display = 'block';
                    });
                }
            }
            
            window.voicePaymentState = 1;
            showVoiceResult('👤 ' + window.posCurrentClient.name);
            hideVoiceFlowIndicator();
            
            setTimeout(function() {
                if (window.posStep === 1 && typeof window.posGoToStep2 === 'function') {
                    window.posGoToStep2();
                }
                if (typeof window.renderPOS === 'function') {
                    setTimeout(function() { window.renderPOS(); }, 100);
                }
                setTimeout(function() { 
                    showVoiceFlowIndicator('payment_mode'); 
                }, 300);
            }, 400);
            break;
            
        case 'payment_mode':
            if (typeof window.posSetPaymentMethod === 'function') {
                window.posSetPaymentMethod(cmd.mode);
                window.voicePaymentState = 2;
                showVoiceResult('💳 ' + cmd.mode);
                if (cmd.mode === 'espece') {
                    setTimeout(function() { var ai = document.getElementById('posAmountGiven'); if (ai) ai.focus(); }, 200);
                }
            }
            hideVoiceFlowIndicator();
            setTimeout(function() { showVoiceFlowIndicator('payment_amount'); }, 100);
            break;
        case 'validate': case 'finalize':
            if (window.posStep === 2 && typeof window.posFinalizeSale === 'function') {
                window.posFinalizeSale();
                hideVoiceFlowIndicator();
            } else if (window.posCart?.length > 0 && window.posStep === 1) {
                window.posGoToStep2();
                hideVoiceFlowIndicator();
            }
            break;
        case 'clear':
            if (typeof window.posResetCart === 'function') { window.posResetCart(); showVoiceResult('🗑️ Panier vidé'); }
            hideVoiceFlowIndicator();
            break;
        case 'next':
            if (window.posCart?.length > 0 && window.posStep === 1) window.posGoToStep2();
            hideVoiceFlowIndicator();
            break;
        case 'cancel':
            setVoiceMode('search', '🎤 Recherche vocale active', null);
            showVoiceResult('↩️ Recherche');
            if (typeof window.renderPOS === 'function') window.renderPOS();
            hideVoiceFlowIndicator();
            break;
        case 'navigate':
            var pages = { 
                'credits': 'Crédits', 
                'ventes': 'Ventes', 
                'dashboard': 'Dashboard', 
                'products': 'Produits', 
                'clients': 'Clients', 
                'commandes': 'Commandes en ligne', 
                'categories': 'Catégories', 
                'pos': 'POS',
                'depenses': 'Dépenses',
                'statistiques': 'Statistiques',
                'options': 'Options'
            };
            if (cp === pages[cmd.page]) { 
                showVoiceResult('✅ ' + pages[cmd.page]); 
            } else {
                if (typeof navigateTo === 'function') {
                    navigateTo(cmd.page);
                    showVoiceResult('📍 ' + pages[cmd.page]);
                }
            }
            hideVoiceFlowIndicator();
            break;
        default:
            if (cmd.text && typeof window.posSearchProducts === 'function') window.posSearchProducts(cmd.text);
    }
}

function setVoiceMode(mode, msg, productId) {
    voiceMode = mode;
    if (msg) voiceModeMessage = msg;
    if (productId !== undefined) lastAddedProductId = productId;
    if (mode === 'payment') window.voicePaymentState = 0;
    showVoiceModeIndicator();
}

function posToggleVoiceSearch() {
    var s = checkVoiceSupport();
    if (!s.supported) { alert('⚠️ ' + s.reason); return; }
    if (!navigator.onLine) { alert('⚠️ Connexion internet requise.'); return; }
    if (isRecording) { posStopVoiceSearch(); return; }
    requestMicrophonePermission().then(function(p) {
        if (!p) { alert('❌ Micro refusé.'); return; }
        posStartVoiceRecording();
    });
}

function posStartVoiceRecording() {
    var mb = document.getElementById('posMicBtn');
    if (voiceRecognition) { try { voiceRecognition.abort(); } catch (e) {} voiceRecognition = null; }
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('❌ Reconnaissance vocale non disponible.'); return; }
    voiceRecognition = new SR();
    voiceRecognition.lang = 'fr-FR';
    voiceRecognition.continuous = true;
    voiceRecognition.interimResults = true;
    voiceRecognition.maxAlternatives = 1;

    if (mb) {
        mb.classList.add('recording');
        mb.innerHTML = '<i class="fas fa-circle" style="color:#ef4444;animation:pulse 0.5s ease-in-out infinite;"></i>';
        mb.style.background = '#fee2e2'; mb.style.borderColor = '#ef4444';
    }

    var lastInterim = '';
    voiceRecognition.onresult = function(e) {
        var interim = '', final = '';
        for (var i = e.resultIndex; i < e.results.length; i++) {
            var t = e.results[i][0].transcript;
            if (e.results[i].isFinal) final += t;
            else interim += t;
        }
        var cp = document.getElementById('pageTitle')?.textContent || '';

        if (cp === 'Crédits') {
            var vd = document.getElementById('creditsVoiceDisplay');
            var searchInput = document.getElementById('creditsSearchInput');
            var periodSelect = document.getElementById('creditsPeriodSelect');

            if (vd && searchInput && periodSelect) {
                if (final) {
                    var period = detectPeriodFilter(final);
                    if (period !== null) {
                        periodSelect.value = period;
                        window.creditsPeriod = period;
                        window.currentPages.credits = 1;
                        if (window.allCreditsData.length === 0) {
                            if (typeof loadCredits === 'function') loadCredits();
                        } else {
                            if (typeof applyCreditsFilters === 'function') applyCreditsFilters();
                        }
                        showVoiceResult('📅 ' + final);
                    } else {
                        searchInput.value = final;
                        vd.value = final;
                        window.creditsSearch = final;
                        window.currentPages.credits = 1;
                        if (window.allCreditsData.length === 0) {
                            if (typeof loadCredits === 'function') loadCredits();
                        } else {
                            if (typeof applyCreditsFilters === 'function') applyCreditsFilters();
                        }
                        showVoiceResult('👤 ' + final);
                    }
                    showProcessingIndicator();
                    var cmd = parseVoiceCommand(final);
                    if (cmd.type !== 'ignore') handleVoiceCommand(cmd);
                    hideVoiceFlowIndicator();
                } else if (interim && interim !== lastInterim) {
                    searchInput.value = interim + ' ✍️';
                    vd.value = interim + ' ✍️';
                    lastInterim = interim;
                }
            }
        } else if (cp === 'Ventes') {
            var vd2 = document.getElementById('ventesVoiceDisplay');
            var searchInput = document.getElementById('ventesSearchInput');
            var periodSelect = document.getElementById('ventesPeriodSelect');

            if (vd2 && searchInput && periodSelect) {
                if (final) {
                    var period = detectPeriodFilter(final);
                    if (period !== null) {
                        periodSelect.value = period;
                        window.ventesPeriod = period;
                        window.currentPages.ventes = 1;
                        if (window.allVentesData.length === 0) {
                            if (typeof loadVentes === 'function') loadVentes();
                        } else {
                            if (typeof applyVentesFilters === 'function') applyVentesFilters();
                        }
                        showVoiceResult('📅 ' + final);
                    } else {
                        searchInput.value = final;
                        vd2.value = final;
                        window.ventesSearch = final;
                        window.currentPages.ventes = 1;
                        if (window.allVentesData.length === 0) {
                            if (typeof loadVentes === 'function') loadVentes();
                        } else {
                            if (typeof applyVentesFilters === 'function') applyVentesFilters();
                        }
                        showVoiceResult('👤 ' + final);
                    }
                    showProcessingIndicator();
                    var cmd = parseVoiceCommand(final);
                    if (cmd.type !== 'ignore') handleVoiceCommand(cmd);
                    hideVoiceFlowIndicator();
                } else if (interim && interim !== lastInterim) {
                    searchInput.value = interim + ' ✍️';
                    vd2.value = interim + ' ✍️';
                    lastInterim = interim;
                }
            }
        } else if (cp === 'Produits') {
            var pi = document.getElementById('productSearchInput');
            if (pi) {
                if (final) {
                    pi.value = final;
                    window.productSearchQuery = final.toLowerCase().trim();
                    if (typeof renderProductsTable === 'function') renderProductsTable();
                    showProcessingIndicator();
                    var cmd = parseVoiceCommand(final);
                    if (cmd.type !== 'ignore') handleVoiceCommand(cmd);
                    hideVoiceFlowIndicator();
                    showVoiceResult('🔍 ' + final);
                } else if (interim && interim !== lastInterim) {
                    pi.value = interim + ' ✍️';
                    lastInterim = interim;
                }
            }
        } else {
            var si = document.getElementById('posSearchInput');
            if (si) {
                if (final) {
                    var lowerFinal = final.toLowerCase().trim();
                    if (lowerFinal.includes('crédits') || lowerFinal.includes('impayés') || 
                        lowerFinal.includes('dettes') || lowerFinal.includes('ardoises') ||
                        lowerFinal.includes('liste des crédits')) {
                        if (typeof navigateTo === 'function') {
                            navigateTo('credits');
                        }
                        if (typeof showVoiceResult === 'function') {
                            showVoiceResult('📍 Crédits');
                        }
                        lastInterim = '';
                        si.value = '';
                        return;
                    }
                    
                    si.value = final;
                    var event = new Event('input', { bubbles: true });
                    si.dispatchEvent(event);
                    showProcessingIndicator();
                    var cmd = parseVoiceCommand(final);
                    if (cmd.type !== 'ignore') handleVoiceCommand(cmd);
                    hideVoiceFlowIndicator();
                } else if (interim && interim !== lastInterim) {
                    si.value = interim + ' ✍️';
                    lastInterim = interim;
                }
            }
        }
    };

    voiceRecognition.onend = function() {
        if (isRecording) {
            setTimeout(function() {
                try { voiceRecognition.start(); } catch (e) { posStopVoiceSearch(); }
            }, 8);
        }
    };
    voiceRecognition.onerror = function(e) {
        if (e.error === 'aborted' || e.error === 'no-speech') return;
        if (e.error === 'network') showVoiceResult('❌ Réseau');
        posStopVoiceSearch();
    };

    try {
        voiceRecognition.start();
        isRecording = true;
        showVoiceModeIndicator();
        showVoiceResult('🎤 Écoute...');
        showVoiceFlowIndicator('product');
    } catch (e) {
        isRecording = false;
        if (mb) {
            mb.classList.remove('recording');
            mb.innerHTML = '<i class="fas fa-microphone"></i>';
            mb.style.background = '#dcfce7'; mb.style.borderColor = '#14B8A6';
        }
    }
}

function posStopVoiceSearch() {
    if (voiceRecognition) { try { voiceRecognition.abort(); } catch (e) {} voiceRecognition = null; }
    isRecording = false;
    var mb = document.getElementById('posMicBtn'), si = document.getElementById('posSearchInput');
    if (mb) {
        mb.classList.remove('recording');
        mb.innerHTML = '<i class="fas fa-microphone"></i>';
        mb.style.background = '#dcfce7'; mb.style.borderColor = '#14B8A6';
    }
    if (si) {
        si.placeholder = '🔍 Rechercher...';
        si.style.background = '#fff';
        si.style.borderColor = '#e2e8f0';
    }
    hideVoiceFlowIndicator();
    showVoiceResult('🎤 Micro désactivé');
}

window.posToggleVoiceSearch = posToggleVoiceSearch;
window.showVoiceResult = showVoiceResult;
window.setVoiceMode = setVoiceMode;
window.showVoiceModeIndicator = showVoiceModeIndicator;
window.parseVoiceCommand = parseVoiceCommand;
window.handleVoiceCommand = handleVoiceCommand;
window.invalidateClientIndex = invalidateClientIndex;
window.showVoiceFlowIndicator = showVoiceFlowIndicator;
window.hideVoiceFlowIndicator = hideVoiceFlowIndicator;
window.showProcessingIndicator = showProcessingIndicator;
window.onProductAdded = function(pid) {
    lastAddedProductId = pid;
    setVoiceMode('quantity', '🔢 Qté', pid);
    showVoiceModeIndicator();
    hideVoiceFlowIndicator();
    setTimeout(function() { showVoiceFlowIndicator('quantity'); }, 100);
};
window.buildClientIndex = buildClientIndex;
window.buildProductIndex = buildProductIndex;
window.buildProductAdminIndex = buildProductAdminIndex;
window.fastFindProductAdmin = fastFindProductAdmin;

console.log('🎤 Module vocal E-SOLUTION – prêt');
