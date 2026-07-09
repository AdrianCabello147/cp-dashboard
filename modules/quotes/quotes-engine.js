function processQuotes(quotes) {
    return quotes
        .map(quote => ({
            ...quote,
            diasObjetivo: daysBetweenToday(quote.fechaObjetivo),
            vencida: isOverdue(quote.fechaObjetivo),
            abierta: !["Ganada", "Perdida", "Cancelada"].includes(quote.cierre)
        }))
        .sort((a, b) => getQuotePriorityWeight(b) - getQuotePriorityWeight(a));
}

function getQuotePriorityWeight(quote) {
    let weight = 0;

    if (quote.prioridad === "Crítica") weight += 100;
    if (quote.prioridad === "Alta") weight += 70;
    if (quote.prioridad === "Media") weight += 40;
    if (quote.prioridad === "Normal") weight += 10;

    if (quote.vencida) weight += 50;

    if (quote.estado === "Lista para enviar") weight += 25;
    if (quote.estado === "Esperando proveedor") weight += 15;
    if (quote.estado === "Esperando datos cliente") weight += 10;

    return weight;
}

function calculateQuoteKPIs(quotes) {
    return {
        abiertas: quotes.filter(q => q.abierta).length,
        criticas: quotes.filter(q => q.prioridad === "Crítica").length,
        esperandoProveedor: quotes.filter(q => q.estado === "Esperando proveedor").length,
        esperandoCliente: quotes.filter(q => q.estado === "Esperando datos cliente").length,
        listasParaEnviar: quotes.filter(q => q.estado === "Lista para enviar").length
    };
}