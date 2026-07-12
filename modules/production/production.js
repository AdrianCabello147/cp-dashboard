let PRODUCTION_PAGE = null;
let PRODUCTION_KPIS = null;
const PRODUCTION_FILTERS = { search: "", status: "", trafficLight: "", customer: "" };
async function initProductionModule() { if (!window.isProductionUserAllowed?.()) { renderProductionRestricted(); return; } await loadProductionPage(); }

async function loadProductionPage(cursor = null, direction = "next") {
  renderProductionLoading();
  try { [PRODUCTION_PAGE, PRODUCTION_KPIS] = await Promise.all([getProductionOrdersPage(cursor, direction), getProductionKPIs()]); renderProductionModule(); }
  catch (error) { console.error("Error al cargar Produccion.", error); renderProductionError(error); }
}

function updateProductionFilter(filterName, value) {
  PRODUCTION_FILTERS[filterName] = value || "";
  renderProductionModule();
}

function clearProductionFilters() {
  Object.keys(PRODUCTION_FILTERS).forEach(key => { PRODUCTION_FILTERS[key] = ""; });
  renderProductionModule();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initProductionModule);
else initProductionModule();
