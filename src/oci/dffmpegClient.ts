import { createHash, createHmac } from "crypto";

export interface DffmpegSignInput {
    clientId: string;
    hmacKeyB64: string;
    method: string;
    path: string;
    body?: string;
    /** Override for tests; defaults to unix seconds now. */
    timestamp?: string;
}

export interface DffmpegSignResult {
    headers: Record<string, string>;
    body: string;
}

/**
 * HMAC-SHA256 request signing matching brwyatt/dffmpeg RequestSigner.
 * Canonical: METHOD|path|timestamp|sha256hex(body)
 */
export function signDffmpegRequest(input: DffmpegSignInput): DffmpegSignResult {
    const method = input.method.toUpperCase();
    const body = input.body ?? "";
    const timestamp = input.timestamp ?? String(Math.floor(Date.now() / 1000));
    const payloadHash = createHash("sha256").update(body).digest("hex");
    const canonical = `${method}|${input.path}|${timestamp}|${payloadHash}`;
    const secret = Buffer.from(input.hmacKeyB64, "base64");
    const signature = createHmac("sha256", secret).update(canonical).digest("base64");
    return {
        body,
        headers: {
            "x-dffmpeg-client-id": input.clientId,
            "x-dffmpeg-timestamp": timestamp,
            "x-dffmpeg-signature": signature,
            ...(body ? { "Content-Type": "application/json" } : {}),
        },
    };
}

/**
 * Rewrite Jellyfin (compose DNS) URLs to a worker-reachable origin
 * (e.g. http://127.0.0.1:8096 on the proxmox host).
 */
export function rewriteSourceUrlForWorkers(
    inputUrl: string,
    sourceBase: string,
): string {
    const base = (sourceBase || "").trim().replace(/\/+$/, "");
    if (!base) return inputUrl;
    const src = new URL(inputUrl);
    const dest = new URL(base);
    src.protocol = dest.protocol;
    src.hostname = dest.hostname;
    src.port = dest.port;
    return src.toString();
}

export interface DffmpegClientConfig {
    coordinatorUrl: string;
    clientId: string;
    hmacKeyB64: string;
    /** Logical path variable advertised by workers (e.g. Fanout). */
    pathVar: string;
    /** Local dir that maps to pathVar inside this process. */
    localDir: string;
    pollMs?: number;
    timeoutMs?: number;
}

export interface DffmpegJobRecord {
    job_id: string;
    status: string;
    exit_code?: number | null;
    worker_id?: string | null;
}

async function signedFetch(
    cfg: DffmpegClientConfig,
    method: string,
    path: string,
    jsonBody?: unknown,
): Promise<Response> {
    const body = jsonBody === undefined ? "" : JSON.stringify(jsonBody);
    const { headers, body: content } = signDffmpegRequest({
        clientId: cfg.clientId,
        hmacKeyB64: cfg.hmacKeyB64,
        method,
        path,
        body,
    });
    const url = `${cfg.coordinatorUrl.replace(/\/+$/, "")}${path}`;
    return fetch(url, {
        method,
        headers,
        body: content || undefined,
    });
}

export async function submitDffmpegJob(
    cfg: DffmpegClientConfig,
    args: string[],
    paths: string[],
): Promise<DffmpegJobRecord> {
    const payload = {
        binary_name: "ffmpeg",
        arguments: args,
        paths,
        working_directory: `$${cfg.pathVar}`,
        supported_transports: ["http_polling"],
        monitor: false,
        supported_features: [] as string[],
    };
    const resp = await signedFetch(cfg, "POST", "/jobs/submit", payload);
    if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`dffmpeg submit failed: HTTP ${resp.status} ${text}`);
    }
    return (await resp.json()) as DffmpegJobRecord;
}

export async function getDffmpegJobStatus(
    cfg: DffmpegClientConfig,
    jobId: string,
): Promise<DffmpegJobRecord> {
    const resp = await signedFetch(cfg, "GET", `/jobs/${jobId}/status`);
    if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`dffmpeg status failed: HTTP ${resp.status} ${text}`);
    }
    return (await resp.json()) as DffmpegJobRecord;
}

const TERMINAL = new Set([
    "completed",
    "failed",
    "cancelled",
    "canceled",
    "error",
]);

export async function waitForDffmpegJob(
    cfg: DffmpegClientConfig,
    jobId: string,
): Promise<DffmpegJobRecord> {
    const pollMs = cfg.pollMs ?? 1000;
    const timeoutMs = cfg.timeoutMs ?? 10 * 60 * 1000;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const job = await getDffmpegJobStatus(cfg, jobId);
        if (TERMINAL.has(String(job.status).toLowerCase())) {
            return job;
        }
        await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error(`dffmpeg job ${jobId} timed out after ${timeoutMs}ms`);
}
