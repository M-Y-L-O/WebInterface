/**
 * Normalize flaky LLM edit payloads into the shapes the MYLO agent expects.
 * Common mistakes: `id` instead of `nodeId`, `from`/`to` instead of `source`/`target`.
 */
export function normalizeEditPayload(
    operation: string,
    payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
    const op = String(operation || "");
    const p: Record<string, unknown> = { ...(payload || {}) };

    if (
        op === "add_node" ||
        op === "remove_node" ||
        op === "update_node" ||
        op === "set_params"
    ) {
        if (p.nodeId == null && p.id != null) {
            p.nodeId = p.id;
            delete p.id;
        }
        if (typeof p.nodeId === "number") p.nodeId = String(p.nodeId);
    }

    if (op === "add_node") {
        if (p.type == null && p.op != null) p.type = p.op;
        if (p.type == null && p.kind != null) p.type = p.kind;
        // Default empty params object — agent often requires it
        if (p.params == null) p.params = {};
    }

    if (op === "add_edge" || op === "remove_edge") {
        if (p.source == null && p.from != null) p.source = p.from;
        if (p.target == null && p.to != null) p.target = p.to;
        if (p.source == null && p.sourceId != null) p.source = p.sourceId;
        if (p.target == null && p.targetId != null) p.target = p.targetId;
        delete p.from;
        delete p.to;
        delete p.sourceId;
        delete p.targetId;
    }

    return p;
}
