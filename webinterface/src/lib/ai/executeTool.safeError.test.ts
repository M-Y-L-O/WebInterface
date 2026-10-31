import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeError } from "./projectContext";

describe("safeError", () => {
    it("reads Error.message", () => {
        assert.equal(safeError(new Error("boom")), "boom");
    });

    it("stringifies unknowns", () => {
        assert.equal(safeError("nope"), "nope");
        assert.equal(safeError(42), "42");
    });
});
