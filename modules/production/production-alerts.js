function generarAlertas(ot) {

    const alerts = [];

    ot.tasks.forEach(task => {

        if (!task.completed && isOverdue(task.dueDate)) {

            alerts.push({
                type: "danger",
                message: `Tarea vencida: ${task.title}`,
                responsible: task.responsible,
                taskId: task.id
            });

        }

    });

    if (ot.missingComponents > 0) {

        alerts.push({
            type: "warning",
            message: "Existen componentes sin stock",
            responsible: "Compras / Servicio al Cliente"
        });

    }

    if (ot.prioridad === "Crítica") {

        alerts.push({
            type: "danger",
            message: "Production Order crítica por fecha",
            responsible: ot.owner || ot.responsable || "Sin asignar"
        });

    }

    if (ot.etapa === "WAITING_MATERIALS" && !ot.latestMaterialDate) {

        alerts.push({
            type: "warning",
            message: "Material pendiente sin fecha de llegada",
            responsible: "Compras / Servicio al Cliente"
        });

    }

    return alerts;

}