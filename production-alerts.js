function generarAlertas(ot) {
    const alerts = [];

    ot.tasks.forEach(task => {
        if (!task.completed && tareaVencida(task.dueDate)) {
            alerts.push({
                type: "danger",
                message: `Tarea vencida: ${task.title}`,
                responsible: task.responsible
            });
        }
    });

    if (ot.missingComponents > 0) {
        alerts.push({
            type: "warning",
            message: "Existen componentes sin stock",
            responsible: "Compras / CS"
        });
    }

    if (ot.prioridad === "Crítica") {
        alerts.push({
            type: "danger",
            message: "Production Order crítica por fecha",
            responsible: ot.responsable
        });
    }

    return alerts;
}

function tareaVencida(fechaTexto) {
    const fecha = convertirFecha(fechaTexto);

    if (!fecha) return false;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return fecha < hoy;
}