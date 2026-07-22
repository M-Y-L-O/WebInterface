export interface SlotDescriptor {
    key: "uploaded_pt2" | "uploaded_onnx" | "optimized_pt2" | "optimized_onnx";
    section: "uploaded" | "optimized";
    label: string;
    accept: string;
    path: string;
    name: string;
    exists: boolean;
    canUpload: boolean;
    canVisualize: boolean;
    canOptimize: boolean;
    canDownload: boolean;
}

/** A starter architecture from GET /editor/templates */
export interface EditorTemplate {
    id: string;
    label: string;
    description: string;
    descriptor: Record<string, any>;
}
