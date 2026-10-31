import "server-only";

import { createHash } from "crypto";
import { GoogleGenAI } from "@google/genai";
import {
    envAllowedModelIds,
    getDefaultModelId,
    isModelAllowed,
} from "@/lib/ai/modelAllow";

export type GeminiModelInfo = {
    id: string;
    displayName?: string;
};

export { getDefaultModelId, envAllowedModelIds, isModelAllowed };

const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { expiresAt: number; models: GeminiModelInfo[] }>();

/** Hardcoded fallback when the provider list call fails. */
export const FALLBACK_GEMINI_MODELS: GeminiModelInfo[] = [
    { id: "gemini-2.5-flash" },
    { id: "gemini-2.0-flash" },
    { id: "gemini-2.5-pro" },
    { id: "gemini-1.5-flash" },
    { id: "gemini-1.5-pro" },
];

function normalizeModelId(name: string | undefined): string | null {
    if (!name) return null;
    const id = name.replace(/^models\//, "").trim();
    return id || null;
}

function cacheKey(apiKey: string): string {
    return createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
}

/**
 * List Gemini models that support generateContent for the given API key.
 * Results are cached briefly per key. Falls back to a static list on failure.
 */
export async function listGeminiModels(apiKey: string): Promise<{
    models: GeminiModelInfo[];
    source: "provider" | "fallback";
}> {
    const key = cacheKey(apiKey);
    const hit = cache.get(key);
    if (hit && Date.now() < hit.expiresAt) {
        return { models: hit.models, source: "provider" };
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const pager = await ai.models.list({ config: { queryBase: true } });
        const allow = envAllowedModelIds();
        const seen = new Set<string>();
        const models: GeminiModelInfo[] = [];

        for await (const model of pager) {
            if (!model.supportedActions?.includes("generateContent")) continue;
            const id = normalizeModelId(model.name);
            if (!id || seen.has(id)) continue;
            if (allow && !allow.has(id)) continue;
            seen.add(id);
            models.push({
                id,
                displayName: model.displayName || undefined,
            });
        }

        models.sort((a, b) => a.id.localeCompare(b.id));

        if (!models.length) {
            return { models: applyAllowlist(FALLBACK_GEMINI_MODELS), source: "fallback" };
        }

        const defaultId = getDefaultModelId();
        if (!seen.has(defaultId) && (!allow || allow.has(defaultId))) {
            models.unshift({ id: defaultId });
        }

        cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, models });
        return { models, source: "provider" };
    } catch {
        return { models: applyAllowlist(FALLBACK_GEMINI_MODELS), source: "fallback" };
    }
}

function applyAllowlist(models: GeminiModelInfo[]): GeminiModelInfo[] {
    const allow = envAllowedModelIds();
    const defaultId = getDefaultModelId();
    let next = allow ? models.filter((m) => allow.has(m.id)) : [...models];
    if (!next.some((m) => m.id === defaultId)) {
        next = [{ id: defaultId }, ...next];
    }
    return next.length ? next : [{ id: defaultId }];
}
