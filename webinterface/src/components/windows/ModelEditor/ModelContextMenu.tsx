"use client";

import React, { useEffect, useRef, useMemo } from "react";

interface ModelContextMenuProps {
    x: number;
    y: number;
    clientX: number;
    clientY: number;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    activeIndex: number;
    setActiveIndex: (index: number | ((prev: number) => number)) => void;
    /** Flat list used when nodeGroups is unavailable */
    filteredTypes: string[];
    /** Categorised groups from catalog.nodeGroups */
    nodeGroups?: Record<string, string[]>;
    onAddNode: (type: string) => void;
    onClose: () => void;
}

export default function ModelContextMenu({
    clientX,
    clientY,
    searchQuery,
    setSearchQuery,
    activeIndex,
    setActiveIndex,
    filteredTypes,
    nodeGroups,
    onAddNode,
    onClose,
}: ModelContextMenuProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => inputRef.current?.focus(), 50);
        return () => clearTimeout(timer);
    }, []);

    /** Build a flat indexed list from groups (respecting search) for keyboard nav */
    const groupedEntries = useMemo<{ category: string; type: string }[]>(() => {
        if (!nodeGroups || searchQuery) {
            // Fall back to flat list when searching or no groups available
            return filteredTypes.map(type => ({ category: "", type }));
        }
        const entries: { category: string; type: string }[] = [];
        for (const [category, types] of Object.entries(nodeGroups)) {
            for (const type of types) {
                entries.push({ category, type });
            }
        }
        return entries;
    }, [nodeGroups, filteredTypes, searchQuery]);

    /** Group entries by category for display */
    const displayGroups = useMemo<[string, string[]][]>(() => {
        if (!nodeGroups || searchQuery) {
            return [["", filteredTypes]];
        }
        const map = new Map<string, string[]>();
        for (const { category, type } of groupedEntries) {
            const arr = map.get(category) ?? [];
            arr.push(type);
            map.set(category, arr);
        }
        return Array.from(map.entries());
    }, [nodeGroups, filteredTypes, searchQuery, groupedEntries]);

    let runningIdx = 0;

    return (
        <div
            className="fixed z-50 w-72 rounded-2xl border border-neutral-800/80 bg-neutral-900/95 p-2.5 shadow-2xl backdrop-blur-md text-white select-none"
            style={{
                left: Math.min(clientX, typeof window !== "undefined" ? window.innerWidth - 300 : clientX),
                top: Math.min(clientY, typeof window !== "undefined" ? window.innerHeight - 420 : clientY),
                animation: "fadeInScale 0.1s ease-out",
            }}
        >
            <style>{`@keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>

            <div className="flex items-center gap-2 border-b border-white/10 px-2 pb-2 pt-0.5">
                <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">Create Node</span>
            </div>

            <input
                ref={inputRef}
                type="text"
                className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-950/50 px-3 py-2 text-xs text-[var(--light-highlight)] placeholder-white/30 focus:border-[var(--accent-color)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setActiveIndex(0);
                }}
                onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveIndex((prev) => Math.min(prev + 1, groupedEntries.length - 1));
                    } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveIndex((prev) => Math.max(prev - 1, 0));
                    } else if (e.key === "Enter") {
                        e.preventDefault();
                        const entry = groupedEntries[activeIndex];
                        if (entry) onAddNode(entry.type);
                    } else if (e.key === "Escape") {
                        onClose();
                    }
                }}
            />

            <div className="mt-2 max-h-64 overflow-y-auto pr-1 space-y-1">
                {groupedEntries.length === 0 ? (
                    <div className="p-2 text-xs text-white/40">No nodes found</div>
                ) : (
                    displayGroups.map(([category, types]) => {
                        const categoryStart = runningIdx;
                        runningIdx += types.length;
                        return (
                            <div key={category || "all"}>
                                {category && (
                                    <div className="px-2 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-white/25">
                                        {category.replace(/([A-Z])/g, " $1").trim()}
                                    </div>
                                )}
                                {types.map((type, localIdx) => {
                                    const globalIdx = categoryStart + localIdx;
                                    const isActive = globalIdx === activeIndex;
                                    return (
                                        <button
                                            key={type}
                                            className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition duration-75 flex items-center justify-between ${
                                                isActive
                                                    ? "bg-[var(--accent-color)] text-white/85 font-bold"
                                                    : "text-[var(--light-highlight)] hover:bg-white/5 hover:text-white"
                                            }`}
                                            onMouseEnter={() => setActiveIndex(globalIdx)}
                                            onClick={() => onAddNode(type)}
                                        >
                                            <span>{type}</span>
                                            {isActive && (
                                                <span className="text-[9px] text-white/60 font-bold">↵ Enter</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
