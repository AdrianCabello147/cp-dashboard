async function initPlanning() {
    try {
        await loadPlanningResponsibleUsersFromDataSource();
        await loadPlanningTasksFromDataSource();
    } catch (error) {
        console.error("No se pudieron cargar las tareas de Planificación.", error);
    }

    refreshPlanningBoard();
}

async function loadPlanningResponsibleUsersFromDataSource() {
    try {
        const users = await loadPlanningResponsibleUsers();
        setPlanningResponsibleUsers(users);
    } catch (error) {
        console.warn("No se pudieron cargar responsables desde Firestore. Se usará la lista fija de respaldo.", error);
        setPlanningResponsibleUsers(null);
    }
}

function refreshPlanningBoard() {
    const tasks = getPlanningTasks();
    renderPlanningModule(tasks);
}

async function loadPlanningTasksFromDataSource() {
    const tasks = await loadPlanningTasks();
    setPlanningTasks(tasks);
    await loadPlanningCommentsForTasks(tasks);
}

async function createPlanningTask(task) {
    console.log("[Planning] Antes de llamar a Firestore para crear tarea");

    const taskToSave = preparePlanningTaskForSave(task);
    const savedTask = await savePlanningTask(taskToSave);

    console.log("[Planning] Después de llamar a Firestore para crear tarea", savedTask);

    const localTask = addPlanningTask(savedTask);
    await persistLatestPlanningTimelineEvent(localTask);
    refreshPlanningBoard();
}

async function savePlanningTaskChanges(taskId, task) {
    if (!canCurrentUserModifyPlanningTasks()) {
        console.warn("Acción no permitida");
        return;
    }

    const currentTask = getPlanningTasks().find(item => item.id === taskId);
    const taskToSave = preparePlanningTaskForSave({
        ...task,
        planningCode: currentTask?.planningCode || task.planningCode
    });
    const updatedTask = updatePlanningTask(taskId, taskToSave);

    if (updatedTask) {
        await updatePlanningTaskData(taskId, updatedTask);
        await persistLatestPlanningTimelineEvent(updatedTask);
    }

    refreshPlanningBoard();
}

async function executePlanningTaskAction(taskId, action) {
    const updatedTask = executePlanningTask(taskId, action);

    if (updatedTask) {
        await updatePlanningTaskData(taskId, updatedTask);
        await persistLatestPlanningTimelineEvent(updatedTask);
    }

    refreshPlanningBoard();
}

async function duplicatePlanningTaskAction(taskId) {
    if (!canCurrentUserModifyPlanningTasks()) {
        console.warn("Acción no permitida");
        return;
    }

    const sourceTask = getPlanningTasks().find(task => task.id === taskId);

    if (!sourceTask) return;

    try {
        const duplicatedTask = buildDuplicatedPlanningTask(sourceTask);
        const savedTask = await savePlanningTask(duplicatedTask);
        const localTask = addDuplicatedPlanningTask(savedTask, sourceTask);

        await persistLatestPlanningTimelineEvent(localTask);
        refreshPlanningBoard();
    } catch (error) {
        console.error("No se pudo duplicar la tarea de Planificación.", error);
    }
}

async function duplicatePlanningTask(taskId) {
    return duplicatePlanningTaskAction(taskId);
}

async function deletePlanningTaskAction(taskId) {
    if (!canCurrentUserModifyPlanningTasks()) {
        console.warn("Acción no permitida");
        return;
    }

    const task = getPlanningTasks().find(item => item.id === taskId);

    if (!task) return;

    try {
        const deletedTask = {
            ...task,
            deleted: true,
            deletedAt: new Date().toISOString(),
            deletedBy: "Adrián"
        };

        await updatePlanningTaskData(taskId, deletedTask);
        await persistPlanningTimelineEvent(taskId, createPlanningTimelineEvent("delete", "Tarea eliminada"));
        removePlanningTaskFromBoard(taskId);
        refreshPlanningBoard();
    } catch (error) {
        console.error("No se pudo eliminar la tarea de Planificación.", error);
    }
}

async function deletePlanningTask(taskId) {
    return deletePlanningTaskAction(taskId);
}

async function exportPlanningToExcel() {
    if (!canCurrentUserModifyPlanningTasks()) {
        console.warn("Acción no permitida");
        return;
    }

    if (!window.XLSX) {
        console.error("No se pudo exportar Planning: la librería XLSX no está disponible.");
        return;
    }

    const tasks = getPlanningTasks().filter(task => task.deleted !== true);
    await loadPlanningTimelineForExport(tasks);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, buildPlanningSheet(tasks), "Planning");
    XLSX.utils.book_append_sheet(workbook, buildPlanningCommentsSheet(tasks), "Comentarios");
    XLSX.utils.book_append_sheet(workbook, buildPlanningTimelineSheet(tasks), "Timeline");
    XLSX.utils.book_append_sheet(workbook, buildPlanningSummarySheet(tasks), "Resumen");

    XLSX.writeFile(workbook, getPlanningExcelFileName());
}

function addPlanningTaskCommentLocal(taskId, text) {
    addPlanningTaskComment(taskId, text);
    refreshPlanningBoard();
}

async function loadPlanningCommentsForTasks(tasks) {
    await Promise.all((tasks || []).map(async task => {
        const comments = await loadPlanningTaskComments(task.id);
        setPlanningTaskComments(task.id, comments);
    }));
}

async function loadPlanningCommentsForTask(taskId) {
    const comments = await loadPlanningTaskComments(taskId);
    return setPlanningTaskComments(taskId, comments);
}

async function addPlanningTaskCommentPersisted(taskId, text) {
    const comment = await savePlanningTaskComment(taskId, text);
    const updatedTask = addPlanningTaskComment(taskId, comment);
    await persistLatestPlanningTimelineEvent(updatedTask);
    refreshPlanningBoard();

    return updatedTask;
}

async function loadPlanningTimelineForTask(taskId) {
    const task = getPlanningTasks().find(item => item.id === taskId);

    if (!task) return null;

    try {
        task.timelineLocal = await loadPlanningTimeline(taskId);
    } catch (error) {
        console.warn("No se pudo cargar el timeline de Planificación desde Firestore.", error);
    }

    return task;
}

async function persistLatestPlanningTimelineEvent(task) {
    const events = task?.timelineLocal || [];
    const latestEvent = events[events.length - 1];

    if (!task?.id || !latestEvent) return;

    await persistPlanningTimelineEvent(task.id, latestEvent);
}

async function persistPlanningTimelineEvent(taskId, event) {
    if (!taskId || !event) return;

    try {
        await savePlanningTimelineEvent(taskId, event);
    } catch (error) {
        console.warn("No se pudo guardar el evento de timeline de Planificación en Firestore.", error);
    }
}

async function loadPlanningTimelineForExport(tasks) {
    await Promise.all((tasks || []).map(async task => {
        try {
            task.timelineLocal = await loadPlanningTimeline(task.id);
        } catch (error) {
            console.warn("No se pudo cargar el timeline de una tarea para exportar Planning.", error);
            task.timelineLocal = task.timelineLocal || [];
        }
    }));
}

function buildPlanningSheet(tasks) {
    const headers = [
        "ID",
        "OT",
        "Código PSI",
        "Actividad",
        "Cliente",
        "Proyecto",
        "Responsable",
        "Estado",
        "Motivo desviación",
        "Prioridad",
        "Complejidad",
        "Puntos",
        "Fecha creación",
        "Fecha objetivo",
        "Fecha inicio real",
        "Fecha término real",
        "Comentario inicial"
    ];
    const rows = tasks.map(task => ({
        "ID": getPlanningTaskCode(task),
        "OT": getPlanningTaskOTValue(task),
        "Código PSI": getPlanningTaskPSICodeValue(task),
        "Actividad": task.actividad || "",
        "Cliente": task.cliente || "",
        "Proyecto": task.proyecto || "",
        "Responsable": getPlanningTaskResponsibleName(task),
        "Estado": task.estado || "",
        "Motivo desviación": getPlanningDeviationReasonForExport(task),
        "Prioridad": task.prioridad || "",
        "Complejidad": task.complejidad || "",
        "Puntos": getPlanningTaskComplexityPoints(task),
        "Fecha creación": formatPlanningExportDate(task.createdAt || task.fechaCreacion || ""),
        "Fecha objetivo": task.fechaObjetivo || "",
        "Fecha inicio real": task.inicioReal || "",
        "Fecha término real": task.fechaTerminoReal || "",
        "Comentario inicial": task.comentario || ""
    }));

    return XLSX.utils.json_to_sheet(rows, { header: headers });
}

function buildPlanningCommentsSheet(tasks) {
    const headers = [
        "Fecha",
        "Usuario",
        "Actividad",
        "Comentario"
    ];
    const rows = [];

    tasks.forEach(task => {
        (task.comentariosLocales || []).forEach(comment => {
            rows.push({
                "Fecha": comment.date || formatPlanningExportDate(comment.createdAt || ""),
                "Usuario": comment.user || "Adrián",
                "Actividad": task.actividad || "",
                "Comentario": comment.text || ""
            });
        });
    });

    return XLSX.utils.json_to_sheet(rows, { header: headers });
}

function buildPlanningTimelineSheet(tasks) {
    const headers = [
        "Fecha",
        "Usuario",
        "Acción",
        "Actividad"
    ];
    const rows = [];

    tasks.forEach(task => {
        (task.timelineLocal || []).forEach(event => {
            rows.push({
                "Fecha": event.date || formatPlanningExportDate(event.createdAt || ""),
                "Usuario": event.user || "Sistema",
                "Acción": getPlanningTimelineExportAction(event),
                "Actividad": task.actividad || ""
            });
        });
    });

    return XLSX.utils.json_to_sheet(rows, { header: headers });
}

function buildPlanningSummarySheet(tasks) {
    const kpis = calculatePlanningKPIs(tasks);
    const headers = [
        "Indicador",
        "Valor"
    ];

    return XLSX.utils.json_to_sheet([
        { "Indicador": "Total", "Valor": kpis.total },
        { "Indicador": "Pendientes", "Valor": kpis.pendientes },
        { "Indicador": "En proceso", "Valor": kpis.enProceso },
        { "Indicador": "Pausadas", "Valor": kpis.pausadas },
        { "Indicador": "Terminadas", "Valor": kpis.terminadas },
        { "Indicador": "Reprogramadas", "Valor": kpis.reprogramadas }
    ], { header: headers });
}

function getPlanningTimelineExportAction(event) {
    if (event.description) {
        return event.description;
    }

    if (typeof getPlanningTimelineTypeLabel === "function") {
        return getPlanningTimelineTypeLabel(event.type);
    }

    return event.type || "";
}

function formatPlanningExportDate(value) {
    if (!value) return "";

    const date = typeof value.toDate === "function"
        ? value.toDate()
        : value instanceof Date
            ? value
            : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value.toString();
    }

    return date.toLocaleString("es-CL", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function getPlanningExcelFileName() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    return `Planning_PSI_${year}-${month}-${day}_${hours}-${minutes}.xlsx`;
}

function preparePlanningTaskForSave(task) {
    const complexity = task.complejidad || "";

    return {
        ...task,
        planningCode: isPlanningCode(task.planningCode) ? task.planningCode : generatePlanningCode(getPlanningTasks()),
        motivo: task.motivo || "Sin desviación",
        fechaCreacion: task.fechaCreacion || getCurrentPlanningTimestamp(),
        complexityPoints: calculatePlanningComplexityPoints(complexity)
    };
}

function getPlanningDeviationReasonForExport(task) {
    const reason = (task.motivo || "").trim();

    if (!reason || reason === "Sin desviación") {
        return "";
    }

    return reason;
}

function isPlanningCode(value) {
    return /^PP-\d{4}-\d{2}-\d{3}$/.test((value || "").toString());
}

document.addEventListener("DOMContentLoaded", initPlanning);
document.addEventListener("user-profile-loaded", refreshPlanningBoard);
