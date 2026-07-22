"use client"

import {useCallback, useEffect, useMemo, useState, type ChangeEvent, type MouseEvent} from "react";
import {useRouter} from "next/navigation";
import {useClientStore} from "@/lib/store";
import {listCatalog, deleteCatalogItem, type CatalogItemSummary} from "@/lib/storage/catalog";
import {
    DownloadCatalogItem,
    OpenCatalogItem,
    PublishCatalogFile,
    PublishProjectToCatalog,
} from "@/lib/windows/Actions";
import Style from "./page.module.css";

type KindFilter = "all" | "project" | "pt2" | "onnx";

function kindLabel(kind: string) {
    if (kind === "project") return "Project";
    if (kind === "pt2") return "PT2";
    if (kind === "onnx") return "ONNX";
    return kind;
}

function kindIcon(kind: string) {
    if (kind === "project") return "fa-solid fa-box-archive";
    if (kind === "pt2") return "fa-solid fa-diagram-project";
    if (kind === "onnx") return "fa-solid fa-share-nodes";
    return "fa-solid fa-file";
}

export default function CatalogPage({
    clientStatus,
}: {
    clientStatus: string;
}) {
    const router = useRouter();
    const [items, setItems] = useState<CatalogItemSummary[]>([]);
    const [filter, setFilter] = useState<KindFilter>("all");
    const [busy, setBusy] = useState(false);
    const [publishOpen, setPublishOpen] = useState(false);
    const [pubName, setPubName] = useState("");
    const [pubDesc, setPubDesc] = useState("");
    const [pubFile, setPubFile] = useState<File | null>(null);
    const [pubMode, setPubMode] = useState<"file" | "project">("file");

    const refresh = useCallback(async () => {
        try {
            setItems(await listCatalog());
        } catch {
            setItems([]);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const visible = useMemo(
        () => (filter === "all" ? items : items.filter((i) => i.kind === filter)),
        [items, filter],
    );

    function onPickFile(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0] ?? null;
        setPubFile(file);
        if (file && !pubName.trim()) {
            setPubName(file.name.replace(/\.(mylo|pt2|onnx)$/i, ""));
        }
    }

    async function submitPublish() {
        setBusy(true);
        try {
            if (pubMode === "project") {
                const client = useClientStore.getState().client;
                const item = await PublishProjectToCatalog(client, {
                    name: pubName || undefined,
                    description: pubDesc,
                });
                if (item) {
                    setPublishOpen(false);
                    setPubName("");
                    setPubDesc("");
                    await refresh();
                }
            } else {
                if (!pubFile || !pubName.trim()) return;
                const item = await PublishCatalogFile({
                    file: pubFile,
                    name: pubName,
                    description: pubDesc,
                });
                if (item) {
                    setPublishOpen(false);
                    setPubName("");
                    setPubDesc("");
                    setPubFile(null);
                    await refresh();
                }
            }
        } finally {
            setBusy(false);
        }
    }

    async function onOpen(item: CatalogItemSummary) {
        if (clientStatus !== "Connected") return;
        const client = useClientStore.getState().client;
        setBusy(true);
        try {
            const code = await OpenCatalogItem(client, {
                id: item.id,
                kind: item.kind,
                name: item.name,
                fileName: item.fileName,
            });
            if (code === 200) {
                router.push("/dashboard");
            }
        } finally {
            setBusy(false);
        }
    }

    async function onDownload(item: CatalogItemSummary, e: MouseEvent) {
        e.stopPropagation();
        setBusy(true);
        try {
            await DownloadCatalogItem(item.id);
        } finally {
            setBusy(false);
        }
    }

    async function onDelete(item: CatalogItemSummary, e: MouseEvent) {
        e.stopPropagation();
        if (!item.isMine) return;
        if (!window.confirm(`Remove "${item.name}" from the catalog?`)) return;
        setBusy(true);
        try {
            const res = await deleteCatalogItem(item.id);
            if (res.ok) await refresh();
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className={Style.container}>
            <div className={"flex items-center justify-between flex-wrap gap-4 pr-4"}>
                <h1 className={Style.title}>Catalog</h1>
                <button
                    className={Style.headerButton}
                    style={{marginRight: "1rem"}}
                    onClick={() => {
                        setPubMode("file");
                        setPublishOpen(true);
                    }}
                >
                    Publish <i className={"fa-solid fa-upload"}/>
                </button>
            </div>

            <div className={Style.section}>
                <div className={"flex gap-2 ml-4 mb-4 flex-wrap"}>
                    {(["all", "project", "pt2", "onnx"] as KindFilter[]).map((k) => (
                        <button
                            key={k}
                            className={`${Style.pillButton} ${filter === k ? Style.pillButtonActive : ""}`}
                            onClick={() => setFilter(k)}
                        >
                            {k === "all" ? "All" : kindLabel(k)}
                        </button>
                    ))}
                    <button
                        className={Style.pillButton}
                        disabled={busy || clientStatus !== "Connected"}
                        title={clientStatus !== "Connected" ? "Connect a client first" : "Publish current agent project"}
                        onClick={() => {
                            setPubMode("project");
                            setPubFile(null);
                            setPublishOpen(true);
                        }}
                    >
                        Publish loaded project
                    </button>
                </div>

                <div className={Style.list}>
                    {visible.length === 0 ? (
                        <div className={Style.empty}>
                            <div className={"flex items-center gap-[5rem]"}>
                                <h1>No catalog items yet</h1>
                                <i className={"fa-solid fa-book-open"}/>
                            </div>
                            <button onClick={() => setPublishOpen(true)}>
                                Be the first to publish <i className={"fa-solid fa-plus"}/>
                            </button>
                        </div>
                    ) : (
                        visible.map((item) => (
                            <div key={item.id} className={Style.catalogCard}>
                                <div className={"flex flex-col items-start mb-[1rem] gap-1"}>
                                    <div className={"flex items-center gap-3"}>
                                        <i className={kindIcon(item.kind)}/>
                                        <h1>{item.name}</h1>
                                        <span className={"text-sm opacity-70"}>{kindLabel(item.kind)}</span>
                                    </div>
                                    {item.description ? <h2>{item.description}</h2> : null}
                                    <h2>
                                        by {item.publisherName || "Unknown"} ·{" "}
                                        {new Date(item.updatedAt).toLocaleDateString()}
                                    </h2>
                                    <h2 className={"opacity-60"}>{item.fileName}</h2>
                                </div>
                                <div className={"flex justify-start items-center gap-2 flex-col h-full"}>
                                    <button
                                        className={Style.editButton}
                                        disabled={busy || clientStatus !== "Connected"}
                                        title={
                                            clientStatus !== "Connected"
                                                ? "Connect a client first"
                                                : item.kind === "project"
                                                  ? "Open project"
                                                  : item.kind === "pt2"
                                                    ? "Open in editor"
                                                    : "Open in visualiser"
                                        }
                                        onClick={() => onOpen(item)}
                                    >
                                        <i className={"fa-solid fa-folder-open"}/>
                                    </button>
                                    <button
                                        className={Style.editButton}
                                        disabled={busy}
                                        title="Download"
                                        onClick={(e) => onDownload(item, e)}
                                    >
                                        <i className={"fa-solid fa-download"}/>
                                    </button>
                                    {item.isMine ? (
                                        <button
                                            className={Style.editButton}
                                            disabled={busy}
                                            title="Remove from catalog"
                                            onClick={(e) => onDelete(item, e)}
                                        >
                                            <i className={"fa-solid fa-trash"}/>
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {publishOpen && (
                <div className={Style.overlay}>
                    <div className={Style.form}>
                        <h1>{pubMode === "project" ? "Publish loaded project" : "Publish to catalog"}</h1>
                        {pubMode === "file" ? (
                            <>
                                <p className={"text-[var(--text-light)]"}>
                                    Upload a <strong>.mylo</strong> project, or a standalone{" "}
                                    <strong>.pt2</strong> / <strong>.onnx</strong> model.
                                </p>
                                <input
                                    type={"file"}
                                    accept={".mylo,.pt2,.onnx"}
                                    onChange={onPickFile}
                                />
                            </>
                        ) : (
                            <p className={"text-[var(--text-light)]"}>
                                Exports the project currently loaded on the agent and publishes the{" "}
                                <strong>.mylo</strong> package.
                            </p>
                        )}
                        <input
                            type={"text"}
                            placeholder={"Display name"}
                            value={pubName}
                            onChange={(e) => setPubName(e.target.value)}
                        />
                        <input
                            type={"text"}
                            placeholder={"Short description (optional)"}
                            value={pubDesc}
                            onChange={(e) => setPubDesc(e.target.value)}
                        />
                        <div className={"flex w-full gap-[1rem] items-center justify-end"}>
                            <button className={Style.closeButton} onClick={() => setPublishOpen(false)}>
                                Cancel
                            </button>
                            <button
                                className={Style.mainButton}
                                disabled={
                                    busy ||
                                    (pubMode === "file" && (!pubFile || !pubName.trim())) ||
                                    (pubMode === "project" && clientStatus !== "Connected")
                                }
                                onClick={() => void submitPublish()}
                            >
                                Publish
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
