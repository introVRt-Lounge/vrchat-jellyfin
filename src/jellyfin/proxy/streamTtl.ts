/**
 * Per-capability stream URL lifetimes.
 * Default remains PROXY_TTL_MS (24h). Admins/hosts may mint longer up to PROXY_TTL_MAX_MS.
 */

export interface StreamDurationOption {
    id: string;
    label: string;
    hours: number;
    /** True when this option is above the default TTL. */
    extended: boolean;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function defaultTtlMs(env: NodeJS.ProcessEnv = process.env): number {
    const parsed = parseInt(env.PROXY_TTL_MS || "", 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DAY_MS;
    }
    return parsed;
}

export function maxTtlMs(env: NodeJS.ProcessEnv = process.env): number {
    const parsed = parseInt(env.PROXY_TTL_MAX_MS || "", 10);
    const fallback = 30 * DAY_MS;
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return Math.max(fallback, defaultTtlMs(env));
    }
    return Math.max(parsed, defaultTtlMs(env));
}

/** Preset menu for the mint UI (filtered by max). */
export function streamDurationOptions(env: NodeJS.ProcessEnv = process.env): StreamDurationOption[] {
    const def = defaultTtlMs(env);
    const max = maxTtlMs(env);
    const presets: StreamDurationOption[] = [
        { id: "24h", label: "24 hours", hours: 24, extended: false },
        { id: "3d", label: "3 days", hours: 72, extended: true },
        { id: "7d", label: "7 days", hours: 168, extended: true },
        { id: "14d", label: "14 days", hours: 336, extended: true },
        { id: "30d", label: "30 days", hours: 720, extended: true },
    ];

    const options = presets
        .map((p) => {
            const ms = p.hours * HOUR_MS;
            const extended = ms > def + 1000;
            return { ...p, extended };
        })
        .filter((p) => p.hours * HOUR_MS <= max + 1000);

    // If PROXY_TTL_MS is custom, ensure a matching non-extended option exists.
    const defHours = Math.round(def / HOUR_MS);
    if (!options.some((p) => Math.abs(p.hours - defHours) < 0.5)) {
        options.unshift({
            id: "default",
            label: `${defHours} hours`,
            hours: defHours,
            extended: false,
        });
    }
    return options;
}

export function resolveTtlMs(
    requestedHours: unknown,
    opts: { allowExtended: boolean; env?: NodeJS.ProcessEnv },
): { ttlMs: number; extended: boolean } {
    const env = opts.env || process.env;
    const def = defaultTtlMs(env);
    const max = maxTtlMs(env);

    let hours: number | null = null;
    if (typeof requestedHours === "number" && Number.isFinite(requestedHours)) {
        hours = requestedHours;
    } else if (typeof requestedHours === "string" && requestedHours.trim()) {
        const n = parseFloat(requestedHours);
        if (Number.isFinite(n)) hours = n;
    }

    if (hours == null || hours <= 0) {
        return { ttlMs: def, extended: false };
    }

    let ttlMs = Math.round(hours * HOUR_MS);
    ttlMs = Math.min(ttlMs, max);
    ttlMs = Math.max(ttlMs, 60_000); // at least 1 minute

    const extended = ttlMs > def + 1000;
    if (extended && !opts.allowExtended) {
        return { ttlMs: def, extended: false };
    }
    return { ttlMs, extended };
}

/** Role snowflakes allowed to mint beyond default TTL. Empty = any Access user. */
export function extendedRoleIds(env: NodeJS.ProcessEnv = process.env): string[] {
    const raw = (env.STREAM_URL_EXTENDED_ROLE_IDS || "").trim();
    if (!raw) return [];
    return raw
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter((s) => /^\d{17,20}$/.test(s));
}

export function guildRolesClaimName(env: NodeJS.ProcessEnv = process.env): string {
    const guild = (env.DISCORD_GUILD_ID || "").trim();
    return guild ? `roles:${guild}` : "roles";
}

export function rolesFromAccessPayload(payload: Record<string, unknown> | null, env: NodeJS.ProcessEnv = process.env): string[] {
    if (!payload) return [];
    const claim = guildRolesClaimName(env);
    const custom = payload.custom;
    const bags: unknown[] = [payload[claim], payload.roles];
    if (custom && typeof custom === "object") {
        const c = custom as Record<string, unknown>;
        bags.push(c[claim], c.roles);
    }
    const out = new Set<string>();
    for (const bag of bags) {
        if (typeof bag === "string" && /^\d{17,20}$/.test(bag)) {
            out.add(bag);
        } else if (Array.isArray(bag)) {
            for (const v of bag) {
                if (typeof v === "string" && /^\d{17,20}$/.test(v)) out.add(v);
                if (typeof v === "number" && Number.isFinite(v)) {
                    const s = String(Math.trunc(v));
                    if (/^\d{17,20}$/.test(s)) out.add(s);
                }
            }
        }
    }
    return Array.from(out);
}

export function allowsExtendedTtl(
    payload: Record<string, unknown> | null,
    env: NodeJS.ProcessEnv = process.env,
): boolean {
    const allowed = extendedRoleIds(env);
    if (allowed.length === 0) {
        // No role gate configured — anyone who reached the Access-gated mint UI may extend.
        return true;
    }
    const have = rolesFromAccessPayload(payload, env);
    return have.some((r) => allowed.includes(r));
}
