let PRODUCTION_PAGE = null;
let PRODUCTION_KPIS = null;
async function initProductionModule() { if (!window.isProductionUserAllowed?.()) { renderProductionRestricted(); return; } await loadProductionPage(); }

async function loadProductionPage(cursor = null, direction = "next") {
  renderProductionLoading();
  try { [PRODUCTION_PAGE, PRODUCTION_KPIS] = await Promise.all([getProductionOrdersPage(cursor, direction), getProductionKPIs()]); renderProductionModule(); }
  catch (error) { renderProductionError(error); }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initProductionModule);
else initProductionModule();
