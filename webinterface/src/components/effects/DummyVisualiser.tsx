import { Node, Edge } from "@xyflow/react";
import {ReactFlow, Background, Position} from "@xyflow/react";
import {colorNode, layoutElements} from "@/lib/windows/visualiserHelpers";
import '@xyflow/react/dist/style.css';

const nodeDefaults = {
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    position: { x: 0, y: 0 },
};

export const designNodes: Node[] = [
    // Stage 0: Input
    { id: "1", data: { label: "Input" }, ...nodeDefaults },

    // Stage 1: parallel projections (wide)
    { id: "2", data: { label: "Query" }, ...nodeDefaults },
    { id: "3", data: { label: "Key" }, ...nodeDefaults },
    { id: "4", data: { label: "Value" }, ...nodeDefaults },
    { id: "5", data: { label: "Conv2D" }, ...nodeDefaults },
    { id: "6", data: { label: "Embed" }, ...nodeDefaults },

    // Stage 2: parallel processing (wide)
    { id: "7", data: { label: "MultiHeadAttention" }, ...nodeDefaults },
    { id: "8", data: { label: "BatchNorm2d" }, ...nodeDefaults },
    { id: "9", data: { label: "LayerNorm" }, ...nodeDefaults },
    { id: "10", data: { label: "GELU" }, ...nodeDefaults },
    { id: "11", data: { label: "Dropout" }, ...nodeDefaults },

    // Stage 3: merge (wide)
    { id: "12", data: { label: "Add" }, ...nodeDefaults },
    { id: "13", data: { label: "MatMul" }, ...nodeDefaults },
    { id: "14", data: { label: "ReLU" }, ...nodeDefaults },
    { id: "15", data: { label: "ReduceMean" }, ...nodeDefaults },

    // Stage 4: Output
    { id: "16", data: { label: "Softmax" }, ...nodeDefaults },
    { id: "17", data: { label: "Output" }, ...nodeDefaults },
];

export const designEdges: Edge[] = [
    // Input fans out to 5 parallel branches
    { id: "e1", source: "1", target: "2", animated: true },
    { id: "e2", source: "1", target: "3", animated: true },
    { id: "e3", source: "1", target: "4", animated: true },
    { id: "e4", source: "1", target: "5" },
    { id: "e5", source: "1", target: "6" },

    // Branches feed into parallel processing nodes
    { id: "e6", source: "2", target: "7", animated: true },
    { id: "e7", source: "3", target: "7", animated: true },
    { id: "e8", source: "4", target: "7", animated: true },
    { id: "e9", source: "5", target: "8" },
    { id: "e10", source: "6", target: "9" },
    { id: "e11", source: "6", target: "10" },
    { id: "e12", source: "5", target: "11" },

    // Processing nodes converge into merge stage
    { id: "e13", source: "7", target: "12" },
    { id: "e14", source: "8", target: "12" },
    { id: "e15", source: "9", target: "13" },
    { id: "e16", source: "10", target: "13" },
    { id: "e17", source: "11", target: "14" },
    { id: "e18", source: "12", target: "14" },
    { id: "e19", source: "13", target: "15", style: { strokeDasharray: "5,5" } },

    // Merge stage converges to output
    { id: "e20", source: "14", target: "16", animated: true },
    { id: "e21", source: "15", target: "16" },
    { id: "e22", source: "16", target: "17", animated: true },
];


const colorfulNodes = designNodes.map(node => colorNode({ ...node }));
const positionedNodes = await layoutElements(colorfulNodes, designEdges, false);

export default function DummyVisualiser() {
    return <div className={"w-full h-full"}>
        <ReactFlow
            nodes={positionedNodes}
            edges={designEdges}
            fitView
            fitViewOptions={{padding: 0.15}}
            minZoom={0.05}
            maxZoom={2}

            panOnDrag={false}
            panOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            colorMode={"dark"}
        >
            <Background/>
        </ReactFlow>
    </div>
}