import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { compactContents } from "@/lib/ai/compactHistory";
import {
    getDefaultModelId,
    isModelAllowed,
    listGeminiModels,
} from "@/lib/ai/listGeminiModels";
import { buildSystemInstruction } from "@/lib/ai/systemPrompt";
import { MYLO_FUNCTION_DECLARATIONS } from "@/lib/ai/tools";
import { checkAiRateLimit } from "@/lib/ai/rateLimit";
import { handleGeminiAuthFailure, resolveGeminiApiKey } from "@/lib/ai/resolveApiKey";
import type {
    AiChatRequest,
    AiContent,
    AiFunctionCall,
    AiStreamEvent,
} from "@/lib/ai/types";
import { getOrCreateUserSettings } from "@/lib/db/userSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTENTS = 40;
const MAX_CONTENT_CHARS = 200_000;

function isProviderAuthError(message: string): boolean {
    return /api.?key|permission|unauth|invalid|403|401|PERMISSION_DENIED/i.test(message);
}

function sseEncode(event: AiStreamEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}

function myloToolsOnly() {
    return [{ functionDeclarations: MYLO_FUNCTION_DECLARATIONS }];
}

function myloToolsWithBuiltins() {
    return [
        { functionDeclarations: MYLO_FUNCTION_DECLARATIONS },
        { googleSearch: {} },
        { codeExecution: {} },
    ];
}

function extractFromParts(parts: any[]): {
    textParts: string[];
    functionCalls: AiFunctionCall[];
} {
    const textParts: string[] = [];
    const functionCalls: AiFunctionCall[] = [];
    for (const part of parts) {
        if (typeof part?.text === "string" && part.text) {
            textParts.push(part.text);
        }
        if (part?.functionCall?.name) {
            functionCalls.push({
                name: String(part.functionCall.name),
                args: (part.functionCall.args || {}) as Record<string, unknown>,
                id: part.functionCall.id ? String(part.functionCall.id) : undefined,
            });
        }
    }
    return { textParts, functionCalls };
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    const userId = session?.user?.id as string | undefined;
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rate = checkAiRateLimit(userId);
    if (!rate.ok) {
        return NextResponse.json(
            { error: "Too many AI requests. Try again shortly." },
            {
                status: 429,
                headers: {
                    "Retry-After": String(rate.retryAfterSec),
                    "X-RateLimit-Remaining": "0",
                },
            },
        );
    }

    const resolved = await resolveGeminiApiKey(userId);
    if (!resolved.ok) {
        const status = resolved.code === "NO_KEY" || resolved.code === "INVALID_KEY" ? 503 : 500;
        return NextResponse.json({ error: resolved.error, code: resolved.code }, { status });
    }

    const { apiKey, source } = resolved.resolved;

    let body: AiChatRequest;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!Array.isArray(body.contents) || body.contents.length === 0) {
        return NextResponse.json({ error: "contents required" }, { status: 400 });
    }

    const compacted = compactContents(body.contents, {
        maxContents: MAX_CONTENTS - 2,
        maxChars: MAX_CONTENT_CHARS - 10_000,
    });
    const contents = compacted.contents;

    if (contents.length > MAX_CONTENTS) {
        return NextResponse.json({ error: "Too many content turns" }, { status: 400 });
    }

    const approxSize =
        JSON.stringify(contents).length +
        (body.projectContext ? JSON.stringify(body.projectContext).length : 0);
    if (approxSize > MAX_CONTENT_CHARS) {
        return NextResponse.json({ error: "Request payload too large" }, { status: 413 });
    }

    const model = isModelAllowed(body.model);
    if (!model) {
        return NextResponse.json({ error: "Model not allowed" }, { status: 400 });
    }

    const prefs = await getOrCreateUserSettings(userId);
    const temperature = prefs.aiTemperature ?? 0.4;
    const thinkingEnabled = Boolean(prefs.aiThinking);

    const encoder = new TextEncoder();
    const abortSignal = request.signal;

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (event: AiStreamEvent) => {
                if (abortSignal.aborted) return;
                controller.enqueue(encoder.encode(sseEncode(event)));
            };

            try {
                const ai = new GoogleGenAI({ apiKey });
                const systemInstruction = buildSystemInstruction(body.projectContext);

                const baseConfig: Record<string, unknown> = {
                    systemInstruction,
                    temperature,
                    automaticFunctionCalling: { disable: true as const },
                };
                if (thinkingEnabled) {
                    baseConfig.thinkingConfig = { includeThoughts: true };
                }

                // MYLO-only first (reliable). Built-ins next. Bare last.
                const toolSets = [myloToolsOnly(), myloToolsWithBuiltins(), [] as any[]];

                type TurnResult = {
                    fullText: string;
                    finishReason?: string;
                    accumulatedParts: any[];
                    functionCalls: AiFunctionCall[];
                };

                const consumeStream = async (
                    gen: AsyncGenerator<any>,
                    emitDeltas: boolean,
                ): Promise<TurnResult> => {
                    let fullText = "";
                    let priorCumulative = "";
                    let finishReason: string | undefined;
                    const accumulatedParts: any[] = [];
                    const seenFc = new Map<string, AiFunctionCall>();

                    for await (const chunk of gen) {
                        if (abortSignal.aborted) break;

                        const candidate = chunk.candidates?.[0];
                        if (candidate?.finishReason) {
                            finishReason = String(candidate.finishReason);
                        }
                        const parts = (candidate?.content?.parts || []) as any[];
                        for (const part of parts) accumulatedParts.push(part);

                        // chunk.text may be a delta OR cumulative across chunks.
                        const rawText =
                            typeof chunk.text === "string" ? chunk.text : "";
                        let delta = "";
                        if (rawText) {
                            if (
                                priorCumulative &&
                                rawText.startsWith(priorCumulative)
                            ) {
                                delta = rawText.slice(priorCumulative.length);
                                priorCumulative = rawText;
                            } else if (!priorCumulative || !rawText.startsWith(priorCumulative)) {
                                delta = rawText;
                                priorCumulative += rawText;
                            }
                        } else {
                            for (const part of parts) {
                                if (part?.thought) continue;
                                if (typeof part?.text === "string" && part.text) {
                                    delta += part.text;
                                }
                            }
                            if (delta) priorCumulative += delta;
                        }

                        if (delta) {
                            fullText += delta;
                            if (emitDeltas) send({ type: "text_delta", text: delta });
                        }

                        for (const part of parts) {
                            if (part?.functionCall?.name) {
                                const fc: AiFunctionCall = {
                                    name: String(part.functionCall.name),
                                    args: (part.functionCall.args || {}) as Record<
                                        string,
                                        unknown
                                    >,
                                    id: part.functionCall.id
                                        ? String(part.functionCall.id)
                                        : undefined,
                                };
                                const key =
                                    fc.id || `${fc.name}:${JSON.stringify(fc.args)}`;
                                seenFc.set(key, fc);
                            }
                        }

                        const chunkCalls = chunk.functionCalls;
                        if (Array.isArray(chunkCalls)) {
                            for (const fc of chunkCalls) {
                                if (!fc?.name) continue;
                                const parsed: AiFunctionCall = {
                                    name: String(fc.name),
                                    args: (fc.args || {}) as Record<string, unknown>,
                                    id: fc.id ? String(fc.id) : undefined,
                                };
                                const key =
                                    parsed.id ||
                                    `${parsed.name}:${JSON.stringify(parsed.args)}`;
                                seenFc.set(key, parsed);
                            }
                        }
                    }

                    return {
                        fullText,
                        finishReason,
                        accumulatedParts,
                        functionCalls: [...seenFc.values()],
                    };
                };

                let lastError: unknown = null;
                let turn: TurnResult | null = null;

                for (let i = 0; i < toolSets.length; i++) {
                    if (abortSignal.aborted) break;
                    try {
                        const streamResult = await ai.models.generateContentStream({
                            model,
                            contents: contents as any,
                            config: { ...baseConfig, tools: toolSets[i] },
                        });
                        const result = await consumeStream(streamResult, true);
                        const { textParts, functionCalls: fromParts } = extractFromParts(
                            result.accumulatedParts,
                        );
                        const hasText =
                            Boolean(result.fullText.trim()) || Boolean(textParts.join("").trim());
                        const hasCalls =
                            result.functionCalls.length > 0 || fromParts.length > 0;

                        if (hasText || hasCalls || i === toolSets.length - 1) {
                            turn = result;
                            if (i > 0) {
                                console.warn(`[ai/chat] using tool set index=${i}`);
                            }
                            break;
                        }

                        console.warn(
                            `[ai/chat] tool set ${i} returned empty turn; retrying with next tool set`,
                        );
                    } catch (err) {
                        lastError = err;
                        const msg = err instanceof Error ? err.message : String(err);
                        if (isProviderAuthError(msg)) {
                            await handleGeminiAuthFailure(userId, source);
                            send({
                                type: "error",
                                error:
                                    source === "user"
                                        ? "Your Gemini API key was rejected. Open Settings to rotate it."
                                        : "Platform Gemini API key was rejected.",
                                code: "INVALID_KEY",
                            });
                            send({ type: "done" });
                            controller.close();
                            return;
                        }
                        const likelyToolConflict =
                            /tool|function|search|url.?context|code.?execution|not support/i.test(
                                msg,
                            );
                        if (!likelyToolConflict || i === toolSets.length - 1) {
                            throw err;
                        }
                        console.warn(
                            `[ai/chat] tool set ${i} failed (${msg.slice(0, 120)}); retrying`,
                        );
                    }
                }

                // Non-stream fallback if streaming produced nothing usable.
                if (
                    turn &&
                    !turn.fullText.trim() &&
                    turn.functionCalls.length === 0 &&
                    extractFromParts(turn.accumulatedParts).textParts.length === 0
                ) {
                    try {
                        const response = await ai.models.generateContent({
                            model,
                            contents: contents as any,
                            config: { ...baseConfig, tools: myloToolsOnly() },
                        });
                        const parts = (response.candidates?.[0]?.content?.parts ||
                            []) as any[];
                        const { textParts, functionCalls } = extractFromParts(parts);
                        const text =
                            (typeof response.text === "string" && response.text) ||
                            textParts.join("\n") ||
                            "";
                        if (text) send({ type: "text_delta", text });
                        turn = {
                            fullText: text,
                            finishReason: response.candidates?.[0]?.finishReason
                                ? String(response.candidates[0].finishReason)
                                : undefined,
                            accumulatedParts: parts.length
                                ? parts
                                : text
                                  ? [{ text }]
                                  : [],
                            functionCalls,
                        };
                    } catch (fallbackErr) {
                        if (!turn) throw fallbackErr;
                        console.warn("[ai/chat] non-stream fallback failed", fallbackErr);
                    }
                }

                if (!turn) {
                    throw lastError || new Error("Gemini stream failed");
                }

                if (abortSignal.aborted) {
                    send({ type: "error", error: "Aborted", code: "ABORTED" });
                    send({ type: "done" });
                    controller.close();
                    return;
                }

                const { textParts, functionCalls: fromParts } = extractFromParts(
                    turn.accumulatedParts,
                );
                const mergedCalls =
                    turn.functionCalls.length > 0 ? turn.functionCalls : fromParts;
                const text =
                    turn.fullText.trim() || textParts.join("\n").trim() || undefined;

                // Build a clean model turn from the final text + function calls.
                // Do NOT echo raw streamed part fragments — Gemini rejects / empties
                // the next turn when prior functionCall parts are incomplete.
                const modelParts: any[] = [];
                if (text) modelParts.push({ text });
                for (const fc of mergedCalls) {
                    modelParts.push({
                        functionCall: {
                            name: fc.name,
                            args: fc.args || {},
                            ...(fc.id ? { id: fc.id } : {}),
                        },
                    });
                }
                // Text-only fallback from non-thought parts when we somehow
                // missed both text getter and merged calls.
                if (!modelParts.length) {
                    for (const p of turn.accumulatedParts) {
                        if (p?.thought) continue;
                        if (typeof p?.text === "string" && p.text) {
                            modelParts.push({ text: p.text });
                        }
                    }
                }

                const modelContent: AiContent | undefined = modelParts.length
                    ? { role: "model", parts: modelParts }
                    : undefined;

                if (mergedCalls.length) {
                    send({ type: "function_calls", functionCalls: mergedCalls });
                }
                if (modelContent) {
                    send({ type: "model_content", modelContent });
                }
                send({
                    type: "finish",
                    finishReason: turn.finishReason,
                    text,
                });
                send({ type: "done" });
            } catch (e) {
                const message = e instanceof Error ? e.message : "Gemini request failed";
                if (isProviderAuthError(message)) {
                    await handleGeminiAuthFailure(userId, source);
                    send({
                        type: "error",
                        error:
                            source === "user"
                                ? "Your Gemini API key was rejected. Open Settings to rotate it."
                                : "Platform Gemini API key was rejected.",
                        code: "INVALID_KEY",
                    });
                } else {
                    const safe = message.replace(apiKey, "[redacted]");
                    send({ type: "error", error: safe.slice(0, 300) });
                }
                send({ type: "done" });
            } finally {
                try {
                    controller.close();
                } catch {
                    /* already closed */
                }
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-RateLimit-Remaining": String(rate.remaining),
            "X-AI-Key-Source": source,
        },
    });
}

export async function GET() {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    const userId = session?.user?.id as string | undefined;
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolved = await resolveGeminiApiKey(userId);
    if (!resolved.ok) {
        const status = resolved.code === "NO_KEY" || resolved.code === "INVALID_KEY" ? 503 : 500;
        return NextResponse.json({ error: resolved.error, code: resolved.code }, { status });
    }

    const { models, source } = await listGeminiModels(resolved.resolved.apiKey);
    return NextResponse.json({
        models,
        default: getDefaultModelId(),
        source,
    });
}
