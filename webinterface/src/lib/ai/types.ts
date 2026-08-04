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
    error?: string;
};

export type ChatMessage = {
    id: string;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    toolName?: string;
    pending?: boolean;
};
