import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { KMSClient, EncryptCommand, DecryptCommand } from "@aws-sdk/client-kms";

export type KekProvider = "local" | "kms";

let kmsClient: KMSClient | null = null;

function getKmsClient(): KMSClient {
    if (!kmsClient) {
        kmsClient = new KMSClient({});
    }
    return kmsClient;
}

function parseMasterKey(raw: string): Buffer {
    const trimmed = raw.trim();
    // Prefer hex (64 chars = 32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
        return Buffer.from(trimmed, "hex");
    }
    // Or base64 that decodes to 32 bytes
    try {
        const buf = Buffer.from(trimmed, "base64");
        if (buf.length === 32) return buf;
    } catch {
        /* fall through */
    }
    throw new Error(
        "BYOK_MASTER_KEY must be a 32-byte key as 64-char hex or base64. Generate with: openssl rand -hex 32",
    );
}

function getLocalMasterKey(): Buffer {
    const raw = process.env.BYOK_MASTER_KEY;
    if (!raw?.trim()) {
        throw new Error(
            "BYOK_MASTER_KEY is not configured. Add a 32-byte hex key to .env.local.",
        );
    }
    return parseMasterKey(raw);
}

/** Local AES-256-GCM wrap of a DEK. */
function wrapLocal(dek: Buffer): Buffer {
    const master = getLocalMasterKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", master, iv);
    const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    // layout: iv(12) | tag(16) | ciphertext
    return Buffer.concat([iv, tag, encrypted]);
}

function unwrapLocal(wrapped: Buffer): Buffer {
    const master = getLocalMasterKey();
    if (wrapped.length < 12 + 16 + 1) {
        throw new Error("Invalid wrapped DEK blob");
    }
    const iv = wrapped.subarray(0, 12);
    const tag = wrapped.subarray(12, 28);
    const ciphertext = wrapped.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", master, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function wrapKms(dek: Buffer): Promise<Buffer> {
    const keyId = process.env.BYOK_KMS_KEY_ID?.trim();
    if (!keyId) {
        throw new Error("BYOK_KMS_KEY_ID is required when using KMS wrapping");
    }
    const result = await getKmsClient().send(
        new EncryptCommand({ KeyId: keyId, Plaintext: dek }),
    );
    if (!result.CiphertextBlob) {
        throw new Error("KMS Encrypt returned empty ciphertext");
    }
    return Buffer.from(result.CiphertextBlob);
}

async function unwrapKms(wrapped: Buffer): Promise<Buffer> {
    const result = await getKmsClient().send(
        new DecryptCommand({ CiphertextBlob: wrapped }),
    );
    if (!result.Plaintext) {
        throw new Error("KMS Decrypt returned empty plaintext");
    }
    return Buffer.from(result.Plaintext);
}

/** Active KEK provider: KMS when BYOK_KMS_KEY_ID is set, otherwise local master key. */
export function getActiveKekProvider(): KekProvider {
    return process.env.BYOK_KMS_KEY_ID?.trim() ? "kms" : "local";
}

export async function wrapDek(dek: Buffer, provider?: KekProvider): Promise<{
    wrappedDek: Buffer;
    provider: KekProvider;
}> {
    const active = provider ?? getActiveKekProvider();
    if (active === "kms") {
        return { wrappedDek: await wrapKms(dek), provider: "kms" };
    }
    return { wrappedDek: wrapLocal(dek), provider: "local" };
}

export async function unwrapDek(
    wrappedDek: Buffer,
    provider: KekProvider,
): Promise<Buffer> {
    if (provider === "kms") {
        return unwrapKms(wrappedDek);
    }
    return unwrapLocal(wrappedDek);
}
