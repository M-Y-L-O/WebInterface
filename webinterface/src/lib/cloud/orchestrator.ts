import { createHash } from "crypto";
import { CLOUD_DISABLED_ERROR, isCloudEnabled } from "@/lib/cloud/enabled";

export type OrchestratorSession = {
    sessionId: string;
    address: string;
    apiKey: string;
};

function assertCloudEnabled() {
    if (!isCloudEnabled()) {
        throw new Error(CLOUD_DISABLED_ERROR);
    }
}

function orchestratorBase(): string {
    return (process.env.ORCHESTRATOR_URL || "http://127.0.0.1:9000").replace(/\/$/, "");
}

function orchestratorSecret(): string {
    const secret = process.env.ORCHESTRATOR_SECRET?.trim();
    if (!secret || secret === "dev-secret") {
        throw new Error(
            "ORCHESTRATOR_SECRET must be set to a strong non-default value",
        );
    }
    return secret;
}

async function orchFetch(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("X-Orchestrator-Secret", orchestratorSecret());
    if (!headers.has("Content-Type") && init.body) {
        headers.set("Content-Type", "application/json");
    }

    const res = await fetch(`${orchestratorBase()}${path}`, {
        ...init,
        headers,
        cache: "no-store",
        redirect: "manual",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Orchestrator ${path} failed: ${res.status} ${text}`);
    }
    return res;
}

export async function createOrchestratorSession(): Promise<OrchestratorSession> {
    assertCloudEnabled();
    const res = await orchFetch("/session", { method: "POST" });
    return res.json();
}

/** Allowed even when cloud is disabled so existing sessions can be torn down. */
export async function deleteOrchestratorSession(sessionId: string): Promise<void> {
    await orchFetch(`/session/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
}

export async function cleanupOrchestratorOrphans(): Promise<{ removed: string[]; count: number }> {
    assertCloudEnabled();
    const res = await orchFetch("/cleanup", { method: "POST" });
    return res.json();
}

/** Hash helper kept for tests / migrations — agent bearer is sha256(plaintext). */
export function hashOrchestratorApiKey(apiKey: string) {
    return createHash("sha256").update(apiKey).digest("hex");
}
