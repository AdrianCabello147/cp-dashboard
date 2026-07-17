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
  const detail = error?.message || "";
  const message = code.includes("permission-denied")
    ? "No tienes permisos para consultar Producción."
    : code.includes("failed-precondition")
      ? "Falta aprobar un índice de Firestore para Producción."
    : code.includes("unavailable")
      ? "Error de red al consultar Firestore."
      : "No fue posible cargar Producción.";

  container.innerHTML = `
    <section class="planning-weekly">
      <div class="comments-empty">
        <p>${escapeProductionHtml(message)}</p>
        ${detail || code ? `<p class="production-error-detail">${escapeProductionHtml(code || detail)}</p>` : ""}
        <button class="task-action-btn" onclick="loadProductionPage()">Reintentar</button>
      </div>
    </section>
  `;
}

function renderProductionModule() {
  const container = productionContainer();
  if (!container || !PRODUCTION_PAGE) return;

  const orders = PRODUCTION_PAGE.orders;
  const filteredOrders = filterProductionOrders(orders, PRODUCTION_FILTERS);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PRODUCTION_LOCAL_PAGE_SIZE));
  PRODUCTION_CURRENT_PAGE = Math.min(PRODUCTION_CURRENT_PAGE, totalPages);
  const visibleOrders = filteredOrders.slice((PRODUCTION_CURRENT_PAGE - 1) * PRODUCTION_LOCAL_PAGE_SIZE, PRODUCTION_CURRENT_PAGE * PRODUCTION_LOCAL_PAGE_SIZE);
  const kpis = calculateProductionKPIs(orders, PRODUCTION_KPIS?.total, PRODUCTION_KPIS?.calculating);

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
          <p>${PRODUCTION_PAGE.productiveTotal} OT productivas · ${PRODUCTION_PAGE.closedTotal} cerradas · indicadores de materiales sobre ${kpis.loadedOrders} OT cargadas.</p>
        </div>
        <span>Mostrando ${visibleOrders.length} de ${filteredOrders.length} OT abiertas · página ${PRODUCTION_CURRENT_PAGE}/${totalPages}</span>
      </div>

      ${visibleOrders.length
        ? renderProductionTable(visibleOrders)
        : `<div class="comments-empty">No hay OT abiertas para los filtros seleccionados.</div>`}

      ${renderProductionPagination(totalPages)}
    </section>
  `;
}

function renderProductionKPIs(kpis) {
  const items = [
    { label: "OT abiertas", value: kpis.totalOpen, filter: "all" },
    { label: "OT listas para armar", value: kpis.calculating ? "Calculando…" : kpis.ready, filter: "ready" },
    { label: "Esperando materiales", value: kpis.calculating ? "Calculando…" : kpis.waitingMaterials, filter: "waiting" }
  ];

  return `
    <section class="planning-kpis production-kpi-filters" aria-label="Filtrar órdenes por estado de materiales">
      ${items.map(item => {
        const selected = PRODUCTION_FILTERS.materials === item.filter;
        return `
        <button
          type="button"
          class="planning-kpi-card production-kpi-filter${selected ? " is-active" : ""}"
          aria-pressed="${selected}"
          onclick="setProductionMaterialFilter('${item.filter}')"
        >
          <span>${item.label}</span>
          <strong>${item.value}</strong>
          <small>${selected ? "Filtro activo" : "Filtrar"}</small>
        </button>
      `;
      }).join("")}
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
          ${renderProductionFilterOptions(["En plazo", "Próxima", "Urgente", "Atrasada", "Sin fecha"], PRODUCTION_FILTERS.trafficLight)}
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
            <th>Producto / ensamble</th>
            <th>Estado</th>
            <th>Fecha Cliente</th>
            <th>Target Day OT</th>
            <th>Días restantes</th>
            <th>Estado de materiales</th>
            <th>Componentes</th>
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
  const dateStatus = getProductionCustomerDateStatus(order.customerDate);
  const materialLabel = getProductionMaterialStatusLabel(order);
  const componentsId = `production-components-${safeId}`;

  return `
    <tr
      class="production-order-row production-date-${dateStatus.cssClass}${order.componentsExpanded ? " is-expanded" : ""}"
      data-production-order="${safeId}"
    >
      <td class="production-order-number"><strong>${escapeProductionHtml(order.productionOrder)}</strong></td>
      <td><span class="production-cell-clamp" title="${escapeProductionHtml(order.customer)}">${escapeProductionHtml(order.customer)}</span></td>
      <td><span class="production-cell-clamp" title="${escapeProductionHtml(order.product)}">${escapeProductionHtml(order.product)}</span></td>
      <td>${escapeProductionHtml(order.status)}</td>
      <td>
        <span class="production-date-value">${formatProductionCalendarDate(order.customerDate)}</span>
        <span class="production-date-badge production-date-badge-${dateStatus.cssClass}"><span aria-hidden="true"></span>${dateStatus.label}</span>
      </td>
      <td>${formatProductionCalendarDate(order.targetDate)}</td>
      <td>${escapeProductionHtml(dateStatus.days ?? "—")}</td>
      <td><span class="production-material-status production-material-${order.materialClassification || "loading"}">${escapeProductionHtml(materialLabel)}</span></td>
      <td>
        <button
          id="production-toggle-${safeId}"
          type="button"
          class="task-action-btn production-components-toggle"
          aria-expanded="${order.componentsExpanded}"
          aria-controls="${componentsId}"
          onclick="toggleProductionComponents('${safeId}')"
        >
          <span class="production-toggle-label">${order.componentsExpanded ? "Ocultar" : "Ver"}</span>
          <span class="production-toggle-chevron" aria-hidden="true">⌄</span>
        </button>
      </td>
    </tr>
    <tr id="${componentsId}" class="production-components-row" ${order.componentsExpanded ? "" : "hidden"}>
      <td colspan="9">${renderProductionComponents(order)}</td>
    </tr>
  `;
}

function getProductionMaterialStatusLabel(order) {
  if (order.materialState !== "loaded") return order.materialState === "error" ? "Error de materiales" : "Calculando…";
  return order.materialClassification === "ready" ? "Lista para armar" : "Esperando materiales";
}

function updateProductionOrderExpansion(order) {
  const details = document.getElementById(`production-components-${order.documentId}`);
  const toggle = document.getElementById(`production-toggle-${order.documentId}`);
  const row = document.querySelector(`[data-production-order="${order.documentId}"]`);
  if (!details || !toggle) return;
  details.hidden = !order.componentsExpanded;
  toggle.setAttribute("aria-expanded", String(order.componentsExpanded));
  const label = toggle.querySelector(".production-toggle-label");
  if (label) label.textContent = order.componentsExpanded ? "Ocultar" : "Ver";
  row?.classList.toggle("is-expanded", order.componentsExpanded);
}

function renderProductionDetail() {
  const container = productionContainer(); if (!container || !PRODUCTION_DETAIL) return;
  const state = PRODUCTION_DETAIL.state;
  if (state === "loading") { container.innerHTML = `<section class="planning-weekly"><p>Cargando detalle de OT…</p></section>`; return; }
  if (state !== "success" && state !== "inconsistent-data") { const message = state === "not-found" ? "No se encontró la orden de producción." : state === "permission-denied" ? "No tienes permisos para consultar esta OT." : state === "unavailable" ? "No se pudo conectar con Firestore." : "No fue posible cargar el detalle de la OT."; container.innerHTML = `<section class="planning-weekly"><button class="task-action-btn" onclick="closeProductionDetail()">Volver a Producción</button><div class="comments-empty"><p>${message}</p><button class="task-action-btn" onclick="retryProductionDetail()">Reintentar</button></div></section>`; return; }
  const d = PRODUCTION_DETAIL.detail; const field = (label, value) => `<div><span>${label}</span><strong>${escapeProductionHtml(value ?? "—")}</strong></div>`;
  container.innerHTML = `<section class="planning-hero"><button class="task-action-btn" onclick="closeProductionDetail()">Volver a Producción</button><h2>OT ${escapeProductionHtml(d.productionOrder)}</h2><p>${state === "inconsistent-data" ? "Datos inconsistentes: las subcolecciones permanecen bloqueadas." : escapeProductionHtml(d.orderStatus)}</p></section><section class="planning-kpis">${field("Estado OT", d.orderStatus)}${field("OTD", d.otdStatus)}${field("Días restantes", d.daysRemaining)}${field("Días de atraso", d.delayDays)}</section><section class="planning-weekly"><h3>Datos comerciales</h3><div class="production-detail-grid">${field("Cliente", d.customer)}${field("Vendedor", d.seller)}${field("Producto", d.product)}${field("Sales Order origen", d.salesOrderOrigin)}${field("Prod_DocEntry", d.prodDocEntry)}</div><h3>Fechas principales</h3><div class="production-detail-grid">${field("Contabilización OT", formatProductionDate(d.postingDate))}${field("Compromiso SO", formatProductionDate(d.salesOrderCommitmentDate))}${field("Target Day OT", formatProductionDate(d.productionOrderTargetDay))}${field("Término real", formatProductionDate(d.realCompletionDate))}</div><p class="comments-empty">Próximamente: Componentes · Pickings · Compras vinculadas</p></section>`;
}

function renderProductionMaterialValue(order, field) {
  return order.materialState === "loaded" ? order[field] : "No cargados";
}

function renderProductionComponents(order) {
  if (order.materialState === "loading") return `<div class="comments-empty">Cargando materiales…</div>`;
  if (order.materialState === "identity_error") return `<div class="comments-empty">Los materiales no pueden cargarse porque la identidad SAP no coincide con el documento Firestore.</div>`;
  if (order.materialState === "error") return `<div class="comments-empty">Los materiales de esta OT no pudieron cargarse.<br><button class="task-action-btn" onclick="retryProductionComponents('${escapeProductionHtml(order.documentId)}')">Reintentar</button></div>`;
  if (order.materialState !== "loaded") return `<div class="comments-empty">Materiales no cargados.</div>`;
  const components = order.components;
  if (!components.length) return `<div class="comments-empty">Esta OT no tiene componentes.</div>`;

  return `
    <table class="production-components-table">
      <thead>
        <tr>
          <th>Código SAP</th>
          <th>Ensamble / componente</th>
          <th>Cantidad requerida</th>
          <th>Disponible para OT</th>
          <th>Estado</th>
          <th>Fecha llegada taller</th>
        </tr>
      </thead>
      <tbody>
        ${components.map(component => {
          const hideSupply = isProductionSupplyIrrelevant(component);
          return `
            <tr>
              <td>${escapeProductionHtml(component.code)}</td>
              <td><span class="production-component-description" title="${escapeProductionHtml(component.description)}">${escapeProductionHtml(component.description)}</span></td>
              <td>${escapeProductionHtml(component.required)}</td>
              <td>${escapeProductionHtml(component.availableForOrder)}</td>
              <td>${escapeProductionHtml(component.status)}</td>
              <td>${hideSupply ? "—" : formatProductionCalendarDate(component.workshopArrivalDate)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function isProductionSupplyIrrelevant(component) {
  const status = normalizeProductionFilterValue(component?.status);
  return status === "entregado completo a psi" || status === "servicio interno";
}

function formatProductionYesNo(value) {
  if (value === true) return "Sí";
  if (value === false) return "No";
  const normalized = String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["si", "yes", "true", "1"].includes(normalized)) return "Sí";
  if (["no", "false", "0"].includes(normalized)) return "No";
  return value === null || value === undefined || value === "" ? "—" : value;
}

function formatProductionCalendarDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  return formatProductionDate(value);
}

function renderProductionPagination(totalPages) {
  return `
    <div class="production-pagination">
      <button class="task-action-btn" ${PRODUCTION_CURRENT_PAGE <= 1 ? "disabled" : ""} onclick="goToProductionPage(PRODUCTION_CURRENT_PAGE - 1)">Anterior</button>
      <span>${PRODUCTION_CURRENT_PAGE} de ${totalPages}</span>
      <button class="task-action-btn" ${PRODUCTION_CURRENT_PAGE >= totalPages ? "disabled" : ""} onclick="goToProductionPage(PRODUCTION_CURRENT_PAGE + 1)">Siguiente</button>
    </div>
  `;
}
