import { Type, type FunctionDeclaration } from "@google/genai";

export const MYLO_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
    {
        name: "get_project_overview",
        description:
            "Get a summary of the currently loaded MYLO project: name, file slots, whether model/CSV data is present, and optimization run status.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
    {
        name: "get_model_descriptor",
        description:
            "Fetch the current editable model descriptor (nodes, edges, params) from the connected MYLO agent. Use before proposing graph edits.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                includeParams: {
                    type: Type.BOOLEAN,
                    description: "Include full node parameter objects (default true).",
                },
            },
        },
    },
    {
        name: "get_model_graph_summary",
        description:
            "Summarize the current visualization graph (node ids/types and edge count) without dumping full tensor data.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
    {
        name: "get_csv_summary",
        description:
            "Summarize the loaded CSV / dataset (columns, row count hints, sample values). Prefer this over dumping the full table.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                maxColumns: {
                    type: Type.NUMBER,
                    description: "Max columns to include (default 40).",
                },
            },
        },
    },
    {
        name: "get_editor_catalog",
        description:
            "Fetch the model-editor catalog: insertable node types, parameter blueprints, and ports. Required before adding/updating nodes.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
    {
        name: "get_optimization_status",
        description:
            "Return the latest optimization run updates/result from the project store, if any.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
    {
        name: "edit_model",
        description:
            "Apply a model-editor operation via the MYLO agent. Operations: add_node, remove_node, update_node, add_edge, remove_edge, set_params, replace_subgraph (if supported). Always call get_model_descriptor and get_editor_catalog first when unsure of ids/types.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                operation: {
                    type: Type.STRING,
                    description:
                        "Editor operation name, e.g. add_node, remove_node, update_node, add_edge, remove_edge.",
                },
                payload: {
                    type: Type.OBJECT,
                    description:
                        "Operation payload. Examples: {nodeId, type, params, connectFrom?} for add_node; {nodeId} for remove_node; {nodeId, type, params} for update_node; {source, target, sourcePort?, targetPort?} for add_edge.",
                },
                persist: {
                    type: Type.BOOLEAN,
                    description: "If true, persist the edit on the agent (default false — preview-style edit that still updates the live descriptor).",
                },
            },
            required: ["operation"],
        },
    },
    {
        name: "preview_edit",
        description:
            "Dry-run a model edit without committing history the same way as a full edit. Useful to validate an update_node params change.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                operation: { type: Type.STRING },
                payload: { type: Type.OBJECT },
            },
            required: ["operation"],
        },
    },
    {
        name: "validate_model",
        description: "Validate the current model descriptor on the MYLO agent.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
    {
        name: "save_model",
        description:
            "Save the current model descriptor on the agent and publish the graph to open Visualiser panels / project store.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
    {
        name: "undo_model_edit",
        description: "Undo the last model-editor change on the agent.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
    {
        name: "redo_model_edit",
        description: "Redo the last undone model-editor change on the agent.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
    {
        name: "open_dashboard_panel",
        description:
            "Open (or focus) a dashboard dock panel. Components: Chat, FileExplorer, ModelEditor, Visualiser, DataInfo, DataViewer, Properties, Optimization, Diagnostics. For account/AI settings, tell the user to open /settings from Home.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                component: {
                    type: Type.STRING,
                    description: "Window component name.",
                },
                title: {
                    type: Type.STRING,
                    description: "Optional panel title.",
                },
                id: {
                    type: Type.STRING,
                    description: "Optional stable panel id (defaults to component).",
                },
            },
            required: ["component"],
        },
    },
    {
        name: "list_open_panels",
        description: "List currently open dashboard panels (id, title, component).",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
    {
        name: "refresh_project",
        description: "Reload project metadata from the connected MYLO agent into the UI store.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
];
