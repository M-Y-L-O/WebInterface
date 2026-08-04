"use client";

import { notifyModelEdited } from "@/lib/ai/modelSync";
import {
    safeError,
    summarizeCsv,
    summarizeDescriptor,
    summarizeEditResult,
    truncateJson,
} from "@/lib/ai/projectContext";
import type { AiFunctionCall } from "@/lib/ai/types";
import { publishSavedModelGraph } from "@/lib/windows/Actions";
import { useClientStore, useDockviewStore, useProjectStore } from "@/lib/store";
import { getPrimaryVisualisation } from "@/lib/store/projectStore";

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
                const operation = String(args.operation || "");
                if (!operation) return { error: "operation is required" };

                const draftDesc = useProjectStore.getState().descriptorDraft;

                const res = await client.editModel({
                    operation,
                    payload: args.payload || {},
                    persist: Boolean(args.persist),
                    viewMode: "summary",
                    ...(draftDesc ? { descriptor: draftDesc } : {}),
                });
                publishEditSideEffects(res);
                return summarizeEditResult(res) as Record<string, unknown>;
            }

            case "preview_edit": {
                const client = requireClient();
                const operation = String(args.operation || "");
                if (!operation) return { error: "operation is required" };

                const draftDesc = useProjectStore.getState().descriptorDraft;

                const res = await client.previewEdit({
                    operation,
                    payload: args.payload || {},
                    viewMode: "summary",
                    ...(draftDesc ? { descriptor: draftDesc } : {}),
                });
                publishEditSideEffects(res);
                return summarizeEditResult(res) as Record<string, unknown>;
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
                return openPanel(
                    String(args.component),
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

            default:
                return { error: `Unknown tool: ${name}` };
        }
    } catch (e) {
        return { error: safeError(e) };
    }
}
