const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
    resolveLibraryItemAction,
    filterSeasonItems,
} = require("../dist/jellyfin/browseNav");

describe("resolveLibraryItemAction (TV browse clicks)", () => {
    it("Series opens the show (season) page", () => {
        assert.deepEqual(
            resolveLibraryItemAction({ itemId: "s1", type: "Series" }),
            { action: "show", showId: "s1" },
        );
    });

    it("Season opens the season (episode) page", () => {
        assert.deepEqual(
            resolveLibraryItemAction({ itemId: "sea1", type: "Season" }),
            { action: "season", seasonId: "sea1" },
        );
    });

    it("Episode opens mint — never /tvshow (parentId=episode returns root libraries)", () => {
        assert.deepEqual(
            resolveLibraryItemAction({ itemId: "ep1", type: "Episode" }),
            { action: "mint", itemId: "ep1" },
        );
    });

    it("Movie opens mint", () => {
        assert.deepEqual(
            resolveLibraryItemAction({ itemId: "m1", type: "Movie" }),
            { action: "mint", itemId: "m1" },
        );
    });

    it("does not treat TvShows library context as blanket Series navigation", () => {
        // libraryType must not matter — only item.type
        assert.deepEqual(
            resolveLibraryItemAction({ itemId: "ep2", type: "Episode" }),
            { action: "mint", itemId: "ep2" },
        );
    });
});

describe("filterSeasonItems", () => {
    it("keeps only Season rows so Episode parentId junk (CollectionFolder) is dropped", () => {
        const rows = filterSeasonItems([
            { Id: "lib-movies", Name: "Movies", Type: "CollectionFolder" },
            { Id: "sea-1", Name: "Season 1", Type: "Season", IndexNumber: 1 },
            { Id: "lib-shows", Name: "Shows", Type: "UserView" },
        ]);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].Id, "sea-1");
    });

    it("returns empty when nothing is a Season", () => {
        assert.deepEqual(
            filterSeasonItems([{ Id: "x", Name: "Movies", Type: "CollectionFolder" }]),
            [],
        );
    });
});
