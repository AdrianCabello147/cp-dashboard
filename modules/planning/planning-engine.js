const PLANNING_USERS = [
  "Juan Carlos",
  "Santiago",
  "David"
];

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

function setPlanningTasks(tasks) {
  PLANNING_TASKS = tasks || [];

  return PLANNING_TASKS;
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
    const responsible = normalizePlanningFilterValue(task.responsableTaller);

    const matchesResponsible = !filters.responsable ||
      responsible === normalizePlanningFilterValue(filters.responsable);

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

function addPlanningTaskComment(taskId, text) {
  const timestamp = getCurrentPlanningTimestamp();

  PLANNING_TASKS = PLANNING_TASKS.map(existingTask => {
    if (existingTask.id !== taskId) {
      return existingTask;
    }

    return {
      ...existingTask,
      comentariosLocales: [
        ...(existingTask.comentariosLocales || []),
        {
          text,
          date: timestamp,
          user: "Adrián"
        }
      ],
      timelineLocal: [
        ...(existingTask.timelineLocal || []),
        createPlanningTimelineEvent("comment", "Comentario agregado", timestamp)
      ]
    };
  });

  return PLANNING_TASKS;
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

  PLANNING_USERS.forEach(user => {
    grouped[user] = [];
  });

  tasks.forEach(task => {
    const responsable = task.responsableTaller || "Sin responsable";

    if (!grouped[responsable]) {
      grouped[responsable] = [];
    }

    grouped[responsable].push(task);
  });

  return grouped;
}
