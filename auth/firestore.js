import { auth, db } from "./firebase-config.js?v=2026-07-13-planning-operator-finish-v1";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

/* =====================================================
   COLECCIONES
===================================================== */

const TASKS = collection(db, "tasks");
const COMMENTS = collection(db, "comments");
const TIMELINE = collection(db, "timeline");
const OWNERS = collection(db, "owners");
const USERS = collection(db, "users");

/* =====================================================
   USERS
===================================================== */

export async function ensureUserProfile(user) {

    if (!user?.uid) {
        return null;
    }

    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
        const profile = {
            name: user.displayName || user.email || "",
            email: user.email || "",
            role: "operator",
            active: true,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp()
        };

        await setDoc(userRef, profile);

        return {
            id: user.uid,
            ...profile
        };
    }

    await updateDoc(userRef, {
        lastLogin: serverTimestamp()
    });

    return {
        id: snapshot.id,
        ...snapshot.data()
    };

}

export async function getCurrentUserProfile() {

    const user = auth.currentUser;

    if (!user?.uid) {
        return null;
    }

    const snapshot = await getDoc(doc(db, "users", user.uid));

    if (!snapshot.exists()) {
        return null;
    }

    return {
        id: snapshot.id,
        ...snapshot.data()
    };

}

export async function getActiveUsers() {

    const q = query(
        USERS,
        where("active", "==", true)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
    }));

}

export async function getAssignableUsers() {

    const q = query(
        USERS,
        where("active", "==", true),
        where("assignable", "==", true)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
    }));

}

/* =====================================================
   TASKS
===================================================== */

export async function getAllTasks() {

    const snapshot = await getDocs(TASKS);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

}

export async function saveTask(id, data) {

    await setDoc(doc(db, "tasks", id), data, {
        merge: true
    });

}

export async function createTask(data) {

    return await addDoc(TASKS, {
        ...data,
        createdAt: serverTimestamp()
    });

}

export async function updateTask(id, data) {

    await updateDoc(doc(db, "tasks", id), data);

}

export function getPlanningUserUid(user) {
    return String(user?.uid || user?.id || user?.userId || "").trim();
}

export function getPlanningTaskOwnerUid(task) {
    return String(task?.responsableId ?? task?.responsibleUid ?? task?.assignedBy ?? "").trim();
}

export function validatePlanningDateRange(startDate, targetDate) {
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

export async function claimPlanningTask(taskId, currentUser) {
    const currentUserId = getPlanningUserUid(currentUser);
    const currentUserRole = String(currentUser?.role || "").trim().toLowerCase();

    if (!taskId || !currentUserId || currentUser.active !== true || currentUser.assignable !== true || !["admin", "operator"].includes(currentUserRole)) {
        const error = new Error("No tienes permisos para tomar esta tarea.");
        error.code = "planning/claim-not-allowed";
        throw error;
    }

    const taskRef = doc(db, "tasks", taskId);
    const timelineRef = doc(TIMELINE);
    const userName = currentUser.name || currentUser.email || "Usuario";

    return runTransaction(db, async transaction => {
        const snapshot = await transaction.get(taskRef);

        if (!snapshot.exists()) {
            const error = new Error("La tarea ya no existe.");
            error.code = "planning/task-not-found";
            throw error;
        }

        const task = snapshot.data();
        const hasResponsible = Boolean(task.responsableId || task.responsibleUid || task.responsableNombre || task.responsibleName || task.responsableTaller || task.responsible);
        const isPending = (task.estado || "").trim().toLowerCase() === "pendiente";

        if (task.deleted === true || !isPending || hasResponsible || task.disponibleParaAutoasignacion === false) {
            const error = new Error("Esta tarea ya fue tomada por otro usuario.");
            error.code = "planning/task-already-claimed";
            throw error;
        }

        const update = {
            responsableId: currentUserId,
            responsableNombre: userName,
            responsibleUid: currentUserId,
            responsibleName: userName,
            responsableTaller: userName,
            responsableEmail: currentUser.email || "",
            assignedAt: serverTimestamp(),
            assignedBy: currentUserId,
            assignmentMode: "self",
            disponibleParaAutoasignacion: false,
            updatedAt: serverTimestamp(),
            updatedBy: currentUserId
        };

        transaction.update(taskRef, update);
        transaction.set(timelineRef, {
            module: "planning",
            code: taskId,
            action: "self_assigned",
            comment: `${userName} tomó la tarea desde la bolsa de tareas disponibles.`,
            taskId,
            userId: currentUserId,
            userName,
            previousStatus: task.estado || "",
            nextStatus: task.estado || "Pendiente",
            previousResponsible: task.responsableNombre || task.responsibleName || task.responsableTaller || "",
            nextResponsible: userName,
            assignmentMode: "self",
            createdAt: serverTimestamp()
        });

        return { id: taskId, ...task, ...update, estado: task.estado || "Pendiente" };
    });
}

export async function finishPlanningTask(taskId, currentUser) {
    const currentUserId = getPlanningUserUid(currentUser);

    if (!taskId || !currentUserId) {
        const error = new Error("No tienes permisos para terminar esta tarea.");
        error.code = "planning/finish-not-allowed";
        throw error;
    }

    const taskRef = doc(db, "tasks", taskId);
    const timelineRef = doc(TIMELINE);
    const userName = currentUser.name || currentUser.email || "Usuario";

    return runTransaction(db, async transaction => {
        const snapshot = await transaction.get(taskRef);

        if (!snapshot.exists()) {
            const error = new Error("La tarea ya no existe.");
            error.code = "planning/task-not-found";
            throw error;
        }

        const task = snapshot.data();
        const completedAt = new Date().toISOString();
        const startedAt = task.inicioReal || completedAt;
        const update = {
            estado: "Terminado",
            inicioReal: startedAt,
            fechaTerminoReal: completedAt,
            terminadoAt: completedAt,
            terminadoBy: currentUserId,
            updatedAt: serverTimestamp(),
            updatedBy: currentUserId
        };

        transaction.update(taskRef, update);
        transaction.set(timelineRef, {
            module: "planning",
            code: task.planningCode || taskId,
            taskId,
            action: "finish",
            comment: `${userName} terminó la tarea.`,
            userId: currentUserId,
            userName,
            previousStatus: task.estado || "",
            nextStatus: "Terminado",
            inicioReal: startedAt,
            fechaTerminoReal: completedAt,
            createdAt: serverTimestamp()
        });

        return { id: taskId, ...task, ...update, updatedAt: completedAt };
    });
}

export async function adminTakeAndFinishPlanningTask(taskId, currentUser) {
    const currentUserId = getPlanningUserUid(currentUser);
    const currentUserRole = String(currentUser?.role || "").trim().toLowerCase();

    if (!taskId || !currentUserId || currentUserRole !== "admin" || currentUser?.active !== true) {
        const error = new Error("No tienes permisos para realizar esta acción.");
        error.code = "planning/admin-take-and-finish-not-allowed";
        throw error;
    }

    const taskRef = doc(db, "tasks", taskId);
    const timelineRef = doc(TIMELINE);
    const userName = currentUser.name || currentUser.email || "Administrador";

    return runTransaction(db, async transaction => {
        const snapshot = await transaction.get(taskRef);

        if (!snapshot.exists()) {
            const error = new Error("La tarea ya no está disponible.");
            error.code = "planning/task-not-available";
            throw error;
        }

        const task = snapshot.data();
        const hasResponsible = Boolean(task.responsableId || task.responsibleUid || task.responsableNombre || task.responsibleName || task.responsableTaller || task.responsible);
        const isPending = (task.estado || "").trim().toLowerCase() === "pendiente";

        if (!isPending) {
            const error = new Error("Solo se pueden tomar y terminar tareas pendientes de la Bolsa.");
            error.code = "planning/admin-take-and-finish-not-pending";
            throw error;
        }

        if (task.deleted === true || hasResponsible || task.disponibleParaAutoasignacion === false) {
            const error = new Error("La tarea ya no está disponible.");
            error.code = "planning/task-not-available";
            throw error;
        }

        const completedAt = new Date().toISOString();
        const update = {
            responsableId: currentUserId,
            responsableNombre: userName,
            responsibleUid: currentUserId,
            responsibleName: userName,
            responsableTaller: userName,
            responsableEmail: currentUser.email || "",
            assignedAt: serverTimestamp(),
            assignedBy: currentUserId,
            assignmentMode: "admin_take_and_finish",
            disponibleParaAutoasignacion: false,
            estado: "Terminado",
            inicioReal: completedAt,
            fechaTerminoReal: completedAt,
            terminadoAt: completedAt,
            terminadoBy: currentUserId,
            updatedAt: serverTimestamp(),
            updatedBy: currentUserId
        };

        transaction.update(taskRef, update);
        transaction.set(timelineRef, {
            module: "planning",
            code: task.planningCode || taskId,
            taskId,
            action: "admin_take_and_finish",
            comment: `${userName} tomó y terminó la tarea directamente.`,
            userId: currentUserId,
            userName,
            previousResponsible: "",
            nextResponsible: userName,
            previousStatus: task.estado || "Pendiente",
            nextStatus: "Terminado",
            inicioReal: completedAt,
            fechaTerminoReal: completedAt,
            assignmentMode: "admin_take_and_finish",
            createdAt: serverTimestamp()
        });

        return { id: taskId, ...task, ...update };
    });
}

export async function saveOperatorPlanningDatesOnce(taskId, dates, currentUser) {
    const currentUserId = getPlanningUserUid(currentUser);
    const currentUserRole = String(currentUser?.role || "").trim().toLowerCase();

    if (!taskId || currentUserRole !== "operator" || currentUser?.active !== true || currentUser?.assignable !== true || !currentUserId) {
        const error = new Error("No tienes permisos para editar estas fechas.");
        error.code = "planning/operator-dates-not-allowed";
        throw error;
    }

    const startDate = dates?.fechaInicioPlanificada || "";
    const targetDate = dates?.fechaObjetivo || "";

    const validationMessage = validatePlanningDateRange(startDate, targetDate);

    if (validationMessage) {
        const error = new Error(validationMessage);
        error.code = "planning/operator-dates-invalid";
        throw error;
    }

    const taskRef = doc(db, "tasks", taskId);
    const timelineRef = doc(TIMELINE);
    const userName = currentUser.name || currentUser.email || "Usuario";

    return runTransaction(db, async transaction => {
        const snapshot = await transaction.get(taskRef);

        if (!snapshot.exists()) {
            const error = new Error("La tarea ya no existe.");
            error.code = "planning/task-not-found";
            throw error;
        }

        const task = snapshot.data();
        const isPending = (task.estado || "").trim().toLowerCase() === "pendiente";

        if (task.operatorPlanningDatesEdited === true) {
            const error = new Error("La edición única de fechas ya fue utilizada.");
            error.code = "planning/operator-dates-already-used";
            throw error;
        }

        if (task.deleted === true) {
            const error = new Error("No puedes editar las fechas de una tarea eliminada.");
            error.code = "planning/operator-dates-deleted";
            throw error;
        }

        if (!isPending) {
            const error = new Error("Solo puedes definir fechas mientras la tarea está pendiente.");
            error.code = "planning/operator-dates-not-pending";
            throw error;
        }

        const taskOwnerId = getPlanningTaskOwnerUid(task);

        if (taskOwnerId !== currentUserId) {
            const error = new Error("No puedes editar las fechas de una tarea asignada a otro usuario.");
            error.code = "planning/operator-dates-not-owner";
            throw error;
        }

        if (task.fechaInicioPlanificada === startDate && task.fechaObjetivo === targetDate) {
            const error = new Error("Debes realizar un cambio real en las fechas planificadas.");
            error.code = "planning/operator-dates-no-change";
            throw error;
        }

        const update = {
            fechaInicioPlanificada: startDate,
            fechaObjetivo: targetDate,
            operatorPlanningDatesEdited: true,
            operatorPlanningDatesEditedAt: serverTimestamp(),
            operatorPlanningDatesEditedBy: currentUserId,
            updatedAt: serverTimestamp(),
            updatedBy: currentUserId
        };

        transaction.update(taskRef, update);
        transaction.set(timelineRef, {
            module: "planning",
            code: taskId,
            taskId,
            action: "operator_planning_dates_set",
            comment: `${userName} definió las fechas planificadas de la tarea.`,
            userId: currentUserId,
            userName,
            previousStartDate: task.fechaInicioPlanificada || "",
            nextStartDate: startDate,
            previousTargetDate: task.fechaObjetivo || "",
            nextTargetDate: targetDate,
            createdAt: serverTimestamp()
        });

        return { id: taskId, ...task, ...update };
    });
}

export async function deleteTask(id) {

    await deleteDoc(doc(db, "tasks", id));

}

/* =====================================================
   COMMENTS
===================================================== */

export async function addComment(data) {

    return await addDoc(COMMENTS, {
        ...data,
        createdAt: serverTimestamp()
    });

}

export async function getComments(taskId) {

    const q = query(
        COMMENTS,
        where("taskId", "==", taskId)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

}

/* =====================================================
   TIMELINE
===================================================== */

export async function addTimelineEvent(data) {

    return await addDoc(TIMELINE, {
        ...data,
        createdAt: serverTimestamp()
    });

}

export async function getTimeline(code) {

    const q = query(
        TIMELINE,
        where("code", "==", code)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

}

/* =====================================================
   OWNERS
===================================================== */

export async function saveOwner(code, owner) {

    await setDoc(doc(db, "owners", code), {
        owner,
        updatedAt: serverTimestamp()
    });

}

export async function getOwner(code) {

    const snapshot = await getDoc(doc(db, "owners", code));

    if (!snapshot.exists()) {
        return null;
    }

    return snapshot.data();

}

/* =====================================================
   EXPORTS
===================================================== */

export {
    TASKS,
    COMMENTS,
    TIMELINE,
    OWNERS,
    USERS
};
