"use client"

import {useEffect, useMemo, useState} from "react";
import {IDockviewPanelProps} from "dockview-core";
import {useClientStore, useDockviewStore} from "@/lib/store";
import {toast} from "sonner";
import Style from "./FileExplorer.module.css"
import {AnimatePresence, motion} from "framer-motion";

interface SlotDescriptor {
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

const defaultSlots: SlotDescriptor[] = [
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

const animationVariants = {
    initial: {opacity: 0, y: -10},
    open: {opacity: 1, y: 0},
    exit: {opacity: 0, y: -10},
};

function safeId(value: string) {
    return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function mergeSlots(base: SlotDescriptor[], incoming: any[] | undefined) {
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



export default function FileExplorer(_props: IDockviewPanelProps) {
    const client = useClientStore(state => state.client);
    const api = useDockviewStore(state => state.api);

    const [slots, setSlots] = useState<SlotDescriptor[]>(defaultSlots);
    const [loading, setLoading] = useState(false);
    const [openSlot, setOpenSlot] = useState<string | null>(null);

    async function refreshSlots() {
        if (!client) {
            setSlots(defaultSlots);
            return;
        }

        setLoading(true);
        try {
            const res = await client.getProjectFiles();
            if (res && !(res instanceof Error)) {
                setSlots(mergeSlots(defaultSlots, res.files || res.projectFiles));
            } else {
                setSlots(defaultSlots);
            }
        } catch (error) {
            setSlots(defaultSlots);
            // @ts-ignore
            toast.error("Failed to load project slots", {description: error?.message || "Unknown error"});
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refreshSlots();
    }, [client]);

    const uploadedSlots = useMemo(() => slots.filter((slot) => slot.section === "uploaded"), [slots]);
    const optimizedSlots = useMemo(() => slots.filter((slot) => slot.section === "optimized"), [slots]);

    function openVisualiser(slot: SlotDescriptor, visualization: any) {
        if (!api) {
            return;
        }

        const panelId = `Visualiser-${slot.key}`;
        const existing = api.getPanel(panelId);
        if (existing) {
            existing.api.setActive();
            return;
        }

        api.addPanel({
            id: panelId,
            component: "Visualiser",
            title: slot.label,
            params: {
                filePath: slot.path,
                fileName: slot.name,
                visualisation: visualization,
            },
        } as any);
    }

    function openModelEditor(slot: SlotDescriptor, descriptor?: any) {
        if (!api) {
            return;
        }

        const panelId = `ModelEditor-${slot.key}`;
        const existing = api.getPanel(panelId);
        if (existing) {
            existing.api.setActive();
            return;
        }

        api.addPanel({
            id: panelId,
            component: "ModelEditor",
            title: `Edit ${slot.label}`,
            params: {
                filePath: slot.path,
                fileName: slot.name,
                descriptor,
            },
        } as any);
    }

    function openOptimization(slot: SlotDescriptor) {
        if (!api) {
            return;
        }

        const panelId = `Optimization-${slot.key}`;
        const existing = api.getPanel(panelId);
        if (existing) {
            existing.api.setActive();
            return;
        }

        api.addPanel({
            id: panelId,
            component: "Optimization",
            title: `Optimize ${slot.label}`,
            params: {
                modelFilepath: slot.path,
            },
        } as any);
    }

    async function uploadSlot(slot: SlotDescriptor) {
        if (!client) {
            return;
        }

        const toastId = toast.loading(`Uploading ${slot.label}...`);
        try {
            const file = await client.GetFile(slot.accept);
            if (!file) {
                throw new Error("No file selected");
            }

            const res = await client.LoadModel(file);
            if (!res || res instanceof Error || (res as any).error) {
                throw new Error((res as any)?.error || "Upload failed");
            }

            await refreshSlots();
            toast.success(`${slot.label} uploaded`, {id: toastId, duration: 4000});
        } catch (error) {
            // @ts-ignore
            toast.error("Failed to upload file", {id: toastId, description: error?.message || "Unknown error"});
        }
    }

    async function visualiseSlot(slot: SlotDescriptor) {
        if (!client) {
            return;
        }

        const toastId = toast.loading(`Loading ${slot.label}...`);
        try {
            const res = await client.visualizeProjectFile(slot.path);
            if (!res || res instanceof Error || (res as any).error) {
                throw new Error((res as any)?.error || "Failed to visualise file");
            }

            openVisualiser(slot, res);
            toast.success(`Opened ${slot.label}`, {id: toastId, duration: 4000});
        } catch (error) {
            // @ts-ignore
            toast.error("Failed to visualise file", {id: toastId, description: error?.message || "Unknown error"});
        }
    }

    async function downloadSlot(slot: SlotDescriptor) {
        if (!client) {
            return;
        }

        const toastId = toast.loading(`Downloading ${slot.label}...`);
        try {
            const slotName = slot.key === "optimized_pt2" ? "pt2" : "onnx";
            const result = await client.DownloadOptimized(slotName, slot.name);
            if (result instanceof Error || result !== 200) {
                throw new Error("Download failed");
            }
            toast.success(`${slot.label} downloaded`, {id: toastId, duration: 4000});
        } catch (error) {
            // @ts-ignore
            toast.error("Failed to download file", {id: toastId, description: error?.message || "Unknown error"});
        }
    }

    function buildEmptyDescriptor() {
        return {
            model_name: "NewModel",
            input_shape: [-1, 1],
            output_shape: [-1, 1],
            nodes: [],
            edges: [{source: "input", target: "output", source_port: "output", target_port: "input"}],
            tensor_contracts: {},
            merge_rules: {},
            propagation_rules: "deterministic_forward",
        };
    }

    async function createNewPt2(slot: SlotDescriptor) {
        if (!client) {
            return;
        }

        const toastId = toast.loading("Creating new PT2...");
        try {
            const descriptor = buildEmptyDescriptor();
            const fileName = "new_model.pt2";
            const file = new File([JSON.stringify(descriptor, null, 2)], fileName, {type: "application/json"});

            const res = await client.LoadModel(file);
            if (!res || res instanceof Error || (res as any).error) {
                throw new Error((res as any)?.error || "Failed to create PT2");
            }

            await refreshSlots();
            openModelEditor(slot, descriptor);
            toast.success("Created new PT2", {id: toastId, duration: 4000});
        } catch (error) {
            // @ts-ignore
            toast.error("Failed to create PT2", {id: toastId, description: error?.message || "Unknown error"});
        }
    }

    async function editPt2(slot: SlotDescriptor) {
        if (!client) {
            return;
        }

        const toastId = toast.loading(`Opening editor...`);
        try {
            const res = await client.getModelDescriptor();
            if (!res || res instanceof Error || (res as any).error) {
                throw new Error((res as any)?.error || "Failed to load descriptor");
            }
            openModelEditor(slot, (res as any).descriptor);
            toast.success("Editor opened", {id: toastId, duration: 2500});
        } catch (error) {
            // @ts-ignore
            toast.error("Failed to open editor", {id: toastId, description: error?.message || "Unknown error"});
        }
    }

    function SlotCard({slot}: {slot: SlotDescriptor}) {
        const isOpen = openSlot === slot.key;
        const hasContent = slot.exists;

        return (
            <div className={Style.slot}>
                <button
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    onClick={() => setOpenSlot(isOpen ? null : slot.key)}
                >
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                            {hasContent ? slot.name : "empty slot"}
                        </span>
                        <span className="text-xs tracking-[0.2em] opacity-60">
                            {slot.label}
                        </span>
                    </div>
                    <span className="text-xs opacity-60">{isOpen ? "Close" : "Actions"}</span>
                </button>
                <AnimatePresence>
                {isOpen && (
                    <motion.div initial={"initial"} animate={"open"} exit={"exit"} variants={animationVariants} className="flex flex-wrap gap-2 border-t border-[var(--border-color)] px-2 py-2 justify-between">
                        <div className={"flex gap-[1rem]"}>
                            {
                                hasContent &&
                                <button
                                    className={Style.menuButton}
                                    onClick={() => visualiseSlot(slot)}
                                    disabled={!hasContent || !slot.canVisualize}
                                >
                                    Visualise <i className={"fa-solid fa-eye"}/>
                                </button>
                            }
                            {slot.canOptimize && (
                                <button
                                    className={Style.menuButton}
                                    onClick={() => openOptimization(slot)}
                                    disabled={!hasContent}
                                >
                                    Optimize <i className={"fa-solid fa-bolt"}/>
                                </button>
                            )}
                            {slot.canDownload && (
                                <button
                                    className={Style.menuButton}
                                    onClick={() => downloadSlot(slot)}
                                    disabled={!hasContent}
                                >
                                    Download <i className={"fa-solid fa-download"}/>
                                </button>
                            )}
                            {slot.accept === ".pt2" && (
                                <>
                                    <button
                                        className={Style.menuButton}
                                        onClick={() => editPt2(slot)}
                                        disabled={!hasContent}
                                    >
                                        Edit <i className={"fa-solid fa-pen"}/>
                                    </button>
                                    { !hasContent &&
                                        <button
                                            className={Style.menuButton}
                                            onClick={() => createNewPt2(slot)}
                                            disabled={hasContent}
                                        >
                                            New <i className="fa-solid fa-file"/>
                                        </button>
                                    }
                                </>
                            )}
                        </div>
                        {slot.canUpload && (
                            <button
                                className={Style.menuButton}
                                onClick={() => uploadSlot(slot)}
                            >
                                {hasContent ? "Replace" : "Upload"} <i className="fa-solid fa-upload"/>
                            </button>
                        )}

                    </motion.div>
                )}
                </AnimatePresence>
            </div>
        )
    }

    return (
        <div className={Style.container}>
                <section className={Style.section}>
                    <div className="px-1">
                        <h2 className="text-lg font-semibold">Uploaded</h2>
                        <p className="text-sm opacity-70">Source PT2 and ONNX files uploaded by the user.</p>
                    </div>
                    {uploadedSlots.map((slot) => <SlotCard key={slot.key} slot={slot} />)}
                </section>

                <section className={Style.section}>
                    <div className="px-1">
                        <h2 className="text-lg font-semibold">Optimized</h2>
                        <p className="text-sm opacity-70">Generated PT2 and ONNX outputs from the optimizer.</p>
                    </div>
                    {optimizedSlots.map((slot) => <SlotCard key={slot.key} slot={slot} />)}
                </section>
        </div>
    );
}
