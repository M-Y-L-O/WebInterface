import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/db";
import { userLlmKeys } from "@/db/schemas/userData";
import { decryptSecret, encryptSecret } from "@/lib/crypto/envelope";
import type { KekProvider } from "@/lib/crypto/kek";
import type { LlmKeyMeta, LlmProvider } from "@/lib/ai/byokTypes";

const META_COLUMNS = {
    id: userLlmKeys.id,
    provider: userLlmKeys.provider,
    keyFingerprint: userLlmKeys.keyFingerprint,
    status: userLlmKeys.status,
    verifiedAt: userLlmKeys.verifiedAt,
    createdAt: userLlmKeys.createdAt,
    updatedAt: userLlmKeys.updatedAt,
} as const;

function toMeta(row: {
    id: string;
    provider: string;
    keyFingerprint: string;
    status: string;
    verifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}): LlmKeyMeta {
    return {
        id: row.id,
        provider: row.provider as LlmProvider,
        keyFingerprint: row.keyFingerprint,
        status: row.status === "invalid" ? "invalid" : "active",
        verifiedAt: row.verifiedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/** Metadata only — never selects ciphertext columns. */
export async function getLlmKeyMeta(
    userId: string,
    provider: LlmProvider = "gemini",
): Promise<LlmKeyMeta | null> {
    const rows = await db
        .select(META_COLUMNS)
        .from(userLlmKeys)
        .where(and(eq(userLlmKeys.userId, userId), eq(userLlmKeys.provider, provider)))
        .limit(1);
    if (!rows[0]) return null;
    return toMeta(rows[0]);
}

export async function listLlmKeyMeta(userId: string): Promise<LlmKeyMeta[]> {
    const rows = await db
        .select(META_COLUMNS)
        .from(userLlmKeys)
        .where(eq(userLlmKeys.userId, userId));
    return rows.map(toMeta);
}

/**
 * Decrypts the user's key for server-side Gemini calls only.
 * Caller must never log or return the plaintext.
 */
export async function getDecryptedLlmKey(
    userId: string,
    provider: LlmProvider = "gemini",
): Promise<{ apiKey: string; status: string } | null> {
    const rows = await db
        .select({
            ciphertext: userLlmKeys.ciphertext,
            iv: userLlmKeys.iv,
            authTag: userLlmKeys.authTag,
            wrappedDek: userLlmKeys.wrappedDek,
            kekProvider: userLlmKeys.kekProvider,
            status: userLlmKeys.status,
        })
        .from(userLlmKeys)
        .where(and(eq(userLlmKeys.userId, userId), eq(userLlmKeys.provider, provider)))
        .limit(1);

    const row = rows[0];
    if (!row) return null;

    const apiKey = await decryptSecret({
        ciphertext: row.ciphertext,
        iv: row.iv,
        authTag: row.authTag,
        wrappedDek: row.wrappedDek,
        kekProvider: row.kekProvider as KekProvider,
    });

    return { apiKey, status: row.status };
}

export async function upsertEncryptedLlmKey(
    userId: string,
    provider: LlmProvider,
    plaintext: string,
): Promise<LlmKeyMeta> {
    const encrypted = await encryptSecret(plaintext);
    const now = new Date();

    const existing = await db
        .select({ id: userLlmKeys.id })
        .from(userLlmKeys)
        .where(and(eq(userLlmKeys.userId, userId), eq(userLlmKeys.provider, provider)))
        .limit(1);

    if (existing[0]) {
        const updated = await db
            .update(userLlmKeys)
            .set({
                ciphertext: encrypted.ciphertext,
                iv: encrypted.iv,
                authTag: encrypted.authTag,
                wrappedDek: encrypted.wrappedDek,
                kekProvider: encrypted.kekProvider,
                keyFingerprint: encrypted.keyFingerprint,
                status: "active",
                verifiedAt: now,
                updatedAt: now,
            })
            .where(eq(userLlmKeys.id, existing[0].id))
            .returning(META_COLUMNS);
        return toMeta(updated[0]);
    }

    const inserted = await db
        .insert(userLlmKeys)
        .values({
            userId,
            provider,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            wrappedDek: encrypted.wrappedDek,
            kekProvider: encrypted.kekProvider,
            keyFingerprint: encrypted.keyFingerprint,
            status: "active",
            verifiedAt: now,
            createdAt: now,
            updatedAt: now,
        })
        .returning(META_COLUMNS);

    return toMeta(inserted[0]);
}

export async function markLlmKeyInvalid(
    userId: string,
    provider: LlmProvider = "gemini",
): Promise<void> {
    await db
        .update(userLlmKeys)
        .set({ status: "invalid", updatedAt: new Date() })
        .where(and(eq(userLlmKeys.userId, userId), eq(userLlmKeys.provider, provider)));
}

export async function deleteLlmKey(
    userId: string,
    provider: LlmProvider = "gemini",
): Promise<boolean> {
    const deleted = await db
        .delete(userLlmKeys)
        .where(and(eq(userLlmKeys.userId, userId), eq(userLlmKeys.provider, provider)))
        .returning({ id: userLlmKeys.id });
    return deleted.length > 0;
}
