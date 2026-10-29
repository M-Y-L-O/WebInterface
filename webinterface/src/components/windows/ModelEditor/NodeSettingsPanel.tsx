"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ParamField, ParamFieldType, Catalog, CatalogParamBlueprint } from "./types";
import { blueprintToFields, fieldsToParams, templateFieldsForType } from "./helpers";
import { blockAction, disabledReason, noteAction } from "./actionBlock";
import Style from "./ModelEditor.module.css";
import Dropdown from "@/components/structural/Dropdown";

interface NodeSettingsPanelProps {
    selectedNodeId: string | null;
    descriptor: any;
    catalog: Catalog | null;
    nodeTypeDraft: string;
    setNodeTypeDraft: (type: string) => void;
    nodeParamFields: ParamField[];
    addParamField: () => void;
    updateParamField: (id: string, patch: Partial<ParamField>) => void;
    removeParamField: (id: string) => void;
    applyTemplate: (overwrite: boolean) => void;
    quickAddType: string;
    setQuickAddType: (type: string) => void;
    quickAddNodeFromCanvas: () => void;
    busy: boolean;
    client: any;
    insertableTypes: string[];
    swappableActivations: string[];
    /** Called when user clicks "Apply Changes" (persisted edit) */
    onApplyChanges: (params: Record<string, any>) => void;
    onDeleteNode: () => void;
    onExpandNode: () => void;
    onCollapseNode: () => void;
    /** Called for live preview (debounced, not persisted) */
    onPreviewParams?: (params: Record<string, any>) => void;
    /** Current tensor shapes for the selected node from the last API response */
    shapes?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Blueprint-driven param field
// ---------------------------------------------------------------------------

interface BlueprintFieldProps {
    paramKey: string;
    schema: CatalogParamBlueprint;
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
}

function BlueprintField({ paramKey, schema, value, disabled, onChange }: BlueprintFieldProps) {
    const [showHelp, setShowHelp] = useState(false);

    const inputClass = "w-full rounded-lg border border-[var(--light-highlight)] bg-[var(--card-background)] px-2.5 py-1.5 text-xs text-[var(--text)] focus:border-[var(--accent-color)] focus:outline-none transition";

    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-semibold text-[var(--text)] flex-1" title={schema.description}>
                    {schema.label}
                    {schema.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                {schema.helpUrl && (
                    <a
                        href={schema.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-[var(--accent-color)] opacity-60 hover:opacity-100"
                    >
                        docs
                    </a>
                )}
                {schema.description && (
                    <button
                        type="button"
                        className="text-[9px] text-[var(--text-light)] hover:text-[var(--text)] transition"
                        onClick={() => setShowHelp(v => !v)}
                        title="Toggle description"
                    >
                        ?
                    </button>
                )}
            </div>

            {showHelp && schema.description && (
                <p className="text-[9px] text-[var(--text-light)] bg-white/5 rounded px-2 py-1 leading-relaxed">
                    {schema.description}
                </p>
            )}

            {schema.type === "boolean" ? (
                <div className="flex items-center gap-2 py-1">
                    <input
                        type="checkbox"
                        checked={value === "true"}
                        disabled={disabled}
                        onChange={(e) => onChange(e.target.checked ? "true" : "false")}
                        className="accent-[var(--primary)] w-4 h-4"
                    />
                    <span className="text-[10px] text-[var(--text)]">{value === "true" ? "Enabled" : "Disabled"}</span>
                </div>
            ) : schema.type === "integer" || schema.type === "float" ? (
                <input
                    type="number"
                    className={inputClass}
                    value={value}
                    min={schema.min}
                    max={schema.max}
                    step={schema.step ?? (schema.type === "float" ? 0.01 : 1)}
                    placeholder={schema.placeholder ?? String(schema.default ?? "")}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.value)}
                />
            ) : (
                <input
                    type="text"
                    className={inputClass}
                    value={value}
                    placeholder={schema.placeholder ?? String(schema.default ?? "")}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.value)}
                />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function NodeSettingsPanel({
    selectedNodeId,
    descriptor,
    catalog,
    nodeTypeDraft,
    setNodeTypeDraft,
    nodeParamFields,
    addParamField,
    updateParamField,
    removeParamField,
    applyTemplate,
    quickAddType,
    setQuickAddType,
    quickAddNodeFromCanvas,
    busy,
    client,
    insertableTypes,
    swappableActivations,
    onApplyChanges,
    onDeleteNode,
    onExpandNode,
    onCollapseNode,
    onPreviewParams,
    shapes,
}: NodeSettingsPanelProps) {
    const blueprint = catalog?.nodeParameterBlueprints?.[nodeTypeDraft] ?? null;
    const [showAdvanced, setShowAdvanced] = useState(false);
    const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Split blueprint params into basic and advanced
    const basicParams = blueprint
        ? Object.entries(blueprint).filter(([, s]) => !s.advanced)
        : null;
    const advancedParams = blueprint
        ? Object.entries(blueprint).filter(([, s]) => s.advanced)
        : null;

    const hasAdvanced = (advancedParams?.length ?? 0) > 0;

    // Helper to read current field value by key
    const fieldValue = (key: string) =>
        nodeParamFields.find(f => f.key === key)?.value ?? "";

    // Helper to update a field by key
    const updateFieldByKey = (key: string, value: string) => {
        const field = nodeParamFields.find(f => f.key === key);
        if (field) updateParamField(field.id, { value });
        // Trigger debounced preview
        if (previewTimer.current) clearTimeout(previewTimer.current);
        previewTimer.current = setTimeout(() => {
            const converted = fieldsToParams(nodeParamFields.map(f =>
                f.key === key ? { ...f, value } : f
            ));
            if (!converted.params) {
                noteAction("previewParams", "Skipped live preview — invalid field values", {
                    error: converted.error,
                    fieldKey: key,
                });
                return;
            }
            if (onPreviewParams) onPreviewParams(converted.params);
        }, 300);
    };

    // Shape display for selected node
    const nodeShape = selectedNodeId && shapes?.[selectedNodeId]
        ? JSON.stringify(shapes[selectedNodeId])
        : null;

    return (
        <div className={Style.sidePanelCont}>
            {selectedNodeId ? (
                <>
                    <h1>Node Settings</h1>

                    <div className="flex flex-col gap-4">
                        {/* Node ID badge */}
                        <div className="flex items-center gap-2 bg-[var(--accent-color)]/10 rounded-xl px-3 py-2">
                            <label className="text-[10px] uppercase font-bold tracking-wider opacity-50">Node ID</label>
                            <div className="font-mono text-xs text-[var(--text)] flex-1 truncate">{selectedNodeId}</div>
                            {nodeShape && (
                                <span
                                    className="text-[9px] text-[var(--accent-color)] opacity-70 shrink-0 font-mono"
                                    title="Output tensor shape"
                                >
                                    {nodeShape}
                                </span>
                            )}
                        </div>

                        {selectedNodeId !== "input" && selectedNodeId !== "output" && (
                            <>
                                {/* Node type selector */}
                                <div>
                                    <label className="text-[10px] uppercase font-bold tracking-wider opacity-50">Type</label>
                                    <Dropdown
                                        onChange={(e) => setNodeTypeDraft(e)}
                                        options={[...new Set([...insertableTypes, ...swappableActivations, nodeTypeDraft])]}
                                        defaultValue={nodeTypeDraft}
                                    />
                                </div>

                                {/* Parameters section */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] uppercase font-bold tracking-wider opacity-50">
                                            Parameters
                                        </label>
                                        {!blueprint && (
                                            <button
                                                className="text-[10px] text-[var(--accent-color)] hover:underline"
                                                onClick={() => applyTemplate(true)}
                                                disabled={busy || !client}
                                            >
                                                Reset Template
                                            </button>
                                        )}
                                    </div>

                                    {/* Blueprint-driven form */}
                                    {blueprint ? (
                                        <div className="flex flex-col gap-3">
                                            {(basicParams ?? []).map(([key, schema]) => (
                                                <BlueprintField
                                                    key={key}
                                                    paramKey={key}
                                                    schema={schema}
                                                    value={fieldValue(key)}
                                                    disabled={busy || !client}
                                                    onChange={(v) => updateFieldByKey(key, v)}
                                                />
                                            ))}

                                            {hasAdvanced && (
                                                <button
                                                    type="button"
                                                    className="self-start text-[10px] text-[var(--text-light)] hover:text-[var(--text)] transition flex items-center gap-1"
                                                    onClick={() => setShowAdvanced(v => !v)}
                                                >
                                                    <span className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}>▶</span>
                                                    Advanced
                                                </button>
                                            )}

                                            {showAdvanced && (advancedParams ?? []).map(([key, schema]) => (
                                                <BlueprintField
                                                    key={key}
                                                    paramKey={key}
                                                    schema={schema}
                                                    value={fieldValue(key)}
                                                    disabled={busy || !client}
                                                    onChange={(v) => updateFieldByKey(key, v)}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        /* Fallback: manual key-value editor */
                                        <div className={Style.parameters}>
                                            {nodeParamFields.length === 0 && (
                                                <div className="text-xs opacity-40 p-2 text-center">No parameters defined.</div>
                                            )}
                                            {nodeParamFields.map((field) => (
                                                <div key={`update-${field.id}`} className="flex flex-row gap-1.5 flex-nowrap items-center justify-evenly w-full">
                                                    <input
                                                        placeholder="name"
                                                        value={field.key}
                                                        onChange={(e) => updateParamField(field.id, { key: e.target.value })}
                                                        disabled={busy || !client}
                                                    />
                                                    <div className={"w-full"}>
                                                        <Dropdown
                                                            defaultValue={field.type.toString()}
                                                            onChange={(e) => updateParamField(field.id, { type: e as ParamFieldType })}
                                                            options={["string", "number", "boolean", "json"]}
                                                            small={true}
                                                        >
                                                        </Dropdown>
                                                    </div>
                                                    <input
                                                        placeholder="value"
                                                        value={field.value}
                                                        onChange={(e) => {
                                                            updateParamField(field.id, { value: e.target.value });
                                                            if (previewTimer.current) clearTimeout(previewTimer.current);
                                                            previewTimer.current = setTimeout(() => {
                                                                const converted = fieldsToParams(nodeParamFields.map(f =>
                                                                    f.id === field.id ? { ...f, value: e.target.value } : f
                                                                ));
                                                                if (!converted.params) {
                                                                    noteAction("previewParams", "Skipped live preview — invalid field values", {
                                                                        error: converted.error,
                                                                        fieldId: field.id,
                                                                    });
                                                                    return;
                                                                }
                                                                if (onPreviewParams) onPreviewParams(converted.params);
                                                            }, 300);
                                                        }}
                                                        disabled={busy || !client}
                                                    />
                                                    <button
                                                        className="text-[var(--text-light)] hover:text-red-400 p-1 text-xs transition"
                                                        onClick={() => removeParamField(field.id)}
                                                        disabled={busy || !client}
                                                        title="Remove field"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                className="mt-1 self-start rounded-lg border border-dashed border-[var(--border-color)] px-2.5 py-1 text-[11px] text-[var(--text-light)] transition hover:bg-[var(--card-background)] hover:text-[var(--text)] w-full"
                                                onClick={addParamField}
                                                disabled={busy || !client}
                                            >
                                                + Add Parameter
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-2 mt-1 justify-between">
                                    <button
                                        className={`${Style.save} w-[15rem]`}
                                        disabled={busy || !client || !selectedNodeId}
                                        title={disabledReason([
                                            { when: !client, reason: "No MYLO agent connected" },
                                            { when: busy, reason: "Editor is busy" },
                                            { when: !selectedNodeId, reason: "No node selected" },
                                        ]) || "Apply parameter changes"}
                                        onClick={() => {
                                            const converted = fieldsToParams(nodeParamFields);
                                            if (!converted.params) {
                                                blockAction("applyChanges", converted.error || "Could not convert fields to params", {
                                                    selectedNodeId,
                                                    fieldCount: nodeParamFields.length,
                                                });
                                                return;
                                            }
                                            onApplyChanges(converted.params);
                                        }}
                                    >
                                        Apply Changes
                                    </button>
                                    <button
                                        className="rounded-[0.5rem] border-2 border-red-500/30 hover:border-red-500/60 bg-red-950/20 hover:bg-red-500 text-red-400 hover:text-[var(--card-background)] px-[1rem] py-[0.5rem] text-xs transition w-[4rem]"
                                        disabled={busy || !client}
                                        title={disabledReason([
                                            { when: !client, reason: "No MYLO agent connected" },
                                            { when: busy, reason: "Editor is busy" },
                                        ]) || "Delete node"}
                                        onClick={onDeleteNode}
                                    >
                                        <i className="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            </>
                        )}

                        {selectedNodeId === "input" && (
                            <div className="text-xs text-[var(--text-light)] bg-white/5 p-2.5 rounded-xl border border-white/5 leading-relaxed">
                                The <code className="text-[var(--accent-color)]">input</code> node represents the initial
                                input tensor to the model. Its shape is configured globally.
                            </div>
                        )}
                        {selectedNodeId === "output" && (
                            <div className="text-xs text-[var(--text-light)] bg-white/5 p-2.5 rounded-xl border border-white/5 leading-relaxed">
                                The <code className="text-[var(--accent-color)]">output</code> node represents the final
                                output sink of the model. Its shape must match the target task.
                            </div>
                        )}
                    <div className="mt-auto pt-3 border-t border-[var(--light-highlight)]/30 flex flex-wrap gap-2 justify-between">
                        <button
                            className="rounded-full border border-[var(--light-highlight)] px-3 py-1 text-[11px] transition hover:bg-[var(--background)] disabled:opacity-40"
                            disabled={busy || !client || selectedNodeId === "input" || selectedNodeId === "output"}
                            title={disabledReason([
                                { when: !client, reason: "No MYLO agent connected" },
                                { when: busy, reason: "Editor is busy" },
                                {
                                    when: selectedNodeId === "input" || selectedNodeId === "output",
                                    reason: "input/output nodes cannot be expanded",
                                },
                            ]) || "Expand selected node"}
                            onClick={onExpandNode}
                        >
                            Expand Node
                        </button>
                        <button
                            className="rounded-full border border-[var(--light-highlight)] px-3 py-1 text-[11px] transition hover:bg-[var(--background)] disabled:opacity-40"
                            disabled={busy || !client || selectedNodeId === "input" || selectedNodeId === "output"}
                            title={disabledReason([
                                { when: !client, reason: "No MYLO agent connected" },
                                { when: busy, reason: "Editor is busy" },
                                {
                                    when: selectedNodeId === "input" || selectedNodeId === "output",
                                    reason: "input/output nodes cannot be collapsed",
                                },
                            ]) || "Collapse selected node"}
                            onClick={onCollapseNode}
                        >
                            Collapse Node
                        </button>
                    </div>
                    </div>

                </>
            ) : (
                <>
                    <h1>Blueprint Editor</h1>
                    <div>
                        <div className="flex flex-col gap-4 text-xs text-[var(--text-light)]">

                            <div>
                                <span className="font-semibold block text-[var(--text-light)] mb-1">Canvas Controls</span>
                                <ul className="list-disc pl-4 space-y-1.5 text-[var(--text)]">
                                    <li><strong className="text-[var(--text-light)]">Right Click</strong> on pane to add nodes.</li>
                                    <li><strong className="text-[var(--text-light)]">Click + Drag</strong> port handles to connect.</li>
                                    <li><strong className="text-[var(--text-light)]">Delete / Backspace</strong> to remove selected.</li>
                                    <li><strong className="text-[var(--text-light)]">Ctrl+Z / Ctrl+Y</strong> to undo / redo.</li>
                                    <li><strong className="text-[var(--text-light)]">Select</strong> node to customize parameters.</li>
                                </ul>
                            </div>

                            <div className="border-t border-[var(--light-highlight)] pt-3">
                                <span className="font-semibold block text-[var(--text-light)] mb-1.5">Quick Add Preset</span>
                                <div className="flex items-center gap-2">
                                    <Dropdown
                                        onChange={(e) => setQuickAddType(e)}
                                        options={insertableTypes}
                                        defaultValue={insertableTypes[0]}
                                    />
                                    <button
                                        className="rounded-xl border border-[var(--light-highlight)] bg-[var(--card-background)] px-3 py-1.5 text-xs transition hover:bg-neutral-800 disabled:opacity-40 font-semibold text-[var(--text-light)]"
                                        onClick={quickAddNodeFromCanvas}
                                        disabled={busy || !client}
                                        title={disabledReason([
                                            { when: !client, reason: "No MYLO agent connected" },
                                            { when: busy, reason: "Editor is busy" },
                                        ]) || "Add node from preset"}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
