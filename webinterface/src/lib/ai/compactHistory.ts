import type { AiContent } from "@/lib/ai/types";

export const DEFAULT_MAX_CONTENTS = 36;
export const DEFAULT_MAX_CHARS = 180_000;
export const KEEP_RECENT_TURNS = 12;

function contentsCharSize(contents: AiContent[]): number {
    try {
        return JSON.stringify(contents).length;
    } catch {
        return Number.MAX_SAFE_INTEGER;
    }
}

function partPreview(part: AiContent["parts"][number]): string {
    if ("text" in part && typeof part.text === "string") {
        return part.text.slice(0, 200);
    }
    if ("functionCall" in part && part.functionCall) {
        return `[call ${part.functionCall.name}]`;
    }
    if ("functionResponse" in part && part.functionResponse) {
        return `[result ${part.functionResponse.name}]`;
    }
    return "[part]";
}

function summarizeDropped(dropped: AiContent[]): string {
    const lines = dropped.slice(0, 24).map((c, i) => {
        const preview = c.parts.map(partPreview).join(" ").slice(0, 160);
        return `${i + 1}. ${c.role}: ${preview}`;
    });
    const extra = dropped.length > 24 ? `\n…and ${dropped.length - 24} more turns` : "";
    return (
        "Earlier conversation was compacted to stay within context limits.\n" +
        lines.join("\n") +
        extra
    );
}

/**
 * Deterministic history compaction: keep the most recent turns and replace
 * older ones with a single synthetic user note summarizing what was dropped.
 */
export function compactContents(
    contents: AiContent[],
    opts?: { maxContents?: number; maxChars?: number; keepRecent?: number },
): { contents: AiContent[]; compacted: boolean } {
    const maxContents = opts?.maxContents ?? DEFAULT_MAX_CONTENTS;
    const maxChars = opts?.maxChars ?? DEFAULT_MAX_CHARS;
    const keepRecent = opts?.keepRecent ?? KEEP_RECENT_TURNS;

    if (contents.length <= maxContents && contentsCharSize(contents) <= maxChars) {
        return { contents, compacted: false };
    }

    let working = [...contents];
    while (
        working.length > keepRecent &&
        (working.length > maxContents || contentsCharSize(working) > maxChars)
    ) {
        const dropCount = Math.max(1, working.length - keepRecent);
        const dropped = working.slice(0, dropCount);
        const recent = working.slice(dropCount);
        working = [
            {
                role: "user",
                parts: [{ text: summarizeDropped(dropped) }],
            },
            {
                role: "model",
                parts: [
                    {
                        text: "Understood — I will continue from the compacted earlier context.",
                    },
                ],
            },
            ...recent,
        ];
        // If still too large, shrink keepRecent window next iteration via dropCount growth
        if (working.length <= keepRecent + 2 && contentsCharSize(working) > maxChars) {
            // Hard truncate oldest recent turns
            const overflow = working.slice(0, Math.max(0, working.length - keepRecent));
            const kept = working.slice(Math.max(0, working.length - keepRecent));
            working = [
                {
                    role: "user",
                    parts: [{ text: summarizeDropped(overflow) }],
                },
                ...kept,
            ];
            break;
        }
    }

    return { contents: working, compacted: true };
}
