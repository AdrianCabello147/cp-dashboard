const PRODUCTION_STAGES = {

    OT_CREATED: {
        id: "OT_CREATED",
        name: "OT Creada",
        responsible: "PSI",
        action: "Revisar información inicial",
        blocker: "",
        progress: 0
    },

    ENGINEERING_REVIEW: {
        id: "ENGINEERING_REVIEW",
        name: "Revisión de Ingeniería",
        responsible: "Santiago",
        action: "Validar ingeniería y documentación",
        blocker: "Ingeniería pendiente",
        progress: 10
    },

    SUPPORTS: {
        id: "SUPPORTS",
        name: "Fabricación de Soportes",
        responsible: "Juan Carlos",
        action: "Fabricar soportes",
        blocker: "Soportes pendientes",
        progress: 20
    },

    WAITING_MATERIALS: {
        id: "WAITING_MATERIALS",
        name: "Esperando Materiales",
        responsible: "Compras / Servicio al Cliente",
        action: "Dar seguimiento a materiales",
        blocker: "Materiales pendientes",
        progress: 30
    },

    PICKING: {
        id: "PICKING",
        name: "Picking / Preensamble",
        responsible: "Julio / Hernán",
        action: "Preparar materiales",
        blocker: "Picking pendiente",
        progress: 40
    },

    MATERIALS_IN_WORKSHOP: {
        id: "MATERIALS_IN_WORKSHOP",
        name: "Materiales en Taller",
        responsible: "Julio / Hernán",
        action: "Entregar materiales al taller",
        blocker: "",
        progress: 50
    },

    ASSEMBLY: {
        id: "ASSEMBLY",
        name: "Ensamblaje",
        responsible: "David",
        action: "Realizar ensamblaje",
        blocker: "",
        progress: 60
    },

    TESTING: {
        id: "TESTING",
        name: "Pruebas",
        responsible: "David",
        action: "Ejecutar pruebas",
        blocker: "",
        progress: 75
    },

    DOCUMENTATION: {
        id: "DOCUMENTATION",
        name: "Documentación",
        responsible: "Santiago",
        action: "Completar documentación",
        blocker: "Documentación pendiente",
        progress: 90
    },

    READY_TO_DISPATCH: {
        id: "READY_TO_DISPATCH",
        name: "Lista para Despacho",
        responsible: "Julio / Hernán",
        action: "Preparar despacho",
        blocker: "",
        progress: 95
    },

    CLOSED: {
        id: "CLOSED",
        name: "Production Order Cerrada",
        responsible: "Sistema",
        action: "",
        blocker: "",
        progress: 100
    }

};