"use client";

import { notifyModelEdited } from "@/lib/ai/modelSync";
import { normalizeEditPayload } from "@/lib/ai/normalizeEditPayload";
import {
    safeError,
    summarizeCsv,
    summarizeDescriptor,
    summarizeEditResult,
    truncateJson,
} from "@/lib/ai/projectContext";
import type { AiFunctionCall } from "@/lib/ai/types";
import { publishSavedModelGraph } from "@/lib/windows/Actions";
import { useClientStore, useDockviewStore, useProjectStore, useWorkspaceStore } from "@/lib/store";
import { getPrimaryVisualisation } from "@/lib/store/projectStore";
import { usePrefsStore } from "@/lib/settings/prefsStore";
import type { ProgressUpdate } from "@/lib/client/ClientTypes";

/** Module-level handle so stop_optimization can close the SSE subscription. */
let optimizationCleanup: (() => void) | null = null;
let optimizationRunning = false;

function formatDiffSummary(operation: string, payload: Record<string, unknown>, res: any) {
    const nodeId = payload?.nodeId ?? payload?.id;
    const type = payload?.type ?? payload?.op;
    const beforeNodes = res?.before?.nodes?.length;
    const afterNodes =
        res?.descriptor?.nodes?.length ??
        res?.descriptorSummary?.nodeCount ??
        res?.after?.nodes?.length;
    const lines = [
        `Operation: ${operation}`,
        nodeId != null ? `Node: ${String(nodeId)}` : null,
        type != null ? `Type: ${String(type)}` : null,
        beforeNodes != null || afterNodes != null
            ? `Nodes: ${beforeNodes ?? "?"} → ${afterNodes ?? "?"}`
            : null,
        res?.message ? `Message: ${res.message}` : null,
        res?.success === false ? `Failed: ${res.error || res.message || "unknown"}` : "Dry-run completed",
    ].filter(Boolean);
    return lines.join("\n");
}

function csvColumnsAndRows(csv: any): { columns: string[]; rows: any[] } {
    if (!csv) return { columns: [], rows: [] };
    if (Array.isArray(csv.columns) || Array.isArray(csv.headers)) {
        const columns = (csv.columns || csv.headers || []).map(String);
        const rows = Array.isArray(csv.data)
            ? csv.data
            : Array.isArray(csv.rows)
              ? csv.rows
              : Array.isArray(csv.sample)
                ? csv.sample
                : [];
        return { columns, rows };
    }
    if (typeof csv === "object") {
        const columns = Object.keys(csv);
        const len = Math.max(
            0,
            ...columns.map((k) => (Array.isArray(csv[k]) ? csv[k].length : 0)),
        );
        const rows: Record<string, unknown>[] = [];
        for (let i = 0; i < Math.min(len, 200); i++) {
            const row: Record<string, unknown> = {};
            for (const c of columns) {
                row[c] = Array.isArray(csv[c]) ? csv[c][i] : undefined;
            }
            rows.push(row);
        }
        return { columns, rows };
    }
    return { columns: [], rows: [] };
}

function columnStats(columns: string[], rows: any[], filter?: string[]) {
    const cols = (filter?.length ? columns.filter((c) => filter.includes(c)) : columns).slice(
        0,
        40,
    );
    return cols.map((col) => {
        const values = rows.map((r) => (Array.isArray(r) ? r[columns.indexOf(col)] : r?.[col]));
        const nonNull = values.filter((v) => v != null && v !== "");
        const nums = nonNull
            .map((v) => (typeof v === "number" ? v : Number(v)))
            .filter((n) => Number.isFinite(n));
        const dtype =
            nums.length > nonNull.length * 0.8
                ? "number"
                : nonNull.every((v) => typeof v === "boolean" || v === "true" || v === "false")
                  ? "boolean"
                  : "string";
        return {
            column: col,
            dtype,
            count: values.length,
            nulls: values.length - nonNull.length,
            min: nums.length ? Math.min(...nums) : undefined,
            max: nums.length ? Math.max(...nums) : undefined,
            sample: nonNull.slice(0, 5),
        };
    });
}

function requireClient() {
    const client = useClientStore.getState().client;
    if (!client) throw new Error("No MYLO agent connected");
    return client;
}

function openPanel(component: string, id?: string, title?: string) {
    const api = useDockviewStore.getState().api;
    if (!api) throw new Error("Dashboard window manager is not ready");

    const panelId = id || component;
    const existing = api.getPanel(panelId);
    if (existing) {
        existing.api.setActive();
        return { opened: false, focused: true, id: panelId };
    }

    api.addPanel({
        id: panelId,
        component,
        title: title || component,
    } as any);

    return { opened: true, focused: true, id: panelId };
}

function publishEditSideEffects(res: any) {
    if (!res || res instanceof Error || res.success === false) return;

    if (res.descriptor || res.graph || res.shapes) {
        notifyModelEdited({
            descriptor: res.descriptor,
            graph: res.graph,
            shapes: res.shapes,
        });
    }

    if (res.graph) {
        useProjectStore.getState().setUploadPt2(res.graph);
        const project = useProjectStore.getState().project;
        if (project) {
            useProjectStore.getState().setProject({
                ...project,
                modelData: res.graph,
            });
        }
    }
}

export async function executeAiTool(
    call: AiFunctionCall,
): Promise<Record<string, unknown>> {
    const name = call.name;
    const args = (call.args || {}) as Record<string, any>;

    try {
        switch (name) {
            case "get_project_overview": {
                const { project, csv, visualisations, optimizationRun } =
                    useProjectStore.getState();
                const hasVisualisation = Object.values(visualisations).some(Boolean);
                return {
                    projectData: project?.projectData ?? null,
                    hasCsv: Boolean(csv),
                    hasVisualisation,
                    visualisationSlots: {
                        uploadedPt2: Boolean(visualisations.uploadedPt2),
                        uploadedOnnx: Boolean(visualisations.uploadedOnnx),
                        optimizedPt2: Boolean(visualisations.optimizedPt2),
                        optimizedOnnx: Boolean(visualisations.optimizedOnnx),
                    },
                    optimizationRun: optimizationRun
                        ? {
                              updates: optimizationRun.updates?.length ?? 0,
                              hasResult: Boolean(
                                  optimizationRun.result || optimizationRun.report,
                              ),
                              runError: optimizationRun.runError,
                              completedAt: optimizationRun.completedAt,
                          }
                        : null,
                    connected: Boolean(useClientStore.getState().client),
                };
            }

            case "get_model_descriptor": {
                const draft = useProjectStore.getState().descriptorDraft;
                if (draft) {
                    return summarizeDescriptor(
                        draft,
                        args.includeParams !== false,
                    ) as Record<string, unknown>;
                }

                const client = requireClient();
                const res = await client.getModelDescriptor();
                if (!res || res instanceof Error) {
                    return { error: res instanceof Error ? res.message : "Failed to load descriptor" };
                }
                const descriptor = (res as any).descriptor ?? res;
                return summarizeDescriptor(
                    descriptor,
                    args.includeParams !== false,
                ) as Record<string, unknown>;
            }

            case "get_model_graph_summary": {
                const graph = getPrimaryVisualisation(useProjectStore.getState().visualisations);
                if (!graph) return { error: "No visualisation graph in store" };
                const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
                const edges = Array.isArray(graph.edges) ? graph.edges : [];
                return {
                    nodeCount: nodes.length,
                    edgeCount: edges.length,
                    nodes: nodes.slice(0, 80).map((n: any) => ({
                        id: n.id,
                        label: n.label || n.title || n.type,
                        type: n.type || n.group || n.category,
                    })),
                    edges: edges.slice(0, 120).map((e: any) => ({
                        from: e.from ?? e.source,
                        to: e.to ?? e.target,
                    })),
                };
            }

            case "get_csv_summary": {
                const csv = useProjectStore.getState().csv;
                return summarizeCsv(csv, Number(args.maxColumns) || 40) as Record<
                    string,
                    unknown
                >;
            }

            case "get_editor_catalog": {
                const client = requireClient();
                const catalog =
                    (await client.getEditorCatalog()) ||
                    (await client.getModelEditorCatalog());
                if (!catalog || catalog instanceof Error) {
                    return {
                        error:
                            catalog instanceof Error
                                ? catalog.message
                                : "Failed to load editor catalog",
                    };
                }

                const nodeGroups = (catalog as any).nodeGroups;
                const insertable =
                    (catalog as any).insertableTypes ||
                    (nodeGroups ? Object.values(nodeGroups).flat() : []);

                return truncateJson({
                    insertableTypes: insertable,
                    nodeGroups,
                    nodeParameterBlueprints: (catalog as any).nodeParameterBlueprints,
                    nodePorts: (catalog as any).nodePorts,
                    nodeSchemas: (catalog as any).nodeSchemas,
                    swappableActivations: (catalog as any).swappableActivations,
                    limits: (catalog as any).limits,
                }, 20000) as Record<string, unknown>;
            }

            case "get_optimization_status": {
                const run = useProjectStore.getState().optimizationRun;
                if (!run) return { status: "idle", message: "No optimization run in this session" };
                return truncateJson({
                    updates: run.updates?.slice(-20),
                    result: run.result,
                    report: run.report,
                    runError: run.runError,
                    completedAt: run.completedAt,
                }, 12000) as Record<string, unknown>;
            }

            case "edit_model": {
                const client = requireClient();
                const draftDesc = useProjectStore.getState().descriptorDraft;
                const batch = Array.isArray(args.operations) ? args.operations : null;

                if (batch?.length) {
                    const results: unknown[] = [];
                    for (const step of batch) {
                        const operation = String(step?.operation || "");
                        if (!operation) {
                            results.push({ error: "operation is required" });
                            continue;
                        }
                        const payload = normalizeEditPayload(
                            operation,
                            (step?.payload || {}) as Record<string, unknown>,
                        );
                        const res = await client.editModel({
                            operation,
                            payload,
                            persist: Boolean(args.persist),
                            viewMode: "summary",
                            ...(draftDesc
                                ? {
                                      descriptor:
                                          useProjectStore.getState().descriptorDraft ||
                                          draftDesc,
                                  }
                                : {}),
                        });
                        publishEditSideEffects(res);
                        results.push({
                            operation,
                            payload,
                            ...summarizeEditResult(res),
                        });
                        if (res instanceof Error || res?.success === false) break;
                    }
                    return { batched: true, results } as Record<string, unknown>;
                }

                const operation = String(args.operation || "");
                if (!operation) return { error: "operation or operations is required" };
                const payload = normalizeEditPayload(
                    operation,
                    (args.payload || {}) as Record<string, unknown>,
                );

                const res = await client.editModel({
                    operation,
                    payload,
                    persist: Boolean(args.persist),
                    viewMode: "summary",
                    ...(draftDesc ? { descriptor: draftDesc } : {}),
                });
                publishEditSideEffects(res);
                return {
                    operation,
                    payload,
                    ...summarizeEditResult(res),
                } as Record<string, unknown>;
            }

            case "preview_edit": {
                const client = requireClient();
                const operation = String(args.operation || "");
                if (!operation) return { error: "operation is required" };

                const draftDesc = useProjectStore.getState().descriptorDraft;
                const payload = normalizeEditPayload(
                    operation,
                    (args.payload || {}) as Record<string, unknown>,
                );

                const res = await client.previewEdit({
                    operation,
                    payload,
                    viewMode: "summary",
                    ...(draftDesc ? { descriptor: draftDesc } : {}),
                });
                publishEditSideEffects(res);
                const summary = summarizeEditResult(res) as Record<string, unknown>;
                return {
                    ...summary,
                    diffSummary: formatDiffSummary(
                        operation,
                        payload,
                        typeof summary === "object" ? { ...summary, ...(res as object) } : res,
                    ),
                };
            }

            case "validate_model": {
                const client = requireClient();
                const draftDesc = useProjectStore.getState().descriptorDraft;
                let descriptor: any;
                if (draftDesc) {
                    descriptor = draftDesc;
                } else {
                    const descRes = await client.getModelDescriptor();
                    descriptor = (descRes as any)?.descriptor ?? descRes;
                    if (!descriptor || descriptor instanceof Error) {
                        return { error: "Could not load descriptor to validate" };
                    }
                }
                const res = await client.validateModelDescriptor(descriptor);
                return truncateJson(res, 8000) as Record<string, unknown>;
            }

            case "save_model": {
                const client = requireClient();

                const draftDesc = useProjectStore.getState().descriptorDraft;
                let descriptor: any;
                if (draftDesc) {
                    descriptor = draftDesc;
                } else {
                    const descRes = await client.getModelDescriptor();
                    descriptor = (descRes as any)?.descriptor ?? descRes;
                    if (!descriptor || descriptor instanceof Error) {
                        return { error: "Could not load descriptor to save" };
                    }
                }
                const res = await client.saveModelDescriptor({
                    descriptor,
                    viewMode: "summary",
                });
                if (res && !(res instanceof Error) && (res as any).success !== false) {
                    publishSavedModelGraph({
                        graph: (res as any).graph,
                        descriptor: (res as any).descriptor ?? descriptor,
                    });
                    notifyModelEdited({
                        descriptor: (res as any).descriptor ?? descriptor,
                        graph: (res as any).graph,
                        shapes: (res as any).shapes,
                    });
                }
                return summarizeEditResult(res) as Record<string, unknown>;
            }

            case "undo_model_edit": {
                const client = requireClient();
                const res = await client.undo({ viewMode: "summary" });
                publishEditSideEffects(res);
                return summarizeEditResult(res) as Record<string, unknown>;
            }

            case "redo_model_edit": {
                const client = requireClient();
                const res = await client.redo({ viewMode: "summary" });
                publishEditSideEffects(res);
                return summarizeEditResult(res) as Record<string, unknown>;
            }

            case "open_dashboard_panel": {
                const component = String(args.component);
                if (component === "Settings") {
                    return {
                        opened: false,
                        error:
                            "Settings is a page at /settings, not a dashboard panel. Ask the user to open it from Home → profile menu.",
                    };
                }
                return openPanel(
                    component,
                    args.id ? String(args.id) : undefined,
                    args.title ? String(args.title) : undefined,
                );
            }

            case "list_open_panels": {
                const api = useDockviewStore.getState().api;
                if (!api) return { panels: [], error: "Window manager not ready" };
                return {
                    panels: api.panels.map((p) => ({
                        id: p.id,
                        title: p.title,
                        active: p.api.isActive,
                    })),
                };
            }

            case "refresh_project": {
                const client = requireClient();
                const active = await client.getProject();
                if (!active || active instanceof Error || !(active as any).projectData) {
                    return {
                        error:
                            active instanceof Error
                                ? active.message
                                : "No project returned from agent",
                    };
                }
                useProjectStore.getState().hydrateFromProject(active);
                return {
                    ok: true,
                    projectData: (active as any).projectData,
                };
            }

            case "start_optimization": {
                const client = requireClient();
                const inputFeatures = Array.isArray(args.inputFeatures)
                    ? args.inputFeatures.map(String)
                    : [];
                const targetFeature = String(args.targetFeature || "");
                if (!inputFeatures.length || !targetFeature) {
                    return { error: "inputFeatures and targetFeature are required" };
                }
                if (optimizationRunning) {
                    return { error: "An optimization run is already in progress" };
                }

                const prefs = usePrefsStore.getState();
                const epochs = Number(args.epochs) || prefs.optEpochs || 10;
                const generations = Number(args.generations) || prefs.optGenerations || 5;
                const problemType = String(args.problemType || "regression");
                const strategy = String(args.strategy || "neat");
                const encoding = String(args.encoding || "none");
                const modelFilepath = args.modelFilepath
                    ? String(args.modelFilepath)
                    : useProjectStore.getState().project?.projectData?.modelFile;

                useProjectStore.getState().beginOptimizationRun();
                optimizationRunning = true;
                if (optimizationCleanup) {
                    optimizationCleanup();
                    optimizationCleanup = null;
                }

                void (async () => {
                    const endCon = await client.StatusUpdate((event: any) => {
                        try {
                            const parsed = JSON.parse(event.data) as ProgressUpdate;
                            useProjectStore.getState().appendOptimizationUpdate(parsed);
                        } catch {
                            /* ignore */
                        }
                    });
                    optimizationCleanup = endCon;
                    try {
                        const response = await client.OptimizationRequest(
                            {
                                inputFeatures,
                                targetFeature,
                                epochs,
                                strategy: strategy as any,
                                encoding: encoding as any,
                                generations,
                                problemType,
                            },
                            modelFilepath,
                        );
                        if (response instanceof Error) {
                            useProjectStore.getState().setOptimizationResult({
                                runError: response.message,
                            });
                        } else if (response?.error || response?.result?.error) {
                            useProjectStore.getState().setOptimizationResult({
                                runError: String(
                                    response?.result?.error || response?.error || "Optimization failed",
                                ),
                            });
                        } else {
                            useProjectStore.getState().setOptimizationResult({
                                result: (response?.result ?? response) as any,
                                runError: null,
                            });
                            useProjectStore.getState().clearVisualisation("optimized_pt2");
                            useProjectStore.getState().clearVisualisation("optimized_onnx");
                        }
                    } catch (e) {
                        useProjectStore.getState().setOptimizationResult({
                            runError: safeError(e),
                        });
                    } finally {
                        endCon();
                        if (optimizationCleanup === endCon) optimizationCleanup = null;
                        optimizationRunning = false;
                    }
                })();

                return {
                    started: true,
                    message: "Optimization started. Use get_optimization_status to poll.",
                    epochs,
                    generations,
                    problemType,
                    strategy,
                    encoding,
                };
            }

            case "stop_optimization": {
                if (!optimizationRunning && !optimizationCleanup) {
                    return { error: "No optimization run is active in this session" };
                }
                if (optimizationCleanup) {
                    optimizationCleanup();
                    optimizationCleanup = null;
                }
                optimizationRunning = false;
                useProjectStore.getState().setOptimizationResult({
                    runError: "Optimization stopped by assistant/user.",
                });
                return {
                    stopped: true,
                    note: "SSE status subscription closed. The agent HTTP optimize call may still finish on the server if it does not support cancel.",
                };
            }

            case "get_column_stats": {
                const csv = useProjectStore.getState().csv;
                if (!csv) return { error: "No CSV loaded" };
                const { columns, rows } = csvColumnsAndRows(csv);
                if (!columns.length) return { error: "Could not infer CSV columns" };
                const filter = Array.isArray(args.columns)
                    ? args.columns.map(String)
                    : undefined;
                const maxColumns = Number(args.maxColumns) || 40;
                return {
                    columnCount: columns.length,
                    rowSampleSize: rows.length,
                    stats: columnStats(columns, rows, filter).slice(0, maxColumns),
                };
            }

            case "suggest_features_targets": {
                const csv = useProjectStore.getState().csv;
                if (!csv) return { error: "No CSV loaded" };
                const { columns, rows } = csvColumnsAndRows(csv);
                if (!columns.length) return { error: "Could not infer CSV columns" };
                const stats = columnStats(columns, rows);
                const targetHints = /label|target|y$|class|outcome|result|score/i;
                const idHints = /^id$|_id$|uuid|index/i;
                const target =
                    stats.find((s) => targetHints.test(s.column))?.column ||
                    stats.filter((s) => s.dtype === "number").at(-1)?.column ||
                    columns[columns.length - 1];
                const features = columns.filter(
                    (c) => c !== target && !idHints.test(c),
                );
                return {
                    suggestedTarget: target,
                    suggestedFeatures: features,
                    rationale:
                        "Target chosen by name heuristics or last numeric column; features exclude ids/target.",
                };
            }

            case "get_visualiser_selection": {
                const ws = useWorkspaceStore.getState();
                const panelId = ws.inspectablePanelId;
                const ctx = panelId ? ws.panelContexts[panelId] : null;
                const selected = ctx?.selected ?? null;
                if (!selected && !panelId) {
                    return {
                        available: false,
                        message: "No Visualiser selection in the workspace store.",
                    };
                }
                return truncateJson(
                    {
                        available: Boolean(selected),
                        panelId,
                        selected,
                        visualisationHint: ctx?.visualisation
                            ? { hasGraph: true }
                            : null,
                    },
                    8000,
                ) as Record<string, unknown>;
            }

            default:
                return { error: `Unknown tool: ${name}` };
        }
    } catch (e) {
        return { error: safeError(e) };
    }
}
