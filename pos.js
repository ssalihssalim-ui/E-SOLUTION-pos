// ==================== FILTER PRODUCT GRID ====================
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

// ✅ 4 colonnes mobile / 5 colonnes PC
var isMobile = window.innerWidth < 700;
var gridCols = isMobile ? 'repeat(4, 1fr)' : 'repeat(5, 1fr)';
grid.style.gridTemplateColumns = gridCols;
grid.style.overflowX = 'auto';
grid.style.flexWrap = 'wrap';
grid.style.gap = isMobile ? '6px' : '12px';
grid.style.padding = isMobile ? '4px' : '10px';
grid.style.justifyContent = 'center';

var html='';

// ✅ BANDEAU RETOUR
html += '<div style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;margin-bottom:10px;background:#ffffff;border-radius:12px;border:2px solid #e2e8f0;flex-wrap:wrap;gap:8px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">';

html += '<div style="display:flex;align-items:center;gap:8px;">';
html += '<button onclick="retournerCategories()" style="display:flex;align-items:center;gap:6px;background:#111827;color:#ffffff;border:none;border-radius:8px;padding:8px 16px;font-size:0.85rem;font-weight:600;cursor:pointer;transition:all 0.2s;">';
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
    html += '<span style="font-weight:700;font-size:1rem;color:#111827;">📂 ' + escapeHtml(posSelectedCategoryForView) + '</span>';
    html += '<span style="font-size:0.8rem;color:#64748b;background:#f1f5f9;padding:3px 14px;border-radius:20px;font-weight:600;">' + count + ' produit' + (count > 1 ? 's' : '') + '</span>';
    html += '</div>';
}

html += '<div style="min-width:20px;"></div>';
html += '</div>';

if(totalProducts===0){ html+='<div style="grid-column:1/-1;text-align:center;padding:40px 10px;"><i class="fas fa-search" style="font-size:2.5rem;color:#94a3b8;"></i><p style="color:#94a3b8;">'+(posSearchQuery?'Aucun produit pour "'+escapeHtml(posSearchQuery)+'"':'Aucun produit')+'</p>'+(posSearchQuery?'<button class="btn-add" onclick="clearPosSearch()">Effacer</button>':'')+'</div>'; }
else{
if(posSearchQuery) html+='<div style="grid-column:1/-1;padding:3px 8px;font-size:0.75rem;color:#94a3b8;">'+totalProducts+' résultat'+(totalProducts>1?'s':'')+'</div>';
for(var j=0;j<displayProducts.length;j++){ var p=displayProducts[j],pr=p.prixPromo&&p.prixPromo>0?p.prixPromo:p.prixVente,hp=p.prixPromo&&p.prixPromo>0,sc='',stt=''; if(p.stock!==undefined){ if(p.stock<=0){sc='pos-out-of-stock';stt=' (Rupture)';}else if(p.stock<=5) stt=' ('+p.stock+' rest.)'; } var dn=escapeHtml(p.nom); if(posSearchQuery) dn=dn.replace(new RegExp('('+posSearchQuery.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark style="background:#fef3c7;border-radius:3px;">$1</mark>');

// ✅ Style adapté
var cardStyle = isMobile ? 
    'padding:6px 3px;min-height:95px;border-radius:10px;border-width:2px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#ffffff;border:2px solid #e2e8f0;' : 
    'padding:12px 8px;min-height:180px;border-radius:14px;border-width:2px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#ffffff;border:2px solid #e2e8f0;';
var imgStyle = isMobile ? 'height:38px;width:100%;margin-bottom:4px;border-radius:6px;' : 'height:75px;margin-bottom:8px;border-radius:10px;';
var nameStyle = isMobile ? 'font-size:18px !important;font-weight:700 !important;text-transform:uppercase;line-height:1.2;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;display:block;' : 'font-size:1rem !important;font-weight:700 !important;line-height:1.3;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;display:block;';
var priceStyle = isMobile ? 'font-size:20px !important;font-weight:700;display:block;text-align:center;margin-top:2px;' : 'font-size:1.1rem !important;font-weight:700;display:block;text-align:center;margin-top:4px;';

html+='<div class="pos-product-card '+sc+'" style="'+cardStyle+'" onclick="posAddToCartOrOpenOptions(\''+p.id+'\')">'+
(p.imageBase64?'<div class="pos-product-img" style="width:100%;'+imgStyle+'overflow:hidden;background:var(--gray-200);border-radius:6px;flex-shrink:0;"><img src="'+escapeHtml(p.imageBase64)+'" loading="lazy" alt="" style="width:100%;height:100%;object-fit:cover;"></div>':'<div class="pos-product-img pos-product-placeholder" style="width:100%;'+imgStyle+'overflow:hidden;background:var(--gray-200);border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-box" style="'+(isMobile?'font-size:14px;':'font-size:24px;')+'"></i></div>')+
'<div class="pos-product-info" style="display:flex;flex-direction:column;align-items:center;width:100%;flex:1;justify-content:center;">'+
'<span class="pos-product-name" style="'+nameStyle+'">'+dn+stt+'</span>'+
'<span class="pos-product-price" style="'+priceStyle+'">'+(hp?'<span class="pos-old-price" style="'+(isMobile?'font-size:12px;':'font-size:0.8rem;')+'text-decoration:line-through;color:#94a3b8;">'+p.prixVente.toFixed(2)+'</span> <span class="pos-promo-price" style="'+(isMobile?'font-size:20px;color:#ef4444;':'font-size:1.1rem;color:#ef4444;')+'">'+pr.toFixed(2)+' MAD</span>':pr.toFixed(2)+' MAD</span>')+'</span>'+
'</div></div>'; }
if(posHasMoreProducts){ html+='<div style="grid-column:1/-1;text-align:center;padding:10px;"><button class="btn-add" onclick="loadMoreProducts()" style="font-size:0.8rem;">Afficher plus ('+(totalProducts-displayProducts.length)+' produits restants)</button></div>'; }
}
grid.innerHTML=html;
updateClearButtonVisibility();
}
