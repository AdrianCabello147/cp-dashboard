const PLANNING_FILTERS = {
  responsable: "",
  estado: "",
  prioridad: "",
  complejidad: "",
  search: ""
};

const PLANNING_COLLAPSE_STATE = {
  weekly: {},
  board: {}
};

function renderPlanningModule(tasks) {
  const container = document.getElementById("planificacionModule");

  if (!container) return;

  const filteredTasks = filterPlanningTasks(tasks, PLANNING_FILTERS);
  const groupedTasks = groupPlanningTasksByUser(filteredTasks);
  const kpis = calculatePlanningKPIs(tasks);
  const weeklyTasks = getPlanningTasksForCurrentISOWeek(tasks);
  const currentISOWeek = getCurrentPlanningISOWeek();

  container.innerHTML = `
    <section class="planning-hero">
      <div>
        <h2>Planificación</h2>
        <p>Planificación semanal de actividades PSI organizada por responsable.</p>
      </div>

      <button class="primary-btn" type="button" onclick="openNewTaskModal()">
        + Nueva tarea
      </button>
    </section>

    ${renderPlanningKPIs(kpis)}

    ${renderPlanningWeeklySection(weeklyTasks, currentISOWeek)}

    ${renderPlanningFilters()}

    ${renderPlanningFilterSummary(tasks.length, filteredTasks.length)}

    ${filteredTasks.length > 0 ? renderPlanningAccordionControls("board", Object.keys(groupedTasks)) : ""}

    <section class="planning-board">
      ${Object.keys(groupedTasks).map(user => renderPlanningColumn(user, groupedTasks[user])).join("")}
    </section>

    ${renderNewTaskModal()}
    ${renderPlanningCommentsModal()}
    ${renderPlanningTimelineModal()}
  `;
}

function renderPlanningWeeklySection(tasks, isoWeek) {
  const groupedTasks = groupPlanningTasksByUser(tasks);
  const visibleGroups = Object.entries(groupedTasks).filter(([, userTasks]) => userTasks.length > 0);
  const responsibleNames = visibleGroups.map(([responsible]) => responsible);

  return `
    <section class="planning-weekly">
      <div class="planning-weekly-header">
        <div>
          <h3>Planificadas esta semana</h3>
          <p>Semana ${isoWeek}</p>
        </div>

        <span>${tasks.length} tareas</span>
      </div>

      ${tasks.length > 0 ? renderPlanningAccordionControls("weekly", responsibleNames) : ""}

      ${
        tasks.length === 0
          ? `<div class="planning-weekly-empty">No hay tareas planificadas para esta semana.</div>`
          : `
            <div class="planning-weekly-groups">
              ${visibleGroups.map(([responsible, userTasks]) =>
                renderPlanningWeeklyGroup(responsible, userTasks)
              ).join("")}
            </div>
          `
      }
    </section>
  `;
}

function renderPlanningWeeklyGroup(responsible, tasks) {
  const statusSummary = calculatePlanningWeeklyStatusSummary(tasks);
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
          <p>${tasks.length} tareas de la semana</p>
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
        ${tasks.map(task => renderPlanningWeeklyTask(task)).join("")}
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

      <p>${escapePlanningHtml(task.cliente || "Sin cliente")} / ${escapePlanningHtml(task.proyecto || "Sin proyecto")}</p>
      <span class="task-status ${statusClass}">${getPlanningStatusLabel(task.estado)}</span>
      <span>${escapePlanningHtml(task.fechaObjetivo || "Sin fecha")}</span>
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
          ${PLANNING_USERS.map(user => renderPlanningFilterOption(user, user, PLANNING_FILTERS.responsable)).join("")}
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

function togglePlanningSection(scope, responsible) {
  const state = PLANNING_COLLAPSE_STATE[scope];

  if (!state) return;

  state[responsible] = !state[responsible];
  refreshPlanningBoard();
}

function isPlanningSectionCollapsed(scope, responsible) {
  const state = PLANNING_COLLAPSE_STATE[scope];

  if (!state) return false;

  if (state[responsible] === undefined && scope === "board") {
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
        onclick="editPlanningTask('${task.id}')"
        >

      <div class="task-card-header">
        <div class="task-title-block">
          <strong>${task.actividad}</strong>
          ${task.otPsi ? `<span>${task.otPsi}</span>` : ""}
        </div>

        <div class="task-card-actions">
          <span class="task-status ${statusClass}">${getPlanningStatusLabel(task.estado)}</span>
        </div>
      </div>

      <p class="task-context">${task.cliente || "Sin cliente"} · ${task.proyecto || "Sin proyecto"}</p>

      <div class="task-meta">
        <span>${task.tipo || "Sin tipo"}</span>
        <span>Objetivo: ${task.fechaObjetivo || "Sin fecha"}</span>
        <span>Prioridad: ${task.prioridad || "Normal"}</span>
        <span>Complejidad: ${task.complejidad || "Sin definir"}</span>
        ${renderPlanningExecutionMeta(task)}
      </div>

      <div class="task-secondary-actions">
        <button type="button" class="task-action-btn" onclick="editPlanningTask('${task.id}', event)">
          Editar
        </button>
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

          <div class="form-grid">
            <label>
              Actividad
              <input name="actividad" type="text" placeholder="Ej: Ensamble, Pruebas, Documentación" required>
            </label>

            <label>
              OT / PSI
              <div class="ot-search-row">
                <input name="otPsi" type="text" placeholder="Ej: OT 12045 o PSI-26-0018">
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
              Proyecto
              <input name="proyecto" type="text" placeholder="Proyecto">
            </label>

            <label>
              Responsable Taller PSI
              <select name="responsableTaller">
                <option>Juan Carlos</option>
                <option>Santiago</option>
                <option>David</option>
              </select>
            </label>

            <label>
              Tipo
              <select name="tipo" onchange="handlePlanningTypeChange()">
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
              <select name="estado">
                <option>Pendiente</option>
                <option>En proceso</option>
                <option>Pausada</option>
                <option>Terminado</option>
                <option>Reprogramado</option>
                <option>Cancelado</option>
              </select>
            </label>

            <label>
              Prioridad
              <select name="prioridad">
                <option>Normal</option>
                <option>Media</option>
                <option>Alta</option>
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

async function handleNewTaskSubmit(event) {

    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const taskId = formData.get("taskId");
    const submitLabel = taskId ? "Guardar cambios" : "Guardar tarea";

    setPlanningTaskModalError("");
    setPlanningTaskSavingState(true);

    const task = {

        actividad: formData.get("actividad") || "",
        otPsi: formData.get("otPsi") || "",
        cliente: formData.get("cliente") || "",
        proyecto: formData.get("proyecto") || "",

        responsableTaller: formData.get("responsableTaller") || "",

        tipo: formData.get("tipo") || "",

        estado: formData.get("estado") || "Pendiente",

        prioridad: formData.get("prioridad") || "Normal",

        complejidad: formData.get("complejidad") || "Media",

        fechaInicioPlanificada: formData.get("fechaInicioPlanificada") || "",

        fechaObjetivo: formData.get("fechaObjetivo") || "",

        comentario: formData.get("comentario") || ""

    };

    try {
        if (taskId) {
            await savePlanningTaskChanges(taskId, task);
        } else {
            await createPlanningTask(task);
        }

        closeNewTaskModal();
    } catch (error) {
        console.error("No se pudo guardar la tarea de Planificación.", error);
        setPlanningTaskModalError("No se pudo guardar la tarea. Revisa conexión o permisos de Firestore.");
    } finally {
        setPlanningTaskSavingState(false, submitLabel);
    }

}

function openNewTaskModal() {
  const modal = document.getElementById("newTaskModal");
  const form = document.getElementById("newTaskForm");

  if (form) {
    form.reset();
    form.elements.taskId.value = "";
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
  form.elements.actividad.value = task.actividad || "";
  form.elements.otPsi.value = task.otPsi || "";
  form.elements.cliente.value = task.cliente || "";
  form.elements.proyecto.value = task.proyecto || "";
  form.elements.responsableTaller.value = task.responsableTaller || "Juan Carlos";
  form.elements.tipo.value = task.tipo || "Orden de Trabajo OT";
  form.elements.estado.value = task.estado || "Pendiente";
  form.elements.prioridad.value = task.prioridad || "Normal";
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
  form.elements.proyecto.value = productionOrder.proyecto || "";
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
      <span>Proyecto: ${escapePlanningHtml(productionOrder.proyecto)}</span>
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
        <strong>${escapePlanningHtml(comment.user || "Adrián")}</strong>
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
        <small>${escapePlanningHtml(event.user || "Adrián")}</small>
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
    comment: "Comentario"
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
    details.push(`Inicio real: ${task.inicioReal}`);
  }

  if (task.pausas?.length > 0) {
    details.push(`Pausas: ${task.pausas.length}`);
  }

  if (task.reanudaciones?.length > 0) {
    details.push(`Reanudaciones: ${task.reanudaciones.length}`);
  }

  if (task.fechaTerminoReal) {
    details.push(`Termino real: ${task.fechaTerminoReal}`);
  }

  return details.map(detail => `<span>${detail}</span>`).join("");
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
