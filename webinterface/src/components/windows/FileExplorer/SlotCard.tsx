"use client"

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SlotDescriptor } from "./types";
import { animationVariants } from "./helpers";
import Style from "./FileExplorer.module.css";

interface SlotCardProps {
    slot: SlotDescriptor;
    openSlot: string | null;
    setOpenSlot: (key: string | null) => void;
    visualiseSlot: (slot: SlotDescriptor) => void;
    openOptimization: (slot: SlotDescriptor) => void;
    downloadSlot: (slot: SlotDescriptor) => void;
    editPt2: (slot: SlotDescriptor) => void;
    createNewPt2: (slot: SlotDescriptor) => void;
    uploadSlot: (slot: SlotDescriptor) => void;
}

export default function SlotCard({
    slot,
    openSlot,
    setOpenSlot,
    visualiseSlot,
    openOptimization,
    downloadSlot,
    editPt2,
    createNewPt2,
    uploadSlot,
}: SlotCardProps) {
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
                        {slot.accept === ".pt2" && !slot.label.toLowerCase().startsWith("optimized") && (
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
                    <div className={"flex gap-[1rem]"}>
                        {slot.canDownload && hasContent && (
                            <button
                                className={Style.menuButton}
                                onClick={() => downloadSlot(slot)}
                                disabled={!hasContent}
                            >
                                Download <i className={"fa-solid fa-download"}/>
                            </button>
                        )}
                        {slot.canUpload && (
                            <button
                                className={Style.menuButton}
                                onClick={() => uploadSlot(slot)}
                            >
                                {hasContent ? "Replace" : "Upload"} <i className="fa-solid fa-upload"/>
                            </button>
                        )}
                    </div>

                </motion.div>
            )}
            </AnimatePresence>
        </div>
    )
}
