/** Session intent so home → dashboard can open ModelEditor / Visualiser after load. */

export type PendingPanel = {
    component: string;
    id: string;
    title: string;
    params?: Record<string, unknown>;
};

const KEY = "mylo-pending-panel";

export function queuePendingPanel(panel: PendingPanel) {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(KEY, JSON.stringify(panel));
}

export function consumePendingPanel(): PendingPanel | null {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    try {
        return JSON.parse(raw) as PendingPanel;
    } catch {
        return null;
    }
}
