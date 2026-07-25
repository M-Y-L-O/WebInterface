const MODEL_EDITED_EVENT = "mylo:model-edited";

export type ModelEditedDetail = {
    descriptor?: unknown;
    graph?: unknown;
    shapes?: unknown;
};

export function notifyModelEdited(detail: ModelEditedDetail) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(MODEL_EDITED_EVENT, { detail }));
}

export function onModelEdited(handler: (detail: ModelEditedDetail) => void): () => void {
    if (typeof window === "undefined") return () => {};

    const listener = (event: Event) => {
        const custom = event as CustomEvent<ModelEditedDetail>;
        handler(custom.detail || {});
    };

    window.addEventListener(MODEL_EDITED_EVENT, listener);
    return () => window.removeEventListener(MODEL_EDITED_EVENT, listener);
}
