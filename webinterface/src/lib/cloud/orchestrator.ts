export type OrchestratorSession = {
    sessionId: string;
    address: string;
    apiKey: string;
};

function orchestratorBase(): string {
    return (process.env.ORCHESTRATOR_URL || "http://127.0.0.1:9000").replace(/\/$/, "");
}

function orchestratorSecret(): string {
    return process.env.ORCHESTRATOR_SECRET || "dev-secret";
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
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Orchestrator ${path} failed: ${res.status} ${text}`);
    }
    return res;
}

export async function createOrchestratorSession(): Promise<OrchestratorSession> {
    const res = await orchFetch("/session", { method: "POST" });
    return res.json();
}

export async function deleteOrchestratorSession(sessionId: string): Promise<void> {
    // Orchestrator DELETE is idempotent: removes by store entry or by container name.
    await orchFetch(`/session/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
}

export async function cleanupOrchestratorOrphans(): Promise<{ removed: string[]; count: number }> {
    const res = await orchFetch("/cleanup", { method: "POST" });
    return res.json();
}
