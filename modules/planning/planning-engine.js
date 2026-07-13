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

let PLANNING_TASKS = [
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
    if (status === "terminado" || status === "terminada") kpis.terminadas++;
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
  const currentWeek = getCurrentPlanningISOWeek();
  const currentYear = getISOWeekYear(new Date());

  return tasks.filter(task => {
    const dueDate = parsePlanningDate(task.fechaObjetivo);

    if (!dueDate) return false;

    return getISOWeekNumber(dueDate) === currentWeek &&
      getISOWeekYear(dueDate) === currentYear;
  });
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

function hasPlanningTaskResponsible(task) {
  return Boolean(task?.responsableId || task?.responsibleUid || getPlanningTaskResponsibleName(task));
}

function isPlanningTaskAvailableForSelfAssignment(task) {
  return task?.deleted !== true &&
    normalizePlanningStatusValue(task?.estado) === "pendiente" &&
    !hasPlanningTaskResponsible(task) &&
    task?.disponibleParaAutoasignacion !== false;
}

function getPlanningUnassignedTasks(tasks) {
  return (tasks || []).filter(isPlanningTaskAvailableForSelfAssignment);
}

function applyPlanningSelfAssignment(taskId, user) {
  let updatedTask = null;
  const userName = user?.name || user?.email || "Usuario";

  PLANNING_TASKS = PLANNING_TASKS.map(task => {
    if (task.id !== taskId) return task;

    updatedTask = {
      ...task,
      responsableId: user.id,
      responsableNombre: userName,
      responsibleUid: user.id,
      responsibleName: userName,
      responsableTaller: userName,
      responsableEmail: user.email || "",
      disponibleParaAutoasignacion: false,
      assignmentMode: "self",
      assignedBy: user.id,
      timelineLocal: [...(task.timelineLocal || []), {
        ...createPlanningTimelineEvent("self_assigned", `${userName} tomó la tarea desde la bolsa de tareas disponibles.`),
        user: userName
      }]
    };

    return updatedTask;
  });

  return updatedTask;
}

function addPlanningTask(task) {
  const taskId = task.id || `TASK-${Date.now()}`;

  PLANNING_TASKS.push({
    id: taskId,
    semana: "Semana actual",
    ...task,
    timelineLocal: [
      createPlanningTimelineEvent("create", "Tarea creada")
    ]
  });

  return PLANNING_TASKS.find(existingTask => existingTask.id === taskId);
}

function addDuplicatedPlanningTask(task, sourceTask) {
  const taskId = task.id || `TASK-${Date.now()}`;
  const sourceLabel = sourceTask?.actividad || sourceTask?.otPsi || sourceTask?.id || "tarea original";

  PLANNING_TASKS.push({
    id: taskId,
    semana: "Semana actual",
    ...task,
    timelineLocal: [
      createPlanningTimelineEvent("duplicate", `Tarea duplicada desde ${sourceLabel}`)
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

function updatePlanningTask(taskId, task) {
  let updatedTask = null;

  PLANNING_TASKS = PLANNING_TASKS.map(existingTask => {
    if (existingTask.id !== taskId) {
      return existingTask;
    }

    updatedTask = {
      ...existingTask,
      ...task,
      timelineLocal: [
        ...(existingTask.timelineLocal || []),
        createPlanningTimelineEvent("edit", "Tarea editada")
      ]
    };

    return updatedTask;
  });

  return updatedTask;
}

function executePlanningTask(taskId, action) {
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
        createPlanningTimelineEvent(action, getPlanningExecutionEventDescription(action), timestamp)
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

function addPlanningTaskComment(taskId, comment) {
  const timestamp = getCurrentPlanningTimestamp();
  const commentData = typeof comment === "string"
    ? {
        text: comment,
        date: timestamp,
        user: "Adrián"
      }
    : {
        ...comment,
        date: comment.date || timestamp,
        user: comment.user || "Adrián"
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
        createPlanningTimelineEvent("comment", "Comentario agregado", timestamp)
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

function createPlanningTimelineEvent(type, description, timestamp = getCurrentPlanningTimestamp()) {
  return {
    type,
    description,
    date: timestamp,
    user: "Adrián"
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
  return task.responsableNombre || task.responsibleName || task.responsableTaller || task.responsible || "";
}
