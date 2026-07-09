const QUOTES_SHEET_NAME = "Cotizaciones";

const quotesUrl =
    `https://docs.google.com/spreadsheets/d/${PRODUCTION_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${QUOTES_SHEET_NAME}`;

async function loadQuotes() {
    const response = await fetch(quotesUrl);
    const text = await response.text();

    const json = JSON.parse(text.substring(47).slice(0, -2));
    const rows = json.table.rows;

    return importarCotizaciones(rows);
}

function importarCotizaciones(rows) {
    return rows
        .map(row => ({
            fechaSolicitud: row.c[0]?.f || row.c[0]?.v || "",
            psi: row.c[1]?.v || "",
            cliente: row.c[2]?.v || "",
            proyecto: row.c[3]?.v || "",
            comercial: row.c[4]?.v || "",
            owner: row.c[5]?.v || "",
            participantes: row.c[6]?.v || "",
            prioridad: row.c[7]?.v || "Normal",
            estado: row.c[8]?.v || "",
            proximaAccion: row.c[9]?.v || "",
            fechaObjetivo: row.c[10]?.f || row.c[10]?.v || "",
            valorEstimado: row.c[11]?.v || 0,
            probabilidad: row.c[12]?.v || "",
            plano: row.c[13]?.v || "",
            productionOrder: row.c[14]?.v || "",
            fechaEnvio: row.c[15]?.f || row.c[15]?.v || "",
            cierre: row.c[16]?.v || "",
            observaciones: row.c[17]?.v || ""
        }))
        .filter(item => item.psi || item.cliente || item.proyecto);
}