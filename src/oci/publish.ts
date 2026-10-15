import { randomBytes } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { buildOciHlsPublishConfig, type OciHlsPublishConfig } from "./config";
import { bakeHlsFromUrl, cleanupBakeDir } from "./hlsBake";
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
}

function stamp(): string {
    const d = new Date();
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    return (
        `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
    );
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
}): Promise<FanoutPublishResult> {
    const cfg = opts.cfg || buildOciHlsPublishConfig(opts.env);
    if (!cfg.enabled) {
        throw new Error("OCI HLS publish is not enabled or credentials are incomplete");
    }

    const jobId = `${stamp()}-${randomBytes(4).toString("hex")}`;
    const prefix = `${cfg.keyPrefix}/${opts.itemId}/${jobId}`;

    const bake =
        cfg.bakeMode === "dffmpeg"
            ? await bakeHlsViaDffmpeg(opts.inputUrl, cfg, jobId)
            : await bakeHlsFromUrl(opts.inputUrl, cfg, jobId);
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
        };
    } finally {
        await cleanupBakeDir(bake.workDir).catch(() => undefined);
        s3.destroy();
    }
}

export { buildOciHlsPublishConfig, absolutizeHlsPlaylist, publicObjectUrl };
