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

    it("marks playable before ready when runner reports head-start", async () => {
        configureFanoutJobs({
            storePath,
            runner: async (job, hooks) => {
                const partial = {
                    delivery: "oci-hls",
                    playlistUrl: "https://example.test/index.m3u8",
                    prefix: `vrchat-fanout/${job.itemId}/${job.jobId}`,
                    maxSeconds: 0,
                    segmentCount: 4,
                    bakeMode: "dffmpeg",
                    jobId: job.jobId,
                };
                await hooks.markPlayable(partial);
                await new Promise((r) => setTimeout(r, 30));
                return { ...partial, segmentCount: 40 };
            },
        });
        await loadFanoutJobs();

        const job = createFanoutJob({ itemId: "abc", mediaSourceId: "src1" });
        startFanoutJob(job.jobId);

        const deadline = Date.now() + 5000;
        let sawPlayable = false;
        let cur;
        while (Date.now() < deadline) {
            cur = getFanoutJob(job.jobId);
            if (cur.status === "playable") sawPlayable = true;
            if (cur.status === "ready" || cur.status === "failed") break;
            await new Promise((r) => setTimeout(r, 10));
        }
        assert.equal(sawPlayable, true);
        assert.equal(cur.status, "ready");
        assert.equal(cur.result.segmentCount, 40);
    });
});

