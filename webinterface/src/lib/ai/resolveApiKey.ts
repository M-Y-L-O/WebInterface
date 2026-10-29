import "server-only";

import {
    getDecryptedLlmKey,
    markLlmKeyInvalid,
} from "@/lib/db/llmKeys";

export type ResolvedGeminiKey = {
    apiKey: string;
    source: "user" | "platform";
};

/**
 * Prefer the user's encrypted BYOK key; fall back to platform GEMINI_API_KEY.
 * Never logs the key.
 */
export async function resolveGeminiApiKey(userId: string): Promise<
    | { ok: true; resolved: ResolvedGeminiKey }
    | { ok: false; error: string; code: "NO_KEY" | "INVALID_KEY" | "DECRYPT_FAILED" }
> {
    try {
        const userKey = await getDecryptedLlmKey(userId, "gemini");
        if (userKey) {
            if (userKey.status === "invalid") {
                const platform = process.env.GEMINI_API_KEY?.trim();
                if (platform) {
                    return { ok: true, resolved: { apiKey: platform, source: "platform" } };
                }
                return {
                    ok: false,
                    code: "INVALID_KEY",
                    error:
                        "Your Gemini API key was marked invalid. Go to Settings to rotate it.",
                };
            }
            return { ok: true, resolved: { apiKey: userKey.apiKey, source: "user" } };
        }
    } catch {
        return {
            ok: false,
            code: "DECRYPT_FAILED",
            error:
                "Could not decrypt your stored API key. Please re-enter it in Settings.",
        };
    }

    const platform = process.env.GEMINI_API_KEY?.trim();
    if (platform) {
        return { ok: true, resolved: { apiKey: platform, source: "platform" } };
    }

    return {
        ok: false,
        code: "NO_KEY",
        error:
            "No Gemini API key configured. Add your own key in Settings",
    };
}

export async function handleGeminiAuthFailure(userId: string, source: "user" | "platform") {
    if (source === "user") {
        await markLlmKeyInvalid(userId, "gemini");
    }
}
