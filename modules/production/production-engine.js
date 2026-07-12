function calculateProductionKPIs(orders, totalOpen) {
  return {
    totalOpen: totalOpen ?? orders.length,
    ready: orders.filter(order => order.trafficLight === "Verde").length,
    waitingMaterials: orders.filter(order => order.pendingComponents > 0).length,
    pendingComponents: orders.reduce((total, order) => total + order.pendingComponents, 0),
    noStockComponents: orders.reduce((total, order) => total + order.noStockComponents, 0)
  };
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
