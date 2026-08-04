import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { buildSystemInstruction } from "@/lib/ai/systemPrompt";
import { MYLO_FUNCTION_DECLARATIONS } from "@/lib/ai/tools";
import { checkAiRateLimit } from "@/lib/ai/rateLimit";
import { handleGeminiAuthFailure, resolveGeminiApiKey } from "@/lib/ai/resolveApiKey";
import type { AiChatRequest, AiChatResponse, AiContent, AiFunctionCall } from "@/lib/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getModelId() {
    return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

const DEFAULT_ALLOWED_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
];

function allowedModels(): Set<string> {
    const fromEnv = process.env.GEMINI_ALLOWED_MODELS?.split(",").map((s) => s.trim()).filter(Boolean);
    const set = new Set(fromEnv?.length ? fromEnv : DEFAULT_ALLOWED_MODELS);
    set.add(getModelId());
    return set;
}

function resolveModel(requested: string | undefined): string | null {
    const fallback = getModelId();
    const model = (requested?.trim() || fallback);
    if (!allowedModels().has(model)) return null;
    return model;
}

const MAX_CONTENTS = 40;
const MAX_CONTENT_CHARS = 200_000;

function isProviderAuthError(message: string): boolean {
    return /api.?key|permission|unauth|invalid|403|401|PERMISSION_DENIED/i.test(message);
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

    if (body.contents.length > MAX_CONTENTS) {
        return NextResponse.json({ error: "Too many content turns" }, { status: 400 });
    }

    const approxSize = JSON.stringify(body.contents).length
        + (body.projectContext ? JSON.stringify(body.projectContext).length : 0);
    if (approxSize > MAX_CONTENT_CHARS) {
        return NextResponse.json({ error: "Request payload too large" }, { status: 413 });
    }

    const model = resolveModel(body.model);
    if (!model) {
        return NextResponse.json({ error: "Model not allowed" }, { status: 400 });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = buildSystemInstruction(body.projectContext);

        const baseConfig = {
            systemInstruction,
            temperature: 0.4,
            automaticFunctionCalling: { disable: true as const },
        };

        const tools = [
            { functionDeclarations: MYLO_FUNCTION_DECLARATIONS },
        ];

        let response;
        try {
            response = await ai.models.generateContent({
                model,
                contents: body.contents as any,
                config: { ...baseConfig, tools: tools },
            });
        } catch (mixErr) {
            const mixMsg = mixErr instanceof Error ? mixErr.message : String(mixErr);
            if (isProviderAuthError(mixMsg)) {
                await handleGeminiAuthFailure(userId, source);
                return NextResponse.json(
                    {
                        error:
                            source === "user"
                                ? "Your Gemini API key was rejected. Open Settings to rotate it."
                                : "Platform Gemini API key was rejected.",
                        code: "INVALID_KEY",
                    },
                    { status: 502 },
                );
            }
            const likelyToolConflict =
                /tool|function|search|url.?context|code.?execution|not support/i.test(mixMsg);
            if (!likelyToolConflict) throw mixErr;

            response = await ai.models.generateContent({
                model,
                contents: body.contents as any,
                config: { ...baseConfig, tools: tools },
            });
        }

        const candidate = response.candidates?.[0];
        const finishReason = candidate?.finishReason;
        const parts = (candidate?.content?.parts || []) as any[];

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

        if (!functionCalls.length && Array.isArray((response as any).functionCalls)) {
            for (const fc of (response as any).functionCalls) {
                if (!fc?.name) continue;
                functionCalls.push({
                    name: String(fc.name),
                    args: (fc.args || {}) as Record<string, unknown>,
                    id: fc.id ? String(fc.id) : undefined,
                });
            }
        }

        const modelContent: AiContent | undefined = candidate?.content
            ? {
                  role: "model",
                  parts
              }
            : undefined;

        const payload: AiChatResponse = {
            text: textParts.join("\n").trim() || response.text || undefined,
            functionCalls: functionCalls.length ? functionCalls : undefined,
            modelContent,
            error: finishReason
        };

        if (!textParts.length && !functionCalls.length) {
            console.warn("Empty Gemini turn", { finishReason, source });
        }

        return NextResponse.json(payload, {
            headers: {
                "X-RateLimit-Remaining": String(rate.remaining),
                "X-AI-Key-Source": source,
            },
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : "Gemini request failed";
        if (isProviderAuthError(message)) {
            await handleGeminiAuthFailure(userId, source);
            return NextResponse.json(
                {
                    error:
                        source === "user"
                            ? "Your Gemini API key was rejected. Open Settings to rotate it."
                            : "Platform Gemini API key was rejected.",
                    code: "INVALID_KEY",
                },
                { status: 502 },
            );
        }
        // Never echo raw provider payloads that might include secrets
        const safe = message.replace(apiKey, "[redacted]");
        return NextResponse.json({ error: safe.slice(0, 300) }, { status: 502 });
    }
}

export async function GET() {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    const userId = session?.user?.id as string | undefined;
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Static allowlist — do not call the provider with user/platform keys just to list models.
    return NextResponse.json({
        models: [...allowedModels()].map((id) => ({ id })),
        default: getModelId(),
    });
}
