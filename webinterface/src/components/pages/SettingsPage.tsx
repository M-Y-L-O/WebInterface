"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { getSession, signOut } from "next-auth/react";
import { toast } from "sonner";
import {
    getByokStatus,
    removeGeminiApiKey,
    reverifyGeminiApiKey,
    saveGeminiApiKey,
} from "@/lib/ai/byokActions";
import type { ByokStatus, LlmKeyMeta } from "@/lib/ai/byokTypes";
import {
    getAccountProfile,
    saveUserPrefs,
} from "@/lib/settings/settingsActions";
import {
    LANGUAGE_OPTIONS,
    THEME_OPTIONS,
    type ThemePreference,
    type UserPrefs,
} from "@/lib/settings/types";
import { usePrefsStore } from "@/lib/settings/prefsStore";
import { useWorkspaceStore } from "@/lib/store";
import Style from "./settings.module.css";
import Dropdown from "@/components/structural/Dropdown";

type AccountProfile = {
    id?: string;
    name: string | null;
    email: string | null;
    image: string | null;
};

const ALLOWED_MODELS_FALLBACK = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
];

export default function SettingsPage() {
    const prefs = usePrefsStore();
    const patchPrefs = usePrefsStore((s) => s.patch);
    const clearLayout = useWorkspaceStore((s) => s.clearLayout);

    const [status, setStatus] = useState<ByokStatus | null>(null);
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [account, setAccount] = useState<AccountProfile | null>(null);
    const [models, setModels] = useState<string[]>(ALLOWED_MODELS_FALLBACK);
    const [pending, startTransition] = useTransition();
    const [editKey, setEditKey] = useState(false);

    const [theme, setTheme] = useState<ThemePreference>(prefs.theme);
    const [language, setLanguage] = useState(prefs.language);
    const [defaultModel, setDefaultModel] = useState(prefs.defaultModel);
    const [optEpochs, setOptEpochs] = useState(prefs.optEpochs);
    const [optGenerations, setOptGenerations] = useState(prefs.optGenerations);
    const [localAgentAddress, setLocalAgentAddress] = useState(prefs.localAgentAddress);
    const [localAgentName, setLocalAgentName] = useState(prefs.localAgentName);

    const geminiMeta: LlmKeyMeta | undefined = status?.keys.find((k) => k.provider === "gemini");

    const refreshByok = useCallback(() => {
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
        refreshByok();
        void (async () => {
            const profile = await getAccountProfile();
            if (profile) setAccount(profile);
            else {
                const session = await getSession();
                if (session?.user) {
                    setAccount({
                        name: session.user.name ?? null,
                        email: session.user.email ?? null,
                        image: session.user.image ?? null,
                    });
                }
            }
        })();
        void (async () => {
            try {
                const res = await fetch("/api/ai/chat");
                const data = await res.json().catch(() => ({}));
                if (res.ok && Array.isArray(data.models)) {
                    const ids = data.models
                        .map((m: { id?: string } | string) =>
                            typeof m === "string" ? m : m.id,
                        )
                        .filter(Boolean) as string[];
                    if (ids.length) setModels(ids);
                    if (typeof data.default === "string" && !prefs.defaultModel) {
                        setDefaultModel(data.default);
                    }
                }
            } catch {
                /* keep fallback allowlist */
            }
        })();
    }, [refreshByok, prefs.defaultModel]);

    useEffect(() => {
        setTheme(prefs.theme);
        setLanguage(prefs.language);
        setDefaultModel(prefs.defaultModel);
        setOptEpochs(prefs.optEpochs);
        setOptGenerations(prefs.optGenerations);
        setLocalAgentAddress(prefs.localAgentAddress);
        setLocalAgentName(prefs.localAgentName);
    }, [
        prefs.theme,
        prefs.language,
        prefs.defaultModel,
        prefs.optEpochs,
        prefs.optGenerations,
        prefs.localAgentAddress,
        prefs.localAgentName,
    ]);

    function persist(patch: Partial<UserPrefs>, successMsg: string) {
        startTransition(async () => {
            const result = await saveUserPrefs(patch);
            if (!result.ok) {
                toast.error("Could not save settings", { description: result.error });
                return;
            }
            patchPrefs(result.prefs);
            toast.success(successMsg);
        });
    }

    function onSaveKey() {
        const value = apiKey.trim();
        if (!value) {
            toast.error("Paste your Gemini API key first");
            return;
        }
        startTransition(async () => {
            const result = await saveGeminiApiKey(value);
            setApiKey("");
            setShowKey(false);
            setEditKey(false);
            if (!result.ok) {
                toast.error("Could not save key", { description: result.error, duration: 6000 });
                return;
            }
            toast.success("Gemini key saved & verified", {
                description: `Stored encrypted • fingerprint ${result.meta?.keyFingerprint}`,
                duration: 5000,
            });
            refreshByok();
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
                refreshByok();
                return;
            }
            toast.success("Key still valid", { duration: 4000 });
            refreshByok();
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
            refreshByok();
        });
    }

    function onResetLayout() {
        clearLayout();
        toast.success("Workspace layout cleared", {
            description: "Reopen the project to get the default dock layout.",
        });
    }

    return (
        <div className={Style.container}>
            <section className={Style.section}>
                <h2 className={Style.title}>Account</h2>
                {account ? (
                    <div className={Style.statusCard}>
                        <div className={Style.accountRow}>
                            {account.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    className={Style.avatar}
                                    src={account.image}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className={Style.avatarFallback}>
                                    <i className="fa-solid fa-circle-user" />
                                </div>
                            )}
                            <div className={Style.accountMeta}>
                                <span className={Style.accountName}>
                                    {account.name || "Signed in"}
                                </span>
                                <span className={Style.accountEmail}>
                                    {account.email || "—"}
                                </span>
                                <button
                                    type="button"
                                    className={Style.signout}
                                    onClick={() => signOut({ callbackUrl: "/auth" })}
                                >
                                    Sign out <i className={"fa-solid fa-arrow-right-from-bracket"}/>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={Style.accountRow}>Not signed in.</div>
                )}
            </section>

            <section className={Style.section}>
                <h2>Appearance</h2>
                <div className={Style.Row}>
                <label className={Style.field}>
                    <h3>Theme</h3>
                    <Dropdown
                        defaultValue={theme}
                        options = {THEME_OPTIONS}
                        onChange={(e) => {
                            const next = e as ThemePreference;
                            setTheme(next);
                            persist({ theme: next }, "Theme updated");
                        }}
                    >
                    </Dropdown>
                </label>

                <label className={Style.field}>
                    <h3>Language</h3>
                    <Dropdown
                        defaultValue={language}
                        onChange={(e) => {
                            const next = e;
                            setLanguage(next);
                            persist({ language: next }, "Language updated");
                        }}
                        options = {LANGUAGE_OPTIONS}
                    >
                    </Dropdown>
                </label>
                </div>
            </section>

            <section className={Style.section}>
                <h2>AI assistant</h2>
                <div className={"flex flex-col gap-[1.618rem] w-full "}>
                    <div className={Style.Row}>
                        <label className={Style.field}>
                            <h3>Default model</h3>
                            <Dropdown
                                defaultValue={models.includes(defaultModel) ? defaultModel : models[0]}
                                onChange={(e) => {
                                    const next = e;
                                    setDefaultModel(next);
                                    persist({ defaultModel: next }, "Default model updated");
                                }}
                                options = {models}
                            >
                            </Dropdown>
                        </label>
                        <p className={Style.help}>
                            Default model for new chats.
                        </p>
                    </div>

                    <div className={Style.Row}>
                        {loadError && <div className={Style.error}>{loadError}</div>}

                        {
                            geminiMeta ? <div>
                                <h3>Current key</h3>
                                <div>
                                    <div className={editKey ?Style.apiKeyInput : Style.apiKeyDisplay} >
                                        <input
                                            className={Style.input}
                                            type={showKey ? "text" : "password"}
                                            autoComplete="off"
                                            spellCheck={false}
                                            placeholder={geminiMeta.keyFingerprint + "*****************"}
                                            value={apiKey}
                                            disabled={pending || !editKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                        />
                                        <button onClick={() => setShowKey(!showKey)} disabled={!editKey}>
                                            <i className={showKey ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"}/>
                                        </button>
                                    </div>
                                    <div className={"flex"}>
                                        <button className={Style.actionButton} onClick={()=>{
                                            if(editKey)
                                                setApiKey("");

                                            setEditKey(!editKey);
                                            setShowKey(false)
                                        }}>
                                            {editKey ? "Cancel" : "Edit"}
                                        </button>
                                        {
                                            editKey &&
                                                <button className={`${Style.actionButton} ${Style.constructive}`} onClick={onSaveKey} disabled={pending}>
                                                    {pending ? "Saving..." : "Save"}
                                                </button>
                                        }
                                            <button className={`${Style.actionButton} ${Style.destructive}`} onClick={onRemove} disabled={pending} title={"Remove key"}>
                                                <i className="fa-solid fa-trash-can"/>
                                            </button>
                                    </div>
                                    </div>
                            </div>
                                :
                            <div>
                                <h3>API Key</h3>
                                <div className={Style.apiKeyInput} >
                                    <input
                                        className={Style.input}
                                        type={showKey ? "text" : "password"}
                                        autoComplete="off"
                                        spellCheck={false}
                                        placeholder={"abcd*****************"}
                                        value={apiKey}
                                        disabled={pending}
                                        onChange={(e) => setApiKey(e.target.value)}
                                    />
                                    <button onClick={() => setShowKey(!showKey)} disabled={!editKey}>
                                        <i className={showKey ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"}/>
                                    </button>
                                </div>
                                <button className={Style.actionButton} onClick={onSaveKey} disabled={pending}>
                                    {pending ? "Saving..." : "Add Key"}
                                </button>
                            </div>
                        }

                        <div className={Style.actions}>
                            <a
                                className={Style.link}
                                href="https://aistudio.google.com/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Get a key from Google AI Studio
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            <section className={Style.section}>
                <h2>Workspace</h2>
                <div className={Style.Row}>
                    <div className={`${Style.actionButton} ${Style.visible}`}>
                        <button
                            type="button"
                            className={Style.secondaryBtn}
                            onClick={onResetLayout}
                        >
                            Reset workspace layout
                        </button>
                    <p className={Style.help}>
                        Clear the saved dock layout for the current project so the default panels return
                        next time you open it.
                    </p>
                    </div>
                </div>
            </section>

            <section className={Style.section}>
                <h2>Defaults</h2>
                <div className={"flex flex-col gap-[1.618rem] w-full "}>
                    <div className={Style.Row}>
                        <div className={Style.fieldGrid}>
                            <div className={"mb-[1.618rem]"}>
                                <h3>Optimization epochs</h3>
                                <input
                                    className={Style.genericInput}
                                    type="number"
                                    min={1}
                                    max={10000}
                                    value={optEpochs}
                                    disabled={pending}
                                    onChange={(e) => setOptEpochs(Number(e.target.value) || 1)}
                                    onBlur={() => {
                                        if (optEpochs === prefs.optEpochs) return;
                                        persist({ optEpochs }, "Optimization defaults updated");
                                    }}
                                />
                            </div>
                            <div className={"mb-[0.5rem]"}>
                                <h3>Optimization generations</h3>
                                <input
                                    className={Style.genericInput}
                                    type="number"
                                    min={1}
                                    max={10000}
                                    value={optGenerations}
                                    disabled={pending}
                                    onChange={(e) => setOptGenerations(Number(e.target.value) || 1)}
                                    onBlur={() => {
                                        if (optGenerations === prefs.optGenerations) return;
                                        persist({ optGenerations }, "Optimization defaults updated");
                                    }}
                                />
                            </div>
                            <p className={Style.help}>
                                Used when starting a new optimization run.
                            </p>
                        </div>
                    </div>
                    <div className={Style.Row}>
                        <div className={"mb-[1.618rem]"}>
                            <h3>Local agent name</h3>
                            <input
                                className={Style.genericInput}
                                type="text"
                                value={localAgentName}
                                disabled={pending}
                                onChange={(e) => setLocalAgentName(e.target.value)}
                                onBlur={() => {
                                    if (localAgentName === prefs.localAgentName) return;
                                    persist({ localAgentName }, "Local agent defaults updated");
                                }}
                            />
                        </div>
                        <div className={"mb-[0.5rem]"}>
                            <h3>Local agent address</h3>
                            <input
                                className={Style.genericInput}
                                type="text"
                                spellCheck={false}
                                placeholder="http://127.0.0.1:8080"
                                value={localAgentAddress}
                                disabled={pending}
                                onChange={(e) => setLocalAgentAddress(e.target.value)}
                                onBlur={() => {
                                    if (localAgentAddress === prefs.localAgentAddress) return;
                                    persist({ localAgentAddress }, "Local agent defaults updated");
                                }}
                            />
                        </div>
                    </div>
                </div>

            </section>

            <section className={Style.section}>
                <h2>About</h2>
                <div className={Style.Row}>
                    <div className={Style.statusRow}>
                        <h3 className={Style.label}>Product</h3>
                        <span>MYLO - Myelin Learning Optimizer</span>
                    </div>
                    <div className={Style.statusRow}>
                        <h3 className={Style.label}>Version</h3>
                        <span className={Style.mono}>0.1.0</span>
                    </div>
                </div>
            </section>
            <div className={"mt-[1.618rem]"}></div>
        </div>
    );
}
