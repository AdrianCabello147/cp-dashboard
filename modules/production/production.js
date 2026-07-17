let PRODUCTION_PAGE = null;
let PRODUCTION_KPIS = null;
const PRODUCTION_FILTERS = { search: "", status: "", trafficLight: "", customer: "", materials: "all" };
let PRODUCTION_CURRENT_PAGE = 1;
const PRODUCTION_LOCAL_PAGE_SIZE = 20;
const PRODUCTION_MATERIAL_CONCURRENCY = 5;
let PRODUCTION_DETAIL = null;
async function initProductionModule() { if (!window.isProductionUserAllowed?.()) { renderProductionRestricted(); return; } await loadProductionPage(); }

async function loadProductionPage(cursor = null, direction = "next") {
  renderProductionLoading();
  const listStartedAt = productionNow();
  try {
    PRODUCTION_PAGE = await getProductionOrdersPage(cursor, direction);
    const activePage = PRODUCTION_PAGE;
    const listVisibleMs = productionNow() - listStartedAt;
    resetProductionComponentLoadMetrics();
    PRODUCTION_KPIS = { total: activePage.orders.length, calculating: true, listVisibleMs };
    renderProductionModule();
    const calculationStartedAt = productionNow();
    await preloadProductionMaterials(activePage.orders);
    if (PRODUCTION_PAGE !== activePage) return;
    const loadMetrics = getProductionComponentLoadMetrics();
    PRODUCTION_KPIS = {
      total: activePage.orders.length,
      calculating: false,
      listVisibleMs,
      calculationMs: productionNow() - calculationStartedAt,
      ...loadMetrics
    };
    console.info("[PSI] Producción: indicadores calculados", PRODUCTION_KPIS);
    renderProductionModule();
  }
  catch (error) { console.error("Error al cargar Produccion.", error); renderProductionError(error); }
}

async function preloadProductionMaterials(orders) {
  await runProductionWithConcurrency(orders, PRODUCTION_MATERIAL_CONCURRENCY, order => hydrateProductionOrderMaterials(order, false));
}

async function toggleProductionComponents(documentId) {
  const order = PRODUCTION_PAGE?.orders.find(item => item.documentId === documentId);
  if (!order) return;
  if (order.materialState === "loaded") {
    order.componentsExpanded = !order.componentsExpanded;
    updateProductionOrderExpansion(order);
    return;
  }
  order.componentsExpanded = true;
  if (!order.identitySafe) { order.materialState = "identity_error"; renderProductionModule(); return; }
  if (order.materialState === "loaded") { renderProductionModule(); return; }
  await loadProductionComponents(order, false);
}

async function retryProductionComponents(documentId) {
  const order = PRODUCTION_PAGE?.orders.find(item => item.documentId === documentId);
  if (order) await loadProductionComponents(order, true);
}

async function loadProductionComponents(order, forceReload) {
  order.materialState = "loading";
  order.componentsExpanded = true;
  renderProductionModule();
  await hydrateProductionOrderMaterials(order, forceReload);
  renderProductionModule();
}

async function hydrateProductionOrderMaterials(order, forceReload) {
  if (!order.identitySafe) {
    Object.assign(order, { materialState: "identity_error", materialClassification: "waiting" });
    return;
  }
  if (!forceReload && order.materialState === "loaded") return;
  order.materialState = "loading";
  try {
    const components = await getComponentsByOrderDocumentId(order.documentId, forceReload);
    Object.assign(order, summarizeProductionComponents(components, order.salesOrderCommitmentDate), { components, materialState: "loaded", materialError: null });
  } catch (error) {
    console.error("[PSI] Error al cargar componentes", { documentId: order.documentId, error });
    Object.assign(order, { components: null, materialState: "error", materialError: error, materialClassification: "waiting" });
  }
}

function updateProductionFilter(filterName, value) {
  PRODUCTION_FILTERS[filterName] = value || "";
  PRODUCTION_CURRENT_PAGE = 1;
  renderProductionModule();
}

function setProductionMaterialFilter(value) {
  PRODUCTION_FILTERS.materials = ["all", "ready", "waiting"].includes(value) ? value : "all";
  PRODUCTION_CURRENT_PAGE = 1;
  renderProductionModule();
}

function goToProductionPage(page) { PRODUCTION_CURRENT_PAGE = Math.max(1, page); renderProductionModule(); }

async function openProductionDetail(documentId) {
  window.location.hash = `#/production/orders/${encodeURIComponent(documentId)}`;
  PRODUCTION_DETAIL = { state: "loading", documentId };
  renderProductionDetail();
  try {
    const detail = await getProductionOrderByDocumentId(documentId);
    PRODUCTION_DETAIL = detail ? { state: detail.identitySafe ? "success" : "inconsistent-data", detail } : { state: "not-found", documentId };
  } catch (error) { PRODUCTION_DETAIL = { state: error?.code || "error", documentId, error }; }
  renderProductionDetail();
}

function closeProductionDetail() { window.location.hash = "#/production"; PRODUCTION_DETAIL = null; renderProductionModule(); }
function retryProductionDetail() { if (PRODUCTION_DETAIL?.documentId) openProductionDetail(PRODUCTION_DETAIL.documentId); }

function clearProductionFilters() {
  Object.assign(PRODUCTION_FILTERS, { search: "", status: "", trafficLight: "", customer: "", materials: "all" });
  PRODUCTION_CURRENT_PAGE = 1;
  renderProductionModule();
}

function productionNow() {
  return globalThis.performance?.now ? globalThis.performance.now() : Date.now();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initProductionModule);
else initProductionModule();
