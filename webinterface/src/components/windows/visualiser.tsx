"use client"
import {IDockviewPanelProps} from "dockview-core";
import {useEffect, useMemo, useState} from "react";

import {ReactFlow, Background, Controls, MiniMap, Node, Edge, OnSelectionChangeParams, useNodesState, useEdgesState} from "@xyflow/react";
import '@xyflow/react/dist/style.css';

import {GraphEdge, GraphNode, colorNode, nodeDefaults, simplifyNodeName, layoutElements} from "@/lib/windows/visualiserHelpers";
import {useInspectablePanel} from "@/lib/windows/useInspectablePanel";


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


export default function Visualiser(props: IDockviewPanelProps){
    const { setSelected, setVisualisation } = useInspectablePanel(props.api);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgeChange] = useEdgesState([]);
    const [parsed, setParsed] = useState<any>(null);

    const panelParams = (props as any).params || {};
    const providedVisualisation = panelParams.visualisation || panelParams.modelData || panelParams.data;
    const modelRevision = panelParams.modelRevision;

    // Live params from updateParameters (editor save / re-open) — React props alone can lag.
    const [paramVisualisation, setParamVisualisation] = useState<any>(providedVisualisation);
    const [paramRevision, setParamRevision] = useState<number | undefined>(modelRevision);

    useEffect(() => {
        setParamVisualisation(providedVisualisation);
        setParamRevision(modelRevision);
    }, [providedVisualisation, modelRevision]);

    useEffect(() => {
        const disposable = props.api.onDidParametersChange((parameters: any) => {
            const next = parameters?.visualisation || parameters?.modelData || parameters?.data;
            if (next !== undefined) setParamVisualisation(next);
            if (parameters?.modelRevision !== undefined) setParamRevision(parameters.modelRevision);
        });
        return () => disposable.dispose();
    }, [props.api]);

    const sourceVisualisation = useMemo(() => {
        return resolveVisualisation(paramVisualisation);
    }, [paramVisualisation, paramRevision]);

    function onSelectionChange(params: OnSelectionChangeParams) {

        if(params.nodes.length > 0 && parsed){
            const node = parsed.nodes.find((n:GraphNode)=> n.id.toString() === params.nodes[0].id);
            setSelected(node);
        } else if(params.edges.length > 0 && parsed){
            const edge = parsed.edges.find((e:GraphEdge) => e.from.toString() === params.edges[0].source && e.to.toString() === params.edges[0].target);
            setSelected(edge);
        } else {
            setSelected(null);
        }

    }

    useEffect(()=>{
        let cancelled = false;

        async function buildGraph(parsedGraph:any) {
            if (!parsedGraph) {
                setParsed(null);
                setNodes([]);
                setEdges([]);
                return;
            }

            let rawNodes: GraphNode[] = parsedGraph.nodes || [];
            let rawEdges: GraphEdge[] = parsedGraph.edges || [];

            const constantsToRemove = new Set<string|number>();
            const cleanNodes: GraphNode[] = [];

            rawNodes.forEach((node) => {
                if (node.label.includes("Constant")) {
                    constantsToRemove.add(node.id);
                } else {
                    cleanNodes.push(node);
                }
            })

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

            const rfEdges: Edge[] = newEdges.map((edge, i)=>({
                id: String(i),
                source: String(edge.from),
                target: String(edge.to),
                animated:true
            }))

            rfNodes = rfNodes.map((node)=> colorNode(node))

            const positionedNodes = await layoutElements(rfNodes, rfEdges, false);

            if (cancelled) {
                return;
            }

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
    }, [sourceVisualisation, setEdges, setNodes]);

    // Keep inspect context in sync without retriggering graph layout.
    useEffect(() => {
        setVisualisation(sourceVisualisation);
    }, [sourceVisualisation, setVisualisation]);

    return <div className={"w-full h-full"}>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgeChange} onSelectionChange={onSelectionChange} fitView colorMode={"dark"}>
            <Background/>
            <Controls/>
            <MiniMap/>
        </ReactFlow>
    </div>
}
