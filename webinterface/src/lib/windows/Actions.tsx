"use client"
import {toast} from 'sonner'
import {Client} from "@/lib/client/Client";
import {useDockviewStore, useProjectStore} from "@/lib/store";

/**
 * After a successful model-editor save, push the new graph into project state
 * and any open Visualiser panels for the same model slot/file.
 */
export function publishSavedModelGraph(args: {
    graph: any;
    descriptor?: any;
    filePath?: string;
    fileName?: string;
    /** ModelEditor panel id, e.g. ModelEditor-uploadedPt2 */
    sourcePanelId?: string;
}) {
    const { graph, descriptor, filePath, fileName, sourcePanelId } = args;
    if (!graph) return;

    const projectStore = useProjectStore.getState();
    const slotKey = sourcePanelId?.startsWith("ModelEditor-")
        ? sourcePanelId.slice("ModelEditor-".length)
        : "uploaded_pt2";
    projectStore.setSlotVisualisation(slotKey, graph);

    const project = projectStore.project;
    if (project) {
        projectStore.setProject({
            ...project,
            modelData: graph,
        });
    }

    const api = useDockviewStore.getState().api;
    if (!api) return;
    const twinId = slotKey ? `Visualiser-${slotKey}` : null;

    const patch = {
        visualisation: graph,
        ...(descriptor !== undefined ? { descriptor } : {}),
        ...(filePath !== undefined ? { filePath } : {}),
        ...(fileName !== undefined ? { fileName } : {}),
        modelRevision: Date.now(),
    };

    for (const panel of api.panels) {
        if (!panel.id.startsWith("Visualiser-")) continue;

        const params = panel.params || {};
        const sameTwin = twinId != null && panel.id === twinId;
        const sameFile =
            !!filePath &&
            typeof params.filePath === "string" &&
            params.filePath === filePath;

        if (sameTwin || sameFile) {
            panel.api.updateParameters(patch);
        }
    }
}

export async function LoadModel(client:Client|null, openVisualizer?: (result:any, fileName?:string)=>void){

    const toastId = toast.loading("Processing Model...");
    if(!client){
        toast.error("No client connected", {id: toastId, duration: 5000});
        return;
    }
    try {
        const file = await client.GetFile(".onnx, .pt2")
        if(file === undefined || !file)
            throw new Error("Failed to load model: No file found")

        const res = await client.LoadModel(file);

        if(!res || res==="undefined" || res === "null" || res===undefined || res.message === "Request failed:")
            throw new Error("Failed to load model: Invalid response" + res)

        const isOnnx = file.name?.toLowerCase().endsWith(".onnx");
        if (isOnnx) {
            useProjectStore.getState().setUploadOnnx(res);
        } else {
            useProjectStore.getState().setUploadPt2(res);
        }
        openVisualizer?.(res, file.name);
        toast.success("Model loaded", {id: toastId, duration: 5000});
    } catch (e) {
        // @ts-ignore
        toast.error("Failed to load model", {id: toastId, duration: 5000, description: e.message});
    }
}

export async function LoadCSV(client:Client|null){
    const toastId = toast.loading("Processing CSV...")
    if(!client) {
        toast.error("No client connected", {id: toastId, duration: 5000});
        return;
    }
    try {
        const file = await client.GetFile(".csv")
        if(file === undefined || !file)
            throw new Error("Failed to load CSV: No file found")

        const res = await client.LoadCSV(file);

        if(!res || res==="undefined" || res === "null" || res===undefined || res.message === "Request failed:")
            throw new Error("Failed to load CSV: Invalid response")

        useProjectStore.getState().setCsv(res);
        toast.success("CSV loaded", {id: toastId, duration: 5000});
    } catch (e) {
        // @ts-ignore
        toast.error("Failed to load CSV", {id: toastId, duration: 5000, description: e.message});
    }
}

export async function SaveProject(client:Client|null){
    if(!client){
        toast.error("No client connected", {duration: 5000});
        return;
    }
    const toastId = toast.loading("Exporting project...");
    try {
        const res = await client.ExportProject();
        if (res instanceof Error) throw res;
        toast.success("Project saved", {id: toastId, duration: 5000});
    } catch (e) {
        // @ts-ignore
        toast.error("Failed to save project", {id: toastId, duration: 5000, description: e?.message});
    }
}

/**
 * Export from the agent, then upload the `.mylo` to R2.
 * Agent never talks to cloud storage — only the web app has credentials.
 */
export async function SaveProjectToCloud(
    client: Client | null,
    opts?: {overwrite?: boolean; name?: string},
): Promise<"saved" | "needs_overwrite" | "cancelled" | "error"> {
    if (!client) {
        toast.error("No client connected", {duration: 5000});
        return "error";
    }

    const project = useProjectStore.getState().project;
    const name = (opts?.name ?? project?.projectData?.name ?? "").trim();
    if (!name) {
        toast.error("Project has no name", {duration: 5000});
        return "error";
    }

    const toastId = toast.loading("Saving project to cloud...");
    try {
        const {cloudProjectExistsByName, saveMyCloudProject} = await import("@/lib/storage/cloudProjects");

        if (!opts?.overwrite) {
            const exists = await cloudProjectExistsByName(name);
            if (exists) {
                toast.dismiss(toastId);
                return "needs_overwrite";
            }
        }

        const blob = await client.exportProjectBlob();
        const file = new File([blob], `${name}.mylo`, {type: "application/octet-stream"});
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", name);
        formData.append("overwrite", opts?.overwrite ? "true" : "false");
        const result = await saveMyCloudProject(formData);

        if (!result.ok && "needsOverwrite" in result && result.needsOverwrite) {
            toast.dismiss(toastId);
            return "needs_overwrite";
        }
        if (!result.ok) {
            throw new Error("error" in result ? result.error : "Upload failed");
        }

        toast.success("Project saved to cloud", {id: toastId, duration: 5000});
        return "saved";
    } catch (e) {
        // @ts-ignore
        toast.error("Failed to save to cloud", {id: toastId, duration: 5000, description: e?.message});
        return "error";
    }
}

function errorMessage(e: unknown, fallback = "Unknown error"): string {
    if (e instanceof Error) {
        const cause = e.cause instanceof Error ? e.cause.message : e.cause ? String(e.cause) : "";
        return cause ? `${e.message} (${cause})` : e.message || fallback;
    }
    if (typeof e === "string") return e;
    return fallback;
}

/** Agent load/export responses vary: "success" | "Success" | "loaded". */
function isAgentOk(res: unknown): boolean {
    if (res == null || res instanceof Error) return false;
    if (typeof res === "string") {
        const s = res.trim().toLowerCase();
        return s === "success" || s === "loaded" || s === "ok";
    }
    if (typeof res === "object") {
        const message = String((res as any).message ?? (res as any).status ?? "").trim().toLowerCase();
        return message === "success" || message === "loaded" || message === "ok";
    }
    return false;
}

/**
 * Download a cloud `.mylo` into the browser, then hand it to the agent via loadProject.
 * Uses /api/storage/projects/:id (binary) — not a server-action base64 payload.
 */
export async function OpenCloudProject(client: Client | null, projectId: string) {
    if (!client) {
        toast.error("No client connected", {duration: 5000});
        return 400;
    }

    const toastId = toast.loading("Downloading project from cloud...");
    try {
        const downloadRes = await fetch(`/api/storage/projects/${encodeURIComponent(projectId)}`);
        if (!downloadRes.ok) {
            const body = await downloadRes.json().catch(() => null);
            const detail = body?.error || downloadRes.statusText || `HTTP ${downloadRes.status}`;
            throw new Error(`Cloud download failed: ${detail}`);
        }

        const fileName =
            downloadRes.headers.get("X-File-Name") ||
            `project-${projectId}.mylo`;
        const blob = await downloadRes.blob();
        if (!blob.size) {
            throw new Error("Cloud download returned an empty file");
        }

        const file = new File([blob], fileName, {
            type: blob.type || "application/octet-stream",
        });

        toast.loading("Sending project to agent...", {id: toastId});
        const res = await client.loadProject(file);

        if (res instanceof Error) {
            throw new Error(`Agent load failed: ${errorMessage(res)}`);
        }
        if (!isAgentOk(res)) {
            const detail =
                (typeof (res as any)?.message === "string" && (res as any).message) ||
                (typeof (res as any)?.error === "string" && (res as any).error) ||
                JSON.stringify(res) ||
                "Agent rejected project";
            throw new Error(`Agent load failed: ${detail}`);
        }

        const activeProject = await client.getProject();
        useProjectStore.getState().hydrateFromProject(activeProject);

        toast.success("Cloud project loaded", {id: toastId, duration: 5000});
        return 200;
    } catch (e) {
        toast.error("Failed to open cloud project", {
            id: toastId,
            duration: 8000,
            description: errorMessage(e),
        });
        return 400;
    }
}

export async function OpenProject(client:Client|null){
    if(!client){
        toast.error("No client connected", {duration: 5000});
        return 400;
    }


    const file = await client.GetFile(".mylo");
    if(!file)
    {
        toast.error("No project found", {duration: 5000});
        return 400;
    }

    const res = await client.loadProject(file);
    if (res instanceof Error || !isAgentOk(res)) {
        const detail =
            res instanceof Error
                ? errorMessage(res)
                : (typeof (res as any)?.message === "string" && (res as any).message) ||
                  "Unknown agent response";
        toast.error("Failed to open project", {duration: 5000, description: detail});
        return 400;
    }

    const activeProject = await client.getProject();
    useProjectStore.getState().hydrateFromProject(activeProject);

    toast.success("Project opened", {duration: 5000});
    return 200;

}

async function fetchCatalogBlob(itemId: string): Promise<{blob: Blob; fileName: string; kind: string}> {
    const res = await fetch(`/api/storage/catalog/${encodeURIComponent(itemId)}`);
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Download failed (${res.status})`);
    }
    const blob = await res.blob();
    if (!blob.size) throw new Error("Empty download");
    const fileName = res.headers.get("X-File-Name") || `catalog-${itemId}`;
    const kind = res.headers.get("X-Catalog-Kind") || "";
    return {blob, fileName, kind};
}

/** Save a catalog file to the user's disk. */
export async function DownloadCatalogItem(itemId: string) {
    const toastId = toast.loading("Downloading…");
    try {
        const {blob, fileName} = await fetchCatalogBlob(itemId);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Download started", {id: toastId, duration: 4000});
        return 200;
    } catch (e) {
        toast.error("Download failed", {id: toastId, duration: 6000, description: errorMessage(e)});
        return 400;
    }
}

export type CatalogOpenTarget = {
    id: string;
    kind: "project" | "pt2" | "onnx";
    name: string;
    fileName?: string;
};

/**
 * Pull from catalog → agent. Projects load as .mylo; models LoadModel then open editor/visualiser.
 */
export async function OpenCatalogItem(
    client: Client | null,
    item: CatalogOpenTarget,
): Promise<200 | 400> {
    if (!client) {
        toast.error("No client connected", {duration: 5000});
        return 400;
    }

    const toastId = toast.loading(`Opening ${item.name}…`);
    try {
        const {queuePendingPanel} = await import("@/lib/windows/pendingPanel");
        const {blob, fileName, kind: headerKind} = await fetchCatalogBlob(item.id);
        const kind = item.kind || (headerKind as CatalogOpenTarget["kind"]);
        const file = new File([blob], item.fileName || fileName, {
            type: "application/octet-stream",
        });

        if (kind === "project") {
            const res = await client.loadProject(file);
            if (res instanceof Error || !isAgentOk(res)) {
                throw new Error(
                    res instanceof Error
                        ? errorMessage(res)
                        : (res as any)?.message || "Agent rejected project",
                );
            }
            const activeProject = await client.getProject();
            useProjectStore.getState().hydrateFromProject(activeProject);
            toast.success("Project loaded from catalog", {id: toastId, duration: 4000});
            return 200;
        }

        // Model: load into agent uploaded slot
        const loadRes = await client.LoadModel(file);
        if (!loadRes || loadRes instanceof Error || (loadRes as any).error) {
            throw new Error((loadRes as any)?.error || errorMessage(loadRes) || "LoadModel failed");
        }

        if (kind === "pt2") {
            let descriptor: any = null;
            const descRes = await client.getModelDescriptor();
            if (descRes && !(descRes instanceof Error) && (descRes as any)?.descriptor) {
                descriptor = (descRes as any).descriptor;
            }

            let visualisation = loadRes;
            if (descriptor) {
                const graphRes = await client.visualizeModel({descriptor});
                if (graphRes && !(graphRes instanceof Error) && !(graphRes as any)?.error) {
                    visualisation = graphRes;
                }
            }

            useProjectStore.getState().setUploadPt2(visualisation);
            const project = useProjectStore.getState().project;
            if (project) {
                useProjectStore.getState().setProject({...project, modelData: visualisation});
            }

            queuePendingPanel({
                component: "ModelEditor",
                id: "ModelEditor-uploaded_pt2",
                title: `Editor — ${item.name}`,
                params: {
                    descriptor,
                    fileName: item.fileName || fileName,
                    visualisation,
                },
            });
        } else {
            // onnx → visualiser
            useProjectStore.getState().setUploadOnnx(loadRes);
            queuePendingPanel({
                component: "Visualiser",
                id: "Visualiser-uploaded_onnx",
                title: `Visualiser — ${item.name}`,
                params: {
                    visualisation: loadRes,
                    fileName: item.fileName || fileName,
                },
            });
        }

        // Refresh project metadata if agent has one
        try {
            const activeProject = await client.getProject();
            if (activeProject && !(activeProject instanceof Error) && activeProject.projectData) {
                const cachedPt2 = useProjectStore.getState().visualisations.uploadedPt2;
                useProjectStore.getState().hydrateFromProject({
                    ...activeProject,
                    modelData: cachedPt2 ?? activeProject.modelData,
                });
            }
        } catch {
            // no project yet — fine
        }

        toast.success(
            kind === "pt2" ? "Model loaded — opening editor" : "Model loaded — opening visualiser",
            {id: toastId, duration: 4000},
        );
        return 200;
    } catch (e) {
        toast.error("Failed to open catalog item", {
            id: toastId,
            duration: 8000,
            description: errorMessage(e),
        });
        return 400;
    }
}

/** Publish a local File to the shared catalog. */
export async function PublishCatalogFile(args: {
    file: File;
    name: string;
    description?: string;
    kind?: "project" | "pt2" | "onnx";
}) {
    const toastId = toast.loading("Publishing to catalog…");
    try {
        const {publishCatalogItem} = await import("@/lib/storage/catalog");
        const formData = new FormData();
        formData.append("file", args.file);
        formData.append("name", args.name.trim());
        formData.append("description", args.description?.trim() || "");
        if (args.kind) formData.append("kind", args.kind);

        const result = await publishCatalogItem(formData);
        if (!result.ok) throw new Error(result.error);

        toast.success("Published to catalog", {id: toastId, duration: 4000});
        return result.item;
    } catch (e) {
        toast.error("Publish failed", {id: toastId, duration: 6000, description: errorMessage(e)});
        return null;
    }
}

/** Export the agent project and publish the .mylo to the catalog. */
export async function PublishProjectToCatalog(
    client: Client | null,
    args: {name?: string; description?: string},
) {
    if (!client) {
        toast.error("No client connected", {duration: 5000});
        return null;
    }
    const project = useProjectStore.getState().project;
    const name = (args.name ?? project?.projectData?.name ?? "").trim();
    if (!name) {
        toast.error("Project has no name", {duration: 5000});
        return null;
    }

    const toastId = toast.loading("Exporting & publishing…");
    try {
        const blob = await client.exportProjectBlob();
        const file = new File([blob], `${name}.mylo`, {type: "application/octet-stream"});
        toast.dismiss(toastId);
        return await PublishCatalogFile({
            file,
            name,
            description: args.description,
            kind: "project",
        });
    } catch (e) {
        toast.error("Publish failed", {id: toastId, duration: 6000, description: errorMessage(e)});
        return null;
    }
}
