"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { OptimizationReport, ProgressUpdate } from "@/lib/client/ClientTypes";
import type { OptimizationRunState } from "./types";

type ProjectStore = {
    project: any | null;
    csv: any | null;
    visualisation: any | null;
    optimizationRun: OptimizationRunState | null;

    setProject: (project: any | null) => void;
    setCsv: (csv: any | null) => void;
    setVisualisation: (visualisation: any | null) => void;

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

export const useProjectStore = create<ProjectStore>()(
    persist(
        (set) => ({
            project: null,
            csv: null,
            visualisation: null,
            optimizationRun: null,

            setProject: (project) => set({ project }),

            setCsv: (csv) => set({ csv }),

            setVisualisation: (visualisation) => set({ visualisation }),

            hydrateFromProject: (raw) => {
                if (!raw) {
                    set({
                        project: null,
                        csv: null,
                        visualisation: null,
                        optimizationRun: null,
                    });
                    return;
                }

                const project = normalizeProjectPayload(raw);
                set({
                    project,
                    visualisation: project?.modelData ?? null,
                    csv: project?.csvData ?? null,
                    // Fresh project load — drop previous session run.
                    optimizationRun: null,
                });
            },

            clearProject: () =>
                set({
                    project: null,
                    csv: null,
                    visualisation: null,
                    optimizationRun: null,
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
        }),
        {
            name: "mylo-project",
            storage: createJSONStorage(() => sessionStorage),
            partialize: (state) => ({
                project: state.project,
                csv: state.csv,
                visualisation: state.visualisation,
                optimizationRun: state.optimizationRun,
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
