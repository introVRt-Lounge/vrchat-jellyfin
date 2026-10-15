const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { buildOciHlsPublishConfig } = require("../dist/oci/config");
const {
    signDffmpegRequest,
    rewriteSourceUrlForWorkers,
} = require("../dist/oci/dffmpegClient");

const baseCreds = {
    OCI_S3_ACCESS_KEY: "ak-test",
    OCI_S3_SECRET_KEY: "sk-test",
    OCI_S3_NAMESPACE: "ns",
    OCI_S3_REGION: "us-ashburn-1",
    OCI_S3_BUCKET: "owncast",
    OCI_PUBLIC_BASE:
        "https://objectstorage.us-ashburn-1.oraclecloud.com/n/ns/b/owncast/o",
    OCI_HLS_PUBLISH: "1",
};

describe("OCI HLS bake mode config", () => {
    it("defaults to local bake", () => {
        const cfg = buildOciHlsPublishConfig(baseCreds);
        assert.equal(cfg.bakeMode, "local");
        assert.equal(cfg.dffmpeg.enabled, false);
    });

    it("enables dffmpeg when mode + coordinator + hmac present", () => {
        const cfg = buildOciHlsPublishConfig({
            ...baseCreds,
            OCI_HLS_BAKE_MODE: "dffmpeg",
            DFFMPEG_COORDINATOR_URL: "http://100.127.140.34:18000",
            DFFMPEG_CLIENT_ID: "estate-client",
            DFFMPEG_HMAC_KEY: Buffer.from("x".repeat(32)).toString("base64"),
            DFFMPEG_FANOUT_PATH_VAR: "Fanout",
            DFFMPEG_FANOUT_LOCAL_DIR: "/var/lib/dffmpeg/work",
            OCI_HLS_SOURCE_BASE: "http://127.0.0.1:8096",
            OCI_HLS_VIDEO_ENCODER: "h264_nvenc",
        });
        assert.equal(cfg.bakeMode, "dffmpeg");
        assert.equal(cfg.dffmpeg.enabled, true);
        assert.equal(cfg.dffmpeg.coordinatorUrl, "http://100.127.140.34:18000");
        assert.equal(cfg.dffmpeg.pathVar, "Fanout");
        assert.equal(cfg.dffmpeg.localDir, "/var/lib/dffmpeg/work");
        assert.equal(cfg.sourceBase, "http://127.0.0.1:8096");
        assert.equal(cfg.videoEncoder, "h264_nvenc");
    });

    it("falls back to local when dffmpeg mode lacks credentials", () => {
        const cfg = buildOciHlsPublishConfig({
            ...baseCreds,
            OCI_HLS_BAKE_MODE: "dffmpeg",
        });
        assert.equal(cfg.bakeMode, "local");
        assert.equal(cfg.dffmpeg.enabled, false);
    });
});

describe("dffmpeg HMAC signing", () => {
    it("matches brwyatt/dffmpeg canonical form", () => {
        const key = Buffer.from("k".repeat(32)).toString("base64");
        const body = '{"binary_name":"ffmpeg"}';
        const ts = "1700000000";
        const { headers } = signDffmpegRequest({
            clientId: "estate-client",
            hmacKeyB64: key,
            method: "POST",
            path: "/jobs/submit",
            body,
            timestamp: ts,
        });
        assert.equal(headers["x-dffmpeg-client-id"], "estate-client");
        assert.equal(headers["x-dffmpeg-timestamp"], ts);
        const payloadHash = crypto.createHash("sha256").update(body).digest("hex");
        const canonical = `POST|/jobs/submit|${ts}|${payloadHash}`;
        const expected = crypto
            .createHmac("sha256", Buffer.from(key, "base64"))
            .update(canonical)
            .digest("base64");
        assert.equal(headers["x-dffmpeg-signature"], expected);
    });
});

describe("worker-reachable source URL rewrite", () => {
    it("rewrites jellyfin hostname to OCI_HLS_SOURCE_BASE origin", () => {
        const inUrl =
            "http://jellyfin:8096/Videos/abc/stream?static=true&api_key=sekrit";
        const out = rewriteSourceUrlForWorkers(inUrl, "http://127.0.0.1:8096");
        assert.equal(
            out,
            "http://127.0.0.1:8096/Videos/abc/stream?static=true&api_key=sekrit",
        );
    });

    it("leaves URL alone when source base unset", () => {
        const inUrl = "http://jellyfin:8096/Videos/abc/stream?static=true";
        assert.equal(rewriteSourceUrlForWorkers(inUrl, ""), inUrl);
    });
});
