function formatTimelineEvent(event) {
    return {
        fecha: event.createdAt || "",
        module: event.module || "",
        code: event.code || "",
        user: event.user || "",
        action: event.action || "",
        status: event.status || "",
        comment: event.comment || ""
    };
}

function groupTimelineByCode(events) {
    const grouped = {};

    events.forEach(event => {
        const code = event.code || "SIN_CODIGO";

        if (!grouped[code]) {
            grouped[code] = [];
        }

        grouped[code].push(formatTimelineEvent(event));
    });

    return grouped;
}

function renderTimeline(events, containerId) {
    const container = document.getElementById(containerId);

    if (!container) return;

    if (!events || events.length === 0) {
        container.innerHTML = `
            <div class="sin-resultados">
                Sin historial registrado.
            </div>
        `;
        return;
    }

    container.innerHTML = events.map(event => `
        <div class="timeline-event">
            <strong>${event.action}</strong>
            <p>${event.comment || ""}</p>
            <small>${event.user || ""} · ${event.status || ""}</small>
        </div>
    `).join("");
}