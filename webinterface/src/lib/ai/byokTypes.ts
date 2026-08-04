export type LlmProvider = "gemini";

/** Safe metadata returned to the client — never includes ciphertext. */
export type LlmKeyMeta = {
    id: string;
    provider: LlmProvider;
    keyFingerprint: string;
    status: "active" | "invalid";
    verifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

export type ByokStatus = {
    keys: LlmKeyMeta[];
    hasPlatformFallback: boolean;
};
