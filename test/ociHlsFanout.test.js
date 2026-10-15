const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { buildOciHlsPublishConfig } = require("../dist/oci/config");
const {
    absolutizeHlsPlaylist,
    publicObjectUrl,
} = require("../dist/oci/playlist");
const { buildUiConfig } = require("../dist/webserver/uiConfig");

const baseCreds = {
    OCI_S3_ACCESS_KEY: "ak-test",
    OCI_S3_SECRET_KEY: "sk-test",
    OCI_S3_NAMESPACE: "idzn4iwfwrfa",
    OCI_S3_REGION: "us-ashburn-1",
    OCI_S3_BUCKET: "owncast",
    OCI_PUBLIC_BASE:
        "https://objectstorage.us-ashburn-1.oraclecloud.com/n/idzn4iwfwrfa/b/owncast/o",
};

describe("OCI HLS fan-out config gate", () => {
    it("disabled by default even with credentials", () => {
        const cfg = buildOciHlsPublishConfig(baseCreds);
        assert.equal(cfg.enabled, false);
        assert.equal(buildUiConfig(baseCreds).ociHlsFanoutEnabled, false);
    });

    it("disabled when flag on but credentials incomplete", () => {
        const cfg = buildOciHlsPublishConfig({ OCI_HLS_PUBLISH: "1" });
        assert.equal(cfg.enabled, false);
    });

    it("enabled when flag + full credentials", () => {
        const env = { ...baseCreds, OCI_HLS_PUBLISH: "true", OCI_HLS_MAX_SECONDS: "90" };
        const cfg = buildOciHlsPublishConfig(env);
        assert.equal(cfg.enabled, true);
        assert.equal(cfg.maxSeconds, 90);
        assert.match(cfg.endpoint, /compat\.objectstorage/);
        assert.equal(buildUiConfig(env).ociHlsFanoutEnabled, true);
        assert.equal(buildUiConfig(env).ociHlsMaxSeconds, 90);
    });
});

describe("OCI HLS playlist absolute URLs", () => {
    it("encodes object key as a single /o/ path segment", () => {
        const url = publicObjectUrl(
            "https://objectstorage.us-ashburn-1.oraclecloud.com/n/ns/b/owncast/o",
            "vrchat-fanout/item/job/index.m3u8",
        );
        assert.equal(
            url,
            "https://objectstorage.us-ashburn-1.oraclecloud.com/n/ns/b/owncast/o/vrchat-fanout%2Fitem%2Fjob%2Findex.m3u8",
        );
    });

    it("rewrites relative segment lines to absolute Object Storage URLs", () => {
        const raw = [
            "#EXTM3U",
            "#EXT-X-TARGETDURATION:6",
            "#EXTINF:6.000,",
            "seg000.ts",
            "#EXTINF:6.000,",
            "./seg001.ts",
            "#EXT-X-ENDLIST",
            "",
        ].join("\n");
        const out = absolutizeHlsPlaylist(
            raw,
            "https://objectstorage.us-ashburn-1.oraclecloud.com/n/ns/b/owncast/o",
            "vrchat-fanout/item/job",
        );
        assert.match(
            out,
            /objectstorage\.us-ashburn-1\.oraclecloud\.com\/n\/ns\/b\/owncast\/o\/vrchat-fanout%2Fitem%2Fjob%2Fseg000\.ts/,
        );
        assert.match(out, /seg001\.ts/);
        assert.ok(out.includes("#EXTM3U"));
        assert.ok(!out.split("\n").some((l) => l.trim() === "seg000.ts"));
    });
});
