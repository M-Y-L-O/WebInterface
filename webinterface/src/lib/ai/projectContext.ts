import { useClientStore, useDockviewStore, useProjectStore } from "@/lib/store";
import { getPrimaryVisualisation } from "@/lib/store/projectStore";

function truncateJson(value: unknown, maxChars = 12000): unknown {
    try {
        const raw = JSON.stringify(value);
        if (raw.length <= maxChars) return value;
        return {
            _truncated: true,
            preview: raw.slice(0, maxChars),
            originalChars: raw.length,
        };
    } catch {
        return String(value);
    }
}

function safeError(e: unknown): string {
    if (e instanceof Error) return e.message;
    return String(e);
}

export function buildProjectContextSnapshot(): string {
    const { project, csv, visualisations, optimizationRun, descriptorDraft } = useProjectStore.getState();
    const visualisation = getPrimaryVisualisation(visualisations);
    const client = useClientStore.getState().client;
    const api = useDockviewStore.getState().api;

    const pd = project?.projectData ?? null;
    const nodes = Array.isArray(visualisation?.nodes) ? visualisation.nodes : [];
    const edges = Array.isArray(visualisation?.edges) ? visualisation.edges : [];
    const descriptorNodes = Array.isArray(project?.modelData?.nodes)
        ? project.modelData.nodes
        : Array.isArray((visualisation as any)?.nodes)
          ? (visualisation as any).nodes
          : [];

    const openPanels =
        api?.panels?.map((p) => ({
            id: p.id,
            title: p.title,
            component: (p as any).component || p.id.split("-")[0],
        })) ?? [];

    const csvKeys =
        csv && typeof csv === "object"
            ? Object.keys(csv).slice(0, 30)
            : [];

    return JSON.stringify(
        {
            connected: Boolean(client),
            project: pd
                ? {
                      id: pd.id,
                      name: pd.name,
                      csvFile: pd.csvFile,
                      modelFile: pd.modelFile,
                      uploadedPt2File: pd.uploadedPt2File,
                      uploadedOnnxFile: pd.uploadedOnnxFile,
                      optimizedPt2File: pd.optimizedPt2File,
                      optimizedOnnxFile: pd.optimizedOnnxFile,
                  }
                : null,
            hasModelData: Boolean(project?.modelData || visualisation),
            visualisationSlots: {
                uploadedPt2: Boolean(visualisations.uploadedPt2),
                uploadedOnnx: Boolean(visualisations.uploadedOnnx),
                optimizedPt2: Boolean(visualisations.optimizedPt2),
                optimizedOnnx: Boolean(visualisations.optimizedOnnx),
            },
            graphNodeCount: nodes.length || descriptorNodes.length,
            graphEdgeCount: edges.length,
            csvPresent: Boolean(csv),
            csvTopLevelKeys: csvKeys,
            hasDescriptorDraft: Boolean(descriptorDraft),
            optimization: optimizationRun
                ? {
                      updateCount: optimizationRun.updates?.length ?? 0,
                      hasResult: Boolean(optimizationRun.result || optimizationRun.report),
                      runError: optimizationRun.runError,
                      completedAt: optimizationRun.completedAt,
                  }
                : null,
            openPanels,
        },
        null,
        2,
    );
}

function summarizeDescriptor(descriptor: any, includeParams = true) {
    if (!descriptor || typeof descriptor !== "object") {
        return { error: "No descriptor available" };
    }

    const nodes = Array.isArray(descriptor.nodes) ? descriptor.nodes : [];
    return {
        nodeCount: nodes.length,
        edgeCount: Array.isArray(descriptor.edges) ? descriptor.edges.length : undefined,
        nodes: nodes.map((n: any) => ({
            id: n.id,
            type: n.type || n.op || n.kind,
            ...(includeParams ? { params: n.params ?? n.attributes ?? n.kwargs } : {}),
        })),
        edges: Array.isArray(descriptor.edges)
            ? descriptor.edges.map((e: any) => ({
                  source: e.source ?? e.from,
                  target: e.target ?? e.to,
                  sourcePort: e.sourcePort,
                  targetPort: e.targetPort,
              }))
            : undefined,
        meta: truncateJson({
            input: descriptor.input,
            output: descriptor.output,
            version: descriptor.version,
        }, 2000),
    };
}

function summarizeCsv(csv: any, maxColumns = 40) {
    if (!csv) return { error: "No CSV loaded" };

    if (Array.isArray(csv.columns) || Array.isArray(csv.headers)) {
        const cols = (csv.columns || csv.headers || []).slice(0, maxColumns);
        return {
            columns: cols,
            rowCount: csv.rowCount ?? csv.rows?.length ?? csv.data?.length,
            sample: truncateJson(csv.sample || csv.preview || csv.data?.slice?.(0, 3), 4000),
            keys: Object.keys(csv).slice(0, 40),
        };
    }

    return truncateJson(csv, 6000);
}

function summarizeEditResult(res: any) {
    if (!res) return { error: "Empty response" };
    if (res instanceof Error) return { error: res.message };
    if (res.success === false) {
        return {
            success: false,
            error: res.error || res.message || "Edit failed",
            code: res.code,
        };
    }

    return {
        success: res.success !== false,
        message: res.message,
        descriptorSummary: res.descriptor
            ? summarizeDescriptor(res.descriptor, false)
            : undefined,
        hasGraph: Boolean(res.graph),
        shapes: res.shapes ? truncateJson(res.shapes, 2000) : undefined,
        raw: truncateJson(
            {
                valid: res.valid,
                warnings: res.warnings,
                error: res.error,
            },
            2000,
        ),
    };
}

export { truncateJson, summarizeDescriptor, summarizeCsv, summarizeEditResult, safeError };
