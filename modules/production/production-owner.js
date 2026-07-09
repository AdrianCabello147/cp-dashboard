function getOwner(ot) {
    return ot.owner || "Sin asignar";
}

function setOwnerLocal(ot, owner) {
    return {
        ...ot,
        owner
    };
}

function getParticipants(ot) {
    if (!ot.participants) return [];

    if (Array.isArray(ot.participants)) return ot.participants;

    return ot.participants
        .split(";")
        .map(item => item.trim())
        .filter(Boolean);
}

function addParticipantLocal(ot, participant) {
    const participants = getParticipants(ot);

    if (!participants.includes(participant)) {
        participants.push(participant);
    }

    return {
        ...ot,
        participants
    };
}

function removeParticipantLocal(ot, participant) {
    return {
        ...ot,
        participants: getParticipants(ot).filter(item => item !== participant)
    };
}