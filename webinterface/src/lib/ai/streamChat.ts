import type { AiChatResponse, AiContent, AiFunctionCall, AiStreamEvent } from "@/lib/ai/types";
import { buildProjectContextSnapshot } from "@/lib/ai/projectContext";

export type StreamChatHandlers = {
    onTextDelta?: (text: string) => void;
    signal?: AbortSignal;
};

/**
 * POST /api/ai/chat as SSE and assemble a full AiChatResponse.
 * Calls onTextDelta for live assistant bubble updates.
 */
export async function streamChatTurn(
    contents: AiContent[],
    model: string | undefined,
    handlers: StreamChatHandlers = {},
): Promise<AiChatResponse> {
    const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
        },
        body: JSON.stringify({
            contents,
            projectContext: buildProjectContextSnapshot(),
            model,
        }),
        signal: handlers.signal,
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Chat request failed (${res.status})`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream") || !res.body) {
        // Fallback if a proxy strips SSE
        const data = await res.json().catch(() => ({}));
        return data as AiChatResponse;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let functionCalls: AiFunctionCall[] | undefined;
    let modelContent: AiContent | undefined;
    let finishReason: string | undefined;

    const handleEvent = (event: AiStreamEvent) => {
        switch (event.type) {
            case "text_delta":
                text += event.text;
                handlers.onTextDelta?.(event.text);
                break;
            case "function_calls":
                functionCalls = event.functionCalls;
                break;
            case "model_content":
                modelContent = event.modelContent;
                break;
            case "finish":
                if (event.text) text = event.text;
                finishReason = event.finishReason;
                break;
            case "error":
                throw new Error(event.error);
            case "done":
                break;
        }
    };

    const consumeBuffer = (chunk: string) => {
        const line = chunk
            .split("\n")
            .map((l) => l.trim())
            .find((l) => l.startsWith("data:"));
        if (!line) return;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") return;
        try {
            handleEvent(JSON.parse(raw) as AiStreamEvent);
        } catch {
            /* ignore malformed SSE frames */
        }
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";
        for (const chunk of chunks) consumeBuffer(chunk);
    }
    // Flush trailing frame if the stream closed without a final blank line.
    buffer += decoder.decode();
    if (buffer.trim()) consumeBuffer(buffer);

    // Prefer assembled text; fall back to modelContent text parts.
    if (!text.trim() && modelContent?.parts) {
        text = modelContent.parts
            .map((p) => ("text" in p && typeof p.text === "string" ? p.text : ""))
            .join("");
    }

    return {
        text: text.trim() || undefined,
        functionCalls,
        modelContent,
        finishReason,
    };
}
