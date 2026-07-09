function initPlanning() {
    refreshPlanningBoard();
}

function refreshPlanningBoard() {
    const tasks = getPlanningTasks();
    renderPlanningModule(tasks);
}

function createPlanningTask(task) {
    addPlanningTask(task);
    refreshPlanningBoard();
}

function savePlanningTaskChanges(taskId, task) {
    updatePlanningTask(taskId, task);
    refreshPlanningBoard();
}

function executePlanningTaskAction(taskId, action) {
    executePlanningTask(taskId, action);
    refreshPlanningBoard();
}

function addPlanningTaskCommentLocal(taskId, text) {
    addPlanningTaskComment(taskId, text);
    refreshPlanningBoard();
}

document.addEventListener("DOMContentLoaded", initPlanning);
