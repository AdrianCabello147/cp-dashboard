const PRODUCTION_STAGES = {
    ENGINEERING_REVIEW: {
        label: "Revisión Ingeniería",
        action: "Revisar OT",
        blocker: "Revisión pendiente",
        responsible: "Adrián",
        progress: 10
    },

    SUPPORTS: {
        label: "Esperando soportes",
        action: "Fabricar soportes",
        blocker: "Soportes pendientes",
        responsible: "Juan Carlos",
        progress: 20
    },

    WAITING_MATERIALS: {
        label: "Esperando materiales",
        action: "Comprar materiales",
        blocker: "Componentes sin stock",
        responsible: "Compras",
        progress: 30
    },

    PICKING: {
        label: "Lista para Picking",
        action: "Generar Picking",
        blocker: "Picking pendiente",
        responsible: "Julio / Hernán",
        progress: 45
    },

    READY_TO_ASSEMBLE: {
        label: "Lista para ensamblar",
        action: "Iniciar ensamblaje",
        blocker: "Sin bloqueador",
        responsible: "David / Juan Carlos / Santiago",
        progress: 60
    }
};

function evaluarProductionOrder(ot) {
    const etapa = determinarEtapa(ot);
    const config = PRODUCTION_STAGES[etapa];

    return {
        ...ot,
        etapa,
        estado: config.label,
        bloqueador: config.blocker,
        accion: config.action,
        responsable: config.responsible,
        progress: config.progress,
        tasks: crearTareasPorEtapa(ot, etapa)
    };
}

function determinarEtapa(ot) {
    if (requiereSoportes(ot) && soporteVencido(ot)) {
        return "SUPPORTS";
    }

    if (ot.missingComponents > 0) {
        return "WAITING_MATERIALS";
    }

    if (ot.pickingPending > 0) {
        return "PICKING";
    }

    if (ot.readyInWorkshop === ot.totalComponents) {
        return "READY_TO_ASSEMBLE";
    }

    return "ENGINEERING_REVIEW";
}

function crearTareasPorEtapa(ot, etapa) {
    const config = PRODUCTION_STAGES[etapa];

    const task = {
        id: etapa,
        description: config.action,
        responsible: config.responsible,
        completed: false
    };

    if (etapa === "SUPPORTS") {
        task.dueDate = ot.supportDate;
    }

    return [task];
}

function requiereSoportes(ot) {
    const texto = `${ot.description} ${ot.customSolution} ${ot.components.map(c => `${c.itemCode} ${c.description}`).join(" ")}`.toLowerCase();

    return (
        texto.includes("soporte") ||
        texto.includes("bracket") ||
        texto.includes("rack") ||
        texto.includes("panel") ||
        texto.includes("placa") ||
        texto.includes("estructura")
    );
}

function soporteVencido(ot) {
    if (!ot.supportDate) return false;

    const fechaSoporte = convertirFecha(ot.supportDate);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return fechaSoporte && hoy >= fechaSoporte;
}

function calcularFechaSoportes(fechaTexto) {
    const fecha = convertirFecha(fechaTexto);

    if (!fecha) return "";

    const soporte = new Date(fecha);
    soporte.setDate(soporte.getDate() - 14);

    return soporte.toLocaleDateString("es-CL");
}

function calcularPrioridad(fechaTexto) {
    const fecha = convertirFecha(fechaTexto);

    if (!fecha) return "Normal";

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const dias = Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));

    if (dias < 0) return "Crítica";
    if (dias <= 3) return "Crítica";
    if (dias <= 7) return "Alta";
    if (dias <= 14) return "Media";

    return "Normal";
}

function convertirFecha(fechaTexto) {
    if (!fechaTexto) return null;

    const partes = fechaTexto.toString().split("/");

    if (partes.length !== 3) return null;

    const dia = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;
    let anio = parseInt(partes[2], 10);

    if (anio < 100) anio += 2000;

    return new Date(anio, mes, dia);
}