import {
    addComment,
    addTimelineEvent,
    createTask,
    getComments,
    getAllTasks,
    getAssignableUsers,
    getTimeline,
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

        return tasks.filter(task => task.module === "planning" && !task.deleted);
    } catch (error) {
        console.error("[Planning][Firestore] Error cargando tareas desde Firestore", error);
        throw error;
    }

}

export async function loadPlanningResponsibleUsers() {

    try {
        const users = await withPlanningFirestoreTimeout(
            getAssignableUsers(),
            "Timeout cargando responsables asignables de Planificación"
        );

        return users
            .filter(user => user.name)
            .map(user => ({
                uid: user.uid,
                name: user.name
            }));
    } catch (error) {
        console.warn("[Planning][Firestore] No se pudieron cargar responsables asignables. Se usará la lista fija de respaldo.", error);
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

export async function loadPlanningTaskComments(taskId) {

    console.log("[Planning][Firestore] Antes de cargar comentarios desde Firestore", taskId);

    try {
        const comments = await withPlanningFirestoreTimeout(
            getComments(taskId),
            "Timeout cargando comentarios de Planificación desde Firestore"
        );

        console.log("[Planning][Firestore] Después de cargar comentarios desde Firestore", taskId, comments.length);

        return comments.map(normalizePlanningCommentFromFirestore);
    } catch (error) {
        console.error("[Planning][Firestore] Error cargando comentarios desde Firestore", taskId, error);
        throw error;
    }

}

export async function savePlanningTaskComment(taskId, text) {

    const commentData = {
        taskId,
        text,
        user: "Adrián"
    };

    console.log("[Planning][Firestore] Antes de crear comentario en Firestore", commentData);

    try {
        const docRef = await withPlanningFirestoreTimeout(
            addComment(commentData),
            "Timeout creando comentario de Planificación en Firestore"
        );

        console.log("[Planning][Firestore] Después de crear comentario en Firestore", docRef.id);

        return normalizePlanningCommentFromFirestore({
            ...commentData,
            id: docRef.id,
            createdAt: new Date()
        });
    } catch (error) {
        console.error("[Planning][Firestore] Error creando comentario en Firestore", error);
        throw error;
    }

}

export async function savePlanningTimelineEvent(taskId, event) {

    const eventData = {
        module: "planning",
        code: taskId,
        action: event.type,
        comment: event.description,
        createdAt: event.date,
        user: event.user || "Sistema"
    };

    console.log("[Planning][Firestore] Antes de crear evento timeline en Firestore", eventData);

    try {
        const docRef = await withPlanningFirestoreTimeout(
            addTimelineEvent(eventData),
            "Timeout creando evento timeline de Planificación en Firestore"
        );

        console.log("[Planning][Firestore] Después de crear evento timeline en Firestore", docRef.id);

        return {
            ...event,
            id: docRef.id
        };
    } catch (error) {
        console.error("[Planning][Firestore] Error creando evento timeline en Firestore", error);
        throw error;
    }

}

export async function loadPlanningTimeline(taskId) {

    console.log("[Planning][Firestore] Antes de cargar timeline desde Firestore", taskId);

    try {
        const events = await withPlanningFirestoreTimeout(
            getTimeline(taskId),
            "Timeout cargando timeline de Planificación desde Firestore"
        );

        console.log("[Planning][Firestore] Después de cargar timeline desde Firestore", taskId, events.length);

        return events
            .map(normalizePlanningTimelineEventFromFirestore)
            .sort(comparePlanningTimelineEventsByDate);
    } catch (error) {
        console.error("[Planning][Firestore] Error cargando timeline desde Firestore", taskId, error);
        throw error;
    }

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

function normalizePlanningCommentFromFirestore(comment) {

    return {
        id: comment.id || "",
        taskId: comment.taskId || "",
        text: comment.text || "",
        user: comment.user || "Adrián",
        createdAt: comment.createdAt || null,
        date: formatPlanningCommentDate(comment.createdAt)
    };

}

function formatPlanningCommentDate(createdAt) {

    if (!createdAt) {
        return new Date().toLocaleString("es-CL", {
            dateStyle: "short",
            timeStyle: "short"
        });
    }

    const date = typeof createdAt.toDate === "function"
        ? createdAt.toDate()
        : new Date(createdAt);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleString("es-CL", {
        dateStyle: "short",
        timeStyle: "short"
    });

}

function normalizePlanningTimelineEventFromFirestore(event) {

    return {
        type: event.action || "",
        description: event.comment || "",
        date: formatPlanningCommentDate(event.createdAt),
        createdAt: event.createdAt || null,
        user: event.user || "Sistema"
    };

}

function comparePlanningTimelineEventsByDate(firstEvent, secondEvent) {

    return getPlanningTimelineEventTime(firstEvent) - getPlanningTimelineEventTime(secondEvent);

}

function getPlanningTimelineEventTime(event) {

    const value = event?.createdAt || event?.date;

    if (!value) return 0;

    if (typeof value.toDate === "function") {
        return value.toDate().getTime();
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    if (typeof value === "number") {
        return value;
    }

    if (typeof value === "string") {
        const isoDate = new Date(value);

        if (!Number.isNaN(isoDate.getTime())) {
            return isoDate.getTime();
        }

        const localDate = parsePlanningTimelineLocalDate(value);

        if (localDate) {
            return localDate.getTime();
        }
    }

    return 0;

}

function parsePlanningTimelineLocalDate(value) {

    const match = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4}),?\s+(\d{1,2}):(\d{2})/);

    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);

    if (year < 100) {
        year += 2000;
    }

    const date = new Date(year, month - 1, day, hour, minute);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;

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
window.loadPlanningResponsibleUsers = loadPlanningResponsibleUsers;
window.savePlanningTask = savePlanningTask;
window.updatePlanningTaskData = updatePlanningTaskData;
window.loadPlanningTaskComments = loadPlanningTaskComments;
window.savePlanningTaskComment = savePlanningTaskComment;
window.savePlanningTimelineEvent = savePlanningTimelineEvent;
window.loadPlanningTimeline = loadPlanningTimeline;
