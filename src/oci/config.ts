/** OCI Object Storage HLS fan-out publish config (env-gated; off by default). */

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
    /** Working directory for ffmpeg output before upload. */
    workDir: string;
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
    const workDir = clean(env.OCI_HLS_WORK_DIR) || "/tmp/vrchat-oci-hls";

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
        workDir,
    };
}
