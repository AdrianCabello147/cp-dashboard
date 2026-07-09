import {
    createTask,
    getAllTasks,
    updateTask
} from "../../auth/firestore.js";

const PLANNING_FIRESTORE_TIMEOUT_MS = 10000;

export async function loadPlanningTasks() {

    console.log("[Planning][Firestore] Antes de cargar tareas desde Firestore");

    try {
        const tasks = await withPlanningFirestoreTimeout(
            getAllTasks(),
            "Timeout cargando tareas de Planificación desde Firestore"
        );

        console.log("[Planning][Firestore] Después de cargar tareas desde Firestore", tasks.length);

        return tasks.filter(task => task.module === "planning");
    } catch (error) {
        console.error("[Planning][Firestore] Error cargando tareas desde Firestore", error);
        throw error;
    }

}

export async function savePlanningTask(task) {

    const taskData = preparePlanningTaskForFirestore(task);

    console.log("[Planning][Firestore] Antes de crear tarea en Firestore", taskData);

    try {
        const docRef = await withPlanningFirestoreTimeout(
            createTask(taskData),
            "Timeout creando tarea de Planificación en Firestore"
        );

        console.log("[Planning][Firestore] Después de crear tarea en Firestore", docRef.id);

        return {
            ...taskData,
            id: docRef.id
        };
    } catch (error) {
        console.error("[Planning][Firestore] Error creando tarea en Firestore", error);
        throw error;
    }

}

export async function updatePlanningTaskData(taskId, task) {

    const taskData = preparePlanningTaskForFirestore(task);

    console.log("[Planning][Firestore] Antes de actualizar tarea en Firestore", taskId, taskData);

    try {
        await withPlanningFirestoreTimeout(
            updateTask(taskId, taskData),
            "Timeout actualizando tarea de Planificación en Firestore"
        );

        console.log("[Planning][Firestore] Después de actualizar tarea en Firestore", taskId);
    } catch (error) {
        console.error("[Planning][Firestore] Error actualizando tarea en Firestore", error);
        throw error;
    }

    return {
        ...taskData,
        id: taskId
    };

}

function preparePlanningTaskForFirestore(task) {

    const {
        id,
        comentariosLocales,
        timelineLocal,
        ...taskData
    } = task;

    return {
        semana: taskData.semana || "Semana actual",
        ...taskData,
        module: "planning"
    };

}

function withPlanningFirestoreTimeout(operation, message) {

    let timeoutId;

    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(message));
        }, PLANNING_FIRESTORE_TIMEOUT_MS);
    });

    return Promise.race([
        operation,
        timeout
    ]).finally(() => {
        clearTimeout(timeoutId);
    });

}

window.loadPlanningTasks = loadPlanningTasks;
window.savePlanningTask = savePlanningTask;
window.updatePlanningTaskData = updatePlanningTaskData;
