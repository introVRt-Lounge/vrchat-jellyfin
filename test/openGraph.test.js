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
const publicDir = path.join(__dirname, "../client/public");
const ogPng = path.join(publicDir, "og.png");

describe("Open Graph announce assets", () => {
    it("ships a 1200-wide og.png", () => {
        assert.ok(fs.existsSync(ogPng));
        assert.ok(fs.statSync(ogPng).size > 10_000);
    });

    it("ships favicon + app icons for the lounge bridge mark", () => {
        for (const name of ["favicon.ico", "icon-192.png", "icon-512.png", "favicon-32.png"]) {
            const p = path.join(publicDir, name);
            assert.ok(fs.existsSync(p), `missing ${name}`);
            assert.ok(fs.statSync(p).size > 500, `${name} too small`);
        }
    });

    it("HTML heads link the favicon set", () => {
        for (const html of [indexHtml, shareHtml]) {
            assert.ok(html.includes('href="/favicon.ico"'));
            assert.ok(html.includes('href="/icon-192.png"'));
            assert.ok(html.includes('content="#00e5ff"'));
        }
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
