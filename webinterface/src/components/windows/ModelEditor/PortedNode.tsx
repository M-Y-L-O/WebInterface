"use client";

import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { CatalogNodePorts } from "./types";
import Style from "./portedNode.module.css"
import {getNodeColor} from "@/lib/windows/visualiserHelpers";

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
export default function PortedNode({ data }: NodeProps) {
    const nodeData = data as unknown as PortedNodeData;
    const { label, ports, invalidPorts, validPorts } = nodeData;
    const color = getNodeColor(label);

    const inputPorts = ports?.inputs ?? [{ id: "input", required: true }];
    const outputPorts = ports?.outputs ?? [{ id: "output", required: false }];

    function portColor(portId: string, side: "in" | "out") {
        if (validPorts?.has(`${side}:${portId}`)) return "#4ade80";
        if (invalidPorts?.has(`${side}:${portId}`)) return "#f87171";
        return undefined; // default ReactFlow colour
    }

    return (
        <div className={Style.node}>
            <div
                style={{
                    background: color ?? "var(--card-background)",
                }}
                className={Style.nodeHeader}
            >
                {label}
            </div>
            <div className={Style.connectors}>
                {/* Input handles — left side, stacked under header */}
                <div className={Style.portsHolder}>
                    {inputPorts.map((port) => {
                        const accent = portColor(port.id, "in");

                        return (
                            <div className={Style.port} key={`in-${port.id}`}>
                                <Handle
                                    type="target"
                                    position={Position.Left}
                                    id={port.id}
                                    className={Style.handle}
                                    style={{
                                        width: 16,
                                        height: 16,
                                        border: "none",
                                        background: "none",
                                    }}
                                >
                                    <div
                                        style={{ color: accent ?? "#ffffff" }}
                                        className={Style.target}
                                    >
                                        <i className={"fa-solid fa-circle-half"}></i>
                                    </div>
                                </Handle>
                                <span className={Style.portLabel}>{port.id}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Output handles — right side, stacked under header */}
                <div className={`${Style.portsHolder} ${Style.portsHolderOut}`}>
                    {outputPorts.map((port) => {
                        const accent = portColor(port.id, "out");

                        return (
                            <div
                                className={`${Style.port} ${Style.portOut}`}
                                key={`out-${port.id}`}
                            >
                                <span className={`${Style.portLabel} ${Style.portLabelOut}`}>
                                    {port.id}
                                </span>
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={port.id}
                                    className={Style.handle}
                                    style={{
                                        width: 16,
                                        height: 16,
                                        border: "none",
                                        background: "none",
                                    }}
                                >
                                    <div
                                        style={{ color: accent ?? "#ffffff" }}
                                        className={Style.source}
                                    >
                                        <i className={"fa-solid fa-caret-right"}></i>
                                    </div>
                                </Handle>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
