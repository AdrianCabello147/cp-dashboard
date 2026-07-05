function renderProduction(productionData) {

    const kpis = calcularKPIs(productionData);

    actualizarResumenProduccionDesdeKPIs(kpis);

    renderAgenda(productionData);

    renderProductionTable(productionData);

    renderControlCenter(productionData);

}

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

function renderAgenda(data) {

    const agenda = document.getElementById("agendaList");

    const tareas = data
        .flatMap(ot =>
            ot.tasks.map(task => ({
                ...task,
                productionOrder: ot.productionOrder,
                customer: ot.customer,
                customSolution: ot.customSolution,
                prioridad: ot.prioridad,
                etapa: ot.etapa
            }))
        )

        .filter(task =>
            task.prioridad === "Crítica" ||
            task.prioridad === "Alta" ||
            task.etapa === "SUPPORTS"
        )
        .sort((a, b) => obtenerPesoPrioridad(b) - obtenerPesoPrioridad(a))
        .slice(0, 8);

    if (tareas.length === 0) {
        agenda.innerHTML = `
            <div class="sin-resultados">
                No hay actividades críticas para hoy.
            </div>
        `;
        return;
    }

    agenda.innerHTML = tareas.map(task => `
        <article class="agenda-item ${obtenerAgendaClase(task.prioridad)}">

            <div>
                <strong>${task.title}</strong>

                <span>
                    OT ${task.productionOrder}
                    · ${task.customer}
                    · ${task.customSolution}
                </span>

                ${task.dueDate ? `<span>Fecha objetivo: ${task.dueDate}</span>` : ""}
            </div>

            <small>${task.responsible}</small>

        </article>
    `).join("");

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

            <td>${PRODUCTION_STAGES[item.etapa].label}</td>

            <td>${item.dueDate}</td>

            <td>
                ${item.estado}
                ${
                    item.alerts.length > 0
                        ? `<br><small style="color:#d32f2f;">⚠ ${item.alerts.length} alerta(s)</small>`
                        : ""
                }
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

            <td>${item.responsable}</td>

        </tr>

    `).join("");

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