"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type ProjectStore = {
    project: any | null;
    csv: any | null;
    visualisation: any | null;

    setProject: (project: any | null) => void;
    setCsv: (csv: any | null) => void;
    setVisualisation: (visualisation: any | null) => void;
    /** Apply a full project payload (project + optional model/csv payloads). */
    hydrateFromProject: (project: any | null) => void;
    clearProject: () => void;
    clearVisualisation: () => void;
};

function projectIdOf(project: any | null): string | null {
    const id = project?.projectData?.id ?? project?.id ?? null;
    return id != null ? String(id) : null;
}

export function getProjectId(project: any | null = useProjectStore.getState().project): string | null {
    return projectIdOf(project);
}

export const useProjectStore = create<ProjectStore>()(
    persist(
        (set) => ({
            project: null,
            csv: null,
            visualisation: null,

            setProject: (project) => set({ project }),

            setCsv: (csv) => set({ csv }),

            setVisualisation: (visualisation) => set({ visualisation }),

            hydrateFromProject: (project) => {
                if (!project) {
                    set({ project: null, csv: null, visualisation: null });
                    return;
                }

                set({
                    project,
                    visualisation: project.modelData ?? null,
                    csv: project.csvData ?? null,
                });
            },

            clearProject: () =>
                set({
                    project: null,
                    csv: null,
                    visualisation: null,
                }),

            clearVisualisation: () => set({ visualisation: null }),
        }),
        {
            name: "mylo-project",
            storage: createJSONStorage(() => sessionStorage),
            partialize: (state) => ({
                project: state.project,
                csv: state.csv,
                visualisation: state.visualisation,
            }),
        },
    ),
);

/** @deprecated Prefer useProjectStore — kept for existing panel imports. */
export const useVisualisationStore = useProjectStore;
