import { randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { FanoutPublishResult } from "./publish";

export type FanoutJobStatus =
    | "queued"
    | "baking"
    | "publishing"
    | "ready"
    | "failed";

export interface FanoutJobRecord {
    jobId: string;
    itemId: string;
    mediaSourceId?: string;
    status: FanoutJobStatus;
    createdAt: string;
    updatedAt: string;
    error?: string;
    result?: FanoutPublishResult;
}

type FanoutRunner = (job: FanoutJobRecord) => Promise<FanoutPublishResult>;

const jobs = new Map<string, FanoutJobRecord>();
let storePath: string | null = null;
let runner: FanoutRunner | null = null;

function stamp(): string {
    const d = new Date();
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    return (
        `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
    );
}

function newJobId(): string {
    return `${stamp()}-${randomBytes(4).toString("hex")}`;
}

async function persist(): Promise<void> {
    if (!storePath) return;
    const payload = JSON.stringify([...jobs.values()], null, 0);
    await mkdir(path.dirname(storePath), { recursive: true });
    await writeFile(storePath, payload, "utf8");
}

export function configureFanoutJobs(opts: {
    storePath?: string;
    runner: FanoutRunner;
}): void {
    storePath = opts.storePath || null;
    runner = opts.runner;
}

export async function loadFanoutJobs(): Promise<void> {
    if (!storePath) return;
    try {
        const raw = await readFile(storePath, "utf8");
        const rows = JSON.parse(raw) as FanoutJobRecord[];
        if (!Array.isArray(rows)) return;
        for (const row of rows) {
            if (!row?.jobId) continue;
            // In-flight jobs from a previous process cannot resume safely.
            if (row.status === "queued" || row.status === "baking" || row.status === "publishing") {
                row.status = "failed";
                row.error = row.error || "Server restarted during fan-out";
                row.updatedAt = new Date().toISOString();
            }
            jobs.set(row.jobId, row);
        }
        await persist();
        console.log(`FanoutJobs loaded ${jobs.size} job(s) from disk`);
    } catch (err: any) {
        if (err?.code !== "ENOENT") {
            console.warn("FanoutJobs load failed:", err);
        }
    }
}

export function getFanoutJob(jobId: string): FanoutJobRecord | undefined {
    return jobs.get(jobId);
}

export function createFanoutJob(opts: {
    itemId: string;
    mediaSourceId?: string;
}): FanoutJobRecord {
    const now = new Date().toISOString();
    const job: FanoutJobRecord = {
        jobId: newJobId(),
        itemId: opts.itemId,
        mediaSourceId: opts.mediaSourceId,
        status: "queued",
        createdAt: now,
        updatedAt: now,
    };
    jobs.set(job.jobId, job);
    void persist();
    return job;
}

async function updateJob(
    jobId: string,
    patch: Partial<FanoutJobRecord>,
): Promise<FanoutJobRecord | undefined> {
    const cur = jobs.get(jobId);
    if (!cur) return undefined;
    const next = {
        ...cur,
        ...patch,
        updatedAt: new Date().toISOString(),
    };
    jobs.set(jobId, next);
    await persist();
    return next;
}

/**
 * Kick the bake+publish pipeline without holding the HTTP request.
 */
export function startFanoutJob(jobId: string): void {
    if (!runner) {
        void updateJob(jobId, {
            status: "failed",
            error: "Fan-out runner not configured",
        });
        return;
    }
    const job = jobs.get(jobId);
    if (!job) return;

    void (async () => {
        try {
            await updateJob(jobId, { status: "baking", error: undefined });
            const result = await runner!(job);
            await updateJob(jobId, { status: "ready", result, error: undefined });
            console.log(`OCI HLS fan-out ready job=${jobId} ${result.playlistUrl}`);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Failed to publish HLS fan-out";
            console.error(`OCI HLS fan-out failed job=${jobId}:`, err);
            await updateJob(jobId, { status: "failed", error: message });
        }
    })();
}

export function fanoutJobPublicView(job: FanoutJobRecord) {
    return {
        jobId: job.jobId,
        itemId: job.itemId,
        mediaSourceId: job.mediaSourceId,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        error: job.error,
        ...(job.result || {}),
        statusUrl: `/i/fanout/${job.jobId}`,
    };
}
