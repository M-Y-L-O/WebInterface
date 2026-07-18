"use client";

import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { CatalogNodePorts } from "./types";

interface PortedNodeData {
    label: string;
    nodeType?: string;
    ports?: CatalogNodePorts | null;
    /** Set externally to highlight invalid ports during a drag-connect gesture */
    invalidPorts?: Set<string>;
    /** Set externally to highlight valid ports during a drag-connect gesture */
    validPorts?: Set<string>;
}

/**
 * Custom ReactFlow node that renders named input/output handles sourced from
 * the catalog's nodePorts data. Falls back gracefully to a single left/right
 * handle pair when port information is unavailable.
 */
export default function PortedNode({ data, selected }: NodeProps) {
    const nodeData = data as unknown as PortedNodeData;
    const { label, ports, invalidPorts, validPorts } = nodeData;

    const inputPorts = ports?.inputs ?? [{ id: "input", required: true }];
    const outputPorts = ports?.outputs ?? [{ id: "output", required: false }];

    const portCount = Math.max(inputPorts.length, outputPorts.length);
    const nodeHeight = Math.max(48, portCount * 26 + 16);

    function portColor(portId: string, side: "in" | "out") {
        if (validPorts?.has(`${side}:${portId}`)) return "#4ade80";
        if (invalidPorts?.has(`${side}:${portId}`)) return "#f87171";
        return undefined; // default ReactFlow colour
    }

    return (
        <div
            style={{
                minWidth: 130,
                minHeight: nodeHeight,
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                position: "relative",
                borderRadius: 6,
                background: selected ? undefined : undefined, // colorNode handles bg
                boxSizing: "border-box",
            }}
        >
            {/* Input handles — left side */}
            {inputPorts.map((port, idx) => {
                const totalPorts = inputPorts.length;
                const top = totalPorts === 1
                    ? "50%"
                    : `${((idx + 0.5) / totalPorts) * 100}%`;

                const color = portColor(port.id, "in");

                return (
                    <React.Fragment key={`in-${port.id}`}>
                        <Handle
                            type="target"
                            position={Position.Left}
                            id={port.id}
                            style={{
                                top,
                                background: color ?? (port.required ? "#f87171" : "#94a3b8"),
                                width: 8,
                                height: 8,
                                border: "2px solid rgba(255,255,255,0.3)",
                                transition: "background 0.15s",
                            }}
                        />
                        {/* Port label */}
                        <span
                            style={{
                                position: "absolute",
                                left: 12,
                                top,
                                transform: "translateY(-50%)",
                                fontSize: 8,
                                opacity: 0.6,
                                pointerEvents: "none",
                                whiteSpace: "nowrap",
                                color: "#fff",
                            }}
                        >
                            {port.id}
                        </span>
                    </React.Fragment>
                );
            })}

            {/* Node label — centred */}
            <div
                style={{
                    textAlign: "center",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#fff",
                    wordBreak: "break-word",
                    padding: "0 20px",
                }}
            >
                {label}
            </div>

            {/* Output handles — right side */}
            {outputPorts.map((port, idx) => {
                const totalPorts = outputPorts.length;
                const top = totalPorts === 1
                    ? "50%"
                    : `${((idx + 0.5) / totalPorts) * 100}%`;

                const color = portColor(port.id, "out");

                return (
                    <React.Fragment key={`out-${port.id}`}>
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={port.id}
                            style={{
                                top,
                                background: color ?? "#38bdf8",
                                width: 8,
                                height: 8,
                                border: "2px solid rgba(255,255,255,0.3)",
                                transition: "background 0.15s",
                            }}
                        />
                        {/* Port label */}
                        <span
                            style={{
                                position: "absolute",
                                right: 12,
                                top,
                                transform: "translateY(-50%)",
                                fontSize: 8,
                                opacity: 0.6,
                                pointerEvents: "none",
                                whiteSpace: "nowrap",
                                color: "#fff",
                                textAlign: "right",
                            }}
                        >
                            {port.id}
                        </span>
                    </React.Fragment>
                );
            })}
        </div>
    );
}
