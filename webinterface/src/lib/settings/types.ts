export type ThemePreference = "dark" | "light" | "system";

export type UserPrefs = {
    theme: ThemePreference;
    language: string;
    defaultModel: string;
    /** Max model↔tool rounds per user message in the AI assistant. */
    aiMaxTurns: number;
    /** Max individual tool executions per user message in the AI assistant. */
    aiMaxToolCalls: number;
    /** Sampling temperature for Gemini (0–2). */
    aiTemperature: number;
    /** Request model thinking/thoughts when supported. */
    aiThinking: boolean;
    optEpochs: number;
    optGenerations: number;
    localAgentAddress: string;
    localAgentName: string;
};

export const DEFAULT_USER_PREFS: UserPrefs = {
    theme: "dark",
    language: "en",
    defaultModel: "gemini-2.5-flash",
    aiMaxTurns: 12,
    aiMaxToolCalls: 32,
    aiTemperature: 0.4,
    aiThinking: false,
    optEpochs: 10,
    optGenerations: 5,
    localAgentAddress: "http://127.0.0.1:8080",
    localAgentName: "Local MYLO Client",
};

/** Clamp for AI assistant turn / tool-call prefs. */
export const AI_AGENT_LIMIT_BOUNDS = { min: 1, max: 100 } as const;
export const AI_TEMPERATURE_BOUNDS = { min: 0, max: 2 } as const;

export const THEME_OPTIONS: ThemePreference[] = ["dark", "light", "system"];
export const LANGUAGE_OPTIONS = ["en"] ;
