"use client"

import {useEffect, useMemo, useState} from "react";
import {IDockviewPanelProps} from "dockview-core";
import {useClientStore, useDockviewStore, useProjectStore} from "@/lib/store";
import {toast} from "sonner";
import Style from "./FileExplorer.module.css"
import {LoadCSV} from "@/lib/windows/Actions";
import {EditorTemplate, SlotDescriptor} from "./types";
import {defaultSlots, mergeSlots} from "./helpers";
import SlotCard from "./SlotCard";
import TemplatePicker from "./TemplatePicker";

function normalizeTemplates(payload: any): EditorTemplate[] {
    const raw = payload?.templates ?? payload;
    if (!raw || typeof raw !== "object") {
        return [];
    }

    // Agent returns { templates: { id: { label, description, descriptor } } }
    if (!Array.isArray(raw)) {
        return Object.entries(raw).map(([id, value]: [string, any]) => ({
            id,
            label: value?.label || id,
            description: value?.description || "",
            descriptor: value?.descriptor || value,
        }));
    }

    return raw.map((item: any, index: number) => ({
        id: item?.id || item?.model_name || `template_${index}`,
        label: item?.label || item?.model_name || `Template ${index + 1}`,
        description: item?.description || "",
        descriptor: item?.descriptor || item,
    }));
}

export default function FileExplorer(_props: IDockviewPanelProps) {
    const client = useClientStore(state => state.client);
    const api = useDockviewStore(state => state.api);
    const project = useProjectStore(state => state.project);
    const projectName = project?.projectData?.name ?? "No project loaded";
    const csvFile = project?.projectData?.csvFile ?? "";

    const [slots, setSlots] = useState<SlotDescriptor[]>(defaultSlots);
    const [loading, setLoading] = useState(false);
    const [openSlot, setOpenSlot] = useState<string | null>(null);
    const [templatePickerSlot, setTemplatePickerSlot] = useState<SlotDescriptor | null>(null);
    const [templates, setTemplates] = useState<EditorTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);

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
            existing.api.updateParameters({
                filePath: slot.path,
                fileName: slot.name,
                visualisation: visualization,
                modelRevision: Date.now(),
            });
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
            if (descriptor) {
                existing.api.updateParameters({
                    filePath: slot.path,
                    fileName: slot.name,
                    descriptor,
                });
            }
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

    function openDiagnostics(slot: SlotDescriptor) {
        if (!api) {
            return;
        }

        const panelId = `Diagnostics-${slot.key}`;
        const existing = api.getPanel(panelId);
        if (existing) {
            existing.api.setActive();
            return;
        }

        api.addPanel({
            id: panelId,
            component: "Diagnostics",
            title: `Diagnose - ${slot.name}`,
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
            let res: any = null;

            // Uploaded models are edited via descriptor.json — prefer that over
            // re-analysing the binary (which can overwrite a just-saved edit).
            if (slot.section === "uploaded") {
                const descRes = await client.getModelDescriptor();
                if (descRes && !(descRes instanceof Error) && (descRes as any)?.descriptor) {
                    res = await client.visualizeModel({
                        descriptor: (descRes as any).descriptor,
                    });
                }
            }

            if (!res || res instanceof Error || (res as any)?.error) {
                res = await client.visualizeProjectFile(slot.path);
            }

            if (!res || res instanceof Error || (res as any).error) {
                throw new Error((res as any)?.error || "Failed to visualise file");
            }

            useProjectStore.getState().setVisualisation(res);
            const project = useProjectStore.getState().project;
            if (project && slot.section === "uploaded") {
                useProjectStore.getState().setProject({
                    ...project,
                    modelData: res,
                });
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

    async function openNewPt2Picker(slot: SlotDescriptor) {
        if (!client) {
            return;
        }

        setTemplatePickerSlot(slot);
        setTemplatesLoading(true);
        try {
            const res = await client.getEditorTemplates();
            if (!res || res instanceof Error || (res as any).error) {
                throw new Error((res as any)?.error || "Failed to load templates");
            }
            setTemplates(normalizeTemplates(res));
        } catch (error) {
            setTemplates([]);
            // @ts-ignore
            toast.error("Failed to load templates", {description: error?.message || "Unknown error"});
        } finally {
            setTemplatesLoading(false);
        }
    }

    async function createNewPt2(slot: SlotDescriptor, template: EditorTemplate | null) {
        if (!client) {
            return;
        }

        setTemplatePickerSlot(null);
        const toastId = toast.loading(template ? `Creating ${template.label}...` : "Creating new PT2...");
        try {
            const descriptor = template
                ? {
                    ...template.descriptor,
                    tensor_contracts: template.descriptor.tensor_contracts || {},
                    merge_rules: template.descriptor.merge_rules || {},
                    propagation_rules: template.descriptor.propagation_rules || "deterministic_forward",
                }
                : buildEmptyDescriptor();
            const fileName = `${template?.id || "new_model"}.pt2`;
            const file = new File([JSON.stringify(descriptor, null, 2)], fileName, {type: "application/json"});

            const res = await client.LoadModel(file);
            if (!res || res instanceof Error || (res as any).error) {
                throw new Error((res as any)?.error || "Failed to create PT2");
            }

            await refreshSlots();

            // Prefer the agent-canonical descriptor after load
            let editorDescriptor = descriptor;
            const saved = await client.getModelDescriptor();
            if (saved && !(saved instanceof Error) && (saved as any)?.descriptor) {
                editorDescriptor = (saved as any).descriptor;
            }

            openModelEditor(slot, editorDescriptor);
            toast.success(template ? `Created ${template.label}` : "Created new PT2", {id: toastId, duration: 4000});
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

    async function generateOnnxFromPt2() {
        if (!client) {
            return;
        }

        const toastId = toast.loading("Generating ONNX from PT2...");
        try {
            const res = await client.generateOnnxFromPt2();
            if (!res || res instanceof Error || (res as any).error) {
                throw new Error((res as any)?.error || "Failed to generate ONNX");
            }

            if (Array.isArray((res as any).files)) {
                setSlots(mergeSlots(defaultSlots, (res as any).files));
            } else {
                await refreshSlots();
            }
            toast.success("ONNX generated from PT2", {id: toastId, duration: 4000});
        } catch (error) {
            // @ts-ignore
            toast.error("Failed to generate ONNX", {id: toastId, description: error?.message || "Unknown error"});
        }
    }

    const pt2Exists = useMemo(
        () => Boolean(slots.find((slot) => slot.key === "uploaded_pt2")?.exists),
        [slots],
    );

    return (
        <div className={Style.container}>
            <div className={"flex justify-between items-center gap-[2rem] ml-[1rem]"}>
                <div>
                    <h2 className={"text-[var(--light-highlight)]"}>Loaded Project:</h2>
                    <h1 className={"text-2xl"}>{projectName}</h1>
                </div>
                <button className={Style.menuButton} onClick={() => refreshSlots()}><i className={"fa-solid fa-refresh"}></i></button>
            </div>
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
                        openDiagnostics={openDiagnostics}
                        downloadSlot={downloadSlot}
                        editPt2={editPt2}
                        createNewPt2={openNewPt2Picker}
                        uploadSlot={uploadSlot}
                        generateOnnxFromPt2={generateOnnxFromPt2}
                        canGenerateOnnx={pt2Exists}
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
                        openDiagnostics={openDiagnostics}
                        downloadSlot={downloadSlot}
                        editPt2={editPt2}
                        createNewPt2={openNewPt2Picker}
                        uploadSlot={uploadSlot}
                    />
                ))}
            </section>
            <section className={`p-[1rem] w-full`}>
                <div className="border-b border-[var(--light-highlight)]/70 pb-1 ">
                    <h2 className="text-lg font-semibold">CSV Data</h2>
                </div>
                <div className={"bg-[var(--background)]  px-4 py-2 rounded-lg flex justify-between items-center"}>
                    <h2>{csvFile || "No dataset"}</h2>
                    <div>
                        <button className={Style.menuButton} onClick={() => LoadCSV(client)}>Load CSV</button>
                    </div>
                </div>
            </section>

            <TemplatePicker
                open={Boolean(templatePickerSlot)}
                loading={templatesLoading}
                templates={templates}
                onClose={() => setTemplatePickerSlot(null)}
                onSelect={(template) => {
                    if (templatePickerSlot) {
                        createNewPt2(templatePickerSlot, template);
                    }
                }}
            />
        </div>
    );
}
