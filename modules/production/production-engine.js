function procesarProductionOrders(productionData) {

    return productionData
        .map(ot => {

            const processedOT = evaluarProductionOrder(ot);

            processedOT.tasks = generarTareas(processedOT);
            processedOT.alerts = generarAlertas(processedOT);
            processedOT.checklist = generarChecklist(processedOT);

            return processedOT;

        })
        .sort((a, b) => obtenerPesoPrioridad(b) - obtenerPesoPrioridad(a));

}

function obtenerPesoPrioridad(ot) {

    let peso = 0;

    if (ot.prioridad === "Crítica") peso += 100;
    if (ot.prioridad === "Alta") peso += 70;
    if (ot.prioridad === "Media") peso += 40;
    if (ot.prioridad === "Normal") peso += 10;

    if (ot.alerts?.length > 0) peso += ot.alerts.length * 10;

    if (ot.etapa === "SUPPORTS") peso += 20;
    if (ot.etapa === "WAITING_MATERIALS") peso += 15;
    if (ot.etapa === "PICKING") peso += 10;
    if (ot.etapa === "ASSEMBLY") peso += 25;
    if (ot.etapa === "DOCUMENTATION") peso += 5;

    return peso;

}

function renderProduction(productionData) {

    const kpis = calcularKPIs(productionData);

    actualizarResumenProduccionDesdeKPIs(kpis);
    renderControlCenter(productionData);
    renderAgenda(productionData);
    renderProductionTable(productionData);

}