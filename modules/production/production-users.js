const PRODUCTION_USERS = {

    manager: {
        id: "manager",
        name: "Adrián",
        role: "Manager",
        canSeeAll: true,
        canAssignTasks: true,
        canEditOwners: true,
        canEditTimeline: true,
        canEditComments: true
    },

    david: {
        id: "david",
        name: "David",
        role: "Assembly Technician",
        skills: [
            "ASSEMBLY",
            "TESTING"
        ]
    },

    santiago: {
        id: "santiago",
        name: "Santiago",
        role: "Engineering Technician",
        skills: [
            "ENGINEERING_REVIEW",
            "DOCUMENTATION"
        ]
    },

    juanCarlos: {
        id: "juanCarlos",
        name: "Juan Carlos",
        role: "Workshop Technician",
        skills: [
            "SUPPORTS",
            "ENGRAVING"
        ]
    },

    julio: {
        id: "julio",
        name: "Julio",
        role: "Warehouse",
        skills: [
            "PICKING",
            "MATERIALS_IN_WORKSHOP"
        ]
    },

    hernan: {
        id: "hernan",
        name: "Hernán",
        role: "Warehouse",
        skills: [
            "PICKING",
            "MATERIALS_IN_WORKSHOP"
        ]
    },

    compras: {
        id: "compras",
        name: "Compras",
        role: "Purchasing",
        skills: [
            "WAITING_MATERIALS"
        ]
    },

    servicioCliente: {
        id: "servicioCliente",
        name: "Servicio al Cliente",
        role: "Customer Service",
        skills: [
            "WAITING_MATERIALS",
            "QUOTES"
        ]
    },

    comercial: {
        id: "comercial",
        name: "Comercial",
        role: "Sales",
        canSeeRisk: true
    }

};

function getUser(userId) {
    return PRODUCTION_USERS[userId] || null;
}

function getUsers() {
    return Object.values(PRODUCTION_USERS);
}

function getUsersBySkill(skill) {

    return Object.values(PRODUCTION_USERS)
        .filter(user => user.skills?.includes(skill));

}

function filtrarPorUsuario(productionData, userId) {

    const user = getUser(userId);

    if (!user) return productionData;

    if (user.canSeeAll) {
        return productionData;
    }

    if (user.canSeeRisk) {

        return productionData.filter(ot =>
            ot.prioridad === "Crítica" ||
            ot.prioridad === "Alta" ||
            ot.alerts.length > 0
        );

    }

    return productionData.filter(ot =>
        user.skills?.includes(ot.etapa)
    );

}