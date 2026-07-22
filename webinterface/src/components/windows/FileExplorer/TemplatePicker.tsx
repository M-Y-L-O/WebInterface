"use client"

import { AnimatePresence, motion } from "framer-motion";
import { EditorTemplate } from "./types";
import Style from "./FileExplorer.module.css";

interface TemplatePickerProps {
    open: boolean;
    loading: boolean;
    templates: EditorTemplate[];
    onClose: () => void;
    onSelect: (template: EditorTemplate | null) => void;
}

export default function TemplatePicker({
    open,
    loading,
    templates,
    onClose,
    onSelect,
}: TemplatePickerProps) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className={Style.pickerOverlay}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className={Style.pickerPanel}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={Style.pickerHeader}>
                            <div>
                                <h2 className={Style.pickerTitle}>New PT2</h2>
                                <p className={Style.pickerSubtitle}>
                                    Choose a starter architecture, or start blank.
                                </p>
                            </div>
                            <button className={Style.menuButton} onClick={onClose} type="button">
                                Close
                            </button>
                        </div>

                        {loading ? (
                            <p className={Style.pickerStatus}>Loading templates...</p>
                        ) : (
                            <div className={Style.pickerList}>
                                <button
                                    type="button"
                                    className={Style.pickerOption}
                                    onClick={() => onSelect(null)}
                                >
                                    <span className={Style.pickerOptionLabel}>Blank model</span>
                                    <span className={Style.pickerOptionDesc}>
                                        Empty graph — build the architecture from scratch.
                                    </span>
                                </button>

                                {templates.length === 0 ? (
                                    <p className={Style.pickerStatus}>
                                        No templates available from the agent.
                                    </p>
                                ) : (
                                    templates.map((template) => (
                                        <button
                                            key={template.id}
                                            type="button"
                                            className={Style.pickerOption}
                                            onClick={() => onSelect(template)}
                                        >
                                            <span className={Style.pickerOptionLabel}>
                                                {template.label}
                                            </span>
                                            <span className={Style.pickerOptionDesc}>
                                                {template.description}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
