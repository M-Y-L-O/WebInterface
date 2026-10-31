"use client";

import { IDockviewPanelProps } from "dockview-core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
    Background,
    Connection,
    Controls,
    Edge,
    MiniMap,
    Node,
    OnSelectionChangeParams,
    ReactFlow,
    useEdgesState,
    useNodesState,
    useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { onModelEdited } from "@/lib/ai/modelSync";
import { useClientStore } from "@/lib/store";
import { useProjectStore } from "@/lib/store";
import { useInspectablePanel } from "@/lib/windows/useInspectablePanel";
import { layoutElements } from "@/lib/windows/visualiserHelpers";
import { publishSavedModelGraph } from "@/lib/windows/Actions";

import { Catalog, ParamField, ParamFieldType, ViewMode } from "./types";
import {
    blueprintToFields,
    buildReactFlow,
    countIoRoles,
    ioRoleOf,
    catalogDefaultParams,
    connectionGuard,
    defaultEmptyDescriptor,
    fieldsToParams,
    paramsToFields,
    templateFieldsForType,
} from "./helpers";
import { blockAction, disabledReason, noteAction, whyBlocked } from "./actionBlock";
import ModelContextMenu from "./ModelContextMenu";
import NodeSettingsPanel from "./NodeSettingsPanel";
import PortedNode from "./PortedNode";
import Style from "./ModelEditor.module.css";
import {usePrefsStore} from "@/lib/settings/prefsStore";

// Register custom node types once outside the component (stable reference)
const NODE_TYPES = { portedNode: PortedNode };

// ---------------------------------------------------------------------------
// Typed API error codes
// ---------------------------------------------------------------------------
type ApiErrorCode =
    | "DUPLICATE_NODE_ID"
    | "NODE_NOT_FOUND"
    | "MISSING_ARGUMENT"
    | "INVALID_ARGUMENT"
    | "PORT_NOT_FOUND"
    | "COMPATIBILITY_VIOLATION"
    | "DUPLICATE_EDGE"
    | "CYCLE_DETECTED"
    | "DISCONNECTED_GRAPH"
    | "INCOMPATIBLE_SHAPES"
    | "NO_UNDO_HISTORY"
    | "NO_REDO_HISTORY"
    | "DETAILED_VIEW_FAILED"
    | "OPERATION_FAILED";

// ---------------------------------------------------------------------------
// ModelEditorInner
// ---------------------------------------------------------------------------

export default function ModelEditorInner(props: IDockviewPanelProps) {
    const client = useClientStore((state) => state.client);
    const { setSelected, setVisualisation } = useInspectablePanel(props.api);
    const { screenToFlowPosition, fitView } = useReactFlow();

    const panelParams = (props as any).params || {};
    const initialDescriptor = panelParams.descriptor;
    const fileName = panelParams.fileName || panelParams.file || panelParams.path || "";

    // --- Core state ---
    const [descriptor, setDescriptor] = useState<any>(initialDescriptor || null);
    const descriptorRef = useRef<any>(initialDescriptor || null);
    const panelDescriptorSyncedRef = useRef(false);
    const setDescriptorState = useCallback((next: any) => {
        descriptorRef.current = next;
        setDescriptor(next);
    }, []);
    const [catalog, setCatalog] = useState<Catalog | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("summary");
    const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
    const [shapes, setShapes] = useState<Record<string, any>>({});
    /** Soft shape / contract warnings from the agent (descriptor can still be structurally valid). */
    const [descriptorWarnings, setDescriptorWarnings] = useState<string[]>([]);

    // ReactFlow state
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Selection
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<{ from: string; to: string } | null>(null);
    // Refs so async renderGraph can preserve selection across preview/edit rebuilds
    const selectedNodeIdRef = useRef<string | null>(null);
    const selectedEdgeRef = useRef<{ from: string; to: string } | null>(null);
    selectedNodeIdRef.current = selectedNodeId;
    selectedEdgeRef.current = selectedEdge;

    // Node settings draft
    const [nodeTypeDraft, setNodeTypeDraft] = useState<string>("Linear");
    const [nodeIdDraft, setNodeIdDraft] = useState<string>("");
    const [nodeParamFields, setNodeParamFields] = useState<ParamField[]>([]);
    // Prevent live preview / normalize responses from overwriting in-progress edits
    const paramsDraftDirtyRef = useRef(false);
    const [quickAddType, setQuickAddType] = useState<string>("Linear");

    // Undo/redo availability — driven by agent history flags, not optimistic defaults
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const [busy, setBusy] = useState(false);
    const lastGraphRef = useRef<any>(null);
    // Keep latest RF nodes for position preservation across edit/preview rebuilds
    const nodesRef = useRef<Node[]>([]);
    nodesRef.current = nodes;
    /** Positions for nodes about to be added (e.g. context-menu click). Consumed by renderGraph. */
    const pendingPositionsRef = useRef<Record<string, { x: number; y: number }>>({});

    // ---------------------------------------------------------------------------
    // Keep the global descriptorDraft in sync with every local descriptor change
    // so the AI agent always sees the current unsaved state.
    // ---------------------------------------------------------------------------
    const setDescriptorDraft = useProjectStore((s) => s.setDescriptorDraft);
    const clearDescriptorDraft = useProjectStore((s) => s.clearDescriptorDraft);

    useEffect(() => {
        setDescriptorDraft(descriptor);
    }, [descriptor, setDescriptorDraft]);

    // When the panel is reopened with updated params, reload from the agent.
    useEffect(() => {
        if (!client) {
            noteAction("syncPanelDescriptor", "Skipped — no MYLO agent connected");
            return;
        }
        const panelDescriptor = (props as any).params?.descriptor;
        if (!panelDescriptor) {
            noteAction("syncPanelDescriptor", "Skipped — panel has no descriptor param");
            return;
        }

        if (!panelDescriptorSyncedRef.current) {
            panelDescriptorSyncedRef.current = true;
            noteAction("syncPanelDescriptor", "Skipped first sync (initial mount gate)");
            return;
        }

        void (async () => {
            try {
                const descRes = await client.getModelDescriptor();
                if (!descRes || descRes instanceof Error || !(descRes as any)?.descriptor) {
                    blockAction("syncPanelDescriptor", "getModelDescriptor returned no usable descriptor", {
                        isError: descRes instanceof Error,
                        response: descRes instanceof Error ? descRes.message : descRes,
                    });
                    return;
                }
                const nextDescriptor = (descRes as any).descriptor;
                setDescriptorState(nextDescriptor);
                const graphRes = await client.visualizeModel({
                    descriptor: nextDescriptor,
                    viewMode,
                    expandedNodes,
                });
                if (!(graphRes instanceof Error) && !(graphRes as any)?.error) {
                    syncDescriptorWarnings(graphRes);
                    await renderGraph(graphRes, { relayout: true });
                } else {
                    blockAction("syncPanelDescriptor", "visualizeModel failed during panel sync", {
                        error: (graphRes as any)?.error ?? (graphRes instanceof Error ? graphRes.message : graphRes),
                    });
                }
            } catch (e: any) {
                // Reload errors on param refresh stay non-fatal for the UI
                blockAction("syncPanelDescriptor", "Reload threw — ignored so panel stays usable", {
                    error: e?.message || String(e),
                });
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [(props as any).params?.descriptor, client]);

    // Clear draft when the editor panel is unmounted.
    useEffect(() => {
        return () => { clearDescriptorDraft(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        clientX: number;
        clientY: number;
    } | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);

    // ---------------------------------------------------------------------------
    // Derived catalog data
    // ---------------------------------------------------------------------------
    const insertableTypes = useMemo<string[]>(
        () => {
            if (catalog?.nodeGroups) {
                return Object.values(catalog.nodeGroups).flat();
            }
            return (catalog?.insertableTypes || ["Linear", "ReLU", "Dropout"]) as string[];
        },
        [catalog]
    );

    const swappableActivations = useMemo<string[]>(
        () => (catalog?.swappableActivations || []) as string[],
        [catalog]
    );

    const filteredTypes = useMemo<string[]>(() => {
        if (!searchQuery) return insertableTypes;
        return insertableTypes.filter((t) =>
            t.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [insertableTypes, searchQuery]);

    // ---------------------------------------------------------------------------
    // Graph rendering
    // ---------------------------------------------------------------------------
    async function renderGraph(graph: any, opts?: { relayout?: boolean }, ctlg? : Catalog) {
        lastGraphRef.current = graph;
        const { nodes: rfNodes, edges: rfEdges } = buildReactFlow(graph, ctlg ? ctlg: catalog);

        const prevById = new Map(nodesRef.current.map((n) => [String(n.id), n]));
        const pending = pendingPositionsRef.current;
        pendingPositionsRef.current = {};

        const shouldRelayout = Boolean(opts?.relayout) || prevById.size === 0;
        let positioned: any[];
        if (shouldRelayout) {
            positioned = await layoutElements(rfNodes, rfEdges, false);
            // Honour explicit placements (e.g. context-menu add) even after a full layout
            positioned = positioned.map((n: any) => {
                const forced = pending[String(n.id)];
                return forced ? { ...n, position: forced } : n;
            });
        } else {
            positioned = rfNodes.map((n) => {
                const id = String(n.id);
                const forced = pending[id];
                if (forced) return { ...n, position: forced };

                const prev = prevById.get(id);
                if (prev) {
                    return {
                        ...n,
                        position: prev.position,
                        width: prev.width,
                        height: prev.height,
                    };
                }

                // New node without a pending position — drop near selection / graph center
                const anchorId = selectedNodeIdRef.current;
                const anchor = anchorId ? prevById.get(String(anchorId)) : undefined;
                const base = anchor?.position ?? { x: 240, y: 120 };
                return {
                    ...n,
                    position: { x: base.x + 200, y: base.y },
                };
            });
        }

        // Replacing nodes clears React Flow selection unless we carry it forward.
        // Without this, live param preview closes the settings panel mid-edit.
        const keepNodeId = selectedNodeIdRef.current;
        const keepEdge = selectedEdgeRef.current;
        const nextNodes = positioned.map((n: any) => ({
            ...n,
            selected: keepNodeId != null && String(n.id) === String(keepNodeId),
        }));
        const nextEdges = rfEdges.map((e: any) => ({
            ...e,
            selected:
                !!keepEdge &&
                String(e.source) === keepEdge.from &&
                String(e.target) === keepEdge.to,
        }));

        // @ts-ignore
        setNodes(nextNodes);
        // @ts-ignore
        setEdges(nextEdges);
        setVisualisation(graph);

        // Clear selection only when the selected node was actually removed
        if (keepNodeId && !nextNodes.some((n: any) => String(n.id) === String(keepNodeId))) {
            setSelectedNodeId(null);
            selectedNodeIdRef.current = null;
            setSelected(null);
        }
    }

    // ---------------------------------------------------------------------------
    // Initial load
    // ---------------------------------------------------------------------------
    async function loadInitial() {
        if (!client) {
            noteAction("loadInitial", "No agent connected — showing empty local descriptor");
            setDescriptorState(defaultEmptyDescriptor());
            await renderGraph({ nodes: [], edges: [], summary: {} }, { relayout: true });
            return;
        }

        setBusy(true);
        try {
            const [catRes, descRes] = await Promise.all([
                client.getEditorCatalog(),
                client.getModelDescriptor(),
            ]);
            let cat = null;
            if (catRes && !(catRes instanceof Error)) {
                cat = catRes as Catalog;
                setCatalog(cat);
                // Seed the quick-add type from the first insertable type
                const firstType =
                    cat.nodeGroups
                        ? Object.values(cat.nodeGroups).flat()[0]
                        : cat.insertableTypes?.[0];
                if (firstType) {
                    setNodeTypeDraft(firstType);
                    setQuickAddType(firstType);
                }
            }

            const desc =
                (descRes as any)?.descriptor || defaultEmptyDescriptor();
            setDescriptorState(desc);

            const graphRes = await client.visualizeModel({
                descriptor: desc,
                viewMode,
                expandedNodes,
            });
            if (graphRes instanceof Error || (graphRes as any)?.error) {
                throw new Error(
                    (graphRes as any)?.error || "Failed to visualize descriptor"
                );
            }
            syncDescriptorWarnings(graphRes);
            await renderGraph(graphRes, { relayout: true }, cat);
            // Fresh open — don't inherit optimistic undo affordances from a prior session
            setCanUndo(Boolean((descRes as any)?.canUndo));
            setCanRedo(Boolean((descRes as any)?.canRedo));
        } catch (e: any) {
            toast.error("Failed to load model editor", {
                description: e?.message || "Unknown error",
            });
            const fallback = defaultEmptyDescriptor();
            setDescriptorState(fallback);
            setCanUndo(false);
            setCanRedo(false);
            setDescriptorWarnings([]);
            if (client) {
                const graphRes = await client.visualizeModel({
                    descriptor: fallback,
                    viewMode,
                    expandedNodes,
                });
                if (!(graphRes instanceof Error) && !(graphRes as any)?.error) {
                    syncDescriptorWarnings(graphRes);
                    await renderGraph(graphRes, { relayout: true });
                }
            }
        } finally {
            setBusy(false);
        }
    }

    useEffect(() => {
        loadInitial();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client]);

    // Keep the canvas in sync when the AI assistant mutates the model via tools.
    useEffect(() => {
        return onModelEdited((detail) => {
            if (detail.descriptor) setDescriptorState(detail.descriptor);
            if (detail.shapes) setShapes(detail.shapes as Record<string, any>);
            if (detail.graph) {
                void renderGraph(detail.graph);
            }
            if (typeof (detail as any).canUndo === "boolean") {
                setCanUndo((detail as any).canUndo);
            } else {
                setCanUndo(true);
            }
            if (typeof (detail as any).canRedo === "boolean") {
                setCanRedo((detail as any).canRedo);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catalog, viewMode, expandedNodes]);

    // ---------------------------------------------------------------------------
    // Typed error dispatch
    // ---------------------------------------------------------------------------
    function parseApiFailure(res: unknown, fallback = "Operation failed"): { code?: string; message: string } {
        if (res instanceof Error) {
            const cause = (res as Error & { cause?: unknown }).cause;
            const causeMsg =
                cause instanceof Error
                    ? cause.message
                    : typeof cause === "string"
                      ? cause
                      : undefined;
            return { message: res.message || causeMsg || fallback };
        }
        const raw = (res as any)?.error;
        if (typeof raw === "string" && raw.trim()) {
            return { message: raw };
        }
        if (raw && typeof raw === "object") {
            return {
                code: raw.code,
                message: raw.message || fallback,
            };
        }
        if (typeof (res as any)?.message === "string" && (res as any).message.trim()) {
            return { message: (res as any).message };
        }
        return { message: fallback };
    }

    function syncHistoryFlags(res: any) {
        if (typeof res?.canUndo === "boolean") setCanUndo(res.canUndo);
        if (typeof res?.canRedo === "boolean") setCanRedo(res.canRedo);
    }

    function syncDescriptorWarnings(res: any) {
        const fromRes = Array.isArray(res?.warnings) ? res.warnings : null;
        const fromGraph = Array.isArray(res?.graph?.warnings) ? res.graph.warnings : null;
        const next = (fromRes ?? fromGraph ?? []).filter(
            (w: unknown): w is string => typeof w === "string" && w.trim().length > 0,
        );
        setDescriptorWarnings(next);
        if (res?.shapes && typeof res.shapes === "object") setShapes(res.shapes);
        else if (res?.graph?.shapes && typeof res.graph.shapes === "object") {
            setShapes(res.graph.shapes);
        }
    }

    function handleApiError(code: ApiErrorCode | string | undefined, message: string, toastId?: string | number, res?: any) {
        const opts = { id: toastId, description: message };
        blockAction("apiError", message || "Operation failed", { code });
        syncHistoryFlags(res);
        switch (code as ApiErrorCode) {
            case "NO_UNDO_HISTORY":
                setCanUndo(false);
                toast.error("Nothing to undo", opts);
                return;
            case "NO_REDO_HISTORY":
                setCanRedo(false);
                toast.error("Nothing to redo", opts);
                return;
            case "DETAILED_VIEW_FAILED":
                toast.error("Detailed view failed — shape mismatch", {
                    id: toastId,
                    description: message || "Try Hybrid view or fix node dimensions first.",
                });
                return;
            case "INCOMPATIBLE_SHAPES":
                toast.warning("Shape warning", opts);
                if (message) {
                    setDescriptorWarnings((prev) =>
                        prev.includes(message) ? prev : [...prev, message],
                    );
                }
                return;
            case "CYCLE_DETECTED":
                toast.error("Cycle detected — connection creates a loop", opts);
                return;
            case "DUPLICATE_NODE_ID":
                toast.error("Node ID already in use", opts);
                return;
            case "NODE_NOT_FOUND":
                toast.error("Node not found — refreshing canvas", opts);
                if (client) loadInitial();
                return;
            case "PORT_NOT_FOUND":
                toast.error("Port not found", opts);
                return;
            case "DISCONNECTED_GRAPH":
                toast.warning("Graph disconnected — some nodes are unreachable", opts);
                break;
            default:
                toast.error("Operation failed", opts);
        }
    }

    // ---------------------------------------------------------------------------
    // Apply edit (persisted)
    // ---------------------------------------------------------------------------
    async function applyEdit(
        operation: string,
        payload: any,
        persist = false,
        expandedOverride?: string[],
    ) {
        if (whyBlocked("applyEdit", [
            { when: !client, reason: "No MYLO agent connected", details: { operation, persist } },
        ])) return;
        if(!client) return;
        setBusy(true);
        const toastId = toast.loading("Applying…");
        const currentDescriptor = descriptorRef.current;
        try {
            const res = await client.editModel({
                descriptor: currentDescriptor,
                operation,
                payload,
                persist,
                viewMode,
                expandedNodes: expandedOverride ?? expandedNodes,
            });

            if (!res || res instanceof Error || (res as any)?.success === false) {
                const { code, message } = parseApiFailure(res, "Edit failed");
                handleApiError(code, message, toastId, res);
                return;
            }

            // Accept server-normalized params after a persisted edit
            paramsDraftDirtyRef.current = false;
            if ((res as any)?.descriptor) setDescriptorState((res as any).descriptor);
            if ((res as any)?.graph) await renderGraph((res as any).graph);
            syncDescriptorWarnings(res);
            syncHistoryFlags(res);

            // toast.success((res as any)?.message || "Done", {
            //     id: toastId,
            //     duration: 2000,
            // });
            toast.dismiss(toastId);
        } catch (e: any) {
            toast.error("Edit failed", {
                id: toastId,
                description: e?.message || "Unknown error",
            });
        } finally {
            setBusy(false);
        }
    }

    // ---------------------------------------------------------------------------
    // Preview edit (optimistic, not persisted) — called from debounce
    // ---------------------------------------------------------------------------
    async function previewParams(params: Record<string, any>) {
        const nodeId = selectedNodeId;
        if (whyBlocked("previewParams", [
            { when: !client, reason: "No MYLO agent connected" },
            { when: !nodeId, reason: "No node selected for live preview" },
        ]) || !client || !nodeId) return;
        try {
            const { payload, expandedNodes: nextExpanded } = buildUpdateNodePayload(
                nodeId,
                nodeTypeDraft,
                params,
            );
            const res = await client.previewEdit({
                descriptor: descriptorRef.current,
                operation: "update_node",
                payload,
                viewMode,
                expandedNodes: nextExpanded,
            });

            if (!res || res instanceof Error || (res as any)?.success === false) {
                const { code, message } = parseApiFailure(res, "Preview failed");
                // Keep UI silent — preview is best-effort — but log why
                blockAction("previewParams", message, { code, nodeId });
                return;
            }

            if ((res as any)?.descriptor) setDescriptorState((res as any).descriptor);
            if ((res as any)?.graph) await renderGraph((res as any).graph);
            syncDescriptorWarnings(res);
        } catch (e: any) {
            blockAction("previewParams", "Preview threw — UI stays silent", {
                error: e?.message || String(e),
                nodeId,
            });
        }
    }

    // ---------------------------------------------------------------------------
    // Undo / Redo
    // ---------------------------------------------------------------------------
    async function handleUndo() {
        if (whyBlocked("undo", [
            { when: !client, reason: "No MYLO agent connected" },
            { when: !canUndo, reason: "Undo history is empty (canUndo=false)" },
            { when: busy, reason: "Editor is busy with another operation" },
        ])) return;
        if(!client) return;
        setBusy(true);
        const toastId = toast.loading("Undoing…");
        try {
            const res = await client.undo({ viewMode, expandedNodes });
            if (!res || res instanceof Error || (res as any)?.success === false) {
                const { code, message } = parseApiFailure(res, "Undo failed");
                handleApiError(code, message, toastId, res);
                return;
            }
            paramsDraftDirtyRef.current = false;
            if ((res as any)?.descriptor) setDescriptorState((res as any).descriptor);
            if ((res as any)?.graph) await renderGraph((res as any).graph);
            syncDescriptorWarnings(res);
            syncHistoryFlags(res);
            toast.info("Undone", { id: toastId, duration: 1500 });
        } catch (e: any) {
            toast.error("Undo failed", { id: toastId, description: e?.message });
        } finally {
            setBusy(false);
        }
    }

    async function handleRedo() {
        if (whyBlocked("redo", [
            { when: !client, reason: "No MYLO agent connected" },
            { when: !canRedo, reason: "Redo history is empty (canRedo=false)" },
            { when: busy, reason: "Editor is busy with another operation" },
        ])) return;
        if(!client) return;
        setBusy(true);
        const toastId = toast.loading("Redoing…");
        try {
            const res = await client.redo({ viewMode, expandedNodes });
            if (!res || res instanceof Error || (res as any)?.success === false) {
                const { code, message } = parseApiFailure(res, "Redo failed");
                handleApiError(code, message, toastId, res);
                return;
            }
            paramsDraftDirtyRef.current = false;
            if ((res as any)?.descriptor) setDescriptorState((res as any).descriptor);
            if ((res as any)?.graph) await renderGraph((res as any).graph);
            syncDescriptorWarnings(res);
            syncHistoryFlags(res);
            toast.info("Redone", { id: toastId, duration: 1500 });
        } catch (e: any) {
            toast.error("Redo failed", { id: toastId, description: e?.message });
        } finally {
            setBusy(false);
        }
    }

    // Keyboard shortcuts
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            const isInput =
                (e.target as HTMLElement)?.tagName === "INPUT" ||
                (e.target as HTMLElement)?.tagName === "TEXTAREA" ||
                (e.target as HTMLElement)?.isContentEditable;
            const wantsUndo =
                (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z";
            const wantsRedo =
                ((e.ctrlKey || e.metaKey) && e.key === "y") ||
                ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z");
            if (!wantsUndo && !wantsRedo) return;
            if (isInput) {
                noteAction(
                    wantsUndo ? "undo" : "redo",
                    "Shortcut ignored — focus is in a text field",
                );
                return;
            }

            if (wantsUndo) {
                e.preventDefault();
                void handleUndo();
            } else {
                e.preventDefault();
                void handleRedo();
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, canUndo, canRedo, viewMode, expandedNodes]);

    // ---------------------------------------------------------------------------
    // Save / Validate
    // ---------------------------------------------------------------------------
    async function saveDescriptor() {
        if (whyBlocked("save", [
            { when: !client, reason: "No MYLO agent connected" },
            { when: busy, reason: "Editor is busy with another operation" },
        ])) return;
        if(!client) return;
        setBusy(true);
        const toastId = toast.loading("Saving…");
        try {
            const res = await client.saveModelDescriptor({
                descriptor: descriptorRef.current,
                viewMode,
                expandedNodes,
            });
            if (!res || res instanceof Error || (res as any)?.success === false) {
                throw new Error((res as any)?.error?.message || "Save failed");
            }
            if ((res as any)?.descriptor) setDescriptorState((res as any).descriptor);
            if ((res as any)?.graph) await renderGraph((res as any).graph);
            syncDescriptorWarnings(res);
            syncHistoryFlags(res);

            // Propagate saved model to project store + open Visualiser panels
            publishSavedModelGraph({
                graph: (res as any)?.graph,
                descriptor: (res as any)?.descriptor ?? descriptor,
                filePath: panelParams.filePath,
                fileName: fileName || panelParams.fileName,
                sourcePanelId: props.api.id,
            });

            const saveWarnings = Array.isArray((res as any)?.warnings) ? (res as any).warnings : [];
            if (saveWarnings.length) {
                toast.warning("Saved with shape warnings", {
                    id: toastId,
                    description: saveWarnings[0],
                    duration: 5000,
                });
            } else {
                toast.success("Saved", { id: toastId, duration: 2000 });
            }
        } catch (e: any) {
            toast.error("Save failed", { id: toastId, description: e?.message });
        } finally {
            setBusy(false);
        }
    }

    async function validateDescriptor() {
        if (whyBlocked("validate", [
            { when: !client, reason: "No MYLO agent connected" },
            { when: busy, reason: "Editor is busy with another operation" },
        ])) return;
        if(!client) return;
        setBusy(true);
        const toastId = toast.loading("Validating…");
        try {
            // Strict so output-shape / param mismatches surface (same class of
            // errors that later fail export / Invalid PT2 descriptor).
            const res = await client.validateModelDescriptor(descriptorRef.current, {
                strict: true,
            });
            if (!res || res instanceof Error) throw new Error("Validation request failed");

            syncDescriptorWarnings(res);
            if ((res as any)?.shapes) setShapes((res as any).shapes);

            const err = (res as any)?.error;
            const errMessage =
                typeof err === "string"
                    ? err
                    : err?.message || (Array.isArray((res as any)?.warnings) ? (res as any).warnings[0] : null);

            if (!(res as any)?.valid) {
                throw new Error(errMessage || "Invalid descriptor");
            }

            if ((res as any)?.descriptor) {
                setDescriptorState((res as any).descriptor);
                const graphRes = await client.visualizeModel({
                    descriptor: (res as any).descriptor,
                    viewMode,
                    expandedNodes,
                });
                if (!(graphRes instanceof Error)) {
                    syncDescriptorWarnings(graphRes);
                    await renderGraph(graphRes);
                }
            }

            const warnings = Array.isArray((res as any)?.warnings) ? (res as any).warnings : [];
            if (warnings.length) {
                toast.warning("Descriptor has shape warnings", {
                    id: toastId,
                    description: warnings[0],
                    duration: 5000,
                });
            } else {
                toast.success("Descriptor valid", { id: toastId, duration: 2000 });
            }
        } catch (e: any) {
            toast.error("Descriptor invalid", {
                id: toastId,
                description: e?.message,
            });
        } finally {
            setBusy(false);
        }
    }

    // ---------------------------------------------------------------------------
    // View mode
    // ---------------------------------------------------------------------------
    async function toggleViewMode(next: ViewMode) {
        if (!client) {
            noteAction("toggleViewMode", "No agent — switching view locally only", { next });
            setViewMode(next);
            return;
        }
        setBusy(true);
        try {
            setViewMode(next);
            const graphRes = await client.visualizeModel({
                descriptor,
                viewMode: next,
                expandedNodes,
            });
            if (graphRes instanceof Error || (graphRes as any)?.error) {
                const code = (graphRes as any)?.error?.code;
                if (code === "DETAILED_VIEW_FAILED") {
                    toast.warning("Detailed view failed — switching to Hybrid", {
                        description: "Fix node dimensions or use Hybrid view.",
                    });
                    setViewMode("hybrid");
                    return;
                }
                throw new Error((graphRes as any)?.error || "Failed to render view");
            }
            syncDescriptorWarnings(graphRes);
            await renderGraph(graphRes, { relayout: true });
        } catch (e: any) {
            toast.error("Failed to change view", { description: e?.message });
        } finally {
            setBusy(false);
        }
    }

    async function AutoArangeGraph(){
        if (whyBlocked("autoArrange", [
            { when: !client, reason: "No MYLO agent connected" },
            { when: !lastGraphRef.current, reason: "No graph loaded yet to arrange" },
        ])) return;
        const graph = lastGraphRef.current;

        setBusy(true);
        try {
            await renderGraph(graph, { relayout: true });

            // Ensure the camera updates after node positions settle.
            requestAnimationFrame(() => {
                try {
                    fitView({ padding: 0.12, duration: 200 });
                } catch {
                    fitView({ padding: 0.12 });
                }
            });
        } catch (e: any) {
            toast.error("Auto-arrange failed", { description: e?.message });
        } finally {
            setBusy(false);
        }
    }

    // ---------------------------------------------------------------------------
    // Expand / Collapse
    // ---------------------------------------------------------------------------
    async function expandSelected() {
        const nodeId = selectedNodeId;
        if (whyBlocked("expandNode", [
            { when: !client, reason: "No MYLO agent connected" },
            { when: !nodeId, reason: "No node selected" },
            {
                when: nodeId === "input" || nodeId === "output",
                reason: "input/output nodes cannot be expanded",
                details: { selectedNodeId: nodeId },
            },
        ]) || !client || !nodeId) return;
        setBusy(true);
        try {
            const res = await client.expandModelNodes({
                descriptor,
                nodeIds: [nodeId],
                expandedNodes,
            });
            if (res instanceof Error || (res as any)?.error)
                throw new Error((res as any)?.error || "Expand failed");
            setExpandedNodes(
                (res as any)?.expandedNodes || [...expandedNodes, nodeId]
            );
            setViewMode("hybrid");
            await renderGraph(res, { relayout: true });
        } catch (e: any) {
            toast.error("Expand failed", { description: e?.message });
        } finally {
            setBusy(false);
        }
    }

    async function collapseSelected() {
        const nodeId = selectedNodeId;
        if (whyBlocked("collapseNode", [
            { when: !client, reason: "No MYLO agent connected" },
            { when: !nodeId, reason: "No node selected" },
            {
                when: nodeId === "input" || nodeId === "output",
                reason: "input/output nodes cannot be collapsed",
                details: { selectedNodeId: nodeId },
            },
        ]) || !client || !nodeId) return;
        setBusy(true);
        try {
            const res = await client.collapseModelNodes({
                descriptor,
                nodeIds: [nodeId],
                expandedNodes,
            });
            if (res instanceof Error || (res as any)?.error)
                throw new Error((res as any)?.error || "Collapse failed");
            setExpandedNodes(
                (res as any)?.expandedNodes ||
                expandedNodes.filter((id) => id !== nodeId)
            );
            setViewMode((res as any)?.viewMode || "summary");
            await renderGraph(res, { relayout: true });
        } catch (e: any) {
            toast.error("Collapse failed", { description: e?.message });
        } finally {
            setBusy(false);
        }
    }

    // ---------------------------------------------------------------------------
    // Selection change
    // ---------------------------------------------------------------------------
    function onSelectionChange(params: OnSelectionChangeParams) {
        const nextNodeId = params.nodes[0]?.id ?? null;
        const nextEdge = params.edges[0]
            ? {
                  from: String(params.edges[0].source),
                  to: String(params.edges[0].target),
              }
            : null;

        // Node selected — update panel
        if (nextNodeId) {
            if (nextNodeId !== selectedNodeId) setSelectedNodeId(nextNodeId);
            if (selectedEdge) setSelectedEdge(null);
            if (lastGraphRef.current?.nodes) {
                const raw = lastGraphRef.current.nodes.find(
                    (n: any) => String(n.id) === String(nextNodeId)
                );
                setSelected(raw || { id: nextNodeId });
            } else {
                setSelected({ id: nextNodeId });
            }
            return;
        }

        // Edge selected — clear node panel
        if (nextEdge) {
            if (selectedNodeId) setSelectedNodeId(null);
            const edgeChanged =
                !selectedEdge ||
                nextEdge.from !== selectedEdge.from ||
                nextEdge.to !== selectedEdge.to;
            if (edgeChanged) setSelectedEdge(nextEdge);
            if (lastGraphRef.current?.edges) {
                const raw = lastGraphRef.current.edges.find(
                    (e: any) =>
                        String(e.from) === nextEdge.from &&
                        String(e.to) === nextEdge.to
                );
                setSelected(raw || nextEdge);
            } else {
                setSelected(nextEdge);
            }
            return;
        }

    }

    function clearCanvasSelection() {
        setSelectedNodeId(null);
        setSelectedEdge(null);
        setSelected(null);

        // @ts-ignore
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));

        // @ts-ignore
        setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
    }

    // ---------------------------------------------------------------------------
    // Sync param fields when selected node changes (or descriptor loads).
    // Skip field rehydration while the user has unsaved draft edits — otherwise
    // live preview normalize (e.g. in_features=-1 from dynamic shapes) snaps the
    // inputs back mid-keystroke.
    // ---------------------------------------------------------------------------
    const prevSelectedNodeIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (!selectedNodeId || !descriptor) return;
        const node = (descriptor.nodes || []).find(
            (n: any) => String(n.id) === String(selectedNodeId)
        );
        if (!node) return;

        const selectionChanged = prevSelectedNodeIdRef.current !== selectedNodeId;
        prevSelectedNodeIdRef.current = selectedNodeId;
        if (selectionChanged) {
            paramsDraftDirtyRef.current = false;
        }

        setNodeIdDraft(String(node.id));
        const type = String(node.type || "Linear");
        setNodeTypeDraft(type);

        if (paramsDraftDirtyRef.current && !selectionChanged) {
            return;
        }

        // Prefer blueprint-driven fields, fall back to raw params
        const bp = catalog?.nodeParameterBlueprints?.[type];
        if (bp) {
            setNodeParamFields(blueprintToFields(bp, node.params || {}));
        } else {
            setNodeParamFields(paramsToFields(node.params || {}));
        }
    }, [selectedNodeId, descriptor, catalog]);

    // Seed param fields when type changes for a new unsaved draft
    useEffect(() => {
        if (nodeParamFields.length === 0) {
            const bp = catalog?.nodeParameterBlueprints?.[nodeTypeDraft];
            if (bp) {
                setNodeParamFields(blueprintToFields(bp));
            } else {
                const tmpl = templateFieldsForType(nodeTypeDraft);
                if (tmpl.length > 0) setNodeParamFields(tmpl);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodeTypeDraft]);

    // ---------------------------------------------------------------------------
    // Connection (onConnect) – with checkEdge validation
    // ---------------------------------------------------------------------------
    async function onConnect(connection: Connection) {
        if (whyBlocked("connect", [
            {
                when: !connection.source || !connection.target,
                reason: "Connection missing source or target handle",
                details: { source: connection.source, target: connection.target },
            },
        ])) return;
        const source = String(connection.source);
        const target = String(connection.target);
        const sourcePort = connection.sourceHandle ?? "output";
        const targetPort = connection.targetHandle ?? "input";

        const guard = connectionGuard(source, target);
        if (guard) {
            blockAction("connect", guard, { source, target, sourcePort, targetPort });
            toast.error(guard);
            return;
        }

        // Validate via checkEdge before committing
        if (client) {
            try {
                const check = await client.checkEdge({
                    source,
                    target,
                    sourcePort,
                    targetPort,
                    descriptor,
                });
                if (check && !(check instanceof Error) && (check as any)?.compatible === false) {
                    const err = check as any;
                    const reason = err.error || "Incompatible connection";
                    blockAction("connect", reason, {
                        source, target, sourcePort, targetPort,
                        code: err.code,
                        availablePorts: err.availablePorts,
                    });
                    toast.error(reason, {
                        description: err.availablePorts
                            ? `Available ports: ${err.availablePorts.join(", ")}`
                            : err.code,
                    });
                    return;
                }
                if ((check as any)?.warnings?.length) {
                    (check as any).warnings.forEach((w: string) => toast.warning(w));
                }
            } catch (e: any) {
                // checkEdge is best-effort — proceed anyway
                noteAction("connect", "checkEdge failed — proceeding with add_edge anyway", {
                    error: e?.message || String(e),
                    source, target, sourcePort, targetPort,
                });
            }
        } else {
            noteAction("connect", "No agent — skipping checkEdge, applyEdit will also be blocked");
        }

        await applyEdit(
            "add_edge",
            { source, target, sourcePort, targetPort },
            false
        );
    }

    // ---------------------------------------------------------------------------
    // Node add helpers
    // ---------------------------------------------------------------------------
    function nextNodeIdForType(type: string) {
        const base =
            (type || "node").replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase() || "node";
        const existing = new Set<string>(
            (descriptorRef.current?.nodes || []).map((n: any) => String(n.id))
        );
        let idx = 1;
        let candidate = `${base}_${idx}`;
        while (existing.has(candidate)) {
            idx += 1;
            candidate = `${base}_${idx}`;
        }
        return candidate;
    }

    /**
     * Build an update_node payload. When the type changes, also rename the node
     * so the canvas label (which is the node id) matches the new type.
     */
    function buildUpdateNodePayload(
        nodeId: string,
        type: string,
        params: Record<string, any>,
    ): { payload: Record<string, any>; expandedNodes: string[] } {
        const payload: Record<string, any> = { nodeId, type, params };
        let nextExpanded = expandedNodes;

        if (nodeId === "input" || nodeId === "output") {
            return { payload, expandedNodes: nextExpanded };
        }

        const current = (descriptorRef.current?.nodes || []).find(
            (n: any) => String(n.id) === String(nodeId),
        );
        const currentType = String(current?.type || "");
        if (!currentType || currentType === type) {
            return { payload, expandedNodes: nextExpanded };
        }

        const newNodeId = nextNodeIdForType(type);
        payload.newNodeId = newNodeId;

        const prev = nodesRef.current.find((n) => String(n.id) === String(nodeId));
        if (prev) {
            pendingPositionsRef.current[newNodeId] = {
                x: prev.position.x,
                y: prev.position.y,
            };
        }

        // Selection / expand lists must track the rename before renderGraph runs
        setSelectedNodeId(newNodeId);
        selectedNodeIdRef.current = newNodeId;
        if (expandedNodes.includes(nodeId)) {
            nextExpanded = expandedNodes.map((id) => (id === nodeId ? newNodeId : id));
            setExpandedNodes(nextExpanded);
        }

        return { payload, expandedNodes: nextExpanded };
    }

    function paramsForType(type: string): Record<string, any> {
        // Catalog nodeSchemas first, then legacy template fallback
        if (catalog?.nodeSchemas?.[type]) return catalog.nodeSchemas[type];
        return fieldsToParams(templateFieldsForType(type)).params || {};
    }

    async function quickAddNodeFromCanvas() {
        const params = paramsForType(quickAddType);
        const nodeId = nextNodeIdForType(quickAddType);
        const connectFrom = selectedNodeId || "input";
        const anchor = nodesRef.current.find((n) => String(n.id) === String(connectFrom));
        if (anchor) {
            pendingPositionsRef.current[nodeId] = {
                x: anchor.position.x + 200,
                y: anchor.position.y,
            };
        }
        await applyEdit(
            "add_node",
            { nodeId, type: quickAddType, params, connectFrom, connectTo: "output" },
            false
        );
    }

    async function addNodeAtPosition(type: string) {
        const menu = contextMenu;
        if (whyBlocked("addNodeAtPosition", [
            { when: !menu, reason: "Context menu closed — no drop position" },
        ]) || !menu) return;
        const flowPos = screenToFlowPosition({
            x: menu.clientX,
            y: menu.clientY,
        });
        const params = paramsForType(type);
        const nodeId = nextNodeIdForType(type);
        pendingPositionsRef.current[nodeId] = flowPos;
        await applyEdit("add_node", { nodeId, type, params }, false);
        setContextMenu(null);
        setSearchQuery("");
        setActiveIndex(0);
    }

    // ---------------------------------------------------------------------------
    // Delete handlers
    // ---------------------------------------------------------------------------
    // Single onDelete avoids a race where parallel onEdgesDelete + onNodesDelete
    // both edit from the same descriptor and the edge write can "win", leaving
    // an isolated node after the edges were stripped.
    async function onDelete({ nodes: deletedNodes, edges: deletedEdges }: { nodes: Node[]; edges: Edge[] }) {
        const deletedIds = new Set(deletedNodes.map((n) => String(n.id)));
        if (selectedNodeIdRef.current && deletedIds.has(String(selectedNodeIdRef.current))) {
            setSelectedNodeId(null);
            selectedNodeIdRef.current = null;
            setSelected(null);
        }

        // IO terminals stay until the last of each role — count against the
        // live canvas, then decrement as we accept deletes in this batch.
        const roleCounts = countIoRoles(
            nodesRef.current.map((n) => ({
                id: n.id,
                type: (n.data as any)?.nodeType,
                label: (n.data as any)?.label,
                data: n.data as any,
            })),
        );

        const removedNodeIds = new Set<string>();
        for (const node of deletedNodes) {
            const id = String(node.id);
            const role = ioRoleOf({
                id,
                type: (node.data as any)?.nodeType,
                label: (node.data as any)?.label,
                data: node.data as any,
            });
            if (role && roleCounts[role] <= 1) {
                blockAction(
                    "remove_node",
                    `Cannot remove the only ${role} node`,
                    { nodeId: id },
                );
                continue;
            }
            if (role) roleCounts[role] -= 1;
            removedNodeIds.add(id);
            // remove_node also strips incident edges on the agent
            await applyEdit("remove_node", { nodeId: id }, false);
        }

        for (const edge of deletedEdges) {
            const source = String(edge.source);
            const target = String(edge.target);
            // Already cleared by remove_node — skip so we don't race-restore the node
            if (removedNodeIds.has(source) || removedNodeIds.has(target)) continue;
            await applyEdit(
                "remove_edge",
                {
                    source,
                    target,
                    sourcePort: edge.sourceHandle ?? undefined,
                    targetPort: edge.targetHandle ?? undefined,
                },
                false
            );
        }
    }

    // ---------------------------------------------------------------------------
    // Manual param field management (fallback)
    // ---------------------------------------------------------------------------
    function addParamField() {
        paramsDraftDirtyRef.current = true;
        setNodeParamFields((prev) => [
            ...prev,
            { id: `${Date.now()}-${Math.random()}`, key: "", type: "string", value: "" },
        ]);
    }

    function updateParamField(id: string, patch: Partial<ParamField>) {
        paramsDraftDirtyRef.current = true;
        setNodeParamFields((prev) =>
            prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
        );
    }

    function removeParamField(id: string) {
        paramsDraftDirtyRef.current = true;
        setNodeParamFields((prev) => prev.filter((f) => f.id !== id));
    }

    function applyTemplate(overwrite = true) {
        const bp = catalog?.nodeParameterBlueprints?.[nodeTypeDraft];
        if (bp) {
            paramsDraftDirtyRef.current = true;
            setNodeParamFields(blueprintToFields(bp));
            return;
        }
        const template = templateFieldsForType(nodeTypeDraft);
        if (template.length === 0) {
            blockAction("applyTemplate", "No hardcoded template for this node type", {
                nodeType: nodeTypeDraft,
            });
            toast.message("No template for this type yet");
            return;
        }
        if (!overwrite && nodeParamFields.length > 0) {
            blockAction("applyTemplate", "Skipped — fields already set and overwrite=false", {
                nodeType: nodeTypeDraft,
                existingFieldCount: nodeParamFields.length,
            });
            return;
        }
        paramsDraftDirtyRef.current = true;
        setNodeParamFields(template);
    }

    // ---------------------------------------------------------------------------
    // Title
    // ---------------------------------------------------------------------------
    const title = fileName ? `Model Editor — ${fileName}` : "Model Editor";
    const prefs = usePrefsStore();
    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    return (
        <div className={Style.container}>
            {/* Toolbar */}
            <div className={Style.nav}>
                <div className="flex gap-2 overflow-hidden items-center">
                    {fileName && <span className="text-m opacity-60 truncate">{fileName}</span>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Undo / Redo */}
                    <button
                        onClick={handleUndo}
                        disabled={busy || !client || !canUndo}
                        title={disabledReason([
                            { when: !client, reason: "No MYLO agent connected" },
                            { when: busy, reason: "Editor is busy" },
                            { when: !canUndo, reason: "Nothing to undo" },
                        ]) || "Undo (Ctrl+Z)"}
                        className="opacity-70 hover:opacity-100 disabled:opacity-30 transition text-sm px-2"
                    >
                        ↩
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={busy || !client || !canRedo}
                        title={disabledReason([
                            { when: !client, reason: "No MYLO agent connected" },
                            { when: busy, reason: "Editor is busy" },
                            { when: !canRedo, reason: "Nothing to redo" },
                        ]) || "Redo (Ctrl+Y)"}
                        className="opacity-70 hover:opacity-100 disabled:opacity-30 transition text-sm px-2"
                    >
                        ↪
                    </button>

                    <div className="mx-1 h-5 w-px bg-[var(--light-highlight)]/90" />

                    {/* View mode */}
                    <h2>View:</h2>
                    <button
                        onClick={() => toggleViewMode("summary")}
                        disabled={busy}
                        className={viewMode === "summary" ? Style.active : ""}
                    >
                        Summary
                    </button>
                    <button
                        onClick={() => toggleViewMode("detailed")}
                        disabled={busy}
                        className={viewMode === "detailed" ? Style.active : ""}
                    >
                        Detailed
                    </button>
                    <button
                        onClick={() => toggleViewMode("hybrid")}
                        disabled={busy}
                        className={viewMode === "hybrid" ? Style.active : ""}
                    >
                        Hybrid
                    </button>
                    <button
                        onClick={() => void AutoArangeGraph()}
                        disabled={busy || !client}
                        title={disabledReason([
                            { when: !client, reason: "No MYLO agent connected" },
                            { when: busy, reason: "Editor is busy" },
                            { when: !lastGraphRef.current, reason: "No graph loaded yet" },
                        ]) || "Auto-Arrange nodes"}
                        className="opacity-70 hover:opacity-100 disabled:opacity-30 transition text-sm px-2"
                    >
                        <i className="fa-solid fa-arrows-rotate" />
                    </button>

                    <div className="mx-1 h-5 w-px bg-[var(--light-highlight)]/90" />

                    <button
                        onClick={validateDescriptor}
                        disabled={busy || !client}
                        title={disabledReason([
                            { when: !client, reason: "No MYLO agent connected" },
                            { when: busy, reason: "Editor is busy" },
                        ]) || "Validate descriptor"}
                    >
                        <i className="fa-solid fa-check"></i>
                    </button>
                    <button
                        onClick={saveDescriptor}
                        disabled={busy || !client}
                        className={Style.save}
                        title={disabledReason([
                            { when: !client, reason: "No MYLO agent connected" },
                            { when: busy, reason: "Editor is busy" },
                        ]) || "Save model"}
                    >
                        <i className="fa-solid fa-floppy-disk"></i>
                    </button>
                </div>
            </div>



            {/* Canvas + panel */}
            <div className="flex h-full min-h-0 w-full relative">
                <div className="flex-1 h-[92%] relative">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        nodeTypes={NODE_TYPES}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onDelete={onDelete}
                        onSelectionChange={onSelectionChange}
                        onConnect={onConnect}
                        connectOnClick={false}
                        onPaneClick={() => {
                            setContextMenu(null);
                            clearCanvasSelection();
                        }}
                        onPaneContextMenu={(event) => {
                            event.preventDefault();
                            setContextMenu({
                                x: event.clientX,
                                y: event.clientY,
                                clientX: event.clientX,
                                clientY: event.clientY,
                            });
                        }}
                        deleteKeyCode={["Delete", "Backspace"]}
                        fitView
                        colorMode={prefs.theme === "dark" ? "dark" : "light"}
                    >
                        <Background />
                        <Controls />
                        <MiniMap />
                    </ReactFlow>

                    {contextMenu && (
                        <ModelContextMenu
                            clientX={contextMenu.clientX}
                            clientY={contextMenu.clientY}
                            x={contextMenu.x}
                            y={contextMenu.y}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            activeIndex={activeIndex}
                            setActiveIndex={setActiveIndex}
                            filteredTypes={filteredTypes}
                            nodeGroups={catalog?.nodeGroups}
                            onAddNode={addNodeAtPosition}
                            onClose={() => setContextMenu(null)}
                        />
                    )}
                </div>
                <NodeSettingsPanel
                    selectedNodeId={selectedNodeId}
                    descriptor={descriptor}
                    catalog={catalog}
                    nodeTypeDraft={nodeTypeDraft}
                    setNodeTypeDraft={setNodeTypeDraft}
                    nodeParamFields={nodeParamFields}
                    addParamField={addParamField}
                    updateParamField={updateParamField}
                    removeParamField={removeParamField}
                    applyTemplate={applyTemplate}
                    quickAddType={quickAddType}
                    setQuickAddType={setQuickAddType}
                    quickAddNodeFromCanvas={quickAddNodeFromCanvas}
                    busy={busy}
                    client={client}
                    insertableTypes={insertableTypes}
                    swappableActivations={swappableActivations}
                    onApplyChanges={(params) => {
                        const { payload, expandedNodes: nextExpanded } =
                            buildUpdateNodePayload(
                                selectedNodeId!,
                                nodeTypeDraft,
                                params,
                            );
                        applyEdit("update_node", payload, true, nextExpanded);
                    }}
                    onDeleteNode={() =>
                        applyEdit("remove_node", { nodeId: selectedNodeId! }, false)
                    }
                    canDeleteNode={
                        nodes.find((n) => String(n.id) === String(selectedNodeId))
                            ?.deletable !== false
                    }
                    onExpandNode={expandSelected}
                    onCollapseNode={collapseSelected}
                    onPreviewParams={previewParams}
                    shapes={shapes}
                />
            </div>
        </div>
    );
}
