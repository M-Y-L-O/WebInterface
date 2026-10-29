import {DockviewApi} from "dockview-core";
import {useDockviewStore} from "@/lib/store";

const SLOT_PANEL_PREFIXES = ["Visualiser", "ModelEditor", "Optimization", "Diagnostics"] as const;

function openPanel(api:DockviewApi, component:string, id:string, title:string, params?:Record<string, unknown>){
    if(!api)
        return;

    const existing = api.getPanel(id);
    if(existing){
        existing.api.setActive();
        return;
    }

    api.addPanel({id, component, title, params} as any);
}

export function addWindow(api:DockviewApi|null, window:string, title?:string){
    if(!api)
        return;
    openPanel(api, window, window, title || window)
}

function resolveDockApi(api?: DockviewApi | null): DockviewApi | null {
    return api ?? useDockviewStore.getState().api;
}

function closePanelSafe(api: DockviewApi, panel: { api: { close: () => void } }) {
    try {
        panel.api.close();
    } catch {
        try {
            api.removePanel(panel as any);
        } catch {
            // Panel may already be gone.
        }
    }
}

/** Close dock panels tied to a file slot (Visualiser / ModelEditor / Optimization / Diagnostics). */
export function closeSlotWindows(api: DockviewApi | null | undefined, slotKey: string) {
    const dock = resolveDockApi(api);
    if (!dock || !slotKey) {
        return;
    }

    const ids = new Set(SLOT_PANEL_PREFIXES.map((prefix) => `${prefix}-${slotKey}`));

    // Snapshot — closing mutates dock.panels
    for (const panel of [...dock.panels]) {
        if (ids.has(panel.id)) {
            closePanelSafe(dock, panel);
        }
    }
}

/**
 * Close windows that would show stale data after replacing a slot file.
 * Replacing uploaded_pt2 also drops optimized_* windows and bare AI-opened model panels.
 */
export function closeWindowsForReplacedSlot(api: DockviewApi | null | undefined, slotKey: string) {
    const dock = resolveDockApi(api);
    if (!dock || !slotKey) {
        return;
    }

    const relatedKeys = new Set<string>([slotKey]);
    if (slotKey === "uploaded_pt2") {
        relatedKeys.add("optimized_pt2");
        relatedKeys.add("optimized_onnx");
    }

    const exactIds = new Set<string>();
    for (const key of relatedKeys) {
        for (const prefix of SLOT_PANEL_PREFIXES) {
            exactIds.add(`${prefix}-${key}`);
        }
    }

    // AI / menu helpers sometimes open panels with the bare component id.
    if (slotKey === "uploaded_pt2" || slotKey === "uploaded_onnx") {
        for (const prefix of SLOT_PANEL_PREFIXES) {
            exactIds.add(prefix);
        }
    }

    for (const panel of [...dock.panels]) {
        if (exactIds.has(panel.id)) {
            closePanelSafe(dock, panel);
        }
    }
}
