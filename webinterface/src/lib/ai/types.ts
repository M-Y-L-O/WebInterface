/** Gemini-compatible content parts used by the chat API. */
export type AiPart =
    | { text: string }
    | { functionCall: { name: string; args?: Record<string, unknown>; id?: string } }
    | {
          functionResponse: {
              name: string;
              response: Record<string, unknown>;
              id?: string;
          };
      };

export type AiContent = {
    role: "user" | "model";
    parts: AiPart[];
};

export type AiChatRequest = {
    contents: AiContent[];
    projectContext?: string;
    model?: string;
};

export type AiFunctionCall = {
    name: string;
    args: Record<string, unknown>;
    id?: string;
};

export type AiChatResponse = {
    text?: string;
    functionCalls?: AiFunctionCall[];
    modelContent?: AiContent;
    finishReason?: string;
};

/** Server-sent events from POST /api/ai/chat */
export type AiStreamEvent =
    | { type: "text_delta"; text: string }
    | { type: "function_calls"; functionCalls: AiFunctionCall[] }
    | { type: "model_content"; modelContent: AiContent }
    | { type: "finish"; finishReason?: string; text?: string }
    | { type: "error"; error: string; code?: string }
    | { type: "done" };

export type ChatMessage = {
    id: string;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    toolName?: string;
    pending?: boolean;
    /** Limit hit / cancelled markers for UI actions */
    kind?: "limit" | "cancelled";
};
