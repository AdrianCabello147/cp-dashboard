function renderProductionModule(orders) {
  const container = document.getElementById("produccionModule");

  if (!container) return;

  const kpis = calculateProductionKPIs(orders);
  const groupedOrders = groupProductionOrdersByStatus(orders);
  const statuses = Object.keys(groupedOrders);

  container.innerHTML = `
    <section class="planning-hero">
      <div>
        <h2>Producción</h2>
        <p>Control local de órdenes de trabajo PSI por estado de fabricación.</p>
      </div>
    </section>

    ${renderProductionKPIs(kpis)}

    <section class="planning-weekly">
      <div class="planning-weekly-header">
        <div>
          <h3>Tablero de Producción</h3>
          <p>Órdenes agrupadas por estado operacional.</p>
        </div>
        <span>${orders.length} OT</span>
      </div>

      ${renderProductionAccordionControls(statuses)}
      ${renderProductionBoard(groupedOrders)}
    </section>
  `;
}

function renderProductionKPIs(kpis) {
  const items = [
    ["Total OT", kpis.total],
    ["Pendiente revisión", kpis.pendingReview],
    ["Materiales pendientes", kpis.waitingMaterials],
    ["En fabricación", kpis.inFabrication],
    ["En prueba", kpis.inTest],
    ["Atrasadas", kpis.overdue],
    ["Entregadas", kpis.delivered]
  ];

  return `
    <section class="planning-kpis">
      ${items.map(([label, value]) => `
        <article class="planning-kpi-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </article>
      `).join("")}
    </section>
  `;
}

function renderProductionAccordionControls(statuses) {
  const escapedStatuses = statuses.map(escapeProductionAttribute);

  return `
    <div class="planning-accordion-controls">
      <button type="button" class="task-action-btn" onclick="setProductionSectionsCollapsed([${escapedStatuses.join(",")}], false)">
        Expandir todo
      </button>
      <button type="button" class="task-action-btn" onclick="setProductionSectionsCollapsed([${escapedStatuses.join(",")}], true)">
        Contraer todo
      </button>
    </div>
  `;
}

function renderProductionBoard(groupedOrders) {
  return `
    <section class="planning-board">
      ${Object.entries(groupedOrders).map(([status, orders]) => renderProductionColumn(status, orders)).join("")}
    </section>
  `;
}

function renderProductionColumn(status, orders) {
  const collapsed = isProductionSectionCollapsed(status);

  return `
    <article class="planning-column ${collapsed ? "is-collapsed" : ""}">
      <button type="button" class="planning-column-header planning-accordion-header" onclick="toggleProductionSection('${escapeProductionHtml(status)}')">
        <h3>
          <span class="planning-accordion-arrow">▼</span>
          ${escapeProductionHtml(status)}
        </h3>
        <span>${orders.length} OT</span>
      </button>

      <div class="planning-accordion-content">
        ${
          orders.length === 0
            ? `<div class="comments-empty">Sin órdenes en este estado.</div>`
            : orders.map(renderProductionCard).join("")
        }
      </div>
    </article>
  `;
}

function renderProductionCard(order) {
  const overdueClass = isProductionOrderOverdue(order) ? "task-card-paused" : "";

  return `
    <article class="task-card ${getProductionPriorityClass(order.priority)} ${overdueClass}">
      <div class="task-card-header">
        <div class="task-title-block">
          <strong>${escapeProductionHtml(order.productionOrder)}</strong>
          <p>${escapeProductionHtml(order.psiCode)}</p>
        </div>
        <span class="task-priority ${getProductionPriorityClass(order.priority)}">
          ${escapeProductionHtml(order.priority)}
        </span>
      </div>

      <div class="task-context">
        <span>${escapeProductionHtml(order.customer)}</span>
        <span>${escapeProductionHtml(order.description)}</span>
      </div>

      <div class="task-meta">
        <span>Cantidad: ${escapeProductionHtml(order.quantity)}</span>
        <span>Responsable: ${escapeProductionHtml(order.responsible)}</span>
        <span>Target Day: ${escapeProductionHtml(order.targetDate)}</span>
      </div>
    </article>
  `;
}

function getProductionPriorityClass(priority) {
  const normalized = (priority || "").toLowerCase();

  if (normalized === "alta") return "priority-high";
  if (normalized === "media") return "priority-medium";
  if (normalized === "baja") return "priority-low";

  return "priority-normal";
}

function escapeProductionHtml(value) {
  return (value ?? "").toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeProductionAttribute(value) {
  return `'${escapeProductionHtml(value)}'`;
}
