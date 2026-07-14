const PLANNING_FILTERS = {
  responsable: "",
  estado: "",
  prioridad: "",
  complejidad: "",
  search: ""
};

const PLANNING_UI_STATE = {
  unassignedPoolExpanded: false
};

const PLANNING_COLLAPSE_STATE = {
  weekly: {},
  board: {},
  completed: {}
};

const PLANNING_COMPLETED_SUMMARY_STATE = {
  collapsed: true,
  selectedWeek: ""
};
const PLANNING_OTHER_ACTIVITY = "Otro...";

const PLANNING_ACTIVITY_GROUPS = [
  {
    label: "INGENIERÍA",
    activities: [
      "Revisión plano",
      "Actualización plano",
      "Revisión BOM",
      "Actualización BOM",
      "Documentación"
    ]
  },
  {
    label: "TALLER",
    activities: [
      "Pre-ensamble",
      "Ensamble",
      "Terminar ensamble",
      "Pruebas",
      "Reparación",
      "Limpieza cilindros",
      "Grabado",
      "Inspección final"
    ]
  },
  {
    label: "COMPRAS / LOGÍSTICA",
    activities: [
      "Compra OT",
      "Compra Taller",
      "Seguimiento proveedor",
      "Recepción materiales",
      "Picking"
    ]
  },
  {
    label: "GESTIÓN",
    activities: [
      "Cotización",
      "Visita terreno",
      "Reunión técnica",
      "Capacitación",
      "Administrativo"
    ]
  },
  {
    label: "OTROS",
    activities: [
      PLANNING_OTHER_ACTIVITY
    ]
  }
];

function renderPlanningModule(tasks) {
  const container = document.getElementById("planificacionModule");

  if (!container) return;

  const operationalTasks = tasks.filter(task => !isPlanningTaskFinished(task));
  const completedTasks = tasks.filter(task => isPlanningTaskFinished(task));
  const filteredTasks = filterPlanningTasks(operationalTasks, PLANNING_FILTERS);
  const poolTasks = getPlanningUnassignedTasks(filteredTasks);
  const groupedTasks = groupPlanningTasksByUser(filteredTasks.filter(task => !isPlanningTaskAvailableForSelfAssignment(task)));
  const kpis = calculatePlanningKPIs(tasks);
  const currentISOWeekKey = getCurrentPlanningISOWeekKey();
  const weeklyTasks = getPlanningTasksForIsoWeek(
    operationalTasks.filter(task => !isPlanningTaskAvailableForSelfAssignment(task)),
    currentISOWeekKey
  );
  const weeklyCompletedTasks = getPlanningTasksForIsoWeek(completedTasks, currentISOWeekKey);
  const currentISOWeek = getCurrentPlanningISOWeek();
  ensurePlanningCompletedSummaryWeek(completedTasks);

  container.innerHTML = `
    <section class="planning-hero">
      <div>
        <h2>Planificación</h2>
        <p>Planificación semanal de actividades PSI organizada por responsable.</p>
      </div>

      <div class="planning-hero-actions">
        ${renderPlanningExportExcelAction()}
        ${renderPlanningCreateTaskAction()}
      </div>
    </section>

    ${renderPlanningDataError()}

    ${renderPlanningKPIs(kpis)}

    ${renderPlanningWeeklySection(weeklyTasks, currentISOWeek, weeklyCompletedTasks, currentISOWeekKey)}

    ${renderPlanningFilters()}

    ${renderPlanningFilterSummary(operationalTasks.length, filteredTasks.length)}

    ${renderPlanningUnassignedTaskPool(poolTasks)}

    ${filteredTasks.length > 0 ? renderPlanningAccordionControls("board", Object.keys(groupedTasks)) : ""}

    <section class="planning-board">
      ${Object.keys(groupedTasks).map(user => renderPlanningColumn(user, groupedTasks[user])).join("")}
    </section>

    ${renderPlanningCompletedSummary(completedTasks)}

    ${renderNewTaskModal()}
    ${renderOperatorPlanningDatesModal()}
    ${renderPlanningCommentsModal()}
    ${renderPlanningTimelineModal()}
  `;
}

function renderPlanningExportExcelAction() {
  if (!canCurrentUserModifyPlanningTasks()) {
    return "";
  }

  return `
        <button class="secondary-btn" type="button" onclick="exportPlanningToExcel()">
          Exportar Excel
        </button>
  `;
}

function renderPlanningCreateTaskAction() {
  return `
        <button class="primary-btn" type="button" onclick="openNewTaskModal()">
          + Nueva tarea
        </button>
  `;
}

function renderPlanningDeviationReasonMeta(task) {
  const reason = (task.motivo || "").trim();

  if (!reason || reason === "Sin desviación") {
    return "";
  }

  return `<span>Motivo desviación: ${escapePlanningHtml(reason)}</span>`;
}

function renderPlanningWeeklySection(tasks, isoWeek, completedTasks = [], weekKey = getCurrentPlanningISOWeekKey()) {
  const weeklyTasks = [...tasks, ...completedTasks];
  const groupedTasks = groupPlanningTasksByUser(tasks);
  const groupedWeeklyTasks = groupPlanningTasksByUser(weeklyTasks);
  const visibleGroups = Object.entries(groupedWeeklyTasks).filter(([, userTasks]) => userTasks.length > 0);
  const responsibleNames = visibleGroups.map(([responsible]) => responsible);

  return `
    <section class="planning-weekly">
      <div class="planning-weekly-header">
        <div>
          <h3>Planificadas esta semana</h3>
          <p>Semana ${isoWeek}</p>
        </div>

        <span>${weeklyTasks.length} tareas</span>
      </div>

      ${weeklyTasks.length > 0 ? renderPlanningAccordionControls("weekly", responsibleNames) : ""}

      ${
        weeklyTasks.length === 0
          ? `<div class="planning-weekly-empty">No hay tareas planificadas para esta semana.</div>`
          : `
            <div class="planning-weekly-groups">
              ${visibleGroups.map(([responsible, userTasks]) =>
                renderPlanningWeeklyGroup(responsible, groupedTasks[responsible] || [], userTasks, weekKey)
              ).join("")}
            </div>
          `
      }
    </section>
  `;
}

function renderPlanningWeeklyGroup(responsible, activeTasks, weeklyTasks, weekKey) {
  const statusSummary = getPlanningWeeklyStatusCountsForResponsible(weeklyTasks, responsible, weekKey);
  const isCollapsed = isPlanningSectionCollapsed("weekly", responsible);

  return `
    <article class="planning-weekly-group ${isCollapsed ? "is-collapsed" : ""}">
      <button
        type="button"
        class="planning-weekly-group-header planning-accordion-header"
        onclick="togglePlanningSection('weekly', '${escapePlanningAttribute(responsible)}')"
      >
        <div>
          <h4>
            <span class="planning-accordion-arrow">▼</span>
            ${escapePlanningHtml(responsible)}
          </h4>
          <p>${weeklyTasks.length} tareas de la semana</p>
        </div>

        <div class="planning-weekly-mini-summary">
          ${renderPlanningWeeklySummaryItem("Pendientes", statusSummary.pendientes, "pending")}
          ${renderPlanningWeeklySummaryItem("En proceso", statusSummary.enProceso, "progress")}
          ${renderPlanningWeeklySummaryItem("Pausadas", statusSummary.pausadas, "paused")}
          ${renderPlanningWeeklySummaryItem("Terminadas", statusSummary.terminadas, "done")}
          ${renderPlanningWeeklySummaryItem("Reprogramadas", statusSummary.reprogramadas, "rescheduled")}
        </div>
      </button>

      <div class="planning-weekly-task-list planning-accordion-content">
        ${activeTasks.map(task => renderPlanningWeeklyTask(task)).join("") || '<div class="planning-weekly-empty">Sin tareas activas para esta semana.</div>'}
      </div>
    </article>
  `;
}

function renderPlanningWeeklySummaryItem(label, value, className) {
  return `
    <span class="${className}">
      ${label}: <strong>${value}</strong>
    </span>
  `;
}

function calculatePlanningWeeklyStatusSummary(tasks) {
  const summary = {
    pendientes: 0,
    enProceso: 0,
    pausadas: 0,
    terminadas: 0,
    reprogramadas: 0
  };

  tasks.forEach(task => {
    const status = normalizePlanningStatus(task.estado);

    if (status === "pendiente") summary.pendientes++;
    if (status === "en proceso") summary.enProceso++;
    if (status === "pausada") summary.pausadas++;
    if (status === "terminado" || status === "terminada") summary.terminadas++;
    if (status === "reprogramado" || status === "reprogramada") summary.reprogramadas++;
  });

  return summary;
}

function renderPlanningWeeklyTask(task) {
  const statusClass = getPlanningStatusClass(task.estado);
  const cardClass = getPlanningWeeklyTaskStatusClass(task.estado);

  return `
    <article class="planning-weekly-task ${cardClass}">
      <div>
        <strong>${escapePlanningHtml(task.actividad || "Sin actividad")}</strong>
        <span>${escapePlanningHtml(task.otPsi || "Sin OT/PSI")}</span>
      </div>

      ${renderPlanningClientProject(task) ? `<p>${renderPlanningClientProject(task)}</p>` : ""}
      <span class="task-status ${statusClass}">${getPlanningStatusLabel(task.estado)}</span>
      ${task.fechaInicioPlanificada ? `<span>Inicio planificado: ${escapePlanningHtml(formatPlanningDisplayDate(task.fechaInicioPlanificada))}</span>` : ""}
      ${task.fechaObjetivo ? `<span>Objetivo: ${escapePlanningHtml(formatPlanningDisplayDate(task.fechaObjetivo))}</span>` : ""}
    </article>
  `;
}

function renderPlanningCompletedSummary(tasks) {
  const weekOptions = getPlanningCompletedWeekOptions(tasks);
  const selectedWeek = PLANNING_COMPLETED_SUMMARY_STATE.selectedWeek || getCurrentPlanningISOWeekKey();
  const selectedTasks = tasks.filter(task => getPlanningCompletedWeekKey(task) === selectedWeek);
  const groupedTasks = groupPlanningTasksByUser(selectedTasks);
  const visibleGroups = Object.entries(groupedTasks).filter(([, userTasks]) => userTasks.length > 0);
  const isCollapsed = PLANNING_COMPLETED_SUMMARY_STATE.collapsed;

  return `
    <section class="planning-weekly planning-completed-summary ${isCollapsed ? "is-collapsed" : ""}">
      <div class="planning-weekly-header">
        <div>
          <h3>
            <button
              type="button"
              class="planning-completed-toggle planning-accordion-header"
              onclick="togglePlanningCompletedSummary()"
            >
              <span class="planning-accordion-arrow">▼</span>
              Resumen de tareas terminadas
            </button>
          </h3>
          <p>${getPlanningWeekLabel(selectedWeek)}</p>
        </div>

        <span>${selectedTasks.length} terminadas</span>
      </div>

      <div class="planning-accordion-content">
        <section class="planning-filters planning-completed-filters">
          <label>
            Semana
            <select onchange="updatePlanningCompletedSummaryWeek(this.value)">
              ${weekOptions.map(option => `
                <option value="${escapePlanningAttribute(option.value)}" ${option.value === selectedWeek ? "selected" : ""}>
                  ${escapePlanningHtml(option.label)}
                </option>
              `).join("")}
            </select>
          </label>
        </section>

        ${
          selectedTasks.length === 0
            ? `<div class="planning-weekly-empty">No hay tareas terminadas para esta semana.</div>`
            : `
              <div class="planning-weekly-groups">
                ${visibleGroups.map(([responsible, userTasks]) =>
                  renderPlanningCompletedGroup(responsible, userTasks)
                ).join("")}
              </div>
            `
        }
      </div>
    </section>
  `;
}

function renderPlanningCompletedGroup(responsible, tasks) {
  const isCollapsed = isPlanningSectionCollapsed("completed", responsible);

  return `
    <article class="planning-weekly-group ${isCollapsed ? "is-collapsed" : ""}">
      <button
        type="button"
        class="planning-weekly-group-header planning-accordion-header"
        onclick="togglePlanningSection('completed', '${escapePlanningAttribute(responsible)}')"
      >
        <div>
          <h4>
            <span class="planning-accordion-arrow">▼</span>
            ${escapePlanningHtml(responsible)}
          </h4>
          <p>${tasks.length} tareas terminadas</p>
        </div>
      </button>

      <div class="planning-weekly-task-list planning-accordion-content">
        ${tasks.map(task => renderPlanningCompletedTaskCompact(task)).join("")}
      </div>
    </article>
  `;
}

function renderPlanningCompletedTaskCompact(task) {
  const planningCode = getPlanningTaskCode(task);
  const completionDate = task.fechaTerminoReal || task.terminadoAt || "";

  return `
    <article class="planning-weekly-task weekly-task-done planning-completed-task planning-completed-card">
      <div class="planning-completed-card-heading">
        ${planningCode ? `<strong>${escapePlanningHtml(planningCode)}</strong>` : ""}
        ${task.actividad ? `<span>${escapePlanningHtml(task.actividad)}</span>` : ""}
        ${task.otPsi ? `<small>${escapePlanningHtml(task.otPsi)}</small>` : ""}
      </div>
      <div class="planning-completed-card-context">
        ${getPlanningTaskResponsibleName(task) ? `<span>${escapePlanningHtml(getPlanningTaskResponsibleName(task))}</span>` : ""}
        ${task.cliente ? `<span>${escapePlanningHtml(task.cliente)}</span>` : ""}
      </div>
      <div class="planning-completed-date-badges">
        ${renderPlanningCompletedBadge("Inicio", formatPlanningDisplayDate(task.inicioReal))}
        ${renderPlanningCompletedBadge("Objetivo", formatPlanningDisplayDate(task.fechaObjetivo))}
        ${renderPlanningCompletedBadge("Término", formatPlanningDisplayDate(completionDate))}
        ${renderPlanningCompletedBadge("Duración", getPlanningDurationLabel(task))}
      </div>
      <div class="task-secondary-actions">
        ${renderPlanningAdminActions(task)}
        ${renderPlanningOperatorDatesAction(task)}
        <button type="button" class="task-action-btn" onclick="openPlanningComments('${task.id}', event)">Comentarios (${getPlanningCommentsCount(task)})</button>
        <button type="button" class="task-action-btn" onclick="openPlanningTimeline('${task.id}', event)">Timeline</button>
      </div>
    </article>
  `;
}

function renderPlanningCompletedBadge(label, value) {
  if (!value) return "";
  return `<span class="planning-completed-date-badge"><small>${escapePlanningHtml(label)}</small>${escapePlanningHtml(value)}</span>`;
}

function formatPlanningDisplayDate(value) {
  if (!value) return "";

  const rawValue = typeof value?.toDate === "function" ? value.toDate() : value;
  const textValue = String(rawValue).trim();
  const calendarDate = textValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (calendarDate) {
    return `${calendarDate[3]}/${calendarDate[2]}/${calendarDate[1]}`;
  }

  const date = rawValue instanceof Date ? rawValue : new Date(rawValue);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Santiago"
  }).formatToParts(date);
  const values = Object.fromEntries(parts
    .filter(part => part.type !== "literal")
    .map(part => [part.type, part.value]));

  return `${values.day}/${values.month}/${values.year}`;
}

function renderPlanningClientProject(task) {
  return [task?.cliente, task?.proyecto]
    .filter(value => Boolean(String(value || "").trim()))
    .map(value => escapePlanningHtml(value))
    .join(" · ");
}

function renderPlanningCompletedTask(task) {
  return `
    <article class="planning-weekly-task weekly-task-done planning-completed-task">
      <div>
        <strong>${escapePlanningHtml(getPlanningTaskCode(task))}</strong>
        <span>${escapePlanningHtml(task.actividad || "Sin actividad")}</span>
        ${task.otPsi ? `<span>${escapePlanningHtml(task.otPsi)}</span>` : ""}
      </div>

      <div>
        <p>${escapePlanningHtml(getPlanningTaskResponsibleName(task) || "Sin responsable")}</p>
        <span>Inicio real: ${escapePlanningHtml(formatPlanningDisplayDate(task.inicioReal) || "Sin fecha")}</span>
        <span>Objetivo: ${escapePlanningHtml(formatPlanningDisplayDate(task.fechaObjetivo) || "Sin fecha")}</span>
        <span>Término real: ${escapePlanningHtml(formatPlanningDisplayDate(task.fechaTerminoReal) || "Sin fecha")}</span>
        ${getPlanningDurationLabel(task) ? `<span>Duración: ${escapePlanningHtml(getPlanningDurationLabel(task))}</span>` : ""}
        ${renderPlanningClientProject(task) ? `<span>${renderPlanningClientProject(task)}</span>` : ""}
      </div>

      <div class="task-secondary-actions">
        ${renderPlanningAdminActions(task)}
        ${renderPlanningOperatorDatesAction(task)}
        <button type="button" class="task-action-btn" onclick="openPlanningComments('${task.id}', event)">
          Comentarios (${getPlanningCommentsCount(task)})
        </button>
        <button type="button" class="task-action-btn" onclick="openPlanningTimeline('${task.id}', event)">
          Timeline
        </button>
      </div>
    </article>
  `;
}

function getPlanningWeeklyTaskStatusClass(status) {
  const value = normalizePlanningStatus(status);

  if (value === "pendiente") return "weekly-task-pending";
  if (value === "en proceso") return "weekly-task-progress";
  if (value === "pausada") return "weekly-task-paused";
  if (value === "terminado" || value === "terminada") return "weekly-task-done";
  if (value === "reprogramado" || value === "reprogramada") return "weekly-task-rescheduled";

  return "weekly-task-default";
}

function renderPlanningFilters() {
  return `
    <section class="planning-filters">
      <label>
        Responsable
        <select onchange="updatePlanningFilter('responsable', this.value)">
          ${renderPlanningFilterOption("", "Todos", PLANNING_FILTERS.responsable)}
          ${renderPlanningFilterOption("__unassigned__", "Sin responsable", PLANNING_FILTERS.responsable)}
          ${getPlanningResponsibleNames().map(user => renderPlanningFilterOption(user, user, PLANNING_FILTERS.responsable)).join("")}
        </select>
      </label>

      <label>
        Estado
        <select onchange="updatePlanningFilter('estado', this.value)">
          ${renderPlanningFilterOption("", "Todos", PLANNING_FILTERS.estado)}
          ${["Pendiente", "En proceso", "Pausada", "Terminado", "Reprogramado"].map(status =>
            renderPlanningFilterOption(status, status, PLANNING_FILTERS.estado)
          ).join("")}
        </select>
      </label>

      <label>
        Prioridad
        <select onchange="updatePlanningFilter('prioridad', this.value)">
          ${renderPlanningFilterOption("", "Todas", PLANNING_FILTERS.prioridad)}
          ${["Normal", "Media", "Alta"].map(priority =>
            renderPlanningFilterOption(priority, priority, PLANNING_FILTERS.prioridad)
          ).join("")}
        </select>
      </label>

      <label>
        Complejidad
        <select onchange="updatePlanningFilter('complejidad', this.value)">
          ${renderPlanningFilterOption("", "Todas", PLANNING_FILTERS.complejidad)}
          ${["Baja", "Media", "Alta", "Muy alta"].map(complexity =>
            renderPlanningFilterOption(complexity, complexity, PLANNING_FILTERS.complejidad)
          ).join("")}
        </select>
      </label>

      <label class="planning-filter-search">
        Buscar
        <input
          type="search"
          value="${escapePlanningHtml(PLANNING_FILTERS.search)}"
          placeholder="OT, PSI, cliente, proyecto o actividad"
          oninput="updatePlanningFilter('search', this.value)"
        >
      </label>

      <button type="button" class="secondary-btn planning-clear-filters" onclick="clearPlanningFilters()">
        Limpiar filtros
      </button>
    </section>
  `;
}

function renderPlanningFilterOption(value, label, selectedValue) {
  const selected = value === selectedValue ? "selected" : "";

  return `<option value="${escapePlanningHtml(value)}" ${selected}>${escapePlanningHtml(label)}</option>`;
}

function renderPlanningAccordionControls(scope, responsibleNames) {
  const encodedNames = encodeURIComponent(JSON.stringify(responsibleNames));

  return `
    <div class="planning-accordion-controls">
      <button type="button" class="task-action-btn" onclick="setPlanningSectionsCollapsed('${scope}', '${encodedNames}', false)">
        Expandir todo
      </button>
      <button type="button" class="task-action-btn" onclick="setPlanningSectionsCollapsed('${scope}', '${encodedNames}', true)">
        Contraer todo
      </button>
    </div>
  `;
}

function renderPlanningFilterSummary(totalTasks, visibleTasks) {
  const activeFilters = getActivePlanningFilters();

  if (activeFilters.length === 0) {
    return `
      <section class="planning-filter-summary">
        <strong>Mostrando todas las tareas (${totalTasks})</strong>
      </section>
    `;
  }

  return `
    <section class="planning-filter-summary active">
      <strong>Mostrando ${visibleTasks} de ${totalTasks} tareas</strong>

      <div class="planning-active-filters">
        <span>Filtros activos:</span>
        ${activeFilters.map(filter => `
          <small>${escapePlanningHtml(filter.label)}: ${escapePlanningHtml(filter.value)}</small>
        `).join("")}
      </div>
    </section>
  `;
}

function getActivePlanningFilters() {
  const filters = [];

  if (PLANNING_FILTERS.responsable) {
    filters.push({
      label: "Responsable",
      value: PLANNING_FILTERS.responsable
    });
  }

  if (PLANNING_FILTERS.estado) {
    filters.push({
      label: "Estado",
      value: PLANNING_FILTERS.estado
    });
  }

  if (PLANNING_FILTERS.prioridad) {
    filters.push({
      label: "Prioridad",
      value: PLANNING_FILTERS.prioridad
    });
  }

  if (PLANNING_FILTERS.complejidad) {
    filters.push({
      label: "Complejidad",
      value: PLANNING_FILTERS.complejidad
    });
  }

  if (PLANNING_FILTERS.search) {
    filters.push({
      label: "Busqueda",
      value: PLANNING_FILTERS.search
    });
  }

  return filters;
}

function updatePlanningFilter(filterName, value) {
  PLANNING_FILTERS[filterName] = value;

  if (filterName === "responsable" && value === "__unassigned__") {
    setPlanningUnassignedPoolExpanded(true);
  }

  refreshPlanningBoard();

  if (filterName === "search") {
    const searchInput = document.querySelector(".planning-filter-search input");

    if (searchInput) {
      searchInput.focus();
      searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }
  }
}

function clearPlanningFilters() {
  PLANNING_FILTERS.responsable = "";
  PLANNING_FILTERS.estado = "";
  PLANNING_FILTERS.prioridad = "";
  PLANNING_FILTERS.complejidad = "";
  PLANNING_FILTERS.search = "";

  refreshPlanningBoard();
}

function togglePlanningCompletedSummary() {
  PLANNING_COMPLETED_SUMMARY_STATE.collapsed = !PLANNING_COMPLETED_SUMMARY_STATE.collapsed;
  refreshPlanningBoard();
}

function updatePlanningCompletedSummaryWeek(weekKey) {
  PLANNING_COMPLETED_SUMMARY_STATE.selectedWeek = weekKey;
  PLANNING_COMPLETED_SUMMARY_STATE.collapsed = false;
  refreshPlanningBoard();
}

function togglePlanningSection(scope, responsible) {
  const state = PLANNING_COLLAPSE_STATE[scope];

  if (!state) return;

  state[responsible] = !isPlanningSectionCollapsed(scope, responsible);
  refreshPlanningBoard();
}

function isPlanningSectionCollapsed(scope, responsible) {
  const state = PLANNING_COLLAPSE_STATE[scope];

  if (!state) return false;

  if (state[responsible] === undefined && (scope === "board" || scope === "weekly")) {
    return true;
  }

  return state[responsible] === true;
}

function setPlanningSectionsCollapsed(scope, encodedNames, collapsed) {
  const state = PLANNING_COLLAPSE_STATE[scope];

  if (!state) return;

  const responsibleNames = JSON.parse(decodeURIComponent(encodedNames));

  responsibleNames.forEach(responsible => {
    state[responsible] = collapsed;
  });

  refreshPlanningBoard();
}

function ensurePlanningCompletedSummaryWeek(tasks) {
  const currentWeek = getCurrentPlanningISOWeekKey();
  const options = getPlanningCompletedWeekOptions(tasks);
  const hasSelectedWeek = options.some(option => option.value === PLANNING_COMPLETED_SUMMARY_STATE.selectedWeek);

  if (!PLANNING_COMPLETED_SUMMARY_STATE.selectedWeek || !hasSelectedWeek) {
    PLANNING_COMPLETED_SUMMARY_STATE.selectedWeek = currentWeek;
  }
}

function getPlanningCompletedWeekOptions(tasks) {
  const weeks = new Map();
  const currentWeek = getCurrentPlanningISOWeekKey();

  weeks.set(currentWeek, getPlanningWeekLabel(currentWeek));

  tasks.forEach(task => {
    const weekKey = getPlanningCompletedWeekKey(task);

    if (weekKey) {
      weeks.set(weekKey, getPlanningWeekLabel(weekKey));
    }
  });

  return Array.from(weeks.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((firstOption, secondOption) => secondOption.value.localeCompare(firstOption.value));
}

function getPlanningCompletedWeekKey(task) {
  return getIsoWeekKeyFromPlanningDate(getPlanningTaskCompletionDate(task));
}

function getCurrentPlanningISOWeekKey() {
  return getIsoWeekKeyFromPlanningDate(new Date());
}

function getPlanningWeekLabel(weekKey) {
  const [year, week] = (weekKey || getCurrentPlanningISOWeekKey()).split("-");

  return `Semana ${Number(String(week).replace("W", ""))} / ${year}`;
}

function isPlanningTaskFinished(task) {
  return isPlanningTaskCompleted(task);
}

function renderPlanningKPIs(kpis) {
  const items = [
    {
      label: "Total tareas",
      value: kpis.total,
      className: "total"
    },
    {
      label: "Pendientes",
      value: kpis.pendientes,
      className: "pending"
    },
    {
      label: "En proceso",
      value: kpis.enProceso,
      className: "progress"
    },
    {
      label: "Pausadas",
      value: kpis.pausadas,
      className: "paused"
    },
    {
      label: "Terminadas",
      value: kpis.terminadas,
      className: "done"
    },
    {
      label: "Reprogramadas",
      value: kpis.reprogramadas,
      className: "rescheduled"
    }
  ];

  return `
    <section class="planning-kpis">
      ${items.map(item => `
        <article class="planning-kpi-card ${item.className}">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
        </article>
      `).join("")}
    </section>
  `;
}

function renderPlanningColumn(user, tasks) {
  const isCollapsed = isPlanningSectionCollapsed("board", user);

  return `
    <article class="planning-column ${isCollapsed ? "is-collapsed" : ""}">
      <button
        type="button"
        class="planning-column-header planning-accordion-header"
        onclick="togglePlanningSection('board', '${escapePlanningAttribute(user)}')"
      >
        <h3>
          <span class="planning-accordion-arrow">▼</span>
          ${user}
        </h3>
        <span>${tasks.length} tareas</span>
      </button>

      <div class="planning-accordion-content">
        ${tasks.map(task => renderPlanningCard(task)).join("")}
      </div>
    </article>
  `;
}

function renderPlanningCard(task) {
  const priorityClass = getPlanningPriorityClass(task.prioridad);
  const statusClass = getPlanningStatusClass(task.estado);
  const executionActions = getPlanningExecutionActions(task.estado);

  return `
      <div
        class="task-card ${priorityClass} ${getPlanningCardStatusClass(task.estado)}"
        ${renderPlanningEditCardAction(task)}
        >

      <div class="task-card-header">
        <div class="task-title-block">
          <strong>${task.actividad}</strong>
          <span>${escapePlanningHtml(getPlanningTaskCode(task))}</span>
          ${task.otPsi ? `<span>${task.otPsi}</span>` : ""}
        </div>

        <div class="task-card-actions">
          <span class="task-status ${statusClass}">${getPlanningStatusLabel(task.estado)}</span>
        </div>
      </div>

      ${renderPlanningClientProject(task) ? `<p class="task-context">${renderPlanningClientProject(task)}</p>` : ""}

      <div class="task-meta">
        ${task.tipo ? `<span>${escapePlanningHtml(task.tipo)}</span>` : ""}
        ${task.fechaObjetivo ? `<span>Objetivo: ${escapePlanningHtml(formatPlanningDisplayDate(task.fechaObjetivo))}</span>` : ""}
        ${renderPlanningDeviationReasonMeta(task)}
        <span>Prioridad: ${task.prioridad || "Normal"}</span>
        ${renderPlanningExecutionMeta(task)}
      </div>

      <div class="task-secondary-actions">
        ${renderPlanningAdminActions(task)}
        ${renderPlanningOperatorDatesAction(task)}
        <button type="button" class="task-action-btn" onclick="openPlanningComments('${task.id}', event)">
          Comentarios (${getPlanningCommentsCount(task)})
        </button>
        <button type="button" class="task-action-btn" onclick="openPlanningTimeline('${task.id}', event)">
          Timeline
        </button>
      </div>

      <div class="task-execution-actions">
        ${executionActions.map(action => `
          <button
            type="button"
            class="task-execution-btn ${action.className}"
            ${action.disabled ? "disabled" : ""}
            onclick="handlePlanningExecutionAction('${task.id}', '${action.id}', event)"
          >
            ${action.label}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderPlanningEditCardAction(task) {
  if (!canCurrentUserModifyPlanningTasks()) {
    return "";
  }

  return `onclick="editPlanningTask('${task.id}')"`;
}

function renderPlanningAdminActions(task) {
  if (!canCurrentUserModifyPlanningTasks()) {
    return "";
  }

  return `
        <button type="button" class="task-action-btn" onclick="editPlanningTask('${task.id}', event)">
          Editar
        </button>
        <button type="button" class="task-action-btn" onclick="handlePlanningDuplicateTask('${task.id}', event)">
          Duplicar
        </button>
        <button type="button" class="task-action-btn" onclick="handlePlanningDeleteTask('${task.id}', event)">
          Eliminar
        </button>
  `;
}

function canCurrentUserModifyPlanningTasks() {
  return window.currentUserProfile?.role === "admin";
}

function renderPlanningOperatorDatesAction(task) {
  const canEditDates = canCurrentOperatorEditPlanningDates(task, window.currentUserProfile);

  if (!canEditDates) {
    return "";
  }

  return `<button type="button" class="task-action-btn" onclick="openOperatorPlanningDatesModal('${escapePlanningAttribute(task.id)}', event)">Definir fechas</button>`;
}

function renderPlanningDataError() {
  const error = getPlanningDataError();

  if (!error) return "";

  return `
    <section class="planning-load-error" role="alert">
      <div><strong>No se pudieron cargar las tareas reales de Planning.</strong><span>Código: ${escapePlanningHtml(error.code || "unknown")}</span></div>
      <p>${escapePlanningHtml(error.message || "Revisa la conexión o permisos de Firestore.")}</p>
      <button type="button" class="secondary-btn" onclick="retryPlanningDataLoad()">Reintentar</button>
    </section>
  `;
}

function canCurrentUserClaimPlanningTask() {
  const user = window.currentUserProfile;
  const role = String(user?.role || "").trim().toLowerCase();
  return Boolean(getPlanningUserUid(user) && user.active === true && user.assignable === true && ["admin", "operator"].includes(role));
}

function canCurrentUserDeletePlanningTasks() {
  return canCurrentUserModifyPlanningTasks();
}

function renderPlanningCommentsModal() {
  return `
    <div id="planningCommentsModal" class="modal-overlay" hidden>
      <div class="modal-card comments-modal-card">
        <div class="modal-header">
          <div>
            <h3 id="commentsModalTitle">Comentarios</h3>
            <p id="commentsModalSubtitle">Registro local de la tarea.</p>
          </div>

          <button type="button" class="modal-close" onclick="closePlanningComments()">X</button>
        </div>

        <div id="commentsList" class="comments-list"></div>

        <form id="commentsForm" class="comments-form" onsubmit="handlePlanningCommentSubmit(event)">
          <input name="taskId" type="hidden">

          <label>
            Nuevo comentario
            <textarea name="commentText" rows="4" placeholder="Escribe un comentario..." required></textarea>
          </label>

          <div class="modal-actions">
            <button type="button" class="secondary-btn" onclick="closePlanningComments()">Cerrar</button>
            <button type="submit" class="primary-btn">Agregar comentario</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderPlanningTimelineModal() {
  return `
    <div id="planningTimelineModal" class="modal-overlay" hidden>
      <div class="modal-card timeline-modal-card">
        <div class="modal-header">
          <div>
            <h3 id="timelineModalTitle">Timeline</h3>
            <p id="timelineModalSubtitle">Eventos locales de la tarea.</p>
          </div>

          <button type="button" class="modal-close" onclick="closePlanningTimeline()">X</button>
        </div>

        <div id="timelineList" class="planning-timeline-list"></div>

        <div class="modal-actions">
          <button type="button" class="secondary-btn" onclick="closePlanningTimeline()">Cerrar</button>
        </div>
      </div>
    </div>
  `;
}

function renderOperatorPlanningDatesModal() {
  return `
    <div id="operatorPlanningDatesModal" class="modal-overlay" hidden>
      <div class="modal-card modal-card-compact">
        <div class="modal-header">
          <div><h3>Definir fechas planificadas</h3><p>Esta edición solo podrá realizarse una vez.</p></div>
          <button type="button" class="modal-close" aria-label="Cerrar" onclick="closeOperatorPlanningDatesModal()">X</button>
        </div>
        <form id="operatorPlanningDatesForm" class="task-form" onsubmit="handleOperatorPlanningDatesSubmit(event)">
          <input name="taskId" type="hidden">
          <div class="form-grid">
            <label>Fecha inicio planificada<input name="fechaInicioPlanificada" type="date" required></label>
            <label>Fecha objetivo<input name="fechaObjetivo" type="date" required></label>
          </div>
          <div class="modal-actions">
            <p id="operatorPlanningDatesError" class="task-modal-error" role="alert" hidden></p>
            <button type="button" class="secondary-btn" onclick="closeOperatorPlanningDatesModal()">Cancelar</button>
            <button id="operatorPlanningDatesSubmit" type="submit" class="primary-btn">Guardar fechas</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function openOperatorPlanningDatesModal(taskId, event) {
  if (event) event.stopPropagation();

  const task = getPlanningTasks().find(item => item.id === taskId);
  if (!canCurrentOperatorEditPlanningDates(task, window.currentUserProfile)) {
    console.warn("Acción no permitida para definir fechas.");
    return;
  }

  const modal = document.getElementById("operatorPlanningDatesModal");
  const form = document.getElementById("operatorPlanningDatesForm");
  if (!modal || !form) return;

  form.elements.taskId.value = task.id;
  form.elements.fechaInicioPlanificada.value = toDateInputValue(task.fechaInicioPlanificada);
  form.elements.fechaObjetivo.value = toDateInputValue(task.fechaObjetivo);
  setOperatorPlanningDatesModalError("");
  modal.hidden = false;
}

function closeOperatorPlanningDatesModal() {
  const modal = document.getElementById("operatorPlanningDatesModal");
  const form = document.getElementById("operatorPlanningDatesForm");
  if (form) form.reset();
  setOperatorPlanningDatesModalError("");
  if (modal) modal.hidden = true;
}

function setOperatorPlanningDatesModalError(message) {
  const error = document.getElementById("operatorPlanningDatesError");
  if (!error) return;
  error.textContent = message;
  error.hidden = !message;
}

async function handleOperatorPlanningDatesSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const taskId = form.elements.taskId.value;
  const dates = {
    fechaInicioPlanificada: form.elements.fechaInicioPlanificada.value,
    fechaObjetivo: form.elements.fechaObjetivo.value
  };

  const validationMessage = validatePlanningDateRange(dates.fechaInicioPlanificada, dates.fechaObjetivo);

  if (validationMessage) {
    setOperatorPlanningDatesModalError(validationMessage);
    return;
  }

  try {
    await saveOperatorPlanningDatesOnceAction(taskId, dates);
    closeOperatorPlanningDatesModal();
  } catch (error) {
    console.error("[Planning][operator-dates]", getPlanningSafeErrorDetails("operator-planning-dates", "tasks", error));
    setOperatorPlanningDatesModalError(getOperatorPlanningDatesErrorMessage(error));
  }
}

function getOperatorPlanningDatesErrorMessage(error) {
  if (error?.code === "planning/operator-dates-invalid") {
    return error.message || "Las fechas planificadas no son válidas.";
  }

  const messages = {
    "planning/operator-dates-already-used": "La edición única de fechas ya fue utilizada.",
    "planning/operator-dates-not-owner": "No puedes editar las fechas de una tarea asignada a otro usuario.",
    "planning/operator-dates-not-pending": "Solo puedes definir fechas mientras la tarea está pendiente.",
    "planning/operator-dates-not-allowed": "No tienes permisos para editar estas fechas."
  };
  return messages[error?.code] || "No se pudieron guardar las fechas. Revisa conexión o permisos de Firestore.";
}


function renderNewTaskModal() {
  return `
    <div id="newTaskModal" class="modal-overlay" hidden>
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <h3 id="taskModalTitle">Nueva tarea</h3>
            <p>Crear una actividad para la planificación semanal PSI.</p>
          </div>

          <button type="button" class="modal-close" onclick="closeNewTaskModal()">X</button>
        </div>

        <form id="newTaskForm" class="task-form" onsubmit="handleNewTaskSubmit(event)">
          <input name="taskId" type="hidden">
          <input name="psiCode" type="hidden">
          <input name="productionOrder" type="hidden">

          <div class="form-grid">
            <label>
              Actividad
              <select name="actividadCatalog" onchange="handlePlanningActivityChange()" required>
                <option value="" disabled selected>Seleccionar</option>
                ${renderPlanningActivityOptions()}
              </select>
            </label>

            <label id="planningCustomActivityField" hidden>
              Especificar actividad
              <input name="actividadCustom" type="text" placeholder="Describe la actividad">
            </label>

            <label>
              OT / PSI / OTRO
              <div class="ot-search-row">
                <input name="otPsi" type="text" placeholder="Ej: OT 12045 / PSI-26-0018 / Mantención taller / Capacitación / Visita cliente">
                <button type="button" class="secondary-btn ot-search-btn" onclick="handlePlanningOTSearch()">
                  Buscar OT
                </button>
              </div>
            </label>

            <label>
              Cliente
              <input name="cliente" type="text" placeholder="Cliente">
            </label>

            <label>
              Responsable Taller PSI
              <select name="responsibleUid">
                ${renderPlanningResponsibleOptions()}
              </select>
            </label>

            <label>
              Tipo
              <select name="tipo" onchange="handlePlanningTypeChange()">
                <option value="" disabled selected>Seleccionar</option>
                <option>Orden de Trabajo OT</option>
                <option>Cotización</option>
                <option>Ingeniería</option>
                <option>Documentación</option>
                <option>Pruebas</option>
                <option>Interna</option>
              </select>
            </label>

            <div id="planningOTInfo" class="planning-ot-info" hidden></div>

            <label>
              Estado
              <select name="estado" onchange="handlePlanningCompletedStatusHint(this.value)">
                <option selected>Pendiente</option>
                <option>En proceso</option>
                <option>Pausada</option>
                <option>Terminado</option>
                <option>Reprogramado</option>
                <option>Cancelado</option>
              </select>
              <p id="planningCompletedStatusHint" class="planning-completed-status-hint" hidden>Esta tarea se registrará como terminada al momento de guardarla. El inicio real y el término real se completarán automáticamente.</p>
            </label>

            <label>
              Prioridad
              <select name="prioridad">
                <option value="" disabled selected>Seleccionar</option>
                <option>Normal</option>
                <option>Media</option>
                <option>Alta</option>
              </select>
            </label>

            <label>
              Motivo desviación
              <select name="motivo">
                <option value="" selected>Sin desviación</option>
                <option>PSI</option>
                <option>Bodega</option>
                <option>Externo</option>
                <option>Comercial</option>
                <option>Cliente</option>
                <option>Materiales</option>
                <option>Ingeniería</option>
                <option>Administrativo</option>
              </select>
            </label>

            <label>
              Fecha inicio planificada
              <input name="fechaInicioPlanificada" type="date">
            </label>

            <label>
              Fecha objetivo
              <input name="fechaObjetivo" type="date">
            </label>

            <label>
              Complejidad
              <select name="complejidad">
                <option value="" disabled selected>Seleccionar</option>
                <option>Baja</option>
                <option>Media</option>
                <option>Alta</option>
                <option>Muy alta</option>
              </select>
            </label>
          </div>

          <label>
            Comentario
            <textarea name="comentario" rows="3" placeholder="Observaciones o contexto de la tarea"></textarea>
          </label>

          <div class="modal-actions">
            <p id="taskModalError" class="task-modal-error" role="alert" hidden></p>
            <button type="button" class="secondary-btn" onclick="closeNewTaskModal()">Cancelar</button>
            <button id="taskModalSubmit" type="submit" class="primary-btn">Guardar tarea</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderPlanningUnassignedTaskPool(tasks) {
  const expanded = isPlanningUnassignedPoolExpanded();
  const content = tasks.length === 0
    ? `<div class="planning-weekly-empty">No hay tareas disponibles para autoasignación.</div>`
    : `<div class="planning-unassigned-list">${tasks.map(renderPlanningUnassignedTask).join("")}</div>`;

  return `
    <section class="planning-weekly planning-unassigned-pool">
      <button type="button" class="planning-unassigned-toggle" aria-expanded="${expanded}" aria-controls="planningUnassignedPoolContent" onclick="togglePlanningUnassignedPool()">
        <span class="planning-unassigned-chevron" aria-hidden="true">${expanded ? "▼" : "▶"}</span>
        <span class="planning-unassigned-copy"><strong>Bolsa de tareas disponibles</strong><small>Tareas pendientes sin responsable que pueden ser tomadas por el equipo.</small></span>
        <span class="planning-unassigned-count">${tasks.length} tareas disponibles</span>
      </button>
      <div id="planningUnassignedPoolContent" ${expanded ? "" : "hidden"}>${content}</div>
    </section>`;
}

function isPlanningUnassignedPoolExpanded() {
  return PLANNING_UI_STATE.unassignedPoolExpanded === true;
}

function setPlanningUnassignedPoolExpanded(value) {
  PLANNING_UI_STATE.unassignedPoolExpanded = value === true;
  return PLANNING_UI_STATE.unassignedPoolExpanded;
}

function togglePlanningUnassignedPool() {
  setPlanningUnassignedPoolExpanded(!isPlanningUnassignedPoolExpanded());
  refreshPlanningBoard();
}

function renderPlanningUnassignedTask(task) {
  const canClaim = canCurrentUserClaimPlanningTask() && isPlanningTaskAvailableForSelfAssignment(task);
  const canManage = canCurrentUserModifyPlanningTasks();
  const canTakeAndFinish = canAdminTakeAndFinishPlanningTask(task, window.currentUserProfile);
  const createdAt = formatPlanningPoolDate(task.createdAt || task.fechaCreacion);
  return `<article class="task-card planning-pool-task ${getPlanningPriorityClass(task.prioridad)} ${getPlanningCardStatusClass(task.estado)}">
    <div class="task-card-header"><div class="task-title-block"><strong>${escapePlanningHtml(task.actividad || "Sin actividad")}</strong><span>${escapePlanningHtml(getPlanningTaskCode(task) || "Sin código")}</span></div><span class="task-status ${getPlanningStatusClass(task.estado)}">${escapePlanningHtml(getPlanningStatusLabel(task.estado))}</span></div>
    <p class="task-context">${escapePlanningHtml(task.cliente || "Sin cliente")} · ${escapePlanningHtml(task.otPsi || "Sin OT / PSI")}</p>
    <div class="task-meta"><span>Tipo: ${escapePlanningHtml(task.tipo || "Sin tipo")}</span><span>Prioridad: ${escapePlanningHtml(task.prioridad || "Normal")} · Complejidad: ${escapePlanningHtml(task.complejidad || "Sin definir")} · Puntos: ${escapePlanningHtml(getPlanningTaskComplexityPoints(task))}</span>${task.fechaInicioPlanificada ? `<span>Inicio planificado: ${escapePlanningHtml(formatPlanningDisplayDate(task.fechaInicioPlanificada))}</span>` : ""}${task.fechaObjetivo ? `<span>Objetivo: ${escapePlanningHtml(formatPlanningDisplayDate(task.fechaObjetivo))}</span>` : ""}${renderPlanningDeviationReasonMeta(task)}<span>Creada: ${escapePlanningHtml(createdAt || "No informada")}</span></div>
    ${task.comentario ? `<p class="planning-pool-comment">${escapePlanningHtml(task.comentario)}</p>` : ""}
    ${(canClaim || canManage || canTakeAndFinish) ? `<div class="planning-pool-actions">
      ${canManage ? `<button type="button" class="secondary-btn" aria-label="Editar ${escapePlanningAttribute(getPlanningTaskCode(task) || "tarea")}" onclick="editPlanningTask('${escapePlanningAttribute(task.id)}', event)">Editar</button>` : ""}
      ${canClaim ? `<button type="button" class="primary-btn planning-claim-btn" onclick="handlePlanningClaimTask('${escapePlanningAttribute(task.id)}', event)">Tomar tarea</button>` : ""}
      ${canTakeAndFinish ? `<button type="button" class="secondary-btn planning-admin-finish-btn" aria-label="Tomar y terminar ${escapePlanningAttribute(getPlanningTaskCode(task) || "tarea")}" onclick="handlePlanningAdminTakeAndFinish('${escapePlanningAttribute(task.id)}', event)">Tomar y terminar</button>` : ""}
      ${canManage ? `<button type="button" class="secondary-btn danger-btn" aria-label="Eliminar ${escapePlanningAttribute(getPlanningTaskCode(task) || "tarea")}" onclick="handlePlanningDeleteTask('${escapePlanningAttribute(task.id)}', event)">Eliminar</button>` : ""}
    </div>` : ""}
  </article>`;
}

function formatPlanningPoolDate(value) {
  if (!value) return "";
  const date = typeof value.toDate === "function" ? value.toDate() : value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? value.toString() : date.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

function renderPlanningActivityOptions() {
  return PLANNING_ACTIVITY_GROUPS.map(group => `
                <optgroup label="${escapePlanningAttribute(group.label)}">
                  ${group.activities.map(activity => `
                    <option value="${escapePlanningAttribute(activity)}">${escapePlanningHtml(activity)}</option>
                  `).join("")}
                </optgroup>
  `).join("");
}

function getPlanningCatalogActivities() {
  return PLANNING_ACTIVITY_GROUPS.flatMap(group => group.activities);
}

function isPlanningCatalogActivity(activity) {
  return getPlanningCatalogActivities().includes(activity);
}

function getPlanningFormActivityValue(form, formData = null) {
  const data = formData || new FormData(form);
  const selectedActivity = data.get("actividadCatalog") || "";

  if (selectedActivity === PLANNING_OTHER_ACTIVITY) {
    return (data.get("actividadCustom") || "").trim();
  }

  return selectedActivity;
}

function setPlanningActivityFormValue(form, activity) {
  const value = activity || "";

  if (!form.elements.actividadCatalog || !form.elements.actividadCustom) {
    return;
  }

  if (!value) {
    form.elements.actividadCatalog.value = "";
    form.elements.actividadCustom.value = "";
  } else if (isPlanningCatalogActivity(value)) {
    form.elements.actividadCatalog.value = value;
    form.elements.actividadCustom.value = "";
  } else {
    form.elements.actividadCatalog.value = PLANNING_OTHER_ACTIVITY;
    form.elements.actividadCustom.value = value;
  }

  handlePlanningActivityChange();
}

function handlePlanningActivityChange() {
  const form = document.getElementById("newTaskForm");
  const customField = document.getElementById("planningCustomActivityField");

  if (!form || !customField || !form.elements.actividadCustom) {
    return;
  }

  const showCustomActivity = form.elements.actividadCatalog.value === PLANNING_OTHER_ACTIVITY;
  customField.hidden = !showCustomActivity;
  form.elements.actividadCustom.required = showCustomActivity;

  if (!showCustomActivity) {
    form.elements.actividadCustom.value = "";
  }
}

async function handleNewTaskSubmit(event) {

    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const taskId = formData.get("taskId");
    const submitLabel = taskId ? "Guardar cambios" : "Guardar tarea";
    const responsibleUser = getPlanningSelectedResponsibleUser(form);
    const actividad = getPlanningFormActivityValue(form, formData);

    setPlanningTaskModalError("");

    const validationMessage = validatePlanningTaskForm(form, formData, responsibleUser, actividad);

    if (validationMessage) {
        setPlanningTaskModalError(validationMessage);
        return;
    }

    setPlanningTaskSavingState(true);

    const responsibleUid = getPlanningUserUid(responsibleUser);
    const hasResponsible = Boolean(responsibleUid && responsibleUser.name);
    const task = {

        actividad,
        otPsi: formData.get("otPsi") || "",
        psiCode: formData.get("psiCode") || "",
        productionOrder: formData.get("productionOrder") || "",
        cliente: formData.get("cliente") || "",

        responsableTaller: hasResponsible ? responsibleUser.name : "",
        responsableId: hasResponsible ? responsibleUid : "",
        responsableNombre: hasResponsible ? responsibleUser.name : "",
        responsibleUid: hasResponsible ? responsibleUid : "",
        responsibleName: hasResponsible ? responsibleUser.name : "",
        disponibleParaAutoasignacion: !hasResponsible,

        tipo: formData.get("tipo") || "",

        estado: formData.get("estado") || "",

        prioridad: formData.get("prioridad") || "",

        complejidad: formData.get("complejidad") || "",

        motivo: formData.get("motivo") || "",

        fechaInicioPlanificada: formData.get("fechaInicioPlanificada") || "",

        fechaObjetivo: formData.get("fechaObjetivo") || "",

        comentario: formData.get("comentario") || ""

    };

    try {
        if (taskId) {
            await savePlanningTaskChanges(taskId, task);
            window.alert("Tarea actualizada.");
        } else {
            await createPlanningTask(task);
        }

        closeNewTaskModal();
    } catch (error) {
        console.error("No se pudo guardar la tarea de Planificación.", error);
        const completedTaskResponsibleError = "No es posible crear una tarea terminada sin un responsable válido.";
        setPlanningTaskModalError(error?.message === completedTaskResponsibleError
          ? completedTaskResponsibleError
          : "No se pudo guardar la tarea. Revisa conexión o permisos de Firestore.");
    } finally {
        setPlanningTaskSavingState(false, submitLabel);
    }

}

function validatePlanningTaskForm(form, formData, responsibleUser, actividad) {
  if (!formData.get("actividadCatalog")) {
    return "Selecciona una actividad.";
  }

  if (!actividad) {
    return "Especifica la actividad.";
  }

  if (!formData.get("tipo")) {
    return "Selecciona un tipo de tarea.";
  }

  if (!formData.get("estado")) {
    return "Selecciona un estado.";
  }

  if (!formData.get("prioridad")) {
    return "Selecciona una prioridad.";
  }

  if (!formData.get("complejidad")) {
    return "Selecciona una complejidad.";
  }

  const status = normalizePlanningStatus(formData.get("estado"));
  const hasResponsible = Boolean(getPlanningUserUid(responsibleUser));
  if ((status === "terminado" || status === "terminada") && !hasResponsible && !canCurrentUserClaimPlanningTask()) {
    return "No es posible crear una tarea terminada sin un responsable válido.";
  }

  return "";
}

function handlePlanningCompletedStatusHint(status) {
  const hint = document.getElementById("planningCompletedStatusHint");

  if (!hint) return;

  const normalizedStatus = normalizePlanningStatus(status);
  hint.hidden = normalizedStatus !== "terminado" && normalizedStatus !== "terminada";
}

function openNewTaskModal() {
  const modal = document.getElementById("newTaskModal");
  const form = document.getElementById("newTaskForm");

  if (form) {
    form.reset();
    form.elements.taskId.value = "";
    form.elements.responsibleUid.innerHTML = renderPlanningResponsibleOptions();
    form.elements.estado.value = "Pendiente";
    handlePlanningActivityChange();
    handlePlanningCompletedStatusHint(form.elements.estado.value);
  }

  setPlanningModalMode("create");
  handlePlanningTypeChange();
  clearPlanningOTInfo();
  setPlanningTaskModalError("");
  setPlanningTaskSavingState(false);

  if (modal) modal.hidden = false;
}

function closeNewTaskModal() {
  const modal = document.getElementById("newTaskModal");
  const form = document.getElementById("newTaskForm");

  if (form) {
    form.reset();
    form.elements.taskId.value = "";
    handlePlanningActivityChange();
    handlePlanningCompletedStatusHint(form.elements.estado.value);
  }

  clearPlanningOTInfo();
  setPlanningTaskModalError("");
  setPlanningTaskSavingState(false);

  if (modal) {
    modal.hidden = true;
  }
}

function editPlanningTask(taskId, event) {

    if (event) {
        event.stopPropagation();
    }

    if (!canCurrentUserModifyPlanningTasks()) {
        console.warn("Acción no permitida");
        return;
    }

    const task = getPlanningTasks().find(t => t.id === taskId);

    if (!task) return;

    const modal = document.getElementById("newTaskModal");
    const form = document.getElementById("newTaskForm");

    if (!modal || !form) return;

    setPlanningModalMode("edit");
    fillPlanningTaskForm(form, task);
    handlePlanningTypeChange();
    showPlanningOTFromTask(task);
    modal.hidden = false;

} 

function setPlanningModalMode(mode) {
  const title = document.getElementById("taskModalTitle");
  const submit = document.getElementById("taskModalSubmit");

  if (mode === "edit") {
    if (title) title.textContent = "Editar tarea";
    if (submit) submit.textContent = "Guardar cambios";
    return;
  }

  if (title) title.textContent = "Nueva tarea";
  if (submit) submit.textContent = "Guardar tarea";
}

function renderPlanningResponsibleOptions(selectedUid = "") {
  const placeholder = `<option value="" ${selectedUid ? "" : "selected"}>Sin responsable — dejar en bolsa de tareas</option>`;
  const options = getPlanningResponsibleUsers().map(user => `
    <option value="${escapePlanningAttribute(user.uid)}" ${user.uid === selectedUid ? "selected" : ""}>
      ${escapePlanningHtml(user.name)}
    </option>
  `).join("");

  return placeholder + options;
}

function getPlanningSelectedResponsibleUser(form) {
  const selectedUid = form.elements.responsibleUid?.value || "";
  const users = getPlanningResponsibleUsers();
  const selectedUser = users.find(user => user.uid === selectedUid);

  if (selectedUser) {
    return selectedUser;
  }

  const selectedOption = form.elements.responsibleUid?.selectedOptions?.[0];

  return {
    uid: selectedUid,
    name: selectedUid ? selectedOption?.textContent?.trim() || "" : ""
  };
}

function setPlanningTaskSavingState(isSaving, label = null) {
  const submit = document.getElementById("taskModalSubmit");

  if (!submit) return;

  submit.disabled = isSaving;
  submit.textContent = isSaving ? "Guardando..." : (label || getPlanningTaskSubmitLabel());
}

function getPlanningTaskSubmitLabel() {
  const form = document.getElementById("newTaskForm");

  if (!form) return "Guardar tarea";

  return form.elements.taskId.value ? "Guardar cambios" : "Guardar tarea";
}

function setPlanningTaskModalError(message) {
  const error = document.getElementById("taskModalError");

  if (!error) return;

  error.textContent = message;
  error.hidden = !message;
}

function fillPlanningTaskForm(form, task) {
  form.elements.taskId.value = task.id || "";
  form.elements.psiCode.value = task.psiCode || task.customSolution || "";
  form.elements.productionOrder.value = task.productionOrder || "";
  setPlanningActivityFormValue(form, task.actividad || "");
  form.elements.otPsi.value = task.otPsi || "";
  form.elements.cliente.value = task.cliente || "";
  const responsibleName = getPlanningTaskResponsibleName(task);
  const responsibleUser = getPlanningResponsibleUsers().find(user =>
    user.uid === task.responsibleUid || user.name === responsibleName
  );
  const legacyResponsibleOption = responsibleUser || !responsibleName
    ? ""
    : `<option value="${escapePlanningAttribute(task.responsibleUid || responsibleName)}" selected>${escapePlanningHtml(responsibleName)}</option>`;

  form.elements.responsibleUid.innerHTML = legacyResponsibleOption + renderPlanningResponsibleOptions(responsibleUser?.uid || "");
  form.elements.responsibleUid.value = responsibleUser?.uid || "";

  if (legacyResponsibleOption) {
    form.elements.responsibleUid.value = task.responsibleUid || responsibleName;
  }
  form.elements.tipo.value = task.tipo || "Orden de Trabajo OT";
  form.elements.estado.value = task.estado || "Pendiente";
  handlePlanningCompletedStatusHint(form.elements.estado.value);
  form.elements.prioridad.value = task.prioridad || "Normal";
  form.elements.motivo.value = task.motivo && task.motivo !== "Sin desviación" ? task.motivo : "";
  form.elements.fechaInicioPlanificada.value = toDateInputValue(task.fechaInicioPlanificada);
  form.elements.fechaObjetivo.value = toDateInputValue(task.fechaObjetivo);
  form.elements.complejidad.value = task.complejidad || "Media";
  form.elements.comentario.value = task.comentario || "";
}

function toDateInputValue(value) {
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parts = value.toString().split("/");

  if (parts.length !== 3) {
    return "";
  }

  const day = parts[0].padStart(2, "0");
  const month = parts[1].padStart(2, "0");
  let year = parts[2];

  if (year.length === 2) {
    year = `20${year}`;
  }

  return `${year}-${month}-${day}`;
}

function handlePlanningTypeChange() {
  const form = document.getElementById("newTaskForm");

  if (!form) return;

  const isOTTask = form.elements.tipo.value === "Orden de Trabajo OT";
  const searchButton = form.querySelector(".ot-search-btn");
  const otInfo = document.getElementById("planningOTInfo");

  if (searchButton) {
    searchButton.classList.toggle("hidden", !isOTTask);
  }

  if (!isOTTask && otInfo) {
    clearPlanningOTInfo();
  }
}

function handlePlanningOTSearch() {
  const form = document.getElementById("newTaskForm");

  if (!form) return;

  const otValue = form.elements.otPsi.value;
  const productionOrder = findProductionOrderByNumber(otValue);

  if (!productionOrder) {
    showPlanningOTNotFound();
    return;
  }

  form.elements.cliente.value = productionOrder.cliente || "";
  form.elements.psiCode.value = productionOrder.customSolution || "";
  form.elements.productionOrder.value = productionOrder.productionOrder || "";
  form.elements.fechaObjetivo.value = toDateInputValue(productionOrder.dueDate);
  form.elements.complejidad.value = productionOrder.complejidad || "Media";

  showPlanningOTInfo(productionOrder);
}

function showPlanningOTFromTask(task) {
  if (task.tipo !== "Orden de Trabajo OT") {
    clearPlanningOTInfo();
    return;
  }

  const productionOrder = findProductionOrderByNumber(task.otPsi);

  if (productionOrder) {
    showPlanningOTInfo(productionOrder);
  } else {
    clearPlanningOTInfo();
  }
}

function showPlanningOTInfo(productionOrder) {
  const otInfo = document.getElementById("planningOTInfo");

  if (!otInfo) return;

  otInfo.hidden = false;
  otInfo.classList.remove("not-found");
  otInfo.innerHTML = `
    <strong>Datos OT</strong>
    <div>
      <span>OT: ${escapePlanningHtml(productionOrder.productionOrder)}</span>
      <span>Cliente: ${escapePlanningHtml(productionOrder.cliente)}</span>
      <span>Solución: ${escapePlanningHtml(productionOrder.customSolution)}</span>
      <span>Creación: ${escapePlanningHtml(productionOrder.fechaCreacion)}</span>
      <span>Due date: ${escapePlanningHtml(productionOrder.dueDate)}</span>
      <span>Estado OT: ${escapePlanningHtml(productionOrder.estadoOT)}</span>
      <span>Complejidad: ${escapePlanningHtml(productionOrder.complejidad)}</span>
    </div>
  `;
}

function showPlanningOTNotFound() {
  const otInfo = document.getElementById("planningOTInfo");

  if (!otInfo) return;

  otInfo.hidden = false;
  otInfo.classList.add("not-found");
  otInfo.innerHTML = `
    <strong>OT no encontrada en la base local</strong>
    <p>Puedes completar los datos manualmente.</p>
  `;
}

function clearPlanningOTInfo() {
  const otInfo = document.getElementById("planningOTInfo");

  if (!otInfo) return;

  otInfo.hidden = true;
  otInfo.classList.remove("not-found");
  otInfo.innerHTML = "";
}

async function handlePlanningExecutionAction(taskId, action, event) {
  if (event) {
    event.stopPropagation();
  }

  await executePlanningTaskAction(taskId, action);
}

async function handlePlanningClaimTask(taskId, event) {
  if (event) event.stopPropagation();
  await claimPlanningTaskAction(taskId);
}

async function handlePlanningAdminTakeAndFinish(taskId, event) {
  if (event) event.stopPropagation();
  await adminTakeAndFinishPlanningTaskAction(taskId);
}

async function handlePlanningDuplicateTask(taskId, event) {
  if (event) {
    event.stopPropagation();
  }

  await duplicatePlanningTaskAction(taskId);
}

async function handlePlanningDeleteTask(taskId, event) {
  if (event) {
    event.stopPropagation();
  }

  const shouldDelete = confirm("¿Eliminar esta tarea?");

  if (!shouldDelete) return;

  await deletePlanningTaskAction(taskId);
}

async function openPlanningComments(taskId, event) {
  if (event) {
    event.stopPropagation();
  }

  const modal = document.getElementById("planningCommentsModal");
  const form = document.getElementById("commentsForm");

  let task = getPlanningTasks().find(item => item.id === taskId);

  if (!task || !modal || !form) return;

  form.elements.taskId.value = taskId;
  form.elements.commentText.value = "";
  renderPlanningCommentsList(task);
  modal.hidden = false;

  try {
    task = await loadPlanningCommentsForTask(taskId);

    if (task) {
      refreshPlanningBoard();

      const updatedModal = document.getElementById("planningCommentsModal");
      const updatedForm = document.getElementById("commentsForm");

      if (updatedForm) {
        updatedForm.elements.taskId.value = taskId;
      }

      renderPlanningCommentsList(task);

      if (updatedModal) {
        updatedModal.hidden = false;
      }
    }
  } catch (error) {
    console.error("No se pudieron cargar los comentarios de Planificación.", error);
  }
}

function closePlanningComments() {
  const modal = document.getElementById("planningCommentsModal");
  const form = document.getElementById("commentsForm");

  if (form) {
    form.reset();
  }

  if (modal) {
    modal.hidden = true;
  }
}

async function handlePlanningCommentSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const taskId = form.elements.taskId.value;
  const text = form.elements.commentText.value.trim();

  if (!taskId || !text) return;

  let updatedTask = null;

  try {
    updatedTask = await addPlanningTaskCommentPersisted(taskId, text);
  } catch (error) {
    console.error("No se pudo guardar el comentario de Planificación.", error);
    return;
  }

  if (updatedTask) {
    renderPlanningCommentsList(updatedTask);
  }

  const updatedModal = document.getElementById("planningCommentsModal");
  const updatedForm = document.getElementById("commentsForm");

  if (updatedForm) {
    updatedForm.elements.taskId.value = taskId;
    updatedForm.elements.commentText.value = "";
  }

  if (updatedModal) {
    updatedModal.hidden = false;
  }
}

function renderPlanningCommentsList(task) {
  const title = document.getElementById("commentsModalTitle");
  const subtitle = document.getElementById("commentsModalSubtitle");
  const list = document.getElementById("commentsList");
  const comments = task.comentariosLocales || [];

  if (title) {
    title.textContent = "Comentarios";
  }

  if (subtitle) {
    subtitle.textContent = `${task.actividad || "Tarea"} ${task.otPsi || ""}`.trim();
  }

  if (!list) return;

  if (comments.length === 0) {
    list.innerHTML = `
      <div class="comments-empty">
        Sin comentarios registrados.
      </div>
    `;
    return;
  }

  list.innerHTML = comments.map(comment => `
    <article class="comment-item">
      <div class="comment-header">
        <strong>${escapePlanningHtml(comment.user || "Usuario")}</strong>
        <span>${escapePlanningHtml(comment.date || "")}</span>
      </div>
      <p>${escapePlanningHtml(comment.text || "")}</p>
    </article>
  `).join("");
}

function getPlanningCommentsCount(task) {
  return (task.comentariosLocales || []).length;
}

async function openPlanningTimeline(taskId, event) {
  if (event) {
    event.stopPropagation();
  }

  const modal = document.getElementById("planningTimelineModal");
  const task = await loadPlanningTimelineForTask(taskId);

  if (!task || !modal) return;

  renderPlanningTimelineList(task);
  modal.hidden = false;
}

function closePlanningTimeline() {
  const modal = document.getElementById("planningTimelineModal");

  if (modal) {
    modal.hidden = true;
  }
}

function renderPlanningTimelineList(task) {
  const title = document.getElementById("timelineModalTitle");
  const subtitle = document.getElementById("timelineModalSubtitle");
  const list = document.getElementById("timelineList");
  const events = task.timelineLocal || [];

  if (title) {
    title.textContent = "Timeline";
  }

  if (subtitle) {
    subtitle.textContent = `${task.actividad || "Tarea"} ${task.otPsi || ""}`.trim();
  }

  if (!list) return;

  if (events.length === 0) {
    list.innerHTML = `
      <div class="timeline-empty">
        Sin eventos registrados.
      </div>
    `;
    return;
  }

  list.innerHTML = events.map(event => `
    <article class="planning-timeline-event">
      <div class="planning-timeline-marker"></div>
      <div class="planning-timeline-content">
        <div class="planning-timeline-header">
          <strong>${escapePlanningHtml(getPlanningTimelineTypeLabel(event.type))}</strong>
          <span>${escapePlanningHtml(event.date || "")}</span>
        </div>
        <p>${escapePlanningHtml(event.description || "")}</p>
        <small>${escapePlanningHtml(getPlanningTimelineActorName(event, "Sistema"))}</small>
      </div>
    </article>
  `).join("");
}

function getPlanningTimelineTypeLabel(type) {
  const labels = {
    create: "Creación",
    edit: "Edición",
    start: "Inicio",
    pause: "Pausa",
    resume: "Reanudación",
    finish: "Término",
    comment: "Comentario",
    duplicate: "Duplicada",
    self_assigned: "Autoasignación",
    admin_take_and_finish: "Tomar y terminar",
    delete: "Eliminación"
  };

  return labels[type] || type || "Evento";
}

function getPlanningExecutionActions(status) {
  const normalizedStatus = normalizePlanningStatus(status);

  return [
    {
      id: "start",
      label: "Iniciar",
      className: "start",
      disabled: normalizedStatus !== "pendiente"
    },
    {
      id: "pause",
      label: "Pausar",
      className: "pause",
      disabled: normalizedStatus !== "en proceso"
    },
    {
      id: "resume",
      label: "Reanudar",
      className: "resume",
      disabled: normalizedStatus !== "pausada"
    },
    {
      id: "finish",
      label: "Terminar",
      className: "finish",
      disabled: !["en proceso", "pausada"].includes(normalizedStatus)
    }
  ];
}

function renderPlanningExecutionMeta(task) {
  const details = [];

  if (task.inicioReal) {
    details.push(`Inicio real: ${formatPlanningDisplayDate(task.inicioReal)}`);
  }

  if (task.pausas?.length > 0) {
    details.push(`Pausas: ${task.pausas.length}`);
  }

  if (task.reanudaciones?.length > 0) {
    details.push(`Reanudaciones: ${task.reanudaciones.length}`);
  }

  if (task.fechaTerminoReal) {
    details.push(`Termino real: ${formatPlanningDisplayDate(task.fechaTerminoReal)}`);
  }

  const duration = getPlanningDurationLabel(task);
  if (duration) {
    details.push(`Duración: ${duration}`);
  }

  return details.map(detail => `<span>${detail}</span>`).join("");
}

function getPlanningDurationLabel(task) {
  if (!task?.inicioReal || !task?.fechaTerminoReal) return "";

  const start = new Date(task.inicioReal);
  const end = new Date(task.fechaTerminoReal);
  const minutes = Math.floor((end.getTime() - start.getTime()) / 60000);

  if (Number.isNaN(minutes) || minutes < 0) return "";
  return minutes === 0 ? "0 min" : `${minutes} min`;
}

function normalizePlanningStatus(status) {
  return (status || "").toLowerCase();
}

function getPlanningStatusLabel(status) {
  const value = normalizePlanningStatus(status);

  if (value === "terminado" || value === "terminada") {
    return "Terminada";
  }

  return status || "Pendiente";
}

function escapePlanningHtml(value) {
  return (value || "").toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapePlanningAttribute(value) {
  return escapePlanningHtml(value).replace(/`/g, "&#096;");
}

function getPlanningPriorityClass(priority) {
  const value = (priority || "").toLowerCase();

  if (value === "alta") return "priority-high";
  if (value === "media") return "priority-medium";
  return "priority-normal";
}

function getPlanningStatusClass(status) {
  const value = normalizePlanningStatus(status);

  if (value === "pendiente") return "status-pending";
  if (value === "en proceso") return "status-progress";
  if (value === "pausada") return "status-paused";
  if (value === "terminado" || value === "terminada") return "status-done";
  if (value === "reprogramado") return "status-rescheduled";
  if (value === "cancelado") return "status-cancelled";

  return "status-default";
}

function getPlanningCardStatusClass(status) {
  const value = normalizePlanningStatus(status);

  if (value === "pendiente") return "task-card-pending";
  if (value === "en proceso") return "task-card-progress";
  if (value === "pausada") return "task-card-paused";
  if (value === "terminado" || value === "terminada") return "task-card-done";

  return "task-card-default";
}
