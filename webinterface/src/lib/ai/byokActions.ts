"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { verifyGeminiApiKey } from "@/lib/ai/verifyGeminiKey";
import {
    deleteLlmKey,
    getDecryptedLlmKey,
    getLlmKeyMeta,
    listLlmKeyMeta,
    markLlmKeyInvalid,
    upsertEncryptedLlmKey,
} from "@/lib/db/llmKeys";

async function requireUserId(): Promise<string> {
    const session = await getServerSession(authOptions);
    // @ts-ignore — session.user.id from JWT callback
    const userId = session?.user?.id as string | undefined;
    if (!userId) throw new Error("Unauthorized");
    return userId;
}

/** "use server" modules may only export async functions — types live in byokTypes.ts */
export async function getByokStatus() {
    const userId = await requireUserId();
    const keys = await listLlmKeyMeta(userId);
    return {
        keys,
        hasPlatformFallback: Boolean(process.env.GEMINI_API_KEY?.trim()),
    };
}

export async function getGeminiKeyMeta() {
    const userId = await requireUserId();
    return getLlmKeyMeta(userId, "gemini");
}

/**
 * Verify + encrypt + store. Plaintext never leaves this server action.
 * Never returns or logs the key.
 */
export async function saveGeminiApiKey(apiKey: string) {
    const userId = await requireUserId();
    const trimmed = typeof apiKey === "string" ? apiKey.trim() : "";
    if (!trimmed) {
        return { ok: false as const, error: "API key is required." };
    }

    if (trimmed.length > 256) {
        return { ok: false as const, error: "API key is too long." };
    }

    const verified = await verifyGeminiApiKey(trimmed);
    if (!verified.ok) {
        return { ok: false as const, error: verified.error };
    }

    try {
        const meta = await upsertEncryptedLlmKey(userId, "gemini", trimmed);
        return { ok: true as const, meta };
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to store key";
        return {
            ok: false as const,
            error:
                message.includes("BYOK_MASTER_KEY") || message.includes("KMS")
                    ? message
                    : "Failed to encrypt and store your key. Check server BYOK configuration.",
        };
    }
}

/** Re-verify the stored key by decrypting server-side (no client plaintext). */
export async function reverifyGeminiApiKey() {
    const userId = await requireUserId();

    let stored: { apiKey: string; status: string } | null;
    try {
        stored = await getDecryptedLlmKey(userId, "gemini");
    } catch {
        return {
            ok: false as const,
            error: "Could not decrypt stored key. Check BYOK_MASTER_KEY / KMS.",
        };
    }

    if (!stored) {
        return { ok: false as const, error: "No Gemini key saved." };
    }

    const verified = await verifyGeminiApiKey(stored.apiKey);
    if (!verified.ok) {
        await markLlmKeyInvalid(userId, "gemini");
        const meta = await getLlmKeyMeta(userId, "gemini");
        return { ok: false as const, meta, error: verified.error };
    }

    // Re-encrypt with current KEK (supports KEK rotation) and mark active
    const meta = await upsertEncryptedLlmKey(userId, "gemini", stored.apiKey);
    return { ok: true as const, meta };
}

export async function removeGeminiApiKey() {
    const userId = await requireUserId();
    const removed = await deleteLlmKey(userId, "gemini");
    if (!removed) {
        return { ok: false as const, error: "No Gemini key to remove." };
    }
    return { ok: true as const };
}
