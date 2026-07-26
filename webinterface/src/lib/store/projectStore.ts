"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ModelDiagnosticsReport, OptimizationReport, ProgressUpdate } from "@/lib/client/ClientTypes";
import type { DiagnosticsRunState, OptimizationRunState } from "./types";

type ProjectStore = {
    project: any | null;
    csv: any | null;
    visualisation: any | null;
    optimizationRun: OptimizationRunState | null;
    diagnosticsRun: DiagnosticsRunState | null;
    /** Live in-editor descriptor draft — reflects unsaved modifications. */
    descriptorDraft: any | null;

    setProject: (project: any | null) => void;
    setCsv: (csv: any | null) => void;
    setVisualisation: (visualisation: any | null) => void;
    setDescriptorDraft: (descriptor: any | null) => void;
    clearDescriptorDraft: () => void;

    hydrateFromProject: (project: any | null) => void;
    clearProject: () => void;
    clearVisualisation: () => void;

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
            visualisation: null,
            optimizationRun: null,
            diagnosticsRun: null,
            descriptorDraft: null,

            setProject: (project) => set({ project }),

            setCsv: (csv) => set({ csv }),

            setVisualisation: (visualisation) => set({ visualisation }),

            setDescriptorDraft: (descriptorDraft) => set({ descriptorDraft }),

            clearDescriptorDraft: () => set({ descriptorDraft: null }),

            hydrateFromProject: (raw) => {
                if (!raw) {
                    set({
                        project: null,
                        csv: null,
                        visualisation: null,
                        optimizationRun: null,
                        diagnosticsRun: null,
                    });
                    return;
                }

                const project = normalizeProjectPayload(raw);
                set({
                    project,
                    visualisation: project?.modelData ?? null,
                    csv: project?.csvData ?? null,
                    // Fresh project load — drop previous session optimization run.
                    optimizationRun: null,
                    // Restore diagnostics from the project file when present.
                    diagnosticsRun: diagnosticsRunFromProject(project),
                    descriptorDraft: null,
                });
            },

            clearProject: () =>
                set({
                    project: null,
                    csv: null,
                    visualisation: null,
                    optimizationRun: null,
                    diagnosticsRun: null,
                    descriptorDraft: null,
                }),

            clearVisualisation: () => set({ visualisation: null }),

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
                visualisation: state.visualisation,
                optimizationRun: state.optimizationRun,
                diagnosticsRun: state.diagnosticsRun,
                // descriptorDraft is intentionally NOT persisted — it's ephemeral UI state.
            }),
            onRehydrateStorage: () => (state) => {
                if (!state?.project) return;
                const normalized = normalizeProjectPayload(state.project);
                if (normalized !== state.project) {
                    state.project = normalized;
                }
            },
        },
    ),
);

export const useVisualisationStore = useProjectStore;
