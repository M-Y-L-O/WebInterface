import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/db";
import { aiChats } from "@/db/schemas/userData";

export type AiChatRow = typeof aiChats.$inferSelect;

export async function listAiChats(userId: string, projectKey: string, limit = 20) {
    return db
        .select({
            id: aiChats.id,
            title: aiChats.title,
            model: aiChats.model,
            updatedAt: aiChats.updatedAt,
            createdAt: aiChats.createdAt,
        })
        .from(aiChats)
        .where(and(eq(aiChats.userId, userId), eq(aiChats.projectKey, projectKey)))
        .orderBy(desc(aiChats.updatedAt))
        .limit(limit);
}

export async function getLatestAiChat(userId: string, projectKey: string) {
    const rows = await db
        .select()
        .from(aiChats)
        .where(and(eq(aiChats.userId, userId), eq(aiChats.projectKey, projectKey)))
        .orderBy(desc(aiChats.updatedAt))
        .limit(1);
    return rows[0] ?? null;
}

export async function getAiChat(userId: string, id: string) {
    const rows = await db
        .select()
        .from(aiChats)
        .where(and(eq(aiChats.id, id), eq(aiChats.userId, userId)))
        .limit(1);
    return rows[0] ?? null;
}

export async function createAiChat(input: {
    userId: string;
    projectKey: string;
    title?: string;
    messages?: unknown[];
    geminiContents?: unknown[];
    model?: string | null;
}) {
    const rows = await db
        .insert(aiChats)
        .values({
            userId: input.userId,
            projectKey: input.projectKey,
            title: input.title || "Chat",
            messages: input.messages || [],
            geminiContents: input.geminiContents || [],
            model: input.model || null,
        })
        .returning();
    return rows[0];
}

export async function upsertAiChat(input: {
    id?: string | null;
    userId: string;
    projectKey: string;
    title?: string;
    messages: unknown[];
    geminiContents: unknown[];
    model?: string | null;
}) {
    if (input.id) {
        const existing = await getAiChat(input.userId, input.id);
        if (existing && existing.projectKey === input.projectKey) {
            const rows = await db
                .update(aiChats)
                .set({
                    title: input.title || existing.title,
                    messages: input.messages,
                    geminiContents: input.geminiContents,
                    model: input.model ?? existing.model,
                    updatedAt: new Date(),
                })
                .where(and(eq(aiChats.id, input.id), eq(aiChats.userId, input.userId)))
                .returning();
            return rows[0];
        }
    }
    return createAiChat(input);
}

export async function deleteAiChat(userId: string, id: string) {
    const rows = await db
        .delete(aiChats)
        .where(and(eq(aiChats.id, id), eq(aiChats.userId, userId)))
        .returning({ id: aiChats.id });
    return rows[0] ?? null;
}
