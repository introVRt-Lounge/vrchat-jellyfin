const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { isSpaClientPath } = require("../dist/webserver/spaFallback");

describe("SPA client path matcher", () => {
    it("allows React Router deep links", () => {
        assert.equal(isSpaClientPath("/library/f137a2dd21bbc1b99aa5c0f6bf02a805"), true);
        assert.equal(isSpaClientPath("/tvshow/abc"), true);
        assert.equal(isSpaClientPath("/season/xyz"), true);
        assert.equal(isSpaClientPath("/library/abc/"), true);
    });

    it("rejects API and asset paths", () => {
        assert.equal(isSpaClientPath("/"), false);
        assert.equal(isSpaClientPath("/libraries"), false);
        assert.equal(isSpaClientPath("/libraries/f137/items"), false);
        assert.equal(isSpaClientPath("/tvshows/abc/seasons"), false);
        assert.equal(isSpaClientPath("/seasons/xyz/episodes"), false);
        assert.equal(isSpaClientPath("/v/capid"), false);
        assert.equal(isSpaClientPath("/img/item"), false);
        assert.equal(isSpaClientPath("/api/movie-requests/status"), false);
        assert.equal(isSpaClientPath("/config"), false);
        assert.equal(isSpaClientPath("/healthz"), false);
        assert.equal(isSpaClientPath("/assets/index.js"), false);
    });
});
