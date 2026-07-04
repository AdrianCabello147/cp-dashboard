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

        let estado = "En revisión";
        let bloqueador = "Revisión pendiente";
        let accion = "Revisar OT";
        let responsable = "Adrián";

        if (missingComponents > 0) {
            estado = "Esperando materiales";
            bloqueador = "Componentes sin stock";
            accion = "Revisar componentes faltantes";
            responsable = "Compras / CS";
        } else if (pickingPending > 0) {
            estado = "Lista para picking";
            bloqueador = "Picking pendiente";
            accion = "Generar picking";
            responsable = "Julio / Hernán";
        } else if (readyInWorkshop === totalComponents) {
            estado = "Lista para ensamblar";
            bloqueador = "Sin bloqueador";
            accion = "Iniciar ensamblaje";
            responsable = "David / Juan Carlos / Santiago";
        }

        const prioridad = calcularPrioridad(ot.dueDate);

        return {
            ...ot,
            totalComponents,
            missingComponents,
            pickingPending,
            readyInWorkshop,
            estado,
            bloqueador,
            accion,
            responsable,
            prioridad
        };
    });
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
        item.prioridad === "Crítica" || item.prioridad === "Alta"
    ).length;
}

function renderAgenda(data) {
    const agenda = document.getElementById("agendaList");

    const actividades = data
        .filter(item => item.prioridad === "Crítica" || item.prioridad === "Alta")
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