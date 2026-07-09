function renderQuotesModule(quotes) {
    const processedQuotes = processQuotes(quotes);
    const kpis = calculateQuoteKPIs(processedQuotes);

    renderQuoteKPIs(kpis);
    renderQuotesTable(processedQuotes);
}

function renderQuoteKPIs(kpis) {
    const totalOT = document.getElementById("totalOT");
    const accionesHoy = document.getElementById("accionesHoy");
    const otRiesgo = document.getElementById("otRiesgo");
    const otListas = document.getElementById("otListas");

    if (!totalOT || !accionesHoy || !otRiesgo || !otListas) return;

    totalOT.textContent = kpis.abiertas;
    accionesHoy.textContent = kpis.listasParaEnviar;
    otRiesgo.textContent = kpis.criticas;
    otListas.textContent = kpis.esperandoProveedor;
}

function renderQuotesTable(quotes) {
    const tbody = document.getElementById("quotesTableBody");

    if (!tbody) return;

    tbody.innerHTML = quotes.map(quote => `
        <tr>
            <td>${quote.psi}</td>
            <td>${quote.cliente}</td>
            <td>${quote.estado}</td>
            <td>${quote.proximaAccion}</td>
            <td>${quote.owner}</td>
            <td>${quote.fechaObjetivo}</td>
        </tr>
    `).join("");
}