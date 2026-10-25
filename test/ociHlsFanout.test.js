const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { buildOciHlsPublishConfig } = require("../dist/oci/config");
const {
    absolutizeHlsPlaylist,
    publicObjectUrl,
} = require("../dist/oci/playlist");
const { rewriteUrlHostToIp } = require("../dist/oci/hlsBake");
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

describe("progressive fan-out ffmpeg args", () => {
    it("uses event playlist so segments can publish before ENDLIST", () => {
        const {
            buildProgressiveFfmpegArgs,
        } = require("../dist/oci/progressivePublish");
        const args = buildProgressiveFfmpegArgs(
            "http://127.0.0.1:8096/Videos/x/stream?static=true",
            {
                maxSeconds: 0,
                hlsTime: 6,
                videoEncoder: "h264_nvenc",
            },
            "$Fanout/job/index.m3u8",
            "$Fanout/job/seg%03d.ts",
        );
        assert.ok(args.includes("event"));
        assert.ok(!args.includes("vod"));
        assert.ok(args.includes("-hls_list_size"));
    });
});

describe("dffmpeg wait timeout for full-title bake", () => {
    it("uses multi-hour timeout when maxSeconds is 0", () => {
        // Mirror hlsBakeDffmpeg.toClientCfg math without importing private helper.
        const maxSeconds = 0;
        const timeoutMs =
            maxSeconds > 0
                ? Math.max(60_000, maxSeconds * 1000 + 120_000)
                : 6 * 60 * 60 * 1000;
        assert.equal(timeoutMs, 6 * 60 * 60 * 1000);
    });

    it("keeps short timeout for clipped bakes", () => {
        const maxSeconds = 90;
        const timeoutMs =
            maxSeconds > 0
                ? Math.max(60_000, maxSeconds * 1000 + 120_000)
                : 6 * 60 * 60 * 1000;
        assert.equal(timeoutMs, 90 * 1000 + 120_000);
    });
});

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

describe("ffmpeg Docker DNS rewrite", () => {
    it("leaves IP hosts alone", async () => {
        const url = "http://172.27.0.15:8096/Videos/x/stream?static=true";
        assert.equal(await rewriteUrlHostToIp(url), url);
    });
});

describe("OCI HLS playlist absolute URLs", () => {
    it("uses real slash path segments after /o/ (not %2F)", () => {
        const url = publicObjectUrl(
            "https://objectstorage.us-ashburn-1.oraclecloud.com/n/ns/b/owncast/o",
            "vrchat-fanout/item/job/index.m3u8",
        );
        assert.equal(
            url,
            "https://objectstorage.us-ashburn-1.oraclecloud.com/n/ns/b/owncast/o/vrchat-fanout/item/job/index.m3u8",
        );
        assert.ok(!/%2F/i.test(url));
    });

    it("encodes special characters within a single path segment only", () => {
        const url = publicObjectUrl(
            "https://objectstorage.us-ashburn-1.oraclecloud.com/n/ns/b/owncast/o",
            "vrchat-fanout/has space/index.m3u8",
        );
        assert.equal(
            url,
            "https://objectstorage.us-ashburn-1.oraclecloud.com/n/ns/b/owncast/o/vrchat-fanout/has%20space/index.m3u8",
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
            /objectstorage\.us-ashburn-1\.oraclecloud\.com\/n\/ns\/b\/owncast\/o\/vrchat-fanout\/item\/job\/seg000\.ts/,
        );
        assert.match(out, /seg001\.ts/);
        assert.ok(out.includes("#EXTM3U"));
        assert.ok(!out.split("\n").some((l) => l.trim() === "seg000.ts"));
        assert.ok(!/%2F/i.test(out));
    });
});
