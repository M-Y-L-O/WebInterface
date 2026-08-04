'use server'

import { createHash } from "crypto";
import { getServerSession } from "next-auth";
import { clientConfigs } from "@/db/schemas/userData";
import { db } from "@/db/db";
import { and, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth-options";
import { ClientConfig, ClientType, CLOUD_PROXY_BASE } from "@/lib/client/ClientTypes";

export type ClientConfigDB = typeof clientConfigs.$inferSelect;

async function requireSessionUserId(): Promise<string> {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    const userId = session?.user?.id as string | undefined;
    if (!userId) {
        throw new Error("Unauthorized");
    }
    return userId;
}

function hashAgentKey(apiKey: string) {
    return createHash("sha256").update(apiKey).digest("hex");
}

function DBToInternal(config: ClientConfigDB): ClientConfig {
    const type: ClientType = config.type.trim() === "LOCAL" ? ClientType.LOCAL : ClientType.CLOUD;
    return {
        name: config.name,
        type,
        address: config.address,
        apiKey: config.apiKey,
        dbId: config.id,
        sessionId: config.sessionId ?? undefined,
    };
}

/** Client-safe view: CLOUD never exposes address/apiKey; LOCAL keeps key for agent auth. */
function DBToType(config: ClientConfigDB): ClientConfig {
    const internal = DBToInternal(config);
    if (internal.type === ClientType.CLOUD) {
        return {
            ...internal,
            address: CLOUD_PROXY_BASE,
            apiKey: "",
        };
    }
    return internal;
}

function assertLocalAddress(address: string) {
    let url: URL;
    try {
        url = new URL(address);
    } catch {
        throw new Error("Invalid agent address");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Agent address must be http or https");
    }
    const host = url.hostname.toLowerCase();
    if (host !== "127.0.0.1" && host !== "localhost") {
        throw new Error("LOCAL agent address must be localhost or 127.0.0.1");
    }
}

/** Owned row or null — never trust client userId. */
export async function getConfigInternal(userId: string, configId: string): Promise<ClientConfig | null> {
    const rows = await db.select().from(clientConfigs).where(
        and(eq(clientConfigs.id, configId), eq(clientConfigs.userId, userId)),
    );
    if (!rows[0]) return null;
    return DBToInternal(rows[0]);
}

export async function getConfigs(): Promise<ClientConfig[]> {
    const userId = await requireSessionUserId();
    const configs = await db.select().from(clientConfigs).where(eq(clientConfigs.userId, userId));
    return configs.map(DBToType);
}

/** Create a LOCAL config for the signed-in user. CLOUD must go through /api/cloud/session. */
export async function createConfig(config?: ClientConfig) {
    const userId = await requireSessionUserId();

    if (config?.type === ClientType.CLOUD) {
        throw new Error("Cloud configs must be created via the cloud session API");
    }

    const data: ClientConfig = config ?? {
        name: "New config",
        type: ClientType.LOCAL,
        address: "http://127.0.0.1:8080",
        apiKey: "",
    };

    assertLocalAddress(data.address || "http://127.0.0.1:8080");

    const newClient = await db.insert(clientConfigs).values({
        userId,
        name: data.name,
        type: ClientType.LOCAL,
        address: data.address!,
        apiKey: data.apiKey ?? "",
        sessionId: null,
    }).returning();

    return DBToType(newClient[0]);
}

/**
 * Provision a CLOUD row (API routes only). Stores the agent bearer material
 * (sha256 of orchestrator plaintext) — never returned to the browser.
 */
export async function createCloudConfig(
    userId: string,
    input: { name: string; address: string; apiKey: string; sessionId: string },
): Promise<ClientConfig> {
    const newClient = await db.insert(clientConfigs).values({
        userId,
        name: input.name,
        type: ClientType.CLOUD,
        address: input.address,
        apiKey: hashAgentKey(input.apiKey),
        sessionId: input.sessionId,
    }).returning();

    return DBToType(newClient[0]);
}

export async function deleteConfig(dbId: string) {
    const userId = await requireSessionUserId();
    await db.delete(clientConfigs).where(
        and(eq(clientConfigs.id, dbId), eq(clientConfigs.userId, userId)),
    );
}

/**
 * Client-facing update. LOCAL may change address/apiKey/name.
 * CLOUD may only rename — address/apiKey/sessionId are server-managed.
 */
export async function updateConfig(dbId: string, config: ClientConfig) {
    const userId = await requireSessionUserId();
    const existing = await getConfigInternal(userId, dbId);
    if (!existing) {
        throw new Error("Config not found");
    }

    if (existing.type === ClientType.CLOUD || config.type === ClientType.CLOUD) {
        await db.update(clientConfigs).set({
            name: config.name,
        }).where(and(eq(clientConfigs.id, dbId), eq(clientConfigs.userId, userId)));
        return;
    }

    assertLocalAddress(config.address || existing.address);
    await db.update(clientConfigs).set({
        name: config.name,
        type: ClientType.LOCAL,
        address: config.address,
        apiKey: config.apiKey,
        sessionId: null,
    }).where(and(eq(clientConfigs.id, dbId), eq(clientConfigs.userId, userId)));
}

export async function renameConfig(dbId: string, name: string) {
    const userId = await requireSessionUserId();
    await db.update(clientConfigs).set({ name }).where(
        and(eq(clientConfigs.id, dbId), eq(clientConfigs.userId, userId)),
    );
}

/** Bind orchestrator session onto an owned CLOUD config (API routes only). */
export async function bindCloudSession(
    userId: string,
    dbId: string,
    input: { name: string; address: string; apiKey: string; sessionId: string },
) {
    const existing = await getConfigInternal(userId, dbId);
    if (!existing || existing.type !== ClientType.CLOUD) {
        throw new Error("Cloud config not found");
    }

    await db.update(clientConfigs).set({
        name: input.name,
        type: ClientType.CLOUD,
        address: input.address,
        apiKey: hashAgentKey(input.apiKey),
        sessionId: input.sessionId,
    }).where(and(eq(clientConfigs.id, dbId), eq(clientConfigs.userId, userId)));
}

/** Clear agent binding on an owned CLOUD config (API routes only). */
export async function clearCloudSession(userId: string, dbId: string) {
    const existing = await getConfigInternal(userId, dbId);
    if (!existing || existing.type !== ClientType.CLOUD) {
        return;
    }

    await db.update(clientConfigs).set({
        address: "",
        apiKey: "",
        sessionId: null,
    }).where(and(eq(clientConfigs.id, dbId), eq(clientConfigs.userId, userId)));
}

export async function countActiveCloudSessions(userId: string): Promise<number> {
    const full = await db.select().from(clientConfigs).where(
        and(eq(clientConfigs.userId, userId), eq(clientConfigs.type, "CLOUD")),
    );
    return full.filter((r) => r.sessionId && r.address).length;
}
