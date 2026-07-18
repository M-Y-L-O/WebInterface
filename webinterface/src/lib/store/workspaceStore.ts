"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DockviewApi } from "dockview-core";
import type { DockLayoutJson } from "./types";
import { getProjectId } from "./projectStore";

const DEFAULT_LAYOUT_KEY = "__default__";

export type PanelInspectContext = {
    selected: any | null;
    visualisation: any | null;
};

type WorkspaceStore = {
    api: DockviewApi | null;
    layoutsByProjectId: Record<string, DockLayoutJson>;

    /** Last Visualiser / ModelEditor that was active — Properties binds to this. */
    inspectablePanelId: string | null;
    panelContexts: Record<string, PanelInspectContext>;

    setApi: (api: DockviewApi) => void;
    clearApi: () => void;

    setLayout: (layout: DockLayoutJson, projectId?: string | null) => void;
    getLayout: (projectId?: string | null) => DockLayoutJson | null;
    clearLayout: (projectId?: string | null) => void;

    focusInspectablePanel: (panelId: string) => void;
    setPanelSelection: (panelId: string, selected: any | null) => void;
    setPanelVisualisation: (panelId: string, visualisation: any | null) => void;
    clearPanelContext: (panelId: string) => void;

    /** @deprecated Prefer setPanelSelection(panelId, …) */
    setSelected: (selected: any) => void;
    clearSelected: () => void;

    /** Clear ephemeral UI chrome without wiping persisted layouts. */
    resetChrome: () => void;
};

function resolveLayoutKey(projectId?: string | null): string {
    return projectId || getProjectId() || DEFAULT_LAYOUT_KEY;
}

function emptyContext(): PanelInspectContext {
    return { selected: null, visualisation: null };
}

export const useWorkspaceStore = create<WorkspaceStore>()(
    persist(
        (set, get) => ({
            api: null,
            layoutsByProjectId: {},
            inspectablePanelId: null,
            panelContexts: {},

            setApi: (api) => set({ api }),
            clearApi: () => set({ api: null }),

            setLayout: (layout, projectId) => {
                const key = resolveLayoutKey(projectId);
                set({
                    layoutsByProjectId: {
                        ...get().layoutsByProjectId,
                        [key]: layout,
                    },
                });
            },

            getLayout: (projectId) => {
                const key = resolveLayoutKey(projectId);
                return get().layoutsByProjectId[key] ?? null;
            },

            clearLayout: (projectId) => {
                const key = resolveLayoutKey(projectId);
                const next = { ...get().layoutsByProjectId };
                delete next[key];
                set({ layoutsByProjectId: next });
            },

            focusInspectablePanel: (panelId) => {
                const contexts = get().panelContexts;
                set({
                    inspectablePanelId: panelId,
                    panelContexts: {
                        ...contexts,
                        [panelId]: contexts[panelId] ?? emptyContext(),
                    },
                });
            },

            setPanelSelection: (panelId, selected) => {
                const prev = get().panelContexts[panelId] ?? emptyContext();
                set({
                    panelContexts: {
                        ...get().panelContexts,
                        [panelId]: { ...prev, selected },
                    },
                });
            },

            setPanelVisualisation: (panelId, visualisation) => {
                const prev = get().panelContexts[panelId] ?? emptyContext();
                set({
                    panelContexts: {
                        ...get().panelContexts,
                        [panelId]: { ...prev, visualisation },
                    },
                });
            },

            clearPanelContext: (panelId) => {
                const next = { ...get().panelContexts };
                delete next[panelId];
                const inspectablePanelId =
                    get().inspectablePanelId === panelId
                        ? (Object.keys(next)[0] ?? null)
                        : get().inspectablePanelId;
                set({ panelContexts: next, inspectablePanelId });
            },

            setSelected: (selected) => {
                const panelId = get().inspectablePanelId;
                if (!panelId) return;
                get().setPanelSelection(panelId, selected);
            },

            clearSelected: () => {
                const panelId = get().inspectablePanelId;
                if (!panelId) return;
                get().setPanelSelection(panelId, null);
            },

            resetChrome: () =>
                set({
                    api: null,
                    inspectablePanelId: null,
                    panelContexts: {},
                }),
        }),
        {
            name: "mylo-workspace",
            storage: createJSONStorage(() => sessionStorage),
            partialize: (state) => ({
                layoutsByProjectId: state.layoutsByProjectId,
            }),
        },
    ),
);

/** Active inspect context for Properties. */
export function useActiveInspectContext(): PanelInspectContext | null {
    return useWorkspaceStore((state) => {
        const id = state.inspectablePanelId;
        if (!id) return null;
        return state.panelContexts[id] ?? null;
    });
}

/** Back-compat aliases used across the app. */
export const useDockviewStore = useWorkspaceStore;
export const useSelectedStore = useWorkspaceStore;
