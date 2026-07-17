const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync("modules/production/production-services.js", "utf8");
const engineSource = fs.readFileSync("modules/production/production-engine.js", "utf8");
const uiSource = fs.readFileSync("modules/production/production-ui.js", "utf8");
const productionSource = fs.readFileSync("modules/production/production.js", "utf8");
const styleSource = fs.readFileSync("style.css", "utf8");
const context = { console: { warn() {} }, PRODUCTION_FILTERS: { materials: "all" } };
vm.createContext(context);
vm.runInContext(source, context);
vm.runInContext(engineSource, context);
vm.runInContext(uiSource, context);

test("adapta OT separando documentId, Prod_DocEntry y Production Order", () => {
  const order = context.mapProductionOrder("4467", {
    sap: { Prod_DocEntry: 4467, "Production Order": 11873, "Estado OT": "Liberada" }
  });

  assert.equal(order.documentId, "4467");
  assert.equal(order.prodDocEntry, "4467");
  assert.equal(order.productionOrder, 11873);
});

test("usa Target Day Línea SO como Fecha Cliente y conserva el fallback", () => {
  const current = context.mapProductionOrder("4505", {
    sap: {
      Prod_DocEntry: 4505,
      "Production Order": 11884,
      "Target Day Línea SO": "2026-09-04",
      "Fecha Comprometida SO": "2026-01-14"
    }
  });
  const legacy = context.mapProductionOrder("4881", {
    sap: {
      Prod_DocEntry: 4881,
      "Production Order": 11979,
      "Fecha Comprometida SO": "2026-04-09"
    }
  });

  assert.equal(current.customerDate, "2026-09-04");
  assert.equal(current.salesOrderCommitmentDate, "2026-01-14");
  assert.equal(legacy.customerDate, "2026-04-09");
});

test("ordena Producción por Fecha Cliente", () => {
  const laterHeaderButEarlierCustomer = context.mapProductionOrder("1", {
    sap: { Prod_DocEntry: 1, "Production Order": 1, "Target Day Línea SO": "2026-05-01", "Fecha Comprometida SO": "2026-01-01" }
  });
  const earlierHeaderButLaterCustomer = context.mapProductionOrder("2", {
    sap: { Prod_DocEntry: 2, "Production Order": 2, "Target Day Línea SO": "2026-06-01", "Fecha Comprometida SO": "2025-12-01" }
  });

  assert.ok(context.compareProductionOrders(laterHeaderButEarlierCustomer, earlierHeaderButLaterCustomer) < 0);
});

test("renderer presenta Fecha Cliente y deja de usar el encabezado anterior", () => {
  assert.match(uiSource, /<th>Fecha Cliente<\/th>/);
  assert.match(uiSource, /formatProductionCalendarDate\(order\.customerDate\)/);
  assert.doesNotMatch(uiSource, /<th>Fecha compromiso SO<\/th>/i);
});

test("semáforo de Fecha Cliente respeta todos los límites calendario", () => {
  const today = new Date(2026, 6, 16, 15, 30);
  const dateAt = days => {
    const date = new Date(2026, 6, 16 + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const expected = [
    [-1, "Atrasada", "rojo"],
    [0, "Urgente", "naranja"],
    [30, "Urgente", "naranja"],
    [31, "Próxima", "amarillo"],
    [90, "Próxima", "amarillo"],
    [91, "En plazo", "verde"]
  ];
  for (const [days, label, cssClass] of expected) {
    const result = context.getProductionCustomerDateStatus(dateAt(days), today);
    assert.equal(result.days, days);
    assert.equal(result.label, label);
    assert.equal(result.cssClass, cssClass);
  }
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.getProductionCustomerDateStatus(null, today))),
    { key: "no-date", label: "Sin fecha", cssClass: "gris", days: null }
  );
});

test("semáforo interpreta YYYY-MM-DD como fecha calendario sin desplazamiento UTC", () => {
  const status = context.getProductionCustomerDateStatus("2026-07-16", new Date(2026, 6, 16, 23, 59));
  assert.equal(status.days, 0);
  assert.equal(status.label, "Urgente");
});

test("filtros de materiales se combinan con búsqueda, estado, semáforo y cliente", () => {
  const orders = [
    { productionOrder: 1, product: "Ensamble A", customer: "Cliente A", status: "Liberada", customerDate: "2099-01-01", materialClassification: "ready" },
    { productionOrder: 2, product: "Ensamble B", customer: "Cliente B", status: "Liberada", customerDate: "2026-07-20", materialClassification: "waiting" }
  ];
  assert.equal(context.filterProductionOrders(orders, { materials: "all" }).length, 2);
  assert.deepEqual(Array.from(context.filterProductionOrders(orders, { materials: "ready" }), order => order.productionOrder), [1]);
  assert.deepEqual(Array.from(context.filterProductionOrders(orders, { materials: "waiting" }), order => order.productionOrder), [2]);
  assert.deepEqual(Array.from(context.filterProductionOrders(orders, {
    materials: "ready", search: "ensamble a", status: "Liberada", trafficLight: "En plazo", customer: "Cliente A"
  }), order => order.productionOrder), [1]);
  assert.equal(context.filterProductionOrders(orders, { materials: "ready", customer: "Cliente B" }).length, 0);
});

test("conserva la OT pero bloquea materiales si las identidades no coinciden", () => {
  const order = context.mapProductionOrder("4467", { sap: { Prod_DocEntry: 11873 } });
  assert.equal(order.identitySafe, false);
  assert.equal(order.documentId, "4467");
});

test("relaciona un componente solo con la OT padre y la clave SAP", () => {
  const component = context.mapProductionComponent({
    id: "0",
    data: () => ({ sap: { Prod_DocEntry: 4467, Prod_LineNum: 0, "Cantidad Pendiente": 2, "Stock Disponible": 0 } }),
    ref: { path: "productionOrders/4467/components/0", parent: { parent: { id: "4467" } } }
  }, "4467");

  assert.equal(component.productionOrderId, "4467");
  assert.equal(component.prodDocEntry, "4467");
  assert.equal(component.prodLineNum, "0");
  assert.equal(component.noStock, true);
});

test("conserva la información de abastecimiento del componente", () => {
  const component = context.mapProductionComponent({
    id: "1",
    data: () => ({ sap: {
      Prod_DocEntry: 4505,
      Prod_LineNum: 1,
      "Item No.": "SS-32-TA-F32-150",
      "Tiene Compra": "Sí",
      "Cantidad Compra Abierta": 2,
      "Número de Compras Abiertas": 1,
      "Primera Orden de Compra": 20865,
      Proveedor: "SWGLK",
      "Fecha Despacho Proveedor": "2026-07-29",
      "Fecha Estimada Llegada Taller": "2026-08-10",
      "Cobertura Compra": "Total",
      "Estado Componente": "En tránsito"
    } }),
    ref: { path: "productionOrders/4505/components/1", parent: { parent: { id: "4505" } } }
  }, "4505");

  assert.equal(component.hasPurchase, "Sí");
  assert.equal(component.openPurchaseQuantity, 2);
  assert.equal(component.openPurchaseCount, 1);
  assert.equal(component.firstPurchaseOrder, 20865);
  assert.equal(component.supplier, "SWGLK");
  assert.equal(component.supplierDispatchDate, "2026-07-29");
  assert.equal(component.workshopArrivalDate, "2026-08-10");
  assert.equal(component.arrivalDate, "2026-08-10");
  assert.equal(component.purchaseCoverage, "Total");
  assert.equal(component.status, "En tránsito");
});

test("Disponible para OT suma pickings, respeta requerimiento y nunca es negativo", () => {
  assert.equal(context.calculateProductionAvailableForOrder({
    required: 2, pending: 2, stockAvailable: 0, pickingCount: 2, pickedQuantity: 3
  }), 2);
  assert.equal(context.calculateProductionAvailableForOrder({
    required: 4, pending: 2, stockAvailable: 5, pickingCount: 0, pickedQuantity: 0
  }), 2);
  assert.equal(context.calculateProductionAvailableForOrder({
    required: 4, pending: 2, stockAvailable: -3, pickingCount: 0, pickedQuantity: 0
  }), 0);
});

test("Disponible para OT distingue pickings pendientes y cantidad released", () => {
  assert.equal(context.calculateProductionAvailableForOrder({
    required: 2, pending: 2, stockAvailable: 0, pickingCount: 1, pickedQuantity: 0
  }), "Ready to Pick");
  assert.equal(context.calculateProductionAvailableForOrder({
    required: 2, pending: 2, stockAvailable: 0, pickingCount: 0, pickedQuantity: 0, releasedQuantity: 1
  }), "Ready to Pick");
});

test("agrupa todos los pickings por Prod_LineNum", () => {
  const picking = (id, line, quantity) => ({
    id,
    data: () => ({ sap: { Prod_LineNum: line, "Cantidad Pickeada": quantity } }),
    ref: { path: `productionOrders/4505/pickings/${id}`, parent: { parent: { id: "4505" } } }
  });
  const summary = context.summarizeProductionPickings([
    picking("100_0", 6, 0.5), picking("101_0", 6, 0.5), picking("102_0", 4, 1)
  ], "4505");

  assert.equal(summary.get("6").count, 2);
  assert.equal(summary.get("6").pickedQuantity, 1);
  assert.equal(summary.get("6").coveredQuantity, 1);
  assert.equal(summary.get("4").pickedQuantity, 1);
});

test("excluye solamente los códigos internos aprobados tras normalizarlos", () => {
  for (const code of [
    "mano   de óbra", "PRUEBAS", "REPORTE/LEVANTAMIENTO CILINDROS", " SOPORTES ",
    "insumos", "GRABADO LÁSER", "EMBALADO", "diseño", "CERTIFICADOS"
  ]) assert.equal(context.isProductionInternalResource({ code }), true, code);
  assert.equal(context.isProductionInternalResource({ code: "MANO DE OBRA EXTRA" }), false);
  assert.equal(context.isProductionInternalResource({ code: "REPORTE LEVANTAMIENTO CILINDROS" }), false);
});

test("clasifica lista una OT con todos sus componentes entregados", () => {
  assert.equal(context.classifyProductionOrderComponents([
    { code: "ITEM-1", pending: 0, status: "Entregado completo a PSI" },
    { code: "ITEM-2", pending: 0, status: "Otro" }
  ]), "ready");
});

test("clasifica lista una OT con cobertura completa de picking", () => {
  assert.equal(context.classifyProductionOrderComponents([
    { code: "ITEM-1", pending: 3, pickingCount: 1, pickingCoveredQuantity: 3 }
  ]), "ready");
});

test("mantiene esperando una OT con picking parcial", () => {
  assert.equal(context.classifyProductionOrderComponents([
    { code: "ITEM-1", pending: 3, pickingCount: 1, pickingCoveredQuantity: 2 }
  ]), "waiting");
});

test("compra futura no vuelve lista una OT", () => {
  assert.equal(context.classifyProductionOrderComponents([
    { code: "ITEM-1", pending: 2, pickingCount: 0, pickingCoveredQuantity: 0, hasPurchase: "Sí", workshopArrivalDate: "2026-08-10" }
  ]), "waiting");
});

test("stock disponible sin picking no vuelve lista una OT", () => {
  assert.equal(context.classifyProductionOrderComponents([
    { code: "ITEM-1", pending: 2, available: 10, pickingCount: 0, pickingCoveredQuantity: 0 }
  ]), "waiting");
});

test("OT sin componentes físicos queda lista", () => {
  assert.equal(context.classifyProductionOrderComponents([
    { code: "MANO DE OBRA", pending: 5 }, { code: "DISEÑO", pending: 2 }
  ]), "ready");
});

test("indicadores cumplen abiertas igual a listas más esperando", () => {
  const orders = [
    { materialState: "loaded", materialClassification: "ready" },
    { materialState: "loaded", materialClassification: "waiting" },
    { materialState: "error", materialClassification: "waiting" }
  ];
  const kpis = context.calculateProductionKPIs(orders, orders.length, false);
  assert.equal(kpis.totalOpen, 3);
  assert.equal(kpis.ready, 1);
  assert.equal(kpis.waitingMaterials, 2);
  assert.equal(kpis.totalOpen, kpis.ready + kpis.waitingMaterials);
});

test("limita la concurrencia de la precarga", async () => {
  let active = 0;
  let maximum = 0;
  await context.runProductionWithConcurrency([1, 2, 3, 4, 5, 6], 3, async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 1));
    active -= 1;
  });
  assert.equal(maximum, 3);
});

test("precarga automáticamente después del primer render y reutiliza caché", () => {
  assert.match(productionSource, /renderProductionModule\(\);[\s\S]*await preloadProductionMaterials\(activePage\.orders\)/);
  assert.match(productionSource, /PRODUCTION_MATERIAL_CONCURRENCY = 5/);
  assert.match(source, /productionComponentsCache\.has\(normalizedId\)/);
  assert.match(source, /productionComponentsRequests\.has\(normalizedId\)/);
  assert.match(source, /duplicateQueriesAvoided/);
  assert.doesNotMatch(source, /collectionGroup/);
});

test("tabla desplegada conserva exactamente las seis columnas aprobadas", () => {
  const html = context.renderProductionComponents({
    materialState: "loaded",
    components: [{
      code: "SS-32-TA-F32-150",
      description: "Adaptador",
      required: 2,
      available: 0,
      availableForOrder: 2,
      status: "En tránsito",
      workshopArrivalDate: "2026-08-10",
      hasPurchase: true,
      openPurchaseQuantity: 2,
      openPurchaseCount: 1,
      firstPurchaseOrder: 20865,
      supplier: "SWGLK",
      supplierDispatchDate: "2026-07-29",
      purchaseCoverage: "Total"
    }]
  });

  for (const expected of [
    "Código SAP", "Ensamble / componente", "Cantidad requerida", "Disponible para OT", "Estado", "Fecha llegada taller",
    "SS-32-TA-F32-150", "10/08/2026", "En tránsito"
  ]) assert.match(html, new RegExp(expected));
  assert.equal((html.match(/<th>/g) || []).length, 6);
  assert.doesNotMatch(html, /Tiene compra|Cantidad compra abierta|Número de compras abiertas|Proveedor|Fecha despacho proveedor|Primera orden de compra|Cobertura compra/i);
  assert.doesNotMatch(html, /SWGLK|29\/07\/2026/);
});

test("oculta la fecha futura de componentes resueltos", () => {
  const html = context.renderProductionComponents({
    materialState: "loaded",
    components: [{
      code: "ITEM-1", description: "Entregado", required: 1, availableForOrder: 1,
      status: "Entregado completo a PSI", workshopArrivalDate: "2026-08-10", hasPurchase: "Sí",
      openPurchaseQuantity: 2, openPurchaseCount: 1, supplier: "SWGLK", supplierDispatchDate: "2026-07-29"
    }]
  });
  assert.doesNotMatch(html, /SWGLK|29\/07\/2026|10\/08\/2026/);
  assert.equal((html.match(/>—<\/td>/g) || []).length, 1);
});

test("mantiene la llegada a taller visible para componentes pendientes", () => {
  const html = context.renderProductionComponents({
    materialState: "loaded",
    components: [{
      code: "ITEM-1", description: "Pendiente", required: 1, availableForOrder: 0,
      status: "En tránsito", workshopArrivalDate: "2026-08-10", hasPurchase: "Sí",
      openPurchaseQuantity: 2, openPurchaseCount: 1, supplier: "SWGLK", supplierDispatchDate: "2026-07-29"
    }]
  });
  assert.match(html, /10\/08\/2026/);
  assert.doesNotMatch(html, /SWGLK|29\/07\/2026/);
});

test("cabecera superior conserva solo tres indicadores", () => {
  const html = context.renderProductionKPIs({ totalOpen: 10, ready: 4, waitingMaterials: 6, calculating: false });
  assert.match(html, /OT abiertas/);
  assert.match(html, /OT listas para armar/);
  assert.match(html, /Esperando materiales/);
  assert.doesNotMatch(html, /Componentes pendientes|Componentes sin stock/);
  assert.match(context.renderProductionKPIs({ totalOpen: 10, ready: 0, waitingMaterials: 10, calculating: true }), /Calculando…/);
  assert.match(uiSource, /calculateProductionKPIs\(orders, PRODUCTION_KPIS\?\.total, PRODUCTION_KPIS\?\.calculating\)/);
});

test("tarjetas KPI son filtros accesibles con estado activo", () => {
  context.PRODUCTION_FILTERS.materials = "ready";
  const html = context.renderProductionKPIs({ totalOpen: 17, ready: 9, waitingMaterials: 8, calculating: false });
  assert.equal((html.match(/<button/g) || []).length, 3);
  assert.match(html, /setProductionMaterialFilter\('all'\)/);
  assert.match(html, /setProductionMaterialFilter\('ready'\)/);
  assert.match(html, /setProductionMaterialFilter\('waiting'\)/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /class="planning-kpi-card production-kpi-filter is-active"/);
  context.PRODUCTION_FILTERS.materials = "all";
});

test("fila de OT es compacta y usa un botón expandible sin botones anidados", () => {
  const html = context.renderProductionTable([{
    id: "4505", documentId: "4505", productionOrder: 11884, customer: "Cliente", product: "Producto con descripción extensa",
    status: "Liberada", customerDate: "2099-01-01", targetDate: "2099-01-02", materialState: "loaded",
    materialClassification: "waiting", componentsExpanded: false, components: []
  }]);
  assert.equal((html.match(/<th>/g) || []).length, 9);
  assert.match(html, /class="production-cell-clamp"[^>]*title="Producto con descripción extensa"/);
  assert.match(html, /<button[\s\S]*aria-expanded="false"[\s\S]*aria-controls="production-components-4505"/);
  assert.doesNotMatch(html, /<button[^>]*>[\s\S]*<button/);
  assert.match(html, /production-date-verde/);
  assert.match(html, /En plazo/);
  assert.match(html, /Esperando materiales/);
});

test("selector de semáforo usa exclusivamente las cinco categorías centrales", () => {
  const html = context.renderProductionFilters([]);
  for (const label of ["Todos", "En plazo", "Próxima", "Urgente", "Atrasada", "Sin fecha"]) assert.match(html, new RegExp(label));
  assert.doesNotMatch(html, /Verde|Amarillo|Naranja|Rojo|Gris/);
  assert.match(engineSource, /getProductionCustomerDateStatus\(order\.customerDate\)/);
});

test("filtros y tarjetas reinician paginación y limpiar vuelve a OT abiertas", () => {
  assert.match(productionSource, /function updateProductionFilter[\s\S]*PRODUCTION_CURRENT_PAGE = 1/);
  assert.match(productionSource, /function setProductionMaterialFilter[\s\S]*PRODUCTION_CURRENT_PAGE = 1/);
  assert.match(productionSource, /function clearProductionFilters[\s\S]*materials: "all"[\s\S]*PRODUCTION_CURRENT_PAGE = 1/);
});

test("expandir datos precargados actualiza solo la OT y no recalcula KPI", () => {
  assert.match(productionSource, /if \(order\.materialState === "loaded"\)[\s\S]*updateProductionOrderExpansion\(order\);[\s\S]*return;/);
  assert.match(uiSource, /function updateProductionOrderExpansion/);
  assert.doesNotMatch(uiSource.match(/function updateProductionOrderExpansion[\s\S]*?\n}/)?.[0] || "", /renderProductionModule\(\)/);
});

test("tabla amplia mantiene desplazamiento horizontal para móvil", () => {
  assert.match(styleSource, /\.production-table-wrap\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(styleSource, /@media\s*\(max-width:\s*520px\)/);
});

test("la carga inicial no contiene collectionGroup", () => {
  assert.doesNotMatch(source, /collectionGroup/);
  assert.match(source, /collection\(db, "productionOrders"\)/);
  assert.match(source, /collection\(db, "productionOrders", normalizedId, "components"\)/);
});

test("define el universo productivo por Fecha Contabilizacion OT y no por IDs", () => {
  assert.match(source, /sap\.Fecha Contabilizacion OT/);
  assert.match(source, /2026-01-01/);
  assert.match(source, /2027-01-01/);
  assert.doesNotMatch(source, /Prod_DocEntry\s*[>=<]/);
});
