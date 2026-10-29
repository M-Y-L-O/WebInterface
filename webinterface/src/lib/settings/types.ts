export type ThemePreference = "dark" | "light" | "system";

export type UserPrefs = {
    theme: ThemePreference;
    language: string;
    defaultModel: string;
    optEpochs: number;
    optGenerations: number;
    localAgentAddress: string;
    localAgentName: string;
};

export const DEFAULT_USER_PREFS: UserPrefs = {
    theme: "dark",
    language: "en",
    defaultModel: "gemini-2.5-flash",
    optEpochs: 10,
    optGenerations: 5,
    localAgentAddress: "http://127.0.0.1:8080",
    localAgentName: "Local MYLO Client",
};

export const THEME_OPTIONS: ThemePreference[] = ["dark", "light", "system"];
export const LANGUAGE_OPTIONS = ["en"] ;
