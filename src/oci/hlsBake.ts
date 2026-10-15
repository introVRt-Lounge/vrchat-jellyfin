import { lookup } from "dns/promises";
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
 * johnvansickle ffmpeg-static cannot resolve Docker Compose DNS names
 * ("Failed to resolve hostname jellyfin: System error"). Rewrite host → IP.
 */
export async function rewriteUrlHostToIp(inputUrl: string): Promise<string> {
    const u = new URL(inputUrl);
    if (!u.hostname || /^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname)) {
        return inputUrl;
    }
    const { address } = await lookup(u.hostname);
    u.hostname = address;
    return u.toString();
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
    const resolvedInput = await rewriteUrlHostToIp(inputUrl);

    await new Promise<void>((resolve, reject) => {
        const inputOptions = [
            "-user_agent",
            "Jellyfin VRChat Proxy (oci-hls)",
            // HTTP/Jellyfin streams can flap; allow short reconnects.
            "-reconnect",
            "1",
            "-reconnect_streamed",
            "1",
            "-reconnect_delay_max",
            "5",
        ];
        if (cfg.maxSeconds > 0) {
            // Prefer input -t so ffmpeg stops reading the source early (static files are huge).
            inputOptions.push("-t", String(cfg.maxSeconds));
        }

        const command = ffmpeg(resolvedInput)
            .inputOptions(inputOptions)
            .outputOptions([
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-profile:v",
                "main",
                "-pix_fmt",
                "yuv420p",
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
