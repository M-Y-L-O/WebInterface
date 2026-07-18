"use client"

import {useEffect, useMemo, useState} from "react";
import {IDockviewPanelProps} from "dockview-core";
import {useClientStore, useDockviewStore} from "@/lib/store";
import {toast} from "sonner";
import Style from "./FileExplorer.module.css"
import {LoadCSV} from "@/lib/windows/Actions";
import {SlotDescriptor} from "./types";
import {defaultSlots, mergeSlots} from "./helpers";
import SlotCard from "./SlotCard";

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
            title: "Visualise - " + slot.name,
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
            title: `Edit - ${slot.name}`,
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
            title: `Optimize - ${slot.name}`,
            params: {
                modelFilepath: slot.path,
            },
        } as any);
    }

    async function uploadSlot(slot: SlotDescriptor) {
        if (!client) {
            return;
        }

        const toastId = toast.loading(`Uploading model...`);
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
            toast.success(`${slot.name} uploaded`, {id: toastId, duration: 4000});
        } catch (error) {
            // @ts-ignore
            toast.error("Failed to upload file", {id: toastId, description: error?.message || "Unknown error"});
        }
    }

    async function visualiseSlot(slot: SlotDescriptor) {
        if (!client) {
            return;
        }

        const toastId = toast.loading(`Opening ${slot.name}...`);
        try {
            const res = await client.visualizeProjectFile(slot.path);
            if (!res || res instanceof Error || (res as any).error) {
                throw new Error((res as any)?.error || "Failed to visualise file");
            }

            openVisualiser(slot, res);
            toast.success(`Opened ${slot.name}`, {id: toastId, duration: 4000});
        } catch (error) {
            // @ts-ignore
            toast.error("Failed to visualise file", {id: toastId, description: error?.message || "Unknown error"});
        }
    }

    async function downloadSlot(slot: SlotDescriptor) {
        if (!client) {
            return;
        }

        const toastId = toast.loading(`Downloading ${slot.name}...`);
        try {
            const slotName = slot.key === "optimized_pt2" ? "pt2" : "onnx";
            const result = await client.DownloadOptimized(slotName, slot.name);
            if (result instanceof Error || result !== 200) {
                throw new Error("Download failed");
            }
            toast.success(`${slot.name} downloaded`, {id: toastId, duration: 4000});
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

    return (
        <div className={Style.container}>
            <section className={Style.section}>
                <div className="border-b border-[var(--light-highlight)]/70 pb-1 ">
                    <h2 className="text-lg font-semibold">Uploaded</h2>
                </div>
                {uploadedSlots.map((slot) => (
                    <SlotCard
                        key={slot.key}
                        slot={slot}
                        openSlot={openSlot}
                        setOpenSlot={setOpenSlot}
                        visualiseSlot={visualiseSlot}
                        openOptimization={openOptimization}
                        downloadSlot={downloadSlot}
                        editPt2={editPt2}
                        createNewPt2={createNewPt2}
                        uploadSlot={uploadSlot}
                    />
                ))}
            </section>

            <section className={Style.section}>
                <div className="border-b border-[var(--light-highlight)]/70 pb-1 ">
                    <h2 className="text-lg font-semibold">Optimized</h2>
                </div>
                {optimizedSlots.map((slot) => (
                    <SlotCard
                        key={slot.key}
                        slot={slot}
                        openSlot={openSlot}
                        setOpenSlot={setOpenSlot}
                        visualiseSlot={visualiseSlot}
                        openOptimization={openOptimization}
                        downloadSlot={downloadSlot}
                        editPt2={editPt2}
                        createNewPt2={createNewPt2}
                        uploadSlot={uploadSlot}
                    />
                ))}
            </section>
            <section className={Style.section}>
                <div className="border-b border-[var(--light-highlight)]/70 pb-1 ">
                    <h2 className="text-lg font-semibold">CSV Data</h2>
                </div>
                <button onClick={() => LoadCSV(client)}>Load CSV</button>
            </section>
        </div>
    );
}
