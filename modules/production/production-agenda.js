function agruparTareasPorResponsable(productionData) {

    const agenda = {};

    productionData.forEach(ot => {

        ot.tasks.forEach(task => {

            const responsable = task.responsible || "Sin responsable";

            if (!agenda[responsable]) {
                agenda[responsable] = [];
            }

            agenda[responsable].push({

                id: task.id,

                code: ot.productionOrder,

                customer: ot.customer,

                project: ot.customSolution,

                title: task.title,

                stage: ot.etapa,

                priority: ot.prioridad,

                owner: ot.owner || "",

                participants: getParticipants(ot),

                responsible: responsable,

                dueDate: task.dueDate || ot.dueDate,

                status: task.status || "Disponible",

                alerts: ot.alerts || []

            });

        });

    });

    return agenda;

}

function obtenerTrabajoDisponible(productionData) {

    return {

        assembly: productionData.filter(ot => ot.etapa === "ASSEMBLY"),

        picking: productionData.filter(ot => ot.etapa === "PICKING"),

        materials: productionData.filter(ot => ot.etapa === "WAITING_MATERIALS"),

        supports: productionData.filter(ot => ot.etapa === "SUPPORTS"),

        documentation: productionData.filter(ot => ot.etapa === "DOCUMENTATION")

    };

}

function obtenerCargaEquipo(productionData) {

    const agenda = agruparTareasPorResponsable(productionData);

    return Object.entries(agenda)

        .map(([responsable, tareas]) => ({

            responsable,

            total: tareas.length,

            criticas: tareas.filter(t => t.priority === "Crítica").length,

            altas: tareas.filter(t => t.priority === "Alta").length

        }))

        .sort((a, b) => b.total - a.total);

}

function obtenerMisTareas(productionData, usuario) {

    return productionData.flatMap(ot =>

        ot.tasks

            .filter(task => task.owner === usuario || task.assignedTo === usuario)

            .map(task => ({

                ...task,

                productionOrder: ot.productionOrder,

                customer: ot.customer,

                project: ot.customSolution

            }))

    );

}