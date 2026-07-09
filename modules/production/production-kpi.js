function calcularKPIs(productionData) {
    return {
        totalOT: productionData.length,

        enRiesgo: productionData.filter(ot =>
            ot.prioridad === "Crítica" ||
            ot.prioridad === "Alta" ||
            ot.alerts.length > 0
        ).length,

        atrasadas: productionData.filter(ot =>
            ot.prioridad === "Crítica"
        ).length,

        listasParaEnsamblar: productionData.filter(ot =>
            ot.etapa === "ASSEMBLY"
        ).length,

        esperandoMateriales: productionData.filter(ot =>
            ot.etapa === "WAITING_MATERIALS"
        ).length,

        esperandoPicking: productionData.filter(ot =>
            ot.etapa === "PICKING"
        ).length
    };
}