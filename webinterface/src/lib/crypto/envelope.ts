import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { type KekProvider, unwrapDek, wrapDek } from "@/lib/crypto/kek";

export type EncryptedSecret = {
    ciphertext: string; // base64
    iv: string; // base64
    authTag: string; // base64
    wrappedDek: string; // base64
    kekProvider: KekProvider;
    keyFingerprint: string;
};

/** Non-reversible short fingerprint for UI (first 4 hex of sha256). */
export function fingerprintKey(plaintext: string): string {
    return hashKey(plaintext).slice(0, 4);
}

/** SHA-256 hash used only for change detection — never as a substitute for encryption. */
export function hashKey(plaintext: string): string {
    return createHash("sha256").update(plaintext.trim(), "utf8").digest("hex");
}

/**
 * Envelope-encrypt a secret:
 * 1. Random DEK encrypts the plaintext (AES-256-GCM)
 * 2. KEK (local master key or AWS KMS) wraps the DEK
 */
export async function encryptSecret(plaintext: string): Promise<EncryptedSecret> {
    const dek = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", dek, iv);
    const encrypted = Buffer.concat([
        cipher.update(plaintext.trim(), "utf8"),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    const { wrappedDek, provider } = await wrapDek(dek);

    // Zero DEK as best-effort (Node Buffer; GC may retain copies)
    dek.fill(0);

    return {
        ciphertext: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
        wrappedDek: wrappedDek.toString("base64"),
        kekProvider: provider,
        keyFingerprint: fingerprintKey(plaintext),
    };
}

export async function decryptSecret(blob: {
    ciphertext: string;
    iv: string;
    authTag: string;
    wrappedDek: string;
    kekProvider: KekProvider;
}): Promise<string> {
    const dek = await unwrapDek(
        Buffer.from(blob.wrappedDek, "base64"),
        blob.kekProvider,
    );
    try {
        const decipher = createDecipheriv(
            "aes-256-gcm",
            dek,
            Buffer.from(blob.iv, "base64"),
        );
        decipher.setAuthTag(Buffer.from(blob.authTag, "base64"));
        const plaintext = Buffer.concat([
            decipher.update(Buffer.from(blob.ciphertext, "base64")),
            decipher.final(),
        ]);
        return plaintext.toString("utf8");
    } finally {
        dek.fill(0);
    }
}
