const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
    mapSearchHintToListItem,
    mapItemToListItem,
} = require("../dist/jellyfin/listItems");

function fakeImageUrl(itemId, imageType, tags) {
    const tag = tags?.[imageType] || "";
    return `/img/${itemId}?type=${imageType}&tag=${tag}`;
}

describe("library list mappers (no MediaStreams on search/browse)", () => {
    it("mapSearchHintToListItem maps DB search hints without subtitle hydration", () => {
        const row = mapSearchHintToListItem(
            {
                ItemId: "movie-1",
                Name: "The Matrix",
                Type: "Movie",
                PrimaryImageTag: "abc",
            },
            fakeImageUrl,
        );
        assert.equal(row.itemId, "movie-1");
        assert.equal(row.name, "The Matrix");
        assert.equal(row.type, "Movie");
        assert.equal(row.hasSubtitles, false);
        assert.deepEqual(row.subtitles, []);
        assert.match(row.thumbnailUrl, /\/img\/movie-1/);
        assert.match(row.thumbnailUrl, /tag=abc/);
    });

    it("mapSearchHintToListItem skips hints without ItemId", () => {
        assert.equal(mapSearchHintToListItem({ Name: "x" }, fakeImageUrl), null);
    });

    it("mapItemToListItem browse path omits MediaStreams by default", () => {
        const row = mapItemToListItem(
            {
                Id: "ep-1",
                Name: "Pilot",
                Type: "Episode",
                ImageTags: { Primary: "t1" },
                MediaStreams: [
                    { Type: "Video", Index: 0 },
                    { Type: "Subtitle", Index: 2, Language: "eng" },
                ],
            },
            fakeImageUrl,
        );
        assert.equal(row.hasSubtitles, false);
        assert.deepEqual(row.subtitles, []);
    });

    it("mapItemToListItem detail path includes subtitle streams when asked", () => {
        const row = mapItemToListItem(
            {
                Id: "ep-1",
                Name: "Pilot",
                Type: "Episode",
                MediaStreams: [
                    { Type: "Subtitle", Index: 2, Language: "eng" },
                    { Type: "Subtitle", Index: 3, Language: null },
                ],
            },
            fakeImageUrl,
            { includeSubtitles: true },
        );
        assert.equal(row.hasSubtitles, true);
        assert.deepEqual(row.subtitles, [
            { index: 2, language: "eng" },
            { index: 3, language: "Unknown" },
        ]);
    });
});
