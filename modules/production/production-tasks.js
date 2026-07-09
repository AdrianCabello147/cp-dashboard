function generarTareas(ot) {
    const tasks = [];

    if (ot.etapa && PRODUCTION_STAGES[ot.etapa]) {
        const stage = PRODUCTION_STAGES[ot.etapa];

        tasks.push({
            id: `${ot.productionOrder}-${ot.etapa}`,
            code: ot.productionOrder,
            module: "production",
            type: ot.etapa,
            title: stage.action,
            responsible: stage.responsible,
            owner: ot.owner || "",
            participants: ot.participants || "",
            dueDate: calcularFechaObjetivoTarea(ot, ot.etapa),
            status: "Disponible",
            completed: false
        });
    }

    return tasks;
}

function calcularFechaObjetivoTarea(ot, etapa) {
    if (etapa === "SUPPORTS") {
        return addDays(ot.creationDate, 2);
    }

    if (etapa === "ENGINEERING_REVIEW") {
        return addDays(ot.creationDate, 1);
    }

    return ot.dueDate || "";
}