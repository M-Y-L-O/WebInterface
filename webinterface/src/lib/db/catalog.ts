import {catalogItems} from "@/db/schemas/userData";
import {users} from "@/db/schemas/nextAuth";
import {db} from "@/db/db";
import {and, desc, eq} from "drizzle-orm";

export type CatalogKind = "project" | "pt2" | "onnx";
export type CatalogItemRow = typeof catalogItems.$inferSelect;

export type CatalogItemWithPublisher = CatalogItemRow & {
    publisherName: string | null;
    publisherImage: string | null;
};

export async function listCatalogItems(): Promise<CatalogItemWithPublisher[]> {
    const rows = await db
        .select({
            id: catalogItems.id,
            userId: catalogItems.userId,
            name: catalogItems.name,
            description: catalogItems.description,
            kind: catalogItems.kind,
            fileName: catalogItems.fileName,
            cloudPath: catalogItems.cloudPath,
            createdAt: catalogItems.createdAt,
            updatedAt: catalogItems.updatedAt,
            publisherName: users.name,
            publisherImage: users.image,
        })
        .from(catalogItems)
        .leftJoin(users, eq(catalogItems.userId, users.id))
        .orderBy(desc(catalogItems.updatedAt));

    return rows;
}

export async function getCatalogItem(id: string): Promise<CatalogItemRow | null> {
    const rows = await db.select().from(catalogItems).where(eq(catalogItems.id, id));
    return rows[0] ?? null;
}

export async function insertCatalogItem(args: {
    id?: string;
    userId: string;
    name: string;
    description: string;
    kind: CatalogKind;
    fileName: string;
    cloudPath: string;
}): Promise<CatalogItemRow> {
    const now = new Date();
    const inserted = await db
        .insert(catalogItems)
        .values({
            ...(args.id ? {id: args.id} : {}),
            userId: args.userId,
            name: args.name,
            description: args.description,
            kind: args.kind,
            fileName: args.fileName,
            cloudPath: args.cloudPath,
            createdAt: now,
            updatedAt: now,
        })
        .returning();
    return inserted[0];
}

export async function removeCatalogItem(userId: string, id: string): Promise<CatalogItemRow | null> {
    const deleted = await db
        .delete(catalogItems)
        .where(and(eq(catalogItems.id, id), eq(catalogItems.userId, userId)))
        .returning();
    return deleted[0] ?? null;
}
