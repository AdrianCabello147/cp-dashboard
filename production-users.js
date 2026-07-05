const PRODUCTION_USERS = {
    adrian: {
        name: "Adrián",
        role: "admin",
        canSeeAll: true
    },

    david: {
        name: "David",
        role: "ensamble",
        stages: ["ASSEMBLY", "TESTING"]
    },

    juanCarlos: {
        name: "Juan Carlos",
        role: "taller",
        stages: ["SUPPORTS", "ASSEMBLY"]
    },

    santiago: {
        name: "Santiago",
        role: "ensamble",
        stages: ["ASSEMBLY"]
    },

    julio: {
        name: "Julio",
        role: "bodega",
        stages: ["PICKING", "MATERIALS_IN_WORKSHOP"]
    },

    hernan: {
        name: "Hernán",
        role: "bodega",
        stages: ["PICKING", "MATERIALS_IN_WORKSHOP"]
    },

    comercial: {
        name: "Comercial",
        role: "viewer",
        canSeeRisk: true
    }
};

function filtrarPorUsuario(productionData, userKey) {
    const user = PRODUCTION_USERS[userKey];

    if (!user || user.canSeeAll) return productionData;

    if (user.canSeeRisk) {
        return productionData.filter(ot =>
            ot.prioridad === "Crítica" ||
            ot.prioridad === "Alta" ||
            ot.alerts.length > 0
        );
    }

    return productionData.filter(ot =>
        user.stages?.includes(ot.etapa)
    );
}