function getMissingComponents(ot) {
    return ot.components.filter(component =>
        normalizeText(component.componentStatus).includes("sin stock")
    );
}

function getLatestMaterialDate(ot) {
    const missing = getMissingComponents(ot);

    const dates = missing
        .map(component =>
            component.arrivalDate ||
            component.deliveryDate ||
            component.expectedDate ||
            component.componentDate ||
            ""
        )
        .filter(Boolean)
        .map(date => parseDate(date))
        .filter(Boolean)
        .sort((a, b) => b - a);

    return dates.length ? formatDate(dates[0]) : "";
}

function getMainMissingComponent(ot) {
    const missing = getMissingComponents(ot);

    if (missing.length === 0) return null;

    return missing[0];
}

function hasMissingMaterials(ot) {
    return getMissingComponents(ot).length > 0;
}