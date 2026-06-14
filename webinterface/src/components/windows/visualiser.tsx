"use client"
import {IDockviewPanelProps} from "dockview-core";
import {useEffect, useRef, useCallback, useMemo, useState} from "react";

import {ReactFlow, Background, Controls, MiniMap, Node, Edge, OnSelectionChangeParams, Position, useNodesState, useEdgesState} from "@xyflow/react";
import '@xyflow/react/dist/style.css';

import ELK from "elkjs/lib/elk.bundled.js";

import {useVisualisationStore} from "@/lib/store";


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

const nodeDefaults = {
    sourcePosition: Position.Right,
    targetPosition: Position.Left
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

export function getNodeCategory(label: string): string {
    for (const [category, keywords] of Object.entries(NODE_TYPE_CATEGORIES)) {
        if (keywords.split(" ").some((word) => label.toLowerCase().includes(word.toLowerCase()))) {
            return category;
        }
    }
    return "other";
}

function simplifyNodeName(node: GraphNode): string {
    return (node.label || "")
        .toLowerCase()
        .replace(/lstm|model|attention|norm|layer|output|input|_/g, "")
        .replace(/[^a-zA-Z]/g, "");
}

function colorNode(node: Node): Node {
    const category = getNodeCategory(node.data.label as string || "");
    const map = categoryColorMap[category] || categoryColorMap.other;
    node.style = {
        background: map.normal,
        color: "#fff",
        border: `1px solid ${map.highlight}`,
        borderRadius: 6,
        padding: 10
    };

    return node;
}

const elk = new ELK();

async function layoutElements(nodes:Node[], edges:Edge[], vertical:boolean){
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



export default function Visualiser(props: IDockviewPanelProps){
    const visRes = useVisualisationStore(state => state.visualisation);
    const setVis = useVisualisationStore(state => state.setVisualisation);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgeChange] = useEdgesState([]);

    const buildGraph = useCallback(async () => {
        if (!visRes) {
            return;
        }

        const parsed = JSON.parse(visRes);

        let rawNodes: GraphNode[] = parsed.nodes || [];
        let rawEdges: GraphEdge[] = parsed.edges || [];

        const constantsToRemove = new Set<string|number>();
        const cleanNodes: GraphNode[] = [];

        //filter out constant nodes
        rawNodes.forEach((node) => {
            if (node.label.includes("Constant")) {
                constantsToRemove.add(node.id);
            } else {
                cleanNodes.push(node);
            }
        })

        //remove edges to and from constants
        let newEdges: GraphEdge[] = [];

        rawEdges.forEach((edge) => {
            if(constantsToRemove.has(edge.from)){
                newEdges.push(...rawEdges.filter((e)=>e.to === edge.from).map(e=>({
                    from: e.from,
                    to: edge.to
                })));
            } else if(constantsToRemove.has(edge.to)){
                newEdges.push(...rawEdges.filter((e)=>e.from === edge.to).map(e=>({
                    from: edge.from,
                    to: e.to
                })));
            } else {
                newEdges.push(edge);
            }
        })

        //Clean node dupes
        const seen = new Set<string>();
        newEdges = newEdges.filter((edge)=>{
            const key= `${edge.from}-${edge.to}`;
            if(seen.has(key))
                return false;
            seen.add(key);
            return true;
        })

        let rfNodes: Node[] = cleanNodes.map((node)=>({
            id: String(node.id),
            data: {label: simplifyNodeName(node) || node.label},
            position: {x:0, y:0},
            ...nodeDefaults
        }))

        let rfEdges: Edge[] = newEdges.map((edge, i)=>({
            id: String(i),
            source: String(edge.from),
            target: String(edge.to),
            animated:true
        }))

        rfNodes = rfNodes.map((node)=> colorNode(node))

        const positionedNodes = await layoutElements(rfNodes, rfEdges, false);

        // @ts-ignore
        setNodes(positionedNodes);
        // @ts-ignore
        setEdges(rfEdges);
    }, [visRes])

    useEffect(()=>{
        if(!visRes)
        {
            const model = sessionStorage.getItem("model");
            if(model){
                setVis(model);
            }
        }
    },[])



    useEffect(()=>{
        buildGraph();
    }, [buildGraph])
    return <div className={"w-full h-full"}>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgeChange} fitView colorMode={"dark"}>
            <Background/>
            <Controls/>
            <MiniMap/>
        </ReactFlow>
    </div>
}