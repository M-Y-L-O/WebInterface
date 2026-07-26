import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { buildSystemInstruction } from "@/lib/ai/systemPrompt";
import { MYLO_FUNCTION_DECLARATIONS } from "@/lib/ai/tools";
import type { AiChatRequest, AiChatResponse, AiContent, AiFunctionCall } from "@/lib/ai/types";

function getModelId() {
    return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    const userId = session?.user?.id as string | undefined;
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        return NextResponse.json(
            {
                error:
                    "GEMINI_API_KEY is not configured. Add it to .env.local from Google AI Studio.",
            },
            { status: 503 },
        );
    }

    let body: AiChatRequest;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!Array.isArray(body.contents) || body.contents.length === 0) {
        return NextResponse.json({ error: "contents required" }, { status: 400 });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const model = getModelId();
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
            console.warn("Empty Gemini turn", { finishReason, candidate });
        }

        return NextResponse.json(payload);
    } catch (e) {
        const message = e instanceof Error ? e.message : "Gemini request failed";
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
