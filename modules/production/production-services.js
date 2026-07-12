/* Read-only repository for productionOrders. No client writes are allowed here. */
const PRODUCTION_COMPONENT_QUERY_SIZE = 30;
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

async function getProductionOrdersPage() {
  const { db, collection, collectionGroup, getDocs, query, where } = await getProductionFirestore();
  const ordersRef = collection(db, "productionOrders");
  const snapshot = await getProductionOrdersSnapshot(getDocs, query, where, ordersRef);

  const mappedOrders = snapshot.docs
    .map(doc => mapProductionOrder(doc.id, doc.data()))
    .filter(isProductionOrderOpen)
    .sort(compareProductionOrders);

  const components = mappedOrders.length
    ? await getProductionComponents(collectionGroup, getDocs, query, where, mappedOrders)
    : [];
  const componentsByOrder = components.reduce((grouped, component) => {
    (grouped[component.productionOrderId] ||= []).push(component);
    return grouped;
  }, {});

  mappedOrders.forEach(order => {
    Object.assign(
      order,
      summarizeProductionComponents(componentsByOrder[String(order.id)] || [], order.salesOrderCommitmentDate)
    );
  });

  return {
    orders: mappedOrders,
    first: null,
    last: null,
    hasNext: false,
    hasPrevious: false
  };
}

async function getProductionOrdersSnapshot(getDocs, query, where, ordersRef) {
  try {
    return await getDocs(query(ordersRef, where("sap.Estado OT", "!=", "Cerrada")));
  } catch (error) {
    console.warn("No se pudo consultar solo OT abiertas. Se cargara la coleccion completa y se filtrara localmente.", error);
    return await getDocs(query(ordersRef));
  }
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
  const parsedDate = toProductionDate(date);

  return parsedDate ? parsedDate.getTime() : Number.MAX_SAFE_INTEGER;
}

async function getProductionComponents(collectionGroup, getDocs, query, where, orders) {
  const componentsRef = collectionGroup(productionFirestore.db, "components");
  const numericIds = uniqueProductionValues(orders
    .map(order => order.id)
    .filter(id => /^\d+$/.test(String(id)))
    .map(Number));
  const textIds = uniqueProductionValues(orders.map(order => String(order.id)));

  try {
    const snapshots = [];

    for (const values of chunkProductionValues(numericIds, PRODUCTION_COMPONENT_QUERY_SIZE)) {
      snapshots.push(await getDocs(query(componentsRef, where("sap.Prod_DocEntry", "in", values))));
    }

    for (const values of chunkProductionValues(textIds, PRODUCTION_COMPONENT_QUERY_SIZE)) {
      snapshots.push(await getDocs(query(componentsRef, where("sap.Prod_DocEntry", "in", values))));
    }

    const componentsByPath = new Map();
    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        componentsByPath.set(doc.ref.path, mapProductionComponent(doc.data()));
      });
    });

    return [...componentsByPath.values()];
  } catch (error) {
    console.warn("No se pudieron cargar componentes de Produccion. Se mostraran OT sin detalle de componentes.", error);
    return [];
  }
}

function uniqueProductionValues(values) {
  return [...new Set(values.filter(value => value !== null && value !== undefined && value !== ""))];
}

function chunkProductionValues(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function mapProductionComponent(data) {
  const sap = data.sap || {};
  const pending = Number(getProductionSapValue(sap, ["Cantidad Pendiente"], 0));
  const available = Number(getProductionSapValue(sap, ["Stock Disponible"], 0));

  return {
    productionOrderId: String(getProductionSapValue(sap, ["Prod_DocEntry"], "")),
    code: getProductionSapValue(sap, ["Item No.", "ItemCode", "Codigo SAP"]),
    description: getProductionSapValue(sap, [
      "Descripcion Componente",
      "Descripción Componente",
      "DescripciÃ³n Componente",
      "Item Description",
      "Dscription"
    ]),
    required: getProductionSapValue(sap, ["Cantidad Requerida"]),
    available: getProductionSapValue(sap, ["Stock Disponible"]),
    pending: Number.isFinite(pending) ? pending : 0,
    noStock: pending > 0 && available <= 0,
    status: getProductionSapValue(sap, ["Estado Componente"], "Sin informacion"),
    arrivalDate: getProductionSapValue(sap, ["Fecha Estimada Llegada", "Target Day Compra"], null)
  };
}

function summarizeProductionComponents(components, commitmentDate) {
  const pending = components.filter(component => component.pending > 0);
  const dates = pending
    .map(component => component.arrivalDate)
    .map(toProductionDate)
    .filter(Boolean)
    .sort((firstDate, secondDate) => firstDate - secondDate);
  const nextArrival = dates[0] || null;
  const commitment = toProductionDate(commitmentDate);
  let trafficLight = "Gris";

  if (components.length && !pending.length) trafficLight = "Verde";
  else if (pending.length && nextArrival && commitment && nextArrival <= commitment) trafficLight = "Amarillo";
  else if (pending.length && nextArrival && commitment && nextArrival > commitment) trafficLight = "Rojo";

  return {
    components,
    totalComponents: components.length,
    pendingComponents: pending.length,
    noStockComponents: pending.filter(component => component.noStock).length,
    nextArrival,
    trafficLight
  };
}

async function getProductionKPIs() {
  const page = await getProductionOrdersPage();

  return {
    total: page.orders.length
  };
}

function mapProductionOrder(id, data) {
  const sap = data.sap || {};
  const portal = data.portal || {};

  return {
    id,
    productionOrder: getProductionSapValue(sap, ["Production Order"], id),
    status: getProductionSapValue(sap, ["Estado OT"], "Sin estado"),
    customer: getProductionSapValue(sap, ["Nombre Cliente", "Codigo Cliente"]),
    seller: getProductionSapValue(sap, ["Vendedor"]),
    product: getProductionSapValue(sap, ["Descripcion Producto", "Descripción Producto", "ItemName"]),
    salesOrderCommitmentDate: getProductionSapValue(sap, ["Fecha Comprometida SO"], null),
    targetDate: getProductionSapValue(sap, ["Target Day OT", "Due Date"], null),
    actualEndDate: getProductionSapValue(sap, ["Fecha Termino Real", "Fecha Término Real"], null),
    otd: getProductionSapValue(sap, ["Cumplimiento OTD"], "Pendiente"),
    lateDays: getProductionSapValue(sap, ["Dias de Atraso", "Días de Atraso"]),
    responsible: portal.responsableNombre ?? portal.responsableId ?? "—",
    priority: portal.prioridad ?? "—"
  };
}

function getProductionSapValue(sap, keys, fallback = "—") {
  for (const key of keys) {
    const value = sap[key];

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return fallback;
}

function toProductionDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeProductionStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
