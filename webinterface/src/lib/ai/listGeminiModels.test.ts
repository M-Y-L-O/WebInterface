import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isModelAllowed } from "./modelAllow";

describe("isModelAllowed", () => {
    it("accepts default when requested empty", () => {
        const id = isModelAllowed(undefined);
        assert.ok(id);
        assert.match(id!, /^[\w./-]+$/);
    });

    it("rejects invalid characters", () => {
        assert.equal(isModelAllowed("gemini 2.5"), null);
        assert.equal(isModelAllowed("bad;drop"), null);
    });

    it("accepts normal gemini ids", () => {
        assert.equal(isModelAllowed("gemini-2.5-flash"), "gemini-2.5-flash");
    });
});
