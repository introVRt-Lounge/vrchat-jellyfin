import { mkdir, readdir, rm, writeFile } from "fs/promises";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import type { OciHlsPublishConfig } from "./config";

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

export interface BakeResult {
    workDir: string;
    playlistPath: string;
    segmentPaths: string[];
}

/**
 * Transcode an HTTP(S) input (Jellyfin stream URL) to VOD HLS in a temp dir.
 */
export async function bakeHlsFromUrl(
    inputUrl: string,
    cfg: OciHlsPublishConfig,
    jobId: string,
): Promise<BakeResult> {
    const workDir = path.join(cfg.workDir, jobId);
    await mkdir(workDir, { recursive: true });
    const playlistPath = path.join(workDir, "index.m3u8");
    const segmentPattern = path.join(workDir, "seg%03d.ts");

    await new Promise<void>((resolve, reject) => {
        let command = ffmpeg(inputUrl)
            .inputOptions(["-user_agent", "Jellyfin VRChat Proxy (oci-hls)"])
            .outputOptions([
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-profile:v",
                "main",
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
                segmentPattern,
            ]);

        if (cfg.maxSeconds > 0) {
            command = command.duration(cfg.maxSeconds);
        }

        command
            .output(playlistPath)
            .on("end", () => resolve())
            .on("error", (err: Error) => reject(err))
            .run();
    });

    const names = await readdir(workDir);
    const segmentPaths = names
        .filter((n) => n.endsWith(".ts"))
        .sort()
        .map((n) => path.join(workDir, n));

    if (segmentPaths.length === 0) {
        throw new Error("ffmpeg produced no HLS segments");
    }

    // Touch a marker so operators can see incomplete cleans in /tmp
    await writeFile(path.join(workDir, ".done"), String(Date.now()), "utf8");

    return { workDir, playlistPath, segmentPaths };
}

export async function cleanupBakeDir(workDir: string): Promise<void> {
    await rm(workDir, { recursive: true, force: true });
}
