"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
    Background,
    Edge,
    Node,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
    useReactFlow,
} from "@xyflow/react";
import {
    designEdges,
    positionedNodes,
} from "@/components/effects/DummyVisualiser";
import "@xyflow/react/dist/style.css";

const INFERENCE_PATH = ["1", "6", "9", "13", "15", "16", "17"];

const PATH_EDGE_IDS = ["e5", "e10", "e15", "e19", "e21", "e22"];

const GLOW_SHADOW = "0 0 30px rgba(255,165,0,.7)";

function staticHeroEdges(): Edge[] {
    return designEdges.map((edge) => {
        const { animated: _animated, ...rest } = edge;
        const { strokeDasharray: _dash, ...styleRest } = rest.style ?? {};
        return {
            ...rest,
            animated: false,
            style: {
                ...styleRest,
                stroke: "rgba(255,255,255,0.35)",
            },
        };
    });
}

function withStaggerDelays(nodes: Node[]): Node[] {
    return nodes.map((node, index) => ({
        ...node,
        style: {
            ...node.style,
            // Stable delay from index — avoids hydration mismatch from Math.random()
            animationDelay: `${index * 0.08}s, ${index * 0.35}s`,
        },
        className: node.className,
    }));
}

function HeroFlowInner({ onReady }: { onReady?: () => void }) {
    const { fitView, setViewport, getViewport } = useReactFlow();
    const readyRef = useRef(false);
    const baseViewport = useRef({ x: 0, y: 0, zoom: 0.85 });
    const driftRafRef = useRef<number | null>(null);
    const driftTimeoutRef = useRef<number | null>(null);
    const cancelledRef = useRef(false);

    const initialNodes = useMemo(() => withStaggerDelays(positionedNodes), []);
    const initialEdges = useMemo(() => staticHeroEdges(), []);

    const [nodes, setNodes] = useNodesState(initialNodes);
    const [edges, setEdges] = useEdgesState(initialEdges);

    useEffect(() => {
        return () => {
            cancelledRef.current = true;
            if (driftTimeoutRef.current !== null) {
                clearTimeout(driftTimeoutRef.current);
            }
            if (driftRafRef.current !== null) {
                cancelAnimationFrame(driftRafRef.current);
            }
        };
    }, []);

    const captureBaseViewport = useCallback(() => {
        baseViewport.current = getViewport();
    }, [getViewport]);

    const startCameraDrift = useCallback(() => {
        if (cancelledRef.current || driftRafRef.current !== null) return;

        // Re-read after layout settles — never change zoom without a fresh fit
        captureBaseViewport();

        let offset = 0;
        let direction = 1;
        let last = performance.now();

        const tick = (now: number) => {
            if (cancelledRef.current) return;

            const dt = Math.min(now - last, 50);
            last = now;
            // ~0.25px per 100ms ≈ 2.5px/s
            offset += direction * 2.5 * (dt / 1000);
            if (offset > 40 || offset < -40) direction *= -1;

            const { x, y, zoom } = baseViewport.current;
            setViewport({ x: x + offset, y, zoom }, { duration: 0 });
            driftRafRef.current = requestAnimationFrame(tick);
        };

        driftRafRef.current = requestAnimationFrame(tick);
    }, [setViewport, captureBaseViewport]);

    const onInit = useCallback(() => {
        if (readyRef.current) return;
        readyRef.current = true;

        // Wait a frame so the hero container has real width/height before fitting
        requestAnimationFrame(() => {
            if (cancelledRef.current) return;

            fitView({ padding: 0.08, duration: 0 });
            captureBaseViewport();
            onReady?.();

            // Let edges/nodes draw before camera starts drifting
            driftTimeoutRef.current = window.setTimeout(() => {
                startCameraDrift();
            }, 2000);
        });
    }, [fitView, captureBaseViewport, onReady, startCameraDrift]);

    // Sequential inference-path glow
    useEffect(() => {
        let pathIndex = 0;
        let pulseInterval: number | undefined;

        const applyPulse = (activeId: string | null, activeEdgeId: string | null) => {
            setNodes((prev) =>
                prev.map((node) => {
                    const baseStyle = { ...node.style };
                    delete (baseStyle as Record<string, unknown>).boxShadow;
                    if (node.id === activeId) {
                        return {
                            ...node,
                            style: { ...baseStyle, boxShadow: GLOW_SHADOW },
                            className: "hero-node-pulse",
                        };
                    }
                    return {
                        ...node,
                        style: baseStyle,
                        className: undefined,
                    };
                })
            );

            setEdges((prev) =>
                prev.map((edge) => {
                    const isActive = edge.id === activeEdgeId;
                    return {
                        ...edge,
                        style: {
                            ...edge.style,
                            stroke: isActive
                                ? "rgba(255,165,0,0.85)"
                                : "rgba(255,255,255,0.35)",
                            strokeWidth: isActive ? 2.5 : 1,
                        },
                    };
                })
            );
        };

        // Start pulsing after draw + node fade
        const startDelay = window.setTimeout(() => {
            applyPulse(INFERENCE_PATH[0], null);

            pulseInterval = window.setInterval(() => {
                pathIndex = (pathIndex + 1) % INFERENCE_PATH.length;
                const nodeId = INFERENCE_PATH[pathIndex];
                const edgeId =
                    pathIndex === 0 ? null : PATH_EDGE_IDS[pathIndex - 1];
                applyPulse(nodeId, edgeId);
            }, 1000);
        }, 2200);

        return () => {
            clearTimeout(startDelay);
            if (pulseInterval !== undefined) clearInterval(pulseInterval);
        };
    }, [setNodes, setEdges]);

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onInit={onInit}
            minZoom={0.05}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            panOnDrag={false}
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            preventScrolling={false}
            colorMode="dark"
        >
            <Background gap={32} size={1} />
        </ReactFlow>
    );
}

export default function HeroGraph({
    onReady,
    className,
}: {
    onReady?: () => void;
    className?: string;
}) {
    return (
        <div className={className ?? "hero-graph"}>
            <ReactFlowProvider>
                <HeroFlowInner onReady={onReady} />
            </ReactFlowProvider>
        </div>
    );
}
