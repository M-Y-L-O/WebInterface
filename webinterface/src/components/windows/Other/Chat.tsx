"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { executeAiTool } from "@/lib/ai/executeTool";
import { truncateJson } from "@/lib/ai/projectContext";
import { streamChatTurn } from "@/lib/ai/streamChat";
import { buildSuggestedPrompts } from "@/lib/ai/suggestedPrompts";
import type { AiContent, ChatMessage } from "@/lib/ai/types";
import Style from "./Chat.module.css";

import MarkDownPreview from "@uiw/react-markdown-preview";
import Dropdown from "@/components/structural/Dropdown";
import { usePrefsStore } from "@/lib/settings/prefsStore";
import { DEFAULT_USER_PREFS } from "@/lib/settings/types";
import { getProjectId } from "@/lib/store";

const WELCOME: ChatMessage = {
    id: "welcome",
    role: "assistant",
    content:
        "Hi — I'm the MYLO assistant. Ask me anything about the project and I'll see with what I can help.",
};

function uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toolErrorText(result: Record<string, unknown>): string {
    const err = result.error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object") {
        const e = err as { code?: string; message?: string };
        return [e.code, e.message].filter(Boolean).join(" ") || JSON.stringify(err);
    }
    return "unknown error";
}

export default function Chat() {
    const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [chatId, setChatId] = useState<string | null>(null);
    const [hydrated, setHydrated] = useState(false);

    const defaultModel = usePrefsStore((s) => s.defaultModel);
    const aiMaxTurns = usePrefsStore((s) => s.aiMaxTurns);
    const aiMaxToolCalls = usePrefsStore((s) => s.aiMaxToolCalls);
    const [models, setModels] = useState<string[] | null>(null);
    const [model, setModel] = useState<string | null>(defaultModel);

    const scrollerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const historyRef = useRef<AiContent[]>([]);
    const abortRef = useRef<AbortController | null>(null);
    const chatIdRef = useRef<string | null>(null);
    const messagesRef = useRef(messages);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        chatIdRef.current = chatId;
    }, [chatId]);

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [messages, busy]);

    useEffect(() => {
        void fetchModels();
    }, [defaultModel]);

    const refreshSuggestions = useCallback(() => {
        try {
            setSuggestions(buildSuggestedPrompts());
        } catch {
            setSuggestions(["What can you help me with in this project?"]);
        }
    }, []);

    const persistChat = useCallback(
        async (nextMessages: ChatMessage[], contents: AiContent[]) => {
            const projectKey = getProjectId();
            if (!projectKey) return;
            try {
                const res = await fetch("/api/ai/chats", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: chatIdRef.current,
                        projectKey,
                        title:
                            nextMessages.find((m) => m.role === "user")?.content.slice(0, 80) ||
                            "Chat",
                        messages: nextMessages,
                        geminiContents: contents,
                        model,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.chat?.id) {
                    setChatId(data.chat.id);
                    chatIdRef.current = data.chat.id;
                }
            } catch {
                /* persistence is best-effort */
            }
        },
        [model],
    );

    useEffect(() => {
        let cancelled = false;
        async function hydrate() {
            const projectKey = getProjectId();
            refreshSuggestions();
            if (!projectKey) {
                setHydrated(true);
                return;
            }
            try {
                const res = await fetch(
                    `/api/ai/chats?projectKey=${encodeURIComponent(projectKey)}&latest=1`,
                );
                const data = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (res.ok && data.chat) {
                    const msgs = Array.isArray(data.chat.messages)
                        ? (data.chat.messages as ChatMessage[])
                        : [];
                    const contents = Array.isArray(data.chat.geminiContents)
                        ? (data.chat.geminiContents as AiContent[])
                        : [];
                    if (msgs.length) {
                        setMessages(msgs);
                        historyRef.current = contents;
                        setChatId(data.chat.id);
                        chatIdRef.current = data.chat.id;
                        if (data.chat.model) setModel(data.chat.model);
                    }
                }
            } catch {
                /* keep welcome */
            } finally {
                if (!cancelled) setHydrated(true);
            }
        }
        void hydrate();
        return () => {
            cancelled = true;
        };
    }, [refreshSuggestions]);

    async function fetchModels() {
        try {
            const res = await fetch("/api/ai/chat", {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || `Model request failed (${res.status})`);
            }
            const ids: string[] = Array.isArray(data.models)
                ? data.models
                      .map((m: { id?: string } | string) =>
                          typeof m === "string" ? m : m.id,
                      )
                      .filter(Boolean)
                : [];
            const preferred =
                (defaultModel && ids.includes(defaultModel) && defaultModel) ||
                (typeof data.default === "string" && ids.includes(data.default) && data.default) ||
                ids[0] ||
                defaultModel ||
                null;
            setModels(ids.length ? ids : null);
            setModel(preferred);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load models");
            setModel(defaultModel || null);
        }
    }

    function stopAgent() {
        abortRef.current?.abort();
        abortRef.current = null;
        setBusy(false);
        setMessages((prev) => [
            ...prev,
            {
                id: uid(),
                role: "assistant",
                content: "Stopped.",
                kind: "cancelled",
            },
        ]);
    }

    async function runAgent(userText: string, opts?: { continueFromLimit?: boolean }) {
        if (busy) return;

        const controller = new AbortController();
        abortRef.current = controller;
        setBusy(true);
        setError(null);

        const isContinue = Boolean(opts?.continueFromLimit);
        const userMsg: ChatMessage = {
            id: uid(),
            role: "user",
            content: userText,
        };
        if (!isContinue) {
            setMessages((prev) => [...prev, userMsg]);
        } else {
            setMessages((prev) => [...prev, userMsg]);
        }

        const contents: AiContent[] = [
            ...historyRef.current,
            { role: "user", parts: [{ text: userText }] },
        ];

        const maxTurns = aiMaxTurns || DEFAULT_USER_PREFS.aiMaxTurns;
        const maxToolCalls = aiMaxToolCalls || DEFAULT_USER_PREFS.aiMaxToolCalls;
        let toolCallsUsed = 0;
        let hitLimit: "turns" | "tools" | null = null;
        let streamMsgId: string | null = null;
        const toolsDone: { name: string; ok: boolean }[] = [];

        function summarizeToolsFallback(): string | null {
            if (!toolsDone.length) return null;
            const ok = toolsDone.filter((t) => t.ok).map((t) => t.name);
            const bad = toolsDone.filter((t) => !t.ok).map((t) => t.name);
            const parts: string[] = [];
            if (ok.includes("save_model")) {
                parts.push("Saved the model after applying the latest edits.");
            } else if (ok.includes("validate_model")) {
                parts.push("Validated the model successfully.");
            } else if (ok.some((n) => n.startsWith("edit_model") || n === "edit_model")) {
                parts.push("Applied model graph edits.");
            }
            if (ok.length && !parts.length) {
                parts.push(`Finished tools: ${[...new Set(ok)].join(", ")}.`);
            }
            if (bad.length) {
                parts.push(`Some tools failed: ${[...new Set(bad)].join(", ")}.`);
            }
            return parts.length ? parts.join(" ") : null;
        }

        try {
            for (let round = 0; round < maxTurns; round++) {
                if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");

                // Only create an assistant bubble when text actually arrives —
                // tool-only turns used to leave a blank bubble behind.
                streamMsgId = null;
                const onTextDelta = (delta: string) => {
                    if (!streamMsgId) {
                        streamMsgId = uid();
                        const id = streamMsgId;
                        setMessages((prev) => [
                            ...prev,
                            { id, role: "assistant", content: delta },
                        ]);
                        return;
                    }
                    const id = streamMsgId;
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === id ? { ...m, content: m.content + delta } : m,
                        ),
                    );
                };

                let reply = await streamChatTurn(contents, model || undefined, {
                    signal: controller.signal,
                    onTextDelta,
                });

                // After a tool round, empty text replies are common if history was
                // malformed — nudge once for a plain-text answer.
                if (
                    !(reply.functionCalls?.length) &&
                    !reply.text?.trim() &&
                    round > 0 &&
                    round + 1 < maxTurns
                ) {
                    contents.push({
                        role: "user",
                        parts: [
                            {
                                text: "Please reply to the user now in plain text based on the tool results above. Do not call more tools unless required.",
                            },
                        ],
                    });
                    streamMsgId = null;
                    reply = await streamChatTurn(contents, model || undefined, {
                        signal: controller.signal,
                        onTextDelta,
                    });
                }

                const calls = reply.functionCalls || [];

                // Always record a well-formed model turn before any functionResponse.
                const modelHasCalls = Boolean(
                    reply.modelContent?.parts?.some(
                        (p) => "functionCall" in p && p.functionCall?.name,
                    ),
                );
                if (calls.length && !modelHasCalls) {
                    const parts: AiContent["parts"] = [];
                    if (reply.text?.trim()) parts.push({ text: reply.text.trim() });
                    for (const call of calls) {
                        parts.push({
                            functionCall: {
                                name: call.name,
                                args: call.args || {},
                                ...(call.id ? { id: call.id } : {}),
                            },
                        });
                    }
                    contents.push({ role: "model", parts });
                } else if (reply.modelContent) {
                    contents.push(reply.modelContent);
                } else if (reply.text?.trim()) {
                    contents.push({
                        role: "model",
                        parts: [{ text: reply.text.trim() }],
                    });
                }

                if (!calls.length) {
                    const text =
                        reply.text?.trim() ||
                        summarizeToolsFallback() ||
                        "I finished without a text reply. Try rephrasing your request.";
                    setMessages((prev) => {
                        let next = prev;
                        if (streamMsgId) {
                            next = prev.map((m) =>
                                m.id === streamMsgId ? { ...m, content: text } : m,
                            );
                        } else {
                            next = [
                                ...prev,
                                { id: uid(), role: "assistant", content: text },
                            ];
                        }
                        // Drop any leftover empty assistant placeholders
                        next = next.filter(
                            (m) => !(m.role === "assistant" && !m.content.trim()),
                        );
                        void persistChat(next, contents);
                        return next;
                    });
                    historyRef.current = contents;
                    return;
                }

                // Drop empty placeholders before tool rows
                setMessages((prev) =>
                    prev.filter((m) => !(m.role === "assistant" && !m.content.trim())),
                );

                const responseParts: AiContent["parts"] = [];
                for (const call of calls) {
                    if (controller.signal.aborted) {
                        throw new DOMException("Aborted", "AbortError");
                    }
                    if (toolCallsUsed >= maxToolCalls) {
                        hitLimit = "tools";
                        responseParts.push({
                            functionResponse: {
                                name: call.name,
                                id: call.id,
                                response: {
                                    error: {
                                        code: "tool_limit",
                                        message: "Skipped: max tool calls reached for this turn.",
                                    },
                                },
                            },
                        });
                        continue;
                    }
                    toolCallsUsed += 1;

                    setMessages((prev) => [
                        ...prev,
                        {
                            id: uid(),
                            role: "tool",
                            toolName: call.name,
                            content: `Running ${call.name}…`,
                            pending: true,
                        },
                    ]);

                    const result = await executeAiTool(call);
                    const ok = !result.error;
                    toolsDone.push({ name: call.name, ok });
                    setMessages((prev) => {
                        const next = [...prev];
                        for (let i = next.length - 1; i >= 0; i--) {
                            if (
                                next[i].role === "tool" &&
                                next[i].toolName === call.name &&
                                next[i].pending
                            ) {
                                next[i] = {
                                    ...next[i],
                                    pending: false,
                                    content: ok
                                        ? `${call.name} completed`
                                        : `${call.name} failed: ${toolErrorText(result)}`,
                                };
                                break;
                            }
                        }
                        return next;
                    });

                    const safeResponse =
                        (truncateJson(result, 12_000) as Record<string, unknown>) || {
                            ok: true,
                        };
                    responseParts.push({
                        functionResponse: {
                            name: call.name,
                            ...(call.id ? { id: call.id } : {}),
                            response: safeResponse,
                        },
                    });
                }

                contents.push({ role: "user", parts: responseParts });
                if (hitLimit === "tools") break;
            }

            if (!hitLimit) hitLimit = "turns";

            historyRef.current = contents;
            const limitMsg: ChatMessage = {
                id: uid(),
                role: "assistant",
                kind: "limit",
                content:
                    hitLimit === "tools"
                        ? "I hit the tool-call limit for this turn. Click Continue if you need more."
                        : "I hit the turn limit for this request. Click Continue if you need more.",
            };
            setMessages((prev) => [...prev, limitMsg]);
            await persistChat([...messagesRef.current, limitMsg], contents);
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") {
                historyRef.current = contents;
                return;
            }
            const message = e instanceof Error ? e.message : "Chat failed";
            setError(message);
            setMessages((prev) => [
                ...prev,
                {
                    id: uid(),
                    role: "assistant",
                    content: `Sorry — ${message}`,
                },
            ]);
        } finally {
            if (abortRef.current === controller) abortRef.current = null;
            setBusy(false);
            inputRef.current?.focus();
            // Refresh suggestions only when still near empty welcome
            if (historyRef.current.length === 0) refreshSuggestions();
        }
    }

    function onContinue() {
        void runAgent("Please continue from where you left off.", {
            continueFromLimit: true,
        });
    }

    function onSubmit(e?: FormEvent) {
        e?.preventDefault();
        const text = input.trim();
        if (!text || busy) return;
        setInput("");
        void runAgent(text);
    }

    function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    }

    async function onNewChat() {
        abortRef.current?.abort();
        historyRef.current = [];
        setChatId(null);
        chatIdRef.current = null;
        setMessages([
            {
                id: "welcome",
                role: "assistant",
                content: "New chat. What would you like to do next?",
            },
        ]);
        setError(null);
        refreshSuggestions();

        const projectKey = getProjectId();
        if (!projectKey) return;
        try {
            const res = await fetch("/api/ai/chats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectKey,
                    title: "New chat",
                    messages: [
                        {
                            id: "welcome",
                            role: "assistant",
                            content: "New chat. What would you like to do next?",
                        },
                    ],
                    geminiContents: [],
                    model,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.chat?.id) {
                setChatId(data.chat.id);
                chatIdRef.current = data.chat.id;
            }
        } catch {
            /* ignore */
        }
    }

    const showSuggestions =
        hydrated &&
        !busy &&
        historyRef.current.length === 0 &&
        messages.every((m) => m.role === "assistant" || m.id === "welcome") &&
        suggestions.length > 0;

    return (
        <div className={Style.container}>
            <header className={Style.header}>
                <h1 className={"text-nowrap"}>MYLO Assistant</h1>
                {models && model && (
                    <Dropdown
                        options={models}
                        defaultValue={model}
                        onChange={(e) => {
                            setModel(e);
                        }}
                        small={true}
                    />
                )}
                <div className={"flex flex-row items-center justify-center gap-2"}>
                    {busy ? (
                        <button
                            type="button"
                            className={Style.clearBtn}
                            title="Stop"
                            onClick={stopAgent}
                        >
                            <i className={"fa-solid fa-stop"} />
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className={Style.clearBtn}
                        disabled={busy}
                        title={"New Chat"}
                        onClick={() => void onNewChat()}
                    >
                        <i className={"fa-solid fa-plus"} />
                    </button>
                </div>
            </header>

            <div className={Style.messages} ref={scrollerRef}>
                {messages.map((m) => {
                    // Never paint empty assistant placeholders (tool-only turns).
                    if (m.role === "assistant" && !m.content.trim()) return null;
                    return (
                    <div
                        key={m.id}
                        className={`${Style.bubble} ${
                            m.role === "user"
                                ? Style.user
                                : m.role === "tool"
                                  ? Style.tool
                                  : Style.assistant
                        }`}
                    >
                        {m.role === "tool" ? (
                            <span className={Style.toolLabel}>
                                {m.pending ? "⚙" : "✓"} {m.content}
                            </span>
                        ) : (
                            <div className={Style.bubbleText}>
                                <MarkDownPreview
                                    source={m.content}
                                    style={{
                                        backgroundColor: "transparent",
                                        color:
                                            m.role == "user"
                                                ? "var(--card-background)"
                                                : "var(--text)",
                                    }}
                                />
                                {m.kind === "limit" && !busy ? (
                                    <button
                                        type="button"
                                        className={Style.continueBtn}
                                        onClick={onContinue}
                                    >
                                        Continue
                                    </button>
                                ) : null}
                            </div>
                        )}
                    </div>
                    );
                })}
                {busy &&
                (messages[messages.length - 1]?.role === "tool" ||
                    messages[messages.length - 1]?.role === "user" ||
                    !messages.some((m) => m.role === "assistant" && m.content.trim())) ? (
                    <div className={`${Style.bubble} ${Style.assistant} ${Style.typing}`}>
                        Thinking…
                    </div>
                ) : null}

                {showSuggestions ? (
                    <div className={Style.suggestions}>
                        {suggestions.map((s) => (
                            <button
                                key={s}
                                type="button"
                                className={Style.suggestionChip}
                                onClick={() => void runAgent(s)}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>

            {error ? <div className={Style.error}>{error}</div> : null}

            <form className={Style.composer} onSubmit={onSubmit}>
                <textarea
                    ref={inputRef}
                    className={Style.input}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onComposerKeyDown}
                    placeholder="Type here… (Enter to send, Shift+Enter for newline)"
                    disabled={busy}
                />
                <button
                    type="submit"
                    className={Style.sendBtn}
                    disabled={busy || !input.trim()}
                >
                    <i className={"fa-solid fa-send"} />
                </button>
            </form>
        </div>
    );
}
