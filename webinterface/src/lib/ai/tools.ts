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
            "Apply a model-editor operation via the MYLO agent. Operations: add_node, remove_node, update_node, add_edge, remove_edge, set_params. For insert-between, pass `operations` as one batch: add_node → remove_edge → add_edge → add_edge. ALWAYS use nodeId (never id). Call get_model_descriptor + get_editor_catalog first. After success: validate_model then save_model.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                operation: {
                    type: Type.STRING,
                    description:
                        "add_node | remove_node | update_node | add_edge | remove_edge | set_params. Required unless `operations` is provided.",
                },
                payload: {
                    type: Type.OBJECT,
                    description:
                        "REQUIRED keys by op — add_node:{nodeId,type,params}; remove_node:{nodeId}; update_node:{nodeId,type,params}; add_edge/remove_edge:{source,target}. Example add_node: {\"nodeId\":\"dropout1\",\"type\":\"Dropout\",\"params\":{\"p\":0.5}}.",
                },
                operations: {
                    type: Type.ARRAY,
                    description:
                        "Batch of {operation, payload} applied in order. Prefer for rewires. If DUPLICATE_NODE_ID, choose a new nodeId and retry — do not re-add an existing node.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            operation: { type: Type.STRING },
                            payload: { type: Type.OBJECT },
                        },
                        required: ["operation"],
                    },
                },
                persist: {
                    type: Type.BOOLEAN,
                    description: "If true, persist the edit on the agent (default false).",
                },
            },
        },
    },
    {
        name: "preview_edit",
        description:
            "Dry-run a model edit and return a human-readable diff summary without committing like a full edit.",
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
    {
        name: "start_optimization",
        description:
            "Start an optimization run on the connected MYLO agent. Requires inputFeatures and targetFeature. Uses settings defaults for epochs/generations when omitted. Returns immediately after kickoff; poll get_optimization_status for progress.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                inputFeatures: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Feature column names.",
                },
                targetFeature: {
                    type: Type.STRING,
                    description: "Target column name.",
                },
                problemType: {
                    type: Type.STRING,
                    description: "regression | classification (default regression).",
                },
                epochs: { type: Type.NUMBER },
                generations: { type: Type.NUMBER },
                strategy: {
                    type: Type.STRING,
                    description: "neat | genetic | brute-force | neuroevolution",
                },
                encoding: {
                    type: Type.STRING,
                    description: "none | label | onehot",
                },
                modelFilepath: {
                    type: Type.STRING,
                    description: "Optional model filepath override.",
                },
            },
            required: ["inputFeatures", "targetFeature"],
        },
    },
    {
        name: "stop_optimization",
        description:
            "Attempt to stop the in-progress optimization run. Returns an error if the local agent does not support cancel.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
    {
        name: "get_column_stats",
        description:
            "Compute per-column stats for the loaded CSV (inferred type, nulls, min/max, samples).",
        parameters: {
            type: Type.OBJECT,
            properties: {
                columns: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Optional column name filter.",
                },
                maxColumns: {
                    type: Type.NUMBER,
                    description: "Max columns to include (default 40).",
                },
            },
        },
    },
    {
        name: "suggest_features_targets",
        description:
            "Heuristically suggest feature columns and a target column from the loaded CSV.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
    {
        name: "get_visualiser_selection",
        description:
            "Return the current Visualiser / panel selection from the workspace store, if any.",
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
];
