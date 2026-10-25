/** OCI Object Storage HLS fan-out publish config (env-gated; off by default). */

export type OciHlsBakeMode = "local" | "dffmpeg";

export interface DffmpegBakeConfig {
    enabled: boolean;
    coordinatorUrl: string;
    clientId: string;
    hmacKeyB64: string;
    pathVar: string;
    localDir: string;
}

export interface OciHlsPublishConfig {
    enabled: boolean;
    accessKey: string;
    secretKey: string;
    namespace: string;
    region: string;
    bucket: string;
    endpoint: string;
    /** Native Object Storage public base ending at /o (no trailing slash). */
    publicBase: string;
    /** Object key prefix for publishes (no leading/trailing slash). */
    keyPrefix: string;
    /**
     * Cap bake length for spike/dev. 0 = full title (expensive).
     * Default 120s so a mint does not encode an entire movie by accident.
     */
    maxSeconds: number;
    /** HLS segment duration target (seconds). */
    hlsTime: number;
    /**
     * How many finished segments must exist before the public playlist URL is
     * considered playable (progressive fan-out). Default 4 ≈ 24–40s at hlsTime 6–10.
     */
    headStartSegments: number;
    /** Working directory for local ffmpeg output before upload. */
    workDir: string;
    /** local = in-process ffmpeg-static; dffmpeg = estate encode bus. */
    bakeMode: OciHlsBakeMode;
    dffmpeg: DffmpegBakeConfig;
    /**
     * Rewrite Jellyfin compose-DNS URLs to this origin before handing off to
     * workers (e.g. http://127.0.0.1:8096 on the proxmox host).
     */
    sourceBase: string;
    /** libx264 (default) or h264_nvenc when the worker has NVENC. */
    videoEncoder: string;
}

function clean(value: string | undefined): string {
    return (value || "").trim();
}

function truthy(raw: string | undefined): boolean {
    const v = clean(raw).toLowerCase();
    return v === "1" || v === "true" || v === "yes" || v === "on";
}

function parseNonNegInt(raw: string | undefined, fallback: number): number {
    if (raw === undefined || raw === "") return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.floor(n);
}

/**
 * Fan-out publish is enabled only when the flag is on and S3 + public base are complete.
 * Prod compose must leave OCI_HLS_PUBLISH unset/false.
 */
export function buildOciHlsPublishConfig(
    env: NodeJS.ProcessEnv = process.env,
): OciHlsPublishConfig {
    const accessKey = clean(env.OCI_S3_ACCESS_KEY);
    const secretKey = clean(env.OCI_S3_SECRET_KEY);
    const namespace = clean(env.OCI_S3_NAMESPACE);
    const region = clean(env.OCI_S3_REGION) || "us-ashburn-1";
    const bucket = clean(env.OCI_S3_BUCKET) || "owncast";
    const endpoint =
        clean(env.OCI_S3_ENDPOINT) ||
        (namespace
            ? `https://${namespace}.compat.objectstorage.${region}.oraclecloud.com`
            : "");
    const publicBase = clean(env.OCI_PUBLIC_BASE).replace(/\/+$/, "");
    const keyPrefix = clean(env.OCI_HLS_KEY_PREFIX) || "vrchat-fanout";
    const maxSeconds = parseNonNegInt(env.OCI_HLS_MAX_SECONDS, 120);
    const hlsTime = Math.max(2, parseNonNegInt(env.OCI_HLS_TIME, 6) || 6);
    const headStartSegments = Math.max(
        2,
        parseNonNegInt(env.OCI_HLS_HEAD_START_SEGMENTS, 4) || 4,
    );
    const workDir = clean(env.OCI_HLS_WORK_DIR) || "/tmp/vrchat-oci-hls";
    const sourceBase = clean(env.OCI_HLS_SOURCE_BASE).replace(/\/+$/, "");
    const videoEncoder = clean(env.OCI_HLS_VIDEO_ENCODER) || "libx264";

    const coordinatorUrl = clean(env.DFFMPEG_COORDINATOR_URL).replace(/\/+$/, "");
    const clientId = clean(env.DFFMPEG_CLIENT_ID);
    const hmacKeyB64 = clean(env.DFFMPEG_HMAC_KEY);
    const pathVar = clean(env.DFFMPEG_FANOUT_PATH_VAR) || "Fanout";
    const localDir =
        clean(env.DFFMPEG_FANOUT_LOCAL_DIR) || "/var/lib/dffmpeg/work";
    const dffmpegReady = Boolean(coordinatorUrl && clientId && hmacKeyB64);
    const wantDffmpeg = clean(env.OCI_HLS_BAKE_MODE).toLowerCase() === "dffmpeg";
    const bakeMode: OciHlsBakeMode = wantDffmpeg && dffmpegReady ? "dffmpeg" : "local";

    const credentialsOk = Boolean(
        accessKey && secretKey && namespace && bucket && endpoint && publicBase,
    );
    const enabled = truthy(env.OCI_HLS_PUBLISH) && credentialsOk;

    return {
        enabled,
        accessKey,
        secretKey,
        namespace,
        region,
        bucket,
        endpoint,
        publicBase,
        keyPrefix,
        maxSeconds,
        hlsTime,
        headStartSegments,
        workDir,
        bakeMode,
        dffmpeg: {
            enabled: bakeMode === "dffmpeg",
            coordinatorUrl,
            clientId,
            hmacKeyB64,
            pathVar,
            localDir,
        },
        sourceBase,
        videoEncoder,
    };
}
