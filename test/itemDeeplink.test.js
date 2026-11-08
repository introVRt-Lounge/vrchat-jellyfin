const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { resolveItemDeeplink } = require("../dist/jellyfin/itemDeeplink");

describe("resolveItemDeeplink", () => {
    it("Movie and Episode open mint", () => {
        assert.deepEqual(
            resolveItemDeeplink({ itemId: "m1", name: "Tropic", type: "Movie" }),
            { action: "mint", itemId: "m1", itemName: "Tropic" },
        );
        assert.deepEqual(
            resolveItemDeeplink({ itemId: "e1", name: "Pilot", type: "Episode" }),
            { action: "mint", itemId: "e1", itemName: "Pilot" },
        );
        assert.deepEqual(
            resolveItemDeeplink({ itemId: "v1", name: "Clip", type: "Video" }),
            { action: "mint", itemId: "v1", itemName: "Clip" },
        );
    });

    it("Series and Season navigate to browse pages", () => {
        assert.deepEqual(
            resolveItemDeeplink({ itemId: "s1", name: "Andor", type: "Series" }),
            { action: "show", showId: "s1" },
        );
        assert.deepEqual(
            resolveItemDeeplink({ itemId: "sea1", name: "Season 1", type: "Season" }),
            { action: "season", seasonId: "sea1" },
        );
    });

    it("unknown types are unsupported", () => {
        assert.deepEqual(
            resolveItemDeeplink({ itemId: "f1", name: "Folder", type: "Folder" }),
            { action: "unsupported", type: "Folder" },
        );
    });
});
