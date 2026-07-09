let PRODUCTION_ORDERS = [];

async function initProductionModule() {
  PRODUCTION_ORDERS = await loadProductionOrders();
  refreshProductionModule();
}

function refreshProductionModule() {
  renderProductionModule(PRODUCTION_ORDERS);
}

document.addEventListener("DOMContentLoaded", initProductionModule);
