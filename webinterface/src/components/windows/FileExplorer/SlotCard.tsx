"use client"

import React from "react";
import { SlotDescriptor } from "./types";
import Style from "./FileExplorer.module.css";
import VisualiserPreview from "@/components/functional/Visualiser/GraphPreview";

interface SlotCardProps {
    slot: SlotDescriptor;
    visualisation?: any | null;
    visualiseSlot: (slot: SlotDescriptor, opts?: { forceRefresh?: boolean }) => void;
    openCachedVisualiser?: (slot: SlotDescriptor) => void;
    openOptimization: (slot: SlotDescriptor) => void;
    openDiagnostics: (slot: SlotDescriptor) => void;
    downloadSlot: (slot: SlotDescriptor) => void;
    editPt2: (slot: SlotDescriptor) => void;
    createNewPt2: (slot: SlotDescriptor) => void;
    uploadSlot: (slot: SlotDescriptor) => void;
    generateOnnxFromPt2?: () => void;
    canGenerateOnnx?: boolean;
}

export default function SlotCard({
    slot,
    visualisation,
    visualiseSlot,
    openCachedVisualiser,
    openOptimization,
    openDiagnostics,
    downloadSlot,
    editPt2,
    createNewPt2,
    uploadSlot,
    generateOnnxFromPt2,
    canGenerateOnnx = false,
}: SlotCardProps) {
    const hasContent = slot.exists;
    const hasPreview = Boolean(visualisation?.nodes);

    function handlePreviewClick() {
        if (hasPreview && openCachedVisualiser) {
            openCachedVisualiser(slot);
            return;
        }
        visualiseSlot(slot);
    }

    return (
        <div className={Style.slot}>
            <div className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left mt-1.5 ml-1">
                <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-xl">
                        {hasContent ? slot.name : "empty slot"}
                    </span>
                    <span className="text-xs tracking-[0.2em] opacity-60">
                        {slot.label}
                    </span>
                </div>
            </div>

            {hasContent && slot.canVisualize && (
                <div
                    className={Style.previewButton}
                    title={hasPreview ? "Open cached visualisation" : "Generate visualisation"}
                    aria-label={hasPreview ? `Open ${slot.label} visualisation` : `Visualise ${slot.label}`}
                    onClick={
                        ()=>{
                            if(hasContent && slot.accept === ".pt2" && !slot.label.toLowerCase().startsWith("optimized"))
                                editPt2(slot)
                            else
                                handlePreviewClick()
                        }
                    }
                >
                    {hasPreview ? (
                        <div className={Style.previewCanvas}>
                            <VisualiserPreview
                                visualisation={visualisation}
                                className="h-full w-full"
                            />
                        </div>
                    ) : (
                        <div className={Style.previewPlaceholder}>
                            <i className="fa-solid fa-diagram-project" />
                            <span>Visualisation Pending</span>
                        </div>
                    )}
                    <div>
                        {(hasContent && slot.accept === ".pt2" && !slot.label.toLowerCase().startsWith("optimized")) ? (
                            <div
                                className={Style.previewActionButton}
                            >
                                Edit <i className={"fa-solid fa-pen"} />
                            </div>
                        ) : (<div className={Style.previewActionButton}>
                            Visualise <i className={"fa-solid fa-eye"} />
                        </div>)  }

                    </div>
                </div>

            )}
            {hasContent && slot.accept === ".pt2" && !slot.label.toLowerCase().startsWith("optimized") && (
                <div className={Style.slotMainActions}>
                    <button
                        onClick={() => openOptimization(slot)}
                        disabled={!hasContent}
                    >
                        Optimize <i className={"fa-solid fa-bolt"} />
                    </button>
                    <div className={Style.divider}/>
                    <button
                        onClick={() => openDiagnostics(slot)}
                        disabled={!hasContent}
                    >
                        Diagnose <i className={"fa-solid fa-stethoscope"} />
                    </button>

                </div>
            )}
            <div className={Style.slotSecondaryActions}>
                {slot.canDownload && hasContent && (
                    <button
                        className={Style.menuButton}
                        onClick={() => downloadSlot(slot)}
                        disabled={!hasContent}
                    >
                        Download <i className={"fa-solid fa-download"} />
                    </button>
                )}
                {slot.canUpload && (
                    <button
                        className={`${Style.menuButton} ${Style.middle}`}
                        onClick={() => uploadSlot(slot)}
                    >
                        {hasContent ? "Replace" : "Upload"} <i className="fa-solid fa-upload" />
                    </button>
                )}
                {slot.canUpload && slot.accept === ".pt2" && (
                    <button
                        className={Style.menuButton}
                        onClick={() => createNewPt2(slot)}
                    >
                        New <i className="fa-solid fa-file" />
                    </button>
                )}
                {slot.key === "uploaded_onnx" && generateOnnxFromPt2 && (
                    <button
                        className={Style.menuButton}
                        onClick={() => generateOnnxFromPt2()}
                        disabled={!canGenerateOnnx}
                        title={canGenerateOnnx ? "Convert uploaded PT2 to ONNX" : "Upload a PT2 first"}
                    >
                        Generate <i className="fa-solid fa-gears" />
                    </button>
                )}
            </div>
        </div>
    );
}
