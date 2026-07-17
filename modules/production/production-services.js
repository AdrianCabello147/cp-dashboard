/* Read-only repository. Initial load reads only productionOrders. */
const PRODUCTION_PAGE_SIZE = 25;
const productionComponentsCache = new Map();
const productionComponentsRequests = new Map();
const productionComponentLoadMetrics = { networkLoads: 0, subcollectionReads: 0, cacheHits: 0, inFlightHits: 0 };
let productionFirestore;

async function getProductionFirestore() {
  if (productionFirestore) return productionFirestore;
  const [{ db }, firestore] = await Promise.all([
    import("/auth/firebase-config.js"),
    import("https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js")
  ]);
  productionFirestore = { db, ...firestore };
  return productionFirestore;
}

const PRODUCTION_PERIOD_START = "2026-01-01";
const PRODUCTION_PERIOD_END = "2027-01-01";

async function getProductionOrdersPage(cursor = null, direction = "next") {
  const { db, collection, getDocs, orderBy, query, where } = await getProductionFirestore();
  const clauses = [
    where("sap.Fecha Contabilizacion OT", ">=", PRODUCTION_PERIOD_START),
    where("sap.Fecha Contabilizacion OT", "<", PRODUCTION_PERIOD_END),
    orderBy("sap.Fecha Contabilizacion OT")
  ];
  const snapshot = await getDocs(query(
    collection(db, "productionOrders"),
    ...clauses
  ));
  const documents = snapshot.docs;
  const normalized = documents.map(document => mapProductionOrder(document.id, document.data()));
  const closedFiltered = normalized.filter(order => !isProductionOrderOpen(order)).length;
  const statusCounts = normalized.reduce((counts, order) => { const status = order.status || "No informado"; counts[status] = (counts[status] || 0) + 1; return counts; }, {});
  const orders = normalized
    .filter(isProductionOrderOpen)
    .sort(compareProductionOrders)
    .map(order => ({
      ...order,
      materialState: "not_loaded",
      components: null,
      componentsExpanded: false,
      totalComponents: null,
      pendingComponents: null,
      noStockComponents: null,
      nextArrival: null,
      materialClassification: null,
      trafficLight: "Gris"
    }));

  console.info("[PSI] Producción: universo completo", { snapshotsReceived: documents.length, documentsNormalized: normalized.length, productiveTotal: normalized.length, closedTotal: closedFiltered, openTotal: orders.length, estados: statusCounts, minDate: normalized[0]?.postingDate || null, maxDate: normalized.at(-1)?.postingDate || null, defensiveLimitReached: false, appVersion: window.APP_VERSION || "unknown" });
  return { orders, productiveTotal: normalized.length, closedTotal: closedFiltered, statusCounts, first: null, last: null, hasNext: false, hasPrevious: false };
}

async function getComponentsByOrderDocumentId(documentId, forceReload = false) {
  const normalizedId = normalizeProductionKey(documentId);
  if (!normalizedId) throw new Error("documentId de OT ausente.");
  if (!forceReload && productionComponentsCache.has(normalizedId)) {
    productionComponentLoadMetrics.cacheHits += 1;
    return productionComponentsCache.get(normalizedId);
  }
  if (!forceReload && productionComponentsRequests.has(normalizedId)) {
    productionComponentLoadMetrics.inFlightHits += 1;
    return productionComponentsRequests.get(normalizedId);
  }

  const request = loadProductionComponentsFromFirestore(normalizedId);
  productionComponentsRequests.set(normalizedId, request);
  try {
    const components = await request;
    productionComponentsCache.set(normalizedId, components);
    return components;
  } finally {
    if (productionComponentsRequests.get(normalizedId) === request) productionComponentsRequests.delete(normalizedId);
  }
}

async function loadProductionComponentsFromFirestore(normalizedId) {
  const { db, collection, getDocs } = await getProductionFirestore();
  productionComponentLoadMetrics.networkLoads += 1;
  productionComponentLoadMetrics.subcollectionReads += 2;
  const [componentsSnapshot, pickingsSnapshot] = await Promise.all([
    getDocs(collection(db, "productionOrders", normalizedId, "components")),
    getDocs(collection(db, "productionOrders", normalizedId, "pickings"))
  ]);
  const pickingsByComponent = summarizeProductionPickings(pickingsSnapshot.docs, normalizedId);
  const components = componentsSnapshot.docs.map(document => {
    const prodLineNum = normalizeProductionKey(document.data().sap?.Prod_LineNum);
    return mapProductionComponent(document, normalizedId, pickingsByComponent.get(prodLineNum));
  });
  return components;
}

function resetProductionComponentLoadMetrics() {
  Object.assign(productionComponentLoadMetrics, { networkLoads: 0, subcollectionReads: 0, cacheHits: 0, inFlightHits: 0 });
}

function getProductionComponentLoadMetrics() {
  return {
    ...productionComponentLoadMetrics,
    duplicateQueriesAvoided: productionComponentLoadMetrics.cacheHits + productionComponentLoadMetrics.inFlightHits
  };
}

async function getProductionOrderByDocumentId(documentId) {
  const normalizedId = normalizeProductionKey(documentId);
  if (!normalizedId) throw new Error("documentId de OT ausente.");
  const { db, doc, getDoc } = await getProductionFirestore();
  const snapshot = await getDoc(doc(db, "productionOrders", normalizedId));
  if (!snapshot.exists()) return null;
  return normalizeProductionOrderDetail(snapshot);
}

function normalizeProductionOrderDetail(snapshot) {
  const base = mapProductionOrder(snapshot.id, snapshot.data());
  const sap = snapshot.data().sap || {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const commitment = toProductionDate(base.salesOrderCommitmentDate);
  const daysRemaining = commitment ? Math.ceil((commitment - today) / 86400000) : null;
  return { ...base, salesOrderOrigin: getProductionSapValue(sap, ["Sales Order Origen"], null), salesOrderTargetDay: getProductionSapValue(sap, ["Target Day SO"], null), productionOrderTargetDay: base.targetDate, realCompletionDate: base.actualEndDate, orderStatus: base.status, otdStatus: base.otd, delayDays: base.lateDays, daysRemaining, portal: snapshot.data().portal || {}, planning: snapshot.data().planning || {}, metadata: snapshot.data().metadata || {}, rawSap: sap };
}

function mapProductionOrder(documentId, data) {
  const sap = data.sap || {};
  const portal = data.portal || {};
  const normalizedDocumentId = normalizeProductionKey(documentId);
  const prodDocEntry = normalizeProductionKey(getProductionSapValue(sap, ["Prod_DocEntry"], ""));
  const identitySafe = Boolean(prodDocEntry && normalizedDocumentId === prodDocEntry);
  const salesOrderCommitmentDate = getProductionSapValue(sap, ["Fecha Comprometida SO"], null);
  const customerDate = getProductionSapValue(
    sap,
    ["Target Day Línea SO", "Target Day Linea SO"],
    salesOrderCommitmentDate
  );
  if (!identitySafe) console.warn("[PSI] OT con identidad Firestore/SAP inconsistente", { documentId: normalizedDocumentId, prodDocEntry });

  return {
    id: normalizedDocumentId,
    documentId: normalizedDocumentId,
    prodDocEntry,
    identitySafe,
    productionOrder: getProductionSapValue(sap, ["Production Order"], normalizedDocumentId),
    status: getProductionSapValue(sap, ["Estado OT"], "Sin estado"),
    customer: getProductionSapValue(sap, ["Nombre Cliente", "Codigo Cliente"]),
    seller: getProductionSapValue(sap, ["Vendedor"]),
    product: getProductionSapValue(sap, ["Descripcion Producto", "Descripción Producto", "DescripciÃ³n Producto"]),
    postingDate: getProductionSapValue(sap, ["Fecha Contabilizacion OT"], null),
    salesOrderCommitmentDate,
    customerDate,
    targetDate: getProductionSapValue(sap, ["Target Day OT"], null),
    actualEndDate: getProductionSapValue(sap, ["Fecha Termino Real", "Fecha Término Real", "Fecha TÃ©rmino Real"], null),
    otd: getProductionSapValue(sap, ["Cumplimiento OTD"], "Pendiente"),
    lateDays: getProductionSapValue(sap, ["Dias de Atraso", "Días de Atraso", "DÃ­as de Atraso"]),
    responsible: portal.responsableNombre ?? portal.responsableId ?? "—",
    priority: portal.prioridad ?? "—"
  };
}

function mapProductionComponent(document, expectedParentId, pickingSummary = null) {
  const sap = document.data().sap || {};
  const parentId = normalizeProductionKey(document.ref.parent.parent?.id);
  if (parentId !== expectedParentId) throw new Error(`Ruta de componente inconsistente: ${document.ref.path}`);
  const pending = Number(getProductionSapValue(sap, ["Cantidad Pendiente"], 0));
  const available = Number(getProductionSapValue(sap, ["Stock Disponible"], 0));
  const required = Number(getProductionSapValue(sap, ["Cantidad Requerida"], 0));
  const releasedQuantity = Number(getProductionSapValue(sap, ["Cantidad Released"], 0));
  const availableForOrder = calculateProductionAvailableForOrder({
    required,
    pending,
    stockAvailable: available,
    pickingCount: pickingSummary?.count || 0,
    pickedQuantity: pickingSummary?.pickedQuantity || 0,
    releasedQuantity
  });
  const workshopArrivalDate = getProductionSapValue(
    sap,
    ["Fecha Estimada Llegada Taller", "Fecha Estimada Llegada", "Target Day Compra"],
    null
  );

  return {
    componentId: document.id,
    productionOrderId: parentId,
    prodDocEntry: normalizeProductionKey(getProductionSapValue(sap, ["Prod_DocEntry"], "")),
    prodLineNum: normalizeProductionKey(getProductionSapValue(sap, ["Prod_LineNum"], "")),
    code: getProductionSapValue(sap, ["Item No."]),
    description: getProductionSapValue(sap, ["Descripción Componente", "DescripciÃ³n Componente"]),
    required: getProductionSapValue(sap, ["Cantidad Requerida"]),
    available: getProductionSapValue(sap, ["Stock Disponible"]),
    releasedQuantity: toProductionNonNegativeNumber(releasedQuantity),
    pickingCount: pickingSummary?.count || 0,
    pickedQuantity: pickingSummary?.pickedQuantity || 0,
    pickingReleasedQuantity: pickingSummary?.releasedQuantity || 0,
    pickingCoveredQuantity: pickingSummary?.coveredQuantity || 0,
    availableForOrder,
    pending: Number.isFinite(pending) ? pending : 0,
    noStock: pending > 0 && available <= 0,
    hasPurchase: getProductionSapValue(sap, ["Tiene Compra"], null),
    openPurchaseQuantity: getProductionSapValue(sap, ["Cantidad Compra Abierta"], 0),
    openPurchaseCount: getProductionSapValue(sap, ["Número de Compras Abiertas"], 0),
    firstPurchaseOrder: getProductionSapValue(sap, ["Primera Orden de Compra"], null),
    supplier: getProductionSapValue(sap, ["Proveedor"], null),
    supplierDispatchDate: getProductionSapValue(sap, ["Fecha Despacho Proveedor", "Target Day Compra"], null),
    workshopArrivalDate,
    purchaseCoverage: getProductionSapValue(sap, ["Cobertura Compra"], "Sin cobertura"),
    status: getProductionSapValue(sap, ["Estado Componente"], "Sin información"),
    arrivalDate: workshopArrivalDate
  };
}

function summarizeProductionPickings(documents, expectedParentId) {
  return documents.reduce((summary, document) => {
    const parentId = normalizeProductionKey(document.ref.parent.parent?.id);
    if (parentId !== expectedParentId) throw new Error(`Ruta de picking inconsistente: ${document.ref.path}`);
    const sap = document.data().sap || {};
    const prodLineNum = normalizeProductionKey(getProductionSapValue(sap, ["Prod_LineNum"], ""));
    if (!prodLineNum) throw new Error(`Picking sin Prod_LineNum: ${document.ref.path}`);
    const current = summary.get(prodLineNum) || { count: 0, pickedQuantity: 0, releasedQuantity: 0, coveredQuantity: 0 };
    current.count += 1;
    current.pickedQuantity += toProductionNonNegativeNumber(getProductionSapValue(sap, ["Cantidad Pickeada"], 0));
    current.releasedQuantity += toProductionNonNegativeNumber(getProductionSapValue(sap, ["Cantidad Released"], 0));
    current.coveredQuantity = current.pickedQuantity + current.releasedQuantity;
    summary.set(prodLineNum, current);
    return summary;
  }, new Map());
}

function calculateProductionAvailableForOrder({ required, pending, stockAvailable, pickingCount, pickedQuantity, releasedQuantity = 0 }) {
  const requiredQuantity = toProductionNonNegativeNumber(required);
  const pendingQuantity = toProductionNonNegativeNumber(pending);
  const stockQuantity = toProductionNonNegativeNumber(stockAvailable);
  const picked = toProductionNonNegativeNumber(pickedQuantity);
  if (picked > 0) return Math.min(picked, requiredQuantity);
  if (pickingCount > 0 || toProductionNonNegativeNumber(releasedQuantity) > 0) return "Ready to Pick";
  const baseQuantity = Math.min(stockQuantity, pendingQuantity);
  return Math.min(baseQuantity, requiredQuantity);
}

function toProductionNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(number, 0) : 0;
}

function summarizeProductionComponents(components, commitmentDate) {
  const pending = components.filter(component => component.pending > 0);
  const dates = pending.map(component => toProductionDate(component.arrivalDate)).filter(Boolean).sort((a, b) => a - b);
  const commitment = toProductionDate(commitmentDate);
  const nextArrival = dates[0] || null;
  let trafficLight = "Gris";
  if (components.length && !pending.length) trafficLight = "Verde";
  else if (pending.length && nextArrival && commitment && nextArrival <= commitment) trafficLight = "Amarillo";
  else if (pending.length && nextArrival && commitment && nextArrival > commitment) trafficLight = "Rojo";
  return {
    totalComponents: components.length,
    pendingComponents: pending.length,
    noStockComponents: pending.filter(component => component.noStock).length,
    nextArrival,
    trafficLight,
    materialClassification: classifyProductionOrderComponents(components)
  };
}

function isProductionOrderOpen(order) { const status = normalizeProductionStatus(order.status); return status !== "cerrada" && status !== "cerrado"; }
function compareProductionOrders(a, b) { return getProductionOrderSortDate(a) - getProductionOrderSortDate(b) || String(a.productionOrder).localeCompare(String(b.productionOrder), "es", { numeric: true }); }
function getProductionOrderSortDate(order) { const date = toProductionDate(order.customerDate || order.salesOrderCommitmentDate || order.targetDate); return date ? date.getTime() : Number.MAX_SAFE_INTEGER; }
function normalizeProductionKey(value) { return value === null || value === undefined ? "" : String(value).trim(); }
function getProductionSapValue(sap, keys, fallback = "—") { for (const key of keys) { const value = sap[key]; if (value !== null && value !== undefined && value !== "") return value; } return fallback; }
function toProductionDate(value) { if (!value) return null; if (typeof value.toDate === "function") return value.toDate(); const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
function normalizeProductionStatus(value) { return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
