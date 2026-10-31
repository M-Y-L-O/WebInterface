import {Edge, Node, Position} from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled";

export interface GraphNode {
    id: number|string;
    label: string;
    title?: string;
    style?: any;
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

export const nodeDefaults = {
    sourcePosition: Position.Right,
    targetPosition: Position.Left
}

export const NODE_TYPE_CATEGORIES: Record<string, string> = {
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

export function getNodeCategory(label: string): string {
    for (const [category, keywords] of Object.entries(NODE_TYPE_CATEGORIES)) {
        if (keywords.split(" ").some((word) => label.toLowerCase().includes(word.toLowerCase()))) {
            return category;
        }
    }
    return "other";
}

export function simplifyNodeName(node: GraphNode): string {
    return (node.label || "")
        .replace(/lstm|model|attention|norm|layer|output|input|_/g, "")
        .replace(/[^a-zA-Z]/g, "");
}

export function colorNode(node: Node, noBorder?:boolean): Node {
    const category = getNodeCategory(node.data.label as string || "");
    const map = categoryColorMap[category] || categoryColorMap.other;
    node.style = {
        background: map.normal,
        border: noBorder==true ? `0px solid transparent` : `1px solid ${map.highlight}`,
        borderRadius:  6,
        padding: noBorder==true ? 0 :10
    };

    return node;
}

export function getNodeColor(nodeOrLabel: GraphNode | string): string {
    const label = typeof nodeOrLabel === "string"
        ? nodeOrLabel
        : (simplifyNodeName(nodeOrLabel) || nodeOrLabel.label || "");

    const category = getNodeCategory(label);
    const map = categoryColorMap[category] || categoryColorMap.other;
    return map.normal;
}

const elk = new ELK();

export async function layoutElements(nodes:Node[], edges:Edge[], vertical:boolean){
    const graph = {
        id: "root",
        layoutOptions: {
            "elk.direction": vertical ? "DOWN" : "RIGHT",
            "elk.algorithm": "layered",

            "elk.spacing.nodeNode": "60",
            "elk.layered.spacing.nodeNodeBetweenLayers": "80",

            "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",

            "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",

            "elk.edgeRouting": "ORTHOGONAL",
            "elk.layered.unnecessaryBendpoints": "true",

            "elk.layered.compaction.postCompaction.strategy": "LEFT_RIGHT_CONSTRAINT_LOCKING",

        },
        children: nodes.map((node) => ({
            id: node.id,
            width: node.width || 180,
            height: node.height || 40,
        })),
        edges: edges.map((edge) => ({
            id: edge.id || `${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
        }))
    }
    const layout = await elk.layout(graph as any);

    const updatedNodes = nodes.map((n)=>{
        const pos = layout.children?.find((c:any)=> c.id === n.id);
        return{
            ...n,
            position: {
                x: pos?.x || 0,
                y: pos?.y || 0,
            }
        }
    })

    return updatedNodes;
}

