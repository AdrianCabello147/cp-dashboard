function parseDate(fechaTexto) {
    if (!fechaTexto) return null;

    const partes = fechaTexto.toString().split("/");

    if (partes.length !== 3) return null;

    const dia = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;
    let anio = parseInt(partes[2], 10);

    if (anio < 100) anio += 2000;

    return new Date(anio, mes, dia);
}

function formatDate(fecha) {
    if (!fecha) return "";

    return fecha.toLocaleDateString("es-CL");
}

function addDays(fechaTexto, dias) {
    const fecha = parseDate(fechaTexto);

    if (!fecha) return "";

    fecha.setDate(fecha.getDate() + dias);

    return formatDate(fecha);
}

function daysBetweenToday(fechaTexto) {
    const fecha = parseDate(fechaTexto);

    if (!fecha) return null;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
}

function isOverdue(fechaTexto) {
    const dias = daysBetweenToday(fechaTexto);

    return dias !== null && dias < 0;
}

function normalizeText(texto) {
    return (texto || "").toString().trim().toLowerCase();
}

function formatCurrency(value) {
    if (!value) return "$0";

    return Number(value).toLocaleString("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0
    });
}