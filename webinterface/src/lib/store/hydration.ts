"use client";

import { useClientStore } from "./clientStore";
import { useProjectStore } from "./projectStore";
import { useWorkspaceStore } from "./workspaceStore";

type PersistApi = {
    hasHydrated: () => boolean;
    onFinishHydration: (cb: () => void) => () => void;
};

function persistApi(store: { persist?: PersistApi }): PersistApi | null {
    return store.persist ?? null;
}

export function storesHaveHydrated(): boolean {
    if (typeof window === "undefined") return false;

    const apis = [
        persistApi(useClientStore),
        persistApi(useProjectStore),
        persistApi(useWorkspaceStore),
    ];

    // If persist API is missing (bundler / SSR edge), don't block the UI.
    if (apis.some((api) => !api)) return true;

    return apis.every((api) => api!.hasHydrated());
}

export function onStoresHydrated(callback: () => void): () => void {
    if (typeof window === "undefined") return () => {};

    const apis = [
        persistApi(useClientStore),
        persistApi(useProjectStore),
        persistApi(useWorkspaceStore),
    ].filter((api): api is PersistApi => !!api);

    if (apis.length === 0) {
        queueMicrotask(callback);
        return () => {};
    }

    const done = () => {
        if (apis.every((api) => api.hasHydrated())) {
            callback();
        }
    };

    const unsubs = apis.map((api) => api.onFinishHydration(done));
    done();
    return () => {
        for (const unsub of unsubs) unsub();
    };
}
