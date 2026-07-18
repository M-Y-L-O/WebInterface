import { SlotDescriptor } from "./types";

export const defaultSlots: SlotDescriptor[] = [
    {
        key: "uploaded_pt2",
        section: "uploaded",
        label: "Uploaded PT2",
        accept: ".pt2",
        path: "",
        name: "",
        exists: false,
        canUpload: true,
        canVisualize: true,
        canOptimize: true,
        canDownload: false,
    },
    {
        key: "uploaded_onnx",
        section: "uploaded",
        label: "Uploaded ONNX",
        accept: ".onnx",
        path: "",
        name: "",
        exists: false,
        canUpload: true,
        canVisualize: true,
        canOptimize: false,
        canDownload: false,
    },
    {
        key: "optimized_pt2",
        section: "optimized",
        label: "Optimized PT2",
        accept: ".pt2",
        path: "",
        name: "",
        exists: false,
        canUpload: false,
        canVisualize: true,
        canOptimize: false,
        canDownload: true,
    },
    {
        key: "optimized_onnx",
        section: "optimized",
        label: "Optimized ONNX",
        accept: ".onnx",
        path: "",
        name: "",
        exists: false,
        canUpload: false,
        canVisualize: true,
        canOptimize: false,
        canDownload: true,
    },
];

export const animationVariants = {
    initial: {opacity: 0, y: -10},
    open: {opacity: 1, y: 0},
    exit: {opacity: 0, y: -10},
};

export function safeId(value: string) {
    return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

export function mergeSlots(base: SlotDescriptor[], incoming: any[] | undefined) {
    const incomingByKey = new Map<string, any>();
    (incoming || []).forEach((slot) => {
        if (slot?.key) {
            incomingByKey.set(slot.key, slot);
        }
    });

    return base.map((slot) => {
        const remote = incomingByKey.get(slot.key);
        if (!remote) {
            return slot;
        }

        return {
            ...slot,
            ...remote,
            exists: Boolean(remote.exists),
            canUpload: Boolean(remote.canUpload),
            canVisualize: Boolean(remote.canVisualize),
            canOptimize: Boolean(remote.canOptimize),
            canDownload: Boolean(remote.canDownload),
        };
    });
}
