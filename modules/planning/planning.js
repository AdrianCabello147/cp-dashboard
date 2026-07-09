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

    const savedTask = await savePlanningTask(task);

    console.log("[Planning] Después de llamar a Firestore para crear tarea", savedTask);

    const localTask = addPlanningTask(savedTask);
    await persistLatestPlanningTimelineEvent(localTask);
    refreshPlanningBoard();
}

async function savePlanningTaskChanges(taskId, task) {
    const updatedTask = updatePlanningTask(taskId, task);

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

async function deletePlanningTaskAction(taskId) {
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

document.addEventListener("DOMContentLoaded", initPlanning);
