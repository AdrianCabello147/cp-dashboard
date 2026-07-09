function generarChecklist(ot) {

    const checklistPorEtapa = {

        ENGINEERING_REVIEW: [
            "Plano firmado",
            "BOM validada",
            "Componentes revisados"
        ],

        SUPPORTS: [
            "Soportes fabricados"
        ],

        WAITING_MATERIALS: [
            "Todos los componentes disponibles"
        ],

        PICKING: [
            "Picking generado"
        ],

        MATERIALS_IN_WORKSHOP: [
            "Materiales entregados al taller"
        ],

        ASSEMBLY: [
            "Ensamble terminado"
        ],

        TESTING: [
            "Leak Test",
            "Prueba funcional",
            "Estanqueidad"
        ],

        DOCUMENTATION: [
            "Plano final",
            "Checklist inicial",
            "Plan de pruebas",
            "Checklist final",
            "Certificado Leak Test",
            "Certificado Estanqueidad",
            "Fotografías"
        ],

        READY_TO_DISPATCH: [
            "Producto en Stock SAP",
            "Production Order cerrada"
        ]

    };

    const items = checklistPorEtapa[ot.etapa] || [];

    return items.map((item, index) => ({

        id: `${ot.productionOrder}-${ot.etapa}-${index + 1}`,

        label: item,

        completed: false,

        completedBy: "",

        completedDate: "",

        comments: ""

    }));

}

function porcentajeChecklist(checklist) {

    if (!checklist || checklist.length === 0) return 0;

    const completados = checklist.filter(item => item.completed).length;

    return Math.round((completados / checklist.length) * 100);

}

function checklistCompleto(checklist) {

    if (!checklist || checklist.length === 0) return false;

    return checklist.every(item => item.completed);

}