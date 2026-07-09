async function createProductionComment(data) {
    return await addComment({
        module: "production",
        ...data
    });
}

async function getProductionComments(taskId) {
    return await getComments(taskId);
}

function buildCommentPayload({ code, taskId, user, comment }) {
    return {
        code,
        taskId,
        user,
        comment
    };
}