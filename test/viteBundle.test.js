const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Mint modal lives in a HeroUI/framer chunk. A separate index2.js lazy load
 * breaks behind Cloudflare Access (crossorigin omits cookies → HTTP2 errors).
 * Vite must emit a single JS bundle.
 */
describe("client production bundle shape", () => {
    const clientDir = path.join(__dirname, "../dist/client");

    it("ships index.js + index.css and no lazy index2.js chunk", () => {
        assert.ok(fs.existsSync(path.join(clientDir, "index.js")), "missing index.js");
        assert.ok(fs.existsSync(path.join(clientDir, "index.css")), "missing index.css");
        assert.equal(
            fs.existsSync(path.join(clientDir, "index2.js")),
            false,
            "index2.js must not exist (inlineDynamicImports)",
        );
        const html = fs.readFileSync(path.join(clientDir, "index.html"), "utf8");
        assert.match(html, /src="\/assets\/index\.js"/);
        assert.match(html, /href="\/assets\/index\.css"/);
        assert.doesNotMatch(html, /index2\.js/);
        assert.doesNotMatch(html, /crossorigin/);
    });
});
