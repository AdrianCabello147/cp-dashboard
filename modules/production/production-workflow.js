const PRODUCTION_WORKFLOW = [
    "OT_CREATED",
    "ENGINEERING_REVIEW",
    "WAITING_MATERIALS",
    "PICKING",
    "MATERIALS_IN_WORKSHOP",
    "ASSEMBLY",
    "TESTING",
    "DOCUMENTATION",
    "READY_TO_DISPATCH",
    "CLOSED"
];

const PARALLEL_TASK_TYPES = {
    SUPPORTS: {
        name: "Soportes",
        responsible: "Juan Carlos",
        action: "Fabricar soportes"
    },

    ENGRAVING: {
        name: "Grabado",
        responsible: "Juan Carlos",
        action: "Gestionar grabado"
    },

    DOCUMENTATION: {
        name: "Documentación",
        responsible: "Santiago",
        action: "Completar documentación"
    },

    QUOTES: {
        name: "Cotizaciones",
        responsible: "Adrián",
        action: "Enviar cotización"
    }
};

function getNextStage(stageId) {
    const index = PRODUCTION_WORKFLOW.indexOf(stageId);

    if (index === -1 || index === PRODUCTION_WORKFLOW.length - 1) {
        return null;
    }

    return PRODUCTION_WORKFLOW[index + 1];
}

function getPreviousStage(stageId) {
    const index = PRODUCTION_WORKFLOW.indexOf(stageId);

    if (index <= 0) {
        return null;
    }

    return PRODUCTION_WORKFLOW[index - 1];
}

function isFinalStage(stageId) {
    return stageId === "CLOSED";
}

function isValidStage(stageId) {
    return PRODUCTION_WORKFLOW.includes(stageId);
}

function getWorkflowProgress(stageId) {
    const stage = PRODUCTION_STAGES[stageId];

    return stage ? stage.progress : 0;
}