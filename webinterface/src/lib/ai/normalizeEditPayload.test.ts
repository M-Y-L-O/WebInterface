import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeEditPayload } from "./normalizeEditPayload";

describe("normalizeEditPayload", () => {
    it("maps id → nodeId for add_node", () => {
        const p = normalizeEditPayload("add_node", {
            id: "dropout1",
            type: "Dropout",
        });
        assert.equal(p.nodeId, "dropout1");
        assert.equal(p.id, undefined);
        assert.deepEqual(p.params, {});
    });

    it("maps from/to → source/target for edges", () => {
        const p = normalizeEditPayload("add_edge", {
            from: "relu",
            to: "out",
        });
        assert.equal(p.source, "relu");
        assert.equal(p.target, "out");
    });
});
