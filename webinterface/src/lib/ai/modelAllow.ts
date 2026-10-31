/** Pure model-id helpers (safe for client + tests). */

export function getDefaultModelId(): string {
    return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

/** Optional env allowlist. Empty = no restriction beyond what Google returns. */
export function envAllowedModelIds(): Set<string> | null {
    const fromEnv = process.env.GEMINI_ALLOWED_MODELS?.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (!fromEnv?.length) return null;
    return new Set(fromEnv);
}

/**
 * Whether a requested model id may be used for chat.
 * When GEMINI_ALLOWED_MODELS is set, only those ids pass.
 * Otherwise any non-empty id is accepted (provider rejects unknowns).
 */
export function isModelAllowed(requested: string | undefined): string | null {
    const fallback = getDefaultModelId();
    const model = requested?.trim() || fallback;
    if (!model || model.length > 128 || !/^[\w./-]+$/.test(model)) return null;
    const allow = envAllowedModelIds();
    if (allow && !allow.has(model)) return null;
    return model;
}
