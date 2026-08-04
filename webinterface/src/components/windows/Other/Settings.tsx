"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
    getByokStatus,
    removeGeminiApiKey,
    reverifyGeminiApiKey,
    saveGeminiApiKey,
} from "@/lib/ai/byokActions";
import type { ByokStatus, LlmKeyMeta } from "@/lib/ai/byokTypes";
import Style from "./Settings.module.css";

export default function Settings() {
    const [status, setStatus] = useState<ByokStatus | null>(null);
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const geminiMeta: LlmKeyMeta | undefined = status?.keys.find((k) => k.provider === "gemini");

    const refresh = useCallback(() => {
        startTransition(async () => {
            try {
                const next = await getByokStatus();
                setStatus(next);
                setLoadError(null);
            } catch (e) {
                setLoadError(e instanceof Error ? e.message : "Failed to load key status");
            }
        });
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    function onSave() {
        const value = apiKey.trim();
        if (!value) {
            toast.error("Paste your Gemini API key first");
            return;
        }
        startTransition(async () => {
            const result = await saveGeminiApiKey(value);
            // Clear input immediately so the key doesn't linger in React state longer than needed
            setApiKey("");
            setShowKey(false);
            if (!result.ok) {
                toast.error("Could not save key", { description: result.error, duration: 6000 });
                return;
            }
            toast.success("Gemini key saved & verified", {
                description: `Stored encrypted • fingerprint ${result.meta?.keyFingerprint}`,
                duration: 5000,
            });
            refresh();
        });
    }

    function onReverify() {
        startTransition(async () => {
            const result = await reverifyGeminiApiKey();
            if (!result.ok) {
                toast.error("Key verification failed", {
                    description: result.error,
                    duration: 6000,
                });
                refresh();
                return;
            }
            toast.success("Key still valid", { duration: 4000 });
            refresh();
        });
    }

    function onRemove() {
        if (!confirm("Remove your stored Gemini API key? This cannot be undone.")) return;
        startTransition(async () => {
            const result = await removeGeminiApiKey();
            if (!result.ok) {
                toast.error(result.error || "Failed to remove key");
                return;
            }
            toast.success("Gemini key removed");
            refresh();
        });
    }

    return (
        <div className={Style.container}>
            <header className={Style.header}>
                <div>
                    <h1>AI chat settings</h1>
                </div>
            </header>

            <section className={Style.section}>
                <h2>Gemini API key (BYOK)</h2>
                <p className={Style.help}>
                    In order to use the AI assistant, you need to provide a Gemini API key.
                    You can get one from{" "} <a className={"underline"} href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>.
                </p>

                {loadError && <div className={Style.error}>{loadError}</div>}

                {geminiMeta ? (
                    <div className={Style.statusCard}>
                        <div className={Style.statusRow}>
                            <span className={Style.label}>Stored key</span>
                            <span className={Style.mono}>fp:{geminiMeta.keyFingerprint}</span>
                        </div>
                        <div className={Style.statusRow}>
                            <span className={Style.label}>Status</span>
                            <span
                                className={
                                    geminiMeta.status === "active" ? Style.badgeOk : Style.badgeBad
                                }
                            >
                                {geminiMeta.status}
                            </span>
                        </div>
                        <div className={Style.statusRow}>
                            <span className={Style.label}>Verified</span>
                            <span>
                                {geminiMeta.verifiedAt
                                    ? new Date(geminiMeta.verifiedAt).toLocaleString()
                                    : "—"}
                            </span>
                        </div>
                        <div className={Style.actions}>
                            <button
                                type="button"
                                className={Style.secondaryBtn}
                                disabled={pending}
                                onClick={onReverify}
                            >
                                Re-verify
                            </button>
                            <button
                                type="button"
                                className={Style.dangerBtn}
                                disabled={pending}
                                onClick={onRemove}
                            >
                                Remove key
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={Style.empty}>
                        No personal Gemini key stored.
                        {status?.hasPlatformFallback
                            ? " Chat will use the platform key until you add yours."
                            : " Add a key below to use the AI assistant."}
                    </div>
                )}

                <label className={Style.field}>
                    <span>{geminiMeta ? "Rotate key" : "API key"}</span>
                    <div className={Style.inputRow}>
                        <input
                            className={Style.input}
                            type={showKey ? "text" : "password"}
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="AIza…"
                            value={apiKey}
                            disabled={pending}
                            onChange={(e) => setApiKey(e.target.value)}
                        />
                        <button
                            type="button"
                            className={Style.ghostBtn}
                            disabled={pending || !apiKey}
                            onClick={() => setShowKey((v) => !v)}
                        >
                            {showKey ? "Hide" : "Show"}
                        </button>
                    </div>
                </label>

                <div className={Style.actions}>
                    <button
                        type="button"
                        className={Style.primaryBtn}
                        disabled={pending || !apiKey.trim()}
                        onClick={onSave}
                    >
                        {pending ? "Working…" : geminiMeta ? "Verify & replace" : "Verify & save"}
                    </button>
                    <a
                        className={Style.link}
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Get a key from Google AI Studio
                    </a>
                </div>
            </section>
        </div>
    );
}
