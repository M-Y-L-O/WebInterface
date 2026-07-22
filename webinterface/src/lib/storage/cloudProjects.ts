"use server"

import {getServerSession} from "next-auth";
import {authOptions} from "@/lib/auth-options";
import {uploadFile, getFile, deleteFile, type R2FilePayload} from "@/lib/storage/r2bucket";
import {
    listCloudProjects,
    findCloudProjectByName,
    getCloudProject,
    upsertCloudProject,
    removeCloudProject,
    type CloudProjectRow,
} from "@/lib/db/cloudProjects";

export type CloudProjectSummary = {
    id: string;
    name: string;
    description: string;
    updatedAt: string;
    createdAt: string;
};

function sanitizeProjectFileName(name: string): string {
    const trimmed = name.trim() || "project";
    const safe = trimmed.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_");
    return safe.endsWith(".mylo") ? safe : `${safe}.mylo`;
}

function projectsPrefix(userId: string): string {
    return `${userId}/projects`;
}

async function requireUserId(): Promise<string> {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    const userId = session?.user?.id as string | undefined;
    if (!userId) throw new Error("Unauthorized");
    return userId;
}

function toSummary(row: CloudProjectRow): CloudProjectSummary {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

export async function listMyCloudProjects(): Promise<CloudProjectSummary[]> {
    const userId = await requireUserId();
    const rows = await listCloudProjects(userId);
    return rows.map(toSummary);
}

export async function cloudProjectExistsByName(name: string): Promise<boolean> {
    const userId = await requireUserId();
    const existing = await findCloudProjectByName(userId, name.trim());
    return !!existing;
}

/**
 * Upload an exported `.mylo` to R2 and upsert the cloudprojects row.
 * Pass FormData with: file, name, optional description, optional overwrite ("true"|"false").
 * If a project with the same name exists and overwrite is false, returns needsOverwrite.
 */
export async function saveMyCloudProject(formData: FormData): Promise<
    | {ok: true; project: CloudProjectSummary}
    | {ok: false; needsOverwrite: true}
    | {ok: false; error: string}
> {
    try {
        const userId = await requireUserId();
        const name = String(formData.get("name") ?? "").trim();
        const description = String(formData.get("description") ?? "");
        const overwrite = String(formData.get("overwrite") ?? "false") === "true";
        const raw = formData.get("file");

        if (!name) return {ok: false, error: "Project name required"};
        if (!(raw instanceof File)) return {ok: false, error: "File required"};

        const existing = await findCloudProjectByName(userId, name);
        if (existing && !overwrite) {
            return {ok: false, needsOverwrite: true};
        }

        const fileName = sanitizeProjectFileName(name);
        const file = new File([raw], fileName, {
            type: raw.type || "application/octet-stream",
        });

        const cloudPath = await uploadFile(file, projectsPrefix(userId));
        const row = await upsertCloudProject({
            userId,
            name,
            description: description || existing?.description || "",
            cloudPath,
            existingId: existing?.id,
        });

        return {ok: true, project: toSummary(row)};
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to save cloud project";
        console.error("[cloudProjects] save", e);
        return {ok: false, error: message};
    }
}

export async function downloadMyCloudProject(
    projectId: string,
): Promise<{ok: true; fileName: string; payload: R2FilePayload} | {ok: false; error: string}> {
    try {
        const userId = await requireUserId();
        const row = await getCloudProject(userId, projectId);
        if (!row?.cloudPath) return {ok: false, error: "Cloud project not found"};

        const payload = await getFile(row.cloudPath);
        if (!payload) return {ok: false, error: "File missing in storage"};

        return {
            ok: true,
            fileName: sanitizeProjectFileName(row.name),
            payload,
        };
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to download cloud project";
        console.error("[cloudProjects] download", e);
        return {ok: false, error: message};
    }
}

export async function deleteMyCloudProject(
    projectId: string,
): Promise<{ok: true} | {ok: false; error: string}> {
    try {
        const userId = await requireUserId();
        const row = await removeCloudProject(userId, projectId);
        if (!row) return {ok: false, error: "Cloud project not found"};

        if (row.cloudPath) {
            try {
                await deleteFile(row.cloudPath);
            } catch {
                // DB row is gone; orphaned object can be cleaned later
            }
        }
        return {ok: true};
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to delete cloud project";
        console.error("[cloudProjects] delete", e);
        return {ok: false, error: message};
    }
}
