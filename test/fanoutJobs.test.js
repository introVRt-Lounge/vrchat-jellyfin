const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
    configureFanoutJobs,
    createFanoutJob,
    fanoutJobPublicView,
    getFanoutJob,
    loadFanoutJobs,
    startFanoutJob,
} = require("../dist/oci/fanoutJobs");

describe("async fan-out jobs", () => {
    let storePath;

    beforeEach(async () => {
        storePath = path.join(
            fs.mkdtempSync(path.join(os.tmpdir(), "fanout-jobs-")),
            "fanout-jobs.json",
        );
    });

    it("accepts a job and returns ready after background runner", async () => {
        configureFanoutJobs({
            storePath,
            runner: async (job) => ({
                delivery: "oci-hls",
                playlistUrl: "https://example.test/index.m3u8",
                prefix: `vrchat-fanout/${job.itemId}/${job.jobId}`,
                maxSeconds: 0,
                segmentCount: 3,
                bakeMode: "dffmpeg",
                jobId: job.jobId,
            }),
        });
        await loadFanoutJobs();

        const job = createFanoutJob({ itemId: "abc", mediaSourceId: "src1" });
        assert.equal(job.status, "queued");
        const view = fanoutJobPublicView(job);
        assert.equal(view.statusUrl, `/i/fanout/${job.jobId}`);

        startFanoutJob(job.jobId);

        const deadline = Date.now() + 5000;
        let cur;
        while (Date.now() < deadline) {
            cur = getFanoutJob(job.jobId);
            if (cur.status === "ready" || cur.status === "failed") break;
            await new Promise((r) => setTimeout(r, 20));
        }
        assert.equal(cur.status, "ready");
        assert.match(cur.result.playlistUrl, /example\.test/);
    });
});
