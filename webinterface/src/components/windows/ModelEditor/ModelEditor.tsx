"use client"

import {IDockviewPanelProps} from "dockview-core";
import {ReactFlowProvider} from "@xyflow/react";
import ModelEditorInner from "./ModelEditorInner";

export default function ModelEditor(props: IDockviewPanelProps) {
    return (
        <ReactFlowProvider>
            <ModelEditorInner {...props} />
        </ReactFlowProvider>
    );
}
