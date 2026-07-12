/* Read-only repository for productionOrders. No client writes are allowed here. */
const PRODUCTION_PAGE_SIZE = 25;
let productionFirestore;

async function getProductionFirestore() {
  if (productionFirestore) return productionFirestore;

  const [{ db }, firestore] = await Promise.all([
    import("../../auth/firebase-config.js"),
    import("https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js")
  ]);

  productionFirestore = { db, ...firestore };
  return productionFirestore;
}

async function getProductionOrdersPage(cursor = null, direction = "next") {
  const { db, collection, collectionGroup, getDocs, query, where, orderBy, limit, startAfter, endBefore, limitToLast } = await getProductionFirestore();
  const orders = collection(db, "productionOrders");
  const clauses = [where("sap.Estado OT", "!=", "Cerrada"), orderBy("sap.Estado OT"), orderBy("sap.Production Order"), limit(PRODUCTION_PAGE_SIZE + 1)];

  if (cursor && direction === "next") clauses.splice(1, 0, startAfter(cursor));
  if (cursor && direction === "previous") {
    clauses.splice(1, 1, endBefore(cursor), limitToLast(PRODUCTION_PAGE_SIZE + 1));
  }

  const snapshot = await getDocs(query(orders, ...clauses));
  let docs = snapshot.docs;
  const hasOverflow = docs.length > PRODUCTION_PAGE_SIZE;
  if (hasOverflow) docs = direction === "next" ? docs.slice(0, PRODUCTION_PAGE_SIZE) : docs.slice(1);

  const mappedOrders = docs.map(doc => mapProductionOrder(doc.id, doc.data()));
  const components = mappedOrders.length ? await getProductionComponents(collectionGroup, getDocs, query, where, mappedOrders) : [];
  const componentsByOrder = components.reduce((grouped, component) => {
    (grouped[component.productionOrderId] ||= []).push(component);
    return grouped;
  }, {});
  mappedOrders.forEach(order => Object.assign(order, summarizeProductionComponents(componentsByOrder[order.id] || [], order.salesOrderCommitmentDate)));

  return {
    orders: mappedOrders,
    first: docs[0] || null,
    last: docs[docs.length - 1] || null,
    hasNext: direction === "next" ? hasOverflow : Boolean(cursor),
    hasPrevious: direction === "previous" ? hasOverflow : Boolean(cursor)
  };
}

async function getProductionComponents(collectionGroup, getDocs, query, where, orders) {
  const values = orders.map(order => /^\d+$/.test(order.id) ? Number(order.id) : order.id);
  const snapshot = await getDocs(query(collectionGroup(productionFirestore.db, "components"), where("sap.Prod_DocEntry", "in", values)));
  return snapshot.docs.map(doc => mapProductionComponent(doc.data()));
}

function mapProductionComponent(data) {
  const sap = data.sap || {};
  const pending = Number(sap["Cantidad Pendiente"] ?? 0);
  const available = Number(sap["Stock Disponible"] ?? 0);
  return { productionOrderId: String(sap.Prod_DocEntry), code: sap["Item No."] ?? "—", description: sap["Descripción Componente"] ?? "—", required: sap["Cantidad Requerida"] ?? "—", available: sap["Stock Disponible"] ?? "—", pending: Number.isFinite(pending) ? pending : 0, noStock: pending > 0 && available <= 0, status: sap["Estado Componente"] ?? "Sin información", arrivalDate: sap["Fecha Estimada Llegada"] ?? sap["Target Day Compra"] ?? null };
}

function summarizeProductionComponents(components, commitmentDate) {
  const pending = components.filter(component => component.pending > 0);
  const dates = pending.map(component => component.arrivalDate).filter(Boolean).map(value => new Date(value)).filter(date => !Number.isNaN(date.getTime())).sort((a, b) => a - b);
  const nextArrival = dates[0] || null;
  const commitment = commitmentDate ? new Date(commitmentDate) : null;
  let trafficLight = "Gris";
  if (components.length && !pending.length) trafficLight = "Verde";
  else if (pending.length && nextArrival && commitment && nextArrival <= commitment) trafficLight = "Amarillo";
  else if (pending.length && nextArrival && commitment && nextArrival > commitment) trafficLight = "Rojo";
  return { components, totalComponents: components.length, pendingComponents: pending.length, noStockComponents: pending.filter(component => component.noStock).length, nextArrival, trafficLight };
}

async function getProductionKPIs() {
  const { db, collection, getCountFromServer, query, where } = await getProductionFirestore();
  const orders = collection(db, "productionOrders");
  const count = async (...clauses) => (await getCountFromServer(query(orders, ...clauses))).data().count;
  return { total: await count(where("sap.Estado OT", "!=", "Cerrada")) };
}

function mapProductionOrder(id, data) {
  const sap = data.sap || {};
  const portal = data.portal || {};
  return {
    id,
    productionOrder: sap["Production Order"] ?? id,
    status: sap["Estado OT"] ?? "Sin estado",
    customer: sap["Nombre Cliente"] ?? sap["Codigo Cliente"] ?? "—",
    seller: sap.Vendedor ?? "—",
    product: sap["Descripcion Producto"] ?? "—",
    salesOrderCommitmentDate: sap["Fecha Comprometida SO"] ?? null,
    targetDate: sap["Target Day OT"] ?? null,
    actualEndDate: sap["Fecha Termino Real"] ?? null,
    otd: sap["Cumplimiento OTD"] ?? "Pendiente",
    lateDays: sap["Dias de Atraso"] ?? null,
    responsible: portal.responsableNombre ?? portal.responsableId ?? "—",
    priority: portal.prioridad ?? "—"
  };
}
