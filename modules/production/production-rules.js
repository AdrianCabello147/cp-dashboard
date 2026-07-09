function evaluarProductionOrder(ot) {

    const etapa = determinarEtapa(ot);
    const config = PRODUCTION_STAGES[etapa];

    return {
        ...ot,
        etapa,
        estado: config.name,
        bloqueador: config.blocker,
        accion: config.action,
        responsable: config.responsible,
        progress: config.progress
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
        return "ASSEMBLY";
    }

    return "ENGINEERING_REVIEW";

}

function requiereSoportes(ot) {

    const texto = `
        ${ot.description}
        ${ot.customSolution}
        ${ot.components.map(c => `${c.itemCode} ${c.description}`).join(" ")}
    `.toLowerCase();

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

    const fechaSoporte = parseDate(ot.supportDate);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return fechaSoporte && hoy >= fechaSoporte;

}

function calcularPrioridad(fechaTexto) {

    const fecha = parseDate(fechaTexto);

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