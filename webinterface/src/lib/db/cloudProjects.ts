import {cloudProjects} from "@/db/schemas/userData";
import {db} from "@/db/db";
import {and, desc, eq} from "drizzle-orm";

export type CloudProjectRow = typeof cloudProjects.$inferSelect;

export async function listCloudProjects(userId: string): Promise<CloudProjectRow[]> {
    return db
        .select()
        .from(cloudProjects)
        .where(and(eq(cloudProjects.userId, userId), eq(cloudProjects.cloudSaved, true)))
        .orderBy(desc(cloudProjects.updatedAt));
}

export async function getCloudProject(userId: string, id: string): Promise<CloudProjectRow | null> {
    const rows = await db
        .select()
        .from(cloudProjects)
        .where(and(eq(cloudProjects.id, id), eq(cloudProjects.userId, userId)));
    return rows[0] ?? null;
}

export async function findCloudProjectByName(userId: string, name: string): Promise<CloudProjectRow | null> {
    const rows = await db
        .select()
        .from(cloudProjects)
        .where(and(eq(cloudProjects.userId, userId), eq(cloudProjects.name, name)));
    return rows[0] ?? null;
}

export async function upsertCloudProject(args: {
    userId: string;
    name: string;
    description?: string;
    cloudPath: string;
    existingId?: string;
}): Promise<CloudProjectRow> {
    const {userId, name, description = "", cloudPath, existingId} = args;
    const now = new Date();

    if (existingId) {
        const updated = await db
            .update(cloudProjects)
            .set({
                name,
                description,
                cloudPath,
                cloudSaved: true,
                updatedAt: now,
            })
            .where(and(eq(cloudProjects.id, existingId), eq(cloudProjects.userId, userId)))
            .returning();
        if (updated[0]) return updated[0];
    }

    const inserted = await db
        .insert(cloudProjects)
        .values({
            userId,
            name,
            description,
            cloudPath,
            cloudSaved: true,
            createdAt: now,
            updatedAt: now,
        })
        .returning();

    return inserted[0];
}

export async function removeCloudProject(userId: string, id: string): Promise<CloudProjectRow | null> {
    const deleted = await db
        .delete(cloudProjects)
        .where(and(eq(cloudProjects.id, id), eq(cloudProjects.userId, userId)))
        .returning();
    return deleted[0] ?? null;
}
