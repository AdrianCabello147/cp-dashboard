const PRODUCTION_STAGES = {

    OT_CREATED: {
        id: "OT_CREATED",
        name: "OT Creada",
        responsible: "Adrián",
        action: "Revisar Ingeniería",
        blocker: "",
        progress: 0
    },

    ENGINEERING_REVIEW: {
        id: "ENGINEERING_REVIEW",
        name: "Revisión Ingeniería",
        responsible: "Adrián",
        action: "Validar Ingeniería",
        blocker: "Ingeniería pendiente",
        progress: 10
    },

    SUPPORTS: {
        id: "SUPPORTS",
        name: "Fabricar Soportes",
        responsible: "Juan Carlos",
        action: "Fabricar soportes",
        blocker: "Soportes pendientes",
        progress: 20
    },

    WAITING_MATERIALS: {
        id: "WAITING_MATERIALS",
        name: "Esperando Materiales",
        responsible: "Compras / CS",
        action: "Esperar materiales",
        blocker: "Materiales pendientes",
        progress: 30
    },

    PICKING: {
        id: "PICKING",
        name: "Generar Picking",
        responsible: "Julio / Hernán",
        action: "Generar Picking",
        blocker: "Picking pendiente",
        progress: 40
    },

    MATERIALS_IN_WORKSHOP: {
        id: "MATERIALS_IN_WORKSHOP",
        name: "Materiales en Taller",
        responsible: "Julio / Hernán",
        action: "Entregar materiales",
        blocker: "",
        progress: 50
    },

    ASSEMBLY: {
        id: "ASSEMBLY",
        name: "Ensamblaje",
        responsible: "David / Juan Carlos / Santiago",
        action: "Ensamblar",
        blocker: "",
        progress: 60
    },

    TESTING: {
        id: "TESTING",
        name: "Pruebas",
        responsible: "PSI",
        action: "Ejecutar pruebas",
        blocker: "",
        progress: 75
    },

    DOCUMENTATION: {
        id: "DOCUMENTATION",
        name: "Documentación",
        responsible: "Adrián",
        action: "Completar documentación",
        blocker: "Documentación pendiente",
        progress: 90
    },

    READY_TO_DISPATCH: {
        id: "READY_TO_DISPATCH",
        name: "Lista para Despacho",
        responsible: "Adrián",
        action: "Despachar",
        blocker: "",
        progress: 95
    },

    CLOSED: {
        id: "CLOSED",
        name: "Production Order Cerrada",
        responsible: "SAP",
        action: "",
        blocker: "",
        progress: 100
    }

};