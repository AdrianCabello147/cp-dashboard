import { db } from "./firebase-config.js";

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
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

/* =====================================================
   COLECCIONES
===================================================== */

const TASKS = collection(db, "tasks");
const COMMENTS = collection(db, "comments");
const TIMELINE = collection(db, "timeline");
const OWNERS = collection(db, "owners");

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
    OWNERS
};