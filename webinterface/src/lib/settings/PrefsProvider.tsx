"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { getUserPrefs } from "@/lib/settings/settingsActions";
import {
    applyDocumentLanguage,
    applyDocumentTheme,
    readCachedPrefs,
    usePrefsStore,
} from "@/lib/settings/prefsStore";

export default function PrefsProvider({ children }: { children: React.ReactNode }) {
    const theme = usePrefsStore((s) => s.theme);
    const resolvedTheme = usePrefsStore((s) => s.resolvedTheme);
    const hydrate = usePrefsStore((s) => s.hydrate);

    useEffect(() => {
        const cached = readCachedPrefs();
        if (cached) {
            applyDocumentTheme(cached.theme);
            applyDocumentLanguage(cached.language);
            usePrefsStore.setState({ ...cached, hydrated: false });
        }

        let cancelled = false;
        void (async () => {
            try {
                const prefs = await getUserPrefs();
                if (!cancelled && prefs) hydrate(prefs);
            } catch {
                /* keep cache / defaults */
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [hydrate]);

    useEffect(() => {
        applyDocumentTheme(theme);
        if (theme !== "system") return;

        const mq = window.matchMedia("(prefers-color-scheme: light)");
        const onChange = () => applyDocumentTheme("system");
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, [theme]);

    const toasterTheme = resolvedTheme();

    return (
        <>
            <Toaster theme={toasterTheme} richColors={true} duration={Infinity} closeButton={true} visibleToasts={6}/>
            {children}
        </>
    );
}
