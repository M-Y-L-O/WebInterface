"use client"

import {IDockviewPanelProps} from "dockview-core";
import {useEffect, useMemo, useRef, useState} from "react";
import {toast} from "sonner";

import {Background, Connection, Controls, Edge, MiniMap, Node, OnSelectionChangeParams, ReactFlow, useEdgesState, useNodesState, ReactFlowProvider, useReactFlow} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {useClientStore, useSelectedStore, useVisualisationStore} from "@/lib/store";
import {GraphEdge, GraphNode, colorNode, layoutElements, nodeDefaults} from "@/lib/windows/visualiserHelpers";

type ViewMode = "summary" | "detailed" | "hybrid";

function defaultEmptyDescriptor() {
    // Minimal valid descriptor: input -> output, shapes compatible.
    return {
        model_name: "NewModel",
        input_shape: [-1, 1],
        output_shape: [-1, 1],
        nodes: [],
        edges: [{source: "input", target: "output", source_port: "output", target_port: "input"}],
        tensor_contracts: {},
        merge_rules: {},
        propagation_rules: "deterministic_forward",
    };
}

function safeJsonParse(value: string) {
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
}

type ParamFieldType = "string" | "number" | "boolean" | "json";
type ParamField = {
    id: string;
    key: string;
    type: ParamFieldType;
    value: string;
};

function templateFieldsForType(nodeType: string): ParamField[] {
    const t = (nodeType || "").toLowerCase();
    const mk = (key: string, type: ParamFieldType, value: string, idx = 0): ParamField => ({
        id: `${key}-${idx}-${Date.now()}`,
        key,
        type,
        value,
    });

    if (t === "linear") {
        return [
            mk("out_features", "number", "64", 0),
        ];
    }
    if (t === "dropout") {
        return [
            mk("p", "number", "0.2", 0),
        ];
    }
    if (t === "layernorm") {
        return [
            mk("normalized_shape", "number", "64", 0),
        ];
    }
    if (t === "batchnorm1d" || t === "batchnorm2d") {
        return [
            mk("num_features", "number", "64", 0),
        ];
    }
    if (t === "conv1d" || t === "conv2d") {
        return [
            mk("out_channels", "number", "32", 0),
            mk("kernel_size", "number", "3", 1),
            mk("stride", "number", "1", 2),
            mk("padding", "number", "1", 3),
        ];
    }
    if (t === "lstm" || t === "gru") {
        return [
            mk("hidden_size", "number", "64", 0),
            mk("num_layers", "number", "1", 1),
            mk("batch_first", "boolean", "true", 2),
        ];
    }
    if (t === "concat") {
        return [
            mk("dim", "number", "-1", 0),
        ];
    }

    return [];
}

function connectionGuard(source: string, target: string): string | null {
    if (!source || !target) return "Source and target are required";
    if (source === target) return "Cannot connect a node to itself";
    if (target === "input") return "Cannot connect into input";
    if (source === "output") return "Cannot connect out of output";
    return null;
}

function paramTypeOf(value: any): ParamFieldType {
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "string") return "string";
    return "json";
}

function valueToFieldString(value: any): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value, null, 2);
}

function paramsToFields(params: Record<string, any> | undefined): ParamField[] {
    const entries = Object.entries(params || {});
    if (entries.length === 0) return [];
    return entries.map(([key, value], idx) => ({
        id: `${key}-${idx}`,
        key,
        type: paramTypeOf(value),
        value: valueToFieldString(value),
    }));
}

function fieldsToParams(fields: ParamField[]): {params: Record<string, any> | null, error?: string} {
    const out: Record<string, any> = {};

    for (const field of fields) {
        const key = field.key.trim();
        if (!key) continue;

        if (field.type === "string") {
            out[key] = field.value;
            continue;
        }

        if (field.type === "number") {
            const num = Number(field.value);
            if (!Number.isFinite(num)) {
                return {params: null, error: `Field "${key}" must be a valid number`};
            }
            out[key] = num;
            continue;
        }

        if (field.type === "boolean") {
            const lower = field.value.trim().toLowerCase();
            if (lower === "true" || lower === "1") {
                out[key] = true;
            } else if (lower === "false" || lower === "0") {
                out[key] = false;
            } else {
                return {params: null, error: `Field "${key}" must be true/false`};
            }
            continue;
        }

        const parsed = safeJsonParse(field.value);
        if (parsed === undefined) {
            return {params: null, error: `Field "${key}" has invalid JSON`};
        }
        out[key] = parsed;
    }

    return {params: out};
}

function buildReactFlow(graph: any): {nodes: Node[], edges: Edge[]} {
    const rawNodes: GraphNode[] = graph?.nodes || [];
    const rawEdges: GraphEdge[] = graph?.edges || [];

    const rfNodes: Node[] = rawNodes.map((node) => ({
        id: String(node.id),
        data: {label: node.label},
        position: {x: 0, y: 0},
        deletable: String(node.id) !== "input" && String(node.id) !== "output",
        ...nodeDefaults,
    })).map((n) => colorNode(n));

    const rfEdges: Edge[] = rawEdges.map((edge, i) => ({
        id: String(edge.id ?? i),
        source: String(edge.from),
        target: String(edge.to),
        animated: true,
    }));

    return {nodes: rfNodes, edges: rfEdges};
}

export default function ModelEditor(props: IDockviewPanelProps) {
    return (
        <ReactFlowProvider>
            <ModelEditorInner {...props} />
        </ReactFlowProvider>
    );
}

function ModelEditorInner(props: IDockviewPanelProps) {
    const client = useClientStore(state => state.client);
    const setSelected = useSelectedStore(state => state.setSelected);
    const setVis = useVisualisationStore(state => state.setVisualisation);
    const { screenToFlowPosition } = useReactFlow();

    const panelParams = (props as any).params || {};
    const initialDescriptor = panelParams.descriptor;
    const fileName = panelParams.fileName || panelParams.file || panelParams.path || "";

    const [descriptor, setDescriptor] = useState<any>(initialDescriptor || null);
    const [catalog, setCatalog] = useState<any>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("summary");
    const [expandedNodes, setExpandedNodes] = useState<string[]>([]);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<{from: string, to: string} | null>(null);

    const [nodeTypeDraft, setNodeTypeDraft] = useState<string>("Linear");
    const [nodeIdDraft, setNodeIdDraft] = useState<string>("");
    const [nodeParamFields, setNodeParamFields] = useState<ParamField[]>([]);
    const [quickAddType, setQuickAddType] = useState<string>("Linear");

    const [busy, setBusy] = useState(false);
    const lastGraphRef = useRef<any>(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const contextMenuInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (contextMenu) {
            const timer = setTimeout(() => {
                contextMenuInputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [contextMenu]);

    function onSelectionChange(params: OnSelectionChangeParams) {
        const nextNodeId = params.nodes[0]?.id ?? null;
        const nextEdge = params.edges[0]
            ? {from: String(params.edges[0].source), to: String(params.edges[0].target)}
            : null;

        // Avoid unnecessary state updates that can cause deep update loops
        if (nextNodeId !== selectedNodeId) {
            setSelectedNodeId(nextNodeId);
        }

        const edgeChanged =
            (!!nextEdge && (!selectedEdge || nextEdge.from !== selectedEdge.from || nextEdge.to !== selectedEdge.to)) ||
            (!nextEdge && !!selectedEdge);
        if (edgeChanged) {
            setSelectedEdge(nextEdge);
        }

        // Keep global Properties panel useful
        if (nextNodeId && lastGraphRef.current?.nodes) {
            const raw = lastGraphRef.current.nodes.find((n: any) => String(n.id) === String(nextNodeId));
            setSelected(raw || {id: nextNodeId});
        } else if (nextEdge && lastGraphRef.current?.edges) {
            const raw = lastGraphRef.current.edges.find(
                (e: any) => String(e.from) === nextEdge.from && String(e.to) === nextEdge.to,
            );
            setSelected(raw || nextEdge);
        } else {
            setSelected(null);
        }
    }

    async function renderGraph(graph: any) {
        lastGraphRef.current = graph;
        const {nodes: rfNodes, edges: rfEdges} = buildReactFlow(graph);
        const positioned = await layoutElements(rfNodes, rfEdges, false);
        // @ts-ignore
        setNodes(positioned);
        // @ts-ignore
        setEdges(rfEdges);
        setVis(JSON.stringify(graph));
    }

    async function loadInitial() {
        if (!client) {
            setDescriptor(defaultEmptyDescriptor());
            await renderGraph(await Promise.resolve({nodes: [], edges: [], summary: {}}));
            return;
        }

        setBusy(true);
        try {
            const [catRes, descRes] = await Promise.all([
                client.getModelEditorCatalog(),
                descriptor ? {descriptor} : client.getModelDescriptor(),
            ]);

            if (!(catRes instanceof Error)) {
                setCatalog(catRes);
                const initialType = (catRes as any)?.insertableTypes?.[0];
                if (initialType) setNodeTypeDraft(initialType);
            }

            const desc = (descRes as any)?.descriptor || descriptor || defaultEmptyDescriptor();
            setDescriptor(desc);

            const graphRes = await client.visualizeModel({descriptor: desc, viewMode, expandedNodes});
            if (graphRes instanceof Error || (graphRes as any)?.error) {
                throw new Error((graphRes as any)?.error || "Failed to visualize descriptor");
            }

            await renderGraph(graphRes);
        } catch (e: any) {
            toast.error("Failed to load model editor", {description: e?.message || "Unknown error"});
            const fallback = defaultEmptyDescriptor();
            setDescriptor(fallback);
            if (client) {
                const graphRes = await client.visualizeModel({descriptor: fallback, viewMode, expandedNodes});
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

    async function refreshFromDescriptor(nextDescriptor: any, nextViewMode: ViewMode = viewMode, nextExpanded: string[] = expandedNodes) {
        if (!client) return;
        const graphRes = await client.visualizeModel({descriptor: nextDescriptor, viewMode: nextViewMode, expandedNodes: nextExpanded});
        if (graphRes instanceof Error || (graphRes as any)?.error) {
            throw new Error((graphRes as any)?.error || "Visualization failed");
        }
        setDescriptor(nextDescriptor);
        await renderGraph(graphRes);
    }

    async function applyEdit(operation: string, payload: any, persist = false) {
        if (!client) return;
        setBusy(true);
        const toastId = toast.loading("Applying edit...");
        try {
            const res = await client.editModel({descriptor, operation, payload, persist, viewMode, expandedNodes});
            if (!res || res instanceof Error || (res as any)?.error || (res as any)?.success === false) {
                throw new Error((res as any)?.error || "Edit failed");
            }
            if ((res as any)?.descriptor) setDescriptor((res as any).descriptor);
            if ((res as any)?.graph) await renderGraph((res as any).graph);
            toast.success((res as any)?.message || "Edit applied", {id: toastId, duration: 2500});
        } catch (e: any) {
            toast.error("Edit failed", {id: toastId, description: e?.message || "Unknown error"});
        } finally {
            setBusy(false);
        }
    }

    function buildParamsFromFieldsOrToast() {
        const converted = fieldsToParams(nodeParamFields);
        if (!converted.params) {
            toast.error(converted.error || "Invalid params");
            return null;
        }
        return converted.params;
    }

    function applyTemplate(overwrite = true) {
        const template = templateFieldsForType(nodeTypeDraft);
        if (template.length === 0) {
            toast.message("No template for this type yet");
            return;
        }

        if (!overwrite && nodeParamFields.length > 0) {
            return;
        }

        setNodeParamFields(template);
    }

    async function saveDescriptor() {
        if (!client) return;
        setBusy(true);
        const toastId = toast.loading("Saving descriptor...");
        try {
            const res = await client.saveModelDescriptor({descriptor, viewMode, expandedNodes});
            if (!res || res instanceof Error || (res as any)?.error || (res as any)?.success === false) {
                throw new Error((res as any)?.error || "Save failed");
            }
            if ((res as any)?.descriptor) setDescriptor((res as any).descriptor);
            if ((res as any)?.graph) await renderGraph((res as any).graph);
            toast.success("Saved", {id: toastId, duration: 2500});
        } catch (e: any) {
            toast.error("Save failed", {id: toastId, description: e?.message || "Unknown error"});
        } finally {
            setBusy(false);
        }
    }

    async function validateDescriptor() {
        if (!client) return;
        setBusy(true);
        const toastId = toast.loading("Validating...");
        try {
            const res = await client.validateModelDescriptor(descriptor);
            if (!res || res instanceof Error) throw new Error("Validation request failed");
            if (!(res as any)?.valid) {
                throw new Error((res as any)?.error || "Invalid descriptor");
            }
            if ((res as any)?.descriptor) {
                const normalized = (res as any).descriptor;
                await refreshFromDescriptor(normalized);
            }
            toast.success("Descriptor valid", {id: toastId, duration: 2500});
        } catch (e: any) {
            toast.error("Descriptor invalid", {id: toastId, description: e?.message || "Unknown error"});
        } finally {
            setBusy(false);
        }
    }

    async function toggleViewMode(next: ViewMode) {
        if (!client) {
            setViewMode(next);
            return;
        }
        setBusy(true);
        try {
            setViewMode(next);
            const graphRes = await client.visualizeModel({descriptor, viewMode: next, expandedNodes});
            if (graphRes instanceof Error || (graphRes as any)?.error) {
                throw new Error((graphRes as any)?.error || "Failed to render view");
            }
            await renderGraph(graphRes);
        } catch (e: any) {
            toast.error("Failed to change view", {description: e?.message || "Unknown error"});
        } finally {
            setBusy(false);
        }
    }

    async function expandSelected() {
        if (!client || !selectedNodeId) return;
        setBusy(true);
        try {
            const res = await client.expandModelNodes({descriptor, nodeIds: [selectedNodeId], expandedNodes});
            if (res instanceof Error || (res as any)?.error) throw new Error((res as any)?.error || "Expand failed");
            setExpandedNodes((res as any)?.expandedNodes || [...expandedNodes, selectedNodeId]);
            setViewMode("hybrid");
            await renderGraph(res);
        } catch (e: any) {
            toast.error("Expand failed", {description: e?.message || "Unknown error"});
        } finally {
            setBusy(false);
        }
    }

    async function collapseSelected() {
        if (!client || !selectedNodeId) return;
        setBusy(true);
        try {
            const res = await client.collapseModelNodes({descriptor, nodeIds: [selectedNodeId], expandedNodes});
            if (res instanceof Error || (res as any)?.error) throw new Error((res as any)?.error || "Collapse failed");
            setExpandedNodes((res as any)?.expandedNodes || expandedNodes.filter((id) => id !== selectedNodeId));
            setViewMode((res as any)?.viewMode || "summary");
            await renderGraph(res);
        } catch (e: any) {
            toast.error("Collapse failed", {description: e?.message || "Unknown error"});
        } finally {
            setBusy(false);
        }
    }

    const insertableTypes = useMemo(() => (catalog?.insertableTypes || ["Linear", "ReLU", "Dropout"]) as string[], [catalog]);
    const swappableActivations = useMemo(() => (catalog?.swappableActivations || []) as string[], [catalog]);

    const filteredTypes = useMemo(() => {
        if (!searchQuery) return insertableTypes;
        return insertableTypes.filter((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [insertableTypes, searchQuery]);

    useEffect(() => {
        if (!selectedNodeId || !descriptor) return;
        const node = (descriptor.nodes || []).find((n: any) => String(n.id) === String(selectedNodeId));
        if (!node) return;
        setNodeIdDraft(String(node.id));
        setNodeTypeDraft(String(node.type || "Linear"));
        setNodeParamFields(paramsToFields(node.params || {}));
    }, [selectedNodeId, descriptor]);

    useEffect(() => {
        // Only auto-suggest template if user hasn't started editing params yet.
        if (nodeParamFields.length === 0) {
            const template = templateFieldsForType(nodeTypeDraft);
            if (template.length > 0) {
                setNodeParamFields(template);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodeTypeDraft]);

    async function onConnect(connection: Connection) {
        if (!connection.source || !connection.target) return;
        const source = String(connection.source);
        const target = String(connection.target);
        const guard = connectionGuard(source, target);
        if (guard) {
            toast.error(guard);
            return;
        }
        await applyEdit("add_edge", {
            source,
            target,
        }, false);
    }

    function nextNodeIdForType(type: string) {
        const base = (type || "node").replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase() || "node";
        const existing = new Set<string>((descriptor?.nodes || []).map((n: any) => String(n.id)));
        let idx = 1;
        let candidate = `${base}_${idx}`;
        while (existing.has(candidate)) {
            idx += 1;
            candidate = `${base}_${idx}`;
        }
        return candidate;
    }

    async function quickAddNodeFromCanvas() {
        const params = fieldsToParams(templateFieldsForType(quickAddType)).params || {};
        const nodeId = nextNodeIdForType(quickAddType);
        const connectFrom = selectedNodeId || "input";
        await applyEdit("add_node", {
            nodeId,
            type: quickAddType,
            params,
            connectFrom,
            connectTo: "output",
        }, false);
    }

    async function addNodeAtPosition(type: string) {
        if (!contextMenu) return;
        const flowPos = screenToFlowPosition({ x: contextMenu.clientX, y: contextMenu.clientY });
        const params = fieldsToParams(templateFieldsForType(type)).params || {};
        const nodeId = nextNodeIdForType(type);

        setBusy(true);
        await applyEdit("add_node", {
            nodeId,
            type,
            params,
            connectFrom: "",
            connectTo: "",
        }, false);

        setContextMenu(null);
        setSearchQuery("");
        setActiveIndex(0);
    }

    async function onNodesDelete(deletedNodes: Node[]) {
        for (const node of deletedNodes) {
            const id = String(node.id);
            if (id === "input" || id === "output") {
                continue;
            }
            await applyEdit("remove_node", {nodeId: id}, false);
        }
    }

    async function onEdgesDelete(deletedEdges: Edge[]) {
        for (const edge of deletedEdges) {
            await applyEdit("remove_edge", {source: String(edge.source), target: String(edge.target)}, false);
        }
    }

    function addParamField() {
        setNodeParamFields((prev) => [...prev, {
            id: `${Date.now()}-${Math.random()}`,
            key: "",
            type: "string",
            value: "",
        }]);
    }

    function updateParamField(id: string, patch: Partial<ParamField>) {
        setNodeParamFields((prev) => prev.map((field) => field.id === id ? {...field, ...patch} : field));
    }

    function removeParamField(id: string) {
        setNodeParamFields((prev) => prev.filter((field) => field.id !== id));
    }

    const title = fileName ? `Model Editor — ${fileName}` : "Model Editor";

    return (
        <div className="flex h-full w-full flex-col text-[var(--text-primary)] relative">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] bg-[var(--background)]/40 px-3 py-2">
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{title}</div>
                    <div className="truncate text-xs opacity-70">
                        View: {viewMode} · Expanded: {expandedNodes.length} · {busy ? "Busy…" : "Ready"}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        className="rounded-full border border-[var(--border-color)] px-3 py-1 text-xs transition hover:bg-[var(--card-background)] disabled:opacity-40"
                        onClick={() => toggleViewMode("summary")}
                        disabled={busy}
                    >Summary</button>
                    <button
                        className="rounded-full border border-[var(--border-color)] px-3 py-1 text-xs transition hover:bg-[var(--card-background)] disabled:opacity-40"
                        onClick={() => toggleViewMode("detailed")}
                        disabled={busy}
                    >Detailed</button>
                    <button
                        className="rounded-full border border-[var(--border-color)] px-3 py-1 text-xs transition hover:bg-[var(--card-background)] disabled:opacity-40"
                        onClick={() => toggleViewMode("hybrid")}
                        disabled={busy}
                    >Hybrid</button>

                    <div className="mx-1 h-5 w-px bg-[var(--border-color)]/80" />

                    <button
                        className="rounded-full bg-[var(--accent-color)] px-3 py-1 text-xs font-medium text-[var(--card-background)] transition hover:opacity-90 disabled:opacity-40"
                        onClick={saveDescriptor}
                        disabled={busy || !client}
                    >Save</button>
                    <button
                        className="rounded-full border border-[var(--border-color)] px-3 py-1 text-xs transition hover:bg-[var(--card-background)] disabled:opacity-40"
                        onClick={validateDescriptor}
                        disabled={busy || !client}
                    >Validate</button>
                </div>
            </div>

            <div className="flex h-full min-h-0 w-full relative">
                {/* ReactFlow Canvas Area */}
                <div className="flex-1 h-full relative">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodesDelete={onNodesDelete}
                        onEdgesDelete={onEdgesDelete}
                        onSelectionChange={onSelectionChange}
                        onConnect={onConnect}
                        connectOnClick={false}
                        onPaneClick={() => {
                            setContextMenu(null);
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
                        colorMode={"dark"}
                    >
                        <Background />
                        <Controls />
                        <MiniMap />
                    </ReactFlow>

                    {/* Blender/Unreal-Style Context Menu */}
                    {contextMenu && (
                        <div
                            className="fixed z-50 w-64 rounded-2xl border border-neutral-800/80 bg-neutral-900/90 p-2.5 shadow-2xl backdrop-blur-md text-white select-none animate-in fade-in zoom-in-95 duration-100"
                            style={{
                                left: Math.min(contextMenu.clientX, typeof window !== "undefined" ? window.innerWidth - 270 : contextMenu.clientX),
                                top: Math.min(contextMenu.clientY, typeof window !== "undefined" ? window.innerHeight - 350 : contextMenu.clientY),
                            }}
                        >
                            <div className="flex items-center gap-2 border-b border-white/10 px-2 pb-2 pt-0.5">
                                <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">Create Node</span>
                            </div>
                            <input
                                ref={contextMenuInputRef}
                                type="text"
                                className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-950/50 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                                placeholder="Search nodes..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setActiveIndex(0);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "ArrowDown") {
                                        e.preventDefault();
                                        setActiveIndex((prev) => Math.min(prev + 1, filteredTypes.length - 1));
                                    } else if (e.key === "ArrowUp") {
                                        e.preventDefault();
                                        setActiveIndex((prev) => Math.max(prev - 1, 0));
                                    } else if (e.key === "Enter") {
                                        e.preventDefault();
                                        if (filteredTypes[activeIndex]) {
                                            void addNodeAtPosition(filteredTypes[activeIndex]);
                                        }
                                    } else if (e.key === "Escape") {
                                        setContextMenu(null);
                                    }
                                }}
                            />
                            <div className="mt-2 max-h-48 overflow-y-auto pr-1">
                                {filteredTypes.length === 0 ? (
                                    <div className="p-2 text-xs text-white/40">No nodes found</div>
                                ) : (
                                    filteredTypes.map((type, idx) => (
                                        <button
                                            key={type}
                                            className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition duration-75 flex items-center justify-between ${
                                                idx === activeIndex
                                                    ? "bg-[var(--accent-color)] text-black font-bold"
                                                    : "text-white/85 hover:bg-white/5 hover:text-white"
                                            }`}
                                            onMouseEnter={() => setActiveIndex(idx)}
                                            onClick={() => void addNodeAtPosition(type)}
                                        >
                                            <span>{type}</span>
                                            <span className={`text-[9px] opacity-60 ${idx === activeIndex ? "text-black/80 font-bold" : "text-white/45"}`}>
                                                Enter
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Revamped Premium Side Settings Panel */}
                <div className="w-[360px] shrink-0 border-l border-[var(--border-color)] bg-[var(--background)]/40 p-3 flex flex-col h-full overflow-y-auto">
                    {selectedNodeId ? (
                        <>
                            <div className="mb-2 text-sm font-semibold">Node Settings</div>
                            <div className="mb-3 rounded-2xl border border-[var(--border-color)] bg-[var(--card-background)]/70 p-3">
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold tracking-wider opacity-50">Node ID</label>
                                        <div className="mt-1 text-xs font-mono bg-black/25 px-2.5 py-2 rounded-xl border border-[var(--border-color)] text-white/90">
                                            {selectedNodeId}
                                        </div>
                                    </div>
                                    
                                    {selectedNodeId !== "input" && selectedNodeId !== "output" && (
                                        <>
                                            <div>
                                                <label className="text-[10px] uppercase font-bold tracking-wider opacity-50">Type</label>
                                                <select
                                                    className="mt-1 w-full rounded-xl border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent-color)]"
                                                    value={nodeTypeDraft}
                                                    onChange={(e) => setNodeTypeDraft(e.target.value)}
                                                    disabled={busy || !client}
                                                >
                                                    {[...new Set([...insertableTypes, ...swappableActivations, nodeTypeDraft])].map((t) => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>

                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-[10px] uppercase font-bold tracking-wider opacity-50">Parameters</label>
                                                    <button
                                                        className="text-[10px] text-[var(--accent-color)] hover:underline"
                                                        onClick={() => applyTemplate(true)}
                                                        disabled={busy || !client}
                                                    >
                                                        Reset Template
                                                    </button>
                                                </div>

                                                <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--background)]/60 p-2">
                                                    {nodeParamFields.length === 0 && (
                                                        <div className="text-xs opacity-40 p-2 text-center">No parameters defined.</div>
                                                    )}
                                                    {nodeParamFields.map((field) => (
                                                        <div key={`update-${field.id}`} className="grid grid-cols-[1fr_80px_1fr_auto] gap-1.5 items-center">
                                                            <input
                                                                className="rounded-lg border border-[var(--border-color)] bg-[var(--card-background)] px-2 py-1 text-xs text-white"
                                                                placeholder="name"
                                                                value={field.key}
                                                                onChange={(e) => updateParamField(field.id, {key: e.target.value})}
                                                                disabled={busy || !client}
                                                            />
                                                            <select
                                                                className="rounded-lg border border-[var(--border-color)] bg-[var(--card-background)] px-1 py-1 text-xs text-white"
                                                                value={field.type}
                                                                onChange={(e) => updateParamField(field.id, {type: e.target.value as ParamFieldType})}
                                                                disabled={busy || !client}
                                                            >
                                                                <option value="string">str</option>
                                                                <option value="number">num</option>
                                                                <option value="boolean">bool</option>
                                                                <option value="json">json</option>
                                                            </select>
                                                            <input
                                                                className="rounded-lg border border-[var(--border-color)] bg-[var(--card-background)] px-2 py-1 text-xs text-white"
                                                                placeholder="value"
                                                                value={field.value}
                                                                onChange={(e) => updateParamField(field.id, {value: e.target.value})}
                                                                disabled={busy || !client}
                                                            />
                                                            <button
                                                                className="text-white/40 hover:text-red-400 p-1 text-xs transition"
                                                                onClick={() => removeParamField(field.id)}
                                                                disabled={busy || !client}
                                                                title="Remove field"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        className="mt-1 self-start rounded-lg border border-dashed border-[var(--border-color)] px-2.5 py-1 text-[11px] text-white/60 transition hover:bg-[var(--card-background)] hover:text-white"
                                                        onClick={addParamField}
                                                        disabled={busy || !client}
                                                    >
                                                        + Add Parameter
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 mt-2">
                                                <button
                                                    className="flex-1 rounded-xl bg-[var(--accent-color)] px-4 py-2 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
                                                    disabled={busy || !client || !selectedNodeId}
                                                    onClick={() => {
                                                        const params = buildParamsFromFieldsOrToast();
                                                        if (!params) return;
                                                        applyEdit("update_node", {nodeId: selectedNodeId, type: nodeTypeDraft, params}, false);
                                                    }}
                                                >
                                                    Apply Changes
                                                </button>
                                                <button
                                                    className="rounded-xl border border-red-500/30 hover:border-red-500/60 bg-red-950/20 hover:bg-red-950/40 text-red-400 px-3 py-2 text-xs font-semibold transition"
                                                    disabled={busy || !client}
                                                    onClick={() => applyEdit("remove_node", {nodeId: selectedNodeId}, false)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {selectedNodeId === "input" && (
                                        <div className="text-xs text-white/50 bg-white/5 p-2.5 rounded-xl border border-white/5 leading-relaxed">
                                            The <code className="text-[var(--accent-color)]">input</code> node represents the initial input tensor to the model. Its shape is configured globally.
                                        </div>
                                    )}
                                    {selectedNodeId === "output" && (
                                        <div className="text-xs text-white/50 bg-white/5 p-2.5 rounded-xl border border-white/5 leading-relaxed">
                                            The <code className="text-[var(--accent-color)]">output</code> node represents the final output sink of the model. Its shape must match the target task.
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="mt-auto pt-3 border-t border-[var(--border-color)]/30 flex flex-wrap gap-2 justify-between">
                                <button
                                    className="rounded-full border border-[var(--border-color)] px-3 py-1 text-[11px] transition hover:bg-[var(--card-background)] disabled:opacity-40"
                                    disabled={busy || !client || selectedNodeId === "input" || selectedNodeId === "output"}
                                    onClick={expandSelected}
                                >
                                    Expand Node
                                </button>
                                <button
                                    className="rounded-full border border-[var(--border-color)] px-3 py-1 text-[11px] transition hover:bg-[var(--card-background)] disabled:opacity-40"
                                    disabled={busy || !client || selectedNodeId === "input" || selectedNodeId === "output"}
                                    onClick={collapseSelected}
                                >
                                    Collapse Node
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="mb-2 text-sm font-semibold">Blueprint Editor</div>
                            <div className="mb-3 rounded-2xl border border-[var(--border-color)] bg-[var(--card-background)]/70 p-4">
                                <div className="flex flex-col gap-4 text-xs text-white/70">
                                    <div className="flex items-center gap-2.5 bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 p-3 rounded-xl text-white">
                                        <div className="w-2 h-2 rounded-full bg-[var(--accent-color)] animate-pulse shrink-0" />
                                        <div>
                                            <span className="font-semibold block text-[11px]">Free-Form Editor</span>
                                            Make changes freely. Errors are tolerated until validation or training.
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <span className="font-semibold block text-white/95 mb-1">Canvas Controls</span>
                                        <ul className="list-disc pl-4 space-y-1.5 text-white/60">
                                            <li><strong className="text-white/80">Right Click</strong> on pane to add nodes.</li>
                                            <li><strong className="text-white/80">Click + Drag</strong> handles to connect.</li>
                                            <li><strong className="text-white/80">Click + Delete / Backspace</strong> to remove nodes or edges.</li>
                                            <li><strong className="text-white/80">Double Click</strong> pane to quick-add selection.</li>
                                        </ul>
                                    </div>

                                    <div className="border-t border-[var(--border-color)]/50 pt-3">
                                        <span className="font-semibold block text-white/95 mb-1.5">Quick Add Preset</span>
                                        <div className="flex items-center gap-2">
                                            <select
                                                className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--background)] px-3 py-1.5 text-xs text-white focus:outline-none"
                                                value={quickAddType}
                                                onChange={(e) => setQuickAddType(e.target.value)}
                                                disabled={busy || !client}
                                            >
                                                {insertableTypes.map((t) => <option key={`quick-${t}`} value={t}>{t}</option>)}
                                            </select>
                                            <button
                                                className="rounded-xl border border-[var(--border-color)] bg-[var(--card-background)] px-3 py-1.5 text-xs transition hover:bg-neutral-800 disabled:opacity-40 font-semibold text-white"
                                                onClick={quickAddNodeFromCanvas}
                                                disabled={busy || !client}
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
