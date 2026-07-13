import { auth, db } from "./firebase-config.js";

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

export async function claimPlanningTask(taskId, currentUser) {
    if (!taskId || !currentUser?.id || currentUser.active !== true || currentUser.assignable !== true) {
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
            responsableId: currentUser.id,
            responsableNombre: userName,
            responsibleUid: currentUser.id,
            responsibleName: userName,
            responsableTaller: userName,
            responsableEmail: currentUser.email || "",
            assignedAt: serverTimestamp(),
            assignedBy: currentUser.id,
            assignmentMode: "self",
            disponibleParaAutoasignacion: false,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.id
        };

        transaction.update(taskRef, update);
        transaction.set(timelineRef, {
            module: "planning",
            code: taskId,
            action: "self_assigned",
            comment: `${userName} tomó la tarea desde la bolsa de tareas disponibles.`,
            taskId,
            userId: currentUser.id,
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
