function actualizarResumenProduccionDesdeKPIs(kpis) {
    document.getElementById("totalOT").textContent = kpis.totalOT;
    document.getElementById("accionesHoy").textContent = kpis.enRiesgo;
    document.getElementById("otRiesgo").textContent = kpis.enRiesgo;
    document.getElementById("otListas").textContent = kpis.listasParaEnsamblar;
}

function obtenerBadge(prioridad) {
    if (prioridad === "Crítica") return "danger";
    if (prioridad === "Alta") return "warning";
    if (prioridad === "Media") return "warning";
    return "success";
}

function obtenerAgendaClase(prioridad) {
    if (prioridad === "Crítica") return "critical";
    if (prioridad === "Alta") return "high";
    if (prioridad === "Media") return "medium";
    return "";
}

function obtenerNombreEtapa(etapa) {
    return PRODUCTION_STAGES[etapa]?.name || etapa || "Sin etapa";
}

function renderControlCenter(data) {
    const container = document.getElementById("controlCenterContent");

    const criticas = data.filter(ot => ot.prioridad === "Crítica").length;
    const altas = data.filter(ot => ot.prioridad === "Alta").length;
    const bloqueadas = data.filter(ot => ot.alerts.length > 0).length;

    const agendaPorResponsable = agruparTareasPorResponsable(data);

    const cargaEquipo = Object.entries(agendaPorResponsable)
        .map(([responsable, tareas]) => `
            <li>${responsable}: <strong>${tareas.length}</strong></li>
        `)
        .join("");

    const accionesRecomendadas = data
        .filter(ot => ot.alerts.length > 0 || ot.prioridad === "Crítica")
        .slice(0, 4)
        .map(ot => `
            <li>
                <strong>OT ${ot.productionOrder}</strong> · ${ot.accion}
            </li>
        `)
        .join("");

    container.innerHTML = `
        <article class="control-card">
            <h4>🚨 Estado General</h4>
            <ul>
                <li>OT críticas: <strong>${criticas}</strong></li>
                <li>OT alta prioridad: <strong>${altas}</strong></li>
                <li>OT con alertas: <strong>${bloqueadas}</strong></li>
            </ul>
        </article>

        <article class="control-card">
            <h4>👥 Carga del equipo</h4>
            <ul>
                ${cargaEquipo || "<li>Sin tareas asignadas</li>"}
            </ul>
        </article>

        <article class="control-card">
            <h4>🎯 Acciones recomendadas</h4>
            <ul>
                ${accionesRecomendadas || "<li>Sin acciones críticas</li>"}
            </ul>
        </article>
    `;
}

function renderAgenda(data) {
    const agenda = document.getElementById("agendaList");

    const ensamble = data.filter(ot => ot.etapa === "ASSEMBLY");
    const picking = data.filter(ot => ot.etapa === "PICKING");
    const materiales = data.filter(ot => ot.etapa === "WAITING_MATERIALS");
    const soportes = data.filter(ot => ot.etapa === "SUPPORTS");
    const documentacion = data.filter(ot => ot.etapa === "DOCUMENTATION");

    agenda.innerHTML = `
        ${renderWorkCategory("🔧 Ensamble", ensamble)}
        ${renderWorkCategory("📦 Picking / Preensambles", picking)}
        ${renderWorkCategory("🚚 Materiales por llegar", materiales, true)}
        ${renderWorkCategory("🛠 Soportes", soportes)}
        ${renderWorkCategory("📄 Documentación", documentacion)}
        ${renderQuotesPlaceholder()}
    `;
}

function renderWorkCategory(title, items, showMaterialDate = false) {
    if (!items || items.length === 0) {
        return `
            <article class="agenda-item">
                <div>
                    <strong>${title}</strong>
                    <span>Sin tareas disponibles</span>
                </div>
            </article>
        `;
    }

    return `
        <article class="agenda-item">
            <div>
                <strong>${title} (${items.length})</strong>

                ${items.slice(0, 6).map(ot => `
                    <span>
                        OT ${ot.productionOrder}
                        · ${ot.customer}
                        · ${ot.customSolution}
                        ${showMaterialDate && ot.latestMaterialDate ? `· Llegada: ${ot.latestMaterialDate}` : ""}
                    </span>
                `).join("")}
            </div>
        </article>
    `;
}

function renderQuotesPlaceholder() {
    return `
        <article class="agenda-item">
            <div>
                <strong>💰 Cotizaciones</strong>
                <span>Integración pendiente en Beta</span>
            </div>
        </article>
    `;
}

function renderProductionTable(data) {
    const tbody = document.getElementById("productionTableBody");

    tbody.innerHTML = data.map(item => `
        <tr>
            <td>
                <span class="badge ${obtenerBadge(item.prioridad)}">
                    ${item.prioridad}
                </span>
            </td>

            <td>${item.productionOrder}</td>
            <td>${item.customer}</td>
            <td>${item.customSolution}</td>
            <td>${obtenerNombreEtapa(item.etapa)}</td>
            <td>${item.dueDate}</td>

            <td>
                ${item.estado}
                ${
                    item.alerts.length > 0
                        ? `<br><small style="color:#d32f2f;">⚠ ${item.alerts.length} alerta(s)</small>`
                        : ""
                }
                ${renderMaterialInfo(item)}
            </td>

            <td>
                ${item.bloqueador || "—"}
                <br>
                <small>${item.progress}% avance</small>
            </td>

            <td>
                <strong>${item.tasks[0]?.title || item.accion}</strong>
                <br>
                <small>${item.tasks[0]?.responsible || item.responsable}</small>
            </td>

            <td>${item.owner || item.responsable || "Sin asignar"}</td>
        </tr>
    `).join("");
}

function renderMaterialInfo(item) {
    if (item.etapa !== "WAITING_MATERIALS") return "";

    const componente = item.mainMissingComponent;

    return `
        <br>
        <small>
            Material faltante:
            ${componente ? componente.itemCode : "Por revisar"}
        </small>
        <br>
        <small>
            Llegada más lejana:
            ${item.latestMaterialDate || "Sin fecha"}
        </small>
    `;
}