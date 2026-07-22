"use client";

import type { ClientConfig } from "@/lib/client/ClientTypes";

export type CloudSessionResult =
    | { ok: true; config: ClientConfig }
    | { ok: false; error: string };

/** Create a new cloud session, or restart an existing CLOUD config (configId). */
export async function provisionCloudSession(args: {
    name?: string;
    configId?: string;
}): Promise<CloudSessionResult> {
    try {
        const res = await fetch("/api/cloud/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: args.name,
                configId: args.configId,
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.config) {
            return { ok: false, error: data.error || res.statusText || "Provisioning failed" };
        }
        return { ok: true, config: data.config as ClientConfig };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "Provisioning failed",
        };
    }
}

export async function teardownCloudSession(configId: string): Promise<void> {
    try {
        await fetch("/api/cloud/session", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ configId }),
        });
    } catch {
        // best-effort
    }
}
