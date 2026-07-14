const PLANNING_USERS = [
  "Juan Carlos",
  "Santiago",
  "David"
];

let PLANNING_RESPONSIBLE_USERS = PLANNING_USERS.map(name => ({
  uid: name,
  name
}));

/* =====================================================
   OT MAESTRA LOCAL / MOCK
   Reemplazable por Google Sheets en una etapa posterior.
===================================================== */

const PLANNING_PRODUCTION_ORDERS = [
  {
    productionOrder: "OT 12045",
    cliente: "Codelco",
    proyecto: "Banco de pruebas",
    customSolution: "PSI-26-0018",
    fechaCreacion: "08/07/2026",
    dueDate: "10/07/2026",
    estadoOT: "Abierta",
    complejidad: "Alta"
  },
  {
    productionOrder: "OT 12031",
    cliente: "ENAP",
    proyecto: "Cilindros",
    customSolution: "PSI-26-0020",
    fechaCreacion: "07/07/2026",
    dueDate: "11/07/2026",
    estadoOT: "Abierta",
    complejidad: "Media"
  },
  {
    productionOrder: "OT 12047",
    cliente: "Metrogas",
    proyecto: "Cilindros",
    customSolution: "PSI-26-0030",
    fechaCreacion: "08/07/2026",
    dueDate: "11/07/2026",
    estadoOT: "Abierta",
    complejidad: "Baja"
  }
];

const PLANNING_MOCK_TASKS = [
  {
    id: "TASK-001",
    semana: "Semana actual",
    otPsi: "OT 12045",
    cliente: "Codelco",
    proyecto: "Banco de pruebas",
    actividad: "Ensamble",
    tipo: "Orden de Trabajo OT",
    responsableTaller: "Juan Carlos",
    estado: "Pendiente",
    fechaObjetivo: "10/07/2026",
    prioridad: "Alta",
    complejidad: "Alta",
    comentario: ""
  },
  {
    id: "TASK-002",
    semana: "Semana actual",
    otPsi: "OT 12031",
    cliente: "ENAP",
    proyecto: "Cilindros",
    actividad: "Pruebas",
    tipo: "Orden de Trabajo OT",
    responsableTaller: "Juan Carlos",
    estado: "En proceso",
    fechaObjetivo: "11/07/2026",
    prioridad: "Media",
    complejidad: "Media",
    comentario: ""
  },
  {
    id: "TASK-003",
    semana: "Semana actual",
    otPsi: "PSI-26-0018",
    cliente: "CMM",
    proyecto: "Panel H2",
    actividad: "Revisar plano",
    tipo: "Ingeniería",
    responsableTaller: "Santiago",
    estado: "Pendiente",
    fechaObjetivo: "10/07/2026",
    prioridad: "Alta",
    complejidad: "Alta",
    comentario: ""
  },
  {
    id: "TASK-004",
    semana: "Semana actual",
    otPsi: "PSI-26-0026",
    cliente: "Oxiquim",
    proyecto: "Regulador N2",
    actividad: "Actualizar BOM",
    tipo: "Ingeniería",
    responsableTaller: "Santiago",
    estado: "En proceso",
    fechaObjetivo: "12/07/2026",
    prioridad: "Media",
    complejidad: "Media",
    comentario: ""
  },
  {
    id: "TASK-005",
    semana: "Semana actual",
    otPsi: "PSI-26-0031",
    cliente: "Lipigas",
    proyecto: "Flexibles muestreo",
    actividad: "Cotización",
    tipo: "Cotización",
    responsableTaller: "David",
    estado: "En proceso",
    fechaObjetivo: "10/07/2026",
    prioridad: "Media",
    complejidad: "Media",
    comentario: ""
  },
  {
    id: "TASK-006",
    semana: "Semana actual",
    otPsi: "OT 12047",
    cliente: "Metrogas",
    proyecto: "Cilindros",
    actividad: "Documentación",
    tipo: "Documentación",
    responsableTaller: "David",
    estado: "Pendiente",
    fechaObjetivo: "11/07/2026",
    prioridad: "Normal",
    complejidad: "Baja",
    comentario: ""
  }
];

const PLANNING_USE_MOCKS = window.PLANNING_USE_MOCKS === true;
let PLANNING_TASKS = PLANNING_USE_MOCKS ? PLANNING_MOCK_TASKS.map(task => ({ ...task })) : [];
let PLANNING_DATA_ERROR = null;

function getPlanningTasks() {
  return PLANNING_TASKS;
}

function getPlanningResponsibleUsers() {
  return PLANNING_RESPONSIBLE_USERS;
}

function getPlanningResponsibleNames() {
  return PLANNING_RESPONSIBLE_USERS.map(user => user.name);
}

function setPlanningResponsibleUsers(users) {
  if (!users) {
    PLANNING_RESPONSIBLE_USERS = PLANNING_USERS.map(name => ({
      uid: name,
      name
    }));

    return PLANNING_RESPONSIBLE_USERS;
  }

  PLANNING_RESPONSIBLE_USERS = users.map(user => ({
    uid: user.uid || user.name,
    name: user.name
  }));

  return PLANNING_RESPONSIBLE_USERS;
}

function setPlanningTasks(tasks) {
  PLANNING_TASKS = tasks || [];

  return PLANNING_TASKS;
}

function setPlanningTaskComments(taskId, comments) {
  PLANNING_TASKS = PLANNING_TASKS.map(existingTask => {
    if (existingTask.id !== taskId) {
      return existingTask;
    }

    return {
      ...existingTask,
      comentariosLocales: comments || []
    };
  });

  return PLANNING_TASKS.find(existingTask => existingTask.id === taskId) || null;
}

function getProductionOrders() {
  return PLANNING_PRODUCTION_ORDERS;
}

function findProductionOrderByNumber(value) {
  const normalizedValue = normalizeProductionOrderInput(value);

  if (!normalizedValue) return null;

  return getProductionOrders().find(order =>
    normalizeProductionOrderInput(order.productionOrder) === normalizedValue ||
    normalizeProductionOrderInput(order.customSolution) === normalizedValue
  ) || null;
}

function calculatePlanningKPIs(tasks) {
  const kpis = {
    total: tasks.length,
    pendientes: 0,
    enProceso: 0,
    pausadas: 0,
    terminadas: 0,
    reprogramadas: 0
  };

  tasks.forEach(task => {
    const status = normalizePlanningStatusValue(task.estado);

    if (status === "pendiente") kpis.pendientes++;
    if (status === "en proceso") kpis.enProceso++;
    if (status === "pausada") kpis.pausadas++;
    if (isPlanningTaskCompleted(task)) kpis.terminadas++;
    if (status === "reprogramado" || status === "reprogramada") kpis.reprogramadas++;
  });

  return kpis;
}

function generatePlanningCode(tasks = PLANNING_TASKS, date = new Date()) {
  const year = getISOWeekYear(date);
  const week = String(getISOWeekNumber(date)).padStart(2, "0");
  const prefix = `PP-${year}-${week}-`;
  const maxCorrelative = (tasks || []).reduce((maxValue, task) => {
    const code = task?.planningCode || "";

    if (!code.startsWith(prefix)) {
      return maxValue;
    }

    const correlative = Number.parseInt(code.slice(prefix.length), 10);

    return Number.isNaN(correlative) ? maxValue : Math.max(maxValue, correlative);
  }, 0);

  return `${prefix}${String(maxCorrelative + 1).padStart(3, "0")}`;
}

function calculatePlanningComplexityPoints(complexity) {
  const value = normalizePlanningFilterValue(complexity);

  if (value === "baja") return 1;
  if (value === "media") return 2;
  if (value === "alta") return 3;
  if (value === "muy alta") return 5;

  return 0;
}

function getPlanningTaskComplexityPoints(task) {
  if (typeof task?.complexityPoints === "number") {
    return task.complexityPoints;
  }

  return calculatePlanningComplexityPoints(task?.complejidad);
}

function getPlanningTaskCode(task) {
  return task?.planningCode || task?.id || "";
}

function getPlanningTaskOTValue(task) {
  const value = task?.otPsi || task?.ot || "";

  if (/^ot[\s-]*/i.test(value) || /^\d+$/.test(value.toString().trim())) {
    return value;
  }

  return task?.productionOrder || "";
}

function getPlanningTaskPSICodeValue(task) {
  const value = task?.otPsi || "";

  if (value && !/^ot[\s-]*/i.test(value) && !/^\d+$/.test(value.toString().trim())) {
    return value;
  }

  return task?.psiCode || task?.customSolution || "";
}

function getCurrentPlanningISOWeek() {
  return getISOWeekNumber(new Date());
}

function getPlanningTasksForCurrentISOWeek(tasks) {
  return getPlanningTasksForIsoWeek(tasks, getIsoWeekKeyFromPlanningDate(new Date()));
}

function getPlanningTasksForIsoWeek(tasks, weekKey) {
  return (tasks || []).filter(task => {
    const taskWeek = isPlanningTaskCompleted(task)
      ? getIsoWeekKeyFromPlanningDate(getPlanningTaskCompletionDate(task))
      : getIsoWeekKeyFromPlanningDate(parsePlanningDate(task.fechaObjetivo));

    return taskWeek === weekKey;
  });
}

function getPlanningWeeklyStatusCountsForResponsible(tasks, responsibleIdOrName, weekKey) {
  const requested = String(responsibleIdOrName || "").trim();
  const normalizedRequested = normalizePlanningFilterValue(requested);
  const requestedProfile = getPlanningResponsibleUsers().find(user => getPlanningUserUid(user) === requested);
  const normalizedRequestedName = normalizePlanningFilterValue(getPlanningUserDisplayName(requestedProfile, ""));
  const matchingTasks = getPlanningTasksForIsoWeek(tasks, weekKey).filter(task => {
    const responsibleId = getPlanningTaskResponsibleUid(task);
    const normalizedResponsibleName = normalizePlanningFilterValue(getPlanningTaskResponsibleName(task));

    return requested === responsibleId ||
      normalizedRequested === normalizedResponsibleName ||
      (normalizedRequestedName && normalizedRequestedName === normalizedResponsibleName);
  });

  return matchingTasks.reduce((summary, task) => {
    const status = normalizePlanningStatusValue(task.estado);
    if (status === "pendiente") summary.pendientes++;
    if (status === "en proceso") summary.enProceso++;
    if (status === "pausada") summary.pausadas++;
    if (isPlanningTaskCompleted(task)) summary.terminadas++;
    if (status === "reprogramado" || status === "reprogramada") summary.reprogramadas++;
    return summary;
  }, { pendientes: 0, enProceso: 0, pausadas: 0, terminadas: 0, reprogramadas: 0 });
}

function filterPlanningTasks(tasks, filters) {
  const search = normalizePlanningFilterValue(filters.search);

  return tasks.filter(task => {
    const status = normalizePlanningFilterValue(task.estado);
    const priority = normalizePlanningFilterValue(task.prioridad);
    const complexity = normalizePlanningFilterValue(task.complejidad);
    const responsible = normalizePlanningFilterValue(getPlanningTaskResponsibleName(task));

    const matchesResponsible = !filters.responsable ||
      (filters.responsable === "__unassigned__"
        ? !hasPlanningTaskResponsible(task)
        : responsible === normalizePlanningFilterValue(filters.responsable));

    const matchesStatus = !filters.estado ||
      status === normalizePlanningFilterValue(filters.estado);

    const matchesPriority = !filters.prioridad ||
      priority === normalizePlanningFilterValue(filters.prioridad);

    const matchesComplexity = !filters.complejidad ||
      complexity === normalizePlanningFilterValue(filters.complejidad);

    const searchableText = normalizePlanningFilterValue([
      task.otPsi,
      task.cliente,
      task.proyecto,
      task.actividad
    ].join(" "));

    const matchesSearch = !search || searchableText.includes(search);

    return matchesResponsible &&
      matchesStatus &&
      matchesPriority &&
      matchesComplexity &&
      matchesSearch;
  });
}

function isPlanningTaskCompleted(task) {
  const status = normalizePlanningStatusValue(task?.estado);
  return status === "terminado" || status === "terminada";
}

function getPlanningTaskCompletionDate(task) {
  const candidates = [
    task?.fechaTerminoReal,
    task?.terminadoAt,
    task?.completedAt
  ];

  for (const value of candidates) {
    const date = parsePlanningCompletionDate(value);
    if (date) return date;
  }

  return null;
}

function getIsoWeekKeyFromPlanningDate(value) {
  const date = parsePlanningCompletionDate(value);
  if (!date) return "";

  return `${getISOWeekYear(date)}-W${String(getISOWeekNumber(date)).padStart(2, "0")}`;
}

function parsePlanningCompletionDate(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const timestampDate = value.toDate();
    return Number.isNaN(timestampDate?.getTime?.()) ? null : timestampDate;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const text = String(value).trim();
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    return createPlanningCalendarDate(year, month, day);
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parts = text.split(/[/-]/);
  if (parts.length === 3) {
    const [day, month, rawYear] = parts.map(Number);
    const year = rawYear < 100 ? rawYear + 2000 : rawYear;
    return createPlanningCalendarDate(year, month, day);
  }

  return null;
}

function createPlanningCalendarDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function setPlanningDataError(error) {
  PLANNING_DATA_ERROR = error
    ? { code: error.code || "unknown", message: error.message || "No se pudieron cargar las tareas." }
    : null;
  return PLANNING_DATA_ERROR;
}

function getPlanningDataError() {
  return PLANNING_DATA_ERROR;
}

function hasPlanningTaskResponsible(task) {
  return Boolean(task?.responsableId || task?.responsibleUid || getPlanningTaskResponsibleName(task));
}

function isPlanningTaskAvailableForSelfAssignment(task) {
  return task?.deleted !== true &&
    normalizePlanningStatusValue(task?.estado) === "pendiente" &&
    !hasPlanningTaskResponsible(task) &&
    task?.disponibleParaAutoasignacion !== false;
}

function canAdminTakeAndFinishPlanningTask(task, currentUser) {
  return getPlanningNormalizedRole(currentUser) === "admin" &&
    currentUser?.active === true &&
    Boolean(getPlanningUserUid(currentUser)) &&
    isPlanningTaskAvailableForSelfAssignment(task);
}

function getPlanningUserUid(user) {
  return String(user?.uid || user?.id || user?.userId || "").trim();
}

function getPlanningUserDisplayName(user, fallback = "Usuario") {
  if (typeof user === "string") return user.trim() || fallback;

  return String(user?.name || user?.displayName || user?.email || fallback).trim() || fallback;
}

function getPlanningTaskResponsibleUid(task) {
  return String(task?.responsableId || task?.responsibleUid || task?.assignedBy || "").trim();
}

function getPlanningTimelineActorName(event, fallback = "Sistema") {
  const explicitName = event?.user || event?.userName;
  if (explicitName) return String(explicitName).trim() || fallback;

  const userId = getPlanningUserUid({ uid: event?.userId });
  const profile = getPlanningResponsibleUsers().find(user => getPlanningUserUid(user) === userId);
  return profile ? getPlanningUserDisplayName(profile, fallback) : fallback;
}

function prepareNewPlanningTaskForCreation(task, currentUser, now = new Date()) {
  const normalizedStatus = normalizePlanningStatusValue(task?.estado);
  const isCompleted = normalizedStatus === "terminado" || normalizedStatus === "terminada";
  const prepared = { ...task, estado: isCompleted ? "Terminado" : task?.estado };
  if (!isCompleted) return prepared;

  const userId = getPlanningUserUid(currentUser);
  const role = getPlanningNormalizedRole(currentUser);
  const eligible = Boolean(userId) && currentUser?.active === true && currentUser?.assignable === true && ["admin", "operator"].includes(role);
  const hasResponsible = Boolean(prepared.responsableId || prepared.responsibleUid || prepared.responsableNombre || prepared.responsibleName);
  if (!hasResponsible && !eligible) throw new Error("No es posible crear una tarea terminada sin un responsable válido.");

  const completionIso = now.toISOString();
  const ChileDate = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Santiago" }).formatToParts(now);
  const parts = Object.fromEntries(ChileDate.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  const assigneeName = currentUser?.name || currentUser?.email || "Usuario";
  const responsible = hasResponsible ? {} : { responsableId: userId, responsableNombre: assigneeName, responsibleUid: userId, responsibleName: assigneeName, responsableTaller: assigneeName, responsableEmail: currentUser?.email || "", assignedBy: userId, assignedAt: completionIso };
  return { ...prepared, ...responsible, inicioReal: completionIso, fechaTerminoReal: completionIso, terminadoAt: completionIso, terminadoBy: userId, updatedBy: userId, assignmentMode: "created_as_completed", disponibleParaAutoasignacion: false, fechaInicioPlanificada: prepared.fechaInicioPlanificada || `${parts.year}-${parts.month}-${parts.day}` };
}

function getPlanningTaskOwnerUid(task) {
  return String(task?.responsableId ?? task?.responsibleUid ?? task?.assignedBy ?? "").trim();
}

function getPlanningNormalizedRole(user) {
  return String(user?.role || "").trim().toLowerCase();
}

function validatePlanningDateRange(startDate, targetDate) {
  if (!isPlanningIsoCalendarDate(startDate) || !isPlanningIsoCalendarDate(targetDate)) {
    return "Debes indicar ambas fechas planificadas válidas en formato YYYY-MM-DD.";
  }

  if (targetDate < startDate) {
    return "La fecha objetivo no puede ser anterior a la fecha de inicio.";
  }

  return "";
}

function isPlanningIsoCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function canCurrentOperatorEditPlanningDates(task, currentUser) {
  const currentUserId = getPlanningUserUid(currentUser);
  const taskOwnerId = getPlanningTaskOwnerUid(task);
  const role = getPlanningNormalizedRole(currentUser);
  const active = currentUser?.active === true;
  const assignable = currentUser?.assignable === true;
  const ownerMatch = taskOwnerId === currentUserId;
  const pending = normalizePlanningStatusValue(task?.estado) === "pendiente";
  const deleted = task?.deleted === true;
  const alreadyEdited = task?.operatorPlanningDatesEdited === true;
  const finalResult = role === "operator" &&
    active &&
    assignable &&
    Boolean(currentUserId) &&
    !deleted &&
    pending &&
    ownerMatch &&
    !alreadyEdited;

  return finalResult;
}

function applyOperatorPlanningDatesOnce(taskId, dates, currentUser) {
  let updatedTask = null;
  const userName = currentUser?.name || currentUser?.email || "Usuario";

  PLANNING_TASKS = PLANNING_TASKS.map(task => {
    if (task.id !== taskId) return task;

    updatedTask = {
      ...task,
      fechaInicioPlanificada: dates.fechaInicioPlanificada,
      fechaObjetivo: dates.fechaObjetivo,
      operatorPlanningDatesEdited: true,
      operatorPlanningDatesEditedBy: getPlanningUserUid(currentUser),
      updatedBy: getPlanningUserUid(currentUser),
      timelineLocal: [
        ...(task.timelineLocal || []),
        {
          ...createPlanningTimelineEvent("operator_planning_dates_set", `${userName} definió las fechas planificadas de la tarea.`, getCurrentPlanningTimestamp(), currentUser, {
            taskId,
            planningCode: task.planningCode || "",
            estadoAnterior: task.estado || "",
            estadoNuevo: task.estado || ""
          })
        }
      ]
    };

    return updatedTask;
  });

  return updatedTask;
}

function getPlanningUnassignedTasks(tasks) {
  return (tasks || []).filter(isPlanningTaskAvailableForSelfAssignment);
}

function applyPlanningSelfAssignment(taskId, user, persistedTask = {}) {
  let updatedTask = null;
  const userId = getPlanningUserUid(user);
  const userName = user?.name || user?.email || "Usuario";

  PLANNING_TASKS = PLANNING_TASKS.map(task => {
    if (task.id !== taskId) return task;

    updatedTask = {
      ...task,
      responsableId: userId,
      responsableNombre: userName,
      responsibleUid: userId,
      responsibleName: userName,
      responsableTaller: userName,
      responsableEmail: user.email || "",
      disponibleParaAutoasignacion: false,
      assignmentMode: "self",
      assignedBy: userId,
      updatedBy: userId,
      fechaInicioPlanificada: Object.prototype.hasOwnProperty.call(persistedTask, "fechaInicioPlanificada")
        ? persistedTask.fechaInicioPlanificada
        : task.fechaInicioPlanificada,
      timelineLocal: [...(task.timelineLocal || []), {
        ...createPlanningTimelineEvent("self_assigned", `${userName} tomó la tarea desde la bolsa de tareas disponibles.`, getCurrentPlanningTimestamp(), user, {
          taskId,
          planningCode: task.planningCode || "",
          estadoAnterior: task.estado || "",
          estadoNuevo: task.estado || ""
        })
      }]
    };

    return updatedTask;
  });

  return updatedTask;
}

function applyAdminTakeAndFinishPlanningTask(taskId, user, completedTask) {
  let updatedTask = null;
  const userId = getPlanningUserUid(user);
  const userName = user?.name || user?.email || "Administrador";
  const persistedTask = typeof completedTask === "object" && completedTask !== null ? completedTask : {};
  const timestamp = typeof completedTask === "string"
    ? completedTask
    : persistedTask.inicioReal || persistedTask.fechaTerminoReal || persistedTask.terminadoAt || new Date().toISOString();

  PLANNING_TASKS = PLANNING_TASKS.map(task => {
    if (task.id !== taskId) return task;

    updatedTask = {
      ...task,
      responsableId: userId,
      responsableNombre: userName,
      responsibleUid: userId,
      responsibleName: userName,
      responsableTaller: userName,
      responsableEmail: user?.email || "",
      assignedAt: timestamp,
      assignedBy: userId,
      assignmentMode: "admin_take_and_finish",
      disponibleParaAutoasignacion: false,
      estado: persistedTask.estado || "Terminado",
      inicioReal: timestamp,
      fechaTerminoReal: persistedTask.fechaTerminoReal || timestamp,
      terminadoAt: persistedTask.terminadoAt || timestamp,
      terminadoBy: userId,
      updatedAt: timestamp,
      updatedBy: userId,
      executionLog: [...(task.executionLog || []), { action: "admin_take_and_finish", date: timestamp }],
      timelineLocal: [
        ...(task.timelineLocal || []),
        {
          ...createPlanningTimelineEvent("admin_take_and_finish", `${userName} tomó y terminó la tarea directamente.`, timestamp, user, {
            taskId,
            planningCode: task.planningCode || "",
            estadoAnterior: task.estado || "",
            estadoNuevo: persistedTask.estado || "Terminado"
          }),
          user: userName,
          userId,
          previousResponsible: "",
          nextResponsible: userName,
          previousStatus: task.estado || "Pendiente",
          nextStatus: persistedTask.estado || "Terminado",
          assignmentMode: "admin_take_and_finish",
          inicioReal: timestamp,
          fechaTerminoReal: timestamp
        }
      ]
    };

    return updatedTask;
  });

  return updatedTask;
}

function applyFinishedPlanningTask(taskId, completedTask, user) {
  let updatedTask = null;
  const persistedTask = typeof completedTask === "object" && completedTask !== null ? completedTask : {};
  const completedAt = persistedTask.fechaTerminoReal || persistedTask.terminadoAt || new Date().toISOString();
  const userId = getPlanningUserUid(user);
  const userName = user?.name || user?.email || "Usuario";

  PLANNING_TASKS = PLANNING_TASKS.map(task => {
    if (task.id !== taskId) return task;

    updatedTask = {
      ...task,
      ...persistedTask,
      id: taskId,
      estado: persistedTask.estado || "Terminado",
      inicioReal: persistedTask.inicioReal || completedAt,
      fechaTerminoReal: completedAt,
      terminadoAt: persistedTask.terminadoAt || completedAt,
      terminadoBy: persistedTask.terminadoBy || userId,
      updatedAt: persistedTask.updatedAt || completedAt,
      updatedBy: persistedTask.updatedBy || userId,
      executionLog: [...(task.executionLog || []), { action: "finish", date: completedAt }],
      timelineLocal: [
        ...(task.timelineLocal || []),
        {
          ...createPlanningTimelineEvent("finish", "Tarea terminada", completedAt, user, {
            taskId,
            planningCode: task.planningCode || "",
            estadoAnterior: task.estado || "",
            estadoNuevo: persistedTask.estado || "Terminado"
          }),
          user: userName,
          userId,
          previousStatus: task.estado || "",
          nextStatus: persistedTask.estado || "Terminado",
          inicioReal: persistedTask.inicioReal || completedAt,
          fechaTerminoReal: completedAt
        }
      ]
    };

    return updatedTask;
  });

  return updatedTask;
}

function applyPersistedPlanningExecutionTask(taskId, action, persistedTask, user) {
  let updatedTask = null;
  const actor = user || null;
  const actionInstant = persistedTask?.updatedAt || persistedTask?.inicioReal || new Date().toISOString();

  PLANNING_TASKS = PLANNING_TASKS.map(task => {
    if (task.id !== taskId) return task;

    updatedTask = {
      ...task,
      ...persistedTask,
      id: taskId,
      executionLog: [...(task.executionLog || []), { action, date: actionInstant }],
      timelineLocal: [
        ...(task.timelineLocal || []),
        createPlanningTimelineEvent(action, getPlanningExecutionEventDescription(action), actionInstant, actor, {
          taskId,
          planningCode: task.planningCode || persistedTask?.planningCode || "",
          previousStatus: task.estado || "",
          nextStatus: persistedTask?.estado || task.estado || ""
        })
      ]
    };

    return updatedTask;
  });

  return updatedTask;
}

function addPlanningTask(task, actor = null) {
  const taskId = task.id || `TASK-${Date.now()}`;

  PLANNING_TASKS.push({
    id: taskId,
    semana: "Semana actual",
    ...task,
    timelineLocal: [
      createPlanningTimelineEvent("create", "Tarea creada", task.createdAt || getCurrentPlanningTimestamp(), actor, {
        taskId,
        planningCode: task.planningCode || ""
      })
    ]
  });

  return PLANNING_TASKS.find(existingTask => existingTask.id === taskId);
}

function addDuplicatedPlanningTask(task, sourceTask, actor = null) {
  const taskId = task.id || `TASK-${Date.now()}`;
  const sourceLabel = sourceTask?.actividad || sourceTask?.otPsi || sourceTask?.id || "tarea original";

  PLANNING_TASKS.push({
    id: taskId,
    semana: "Semana actual",
    ...task,
    timelineLocal: [
      createPlanningTimelineEvent("duplicate", `Tarea duplicada desde ${sourceLabel}`, task.createdAt || getCurrentPlanningTimestamp(), actor, {
        taskId,
        planningCode: task.planningCode || ""
      })
    ]
  });

  return PLANNING_TASKS.find(existingTask => existingTask.id === taskId);
}

function removePlanningTaskFromBoard(taskId) {
  PLANNING_TASKS = PLANNING_TASKS.filter(existingTask => existingTask.id !== taskId);

  return PLANNING_TASKS;
}

function buildDuplicatedPlanningTask(sourceTask) {
  return {
    semana: sourceTask.semana || "Semana actual",
    planningCode: generatePlanningCode(),
    actividad: sourceTask.actividad || "",
    otPsi: sourceTask.otPsi || "",
    psiCode: sourceTask.psiCode || sourceTask.customSolution || "",
    productionOrder: sourceTask.productionOrder || "",
    cliente: sourceTask.cliente || "",
    proyecto: sourceTask.proyecto || "",
    responsableTaller: getPlanningTaskResponsibleName(sourceTask),
    responsibleUid: sourceTask.responsibleUid || "",
    responsibleName: getPlanningTaskResponsibleName(sourceTask),
    tipo: sourceTask.tipo || "",
    estado: "Pendiente",
    prioridad: sourceTask.prioridad || "Normal",
    complejidad: sourceTask.complejidad || "Media",
    complexityPoints: getPlanningTaskComplexityPoints(sourceTask),
    motivo: sourceTask.motivo || "Sin desviación",
    fechaInicioPlanificada: sourceTask.fechaInicioPlanificada || "",
    fechaObjetivo: sourceTask.fechaObjetivo || "",
    comentario: sourceTask.comentario || "",
    comentariosLocales: [],
    timelineLocal: [],
    executionLog: [],
    inicioReal: "",
    pausas: [],
    reanudaciones: [],
    fechaTerminoReal: "",
    deleted: false
  };
}

function updatePlanningTask(taskId, task, actor = null) {
  let updatedTask = null;

  PLANNING_TASKS = PLANNING_TASKS.map(existingTask => {
    if (existingTask.id !== taskId) {
      return existingTask;
    }

    const previousResponsible = getPlanningTaskResponsibleName(existingTask) || "Sin responsable";
    const nextResponsible = getPlanningTaskResponsibleName({ ...existingTask, ...task }) || "Sin responsable";
    const previousStatus = existingTask.estado || "Sin estado";
    const nextStatus = task.estado || previousStatus;
    const changes = [];

    if (previousResponsible !== nextResponsible) {
      changes.push(`Responsable: ${previousResponsible} → ${nextResponsible}`);
    }

    if (previousStatus !== nextStatus) {
      changes.push(`Estado: ${previousStatus} → ${nextStatus}`);
    }

    const hasOtherEffectiveChanges = Object.entries(task).some(([field, value]) => {
      if (["responsableId", "responsableNombre", "responsibleUid", "responsibleName", "responsableTaller", "estado"].includes(field)) {
        return false;
      }

      return JSON.stringify(existingTask[field] ?? "") !== JSON.stringify(value ?? "");
    });

    if (hasOtherEffectiveChanges) {
      changes.push("Campos actualizados");
    }

    if (changes.length === 0) {
      updatedTask = { ...existingTask, ...task };
      return updatedTask;
    }

    updatedTask = {
      ...existingTask,
      ...task,
      timelineLocal: [
        ...(existingTask.timelineLocal || []),
        createPlanningTimelineEvent("edit", changes.length ? `Tarea editada. ${changes.join(". ")}` : "Tarea editada", getCurrentPlanningTimestamp(), actor, {
          taskId,
          planningCode: existingTask.planningCode || task.planningCode || ""
        })
      ]
    };

    return updatedTask;
  });

  return updatedTask;
}

function executePlanningTask(taskId, action, actor = null) {
  const timestamp = getCurrentPlanningTimestamp();
  let updatedTask = null;

  PLANNING_TASKS = PLANNING_TASKS.map(existingTask => {
    if (existingTask.id !== taskId) {
      return existingTask;
    }

    const executionLog = existingTask.executionLog || [];
    const taskUpdate = {
      executionLog: [
        ...executionLog,
        {
          action,
          date: timestamp
        }
      ],
      timelineLocal: [
        ...(existingTask.timelineLocal || []),
        createPlanningTimelineEvent(action, getPlanningExecutionEventDescription(action), timestamp, actor, {
          taskId,
          planningCode: existingTask.planningCode || ""
        })
      ]
    };

    if (action === "start") {
      taskUpdate.estado = "En proceso";
      taskUpdate.inicioReal = existingTask.inicioReal || timestamp;
    }

    if (action === "pause") {
      taskUpdate.estado = "Pausada";
      taskUpdate.pausas = [
        ...(existingTask.pausas || []),
        timestamp
      ];
    }

    if (action === "resume") {
      taskUpdate.estado = "En proceso";
      taskUpdate.reanudaciones = [
        ...(existingTask.reanudaciones || []),
        timestamp
      ];
    }

    if (action === "finish") {
      taskUpdate.estado = "Terminado";
      taskUpdate.fechaTerminoReal = timestamp;
    }

    updatedTask = {
      ...existingTask,
      ...taskUpdate
    };

    return updatedTask;
  });

  return updatedTask;
}

function addPlanningTaskComment(taskId, comment, actor = null) {
  const timestamp = getCurrentPlanningTimestamp();
  const commentData = typeof comment === "string"
    ? {
        text: comment,
        date: timestamp,
        user: getPlanningUserDisplayName(actor),
        userId: getPlanningUserUid(actor)
      }
    : {
        ...comment,
        date: comment.date || timestamp,
        user: getPlanningTimelineActorName(comment, getPlanningUserDisplayName(actor)),
        userId: comment.userId || getPlanningUserUid(actor)
      };
  let updatedTask = null;

  PLANNING_TASKS = PLANNING_TASKS.map(existingTask => {
    if (existingTask.id !== taskId) {
      return existingTask;
    }

    updatedTask = {
      ...existingTask,
      comentariosLocales: [
        ...(existingTask.comentariosLocales || []),
        commentData
      ],
      timelineLocal: [
        ...(existingTask.timelineLocal || []),
        createPlanningTimelineEvent("comment", "Comentario agregado", timestamp, actor || commentData, {
          taskId,
          planningCode: existingTask.planningCode || ""
        })
      ]
    };

    return updatedTask;
  });

  return updatedTask;
}

function getCurrentPlanningTimestamp() {
  return new Date().toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function createPlanningTimelineEvent(type, description, timestamp = getCurrentPlanningTimestamp(), actor = null, metadata = {}) {
  const user = getPlanningUserDisplayName(actor, "Sistema");
  return {
    type,
    action: type,
    description,
    comment: description,
    date: timestamp,
    createdAt: timestamp,
    user,
    userName: user,
    userId: getPlanningUserUid(actor),
    ...metadata
  };
}

function getPlanningExecutionEventDescription(action) {
  const descriptions = {
    start: "Tarea iniciada",
    pause: "Tarea pausada",
    resume: "Tarea reanudada",
    finish: "Tarea terminada"
  };

  return descriptions[action] || "Tarea actualizada";
}

function normalizePlanningStatusValue(status) {
  return (status || "").toLowerCase();
}

function normalizePlanningFilterValue(value) {
  return (value || "").toString().trim().toLowerCase();
}

function normalizeProductionOrderInput(value) {
  return (value || "").toString()
    .trim()
    .toLowerCase()
    .replace(/^ot[\s-]*/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function parsePlanningDate(value) {
  if (!value) return null;

  const text = value.toString().trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parts = text.split("/");

  if (parts.length !== 3) {
    return null;
  }

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  let year = Number(parts[2]);

  if (!day || !month || !year) {
    return null;
  }

  if (year < 100) {
    year += 2000;
  }

  return new Date(year, month - 1, day);
}

function getISOWeekNumber(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;

  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);

  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

  return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
}

function getISOWeekYear(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;

  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);

  return target.getUTCFullYear();
}

function groupPlanningTasksByUser(tasks) {
  const grouped = {};

  getPlanningResponsibleNames().forEach(user => {
    grouped[user] = [];
  });

  tasks.forEach(task => {
    const responsable = getPlanningTaskResponsibleName(task) || "Sin responsable";

    if (!grouped[responsable]) {
      grouped[responsable] = [];
    }

    grouped[responsable].push(task);
  });

  return grouped;
}

function getPlanningTaskResponsibleName(task) {
  const explicitName = task?.responsableNombre || task?.responsibleName || task?.responsableTaller || task?.responsible;
  if (explicitName) return explicitName;

  const responsibleId = getPlanningTaskResponsibleUid(task);
  const profile = getPlanningResponsibleUsers().find(user => getPlanningUserUid(user) === responsibleId);
  return profile ? getPlanningUserDisplayName(profile, "") : "";
}
