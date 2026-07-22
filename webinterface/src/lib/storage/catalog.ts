"use server"

import {getServerSession} from "next-auth";
import {authOptions} from "@/lib/auth-options";
import {uploadFile, deleteFile} from "@/lib/storage/r2bucket";
import {
    listCatalogItems,
    getCatalogItem,
    insertCatalogItem,
    removeCatalogItem,
    type CatalogKind,
} from "@/lib/db/catalog";

export type CatalogItemSummary = {
    id: string;
    name: string;
    description: string;
    kind: CatalogKind;
    fileName: string;
    publisherId: string;
    publisherName: string | null;
    publisherImage: string | null;
    createdAt: string;
    updatedAt: string;
    isMine: boolean;
};

async function requireUserId(): Promise<string> {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    const userId = session?.user?.id as string | undefined;
    if (!userId) throw new Error("Unauthorized");
    return userId;
}

function asKind(value: string): CatalogKind | null {
    if (value === "project" || value === "pt2" || value === "onnx") return value;
    return null;
}

function kindFromFileName(fileName: string): CatalogKind | null {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".mylo")) return "project";
    if (lower.endsWith(".pt2")) return "pt2";
    if (lower.endsWith(".onnx")) return "onnx";
    return null;
}

function sanitizeFileName(name: string, kind: CatalogKind): string {
    const trimmed = name.trim() || "item";
    const safe = trimmed.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_");
    const ext = kind === "project" ? ".mylo" : kind === "pt2" ? ".pt2" : ".onnx";
    return safe.toLowerCase().endsWith(ext) ? safe : `${safe}${ext}`;
}

export async function listCatalog(): Promise<CatalogItemSummary[]> {
    const userId = await requireUserId();
    const rows = await listCatalogItems();
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        kind: row.kind as CatalogKind,
        fileName: row.fileName,
        publisherId: row.userId,
        publisherName: row.publisherName,
        publisherImage: row.publisherImage,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        isMine: row.userId === userId,
    }));
}

/**
 * Publish a file to the shared catalog.
 * FormData: file, name, optional description, optional kind (inferred from extension).
 */
export async function publishCatalogItem(formData: FormData): Promise<
    | {ok: true; item: CatalogItemSummary}
    | {ok: false; error: string}
> {
    try {
        const userId = await requireUserId();
        const name = String(formData.get("name") ?? "").trim();
        const description = String(formData.get("description") ?? "").trim();
        const raw = formData.get("file");
        const kindHint = String(formData.get("kind") ?? "");

        if (!name) return {ok: false, error: "Name required"};
        if (!(raw instanceof File)) return {ok: false, error: "File required"};

        const kind = asKind(kindHint) || kindFromFileName(raw.name);
        if (!kind) {
            return {ok: false, error: "Unsupported file type — use .mylo, .pt2, or .onnx"};
        }

        const itemId = crypto.randomUUID();
        const fileName = sanitizeFileName(raw.name || name, kind);
        const file = new File([raw], fileName, {
            type: raw.type || "application/octet-stream",
        });

        const cloudPath = await uploadFile(file, `catalog/${userId}/${itemId}`);
        const row = await insertCatalogItem({
            id: itemId,
            userId,
            name,
            description,
            kind,
            fileName,
            cloudPath,
        });

        return {
            ok: true,
            item: {
                id: row.id,
                name: row.name,
                description: row.description,
                kind: row.kind as CatalogKind,
                fileName: row.fileName,
                publisherId: row.userId,
                publisherName: null,
                publisherImage: null,
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString(),
                isMine: true,
            },
        };
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to publish";
        console.error("[catalog] publish", e);
        return {ok: false, error: message};
    }
}

export async function deleteCatalogItem(
    itemId: string,
): Promise<{ok: true} | {ok: false; error: string}> {
    try {
        const userId = await requireUserId();
        const row = await removeCatalogItem(userId, itemId);
        if (!row) return {ok: false, error: "Not found or not yours"};

        if (row.cloudPath) {
            try {
                await deleteFile(row.cloudPath);
            } catch {
                // orphan ok
            }
        }
        return {ok: true};
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to delete";
        console.error("[catalog] delete", e);
        return {ok: false, error: message};
    }
}
