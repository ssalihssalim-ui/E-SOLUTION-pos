// ==================== POS-AUDIO.JS v27 – QUANTITÉ PRIORITAIRE ====================
// ✅ Le texte s'écrit dans la barre SANS icône ✍️
// ✅ Recherche lancée automatiquement à chaque mot dicté (interim)
// ✅ Produit dicté → affiché dans la barre ET recherche lancée
// ✅ Après sélection d'un produit → écoute la quantité EN PRIORITÉ
// ✅ Si ce n'est pas un nombre → cherche un nouveau produit
// ✅ En étape 2, client détecté et sélectionné automatiquement
// ✅ Navigation "POS" fonctionne depuis TOUTES les pages
// ✅ Le micro affiche la barre de recherche avant de démarrer
// 🔥 CORRECTION : Navigation utilise les noms ANGLAIS (products, categories...) pour matcher admin.js
// 🔥 AJOUT : Recherche vocale sur pages Produits, Ventes, Crédits

var voiceRecognition = null;
var isRecording = false;
var voiceMode = 'search';
var lastAddedProductId = null;
var voiceModeMessage = '🎤 Recherche vocale active';
var micPermissionGranted = false;
var pendingProductForQuantity = null;
var waitingForQuantity = false;

// ========== INDEX CLIENT ==========
var clientSearchIndex = {};
var clientIndexBuilt = false;

// ========== INDEX PRODUIT ==========
var productNameIndex = {};
var productIndexBuilt = false;

// ========== PAYMENT STATE MACHINE ==========
window.voicePaymentState = 0;

// ✅ DÉFINIR closeCreditSelection comme FALLBACK
if (typeof window.closeCreditSelection !== 'function') {
    window.closeCreditSelection = function() {
        console.log('closeCreditSelection appelé (fallback pos-audio)');
        window.creditSelectionMode = false;
        window.creditSelectedIds = [];
        if (typeof renderCreditsTablePro === 'function') {
            renderCreditsTablePro();
        }
    };
}

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

// ========== FONCTIONS D'AFFICHAGE VOCAL ==========
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
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(window._voiceTimeout);
    window._voiceTimeout = setTimeout(function() { el.style.display = 'none'; }, 3000);
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
        'quantity': '🔢 Dites la quantité (ex: 2, 3, 5...)', 
        'payment_mode': 'Mode de paiement ?', 
        'payment_amount': 'Montant donné ?' 
    };
    if (labels[phase]) showVoiceResult(labels[phase]);
}
function showProcessingIndicator() {}

// ========== UTILITAIRES ==========
function escapeHtml(str) { return str ? str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]) : ''; }
function isIOSStandalone() { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream && (window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches); }
function checkVoiceSupport() { var i = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; if (i && isIOSStandalone()) return { supported: false, reason: 'Ouvrez dans Safari' }; if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return { supported: false, reason: 'Non supporté' }; return { supported: true }; }
async function requestMicrophonePermission() { if (micPermissionGranted) return true; try { if (!navigator.mediaDevices?.getUserMedia) return false; const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach(t => t.stop()); micPermissionGranted = true; return true; } catch (e) { return false; } }

// ========== INDEX CLIENT (AVEC DESCRIPTION) ==========
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
    });
    clientIndexBuilt = true;
    console.log('📇 Index client construit avec ' + window.posAllClients.length + ' clients');
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
    return results;
}

function invalidateClientIndex() { clientIndexBuilt = false; clientSearchIndex = {}; }

// ========== INDEX PRODUIT ==========
function buildProductIndex() {
    if (productIndexBuilt || !window.posProductsList?.length) return;
    productNameIndex = {};
    window.posProductsList.forEach(function(p) {
        if (!p.nom) return;
        var nomNormalized = p.nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        nomNormalized.split(/[\s,;.]+/).forEach(function(mot) {
            mot = mot.trim();
            if (mot.length < 1) return;
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
    if (!cleaned) return [];
    var mots = cleaned.split(/[\s,;.]+/);
    var results = [], seen = {};
    mots.forEach(function(mot) {
        mot = mot.trim();
        if (mot.length < 2) return;
        (productNameIndex[mot] || []).forEach(function(p) {
            if (!seen[p.id]) { seen[p.id] = true; results.push(p); }
        });
    });
    return results;
}

// ========== COMMANDES ==========
// 🔥 CORRECTION 1 : tri par longueur décroissante + match exact de mot
function extractNumberFromTranscript(transcript) {
    const cleaned = transcript.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // 1. Chiffres en premier (ex: "2", "15")
    const digits = cleaned.match(/\b\d+\b/);
    if (digits) return parseInt(digits[0]);
    // 2. Mots-nombres : chercher par longueur DÉCROISSANTE pour éviter "cinq" dans "cinquante"
    const sortedKeys = Object.keys(numberMap).sort(function(a, b) { return b.length - a.length; });
    // 3. Découper en mots et chercher un match EXACT de mot
    const words = cleaned.split(/[\s,;.!?]+/).filter(function(w) { return w.length > 0; });
    // D'abord match exact mot par mot
    for (let w = 0; w < words.length; w++) {
        const mot = words[w];
        for (let i = 0; i < sortedKeys.length; i++) {
            if (mot === sortedKeys[i]) {
                return numberMap[sortedKeys[i]];
            }
        }
    }
    // 4. Fallback : chercher par sous-chaîne (mais en longueur décroissante)
    for (let i = 0; i < sortedKeys.length; i++) {
        const word = sortedKeys[i];
        const regex = new RegExp('(^|[\\s,;.!?])' + word + '($|[\\s,;.!?])', 'i');
        if (regex.test(cleaned)) {
            return numberMap[word];
        }
    }
    return null;
}

function detectPeriodFilter(transcript) {
    var cleaned = transcript.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var periodKeywords = {
        'today': ['aujourdhui', 'aujourd hui', 'today', 'ajourdhui', 'aujourd', 'ce jour', 'jour'],
        '7': ['semaine', '7 jours', 'sept jours', 'cette semaine', 'ces jours'],
        '30': ['mois', 'ce mois', '30 jours', 'trente jours', 'mensuel'],
        '365': ['année', 'an', '365 jours', 'ce an', 'cette année', 'annee', 'cette annee'],
        'all': ['tout', 'toutes', 'all', 'tous', 'total', 'général', 'general']
    };
    for (var period in periodKeywords) {
        if (periodKeywords[period].some(function(kw) { return cleaned.includes(kw); })) {
            return period;
        }
    }
    return null;
}

// 🔥 NOUVEAU : Détection de filtre de catégorie (pour page Produits)
function detectCategoryFilter(transcript) {
    if (!window.allCategoriesData || !Array.isArray(window.allCategoriesData)) return null;
    var cleaned = transcript.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (var i = 0; i < window.allCategoriesData.length; i++) {
        var catName = (window.allCategoriesData[i].nom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (catName && cleaned.includes(catName)) {
            return window.allCategoriesData[i].nom;
        }
    }
    return null;
}

// ========== PARSE VOICE COMMAND ==========
function parseVoiceCommand(transcript) {
    var cleaned = transcript.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var currentPage = document.getElementById('pageTitle')?.textContent || '';
    var posStep = window.posStep || 1;

    console.log('🔍 Parsing commande:', cleaned);
    console.log('📄 Page actuelle:', currentPage);
    console.log('📌 PosStep:', posStep);
    console.log('🔢 En attente de quantité:', waitingForQuantity, 'Produit:', pendingProductForQuantity);

    // ============================================================
    // 🔥 PRIORITÉ ABSOLUE : MODE QUANTITÉ
    // ============================================================
    
    if (waitingForQuantity && pendingProductForQuantity) {
        var num = extractNumberFromTranscript(cleaned);
        if (num !== null && num > 0) {
            console.log('✅ [PRIORITÉ] Quantité détectée:', num, 'pour produit:', pendingProductForQuantity);
            return { 
                type: 'quantity', 
                value: num, 
                productId: pendingProductForQuantity 
            };
        }
        
        var newProducts = fastFindProduct(cleaned);
        if (newProducts.length > 0 && newProducts[0].id !== pendingProductForQuantity) {
            console.log('🔄 [PRIORITÉ] Nouveau produit détecté, on abandonne la quantité en cours');
            waitingForQuantity = false;
            pendingProductForQuantity = null;
            setVoiceMode('search', '🎤 Recherche vocale active', null);
        } else if (cleaned.length > 0 && !cleaned.includes('annule') && !cleaned.includes('cancel')) {
            console.log('🔄 [PRIORITÉ] Pas un nombre ni un produit connu, on abandonne la quantité');
            waitingForQuantity = false;
            pendingProductForQuantity = null;
            setVoiceMode('search', '🎤 Recherche vocale active', null);
        }
    }

    // ============================================================
    // 🔥 NOUVEAU : PAGE PRODUITS - recherche produit ou filtre catégorie
    // ============================================================
    if (currentPage === 'Produits') {
        // Chercher d'abord si c'est une catégorie
        var catFilter = detectCategoryFilter(cleaned);
        if (catFilter) {
            console.log('✅ [PRODUITS] Catégorie détectée:', catFilter);
            return { type: 'filter_products_category', category: catFilter };
        }
        // Sinon recherche produit
        if (cleaned.length > 1) {
            return { type: 'search_products_page', text: cleaned };
        }
        return { type: 'ignore' };
    }

    // ============================================================
    // 🔥 NOUVEAU : PAGE VENTES - recherche client ou filtre période
    // ============================================================
    if (currentPage === 'Ventes') {
        var periodV = detectPeriodFilter(cleaned);
        if (periodV !== null) {
            console.log('✅ [VENTES] Période détectée:', periodV);
            return { type: 'period_filter_ventes', period: periodV };
        }
        if (cleaned.length > 1) {
            return { type: 'search_ventes', text: cleaned };
        }
        return { type: 'ignore' };
    }

    // ============================================================
    // 🔥 PAGE CRÉDITS - recherche client ou filtre période
    // ============================================================
    if (currentPage === 'Crédits') {
        var periodC = detectPeriodFilter(cleaned);
        if (periodC !== null) {
            console.log('✅ [CRÉDITS] Période détectée:', periodC);
            return { type: 'period_filter_credits', period: periodC };
        }
        if (cleaned.length > 1) {
            return { type: 'search_credits', text: cleaned };
        }
        return { type: 'ignore' };
    }

    // ============================================================
    // PRIORITÉ 1 : NAVIGATION (TOUTES LES PAGES)
    // 🔥 Ne pas activer en étape 2 (paiement)
    // 🔥 Retourner les noms ANGLAIS pour matcher admin.js
    // ============================================================
    
    if (posStep !== 2) {
        var navWords = {
            'pos': ['pos', 'caisse', 'point de vente', 'vente directe', 'retour pos', 'aller pos', 'ouvrir pos', 'lancer pos', 'caissier'],
            'credits': ['credits', 'credit', 'crédit', 'impayes', 'impaye', 'dettes', 'dette', 'creance', 'creances', 'liste credits', 'liste crédits', 'voir credits'],
            'ventes': ['ventes', 'vente', 'recettes', 'recette', 'chiffre', 'liste ventes', 'voir ventes'],
            'dashboard': ['dashboard', 'accueil', 'tableau de bord', 'tableau', 'bord', 'home', 'acceuil'],
            'clients': ['clients', 'client', 'cliente', 'clientel', 'liste clients', 'voir clients'],
            'commandes': ['commandes', 'commande', 'en ligne', 'online', 'liste commandes', 'voir commandes'],
            'depenses': ['dépenses', 'depenses', 'dépense', 'charges', 'charge', 'liste depenses', 'voir depenses'],
            'statistiques': ['statistiques', 'stat', 'stats', 'analyses', 'analyse', 'voir statistiques'],
            'products': ['produits', 'produit', 'catalogue', 'stock', 'marchandise', 'liste produits', 'voir produits'],
            'fournisseurs': ['fournisseurs', 'fournisseur', 'fournitures', 'liste fournisseurs', 'voir fournisseurs'],
            'categories': ['categories', 'categorie', 'categoriel', 'cat', 'liste categories', 'voir categories', 'catégorie', 'catégories']
        };

        for (var page in navWords) {
            var keywords = navWords[page];
            for (var i = 0; i < keywords.length; i++) {
                if (cleaned.includes(keywords[i])) {
                    console.log('✅ Navigation détectée vers:', page);
                    waitingForQuantity = false;
                    pendingProductForQuantity = null;
                    setVoiceMode('search', '🎤 Recherche vocale active', null);
                    return { type: 'navigate', page: page };
                }
            }
        }
    }

    // ============================================================
    // PRIORITÉ 2 : DÉTECTION DES PÉRIODES (fallback général)
    // ============================================================
    
    var period = detectPeriodFilter(cleaned);
    if (period !== null) {
        console.log('✅ Période détectée:', period);
        return { type: 'period_filter', period: period };
    }

    // ============================================================
    // PRIORITÉ 4 : RECHERCHE DE PRODUITS (étape 1 POS)
    // ============================================================
    
    if (posStep === 1 && (currentPage === 'POS' || currentPage === 'Dashboard' || currentPage === '')) {
        
        if (cleaned.includes('valide') || cleaned.includes('valider') || 
            cleaned.includes('payer') || cleaned.includes('paie')) {
            waitingForQuantity = false;
            pendingProductForQuantity = null;
            return { type: 'validate' };
        }
        
        if (cleaned.includes('annule') || cleaned.includes('annuler') || cleaned.includes('cancel')) {
            waitingForQuantity = false;
            pendingProductForQuantity = null;
            setVoiceMode('search', '🎤 Recherche vocale active', null);
            return { type: 'cancel' };
        }
        
        if (cleaned.includes('vider') || cleaned.includes('efface') || 
            cleaned.includes('vide') || cleaned.includes('clear')) {
            waitingForQuantity = false;
            pendingProductForQuantity = null;
            return { type: 'clear' };
        }
        
        var products = fastFindProduct(cleaned);
        if (products.length > 0) {
            console.log('✅ Produit trouvé:', products[0].nom);
            return { 
                type: 'search_product', 
                product: products[0], 
                products: products, 
                text: cleaned, 
                page: 'pos' 
            };
        }
        
        if (cleaned.length > 1) {
            return { type: 'search_text', text: cleaned, page: 'pos' };
        }
    }

    // ============================================================
    // 🔥 PRIORITÉ 5 : PAIEMENT (étape 2)
    // ============================================================
    
    if ((currentPage === 'POS' || currentPage === 'Dashboard') && posStep === 2) {
        
        var clientAlreadySelected = window.posCurrentClient && window.posCurrentClient.id;
        
        if (!clientAlreadySelected) {
            var clients = fastFindClient(cleaned);
            if (clients.length >= 1) {
                var client = clients[0];
                console.log('✅ [PAIEMENT] Client trouvé:', client.nom, client.prenom);
                return { type: 'client', client: client, searchText: cleaned };
            }
            console.log('⚠️ [PAIEMENT] Aucun client trouvé, on attend un nom de client');
            return { type: 'ignore' };
        }
        
        var pm = detectPaymentMode(cleaned);
        if (pm) {
            console.log('✅ [PAIEMENT] Mode paiement détecté:', pm);
            return { type: 'payment_mode', mode: pm };
        }
        
        if (cleaned.includes('valide') || cleaned.includes('finaliser') || 
            cleaned.includes('terminer') || cleaned.includes('payer')) {
            return { type: 'validate' };
        }
        
        var amount = extractNumberFromTranscript(cleaned);
        if (amount !== null && amount > 0) {
            console.log('✅ [PAIEMENT] Montant détecté:', amount);
            return { type: 'number', value: amount };
        }
    }

    console.log('⚠️ Commande ignorée:', cleaned);
    return { type: 'ignore' };
}

function detectPaymentMode(transcript) {
    var t = transcript.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (var mode in paymentKeywords) {
        if (paymentKeywords[mode].some(function(kw) { return t.indexOf(kw) !== -1; })) {
            return mode;
        }
    }
    return null;
}

// ========== HANDLE COMMAND ==========
function handleVoiceCommand(cmd) {
    console.log('🎯 Exécution commande:', cmd.type, cmd);

    switch (cmd.type) {
        case 'search_product':
        case 'search_text':
            var dictedText = cmd.text || (cmd.product ? cmd.product.nom : '');
            console.log('🔍 Texte dicté:', dictedText);
            
            var searchInput = document.getElementById('posSearchInput');
            if (!searchInput) {
                searchInput = document.querySelector('#posSearchInput, input[type="text"][placeholder*="Rechercher"], input[placeholder*="Rechercher"]');
            }
            
            if (searchInput && dictedText) {
                searchInput.value = dictedText;
                window.posSearchQuery = dictedText.toLowerCase().trim();
                
                try {
                    var inputEvent = new InputEvent('input', { bubbles: true, cancelable: true });
                    searchInput.dispatchEvent(inputEvent);
                } catch(e) {
                    var event = new Event('input', { bubbles: true });
                    searchInput.dispatchEvent(event);
                }
                
                if (typeof window.posSearchProducts === 'function') {
                    console.log('✅ Lancement recherche pour:', dictedText);
                    window.posSearchProducts(dictedText);
                } else if (typeof window.filterProductGrid === 'function') {
                    window.filterProductGrid();
                }
                
                if (typeof window.updateClearButtonVisibility === 'function') {
                    window.updateClearButtonVisibility();
                }
                
                showVoiceResult('🔍 ' + dictedText);
                showVoiceFlowIndicator('product');
            }
            break;
            
        case 'quantity':
            var productId = cmd.productId;
            var quantity = cmd.value;
            
            console.log('🔢 Application quantité:', quantity, 'pour produit:', productId);
            console.log('📦 posCart actuel:', window.posCart);
            
            if (productId && quantity > 0) {
                var cartItem = null;
                if (window.posCart && Array.isArray(window.posCart)) {
                    cartItem = window.posCart.find(function(x) { return x.id === productId; });
                }
                
                if (cartItem) {
                    var product = window.posProductsList?.find(function(p) { return p.id === productId; });
                    if (product && product.stock !== undefined && quantity > product.stock) {
                        showVoiceResult('⚠️ Stock insuffisant (max: ' + product.stock + ')');
                        waitingForQuantity = false;
                        pendingProductForQuantity = null;
                        setVoiceMode('search', '🎤 Recherche vocale active', null);
                        return;
                    }
                    
                    cartItem.quantite = quantity;
                    console.log('✅ Quantité appliquée:', cartItem.quantite);
                    
                    if (typeof window.updateCartOnly === 'function') {
                        window.updateCartOnly();
                    }
                    if (typeof window.renderPOS === 'function') {
                        window.renderPOS();
                    }
                    if (typeof window.posSauvegarderDonneesPanier === 'function') {
                        window.posSauvegarderDonneesPanier(window.posCurrentCartId || 'panier1');
                    }
                    if (typeof window.posSaveMultiCarts === 'function') {
                        window.posSaveMultiCarts();
                    }
                    
                    showVoiceResult('✅ Quantité mise à jour: ' + quantity);
                } else {
                    console.warn('⚠️ Produit introuvable dans le panier:', productId);
                    showVoiceResult('⚠️ Produit non trouvé dans le panier');
                }
                
                waitingForQuantity = false;
                pendingProductForQuantity = null;
                setVoiceMode('search', '🎤 Recherche vocale active', null);
                
                var searchInput = document.getElementById('posSearchInput');
                if (searchInput) {
                    searchInput.value = '';
                    window.posSearchQuery = '';
                    if (typeof window.updateClearButtonVisibility === 'function') {
                        window.updateClearButtonVisibility();
                    }
                }
                if (typeof window.posViewMode !== 'undefined') {
                    window.posViewMode = 'categories';
                }
                if (typeof window.posSelectedCategoryForView !== 'undefined') {
                    window.posSelectedCategoryForView = null;
                }
                if (typeof window.retournerCategories === 'function') {
                    window.retournerCategories();
                } else if (typeof window.filterProductGrid === 'function') {
                    window.filterProductGrid();
                }
            }
            break;
            
        // 🔥 NOUVEAU : Recherche sur page Produits
        case 'search_products_page':
            var searchTextP = cmd.text || '';
            console.log('🔍 [PRODUITS] Recherche:', searchTextP);
            var prodInput = document.getElementById('productSearchInput');
            if (prodInput) {
                prodInput.value = searchTextP;
                if (typeof window.renderProductsTable === 'function') {
                    window.productSearchQuery = searchTextP.toLowerCase().trim();
                    window.currentPages = window.currentPages || {};
                    window.currentPages.products = 1;
                    window.renderProductsTable();
                }
                showVoiceResult('🔍 ' + searchTextP);
            } else {
                showVoiceResult('⚠️ Barre de recherche produits non trouvée');
            }
            break;
            
        // 🔥 NOUVEAU : Filtre catégorie sur page Produits
        case 'filter_products_category':
            var catName = cmd.category || '';
            console.log('📂 [PRODUITS] Filtre catégorie:', catName);
            var catSelect = document.getElementById('categoryFilter');
            if (catSelect) {
                catSelect.value = catName;
                if (typeof window.filterProducts === 'function') {
                    window.filterProducts();
                }
                showVoiceResult('📂 ' + catName);
            } else {
                showVoiceResult('⚠️ Sélecteur de catégorie non trouvé');
            }
            break;
            
        // 🔥 NOUVEAU : Recherche sur page Ventes
        case 'search_ventes':
            var searchTextV = cmd.text || '';
            console.log('🔍 [VENTES] Recherche:', searchTextV);
            var ventesInput = document.getElementById('ventesSearchInput');
            if (ventesInput) {
                ventesInput.value = searchTextV;
                if (typeof window.renderVentesTable === 'function') {
                    window.ventesSearch = searchTextV;
                    window.currentPages = window.currentPages || {};
                    window.currentPages.ventes = 1;
                    window.renderVentesTable();
                }
                showVoiceResult('🔍 ' + searchTextV);
            } else {
                showVoiceResult('⚠️ Barre de recherche ventes non trouvée');
            }
            break;
            
        // 🔥 NOUVEAU : Filtre période sur page Ventes
        case 'period_filter_ventes':
            var periodV = cmd.period || 'all';
            console.log('📅 [VENTES] Filtre période:', periodV);
            var periodSelectV = document.getElementById('ventesPeriodSelect');
            if (periodSelectV) {
                periodSelectV.value = periodV;
                try {
                    var evV = new Event('change', { bubbles: true });
                    periodSelectV.dispatchEvent(evV);
                } catch(e) {
                    if (typeof periodSelectV.onchange === 'function') {
                        periodSelectV.onchange();
                    }
                }
                if (typeof window.renderVentesTable === 'function') {
                    window.ventesPeriod = periodV;
                    window.renderVentesTable();
                }
                var labelsV = {
                    'today': "📅 Aujourd'hui",
                    '7': '📅 7 jours',
                    '30': '📅 30 jours',
                    '365': '📅 1 an',
                    'all': '📅 Toutes les dates'
                };
                showVoiceResult(labelsV[periodV] || '📅 Filtre appliqué');
            } else {
                showVoiceResult('⚠️ Sélecteur période ventes non trouvé');
            }
            break;
            
        // 🔥 NOUVEAU : Filtre période sur page Crédits
        case 'period_filter_credits':
            var periodC = cmd.period || 'all';
            console.log('📅 [CRÉDITS] Filtre période:', periodC);
            var periodSelectC = document.getElementById('creditsPeriodSelect');
            if (periodSelectC) {
                periodSelectC.value = periodC;
                try {
                    var evC = new Event('change', { bubbles: true });
                    periodSelectC.dispatchEvent(evC);
                } catch(e) {
                    if (typeof periodSelectC.onchange === 'function') {
                        periodSelectC.onchange();
                    }
                }
                if (typeof window.applyCreditsFilters === 'function') {
                    window.creditsPeriod = periodC;
                    window.applyCreditsFilters();
                }
                var labelsC = {
                    'today': "📅 Aujourd'hui",
                    '7': '📅 7 jours',
                    '30': '📅 30 jours',
                    '365': '📅 1 an',
                    'all': '📅 Toutes les dates'
                };
                showVoiceResult(labelsC[periodC] || '📅 Filtre appliqué');
            } else {
                showVoiceResult('⚠️ Sélecteur période crédits non trouvé');
            }
            break;
            
        case 'search_credits':
            var searchText = cmd.text || '';
            var creditsInput = document.getElementById('creditsSearchInput');
            if (creditsInput) {
                creditsInput.value = searchText;
                window.creditsSearch = searchText;
                if (typeof window.applyCreditsFilters === 'function') {
                    window.applyCreditsFilters();
                }
                showVoiceResult('🔍 ' + searchText);
            }
            break;
            
        case 'client':
            console.log('👤 Sélection client:', cmd.client);
            
            window.posCurrentClient = { 
                id: cmd.client.id, 
                name: (cmd.client.nom || '') + ' ' + (cmd.client.prenom || '')
            };
            
            var ci = document.getElementById('posClientSearchInput');
            if (ci) {
                ci.value = window.posCurrentClient.name;
                try {
                    var ev = new Event('input', { bubbles: true });
                    ci.dispatchEvent(ev);
                } catch(e) {}
            }
            
            var dropdown = document.getElementById('posClientDropdown');
            if (dropdown) dropdown.style.display = 'none';
            
            if (typeof window.updateClientCreditDisplay === 'function') {
                window.updateClientCreditDisplay(cmd.client.id);
            }
            if (typeof window.updatePaymentButtons === 'function') {
                window.updatePaymentButtons();
            }
            if (typeof window.renderPOS === 'function') {
                window.renderPOS();
            }
            
            var displayName = window.posCurrentClient.name;
            if (cmd.client.description) {
                displayName += ' (' + cmd.client.description + ')';
            }
            showVoiceResult('👤 ' + displayName);
            
            if (window.posStep === 1 && typeof window.posGoToStep2 === 'function') {
                setTimeout(function() {
                    window.posGoToStep2();
                }, 300);
            }
            break;
            
        case 'payment_mode':
            if (typeof window.posSetPaymentMethod === 'function') {
                window.posSetPaymentMethod(cmd.mode);
                showVoiceResult('💳 ' + cmd.mode);
                if (typeof window.renderPOS === 'function') {
                    setTimeout(function() { window.renderPOS(); }, 200);
                }
            }
            break;
            
        case 'number':
            var ai = document.getElementById('posAmountGiven');
            if (ai) {
                ai.value = cmd.value;
                window.posAmountGiven = cmd.value;
                if (typeof window.posCalculateChange === 'function') {
                    window.posCalculateChange();
                }
                showVoiceResult('💰 ' + cmd.value + ' MAD');
            }
            break;
            
        case 'validate':
        case 'finalize':
            waitingForQuantity = false;
            pendingProductForQuantity = null;
            if (window.posStep === 2 && typeof window.posFinalizeSale === 'function') {
                window.posFinalizeSale();
            } else if (window.posCart?.length > 0 && window.posStep === 1) {
                if (typeof window.posGoToStep2 === 'function') {
                    window.posGoToStep2();
                }
            }
            break;
            
        case 'clear':
            waitingForQuantity = false;
            pendingProductForQuantity = null;
            setVoiceMode('search', '🎤 Recherche vocale active', null);
            if (typeof window.posResetCart === 'function') {
                window.posResetCart();
                showVoiceResult('🗑️ Panier vidé');
                if (typeof window.renderPOS === 'function') {
                    setTimeout(function() { window.renderPOS(); }, 200);
                }
            }
            break;
            
        case 'cancel':
            waitingForQuantity = false;
            pendingProductForQuantity = null;
            setVoiceMode('search', '🎤 Recherche vocale active', null);
            if (typeof window.renderPOS === 'function') {
                window.renderPOS();
            }
            showVoiceResult('↩️ Annulé');
            break;
            
        case 'navigate':
            console.log('📍 Navigation vers:', cmd.page);
            waitingForQuantity = false;
            pendingProductForQuantity = null;
            setVoiceMode('search', '🎤 Recherche vocale active', null);
            
            if (cmd.page === 'pos') {
                if (typeof navigateTo === 'function') {
                    navigateTo('pos');
                    setTimeout(function() {
                        showVoiceResult('🛒 POS ouvert');
                    }, 500);
                } else {
                    showVoiceResult('❌ Navigation non disponible');
                }
            } else if (typeof navigateTo === 'function') {
                navigateTo(cmd.page);
                var pageLabels = {
                    'credits': '📋 Crédits',
                    'ventes': '💰 Ventes',
                    'dashboard': '📊 Dashboard',
                    'clients': '👤 Clients',
                    'commandes': '🛒 Commandes',
                    'depenses': '💸 Dépenses',
                    'statistiques': '📈 Statistiques',
                    'products': '📦 Produits',
                    'fournisseurs': '🚚 Fournisseurs',
                    'categories': '📂 Catégories',
                    'pos': '🛒 POS'
                };
                showVoiceResult('📍 ' + (pageLabels[cmd.page] || cmd.page));
            } else {
                showVoiceResult('⚠️ Navigation non disponible');
            }
            break;
            
        case 'period_filter':
            console.log('📅 Filtre période:', cmd.period);
            var periodSelect = document.getElementById('periodSelect') || 
                               document.getElementById('globalPeriodSelect') ||
                               document.getElementById('ventesPeriodSelect') ||
                               document.getElementById('creditsPeriodSelect') ||
                               document.getElementById('commandesPeriodSelect') ||
                               document.querySelector('select[onchange*="Period"]');
            if (periodSelect) {
                periodSelect.value = cmd.period;
                try {
                    var changeEvent = new Event('change', { bubbles: true });
                    periodSelect.dispatchEvent(changeEvent);
                } catch(e) {
                    if (typeof periodSelect.onchange === 'function') {
                        periodSelect.onchange();
                    }
                }
                var labels = {
                    'today': "📅 Aujourd'hui",
                    '7': '📅 7 jours',
                    '30': '📅 30 jours',
                    '365': '📅 1 an',
                    'all': '📅 Toutes les dates'
                };
                showVoiceResult(labels[cmd.period] || '📅 Filtre appliqué');
            } else {
                showVoiceResult('⚠️ Sélecteur de période non trouvé');
            }
            break;
            
        default:
            console.log('⚠️ Commande non reconnue:', cmd);
            showVoiceResult('❓ Commande non reconnue');
            break;
    }
}

// ========== SET VOCAL MODE ==========
function setVoiceMode(mode, msg, productId) {
    voiceMode = mode;
    if (msg) voiceModeMessage = msg;
    if (productId !== undefined) {
        lastAddedProductId = productId;
        if (mode === 'quantity') {
            pendingProductForQuantity = productId;
            waitingForQuantity = true;
        }
    }
    if (mode === 'payment') {
        window.voicePaymentState = 0;
        waitingForQuantity = false;
        pendingProductForQuantity = null;
        window.waitingForQuantity = false;
        window.pendingProductForQuantity = null;
    }
    showVoiceModeIndicator();
    console.log('🎤 Mode vocal changé:', mode, msg);
}

// ========== MICRO ==========
function posToggleVoiceSearch() {
    console.log('🎤 posToggleVoiceSearch appelé');
    var s = checkVoiceSupport();
    if (!s.supported) { alert('⚠️ ' + s.reason); return; }
    if (!navigator.onLine) { alert('⚠️ Connexion internet requise.'); return; }
    if (isRecording) { posStopVoiceSearch(); return; }

    var toolsContainer = document.getElementById('posToolsContainer');
    var searchInput = document.getElementById('posSearchInput');
    var toggleBtn = document.getElementById('posToggleToolsBtn');
    
    if (toolsContainer && toolsContainer.style.display === 'none') {
        toolsContainer.style.display = 'flex';
        toolsContainer.style.flexDirection = 'column';
        toolsContainer.style.gap = '10px';
        toolsContainer.style.marginBottom = '10px';
        toolsContainer.style.padding = '12px 16px';
        toolsContainer.style.background = 'var(--bg-card)';
        toolsContainer.style.borderRadius = '12px';
        toolsContainer.style.border = '1px solid var(--border)';
        toolsContainer.classList.add('visible');
    }
    
    if (searchInput) {
        searchInput.style.display = 'flex';
    }
    
    var micBtn = document.getElementById('posMicBtn');
    if (micBtn) {
        micBtn.style.display = 'flex';
    }
    
    if (toggleBtn) {
        toggleBtn.innerHTML = '✕ Masquer tout';
        toggleBtn.style.background = '#ef4444';
    }
    
    if (typeof window.posToolsVisible !== 'undefined') {
        window.posToolsVisible = true;
    }

    requestMicrophonePermission().then(function(p) {
        if (!p) { alert('❌ Micro refusé.'); return; }
        posStartVoiceRecording();
    });
}

function posStartVoiceRecording() {
    console.log('🎤 Démarrage enregistrement vocal...');
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
        mb.innerHTML = '<i class="fas fa-circle" style="color:#ef4444;animation:pulse 0.5s ease-in-out infinite;"></i>';
        mb.style.background = '#fee2e2';
        mb.style.borderColor = '#ef4444';
    }

    var lastInterim = '';
    var lastFinal = '';
    var lastCommandTime = 0;

    voiceRecognition.onresult = function(e) {
        var interim = '', final = '';
        for (var i = e.resultIndex; i < e.results.length; i++) {
            var t = e.results[i][0].transcript;
            if (e.results[i].isFinal) final += t;
            else interim += t;
        }
        
        console.log('🎤 Résultat vocal - Interim:', interim, 'Final:', final);
        console.log('🔢 Mode quantité actif ?', waitingForQuantity, 'Produit en attente:', pendingProductForQuantity);

        // 🔥 PRIORITÉ ABSOLUE : SI ON ATTEND UNE QUANTITÉ (uniquement sur POS)
        if (waitingForQuantity && pendingProductForQuantity) {
            if (final && final.trim().length > 0) {
                var num = extractNumberFromTranscript(final);
                
                if (num !== null && num > 0) {
                    console.log('✅ [QUANTITÉ] Nombre détecté:', num, 'dans:', final);
                    handleVoiceCommand({ 
                        type: 'quantity', 
                        value: num, 
                        productId: pendingProductForQuantity 
                    });
                    return;
                }
                
                console.log('🔄 [QUANTITÉ] Pas un nombre, on abandonne la quantité et on cherche un produit:', final);
                waitingForQuantity = false;
                pendingProductForQuantity = null;
                setVoiceMode('search', '🎤 Recherche vocale active', null);
                
                var searchInputForce = document.getElementById('posSearchInput');
                if (searchInputForce) {
                    searchInputForce.value = final;
                    window.posSearchQuery = final.toLowerCase().trim();
                    try {
                        var inputEventForce = new InputEvent('input', { bubbles: true, cancelable: true });
                        searchInputForce.dispatchEvent(inputEventForce);
                    } catch(e) {
                        var eventForce = new Event('input', { bubbles: true });
                        searchInputForce.dispatchEvent(eventForce);
                    }
                    if (typeof window.posSearchProducts === 'function') {
                        window.posSearchProducts(final);
                    } else if (typeof window.filterProductGrid === 'function') {
                        window.filterProductGrid();
                    }
                    if (typeof window.updateClearButtonVisibility === 'function') {
                        window.updateClearButtonVisibility();
                    }
                }
                showVoiceResult('🔍 ' + final);
                return;
            } else {
                console.log('⏳ [QUANTITÉ] Interim ignoré, en attente du final. Interim:', interim);
                return;
            }
        }

        // 🔥 VÉRIFIER LA NAVIGATION ET COMMANDES SPÉCIALES
        if (final && final.trim().length > 0 && final !== lastFinal) {
            lastFinal = final;
            var navCheck = parseVoiceCommand(final);
            console.log('🚦 navCheck résultat:', navCheck ? navCheck.type : 'null', navCheck);
            if (navCheck && navCheck.type !== 'ignore' && navCheck.type !== 'search_text') {
                console.log('🎯 Commande détectée dans navCheck:', navCheck.type);
                handleVoiceCommand(navCheck);
                return;
            }
        }

        // ============================================================
        // 🔥 NOUVELLE LOGIQUE : gérer les pages spéciales AVANT le reste
        // ============================================================
        var cp = document.getElementById('pageTitle')?.textContent || '';

        // ----- PAGE PRODUITS -----
        if (cp === 'Produits') {
            if (final && final.trim().length > 0 && final !== lastFinal) {
                lastFinal = final;
                var cmdP = parseVoiceCommand(final);
                console.log('📄 [PRODUITS] Commande:', cmdP.type);
                if (cmdP && cmdP.type !== 'ignore') {
                    handleVoiceCommand(cmdP);
                }
            }
            return;
        }

        // ----- PAGE VENTES -----
        if (cp === 'Ventes') {
            if (final && final.trim().length > 0 && final !== lastFinal) {
                lastFinal = final;
                var cmdV = parseVoiceCommand(final);
                console.log('💰 [VENTES] Commande:', cmdV.type);
                if (cmdV && cmdV.type !== 'ignore') {
                    handleVoiceCommand(cmdV);
                }
            }
            return;
        }

        // ----- PAGE CRÉDITS -----
        if (cp === 'Crédits') {
            if (final && final.trim().length > 0 && final !== lastFinal) {
                lastFinal = final;
                var cmdC = parseVoiceCommand(final);
                console.log('💳 [CRÉDITS] Commande:', cmdC.type);
                if (cmdC && cmdC.type !== 'ignore') {
                    handleVoiceCommand(cmdC);
                }
            } else if (interim) {
                var siC = document.getElementById('creditsSearchInput');
                if (siC) siC.value = interim;
                var vdC = document.getElementById('creditsVoiceDisplay');
                if (vdC) vdC.value = interim;
            }
            return;
        }

        // ✅ PAGE POS / DASHBOARD (par défaut)
        if (final && final.trim().length > 0 && final !== lastFinal) {
            lastFinal = final;
            console.log('✅ TEXTE FINAL DÉTECTÉ:', final);

            var cmd = parseVoiceCommand(final);
            if (cmd && cmd.type !== 'ignore') {
                var now = Date.now();
                if (now - lastCommandTime > 1500 || 
                    cmd.type === 'search_product' || 
                    cmd.type === 'search_text' ||
                    cmd.type === 'quantity' ||
                    cmd.type === 'client' ||
                    cmd.type === 'payment_mode' ||
                    cmd.type === 'number' ||
                    cmd.type === 'validate' ||
                    cmd.type === 'navigate') {
                    lastCommandTime = now;
                    handleVoiceCommand(cmd);
                }
                return;
            }

            // Fallback: recherche simple avec le texte dicté
            setTimeout(function() {
                var si = document.getElementById('posSearchInput');
                if (!si) {
                    si = document.querySelector('#posSearchInput, input[type="text"][placeholder*="Rechercher"], input[placeholder*="Rechercher"]');
                }
                if (si && final.trim().length > 1) {
                    window.posSearchQuery = final.toLowerCase().trim();
                    si.value = final;
                    try {
                        var inputEvent = new InputEvent('input', { bubbles: true, cancelable: true });
                        si.dispatchEvent(inputEvent);
                    } catch(e) {
                        var event = new Event('input', { bubbles: true });
                        si.dispatchEvent(event);
                    }
                    if (typeof window.posSearchProducts === 'function') {
                        window.posSearchProducts(final);
                    } else if (typeof window.filterProductGrid === 'function') {
                        window.filterProductGrid();
                    }
                    if (typeof window.updateClearButtonVisibility === 'function') {
                        window.updateClearButtonVisibility();
                    }
                    showVoiceResult('🔍 ' + final);
                }
            }, 200);
            
        } else if (interim && interim !== lastInterim) {
            if (waitingForQuantity && pendingProductForQuantity) {
                return;
            }
            
            console.log('✍️ Interim:', interim);
            var si = document.getElementById('posSearchInput');
            if (si) {
                si.value = interim;
                lastInterim = interim;
                
                window.posSearchQuery = interim.toLowerCase().trim();
                
                try {
                    var inputEvent = new InputEvent('input', { bubbles: true, cancelable: true });
                    si.dispatchEvent(inputEvent);
                } catch(e) {
                    var event = new Event('input', { bubbles: true });
                    si.dispatchEvent(event);
                }
                
                if (typeof window.posSearchProducts === 'function') {
                    window.posSearchProducts(interim);
                } else if (typeof window.filterProductGrid === 'function') {
                    window.filterProductGrid();
                }
                
                if (typeof window.updateClearButtonVisibility === 'function') {
                    window.updateClearButtonVisibility();
                }
            }
        }
    };

    voiceRecognition.onend = function() {
        console.log('🛑 Reconnaissance terminée');
        if (isRecording) {
            setTimeout(function() {
                try { voiceRecognition.start(); } catch (e) { posStopVoiceSearch(); }
            }, 8);
        }
    };
    voiceRecognition.onerror = function(e) {
        console.error('❌ Erreur reconnaissance:', e.error);
        if (e.error === 'aborted' || e.error === 'no-speech') return;
        if (e.error === 'network') showVoiceResult('❌ Réseau');
        posStopVoiceSearch();
    };

    try {
        voiceRecognition.start();
        isRecording = true;
        showVoiceModeIndicator();
        showVoiceResult('🎤 Écoute...');
    } catch (e) {
        console.error('❌ Erreur démarrage:', e);
        isRecording = false;
        if (mb) {
            mb.innerHTML = '<i class="fas fa-microphone"></i>';
            mb.style.background = '#dcfce7';
            mb.style.borderColor = '#16a34a';
        }
    }
}

function posStopVoiceSearch() {
    if (voiceRecognition) { try { voiceRecognition.abort(); } catch (e) {} voiceRecognition = null; }
    isRecording = false;
    waitingForQuantity = false;
    pendingProductForQuantity = null;
    setVoiceMode('search', '🎤 Recherche vocale active', null);
    var mb = document.getElementById('posMicBtn');
    if (mb) {
        mb.innerHTML = '<i class="fas fa-microphone"></i>';
        mb.style.background = '#dcfce7';
        mb.style.borderColor = '#16a34a';
    }
    hideVoiceFlowIndicator();
    showVoiceResult('🎤 Micro désactivé');
}

// ========== EXPORTS ==========
window.posToggleVoiceSearch = posToggleVoiceSearch;
window.posAudioToggleVoiceSearch = posToggleVoiceSearch;
window.showVoiceResult = showVoiceResult;
window.setVoiceMode = setVoiceMode;
window.showVoiceModeIndicator = showVoiceModeIndicator;
window.parseVoiceCommand = parseVoiceCommand;
window.handleVoiceCommand = handleVoiceCommand;
window.invalidateClientIndex = invalidateClientIndex;
window.showVoiceFlowIndicator = showVoiceFlowIndicator;
window.hideVoiceFlowIndicator = hideVoiceFlowIndicator;
window.showProcessingIndicator = showProcessingIndicator;
window.pendingProductForQuantity = pendingProductForQuantity;
window.waitingForQuantity = waitingForQuantity;
window.onProductAdded = function(pid) {
    lastAddedProductId = pid;
    pendingProductForQuantity = pid;
    waitingForQuantity = true;
    setVoiceMode('quantity', '🔢 Dites la quantité', pid);
    showVoiceResult('🔢 Dites la quantité');
};
window.buildClientIndex = buildClientIndex;
window.buildProductIndex = buildProductIndex;
window.fastFindProduct = fastFindProduct;
window.posStopVoiceSearch = posStopVoiceSearch;

// 🔥 CORRECTION : Fonction pour réinitialiser le mode quantité depuis pos.js
window.resetVoiceQuantityMode = function() {
    waitingForQuantity = false;
    pendingProductForQuantity = null;
    window.waitingForQuantity = false;
    window.pendingProductForQuantity = null;
    console.log('🔄 Mode quantité réinitialisé');
};

// ✅ GARANTIR que closeCreditSelection existe
if (typeof window.closeCreditSelection !== 'function') {
    window.closeCreditSelection = function() {
        window.creditSelectionMode = false;
        window.creditSelectedIds = [];
        if (typeof renderCreditsTablePro === 'function') {
            renderCreditsTablePro();
        }
    };
}

console.log('🎤 Module vocal v27 – QUANTITÉ PRIORITAIRE + RECHERCHE MULTI-PAGES');
console.log('✅ Recherche vocale sur POS (produits + quantité)');
console.log('✅ Recherche vocale sur page Produits (nom + catégorie)');
console.log('✅ Recherche vocale sur page Ventes (client + période)');
console.log('✅ Recherche vocale sur page Crédits (client + période)');
console.log('✅ Navigation utilise les noms ANGLAIS pour matcher admin.js');
