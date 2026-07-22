'use server'

import {clientConfigs} from "@/db/schemas/userData";
import {db} from "@/db/db";
import {and, eq} from "drizzle-orm";
import {ClientConfig, ClientType, CLOUD_PROXY_BASE} from "@/lib/client/ClientTypes";

export type ClientConfigDB = typeof clientConfigs.$inferSelect;

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

export async function createConfig(userId: string, config?: ClientConfig) {
    let data = config;
    if (!data) {
        data = {
            name: "New config",
            type: ClientType.LOCAL,
            address: "http://127.0.0.1:8080",
            apiKey: "",
        };
    }

    const newClient = await db.insert(clientConfigs).values({
        userId: userId,
        name: data.name,
        type: data.type,
        address: data.address!,
        apiKey: data.apiKey!,
        sessionId: data.sessionId ?? null,
    }).returning();

    return DBToType(newClient[0]);
}

export async function getConfigs(userId: string) {
    const configs = await db.select().from(clientConfigs).where(eq(clientConfigs.userId, userId));
    return configs.map(DBToType);
}

export async function getConfigInternal(userId: string, configId: string): Promise<ClientConfig | null> {
    const rows = await db.select().from(clientConfigs).where(
        and(eq(clientConfigs.id, configId), eq(clientConfigs.userId, userId)),
    );
    if (!rows[0]) return null;
    return DBToInternal(rows[0]);
}

export async function deleteConfig(dbId: string) {
    await db.delete(clientConfigs).where(eq(clientConfigs.id, dbId));
}

export async function updateConfig(dbId: string, config: ClientConfig) {
    await db.update(clientConfigs).set({
        name: config.name,
        type: config.type,
        address: config.address,
        apiKey: config.apiKey,
        sessionId: config.sessionId ?? null,
    }).where(eq(clientConfigs.id, dbId));
}

export async function renameConfig(dbId: string, name: string) {
    await db.update(clientConfigs).set({ name }).where(eq(clientConfigs.id, dbId));
}
