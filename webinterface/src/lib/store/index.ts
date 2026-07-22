export { storesHaveHydrated, onStoresHydrated } from "./hydration";
export { useClientStore } from "./clientStore";
export {
    useProjectStore,
    useVisualisationStore,
    getProjectId,
} from "./projectStore";
export {
    useWorkspaceStore,
    useDockviewStore,
    useSelectedStore,
    useActiveInspectContext,
} from "./workspaceStore";
export type { PanelInspectContext } from "./workspaceStore";
export type {
    ConnectionResult,
    ConnectionStatus,
    DockLayoutJson,
} from "./types";

import { useClientStore } from "./clientStore";
import { useProjectStore } from "./projectStore";
import { useWorkspaceStore } from "./workspaceStore";

const LEGACY_KEYS = [
    "activeConfig",
    "activeProject",
    "loadedProject",
    "visRes",
    "csv",
] as const;

export function migrateLegacySessionStorage(): void {
    if (typeof window === "undefined") return;

    const flag = "mylo-migrated-v1";
    if (sessionStorage.getItem(flag) === "1") return;

    try {
        const activeConfig = sessionStorage.getItem("activeConfig");
        if (activeConfig && activeConfig !== "undefined" && !useClientStore.getState().config) {
            useClientStore.getState().setConfig(JSON.parse(activeConfig));
        }

        const loaded =
            sessionStorage.getItem("loadedProject") ||
            sessionStorage.getItem("activeProject");
        if (loaded && loaded !== "undefined" && !useProjectStore.getState().project) {
            useProjectStore.getState().hydrateFromProject(JSON.parse(loaded));
        }

        const vis = sessionStorage.getItem("visRes");
        if (vis && vis !== "undefined" && !useProjectStore.getState().visualisation) {
            useProjectStore.getState().setVisualisation(JSON.parse(vis));
        }

        const csv = sessionStorage.getItem("csv");
        if (csv && csv !== "undefined" && !useProjectStore.getState().csv) {
            useProjectStore.getState().setCsv(JSON.parse(csv));
        }
    } catch {
        // Ignore corrupt legacy payloads.
    } finally {
        for (const key of LEGACY_KEYS) {
            sessionStorage.removeItem(key);
        }
        sessionStorage.setItem(flag, "1");
    }
}

export function resetSessionForHome(): void {
    useProjectStore.getState().clearProject();
    useWorkspaceStore.getState().resetChrome();
}
