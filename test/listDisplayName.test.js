const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
    versionLabelFromPath,
    displayListName,
    mapItemToListItem,
} = require("../dist/jellyfin/listItems");

describe("versionLabelFromPath / displayListName", () => {
    it("pulls the dash-suffix from a multi-version filename", () => {
        assert.equal(
            versionLabelFromPath(
                "/data/movies/Tropic Thunder (2008)/Tropic Thunder (2008) - Commentary-First.mkv",
            ),
            "Commentary-First",
        );
        assert.equal(
            versionLabelFromPath(
                "/data/movies/Tropic Thunder (2008)/Tropic Thunder (2008) - Remux-1080p.mkv",
            ),
            "Remux-1080p",
        );
    });

    it("returns null when path has no version suffix", () => {
        assert.equal(versionLabelFromPath("/data/movies/Andor.mkv"), null);
        assert.equal(versionLabelFromPath(null), null);
    });

    it("appends version to display name when not already present", () => {
        assert.equal(
            displayListName({
                Name: "Tropic Thunder",
                Path: "/x/Tropic Thunder (2008) - Commentary-First.mkv",
            }),
            "Tropic Thunder (Commentary-First)",
        );
    });

    it("mapItemToListItem browse uses Path for disambiguated name", () => {
        const row = mapItemToListItem(
            {
                Id: "m1",
                Name: "Tropic Thunder",
                Type: "Movie",
                Path: "/data/Tropic Thunder (2008) - Remux-1080p.mkv",
                ImageTags: { Primary: "t" },
            },
            (id) => `/img/${id}`,
        );
        assert.equal(row.name, "Tropic Thunder (Remux-1080p)");
    });
});
