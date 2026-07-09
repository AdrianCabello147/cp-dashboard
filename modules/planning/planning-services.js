import {
    createTask,
    getAllTasks
} from "../../auth/firestore.js";

export async function loadPlanningTasks() {

    const tasks = await getAllTasks();

    return tasks.filter(task => task.module === "planning");

}

export async function savePlanningTask(task) {

    await createTask({
        ...task,
        module: "planning"
    });

}