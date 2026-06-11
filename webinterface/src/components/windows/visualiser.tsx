import { Network } from "vis-network";
import { DataSet } from "vis-data";
import {IDockviewPanelProps} from "dockview-core";

export interface GraphNode {
    id: string | number;
    label: string;
    title?: string;
    color?: any;
    font?: { color?: string; size?: number; fontFamily?: string; align?: string };
    group?: string;
    level?: number;
    [key: string]: any;
}

export interface GraphEdge {
    id?: string | number;
    from: string | number;
    to: string | number;
    [key: string]: any;
}

const NODE_TYPE_CATEGORIES: Record<string, string> = {
    coreLayers: "Dense Conv1D Conv2D Conv3D LSTM GRU RNN BatchNormalization Dropout Flatten Embedding",
    elementwiseMath: "Add Sub Mul Div Pow Sqrt Abs Neg Exp Log Clip Round Floor Ceil",
    activations: "ReLU LeakyReLU Sigmoid Tanh Softmax GELU ELU SELU HardSigmoid HardSwish",
    reductions: "ReduceSum ReduceMean ReduceMax ReduceMin ArgMax ArgMin GlobalAveragePool GlobalMaxPool",
    tensorManip: "Reshape Transpose Permute ExpandDims Squeeze Concat Split Slice Gather Scatter Tile Repeat Pad Stack Unstack",
    controlInfra: "Identity NoOp Switch Merge LoopCond Cast Constant Placeholder Input StopGradient CheckNumerics",
    linearAlgebra: "MatMul BatchMatMul Gemm Inverse Det Eig QR",
    attentionOps: "Attention Query Key Value Softmax MultiHeadAttention ScaledDotProductAttention",
    normalizationDropout: "LayerNorm Dropout RMSNorm",
    inputOutput: "Input Placeholder Output",
};

export const categoryColorMap: Record<string, { normal: string; highlight: string }> = {
    coreLayers: { normal: "#4A90E2", highlight: "#317AE0" },
    elementwiseMath: { normal: "#A67C52", highlight: "#B78A5B" },
    activations: { normal: "#7ED6DF", highlight: "#54B9C7" },
    reductions: { normal: "#E1B12C", highlight: "#F0C542" },
    tensorManip: { normal: "#9B59B6", highlight: "#B478D7" },
    controlInfra: { normal: "#95A5A6", highlight: "#BDC3C7" },
    linearAlgebra: { normal: "#27AE60", highlight: "#2ECC71" },
    attentionOps: { normal: "#F39C12", highlight: "#F5B041" },
    normalizationDropout: { normal: "#FF6B81", highlight: "#FF8A9B" },
    inputOutput: { normal: "#2C3E50", highlight: "#34495E" },
    other: { normal: "#777", highlight: "#999" },
};

export let nodes: DataSet<GraphNode> | undefined;
export let edges: DataSet<GraphEdge> | undefined;

export function getNodeCategory(label: string): string {
    for (const [category, keywords] of Object.entries(NODE_TYPE_CATEGORIES)) {
        if (keywords.split(" ").some((word) => label.includes(word))) {
            return category;
        }
    }
    return "other";
}

function simplifyNodeName(node: GraphNode): GraphNode {
    // normalize label and remove odd tokens safely
    node.label = (node.label || "").toLowerCase();

    node.label = node.label.replace(/lstm/g, "");
    node.label = node.label.replace(/model/g, "");
    node.label = node.label.replace(/statefeedback/g, "");
    node.label = node.label.replace(/attention/g, "");
    node.label = node.label.replace(/norm/g, "");
    node.label = node.label.replace(/featureprocessor/g, "");
    node.label = node.label.replace(/inputadapter/g, "");
    node.label = node.label.replace(/layer/g, "");
    node.label = node.label.replace(/output/g, "");
    node.label = node.label.replace(/_/g, "");

    // strip non-alpha characters
    node.label = node.label.replace(/[^a-zA-Z]/g, "");

    return node;
}

function colorNode(node: GraphNode): GraphNode {
    const category = getNodeCategory(node.label || "");
    const map = categoryColorMap[category] || categoryColorMap.other;
    node.color = {
        border: map.normal,
        background: map.normal,
        highlight: {
            border: map.highlight,
            background: map.highlight,
        },
    };

    return node;
}

function assignLevels(nodesArr: GraphNode[], edgesArr: GraphEdge[]): GraphNode[] {
    const levelMap: Record<string | number, number> = {};
    const visited = new Set<string | number>();

    const incomingMap: Record<string | number, number> = {};
    edgesArr.forEach((e) => {
        incomingMap[e.to] = (incomingMap[e.to] || 0) + 1;
    });

    const queue = nodesArr.filter((n) => !incomingMap[n.id]);
    queue.forEach((n) => (levelMap[n.id] = 0));

    while (queue.length) {
        const node = queue.shift() as GraphNode;
        visited.add(node.id);
        const level = levelMap[node.id];

        edgesArr
            .filter((e) => e.from === node.id)
            .forEach((e) => {
                const nextId = e.to;
                if (!visited.has(nextId)) {
                    levelMap[nextId] = Math.max(levelMap[nextId] || 0, level + 1);
                    const nextNode = nodesArr.find((n) => n.id === nextId);
                    if (nextNode) queue.push(nextNode);
                }
            });
    }

    nodesArr.forEach((n) => {
        n.level = levelMap[n.id] || 0;
    });

    return nodesArr;
}

export async function createVisualNetwork2D(
    results: { nodes: GraphNode[]; edges: GraphEdge[] },
    ctx: HTMLElement,
    constants?: boolean,
    physicsEnabled = true,
    vertical = false,
    handleSelect: (node?: GraphNode | null) => void = () => {}
): Promise<Network> {
    let rawNodes = results.nodes || [];
    let rawEdges = results.edges || [];

    nodes = new DataSet<GraphNode>(rawNodes);
    edges = new DataSet<GraphEdge>(rawEdges);

    if (!constants) {
        let newEdges: GraphEdge[] = [];
        const nodeMap = new Map<string | number, GraphNode>();
        const incomingEdges = new Map<string | number, GraphEdge[]>();
        const outgoingEdges = new Map<string | number, GraphEdge[]>();

        rawNodes.forEach((node) => nodeMap.set(node.id, node));
        rawEdges.forEach((edge) => {
            if (!incomingEdges.has(edge.to)) incomingEdges.set(edge.to, []);
            if (!outgoingEdges.has(edge.from)) outgoingEdges.set(edge.from, []);
            incomingEdges.get(edge.to)!.push(edge);
            outgoingEdges.get(edge.from)!.push(edge);
        });

        const cleanNodes: GraphNode[] = [];
        const constantsToRemove = new Set<string | number>();

        rawNodes.forEach((node) => {
            if ((node.label || "").includes("Constant")) {
                constantsToRemove.add(node.id);
            } else {
                cleanNodes.push(node);
            }
        });

        rawEdges.forEach((edge) => {
            const from = edge.from;
            const to = edge.to;

            if (constantsToRemove.has(from)) {
                const sources = incomingEdges.get(from) || [];
                sources.forEach((sourceEdge) => {
                    newEdges.push({ from: sourceEdge.from, to: to });
                });
            } else if (constantsToRemove.has(to)) {
                const targets = outgoingEdges.get(to) || [];
                targets.forEach((targetEdge) => {
                    newEdges.push({ from: from, to: targetEdge.to });
                });
            } else {
                newEdges.push(edge);
            }
        });

        const seen = new Set<string>();
        newEdges = newEdges.filter((edge) => {
            const key = `${edge.from}->${edge.to}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        nodes = new DataSet<GraphNode>(cleanNodes);
        edges = new DataSet<GraphEdge>(newEdges);
    }

    // sanitize and style nodes
    nodes.forEach((node: GraphNode) => {
        // @ts-ignore
        node.title = (node.title || "").replace(/doc_string:\s+"(?:[^"\\]|\\.|\\\n)*"/gs, "");
        simplifyNodeName(node);
        colorNode(node);
        node.font = {
            color: "#ffffff",
            size: 12,
            fontFamily: "Montserrat",
            align: "center",
        };
        node.group = node.group || "";
    });

    const options: any = {
        layout: {
            hierarchical: {
                enabled: true,
                direction: vertical ? "UD" : "LR",
                sortMethod: "hubsize",
                levelSeparation: 100,
                nodeSpacing: 60,
                treeSpacing: 60,
                blockShifting: true,
                edgeMinimization: true,
                parentCentralization: true,
            },
        },
        nodes: {
            shape: "box",
            margin: 10,
            font: { size: 14, face: "arial" },
            borderWidth: 1,
            shadow: true,
            widthConstraint: { maximum: 100 },
        },
        edges: {
            arrows: { to: { enabled: true, scaleFactor: 0.5 } },
            smooth: {
                enabled: true,
                type: "cubicBezier",
                forceDirection: "horizontal",
                roundness: 0.5,
            },
        },
        physics: {
            enabled: physicsEnabled,
            stabilization: {
                enabled: true,
                iterations: 1000,
            },
            hierarchicalRepulsion: {
                centralGravity: 0.0,
                springLength: 40,
                springConstant: 0.01,
                nodeDistance: 40,
            },
            solver: "hierarchicalRepulsion",
        },
    };

    const network = new Network(ctx, { nodes, edges }, options);

    network.once("stabilizationIterationsDone", () => {
        try {
            network.fit({ animation: { duration: 500, easingFunction:"easeInOutCubic" } });
        } catch (e) {
            // ignore fit errors
        }
    });

    network.on("selectNode", (params: any) => {
        if (!params || !params.nodes || params.nodes.length === 0) return;
        const nodeId = params.nodes[0];
        const node = nodes?.get(nodeId as any)[0] as GraphNode | null;
        handleSelect(node);
    });

    return network;
}


export default function Visualiser(props: IDockviewPanelProps){

    return <div>
        <h1>Test</h1>
        <button>Halalo</button>
    </div>
}