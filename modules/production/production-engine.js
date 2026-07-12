function calculateProductionKPIs(orders, totalOpen) {
  return {
    totalOpen: totalOpen ?? orders.length,
    ready: orders.filter(order => order.trafficLight === "Verde").length,
    waitingMaterials: orders.filter(order => order.pendingComponents > 0).length,
    pendingComponents: orders.reduce((total, order) => total + order.pendingComponents, 0),
    noStockComponents: orders.reduce((total, order) => total + order.noStockComponents, 0)
  };
}

function filterProductionOrders(orders, filters) {
  const search = normalizeProductionFilterValue(filters?.search);
  const status = normalizeProductionFilterValue(filters?.status);
  const trafficLight = normalizeProductionFilterValue(filters?.trafficLight);
  const customer = normalizeProductionFilterValue(filters?.customer);

  return (orders || []).filter(order => {
    const orderSearchText = normalizeProductionFilterValue([
      order.productionOrder,
      order.customer,
      order.product,
      order.status,
      order.responsible,
      order.priority
    ].join(" "));

    return (!search || orderSearchText.includes(search))
      && (!status || normalizeProductionFilterValue(order.status) === status)
      && (!trafficLight || normalizeProductionFilterValue(order.trafficLight) === trafficLight)
      && (!customer || normalizeProductionFilterValue(order.customer) === customer);
  });
}

function getProductionFilterOptions(orders, field) {
  return [...new Set((orders || []).map(order => order[field]).filter(Boolean))]
    .sort((first, second) => String(first).localeCompare(String(second), "es"));
}

function normalizeProductionFilterValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatProductionDate(value) {
  if (!value) return "No informada";
  if (typeof value.toDate === "function") return value.toDate().toLocaleDateString("es-CL");
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "No informada" : date.toLocaleDateString("es-CL");
}

function productionDaysRemaining(value) {
  if (!value) return "—";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((date - today) / 86400000);
}

function escapeProductionHtml(value) { return String(value ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
