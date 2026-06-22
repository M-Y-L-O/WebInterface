"use client"
import {IDockviewPanelProps} from "dockview-core";
import {useEffect, useRef, useCallback, useMemo, useState} from "react";

import {ReactFlow, Background, Controls, MiniMap, Node, Edge, OnSelectionChangeParams, Position, useNodesState, useEdgesState} from "@xyflow/react";
import '@xyflow/react/dist/style.css';

import {useSelectedStore, useVisualisationStore} from "@/lib/store";
import {GraphEdge, GraphNode, colorNode, nodeDefaults, simplifyNodeName, getNodeCategory, layoutElements} from "@/lib/windows/visualiserHelpers";


export default function Visualiser(props: IDockviewPanelProps){
    const visRes = useVisualisationStore(state => state.visualisation);
    const setVis = useVisualisationStore(state => state.setVisualisation);
    const setSelected = useSelectedStore(state => state.setSelected);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgeChange] = useEdgesState([]);
    const [_parsed, setParsed] = useState<any>(null);

    const buildGraph = useCallback(async () => {
        const res = sessionStorage.getItem("visRes");
        if(res)
            setVis(res);
        else
            return;


        const parsed = JSON.parse(res);
        setParsed(parsed);

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
            const model = sessionStorage.getItem("visRes ");
            if(model){
                setVis(model);
            }

        }
    },[])

    function onSelectionChange(params: OnSelectionChangeParams) {

        if(params.nodes.length > 0){
            const node = _parsed.nodes.find((n:GraphNode)=> n.id.toString() === params.nodes[0].id);
            setSelected(node);
        } else if(params.edges.length > 0){
            const edge = _parsed.edges.find((e:GraphEdge) => e.from.toString() === params.edges[0].source && e.to.toString() === params.edges[0].target);
            setSelected(edge);
        } else {
            setSelected(null);
        }

    }

    useEffect(()=>{
        buildGraph();
    }, [buildGraph])
    return <div className={"w-full h-full"}>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgeChange} onSelectionChange={onSelectionChange} fitView colorMode={"dark"}>
            <Background/>
            <Controls/>
            <MiniMap/>
        </ReactFlow>
    </div>
}