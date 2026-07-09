async function addQuoteComment(code, user, comment) {
    await addComment({
        module: "quotes",
        code,
        taskId: "",
        user,
        comment
    });

    await addTimelineEvent({
        module: "quotes",
        code,
        user,
        action: "Comentario",
        status: "",
        comment
    });
}

async function addQuoteTimelineEvent(code, user, action, status, comment) {
    await addTimelineEvent({
        module: "quotes",
        code,
        user,
        action,
        status,
        comment
    });
}

async function changeQuoteOwner(code, owner, user) {
    await saveOwner(code, owner);

    await addTimelineEvent({
        module: "quotes",
        code,
        user,
        action: "Cambio de Owner",
        status: owner,
        comment: `Owner cambiado a ${owner}`
    });
}