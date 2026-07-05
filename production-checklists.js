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

    return items.map(item => ({
        label: item,
        completed: false
    }));
}