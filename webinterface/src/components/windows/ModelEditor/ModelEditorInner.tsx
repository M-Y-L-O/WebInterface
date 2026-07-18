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

import { useClientStore } from "@/lib/store";
import { useInspectablePanel } from "@/lib/windows/useInspectablePanel";
import { layoutElements } from "@/lib/windows/visualiserHelpers";

import { Catalog, ParamField, ParamFieldType, ViewMode } from "./types";
import {
    blueprintToFields,
    buildReactFlow,
    catalogDefaultParams,
    connectionGuard,
    defaultEmptyDescriptor,
    fieldsToParams,
    paramsToFields,
    templateFieldsForType,
} from "./helpers";
import ModelContextMenu from "./ModelContextMenu";
import NodeSettingsPanel from "./NodeSettingsPanel";
import PortedNode from "./PortedNode";
import Style from "./ModelEditor.module.css";

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
    const { screenToFlowPosition } = useReactFlow();

    const panelParams = (props as any).params || {};
    const initialDescriptor = panelParams.descriptor;
    const fileName = panelParams.fileName || panelParams.file || panelParams.path || "";

    // --- Core state ---
    const [descriptor, setDescriptor] = useState<any>(initialDescriptor || null);
    const [catalog, setCatalog] = useState<Catalog | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("summary");
    const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
    const [shapes, setShapes] = useState<Record<string, any>>({});

    // ReactFlow state
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Selection
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<{ from: string; to: string } | null>(null);

    // Node settings draft
    const [nodeTypeDraft, setNodeTypeDraft] = useState<string>("Linear");
    const [nodeIdDraft, setNodeIdDraft] = useState<string>("");
    const [nodeParamFields, setNodeParamFields] = useState<ParamField[]>([]);
    const [quickAddType, setQuickAddType] = useState<string>("Linear");

    // Undo/redo availability
    const [canUndo, setCanUndo] = useState(true);
    const [canRedo, setCanRedo] = useState(true);

    const [busy, setBusy] = useState(false);
    const lastGraphRef = useRef<any>(null);

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
    async function renderGraph(graph: any) {
        lastGraphRef.current = graph;
        const { nodes: rfNodes, edges: rfEdges } = buildReactFlow(graph, catalog);
        const positioned = await layoutElements(rfNodes, rfEdges, false);
        // @ts-ignore
        setNodes(positioned);
        // @ts-ignore
        setEdges(rfEdges);
        setVisualisation(graph);
    }

    // ---------------------------------------------------------------------------
    // Initial load
    // ---------------------------------------------------------------------------
    async function loadInitial() {
        if (!client) {
            setDescriptor(defaultEmptyDescriptor());
            await renderGraph({ nodes: [], edges: [], summary: {} });
            return;
        }

        setBusy(true);
        try {
            const [catRes, descRes] = await Promise.all([
                client.getEditorCatalog(),
                descriptor ? { descriptor } : client.getModelDescriptor(),
            ]);

            if (catRes && !(catRes instanceof Error)) {
                const cat = catRes as Catalog;
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
                (descRes as any)?.descriptor || descriptor || defaultEmptyDescriptor();
            setDescriptor(desc);

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
            if ((graphRes as any)?.shapes) setShapes((graphRes as any).shapes);
            await renderGraph(graphRes);
        } catch (e: any) {
            toast.error("Failed to load model editor", {
                description: e?.message || "Unknown error",
            });
            const fallback = defaultEmptyDescriptor();
            setDescriptor(fallback);
            if (client) {
                const graphRes = await client.visualizeModel({
                    descriptor: fallback,
                    viewMode,
                    expandedNodes,
                });
                if (!(graphRes instanceof Error) && !(graphRes as any)?.error) {
                    await renderGraph(graphRes);
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

    // ---------------------------------------------------------------------------
    // Typed error dispatch
    // ---------------------------------------------------------------------------
    function handleApiError(code: ApiErrorCode | string | undefined, message: string, toastId?: string | number) {
        switch (code as ApiErrorCode) {
            case "NO_UNDO_HISTORY":
                setCanUndo(false);
                toast.error("Nothing to undo", { id: toastId });
                return;
            case "NO_REDO_HISTORY":
                setCanRedo(false);
                toast.error("Nothing to redo", { id: toastId });
                return;
            case "DETAILED_VIEW_FAILED":
                toast.error("Detailed view failed — shape mismatch", {
                    id: toastId,
                    description: "Try Hybrid view or fix node dimensions first.",
                });
                return;
            case "CYCLE_DETECTED":
                toast.error("Cycle detected — connection creates a loop", { id: toastId });
                return;
            case "DUPLICATE_NODE_ID":
                toast.error("Node ID already in use", {
                    id: toastId,
                    description: message,
                });
                return;
            case "NODE_NOT_FOUND":
                toast.error("Node not found — refreshing canvas", { id: toastId });
                if (client) loadInitial();
                return;
            case "PORT_NOT_FOUND":
                toast.error("Port not found", { id: toastId, description: message });
                return;
            case "DISCONNECTED_GRAPH":
                toast.warning("Graph disconnected — some nodes are unreachable", { id: toastId });
                break;
            default:
                toast.error("Operation failed", { id: toastId, description: message });
        }
    }

    // ---------------------------------------------------------------------------
    // Apply edit (persisted)
    // ---------------------------------------------------------------------------
    async function applyEdit(operation: string, payload: any, persist = false) {
        if (!client) return;
        setBusy(true);
        const toastId = toast.loading("Applying…");
        try {
            const res = await client.editModel({
                descriptor,
                operation,
                payload,
                persist,
                viewMode,
                expandedNodes,
            });

            if (!res || res instanceof Error || (res as any)?.success === false) {
                const err = (res as any)?.error;
                handleApiError(err?.code, err?.message || "Edit failed", toastId);
                return;
            }

            if ((res as any)?.descriptor) setDescriptor((res as any).descriptor);
            if ((res as any)?.graph) await renderGraph((res as any).graph);
            if ((res as any)?.shapes) setShapes((res as any).shapes);
            // After a successful edit, re-enable undo
            setCanUndo(true);

            toast.success((res as any)?.message || "Done", {
                id: toastId,
                duration: 2000,
            });
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
        if (!client || !selectedNodeId) return;
        try {
            const res = await client.previewEdit({
                descriptor,
                operation: "update_node",
                payload: { nodeId: selectedNodeId, type: nodeTypeDraft, params },
                viewMode,
                expandedNodes,
            });

            if (!res || res instanceof Error || (res as any)?.success === false) return;

            // Optimistic update: apply preview graph to canvas without persisting descriptor
            if ((res as any)?.graph) await renderGraph((res as any).graph);
            if ((res as any)?.shapes) setShapes((res as any).shapes);
        } catch {
            // Preview failures are silent
        }
    }

    // ---------------------------------------------------------------------------
    // Undo / Redo
    // ---------------------------------------------------------------------------
    async function handleUndo() {
        if (!client || !canUndo) return;
        setBusy(true);
        const toastId = toast.loading("Undoing…");
        try {
            const res = await client.undo({ viewMode, expandedNodes });
            if (!res || res instanceof Error || (res as any)?.success === false) {
                handleApiError((res as any)?.error?.code, (res as any)?.error?.message || "Undo failed", toastId);
                return;
            }
            if ((res as any)?.descriptor) setDescriptor((res as any).descriptor);
            if ((res as any)?.graph) await renderGraph((res as any).graph);
            if ((res as any)?.shapes) setShapes((res as any).shapes);
            setCanRedo(true);
            toast.success("Undone", { id: toastId, duration: 1500 });
        } catch (e: any) {
            toast.error("Undo failed", { id: toastId, description: e?.message });
        } finally {
            setBusy(false);
        }
    }

    async function handleRedo() {
        if (!client || !canRedo) return;
        setBusy(true);
        const toastId = toast.loading("Redoing…");
        try {
            const res = await client.redo({ viewMode, expandedNodes });
            if (!res || res instanceof Error || (res as any)?.success === false) {
                handleApiError((res as any)?.error?.code, (res as any)?.error?.message || "Redo failed", toastId);
                return;
            }
            if ((res as any)?.descriptor) setDescriptor((res as any).descriptor);
            if ((res as any)?.graph) await renderGraph((res as any).graph);
            if ((res as any)?.shapes) setShapes((res as any).shapes);
            setCanUndo(true);
            toast.success("Redone", { id: toastId, duration: 1500 });
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
            if (isInput) return;

            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
                e.preventDefault();
                void handleUndo();
            } else if (
                ((e.ctrlKey || e.metaKey) && e.key === "y") ||
                ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")
            ) {
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
        if (!client) return;
        setBusy(true);
        const toastId = toast.loading("Saving…");
        try {
            const res = await client.saveModelDescriptor({
                descriptor,
                viewMode,
                expandedNodes,
            });
            if (!res || res instanceof Error || (res as any)?.success === false) {
                throw new Error((res as any)?.error?.message || "Save failed");
            }
            if ((res as any)?.descriptor) setDescriptor((res as any).descriptor);
            if ((res as any)?.graph) await renderGraph((res as any).graph);
            toast.success("Saved", { id: toastId, duration: 2000 });
        } catch (e: any) {
            toast.error("Save failed", { id: toastId, description: e?.message });
        } finally {
            setBusy(false);
        }
    }

    async function validateDescriptor() {
        if (!client) return;
        setBusy(true);
        const toastId = toast.loading("Validating…");
        try {
            const res = await client.validateModelDescriptor(descriptor);
            if (!res || res instanceof Error) throw new Error("Validation request failed");
            if (!(res as any)?.valid) {
                throw new Error((res as any)?.error?.message || "Invalid descriptor");
            }
            if ((res as any)?.descriptor) {
                setDescriptor((res as any).descriptor);
                const graphRes = await client.visualizeModel({
                    descriptor: (res as any).descriptor,
                    viewMode,
                    expandedNodes,
                });
                if (!(graphRes instanceof Error)) await renderGraph(graphRes);
            }
            toast.success("Descriptor valid", { id: toastId, duration: 2000 });
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
        if (!client) { setViewMode(next); return; }
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
            if ((graphRes as any)?.shapes) setShapes((graphRes as any).shapes);
            await renderGraph(graphRes);
        } catch (e: any) {
            toast.error("Failed to change view", { description: e?.message });
        } finally {
            setBusy(false);
        }
    }

    // ---------------------------------------------------------------------------
    // Expand / Collapse
    // ---------------------------------------------------------------------------
    async function expandSelected() {
        if (!client || !selectedNodeId) return;
        setBusy(true);
        try {
            const res = await client.expandModelNodes({
                descriptor,
                nodeIds: [selectedNodeId],
                expandedNodes,
            });
            if (res instanceof Error || (res as any)?.error)
                throw new Error((res as any)?.error || "Expand failed");
            setExpandedNodes(
                (res as any)?.expandedNodes || [...expandedNodes, selectedNodeId]
            );
            setViewMode("hybrid");
            await renderGraph(res);
        } catch (e: any) {
            toast.error("Expand failed", { description: e?.message });
        } finally {
            setBusy(false);
        }
    }

    async function collapseSelected() {
        if (!client || !selectedNodeId) return;
        setBusy(true);
        try {
            const res = await client.collapseModelNodes({
                descriptor,
                nodeIds: [selectedNodeId],
                expandedNodes,
            });
            if (res instanceof Error || (res as any)?.error)
                throw new Error((res as any)?.error || "Collapse failed");
            setExpandedNodes(
                (res as any)?.expandedNodes ||
                expandedNodes.filter((id) => id !== selectedNodeId)
            );
            setViewMode((res as any)?.viewMode || "summary");
            await renderGraph(res);
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

        if (nextNodeId !== selectedNodeId) setSelectedNodeId(nextNodeId);

        const edgeChanged =
            (!!nextEdge &&
                (!selectedEdge ||
                    nextEdge.from !== selectedEdge.from ||
                    nextEdge.to !== selectedEdge.to)) ||
            (!nextEdge && !!selectedEdge);
        if (edgeChanged) setSelectedEdge(nextEdge);

        if (nextNodeId && lastGraphRef.current?.nodes) {
            const raw = lastGraphRef.current.nodes.find(
                (n: any) => String(n.id) === String(nextNodeId)
            );
            setSelected(raw || { id: nextNodeId });
        } else if (nextEdge && lastGraphRef.current?.edges) {
            const raw = lastGraphRef.current.edges.find(
                (e: any) =>
                    String(e.from) === nextEdge.from &&
                    String(e.to) === nextEdge.to
            );
            setSelected(raw || nextEdge);
        } else {
            setSelected(null);
        }
    }

    // ---------------------------------------------------------------------------
    // Sync param fields when selected node changes
    // ---------------------------------------------------------------------------
    useEffect(() => {
        if (!selectedNodeId || !descriptor) return;
        const node = (descriptor.nodes || []).find(
            (n: any) => String(n.id) === String(selectedNodeId)
        );
        if (!node) return;
        setNodeIdDraft(String(node.id));
        const type = String(node.type || "Linear");
        setNodeTypeDraft(type);

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
        if (!connection.source || !connection.target) return;
        const source = String(connection.source);
        const target = String(connection.target);
        const sourcePort = connection.sourceHandle ?? "output";
        const targetPort = connection.targetHandle ?? "input";

        const guard = connectionGuard(source, target);
        if (guard) { toast.error(guard); return; }

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
                    toast.error(err.error || "Incompatible connection", {
                        description: err.availablePorts
                            ? `Available ports: ${err.availablePorts.join(", ")}`
                            : err.code,
                    });
                    return;
                }
                if ((check as any)?.warnings?.length) {
                    (check as any).warnings.forEach((w: string) => toast.warning(w));
                }
            } catch {
                // checkEdge is best-effort — proceed anyway
            }
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
            (descriptor?.nodes || []).map((n: any) => String(n.id))
        );
        let idx = 1;
        let candidate = `${base}_${idx}`;
        while (existing.has(candidate)) {
            idx += 1;
            candidate = `${base}_${idx}`;
        }
        return candidate;
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
        await applyEdit(
            "add_node",
            { nodeId, type: quickAddType, params, connectFrom, connectTo: "output" },
            false
        );
    }

    async function addNodeAtPosition(type: string) {
        if (!contextMenu) return;
        const params = paramsForType(type);
        const nodeId = nextNodeIdForType(type);
        await applyEdit("add_node", { nodeId, type, params }, false);
        setContextMenu(null);
        setSearchQuery("");
        setActiveIndex(0);
    }

    // ---------------------------------------------------------------------------
    // Delete handlers
    // ---------------------------------------------------------------------------
    async function onNodesDelete(deletedNodes: Node[]) {
        for (const node of deletedNodes) {
            const id = String(node.id);
            if (id === "input" || id === "output") continue;
            await applyEdit("remove_node", { nodeId: id }, false);
        }
    }

    async function onEdgesDelete(deletedEdges: Edge[]) {
        for (const edge of deletedEdges) {
            await applyEdit(
                "remove_edge",
                {
                    source: String(edge.source),
                    target: String(edge.target),
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
        setNodeParamFields((prev) => [
            ...prev,
            { id: `${Date.now()}-${Math.random()}`, key: "", type: "string", value: "" },
        ]);
    }

    function updateParamField(id: string, patch: Partial<ParamField>) {
        setNodeParamFields((prev) =>
            prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
        );
    }

    function removeParamField(id: string) {
        setNodeParamFields((prev) => prev.filter((f) => f.id !== id));
    }

    function applyTemplate(overwrite = true) {
        const bp = catalog?.nodeParameterBlueprints?.[nodeTypeDraft];
        if (bp) {
            setNodeParamFields(blueprintToFields(bp));
            return;
        }
        const template = templateFieldsForType(nodeTypeDraft);
        if (template.length === 0) { toast.message("No template for this type yet"); return; }
        if (!overwrite && nodeParamFields.length > 0) return;
        setNodeParamFields(template);
    }

    // ---------------------------------------------------------------------------
    // Title
    // ---------------------------------------------------------------------------
    const title = fileName ? `Model Editor — ${fileName}` : "Model Editor";

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    return (
        <div className={Style.container}>
            {/* Toolbar */}
            <div className={Style.nav}>
                <div className="flex gap-2 overflow-hidden items-center">
                    {fileName && <span className="text-xs opacity-60 truncate">{fileName}</span>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Undo / Redo */}
                    <button
                        onClick={handleUndo}
                        disabled={busy || !client || !canUndo}
                        title="Undo (Ctrl+Z)"
                        className="opacity-70 hover:opacity-100 disabled:opacity-30 transition text-sm px-2"
                    >
                        ↩
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={busy || !client || !canRedo}
                        title="Redo (Ctrl+Y)"
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

                    <div className="mx-1 h-5 w-px bg-[var(--light-highlight)]/90" />

                    <button onClick={validateDescriptor} disabled={busy || !client}>
                        Validate
                    </button>
                    <button
                        onClick={saveDescriptor}
                        disabled={busy || !client}
                        className={Style.save}
                    >
                        Save
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
                        onNodesDelete={onNodesDelete}
                        onEdgesDelete={onEdgesDelete}
                        onSelectionChange={onSelectionChange}
                        onConnect={onConnect}
                        connectOnClick={false}
                        onPaneClick={() => setContextMenu(null)}
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
                        colorMode="dark"
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
                    onApplyChanges={(params) =>
                        applyEdit(
                            "update_node",
                            { nodeId: selectedNodeId!, type: nodeTypeDraft, params },
                            true
                        )
                    }
                    onDeleteNode={() =>
                        applyEdit("remove_node", { nodeId: selectedNodeId! }, false)
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
