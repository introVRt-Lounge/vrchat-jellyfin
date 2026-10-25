// src/jellyfin/proxy/proxy.ts

import { randomBytes } from "crypto";

/** 24 bytes = 192 bits entropy (W3C TAG capability-URL guidance: >= 120 bits). */
const CAPABILITY_ID_BYTES = 24;

export default class Proxy {
    public readonly id: string;
    public readonly createdAt: Date;
    /** Per-URL lifetime from mint; falls back to global default when missing (legacy store). */
    public readonly ttlMs: number | null;

    constructor(
        public itemId: string,
        public options?: ProxyOptions,
        id?: string,
        createdAt?: Date,
        ttlMs?: number | null,
    ) {
        this.id = id ?? randomBytes(CAPABILITY_ID_BYTES).toString("base64url");
        this.createdAt = createdAt ?? new Date();
        this.ttlMs =
            typeof ttlMs === "number" && Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : null;
    }

    expiresAt(defaultTtlMs: number): Date {
        const ttl = this.ttlMs ?? defaultTtlMs;
        return new Date(this.createdAt.getTime() + ttl);
    }
}

export interface ProxyOptions {
    audioBitrate?: number;
    videoBitrate?: number;
    height?: number;
    width?: number;
    audioChannels?: number;
    videoStreamIndex?: number;
    audioStreamIndex?: number;
    subtitleStreamIndex?: number;
    subtitleMethod?: SubtitleMethod;
    /** Jellyfin MediaSource Id when the item has multiple files/versions. */
    mediaSourceId?: string;
}

export enum SubtitleMethod {
    Encode = "Encode",
    Embed = "Embed",
    External = "External",
    Hls = "Hls",
    Drop = "Drop",
}

export interface PersistedProxy {
    id: string;
    itemId: string;
    createdAt: string;
    options?: ProxyOptions;
    /** Optional; absent on legacy records → use global PROXY_TTL_MS. */
    ttlMs?: number;
}
