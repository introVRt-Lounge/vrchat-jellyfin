/**
 * Extract Discord snowflake from Cloudflare Access JWT (behind Access edge).
 * Prefer custom OIDC claim `id` from Erisa discord-oidc-worker.
 * Signature is not re-verified here — Access already gated the request.
 */

export interface AccessIdentity {
    discordUserId: string;
    email?: string;
    preferredUsername?: string;
}

const SNOWFLAKE = /^\d{17,20}$/;

function b64urlJson(segment: string): Record<string, unknown> | null {
    try {
        const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
        const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
        const json = Buffer.from(padded + pad, "base64").toString("utf8");
        const parsed = JSON.parse(json);
        return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

function asSnowflake(value: unknown): string | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        const s = String(Math.trunc(value));
        return SNOWFLAKE.test(s) ? s : null;
    }
    if (typeof value === "string") {
        const s = value.trim();
        return SNOWFLAKE.test(s) ? s : null;
    }
    return null;
}

function pickDiscordId(payload: Record<string, unknown>): string | null {
    const custom = payload.custom;
    if (custom && typeof custom === "object") {
        const c = custom as Record<string, unknown>;
        const fromCustom =
            asSnowflake(c.id) ||
            asSnowflake(c.discord_id) ||
            asSnowflake(c.discordId);
        if (fromCustom) return fromCustom;
    }

    const top =
        asSnowflake(payload.id) ||
        asSnowflake(payload.discord_id) ||
        asSnowflake(payload.discordId);
    if (top) return top;

    // Some IdP setups put Discord id in sub when using Discord OIDC.
    const sub = asSnowflake(payload.sub);
    if (sub) return sub;

    return null;
}

export function decodeAccessJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    return b64urlJson(parts[1]);
}

export function identityFromAccessJwt(token: string | undefined | null): AccessIdentity | null {
    if (!token || !token.trim()) return null;
    const payload = decodeAccessJwtPayload(token.trim());
    if (!payload) return null;

    const exp = payload.exp;
    if (typeof exp === "number" && exp * 1000 < Date.now()) {
        return null;
    }

    const discordUserId = pickDiscordId(payload);
    if (!discordUserId) return null;

    const email = typeof payload.email === "string" ? payload.email : undefined;
    const preferredUsername =
        typeof payload.preferred_username === "string"
            ? payload.preferred_username
            : typeof (payload.custom as Record<string, unknown> | undefined)?.preferred_username ===
                "string"
              ? String((payload.custom as Record<string, unknown>).preferred_username)
              : undefined;

    return { discordUserId, email, preferredUsername };
}

export function identityFromRequestHeaders(headers: {
    get(name: string): string | undefined;
}): AccessIdentity | null {
    const jwt =
        headers.get("cf-access-jwt-assertion") ||
        headers.get("Cf-Access-Jwt-Assertion") ||
        undefined;
    return identityFromAccessJwt(jwt);
}
