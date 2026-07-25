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
import DummyVisualiser from "@/components/effects/DummyVisualiser";
import {AnimatePresence, motion} from "framer-motion";
import * as sea from "node:sea";

type KindFilter = "all" | "project" | "pt2" | "onnx";

function kindLabel(kind: string) {
    if (kind === "project") return "Project";
    if (kind === "pt2") return "PT2";
    if (kind === "onnx") return "ONNX";
    return kind;
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
    const [publishDropdown, setPublishDropdown] = useState(false);
    const [selectedItem, setSelectedItem] = useState<CatalogItemSummary | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
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
        () => {
            let filtered = filter === "all" ? items : items.filter((i) => i.kind === filter)

            if(searchTerm.trim().length > 0){
                if(searchTerm.trim()){
                    const term = searchTerm.trim().toLowerCase();
                    filtered = filtered.filter(i => {
                        return i.name.toLowerCase().includes(term) || i.description.toLowerCase().includes(term) || (i.publisherName?.toLowerCase().includes(term) ?? false)
                    })
                }
            }


            return filtered;
        },
        [items, filter, searchTerm],
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
        setSelectedItem(null);
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
                <h1 className={Style.title}>Model Catalog</h1>

            </div>

            <div className={Style.section}>
                <div className={"flex w-full justify-between gap-4 items-center bg-[var(--background)]  px-[0.7rem] py-[0.5rem] rounded-[5rem] mb-4"}>
                    <div className={"flex items-center gap-[3rem]"}>
                        <input
                            type={"text"}
                            placeholder={"Search..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={Style.searchBar}
                        />
                        <div className={"flex gap-2 ml-4 flex-wrap items-center justify-center"}>
                            <h2 className={"text-[var(--light-highlight)] mr-[0.5rem]"}>Filters: </h2>
                            {(["all", "project", "pt2", "onnx"] as KindFilter[]).map((k) => (
                                <button
                                    key={k}
                                    className={`${Style.pillButton} ${filter === k ? Style.pillButtonActive : ""}`}
                                    onClick={() => setFilter(k)}
                                >
                                    {k === "all" ? "All" : kindLabel(k)}
                                </button>
                            ))}

                        </div>
                    </div>

                    <div className={"relative"}>
                        <button className={Style.headerButton} onClick={()=>setPublishDropdown(!publishDropdown)}>{ publishDropdown ? <span>Close <i className={"fa-solid fa-close"}></i> </span> :<span>Publish <i className={"fa-solid fa-plus"}></i></span>}</button>
                        <AnimatePresence initial={false} mode="wait" onExitComplete={() => setPublishDropdown(false)}>
                            {
                                publishDropdown &&
                                <motion.div className={Style.headerDropdown} initial={{height:0, opacity:0}} animate={{height:100, opacity:1}} exit={{height:0, opacity:0}} transition={{duration:0.2}}>
                                    <button
                                        style={{marginRight: "1rem"}}
                                        onClick={() => {
                                            setPubMode("file");
                                            setPublishOpen(true);
                                        }}
                                    >
                                        Publish from computer <i className={"fa-solid fa-upload"}/>
                                    </button>
                                    <button
                                        disabled={busy || clientStatus !== "Connected"}
                                        title={clientStatus !== "Connected" ? "Connect a client first" : "Publish current agent project"}
                                        onClick={() => {
                                            setPubMode("project");
                                            setPubFile(null);
                                            setPublishOpen(true);
                                        }}
                                    >
                                        Publish loaded project <i className={"fa-solid fa-upload"}/>
                                    </button>
                                </motion.div>
                            }
                        </AnimatePresence>
                    </div>
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
                                <div key={item.id} className={Style.catalogCard} onClick={() => setSelectedItem(item)}>
                                    <div className={"flex flex-col items-start mb-[1rem] gap-1"}>
                                        <div className={"flex items-center gap-3"}>
                                            <h1>{item.name}</h1>
                                        </div>
                                        {item.description ? <h2>{item.description}</h2> : null}
                                        <h2>
                                            by {item.publisherName || "Unknown"} ·{" "}
                                            {new Date(item.updatedAt).toLocaleDateString()}
                                        </h2>
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
            {
                selectedItem != null && (
                    <div className={Style.overlay}>
                        <div className={`${Style.form} w-[50%]`}>
                            <div className={"flex items-center justify-between gap-[2rem]"}>
                                <div className={"flex flex-col items-start gap-[1rem] w-[30rem] relative h-full"}>
                                    <button className={"absolute top-[-7.5rem]"} onClick={()=>setSelectedItem(null)}><i className={"fa-solid fa-close"}></i></button>
                                    <div className={"flex flex-col w-full"}>
                                        <h1>{selectedItem.name}</h1>
                                        <div className={"flex items-center gap-3 text-[var(--light-highlight)]"}>
                                            <h2>{selectedItem.publisherName}</h2>·{" "}
                                            <h2>{new Date(selectedItem.updatedAt).toLocaleDateString()}</h2>
                                        </div>
                                    </div>
                                    <div className={"flex flex-col w-full"}>
                                        <h2 className={"font-bold"}>Description:</h2>
                                        <p>{selectedItem.description.length > 0 ? selectedItem.description : "No description"}</p>
                                    </div>
                                </div>

                                <div className={"flex flex-col justify-start gap-2"}>
                                    <div
                                        className={"w-[30rem] h-[20rem] flex flex-col rounded-[0.5rem] overflow-hidden cursor-pointer group"}
                                        title={
                                            clientStatus !== "Connected"
                                                ? "Connect a client first"
                                                : selectedItem.kind === "project"
                                                    ? "Open project"
                                                    : selectedItem.kind === "pt2"
                                                        ? "Open in editor"
                                                        : "Open in visualiser"
                                        }
                                        onClick={() => onOpen(selectedItem)}
                                    >
                                        <DummyVisualiser/>
                                        <div className={"flex items-center justify-center w-full bg-[var(--background)] p-[1rem] group-hover:bg-[var(--primary)] group-hover:text-[var(--card-background)] transition-colors "}>
                                            <h2>
                                                {clientStatus !== "Connected"
                                                ? "Connect a client first"
                                                : selectedItem.kind === "project"
                                                    ? "Open project"
                                                    : selectedItem.kind === "pt2"
                                                        ? "Open in editor"
                                                        : "Open in visualiser"}
                                                <i className={"fa-solid fa-arrow-right"}/>
                                            </h2>
                                        </div>
                                    </div>
                                    <div className={"flex"}>
                                        <button
                                            className={Style.editButton}
                                            disabled={busy}
                                            title="Download"
                                            onClick={(e) => onDownload(selectedItem, e)}
                                        >
                                            <i className={"fa-solid fa-download"}/>
                                        </button>
                                        {selectedItem.isMine ? (
                                            <button
                                                className={Style.editButton}
                                                disabled={busy}
                                                title="Remove from catalog"
                                                onClick={(e) => {onDelete(selectedItem, e); setSelectedItem(null);}}
                                            >
                                                <i className={"fa-solid fa-trash"}/>
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                )
            }
        </div>
    );
}
