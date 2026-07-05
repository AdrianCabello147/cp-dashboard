function agruparTareasPorResponsable(productionData) {
    const agenda = {};

    productionData.forEach(ot => {
        ot.tasks.forEach(task => {
            const responsable = task.responsible || "Sin responsable";

            if (!agenda[responsable]) {
                agenda[responsable] = [];
            }

            agenda[responsable].push({
                ...task,
                productionOrder: ot.productionOrder,
                customer: ot.customer,
                customSolution: ot.customSolution,
                prioridad: ot.prioridad,
                etapa: ot.etapa,
                alerts: ot.alerts || []
            });
        });
    });

    return agenda;
}