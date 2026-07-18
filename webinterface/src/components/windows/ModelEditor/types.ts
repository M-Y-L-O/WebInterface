export type ViewMode = "summary" | "detailed" | "hybrid";
export type ParamFieldType = "string" | "number" | "boolean" | "json";
export type ParamField = {
    id: string;
    key: string;
    type: ParamFieldType;
    value: string;
};

// --- Catalog types (from GET /editor/catalog) ---

/** A single parameter descriptor from nodeParameterBlueprints */
export interface CatalogParamBlueprint {
    label: string;
    description?: string;
    type: "integer" | "float" | "boolean" | "string";
    default?: any;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    group?: string;
    advanced?: boolean;
    required?: boolean;
    helpUrl?: string;
}

/** Port descriptor from nodePorts */
export interface CatalogPort {
    id: string;
    required: boolean;
    description?: string;
}

export interface CatalogNodePorts {
    inputs: CatalogPort[];
    outputs: CatalogPort[];
}

/** Full catalog response shape */
export interface Catalog {
    /** Category -> list of node type strings */
    nodeGroups: Record<string, string[]>;
    /** NodeType -> parameter key -> blueprint */
    nodeParameterBlueprints: Record<string, Record<string, CatalogParamBlueprint>>;
    /** NodeType -> ports */
    nodePorts: Record<string, CatalogNodePorts>;
    /** NodeType -> default param values */
    nodeSchemas: Record<string, Record<string, any>>;
    operationSchemas?: any;
    compatibilityHints?: any;
    limits?: { maxNodes?: number; maxDepth?: number };
    templates?: any;
    // Legacy flat list still returned by some API versions
    insertableTypes?: string[];
    swappableActivations?: string[];
}
