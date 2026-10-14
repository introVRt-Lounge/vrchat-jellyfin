const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { buildMovieRequestFeatureConfig } = require("../dist/request/featureConfig");
const { buildUiConfig } = require("../dist/webserver/uiConfig");
const { MovieRequestStore } = require("../dist/request/requestStore");

describe("movie request feature gate", () => {
    it("disabled without radarr + webhook", () => {
        const cfg = buildMovieRequestFeatureConfig({});
        assert.equal(cfg.enabled, false);
        assert.equal(buildUiConfig({}).movieRequestsEnabled, false);
    });

    it("enabled when radarr and webhook present", () => {
        const env = {
            RADARR_URL: "http://radarr:7878/radarr",
            RADARR_API_KEY: "x".repeat(32),
            DISCORD_REQUEST_READY_WEBHOOK_URL:
                "https://discord.com/api/webhooks/1/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUV",
        };
        assert.equal(buildMovieRequestFeatureConfig(env).enabled, true);
        assert.equal(buildUiConfig(env).movieRequestsEnabled, true);
    });
});

describe("movie request store", () => {
    it("persists queued then notified lifecycle", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vj-mr-"));
        const file = path.join(dir, "movie-requests.json");
        const store = new MovieRequestStore(file);
        const row = store.add({
            tmdbId: 42,
            title: "Test Film",
            year: 1999,
            discordUserId: "123456789012345678",
            radarrId: 7,
        });
        assert.equal(row.status, "queued");
        assert.equal(store.findOpen(42, "123456789012345678")?.id, row.id);
        store.markAvailable(row.id);
        store.markNotified(row.id);
        assert.equal(store.listPending().length, 0);
        const disk = JSON.parse(fs.readFileSync(file, "utf8"));
        assert.equal(disk.requests[0].status, "notified");
    });
});
