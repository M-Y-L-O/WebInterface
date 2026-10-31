import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compactContents } from "./compactHistory";
import type { AiContent } from "./types";

function turn(role: "user" | "model", text: string): AiContent {
    return { role, parts: [{ text }] };
}

describe("compactContents", () => {
    it("returns unchanged when under limits", () => {
        const contents = [turn("user", "hi"), turn("model", "hello")];
        const result = compactContents(contents, { maxContents: 10, maxChars: 10_000 });
        assert.equal(result.compacted, false);
        assert.equal(result.contents.length, 2);
    });

    it("compacts when over maxContents", () => {
        const contents: AiContent[] = [];
        for (let i = 0; i < 30; i++) {
            contents.push(turn("user", `u${i}`), turn("model", `m${i}`));
        }
        const result = compactContents(contents, {
            maxContents: 20,
            maxChars: 100_000,
            keepRecent: 8,
        });
        assert.equal(result.compacted, true);
        assert.ok(result.contents.length < contents.length);
        assert.ok(
            result.contents.some(
                (c) =>
                    c.role === "user" &&
                    c.parts.some(
                        (p) => "text" in p && String(p.text).includes("compacted"),
                    ),
            ),
        );
    });
});
