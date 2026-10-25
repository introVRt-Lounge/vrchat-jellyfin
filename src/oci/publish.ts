import { randomBytes } from "crypto";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { buildOciHlsPublishConfig, type OciHlsPublishConfig } from "./config";
import { bakeHlsFromUrl, cleanupBakeDir, type BakeResult } from "./hlsBake";
import { bakeHlsViaDffmpeg } from "./hlsBakeDffmpeg";
import { absolutizeHlsPlaylist, publicObjectUrl } from "./playlist";
import { createOciS3Client, putObjectBuffer, putObjectFile } from "./s3Upload";

export interface FanoutPublishResult {
    delivery: "oci-hls";
    playlistUrl: string;
    prefix: string;
    maxSeconds: number;
    segmentCount: number;
    bakeMode: "local" | "dffmpeg";
    /** Local bake/job folder name (also OCI path segment). */
    jobId: string;
}

function stamp(): string {
    const d = new Date();
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    return (
        `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
    );
}

export function newFanoutBakeJobId(): string {
    return `${stamp()}-${randomBytes(4).toString("hex")}`;
}

/**
 * Upload an already-baked HLS directory (index.m3u8 + *.ts) to OCI.
 * Used by the normal publish path and by ops recovery when CF aborted mid-request.
 */
export async function uploadBakeDirToOci(opts: {
    bake: BakeResult;
    itemId: string;
    jobId: string;
    cfg: OciHlsPublishConfig;
    /** When false, leave files on disk (ops recovery / debug). Default true. */
    cleanup?: boolean;
}): Promise<FanoutPublishResult> {
    const { bake, itemId, jobId, cfg } = opts;
    const prefix = `${cfg.keyPrefix}/${itemId}/${jobId}`;
    const s3 = createOciS3Client(cfg);

    try {
        for (const segPath of bake.segmentPaths) {
            const name = path.basename(segPath);
            await putObjectFile(s3, cfg, `${prefix}/${name}`, segPath);
        }

        const rawPlaylist = await readFile(bake.playlistPath, "utf8");
        const absolutePlaylist = absolutizeHlsPlaylist(
            rawPlaylist,
            cfg.publicBase,
            prefix,
        );
        const playlistKey = `${prefix}/index.m3u8`;
        await putObjectBuffer(
            s3,
            cfg,
            playlistKey,
            absolutePlaylist,
            "application/vnd.apple.mpegurl",
        );

        return {
            delivery: "oci-hls",
            playlistUrl: publicObjectUrl(cfg.publicBase, playlistKey),
            prefix,
            maxSeconds: cfg.maxSeconds,
            segmentCount: bake.segmentPaths.length,
            bakeMode: cfg.bakeMode,
            jobId,
        };
    } finally {
        if (opts.cleanup !== false) {
            await cleanupBakeDir(bake.workDir).catch(() => undefined);
        }
        s3.destroy();
    }
}

/** Load segment list from a finished bake directory. */
export async function loadBakeResultFromDir(workDir: string): Promise<BakeResult> {
    const playlistPath = path.join(workDir, "index.m3u8");
    const names = await readdir(workDir);
    const segmentPaths = names
        .filter((n) => n.endsWith(".ts"))
        .sort()
        .map((n) => path.join(workDir, n));
    if (segmentPaths.length === 0) {
        throw new Error(`No HLS segments in ${workDir}`);
    }
    return { workDir, playlistPath, segmentPaths };
}

/**
 * Bake Jellyfin item stream → HLS → upload to OCI Object Storage with absolute
 * segment URLs in the playlist. Returns the public m3u8 URL for VRChat.
 */
export async function publishItemHlsFanout(opts: {
    inputUrl: string;
    itemId: string;
    env?: NodeJS.ProcessEnv;
    cfg?: OciHlsPublishConfig;
    /** Optional pre-assigned bake folder / OCI path id. */
    jobId?: string;
}): Promise<FanoutPublishResult> {
    const cfg = opts.cfg || buildOciHlsPublishConfig(opts.env);
    if (!cfg.enabled) {
        throw new Error("OCI HLS publish is not enabled or credentials are incomplete");
    }

    const jobId = opts.jobId || newFanoutBakeJobId();

    const bake =
        cfg.bakeMode === "dffmpeg"
            ? await bakeHlsViaDffmpeg(opts.inputUrl, cfg, jobId)
            : await bakeHlsFromUrl(opts.inputUrl, cfg, jobId);

    return uploadBakeDirToOci({
        bake,
        itemId: opts.itemId,
        jobId,
        cfg,
        cleanup: true,
    });
}

export { buildOciHlsPublishConfig, absolutizeHlsPlaylist, publicObjectUrl };
