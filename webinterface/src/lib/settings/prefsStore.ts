"use client";

import { create } from "zustand";
import { DEFAULT_USER_PREFS, type ThemePreference, type UserPrefs } from "@/lib/settings/types";

const CACHE_KEY = "mylo-user-prefs";

type PrefsStore = UserPrefs & {
    hydrated: boolean;
    hydrate: (prefs: UserPrefs) => void;
    patch: (partial: Partial<UserPrefs>) => void;
    resolvedTheme: () => "dark" | "light";
};

function cachePrefs(prefs: UserPrefs) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(prefs));
    } catch {
        /* ignore quota / private mode */
    }
}

export function readCachedPrefs(): UserPrefs | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<UserPrefs>;
        return { ...DEFAULT_USER_PREFS, ...parsed };
    } catch {
        return null;
    }
}

function resolveTheme(theme: ThemePreference): "dark" | "light" {
    if (theme === "light") return "light";
    if (theme === "dark") return "dark";
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
        return "light";
    }
    return "dark";
}

export function applyDocumentTheme(theme: ThemePreference) {
    if (typeof document === "undefined") return;
    const resolved = resolveTheme(theme);
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.style.colorScheme = resolved;
}

export function applyDocumentLanguage(language: string) {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language || "en";
}

export const usePrefsStore = create<PrefsStore>((set, get) => ({
    ...DEFAULT_USER_PREFS,
    hydrated: false,

    hydrate: (prefs) => {
        set({ ...prefs, hydrated: true });
        cachePrefs(prefs);
        applyDocumentTheme(prefs.theme);
        applyDocumentLanguage(prefs.language);
    },

    patch: (partial) => {
        const next = { ...get(), ...partial };
        const prefs: UserPrefs = {
            theme: next.theme,
            language: next.language,
            defaultModel: next.defaultModel,
            aiMaxTurns: next.aiMaxTurns,
            aiMaxToolCalls: next.aiMaxToolCalls,
            aiTemperature: next.aiTemperature,
            aiThinking: next.aiThinking,
            optEpochs: next.optEpochs,
            optGenerations: next.optGenerations,
            localAgentAddress: next.localAgentAddress,
            localAgentName: next.localAgentName,
        };
        set({ ...prefs, hydrated: true });
        cachePrefs(prefs);
        if (partial.theme !== undefined) applyDocumentTheme(prefs.theme);
        if (partial.language !== undefined) applyDocumentLanguage(prefs.language);
    },

    resolvedTheme: () => resolveTheme(get().theme),
}));
