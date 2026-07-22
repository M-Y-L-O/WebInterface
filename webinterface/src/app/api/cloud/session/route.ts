import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createConfig, getConfigInternal, updateConfig } from "@/lib/db/configs";
import { createOrchestratorSession, deleteOrchestratorSession } from "@/lib/cloud/orchestrator";
import { ClientType, CLOUD_PROXY_BASE } from "@/lib/client/ClientTypes";

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    const userId = session?.user?.id as string | undefined;
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Cloud session";
    const configId = typeof body.configId === "string" ? body.configId : undefined;

    try {
        // Tear down previous container if re-provisioning an existing CLOUD config
        if (configId) {
            const existing = await getConfigInternal(userId, configId);
            if (!existing || existing.type !== ClientType.CLOUD) {
                return NextResponse.json({ error: "Cloud config not found" }, { status: 404 });
            }
            if (existing.sessionId) {
                try {
                    await deleteOrchestratorSession(existing.sessionId);
                } catch {
                    // Container may already be gone
                }
            }
        }

        const orch = await createOrchestratorSession();

        try {
            if (configId) {
                await updateConfig(configId, {
                    name,
                    type: ClientType.CLOUD,
                    address: orch.address,
                    apiKey: orch.apiKey,
                    sessionId: orch.sessionId,
                    dbId: configId,
                });

                return NextResponse.json({
                    ok: true,
                    config: {
                        name,
                        type: ClientType.CLOUD,
                        address: CLOUD_PROXY_BASE,
                        apiKey: "",
                        dbId: configId,
                        sessionId: orch.sessionId,
                    },
                });
            }

            const created = await createConfig(userId, {
                name,
                type: ClientType.CLOUD,
                address: orch.address,
                apiKey: orch.apiKey,
                sessionId: orch.sessionId,
            });

            return NextResponse.json({ ok: true, config: created });
        } catch (persistError) {
            // Don't leave an orphaned container if DB write fails
            try {
                await deleteOrchestratorSession(orch.sessionId);
            } catch {
                // ignore
            }
            throw persistError;
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create cloud session";
        console.error("[cloud/session]", error);
        return NextResponse.json({ error: message }, { status: 502 });
    }
}

export async function DELETE(request: NextRequest) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    const userId = session?.user?.id as string | undefined;
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const configId = typeof body.configId === "string" ? body.configId : undefined;
    if (!configId) {
        return NextResponse.json({ error: "configId required" }, { status: 400 });
    }

    const existing = await getConfigInternal(userId, configId);
    if (!existing) {
        return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    if (existing.sessionId) {
        try {
            await deleteOrchestratorSession(existing.sessionId);
        } catch {
            // ignore missing container
        }
    }

    // Clear stale agent binding so a later restart is required explicitly.
    if (existing.type === ClientType.CLOUD) {
        await updateConfig(configId, {
            ...existing,
            address: "",
            apiKey: "",
            sessionId: undefined,
        });
    }

    return NextResponse.json({ ok: true });
}
