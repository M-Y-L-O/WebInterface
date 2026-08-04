"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ModelDiagnosticsReport, OptimizationReport, ProgressUpdate } from "@/lib/client/ClientTypes";
import type { DiagnosticsRunState, OptimizationRunState, ProjectVisualisations, VisualisationSlotKey } from "./types";

export type { ProjectVisualisations, VisualisationSlotKey };

/** File-explorer / agent slot keys → store visualisation keys */
export const SLOT_TO_VIZ_KEY: Record<string, VisualisationSlotKey> = {
    uploaded_pt2: "uploadedPt2",
    uploaded_onnx: "uploadedOnnx",
    optimized_pt2: "optimizedPt2",
    optimized_onnx: "optimizedOnnx",
    // camelCase variants used by some panel ids
    uploadedPt2: "uploadedPt2",
    uploadedOnnx: "uploadedOnnx",
    optimizedPt2: "optimizedPt2",
    optimizedOnnx: "optimizedOnnx",
};

export function emptyVisualisations(): ProjectVisualisations {
    return {
        uploadedPt2: null,
        uploadedOnnx: null,
        optimizedPt2: null,
        optimizedOnnx: null,
    };
}

export function resolveVizSlotKey(slotOrKey: string | null | undefined): VisualisationSlotKey | null {
    if (!slotOrKey) return null;
    return SLOT_TO_VIZ_KEY[slotOrKey] ?? null;
}

/** Prefer uploaded PT2, then any other non-null graph (for AI / legacy callers). */
export function getPrimaryVisualisation(
    visualisations: ProjectVisualisations | null | undefined,
): any | null {
    if (!visualisations) return null;
    return (
        visualisations.uploadedPt2 ??
        visualisations.uploadedOnnx ??
        visualisations.optimizedPt2 ??
        visualisations.optimizedOnnx ??
        null
    );
}

type ProjectStore = {
    project: any | null;
    csv: any | null;
    visualisations: ProjectVisualisations;
    optimizationRun: OptimizationRunState | null;
    diagnosticsRun: DiagnosticsRunState | null;
    /** Live in-editor descriptor draft — reflects unsaved modifications. */
    descriptorDraft: any | null;

    setProject: (project: any | null) => void;
    setCsv: (csv: any | null) => void;
    setDescriptorDraft: (descriptor: any | null) => void;
    clearDescriptorDraft: () => void;

    /** Set one slot's cached graph. Prefer this over the typed setters. */
    setSlotVisualisation: (slotKey: string, visualisation: any | null) => void;
    setUploadPt2: (pt2: any | null) => void;
    setUploadOnnx: (onnx: any | null) => void;
    setOptimizedPt2: (pt2: any | null) => void;
    setOptimizedOnnx: (onnx: any | null) => void;
    /** Replace the entire map (or reset to empty when null). */
    setVisualisations: (visualisations: ProjectVisualisations | null) => void;

    hydrateFromProject: (project: any | null) => void;
    clearProject: () => void;
    clearVisualisation: (slotKey?: string) => void;

    beginOptimizationRun: () => void;
    appendOptimizationUpdate: (update: ProgressUpdate) => void;
    setOptimizationResult: (payload: {
        result?: OptimizationReport | null;
        report?: OptimizationReport | null;
        runError?: string | null;
    }) => void;
    clearOptimizationRun: () => void;

    beginDiagnosticsRun: () => void;
    setDiagnosticsResult: (payload: {
        result?: ModelDiagnosticsReport | null;
        report?: ModelDiagnosticsReport | null;
        runError?: string | null;
    }) => void;
    clearDiagnosticsRun: () => void;
};

function projectIdOf(project: any | null): string | null {
    const id = project?.projectData?.id ?? project?.id ?? null;
    return id != null ? String(id) : null;
}

function normalizeProjectPayload(raw: any | null): any | null {
    if (!raw) return null;
    if (raw.projectData) return raw;
    return {
        projectData: {
            name: raw.name ?? "Untitled",
            csvFile: raw.csvFile ?? raw.csvFilepath ?? "",
            modelFile: raw.modelFile ?? raw.modelFilepath ?? "",
            uploadedPt2File: raw.uploadedPt2File ?? "",
            uploadedOnnxFile: raw.uploadedOnnxFile ?? "",
            optimizedPt2File: raw.optimizedPt2File ?? "",
            optimizedOnnxFile: raw.optimizedOnnxFile ?? "",
            id: raw.id ?? "",
        },
        modelData: raw.modelData ?? null,
        csvData: raw.csvData ?? null,
        hasDiagnosticsReport: raw.hasDiagnosticsReport ?? false,
        diagnosticsReport: raw.diagnosticsReport ?? null,
        hasOptimizationReport: raw.hasOptimizationReport ?? false,
        optimizationSummary: raw.optimizationSummary ?? null,
    };
}

function diagnosticsRunFromProject(raw: any | null): DiagnosticsRunState | null {
    const report = raw?.diagnosticsReport;
    if (!report || typeof report !== "object" || report.error) {
        return null;
    }
    return {
        result: report as ModelDiagnosticsReport,
        report: report as ModelDiagnosticsReport,
        runError: null,
        completedAt: Date.now(),
    };
}

function patchVisualisation(
    state: { visualisations: ProjectVisualisations },
    key: VisualisationSlotKey,
    value: any | null,
): { visualisations: ProjectVisualisations } {
    return {
        visualisations: {
            ...state.visualisations,
            [key]: value,
        },
    };
}

/** Migrate legacy singular `visualisation` or partial maps into the full keyed shape. */
function normalizeVisualisations(raw: unknown, fallbackModelData?: unknown): ProjectVisualisations {
    const base = emptyVisualisations();
    if (!raw || typeof raw !== "object") {
        if (fallbackModelData) {
            base.uploadedPt2 = fallbackModelData;
        }
        return base;
    }

    const obj = raw as Record<string, unknown>;

    // Already a keyed map (possibly partial)
    if (
        "uploadedPt2" in obj ||
        "uploadedOnnx" in obj ||
        "optimizedPt2" in obj ||
        "optimizedOnnx" in obj
    ) {
        return {
            uploadedPt2: (obj.uploadedPt2 as any) ?? null,
            uploadedOnnx: (obj.uploadedOnnx as any) ?? null,
            optimizedPt2: (obj.optimizedPt2 as any) ?? null,
            optimizedOnnx: (obj.optimizedOnnx as any) ?? null,
        };
    }

    // Legacy singular graph object (has nodes/edges)
    if (Array.isArray(obj.nodes) || Array.isArray(obj.edges) || obj.summary) {
        base.uploadedPt2 = raw;
        return base;
    }

    if (fallbackModelData) {
        base.uploadedPt2 = fallbackModelData;
    }
    return base;
}

export function getProjectId(project: any | null = useProjectStore.getState().project): string | null {
    return projectIdOf(project);
}

const emptyOptimizationRun = (): OptimizationRunState => ({
    result: null,
    report: null,
    updates: [],
    runError: null,
    completedAt: null,
});

const emptyDiagnosticsRun = (): DiagnosticsRunState => ({
    result: null,
    report: null,
    runError: null,
    completedAt: null,
});

export const useProjectStore = create<ProjectStore>()(
    persist(
        (set) => ({
            project: null,
            csv: null,
            visualisations: emptyVisualisations(),
            optimizationRun: null,
            diagnosticsRun: null,
            descriptorDraft: null,

            setProject: (project) => set({ project }),

            setCsv: (csv) => set({ csv }),

            setSlotVisualisation: (slotKey, visualisation) => {
                const key = resolveVizSlotKey(slotKey);
                if (!key) return;
                set((state) => patchVisualisation(state, key, visualisation));
            },

            setUploadPt2: (pt2) => set((state) => patchVisualisation(state, "uploadedPt2", pt2)),
            setUploadOnnx: (onnx) => set((state) => patchVisualisation(state, "uploadedOnnx", onnx)),
            setOptimizedPt2: (pt2) => set((state) => patchVisualisation(state, "optimizedPt2", pt2)),
            setOptimizedOnnx: (onnx) => set((state) => patchVisualisation(state, "optimizedOnnx", onnx)),

            setVisualisations: (visualisations) =>
                set({ visualisations: visualisations ? { ...emptyVisualisations(), ...visualisations } : emptyVisualisations() }),

            setDescriptorDraft: (descriptorDraft) => set({ descriptorDraft }),

            clearDescriptorDraft: () => set({ descriptorDraft: null }),

            hydrateFromProject: (raw) => {
                if (!raw) {
                    set({
                        project: null,
                        csv: null,
                        visualisations: emptyVisualisations(),
                        optimizationRun: null,
                        diagnosticsRun: null,
                        descriptorDraft: null,
                    });
                    return;
                }

                const project = normalizeProjectPayload(raw);
                set({
                    project,
                    visualisations: {
                        ...emptyVisualisations(),
                        uploadedPt2: project?.modelData ?? null,
                    },
                    csv: project?.csvData ?? null,
                    optimizationRun: null,
                    diagnosticsRun: diagnosticsRunFromProject(project),
                    descriptorDraft: null,
                });
            },

            clearProject: () =>
                set({
                    project: null,
                    csv: null,
                    visualisations: emptyVisualisations(),
                    optimizationRun: null,
                    diagnosticsRun: null,
                    descriptorDraft: null,
                }),

            clearVisualisation: (slotKey) => {
                if (!slotKey) {
                    set({ visualisations: emptyVisualisations() });
                    return;
                }
                const key = resolveVizSlotKey(slotKey);
                if (!key) return;
                set((state) => patchVisualisation(state, key, null));
            },

            beginOptimizationRun: () =>
                set({
                    optimizationRun: emptyOptimizationRun(),
                }),

            appendOptimizationUpdate: (update) =>
                set((state) => {
                    const run = state.optimizationRun ?? emptyOptimizationRun();
                    return {
                        optimizationRun: {
                            ...run,
                            updates: [...run.updates, update],
                        },
                    };
                }),

            setOptimizationResult: ({ result, report, runError }) =>
                set((state) => {
                    const run = state.optimizationRun ?? emptyOptimizationRun();
                    const nextResult = result !== undefined ? result : run.result;
                    const nextReport = report !== undefined ? report : run.report;
                    const nextError = runError !== undefined ? runError : run.runError;
                    const hasOutcome = !!(nextResult || nextReport || nextError);
                    return {
                        optimizationRun: {
                            ...run,
                            result: nextResult ?? null,
                            report: nextReport ?? null,
                            runError: nextError ?? null,
                            completedAt: hasOutcome ? Date.now() : run.completedAt,
                        },
                    };
                }),

            clearOptimizationRun: () => set({ optimizationRun: null }),

            beginDiagnosticsRun: () =>
                set({
                    diagnosticsRun: emptyDiagnosticsRun(),
                }),

            setDiagnosticsResult: ({ result, report, runError }) =>
                set((state) => {
                    const run = state.diagnosticsRun ?? emptyDiagnosticsRun();
                    const nextResult = result !== undefined ? result : run.result;
                    const nextReport = report !== undefined ? report : run.report;
                    const nextError = runError !== undefined ? runError : run.runError;
                    const hasOutcome = !!(nextResult || nextReport || nextError);
                    return {
                        diagnosticsRun: {
                            ...run,
                            result: nextResult ?? null,
                            report: nextReport ?? null,
                            runError: nextError ?? null,
                            completedAt: hasOutcome ? Date.now() : run.completedAt,
                        },
                    };
                }),

            clearDiagnosticsRun: () => set({ diagnosticsRun: null }),
        }),
        {
            name: "mylo-project",
            storage: createJSONStorage(() => sessionStorage),
            partialize: (state) => ({
                project: state.project,
                csv: state.csv,
                visualisations: state.visualisations,
                optimizationRun: state.optimizationRun,
                diagnosticsRun: state.diagnosticsRun,
                // descriptorDraft is intentionally NOT persisted — it's ephemeral UI state.
            }),
            merge: (persisted, current) => {
                const p = (persisted ?? {}) as Record<string, unknown>;
                // Support old sessions that stored singular `visualisation`
                const rawViz = p.visualisations ?? p.visualisation;
                const project = p.project ?? current.project;
                return {
                    ...current,
                    ...p,
                    visualisations: normalizeVisualisations(
                        rawViz,
                        (project as any)?.modelData,
                    ),
                };
            },
            onRehydrateStorage: () => (state) => {
                if (!state) return;
                state.visualisations = normalizeVisualisations(
                    state.visualisations,
                    state.project?.modelData,
                );
                if (state.project) {
                    const normalized = normalizeProjectPayload(state.project);
                    if (normalized !== state.project) {
                        state.project = normalized;
                    }
                }
            },
        },
    ),
);

export const useVisualisationStore = useProjectStore;
