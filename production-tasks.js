function generarTareas(ot) {
    const tasks = [];

    if (ot.etapa && PRODUCTION_STAGES[ot.etapa]) {
        const stage = PRODUCTION_STAGES[ot.etapa];

        tasks.push({
            id: ot.etapa,
            title: stage.action,
            responsible: stage.responsible,
            dueDate: calcularFechaObjetivoTarea(ot, ot.etapa),
            completed: false
        });
    }

    return tasks;
}

function calcularFechaObjetivoTarea(ot, etapa) {
    if (etapa === "SUPPORTS") {
        return calcularFechaMasDias(ot.creationDate, 2);
    }

    if (etapa === "ENGINEERING_REVIEW") {
        return calcularFechaMasDias(ot.creationDate, 1);
    }

    return ot.dueDate || "";
}

function calcularFechaMasDias(fechaTexto, dias) {
    const fecha = convertirFecha(fechaTexto);

    if (!fecha) return "";

    fecha.setDate(fecha.getDate() + dias);

    return fecha.toLocaleDateString("es-CL");
}