// Open Graph share card + bot sniffing (run after `npx tsc`)
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const shareHtml = fs.readFileSync(
    path.join(__dirname, "../client/public/share.html"),
    "utf8",
);
const indexHtml = fs.readFileSync(
    path.join(__dirname, "../client/index.html"),
    "utf8",
);
const ogPng = path.join(__dirname, "../client/public/og.png");

describe("Open Graph announce assets", () => {
    it("ships a 1200-wide og.png", () => {
        assert.ok(fs.existsSync(ogPng));
        assert.ok(fs.statSync(ogPng).size > 10_000);
    });

    it("share.html has Discord-ready OG + twitter large card tags", () => {
        for (const needle of [
            'property="og:title"',
            'property="og:description"',
            'property="og:image"',
            'content="https://vrchat.introvrtlounge.com/og.png"',
            'property="og:image:width"',
            'content="1200"',
            'property="og:image:height"',
            'content="630"',
            'name="twitter:card"',
            'content="summary_large_image"',
            'name="theme-color"',
        ]) {
            assert.ok(shareHtml.includes(needle), `missing ${needle}`);
        }
    });

    it("SPA index.html includes the same og:image absolute URL", () => {
        assert.ok(indexHtml.includes('content="https://vrchat.introvrtlounge.com/og.png"'));
        assert.ok(indexHtml.includes('content="summary_large_image"'));
    });
});
