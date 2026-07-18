"use client";

import { useCallback, useEffect } from "react";
import type { DockviewPanelApi } from "dockview-core";
import { useWorkspaceStore } from "@/lib/store/workspaceStore";

/**
 * Binds a Visualiser / ModelEditor panel to the workspace inspect context
 * so Properties can follow whichever panel is active.
 */
export function useInspectablePanel(api: DockviewPanelApi) {
    const panelId = api.id;
    const focusInspectablePanel = useWorkspaceStore((s) => s.focusInspectablePanel);
    const setPanelSelection = useWorkspaceStore((s) => s.setPanelSelection);
    const setPanelVisualisation = useWorkspaceStore((s) => s.setPanelVisualisation);
    const clearPanelContext = useWorkspaceStore((s) => s.clearPanelContext);

    useEffect(() => {
        const disposable = api.onDidActiveChange((event) => {
            if (event.isActive) {
                focusInspectablePanel(panelId);
            }
        });

        if (api.isActive) {
            focusInspectablePanel(panelId);
        }

        return () => {
            disposable.dispose();
            clearPanelContext(panelId);
        };
    }, [api, panelId, focusInspectablePanel, clearPanelContext]);

    const setSelected = useCallback(
        (selected: any | null) => setPanelSelection(panelId, selected),
        [panelId, setPanelSelection],
    );

    const setVisualisation = useCallback(
        (visualisation: any | null) => setPanelVisualisation(panelId, visualisation),
        [panelId, setPanelVisualisation],
    );

    return {
        panelId,
        setSelected,
        setVisualisation,
    };
}
