const PRODUCTION_INTERNAL_RESOURCE_CODES = new Set([
  "MANO DE OBRA",
  "PRUEBAS",
  "REPORTE/LEVANTAMIENTO CILINDROS",
  "SOPORTES",
  "INSUMOS",
  "GRABADO LASER",
  "EMBALADO",
  "DISENO",
  "CERTIFICADOS"
]);

function calculateProductionKPIs(orders, totalOpen, calculating = false) {
  const loadedOrders = orders.filter(order => order.materialState === "loaded");
  const ready = orders.filter(order => order.materialClassification === "ready").length;
  return {
    totalOpen: totalOpen ?? orders.length,
    ready,
    waitingMaterials: (totalOpen ?? orders.length) - ready,
    pendingComponents: loadedOrders.reduce((total, order) => total + (order.pendingComponents || 0), 0),
    noStockComponents: loadedOrders.reduce((total, order) => total + (order.noStockComponents || 0), 0),
    loadedOrders: loadedOrders.length,
    calculating
  };
}

function normalizeProductionComponentCode(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isProductionInternalResource(component) {
  return PRODUCTION_INTERNAL_RESOURCE_CODES.has(normalizeProductionComponentCode(component?.code));
}

function isProductionPhysicalComponentReady(component) {
  const pending = Math.max(Number(component?.pending) || 0, 0);
  const delivered = normalizeProductionFilterValue(component?.status) === "entregado completo a psi";
  if (pending <= 0 || delivered) return true;
  const pickingCount = Math.max(Number(component?.pickingCount) || 0, 0);
  const pickingCoverage = Math.max(Number(component?.pickingCoveredQuantity) || 0, 0);
  return pickingCount > 0 && pickingCoverage >= pending;
}

function classifyProductionOrderComponents(components) {
  const physicalComponents = (components || []).filter(component => !isProductionInternalResource(component));
  const readyComponents = physicalComponents.filter(isProductionPhysicalComponentReady);
  return physicalComponents.length === readyComponents.length ? "ready" : "waiting";
}

async function runProductionWithConcurrency(items, concurrency, worker) {
  const queue = [...(items || [])];
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(Number(concurrency) || 1, 1), queue.length);
  const runWorker = async () => {
    while (nextIndex < queue.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(queue[index], index);
    }
  };
  await Promise.all(Array.from({ length: workerCount }, runWorker));
}

function filterProductionOrders(orders, filters) {
  const search = normalizeProductionFilterValue(filters?.search);
  const status = normalizeProductionFilterValue(filters?.status);
  const trafficLight = normalizeProductionFilterValue(filters?.trafficLight);
  const customer = normalizeProductionFilterValue(filters?.customer);
  const materials = normalizeProductionFilterValue(filters?.materials);

  return (orders || []).filter(order => {
    const orderSearchText = normalizeProductionFilterValue([
      order.productionOrder,
      order.customer,
      order.product,
      order.status,
      order.responsible,
      order.priority
    ].join(" "));

    const customerDateStatus = getProductionCustomerDateStatus(order.customerDate);
    return (!search || orderSearchText.includes(search))
      && (!status || normalizeProductionFilterValue(order.status) === status)
      && (!trafficLight || normalizeProductionFilterValue(customerDateStatus.label) === trafficLight)
      && (!customer || normalizeProductionFilterValue(order.customer) === customer)
      && (!materials || materials === "all" || normalizeProductionFilterValue(order.materialClassification) === materials);
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
  const status = getProductionCustomerDateStatus(value);
  return status.days === null ? "—" : status.days;
}

function getProductionCustomerDateStatus(value, today = new Date()) {
  const calendarDate = parseProductionCalendarDate(value);
  if (!calendarDate) return { key: "no-date", label: "Sin fecha", cssClass: "gris", days: null };

  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const targetDay = Date.UTC(calendarDate.year, calendarDate.month - 1, calendarDate.day);
  const days = Math.round((targetDay - todayDay) / 86400000);

  if (days < 0) return { key: "late", label: "Atrasada", cssClass: "rojo", days };
  if (days <= 30) return { key: "urgent", label: "Urgente", cssClass: "naranja", days };
  if (days <= 90) return { key: "upcoming", label: "Próxima", cssClass: "amarillo", days };
  return { key: "on-time", label: "En plazo", cssClass: "verde", days };
}

function parseProductionCalendarDate(value) {
  if (!value) return null;
  const raw = typeof value.toDate === "function" ? value.toDate() : value;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return { year: raw.getFullYear(), month: raw.getMonth() + 1, day: raw.getDate() };
  }

  const text = String(raw).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  const local = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const parts = iso
    ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
    : local
      ? { year: Number(local[3]), month: Number(local[2]), day: Number(local[1]) }
      : null;
  if (!parts) return null;
  const validation = new Date(parts.year, parts.month - 1, parts.day);
  return validation.getFullYear() === parts.year
    && validation.getMonth() === parts.month - 1
    && validation.getDate() === parts.day
    ? parts
    : null;
}

function escapeProductionHtml(value) { return String(value ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
