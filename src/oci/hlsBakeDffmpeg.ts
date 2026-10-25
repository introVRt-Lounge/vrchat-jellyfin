import { chmod, mkdir, readdir, writeFile } from "fs/promises";
import path from "path";
import type { OciHlsPublishConfig } from "./config";
import type { BakeResult } from "./hlsBake";
import {
    rewriteSourceUrlForWorkers,
    submitDffmpegJob,
    waitForDffmpegJob,
    type DffmpegClientConfig,
} from "./dffmpegClient";

function toClientCfg(cfg: OciHlsPublishConfig): DffmpegClientConfig {
    if (!cfg.dffmpeg.enabled) {
        throw new Error("dffmpeg bake requested but client config is incomplete");
    }
    // maxSeconds=0 means full title — allow multi-hour encodes (CF must not wait).
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
    };
}

function buildFfmpegArgs(
    inputUrl: string,
    cfg: OciHlsPublishConfig,
    mappedPlaylist: string,
    mappedSegmentPattern: string,
): string[] {
    const args: string[] = [
        "-y",
        "-user_agent",
        "Jellyfin VRChat Proxy (oci-hls-dffmpeg)",
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
        "-hls_playlist_type",
        "vod",
        "-hls_segment_filename",
        mappedSegmentPattern,
        mappedPlaylist,
    );
    return args;
}

/**
 * Bake HLS via estate dffmpeg workers. Output lands under the shared Fanout
 * path so this process can upload segments to OCI afterward.
 */
export async function bakeHlsViaDffmpeg(
    inputUrl: string,
    cfg: OciHlsPublishConfig,
    jobId: string,
): Promise<BakeResult> {
    const client = toClientCfg(cfg);
    const workDir = path.join(client.localDir, jobId);
    // Worker runs as system user `dffmpeg`; container often creates dirs as root.
    await mkdir(workDir, { recursive: true, mode: 0o777 });
    await chmod(workDir, 0o777);

    const resolvedInput = rewriteSourceUrlForWorkers(inputUrl, cfg.sourceBase);
    const mappedPlaylist = `$${client.pathVar}/${jobId}/index.m3u8`;
    const mappedSegments = `$${client.pathVar}/${jobId}/seg%03d.ts`;
    const args = buildFfmpegArgs(
        resolvedInput,
        cfg,
        mappedPlaylist,
        mappedSegments,
    );

    const submitted = await submitDffmpegJob(client, args, [client.pathVar]);
    const job = await waitForDffmpegJob(client, String(submitted.job_id));
    const status = String(job.status).toLowerCase();
    if (status !== "completed" || (job.exit_code !== null && job.exit_code !== undefined && job.exit_code !== 0)) {
        throw new Error(
            `dffmpeg bake failed: status=${job.status} exit=${job.exit_code} worker=${job.worker_id}`,
        );
    }

    const playlistPath = path.join(workDir, "index.m3u8");
    const names = await readdir(workDir);
    const segmentPaths = names
        .filter((n) => n.endsWith(".ts"))
        .sort()
        .map((n) => path.join(workDir, n));
    if (segmentPaths.length === 0) {
        throw new Error("dffmpeg produced no HLS segments");
    }
    await writeFile(path.join(workDir, ".done"), String(Date.now()), "utf8");
    return { workDir, playlistPath, segmentPaths };
}
