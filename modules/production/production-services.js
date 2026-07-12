/* Read-only repository for productionOrders. No client writes are allowed here. */
const PRODUCTION_PAGE_SIZE = 25;
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

async function getProductionOrdersPage(cursor = null, direction = "next") {
  const { db, collection, collectionGroup, getDocs, query, where } = await getProductionFirestore();
  const orders = collection(db, "productionOrders");
  const snapshot = await getDocs(query(orders));

  const mappedOrders = snapshot.docs
    .map(doc => mapProductionOrder(doc.id, doc.data()))
    .filter(isProductionOrderOpen)
    .sort(compareProductionOrders);
  const components = mappedOrders.length ? await getProductionComponents(collectionGroup, getDocs, query, where, mappedOrders) : [];
  const componentsByOrder = components.reduce((grouped, component) => {
    (grouped[component.productionOrderId] ||= []).push(component);
    return grouped;
  }, {});
  mappedOrders.forEach(order => Object.assign(order, summarizeProductionComponents(componentsByOrder[order.id] || [], order.salesOrderCommitmentDate)));

  return {
    orders: mappedOrders,
    first: null,
    last: null,
    hasNext: false,
    hasPrevious: false
  };
}

function isProductionOrderOpen(order) {
  const status = normalizeProductionStatus(order.status);
  return status !== "cerrada" && status !== "cerrado";
}

function compareProductionOrders(firstOrder, secondOrder) {
  const firstDate = getProductionOrderSortDate(firstOrder);
  const secondDate = getProductionOrderSortDate(secondOrder);

  if (firstDate !== secondDate) {
    return firstDate - secondDate;
  }

  return String(firstOrder.productionOrder).localeCompare(String(secondOrder.productionOrder), "es", {
    numeric: true
  });
}

function getProductionOrderSortDate(order) {
  const date = order.salesOrderCommitmentDate || order.targetDate;
  const parsedDate = typeof date?.toDate === "function" ? date.toDate() : new Date(date);

  return Number.isNaN(parsedDate.getTime()) ? Number.MAX_SAFE_INTEGER : parsedDate.getTime();
}

function normalizeProductionStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function getProductionComponents(collectionGroup, getDocs, query, where, orders) {
  const numericValues = orders
    .map(order => order.id)
    .filter(id => /^\d+$/.test(id))
    .map(Number);
  const textValues = orders.map(order => String(order.id));

  try {
    const snapshots = await Promise.all([
      numericValues.length ? getDocs(query(collectionGroup(productionFirestore.db, "components"), where("sap.Prod_DocEntry", "in", numericValues))) : null,
      textValues.length ? getDocs(query(collectionGroup(productionFirestore.db, "components"), where("sap.Prod_DocEntry", "in", textValues))) : null
    ]);
    const componentsByKey = new Map();

    snapshots.filter(Boolean).forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        componentsByKey.set(doc.ref.path, mapProductionComponent(doc.data()));
      });
    });

    return [...componentsByKey.values()];
  } catch (error) {
    console.warn("No se pudieron cargar componentes de Produccion. Se mostraran OT sin detalle de componentes.", error);
    return [];
  }
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

  try {
    return { total: await count(where("sap.Estado OT", "!=", "Cerrada")) };
  } catch (error) {
    console.warn("No se pudo calcular KPI total de Produccion desde Firestore.", error);
    return { total: null };
  }
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
