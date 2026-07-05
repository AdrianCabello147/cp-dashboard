const PRODUCTION_SHEET_ID = "1JXb_hDVffwIROxcKmDm6hekccwR50MN9TnVZ-fDRzwM";
const PRODUCTION_SHEET_NAME = "OT";

const productionUrl = `https://docs.google.com/spreadsheets/d/${PRODUCTION_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${PRODUCTION_SHEET_NAME}`;

fetch(productionUrl)
    .then(response => response.text())
    .then(text => {
        const json = JSON.parse(text.substring(47).slice(0, -2));
        const rows = json.table.rows;

        const productionData = importarProductionOrders(rows);

        actualizarResumenProduccion(productionData);
        renderAgenda(productionData);
        renderProductionTable(productionData);

        console.log(productionData);
    });

function importarProductionOrders(rows) {
    const productionOrders = {};

    rows.forEach(row => {
        const productionOrder = row.c[2]?.v;

        if (!productionOrder) return;

        if (!productionOrders[productionOrder]) {
            productionOrders[productionOrder] = {
                productionOrder: productionOrder,
                salesOrder: row.c[1]?.v || "",
                creationDate: row.c[3]?.f || row.c[3]?.v || "",
                status: row.c[4]?.v || "",
                dueDate: row.c[7]?.f || row.c[7]?.v || "",
                customer: row.c[8]?.v || "",
                customSolution: row.c[9]?.v || "",
                description: row.c[10]?.v || "",
                tasks: [],
                checklist: {},
                risk: "Normal",
                progress: 0,
                components: []
            };
        }

        productionOrders[productionOrder].components.push({
            itemCode: row.c[15]?.v || "",
            description: row.c[16]?.v || "",
            requiredQty: row.c[17]?.v || 0,
            stock: row.c[20]?.v || 0,
            hasStock: row.c[21]?.v || "",
            picking: row.c[24]?.v || "",
            pickingStatus: row.c[25]?.v || "",
            releasedQty: row.c[26]?.v || 0,
            pickedQty: row.c[27]?.v || 0,
            componentStatus: row.c[28]?.v || ""
        });
    });

    return Object.values(productionOrders).map(ot => {
        const totalComponents = ot.components.length;

        const missingComponents = ot.components.filter(component =>
            component.componentStatus.toLowerCase().includes("sin stock")
        ).length;

        const pickingPending = ot.components.filter(component =>
            component.componentStatus.toLowerCase().includes("pick")
        ).length;

        const readyInWorkshop = ot.components.filter(component =>
            component.componentStatus.toLowerCase().includes("taller")
        ).length;

        const prioridad = calcularPrioridad(ot.dueDate);
        const supportDate = calcularFechaSoportes(ot.dueDate);

        const baseOT = {
            ...ot,
            totalComponents,
            missingComponents,
            pickingPending,
            readyInWorkshop,
            prioridad,
            supportDate
        };

        return evaluarProductionOrder(baseOT);
    });
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

function actualizarResumenProduccion(data) {
    document.getElementById("totalOT").textContent = data.length;

    document.getElementById("otRiesgo").textContent = data.filter(item =>
        item.prioridad === "Crítica" || item.prioridad === "Alta"
    ).length;

    document.getElementById("otListas").textContent = data.filter(item =>
        item.estado === "Lista para ensamblar"
    ).length;

    document.getElementById("accionesHoy").textContent = data.filter(item =>
        item.prioridad === "Crítica" || item.prioridad === "Alta" || item.etapa === "SUPPORTS"
    ).length;
}

function renderAgenda(data) {
    const agenda = document.getElementById("agendaList");

    const actividades = data
        .filter(item =>
            item.prioridad === "Crítica" ||
            item.prioridad === "Alta" ||
            item.etapa === "SUPPORTS"
        )
        .slice(0, 6);

    if (actividades.length === 0) {
        agenda.innerHTML = `
            <div class="sin-resultados">
                No hay actividades críticas para hoy.
            </div>
        `;
        return;
    }

    agenda.innerHTML = actividades.map(item => `
        <article class="agenda-item ${obtenerAgendaClase(item.prioridad)}">
            <div>
                <strong>${item.accion}</strong>
                <span>OT ${item.productionOrder} · ${item.customer} · ${item.customSolution}</span>
                ${item.etapa === "SUPPORTS" ? `<span>Fecha objetivo soporte: ${item.supportDate}</span>` : ""}
            </div>
            <small>${item.responsable}</small>
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
            <td>${item.dueDate}</td>
            <td>${item.estado}</td>
            <td>${item.bloqueador}</td>
            <td>${item.accion}</td>
            <td>${item.responsable}</td>
        </tr>
    `).join("");
}