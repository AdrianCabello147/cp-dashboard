async function initPlanning() {
    try {
        await loadPlanningTasksFromDataSource();
    } catch (error) {
        console.error("No se pudieron cargar las tareas de Planificación.", error);
    }

    refreshPlanningBoard();
}

function refreshPlanningBoard() {
    const tasks = getPlanningTasks();
    renderPlanningModule(tasks);
}

async function loadPlanningTasksFromDataSource() {
    const tasks = await loadPlanningTasks();
    setPlanningTasks(tasks);
}

async function createPlanningTask(task) {
    console.log("[Planning] Antes de llamar a Firestore para crear tarea");

    const savedTask = await savePlanningTask(task);

    console.log("[Planning] Después de llamar a Firestore para crear tarea", savedTask);

    addPlanningTask(savedTask);
    refreshPlanningBoard();
}

async function savePlanningTaskChanges(taskId, task) {
    const updatedTask = updatePlanningTask(taskId, task);

    if (updatedTask) {
        await updatePlanningTaskData(taskId, updatedTask);
    }

    refreshPlanningBoard();
}

async function executePlanningTaskAction(taskId, action) {
    const updatedTask = executePlanningTask(taskId, action);

    if (updatedTask) {
        await updatePlanningTaskData(taskId, updatedTask);
    }

    refreshPlanningBoard();
}

function addPlanningTaskCommentLocal(taskId, text) {
    addPlanningTaskComment(taskId, text);
    refreshPlanningBoard();
}

document.addEventListener("DOMContentLoaded", initPlanning);
