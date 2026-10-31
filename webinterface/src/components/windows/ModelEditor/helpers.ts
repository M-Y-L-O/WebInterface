import { Edge, Node } from "@xyflow/react";
import { GraphEdge, GraphNode, colorNode, nodeDefaults } from "@/lib/windows/visualiserHelpers";
import { ParamField, ParamFieldType, Catalog, CatalogParamBlueprint } from "./types";

// ---------------------------------------------------------------------------
// Descriptor helpers
// ---------------------------------------------------------------------------

export function defaultEmptyDescriptor() {
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

export function safeJsonParse(value: string) {
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// Catalog-driven helpers
// ---------------------------------------------------------------------------

/**
 * Build initial param values for a new node from the catalog's nodeSchemas.
 * Falls back to an empty object if the type isn't in the catalog.
 */
export function catalogDefaultParams(nodeType: string, catalog: Catalog | null): Record<string, any> {
    return catalog?.nodeSchemas?.[nodeType] ?? {};
}

/**
 * Convert a catalog nodeParameterBlueprints entry into ParamField[] for the editor.
 * Uses the node's current live params as initial values, falling back to blueprint defaults.
 */
export function blueprintToFields(
    blueprint: Record<string, CatalogParamBlueprint>,
    currentParams: Record<string, any> = {},
): ParamField[] {
    return Object.entries(blueprint).map(([key, schema], idx) => {
        const live = currentParams[key];
        const raw = live !== undefined ? live : schema.default;
        const type: ParamFieldType =
            schema.type === "boolean" ? "boolean" :
            schema.type === "integer" || schema.type === "float" ? "number" :
            "string";
        return {
            id: `${key}-${idx}`,
            key,
            type,
            value: raw !== undefined && raw !== null ? String(raw) : "",
        };
    });
}

// ---------------------------------------------------------------------------
// Legacy hardcoded template fallback (used when catalog is unavailable)
// ---------------------------------------------------------------------------

/** @deprecated Prefer blueprintToFields with catalog data */
export function templateFieldsForType(nodeType: string): ParamField[] {
    const t = (nodeType || "").toLowerCase();
    const mk = (key: string, type: ParamFieldType, value: string, idx = 0): ParamField => ({
        id: `${key}-${idx}-${Date.now()}`,
        key,
        type,
        value,
    });

    if (t === "linear") return [mk("out_features", "number", "64", 0)];
    if (t === "dropout") return [mk("p", "number", "0.2", 0)];
    if (t === "layernorm") return [mk("normalized_shape", "number", "64", 0)];
    if (t === "batchnorm1d" || t === "batchnorm2d") return [mk("num_features", "number", "64", 0)];
    if (t === "conv1d" || t === "conv2d") return [
        mk("out_channels", "number", "32", 0),
        mk("kernel_size", "number", "3", 1),
        mk("stride", "number", "1", 2),
        mk("padding", "number", "1", 3),
    ];
    if (t === "lstm" || t === "gru") return [
        mk("hidden_size", "number", "64", 0),
        mk("num_layers", "number", "1", 1),
        mk("batch_first", "boolean", "true", 2),
    ];
    if (t === "concat") return [mk("dim", "number", "-1", 0)];
    return [];
}

// ---------------------------------------------------------------------------
// Param serialisation
// ---------------------------------------------------------------------------

export function connectionGuard(source: string, target: string): string | null {
    if (!source || !target) return "Source and target are required";
    if (source === target) return "Cannot connect a node to itself";
    if (target === "input") return "Cannot connect into input";
    if (source === "output") return "Cannot connect out of output";
    return null;
}

/** Role of a canvas / descriptor node for IO terminal rules. */
export function ioRoleOf(node: {
    id?: string | number;
    type?: string;
    group?: string;
    label?: string;
    data?: { nodeType?: string };
}): "input" | "output" | null {
    const id = String(node.id ?? "").toLowerCase();
    if (id === "input") return "input";
    if (id === "output") return "output";
    const type = String(
        node.type || node.group || node.data?.nodeType || node.label || "",
    ).toLowerCase();
    if (type === "input") return "input";
    if (type === "output") return "output";
    return null;
}

export function countIoRoles(
    nodes: Array<{
        id?: string | number;
        type?: string;
        group?: string;
        label?: string;
        data?: { nodeType?: string };
    }>,
): { input: number; output: number } {
    let input = 0;
    let output = 0;
    for (const node of nodes) {
        const role = ioRoleOf(node);
        if (role === "input") input += 1;
        else if (role === "output") output += 1;
    }
    return { input, output };
}

/** Virtual / typed IO nodes are deletable only when another of that role remains. */
export function isIoNodeDeletable(
    node: {
        id?: string | number;
        type?: string;
        group?: string;
        label?: string;
        data?: { nodeType?: string };
    },
    roleCounts: { input: number; output: number },
): boolean {
    const role = ioRoleOf(node);
    if (!role) return true;
    return roleCounts[role] > 1;
}

export function paramTypeOf(value: any): ParamFieldType {
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "string") return "string";
    return "json";
}

export function valueToFieldString(value: any): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value, null, 2);
}

export function paramsToFields(params: Record<string, any> | undefined): ParamField[] {
    const entries = Object.entries(params || {});
    if (entries.length === 0) return [];
    return entries.map(([key, value], idx) => ({
        id: `${key}-${idx}`,
        key,
        type: paramTypeOf(value),
        value: valueToFieldString(value),
    }));
}

export function fieldsToParams(fields: ParamField[]): {params: Record<string, any> | null, error?: string} {
    const out: Record<string, any> = {};

    for (const field of fields) {
        const key = field.key.trim();
        if (!key) continue;

        if (field.type === "string") { out[key] = field.value; continue; }

        if (field.type === "number") {
            const num = Number(field.value);
            if (!Number.isFinite(num)) return {params: null, error: `Field "${key}" must be a valid number`};
            out[key] = num;
            continue;
        }

        if (field.type === "boolean") {
            const lower = field.value.trim().toLowerCase();
            if (lower === "true" || lower === "1") { out[key] = true; continue; }
            if (lower === "false" || lower === "0") { out[key] = false; continue; }
            return {params: null, error: `Field "${key}" must be true/false`};
        }

        const parsed = safeJsonParse(field.value);
        if (parsed === undefined) return {params: null, error: `Field "${key}" has invalid JSON`};
        out[key] = parsed;
    }

    return {params: out};
}

// ---------------------------------------------------------------------------
// ReactFlow graph builder
// ---------------------------------------------------------------------------

/**
 * Build ReactFlow nodes + edges from an API graph response.
 * Nodes carry `ports` data so the custom PortedNode component can render handles.
 */
export function buildReactFlow(
    graph: any,
    catalog: Catalog | null = null,
): {nodes: Node[], edges: Edge[]} {
    const rawNodes: GraphNode[] = graph?.nodes || [];
    const rawEdges: GraphEdge[] = graph?.edges || [];

    const roleCounts = countIoRoles(rawNodes);

    const rfNodes: Node[] = rawNodes.map((node) => {
        const nodeType = String(node.type || node.group || node.label || "");
        const ports = catalog?.nodePorts?.[nodeType] ?? null;

        return {
            id: String(node.id),
            type: ports ? "portedNode" : "default",
            data: {
                label: node.label,
                nodeType,
                ports,
            },
            position: {x: 0, y: 0},
            deletable: isIoNodeDeletable(node, roleCounts),
            ...nodeDefaults,
        };
    })
        .map((n) => colorNode(n, true));


    const rfEdges: Edge[] = rawEdges.map((edge, i) => ({
        id: String(edge.id ?? i),
        source: String(edge.from),
        target: String(edge.to),
        sourceHandle: edge.source_port || null,
        targetHandle: edge.target_port || null,
        animated: true,
    }));

    return {nodes: rfNodes, edges: rfEdges};
}
