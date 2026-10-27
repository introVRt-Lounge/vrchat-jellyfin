const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { filterCatalogByQuery } = require("../dist/jellyfin/catalogSearch");

describe("filterCatalogByQuery", () => {
    const catalog = [
        { itemId: "1", name: "Adventure Time", type: "Series" },
        { itemId: "2", name: "The Adventure Zone", type: "Series" },
        { itemId: "3", name: "Andor", type: "Series" },
        { itemId: "4", name: null, type: "Series" },
        { itemId: "5", name: "Black Mirror", type: "Series" },
    ];

    it("empty / whitespace query returns all items (browse mode)", () => {
        assert.equal(filterCatalogByQuery(catalog, "").length, 5);
        assert.equal(filterCatalogByQuery(catalog, "   ").length, 5);
    });

    it("matches case-insensitively on substring", () => {
        const rows = filterCatalogByQuery(catalog, "adventure");
        assert.deepEqual(
            rows.map((r) => r.itemId),
            ["1", "2"],
        );
    });

    it("skips null names when querying", () => {
        assert.equal(filterCatalogByQuery(catalog, "andor").length, 1);
        assert.equal(filterCatalogByQuery(catalog, "andor")[0].itemId, "3");
    });

    it("respects limit", () => {
        const rows = filterCatalogByQuery(catalog, "", 2);
        assert.equal(rows.length, 2);
    });
});
