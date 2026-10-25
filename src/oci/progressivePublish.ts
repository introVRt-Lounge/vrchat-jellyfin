import { chmod, mkdir, readdir, readFile, stat } from "fs/promises";
import path from "path";
import type { OciHlsPublishConfig } from "./config";
import {
    getDffmpegJobStatus,
    rewriteSourceUrlForWorkers,
    submitDffmpegJob,
    type DffmpegClientConfig,
} from "./dffmpegClient";
import { cleanupBakeDir } from "./hlsBake";
import { absolutizeHlsPlaylist, publicObjectUrl } from "./playlist";
import type { FanoutPublishResult } from "./publish";
import { createOciS3Client, putObjectBuffer, putObjectFile } from "./s3Upload";

function toClientCfg(cfg: OciHlsPublishConfig): DffmpegClientConfig {
    if (!cfg.dffmpeg.enabled) {
        throw new Error("dffmpeg bake requested but client config is incomplete");
    }
    const timeoutMs =
        cfg.maxSeconds > 0
            ? Math.max(60_000, cfg.maxSeconds * 1000 + 120_000)
            : 6 * 60 * 60 * 1000;
    return {
        coordinatorUrl: cfg.dffmpeg.coordinatorUrl,
        clientId: cfg.dffmpeg.clientId,
        hmacKeyB64: cfg.dffmpeg.hmacKeyB64,
        pathVar: cfg.dffmpeg.pathVar,
        localDir: cfg.dffmpeg.localDir,
        timeoutMs,
        pollMs: 1000,
    };
}

/** Event playlist grows while encoding; ENDLIST appears when ffmpeg exits. */
export function buildProgressiveFfmpegArgs(
    inputUrl: string,
    cfg: OciHlsPublishConfig,
    mappedPlaylist: string,
    mappedSegmentPattern: string,
): string[] {
    const args: string[] = [
        "-y",
        "-user_agent",
        "Jellyfin VRChat Proxy (oci-hls-progressive)",
        "-reconnect",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_delay_max",
        "5",
    ];
    if (cfg.maxSeconds > 0) {
        args.push("-t", String(cfg.maxSeconds));
    }
    args.push("-i", inputUrl);

    const encoder = cfg.videoEncoder || "libx264";
    if (encoder === "h264_nvenc") {
        args.push(
            "-c:v",
            "h264_nvenc",
            "-preset",
            "p4",
            "-tune",
            "hq",
            "-rc",
            "vbr",
            "-b:v",
            "4M",
            "-maxrate",
            "6M",
            "-bufsize",
            "8M",
            "-profile:v",
            "main",
            "-pix_fmt",
            "yuv420p",
        );
    } else {
        args.push(
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-profile:v",
            "main",
            "-pix_fmt",
            "yuv420p",
        );
    }

    args.push(
        "-c:a",
        "aac",
        "-ac",
        "2",
        "-b:a",
        "128k",
        "-f",
        "hls",
        "-hls_time",
        String(cfg.hlsTime),
        // Growing playlist while bake runs — players re-fetch; we upload early.
        "-hls_playlist_type",
        "event",
        "-hls_list_size",
        "0",
        "-hls_segment_filename",
        mappedSegmentPattern,
        mappedPlaylist,
    );
    return args;
}

const TERMINAL = new Set([
    "completed",
    "failed",
    "cancelled",
    "canceled",
    "error",
]);

async function listTsSorted(workDir: string): Promise<string[]> {
    const names = await readdir(workDir).catch(() => [] as string[]);
    return names.filter((n) => n.endsWith(".ts")).sort();
}

/**
 * Segments still being written by ffmpeg are unsafe to upload. Treat the newest
 * .ts as open until a newer one appears or the bake is terminal.
 */
function uploadableSegments(all: string[], bakeDone: boolean): string[] {
    if (all.length === 0) return [];
    if (bakeDone) return all;
    if (all.length === 1) return [];
    return all.slice(0, -1);
}

async function sleep(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
}

/**
 * Submit dffmpeg bake and stream segments to OCI as they land. Marks the job
 * playable (via onPlayable) after `headStartSegments` finished segments exist,
 * then continues until bake completes and the final playlist includes ENDLIST.
 */
export async function publishItemHlsFanoutProgressive(opts: {
    inputUrl: string;
    itemId: string;
    jobId: string;
    cfg: OciHlsPublishConfig;
    onPlayable?: (partial: FanoutPublishResult) => void | Promise<void>;
}): Promise<FanoutPublishResult> {
    const { cfg, itemId, jobId } = opts;
    if (!cfg.enabled) {
        throw new Error("OCI HLS publish is not enabled or credentials are incomplete");
    }
    if (cfg.bakeMode !== "dffmpeg" || !cfg.dffmpeg.enabled) {
        throw new Error("Progressive fan-out requires OCI_HLS_BAKE_MODE=dffmpeg");
    }

    const client = toClientCfg(cfg);
    const workDir = path.join(client.localDir, jobId);
    await mkdir(workDir, { recursive: true, mode: 0o777 });
    await chmod(workDir, 0o777);

    const resolvedInput = rewriteSourceUrlForWorkers(opts.inputUrl, cfg.sourceBase);
    const mappedPlaylist = `$${client.pathVar}/${jobId}/index.m3u8`;
    const mappedSegments = `$${client.pathVar}/${jobId}/seg%03d.ts`;
    const args = buildProgressiveFfmpegArgs(
        resolvedInput,
        cfg,
        mappedPlaylist,
        mappedSegments,
    );

    const submitted = await submitDffmpegJob(client, args, [client.pathVar]);
    const dffmpegJobId = String(submitted.job_id);
    console.log(
        `OCI HLS progressive bake submitted dffmpeg=${dffmpegJobId} job=${jobId} headStart=${cfg.headStartSegments}`,
    );

    const prefix = `${cfg.keyPrefix}/${itemId}/${jobId}`;
    const playlistKey = `${prefix}/index.m3u8`;
    const playlistUrl = publicObjectUrl(cfg.publicBase, playlistKey);
    const s3 = createOciS3Client(cfg);
    const uploaded = new Set<string>();
    let playableSent = false;
    const started = Date.now();
    const timeoutMs = client.timeoutMs ?? 6 * 60 * 60 * 1000;

    const publishPlaylist = async (): Promise<void> => {
        const playlistPath = path.join(workDir, "index.m3u8");
        try {
            await stat(playlistPath);
        } catch {
            return;
        }
        const raw = await readFile(playlistPath, "utf8");
        // Only advertise segments we have already uploaded (drop EXTINF+URI pairs).
        const lines = raw.split(/\r?\n/);
        const kept: string[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const t = line.trim();
            if (t.startsWith("#EXTINF")) {
                const uri = lines[i + 1] ?? "";
                const name =
                    uri.trim().replace(/^\.\//, "").split("/").pop() || "";
                if (uploaded.has(name)) {
                    kept.push(line);
                    kept.push(uri);
                }
                i += 1;
                continue;
            }
            if (!t || t.startsWith("#")) {
                kept.push(line);
            }
        }
        const filtered = kept.join("\n");
        if (!filtered.includes("#EXTINF")) return;
        const absolute = absolutizeHlsPlaylist(filtered, cfg.publicBase, prefix);
        await putObjectBuffer(
            s3,
            cfg,
            playlistKey,
            absolute,
            "application/vnd.apple.mpegurl",
        );
    };

    const snapshot = (segmentCount: number): FanoutPublishResult => ({
        delivery: "oci-hls",
        playlistUrl,
        prefix,
        maxSeconds: cfg.maxSeconds,
        segmentCount,
        bakeMode: "dffmpeg",
        jobId,
    });

    try {
        let bakeStatus = "running";
        let exitCode: number | null | undefined;

        while (Date.now() - started < timeoutMs) {
            const job = await getDffmpegJobStatus(client, dffmpegJobId);
            bakeStatus = String(job.status).toLowerCase();
            exitCode = job.exit_code;
            const done = TERMINAL.has(bakeStatus);

            const all = await listTsSorted(workDir);
            const readyNames = uploadableSegments(all, done && bakeStatus === "completed");

            for (const name of readyNames) {
                if (uploaded.has(name)) continue;
                await putObjectFile(s3, cfg, `${prefix}/${name}`, path.join(workDir, name));
                uploaded.add(name);
            }

            if (uploaded.size > 0) {
                await publishPlaylist();
            }

            if (!playableSent && uploaded.size >= cfg.headStartSegments) {
                playableSent = true;
                const partial = snapshot(uploaded.size);
                console.log(
                    `OCI HLS fan-out playable job=${jobId} segs=${uploaded.size} ${playlistUrl}`,
                );
                await opts.onPlayable?.(partial);
            }

            if (done) {
                if (bakeStatus !== "completed" || (exitCode != null && exitCode !== 0)) {
                    throw new Error(
                        `dffmpeg bake failed: status=${bakeStatus} exit=${exitCode}`,
                    );
                }
                // Final pass: upload any leftover segments + playlist with ENDLIST.
                const finalAll = await listTsSorted(workDir);
                for (const name of finalAll) {
                    if (uploaded.has(name)) continue;
                    await putObjectFile(
                        s3,
                        cfg,
                        `${prefix}/${name}`,
                        path.join(workDir, name),
                    );
                    uploaded.add(name);
                }
                await publishPlaylist();
                if (uploaded.size === 0) {
                    throw new Error("progressive bake produced no HLS segments");
                }
                return snapshot(uploaded.size);
            }

            await sleep(client.pollMs ?? 1000);
        }

        throw new Error(`dffmpeg job ${dffmpegJobId} timed out after ${timeoutMs}ms`);
    } finally {
        await cleanupBakeDir(workDir).catch(() => undefined);
        s3.destroy();
    }
}
