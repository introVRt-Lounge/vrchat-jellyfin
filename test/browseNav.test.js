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
});

describe("filterSeasonItems", () => {
    it("keeps only Season rows so CollectionFolder junk is dropped", () => {
        const rows = filterSeasonItems([
            { Id: "lib-movies", Name: "Movies", Type: "CollectionFolder" },
            { Id: "sea-1", Name: "Season 1", Type: "Season", IndexNumber: 1, ParentId: "show-1" },
            { Id: "lib-shows", Name: "Shows", Type: "UserView" },
        ]);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].Id, "sea-1");
    });

    it("when showId is set, drops seasons that belong to other series", () => {
        const rows = filterSeasonItems(
            [
                { Id: "sea-a", Name: "Season 1", Type: "Season", ParentId: "show-a", SeriesId: "show-a" },
                { Id: "sea-b", Name: "Season 1", Type: "Season", ParentId: "show-b", SeriesId: "show-b" },
                { Id: "sea-c", Name: "Season 2", Type: "Season", ParentId: "show-a", SeriesId: "show-a" },
            ],
            "show-a",
        );
        assert.deepEqual(
            rows.map((r) => r.Id),
            ["sea-a", "sea-c"],
        );
    });

    it("returns empty when nothing is a Season for this show", () => {
        assert.deepEqual(
            filterSeasonItems(
                [{ Id: "x", Name: "Movies", Type: "CollectionFolder" }],
                "show-a",
            ),
            [],
        );
    });
});
