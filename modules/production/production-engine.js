const PRODUCTION_STATUSES = [
  "Pendiente revisión",
  "Materiales pendientes",
  "Lista para fabricar",
  "En fabricación",
  "En prueba",
  "Documentación",
  "Cerrada",
  "Entregada"
];

const PRODUCTION_MOCK_ORDERS = [
  {
    id: "PO-001",
    productionOrder: "OT 12045",
    psiCode: "PSI-26-0018",
    customer: "Codelco",
    description: "Banco de pruebas hidráulico",
    quantity: 1,
    responsible: "Juan Carlos",
    targetDate: "2026-07-08",
    priority: "Alta",
    status: "Pendiente revisión"
  },
  {
    id: "PO-002",
    productionOrder: "OT 12031",
    psiCode: "PSI-26-0020",
    customer: "ENAP",
    description: "Cilindros de muestreo",
    quantity: 8,
    responsible: "Santiago",
    targetDate: "2026-07-11",
    priority: "Media",
    status: "Materiales pendientes"
  },
  {
    id: "PO-003",
    productionOrder: "OT 12047",
    psiCode: "PSI-26-0030",
    customer: "Metrogas",
    description: "Panel de regulación para gas",
    quantity: 2,
    responsible: "David",
    targetDate: "2026-07-10",
    priority: "Baja",
    status: "Lista para fabricar"
  },
  {
    id: "PO-004",
    productionOrder: "OT 12052",
    psiCode: "PSI-26-0033",
    customer: "Oxiquim",
    description: "Skid de nitrógeno",
    quantity: 1,
    responsible: "Juan Carlos",
    targetDate: "2026-07-07",
    priority: "Alta",
    status: "En fabricación"
  },
  {
    id: "PO-005",
    productionOrder: "OT 12058",
    psiCode: "PSI-26-0039",
    customer: "Lipigas",
    description: "Flexibles de transferencia",
    quantity: 12,
    responsible: "Santiago",
    targetDate: "2026-07-14",
    priority: "Media",
    status: "En prueba"
  },
  {
    id: "PO-006",
    productionOrder: "OT 12061",
    psiCode: "PSI-26-0041",
    customer: "Anglo American",
    description: "Manifold para instrumentación",
    quantity: 3,
    responsible: "David",
    targetDate: "2026-07-15",
    priority: "Alta",
    status: "Documentación"
  },
  {
    id: "PO-007",
    productionOrder: "OT 12066",
    psiCode: "PSI-26-0044",
    customer: "SQM",
    description: "Gabinete de válvulas",
    quantity: 1,
    responsible: "Juan Carlos",
    targetDate: "2026-07-05",
    priority: "Alta",
    status: "Cerrada"
  },
  {
    id: "PO-008",
    productionOrder: "OT 12070",
    psiCode: "PSI-26-0048",
    customer: "Aguas Andinas",
    description: "Rack de calibración",
    quantity: 1,
    responsible: "Santiago",
    targetDate: "2026-07-03",
    priority: "Media",
    status: "Entregada"
  },
  {
    id: "PO-009",
    productionOrder: "OT 12073",
    psiCode: "PSI-26-0050",
    customer: "CMPC",
    description: "Línea de aire instrumental",
    quantity: 4,
    responsible: "David",
    targetDate: "2026-07-18",
    priority: "Normal",
    status: "Materiales pendientes"
  },
  {
    id: "PO-010",
    productionOrder: "OT 12079",
    psiCode: "PSI-26-0054",
    customer: "Minera Los Pelambres",
    description: "Panel de purga y venteo",
    quantity: 2,
    responsible: "Juan Carlos",
    targetDate: "2026-07-20",
    priority: "Alta",
    status: "En fabricación"
  }
];

const PRODUCTION_COLLAPSE_STATE = {};

function getProductionOrders() {
  return PRODUCTION_MOCK_ORDERS;
}

function calculateProductionKPIs(orders) {
  return {
    total: orders.length,
    pendingReview: countProductionByStatus(orders, "Pendiente revisión"),
    waitingMaterials: countProductionByStatus(orders, "Materiales pendientes"),
    inFabrication: countProductionByStatus(orders, "En fabricación"),
    inTest: countProductionByStatus(orders, "En prueba"),
    overdue: orders.filter(isProductionOrderOverdue).length,
    delivered: countProductionByStatus(orders, "Entregada")
  };
}

function countProductionByStatus(orders, status) {
  return orders.filter(order => order.status === status).length;
}

function groupProductionOrdersByStatus(orders) {
  const grouped = {};

  PRODUCTION_STATUSES.forEach(status => {
    grouped[status] = [];
  });

  orders.forEach(order => {
    const status = order.status || "Pendiente revisión";

    if (!grouped[status]) {
      grouped[status] = [];
    }

    grouped[status].push(order);
  });

  return grouped;
}

function isProductionOrderOverdue(order) {
  const targetDate = parseProductionDate(order.targetDate);

  if (!targetDate || order.status === "Cerrada" || order.status === "Entregada") return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return targetDate < today;
}

function parseProductionDate(value) {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function toggleProductionSection(status) {
  PRODUCTION_COLLAPSE_STATE[status] = !isProductionSectionCollapsed(status);
  refreshProductionModule();
}

function isProductionSectionCollapsed(status) {
  return Boolean(PRODUCTION_COLLAPSE_STATE[status]);
}

function setProductionSectionsCollapsed(statuses, collapsed) {
  statuses.forEach(status => {
    PRODUCTION_COLLAPSE_STATE[status] = collapsed;
  });

  refreshProductionModule();
}
