async function createProductionTimelineEvent(data) {
    return await addTimelineEvent({
        module: "production",
        ...data
    });
}

async function getProductionTimeline(code) {
    return await getTimeline(code);
}

function buildProductionTimelinePayload({ code, user, action, status, comment }) {
    return {
        code,
        user,
        action,
        status,
        comment
    };
}