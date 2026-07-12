function productionContainer() {
  return document.getElementById("produccionModule");
}

function renderProductionLoading() {
  const container = productionContainer();
  if (container) container.innerHTML = `<section class="planning-weekly"><p>Cargando órdenes abiertas y materiales...</p></section>`;
}

function renderProductionRestricted() {
  const container = productionContainer();
  if (container) container.innerHTML = `<section class="planning-weekly"><div class="comments-empty">Acceso restringido</div></section>`;
}

function renderProductionError(error) {
  const container = productionContainer();
  if (!container) return;

  const code = error?.code || "";
  const message = code.includes("permission-denied")
    ? "No tienes permisos para consultar Producción."
    : code.includes("unavailable")
      ? "Error de red al consultar Firestore."
      : "No fue posible cargar Producción.";

  container.innerHTML = `
    <section class="planning-weekly">
      <div class="comments-empty">
        <p>${escapeProductionHtml(message)}</p>
        <button class="task-action-btn" onclick="loadProductionPage()">Reintentar</button>
      </div>
    </section>
  `;
}

function renderProductionModule() {
  const container = productionContainer();
  if (!container || !PRODUCTION_PAGE) return;

  const orders = PRODUCTION_PAGE.orders;
  const visibleOrders = filterProductionOrders(orders, PRODUCTION_FILTERS);
  const kpis = calculateProductionKPIs(orders, PRODUCTION_KPIS?.total);

  container.innerHTML = `
    <section class="planning-hero">
      <div>
        <h2>Producción</h2>
        <p>OT abiertas esperando fabricación y disponibilidad de materiales.</p>
      </div>
    </section>

    ${renderProductionKPIs(kpis)}
    ${renderProductionFilters(orders)}

    <section class="planning-weekly">
      <div class="planning-weekly-header">
        <div>
          <h3>OT abiertas</h3>
          <p>Materiales calculados para esta página de hasta 25 OT.</p>
        </div>
        <span>${visibleOrders.length} de ${orders.length} OT</span>
      </div>

      ${visibleOrders.length
        ? renderProductionTable(visibleOrders)
        : `<div class="comments-empty">No hay OT abiertas para los filtros seleccionados.</div>`}

      ${renderProductionPagination()}
    </section>
  `;
}

function renderProductionKPIs(kpis) {
  const items = [
    ["OT abiertas", kpis.totalOpen],
    ["Listas para fabricar", kpis.ready],
    ["Esperando materiales", kpis.waitingMaterials],
    ["Componentes pendientes", kpis.pendingComponents],
    ["Componentes sin stock", kpis.noStockComponents]
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

function renderProductionFilters(orders) {
  return `
    <section class="production-filters">
      <label class="production-filter">
        Buscar
        <input
          type="search"
          value="${escapeProductionHtml(PRODUCTION_FILTERS.search)}"
          placeholder="OT, cliente, producto..."
          oninput="updateProductionFilter('search', this.value)"
        >
      </label>

      <label class="production-filter">
        Estado
        <select onchange="updateProductionFilter('status', this.value)">
          <option value="">Todos</option>
          ${renderProductionFilterOptions(getProductionFilterOptions(orders, "status"), PRODUCTION_FILTERS.status)}
        </select>
      </label>

      <label class="production-filter">
        Semáforo
        <select onchange="updateProductionFilter('trafficLight', this.value)">
          <option value="">Todos</option>
          ${renderProductionFilterOptions(getProductionFilterOptions(orders, "trafficLight"), PRODUCTION_FILTERS.trafficLight)}
        </select>
      </label>

      <label class="production-filter">
        Cliente
        <select onchange="updateProductionFilter('customer', this.value)">
          <option value="">Todos</option>
          ${renderProductionFilterOptions(getProductionFilterOptions(orders, "customer"), PRODUCTION_FILTERS.customer)}
        </select>
      </label>

      <button type="button" class="secondary-btn planning-clear-filters" onclick="clearProductionFilters()">
        Limpiar filtros
      </button>
    </section>
  `;
}

function renderProductionFilterOptions(options, selectedValue) {
  return options.map(option => `
    <option value="${escapeProductionHtml(option)}" ${option === selectedValue ? "selected" : ""}>
      ${escapeProductionHtml(option)}
    </option>
  `).join("");
}

function renderProductionTable(orders) {
  return `
    <div class="production-table-wrap">
      <table class="production-table">
        <thead>
          <tr>
            <th>Production Order</th>
            <th>Cliente</th>
            <th>Producto</th>
            <th>Estado</th>
            <th>Fecha compromiso</th>
            <th>Días restantes</th>
            <th>OTD</th>
            <th>Total comp.</th>
            <th>Pendientes</th>
            <th>Sin stock</th>
            <th>Próxima llegada</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(order => renderProductionOrderRows(order)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderProductionOrderRows(order) {
  const safeId = escapeProductionHtml(order.id);

  return `
    <tr
      class="production-order-row"
      tabindex="0"
      onclick="toggleProductionComponents('${safeId}')"
      onkeydown="if(event.key === 'Enter') toggleProductionComponents('${safeId}')"
    >
      <td>${escapeProductionHtml(order.productionOrder)}</td>
      <td>${escapeProductionHtml(order.customer)}</td>
      <td>${escapeProductionHtml(order.product)}</td>
      <td>${escapeProductionHtml(order.status)}</td>
      <td>${formatProductionDate(order.salesOrderCommitmentDate)}</td>
      <td>${escapeProductionHtml(productionDaysRemaining(order.salesOrderCommitmentDate))}</td>
      <td><span class="task-priority production-light-${order.trafficLight.toLowerCase()}">${escapeProductionHtml(order.trafficLight)}</span></td>
      <td>${order.totalComponents}</td>
      <td>${order.pendingComponents}</td>
      <td>${order.noStockComponents}</td>
      <td>${formatProductionDate(order.nextArrival)}</td>
    </tr>
    <tr id="production-components-${safeId}" class="production-components-row" hidden>
      <td colspan="11">${renderProductionComponents(order.components)}</td>
    </tr>
  `;
}

function renderProductionComponents(components) {
  if (!components.length) return `<div class="comments-empty">Sin componentes informados.</div>`;

  return `
    <table class="production-components-table">
      <thead>
        <tr>
          <th>Código SAP</th>
          <th>Descripción</th>
          <th>Cantidad requerida</th>
          <th>Cantidad disponible</th>
          <th>Estado</th>
          <th>Fecha llegada taller</th>
        </tr>
      </thead>
      <tbody>
        ${components.map(component => `
          <tr>
            <td>${escapeProductionHtml(component.code)}</td>
            <td>${escapeProductionHtml(component.description)}</td>
            <td>${escapeProductionHtml(component.required)}</td>
            <td>${escapeProductionHtml(component.available)}</td>
            <td>${escapeProductionHtml(component.status)}</td>
            <td>${formatProductionDate(component.arrivalDate)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function toggleProductionComponents(id) {
  const row = document.getElementById(`production-components-${id}`);
  if (row) row.hidden = !row.hidden;
}

function renderProductionPagination() {
  return `
    <div class="production-pagination">
      <button class="task-action-btn" ${!PRODUCTION_PAGE.hasPrevious ? "disabled" : ""} onclick="loadProductionPage(PRODUCTION_PAGE.first, 'previous')">Anterior</button>
      <span>Hasta 25 OT por página</span>
      <button class="task-action-btn" ${!PRODUCTION_PAGE.hasNext ? "disabled" : ""} onclick="loadProductionPage(PRODUCTION_PAGE.last, 'next')">Siguiente</button>
    </div>
  `;
}
