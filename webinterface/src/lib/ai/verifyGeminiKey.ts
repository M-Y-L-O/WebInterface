import "server-only";

import { GoogleGenAI } from "@google/genai";

const GEMINI_KEY_RE = /^[A-Za-z0-9._-]{20,256}$/;

export function looksLikeGeminiKey(key: string): boolean {
    return GEMINI_KEY_RE.test(key.trim());
}

/**
 * Cheap live check against Gemini. Never logs the key.
 * Returns ok:false with a safe message on failure.
 */
export async function verifyGeminiApiKey(apiKey: string): Promise<{
    ok: boolean;
    error?: string;
}> {
    const trimmed = apiKey.trim();
    if (!trimmed) {
        return { ok: false, error: "API key is empty." };
    }
    if (!looksLikeGeminiKey(trimmed)) {
        return {
            ok: false,
            error: "API key format looks invalid (expected a single token, 20–256 characters).",
        };
    }

    try {
        const ai = new GoogleGenAI({ apiKey: trimmed });
        const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
        await ai.models.generateContent({
            model,
            contents: [{ role: "user", parts: [{ text: "ping" }] }],
            config: {
                maxOutputTokens: 1,
                temperature: 0,
            },
        });
        return { ok: true };
    } catch (e) {
        const message = e instanceof Error ? e.message : "Verification failed";
        // Strip anything that might echo the key back
        const safe = message.replace(trimmed, "[redacted]");
        if (/api.?key|permission|unauth|invalid|403|401/i.test(safe)) {
            return { ok: false, error: "Google rejected this API key." };
        }
        return { ok: false, error: `Could not verify key: ${safe.slice(0, 160)}` };
    }
}
