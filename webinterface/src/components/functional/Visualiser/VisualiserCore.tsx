"use client"
import { useEffect, useMemo, useState } from "react";
import {
    ReactFlow, Background, Controls, MiniMap,
    Node, Edge, OnSelectionChangeParams,
    useNodesState, useEdgesState
} from "@xyflow/react";
import '@xyflow/react/dist/style.css';

import {
    GraphEdge, GraphNode, colorNode, nodeDefaults,
    simplifyNodeName, layoutElements
} from "@/lib/windows/visualiserHelpers";

function resolveVisualisation(raw: any) {
    if (!raw) return null;
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }
    return raw;
}

export interface VisualiserCoreProps {
    visualisation: any;
    modelRevision?: number;
    interactive?: boolean;       // false = preview mode: no drag/select/zoom
    showControls?: boolean;      // zoom +/- and fit-view buttons
    showMiniMap?: boolean;
    onNodeSelect?: (node: GraphNode | null) => void;
    onEdgeSelect?: (edge: GraphEdge | null) => void;
    className?: string;
    fitView? : boolean;
}

export default function VisualiserCore({
                                           visualisation,
                                           modelRevision,
                                           interactive = true,
                                           showControls = interactive,
                                           showMiniMap = interactive,
                                           onNodeSelect,
                                           onEdgeSelect,
                                           className = "w-full h-full",
                                           fitView = false
                                       }: VisualiserCoreProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgeChange] = useEdgesState([]);
    const [parsed, setParsed] = useState<any>(null);

    const sourceVisualisation = useMemo(() => {
        return resolveVisualisation(visualisation);
    }, [visualisation, modelRevision]);

    function handleSelectionChange(params: OnSelectionChangeParams) {
        if (!interactive) return; // preview mode ignores selection entirely

        if (params.nodes.length > 0 && parsed) {
            const node = parsed.nodes.find((n: GraphNode) => n.id.toString() === params.nodes[0].id);
            onNodeSelect?.(node ?? null);
            onEdgeSelect?.(null);
        } else if (params.edges.length > 0 && parsed) {
            const edge = parsed.edges.find(
                (e: GraphEdge) => e.from.toString() === params.edges[0].source && e.to.toString() === params.edges[0].target
            );
            onEdgeSelect?.(edge ?? null);
            onNodeSelect?.(null);
        } else {
            onNodeSelect?.(null);
            onEdgeSelect?.(null);
        }
    }

    useEffect(() => {
        let cancelled = false;

        async function buildGraph(parsedGraph: any) {
            if (!parsedGraph) {
                setParsed(null);
                setNodes([]);
                setEdges([]);
                return;
            }

            let rawNodes: GraphNode[] = parsedGraph.nodes || [];
            let rawEdges: GraphEdge[] = parsedGraph.edges || [];

            const constantsToRemove = new Set<string | number>();
            const cleanNodes: GraphNode[] = [];

            rawNodes.forEach((node) => {
                if (node.label.includes("Constant")) {
                    constantsToRemove.add(node.id);
                } else {
                    cleanNodes.push(node);
                }
            });

            let newEdges: GraphEdge[] = [];

            rawEdges.forEach((edge) => {
                if (constantsToRemove.has(edge.from)) {
                    newEdges.push(...rawEdges.filter((e) => e.to === edge.from).map(e => ({
                        from: e.from,
                        to: edge.to
                    })));
                } else if (constantsToRemove.has(edge.to)) {
                    newEdges.push(...rawEdges.filter((e) => e.from === edge.to).map(e => ({
                        from: edge.from,
                        to: e.to
                    })));
                } else {
                    newEdges.push(edge);
                }
            });

            const seen = new Set<string>();
            newEdges = newEdges.filter((edge) => {
                const key = `${edge.from}-${edge.to}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            let rfNodes: Node[] = cleanNodes.map((node) => ({
                id: String(node.id),
                data: { label: simplifyNodeName(node) || node.label },
                position: { x: 0, y: 0 },
                ...nodeDefaults
            }));

            const rfEdges: Edge[] = newEdges.map((edge, i) => ({
                id: String(i),
                source: String(edge.from),
                target: String(edge.to),
                animated: interactive // skip animation cost in preview thumbnails
            }));

            rfNodes = rfNodes.map((node) => colorNode(node));

            const positionedNodes = await layoutElements(rfNodes, rfEdges, false);

            if (cancelled) return;

            // @ts-ignore
            setNodes(positionedNodes);
            // @ts-ignore
            setEdges(rfEdges);
        }

        async function loadVisualisation() {
            if (sourceVisualisation) {
                setParsed(sourceVisualisation);
                await buildGraph(sourceVisualisation);
                return;
            }
            setParsed(null);
            setNodes([]);
            setEdges([]);
        }

        loadVisualisation();

        return () => {
            cancelled = true;
        };
    }, [sourceVisualisation, setEdges, setNodes, interactive]);

    return (
        <div className={className}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={interactive ? onNodesChange : undefined}
                onEdgesChange={interactive ? onEdgeChange : undefined}
                onSelectionChange={interactive ? handleSelectionChange : undefined}
                fitView
                colorMode={"dark"}
                nodesDraggable={interactive}
                nodesConnectable={false}
                elementsSelectable={interactive}
                zoomOnScroll={interactive}
                zoomOnPinch={interactive}
                panOnDrag={interactive}
                preventScrolling={interactive}
                minZoom={0.01}
            >
                <Background />
                {showControls && <Controls />}
                {showMiniMap && <MiniMap />}
            </ReactFlow>
        </div>
    );
}