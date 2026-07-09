async function assignProductionTask(taskId, user) {
    await updateTask(taskId, {
        assignedTo: user,
        status: "En progreso"
    });

    await addTimelineEvent({
        module: "production",
        code: taskId,
        user,
        action: "Tomar tarea",
        status: "En progreso",
        comment: `${user} tomó la tarea`
    });
}

async function releaseProductionTask(taskId, user) {
    await updateTask(taskId, {
        assignedTo: "",
        status: "Disponible"
    });

    await addTimelineEvent({
        module: "production",
        code: taskId,
        user,
        action: "Liberar tarea",
        status: "Disponible",
        comment: `${user} liberó la tarea`
    });
}

async function completeProductionTask(taskId, user) {
    await updateTask(taskId, {
        status: "Completada",
        completed: true
    });

    await addTimelineEvent({
        module: "production",
        code: taskId,
        user,
        action: "Completar tarea",
        status: "Completada",
        comment: `${user} completó la tarea`
    });
}

async function changeProductionOwner(code, owner, user) {
    await saveOwner(code, owner);

    await addTimelineEvent({
        module: "production",
        code,
        user,
        action: "Cambio de Owner",
        status: owner,
        comment: `Owner cambiado a ${owner}`
    });
}

async function addProductionComment(code, taskId, user, comment) {
    await addComment({
        module: "production",
        code,
        taskId,
        user,
        comment
    });

    await addTimelineEvent({
        module: "production",
        code,
        user,
        action: "Comentario",
        status: "",
        comment
    });
}