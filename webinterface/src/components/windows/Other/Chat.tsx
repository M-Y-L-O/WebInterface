"use client";

import {FormEvent, KeyboardEvent, useEffect, useRef, useState} from "react";
import { buildProjectContextSnapshot } from "@/lib/ai/projectContext";
import { executeAiTool } from "@/lib/ai/executeTool";
import type { AiChatResponse, AiContent, ChatMessage } from "@/lib/ai/types";
import Style from "./Chat.module.css";
import {addWindow} from "@/lib/windows/windowActions";

import MarkDownPreview from "@uiw/react-markdown-preview"
import Dropdown from "@/components/structural/Dropdown";
import {useDockviewStore} from "@/lib/store";

const MAX_TOOL_ROUNDS = 12;

function uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function callGemini(contents: AiContent[], model?:string): Promise<AiChatResponse> {
    const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents,
            projectContext: buildProjectContextSnapshot(),
            model: model,
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || `Chat request failed (${res.status})`);
    }
    return data as AiChatResponse;
}

export default function Chat() {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: "welcome",
            role: "assistant",
            content:
                "Hi — I'm the MYLO assistant. Ask me anything about the project and I'll see with what I can help.",
        },
    ]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [models, setModels] = useState<string[] | null>(null);
    const [internalNames, setInternalNames] = useState<string[]>([]);
    const [model, setModel] = useState<string | null>(null);
    const [activeInternal, setActiveInternal] = useState<string | null>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const historyRef = useRef<AiContent[]>([]);

    const api = useDockviewStore(state => state.api);

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [messages, busy]);

    useEffect(() => {
        fetchModels();
    }, []);

    async function fetchModels(){
        const res = await fetch("/api/ai/chat", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data?.error || `Model request failed (${res.status})`);
        }
        let _models:string[] = [], _internal:string[] = [];
        if(data.models && data.models.pageInternal){
            data.models.pageInternal.forEach((m:any)=>{
                console.log(m);
                if(m.supportedActions.some((r:string) => r==="generateContent"))
                _models.push(m.displayName);
                _internal.push(m.name.split("/")[1])
            })
        }

        setModels(_models);
        setInternalNames(_internal);
        setModel(_models[0]);
    }

    async function runAgent(userText: string) {
        setBusy(true);
        setError(null);

        const userMsg: ChatMessage = { id: uid(), role: "user", content: userText };
        setMessages((prev) => [...prev, userMsg]);

        const contents: AiContent[] = [
            ...historyRef.current,
            { role: "user", parts: [{ text: userText }] },
        ];

        try {
            for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
                const reply = await callGemini(contents);

                if (reply.modelContent) {
                    contents.push(reply.modelContent);
                } else if (reply.text) {
                    contents.push({
                        role: "model",
                        parts: [{ text: reply.text }],
                    });
                }

                const calls = reply.functionCalls || [];
                if (!calls.length) {
                    const text =
                        reply.text?.trim() ||
                        "I finished without a text reply. Try rephrasing your request.";
                    historyRef.current = contents;
                    setMessages((prev) => [
                        ...prev,
                        { id: uid(), role: "assistant", content: text },
                    ]);
                    return;
                }

                // Show tool activity in the transcript
                for (const call of calls) {
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
                }

                const responseParts: AiContent["parts"] = [];
                for (const call of calls) {
                    const result = await executeAiTool(call);
                    const ok = !result.error;
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
                                        // @ts-ignore
                                        : `${call.name} failed: ${result.error.code} ${result.error.message}`,
                                };
                                console.log("Tool result:", result);
                                break;
                            }
                        }
                        return next;
                    });

                    responseParts.push({
                        functionResponse: {
                            name: call.name,
                            id: call.id,
                            response: result,
                        },
                    });
                }

                contents.push({ role: "user", parts: responseParts });
            }

            historyRef.current = contents;
            setMessages((prev) => [
                ...prev,
                {
                    id: uid(),
                    role: "assistant",
                    content:
                        "I hit the tool-call limit for this turn. Ask me to continue if you need more.",
                },
            ]);
        } catch (e) {
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
            setBusy(false);
            inputRef.current?.focus();
        }
    }

    function onSubmit(e?: FormEvent) {
        e?.preventDefault();
        const text = input.trim();
        if (!text || busy) return;
        setInput("");
        void runAgent(text);
    }

    return (
        <div className={Style.container}>
            <header className={Style.header}>
                <div className={"flex flex-col items-center justify-center"}>
                    <h1>MYLO Assistant</h1>
                    { models && model &&
                    <Dropdown options={models} defaultValue={model} onChange={(e)=>{
                        setModel(e);
                        setActiveInternal(internalNames[models?.indexOf(e)!]);

                    }} small={true}/>
                    }
                </div>
                <div className={"flex flex-row items-center justify-center gap-5"}>
                    <button
                        type="button"
                        className={Style.clearBtn}
                        disabled={busy}
                        title={"New Chat"}
                        onClick={() => {
                            historyRef.current = [];
                            setMessages([
                                {
                                    id: "welcome",
                                    role: "assistant",
                                    content:
                                        "New chat. What would you like to do next?",
                                },
                            ]);
                            setError(null);
                        }}
                    >
                        <i className={"fa-solid fa-plus"}/>
                    </button>
                    <button className={Style.clearBtn} onClick={()=>{addWindow(api, "Settings")}} title={"Api Key Settings"}>
                        <i className={"fa-solid fa-key"} />
                    </button>
                </div>
            </header>

            <div className={Style.messages} ref={scrollerRef}>
                {messages.map((m) => (
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
                            <div className={Style.bubbleText}><MarkDownPreview source={m.content} style={{backgroundColor:"transparent", color:m.role=="user" ? "var(--card-background)" : "var(--text)"}}/></div>
                        )}
                    </div>
                ))}
                {busy ? (
                    <div className={`${Style.bubble} ${Style.assistant} ${Style.typing}`}>
                        Thinking…
                    </div>
                ) : null}
            </div>

            {error ? <div className={Style.error}>{error}</div> : null}

            <form className={Style.composer} onSubmit={onSubmit}>
                <input
                    className={Style.input}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type here..."
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
