# Capability stream URLs

Public `/v/:id` links are **capability URLs** (W3C TAG finding): possession of the URL is authorization to stream that item until expiry. They compensate for Cloudflare Access Bypass+Everyone on `/v/*` (required for VRChat bare HTTPS GET).

## Auth lifecycle

| Layer | What | Lifetime | After expiry |
|-------|------|----------|--------------|
| Capability id | Path segment `/v/{id}` (192-bit `crypto.randomBytes` / base64url) | **Per URL** at mint time (default `PROXY_TTL_MS` = 24h; admins may choose longer up to `PROXY_TTL_MAX_MS`) | **No refresh.** Remint via Access-gated `POST /i/:id` in the UI. |
| Jellyfin session | Server-side SDK token used when proxying | Managed by this process | Retried on startup; mint/stream return 503 until ready |

HMAC query params are **not** required: the path token already has high entropy. Optional HMAC would lengthen VRChat-pasted URLs without materially reducing enumeration risk.

## Choosing duration (mint UI)

The subtitle / mint modal offers a **URL lifetime** select (24h, 3d, 7d, 14d, 30d by default).

- Default selection = `PROXY_TTL_MS`.
- Longer options are stored on that capability record (`ttlMs` in the proxy store).
- Optional gate: set `STREAM_URL_EXTENDED_ROLE_IDS` to Discord role snowflakes (comma-separated). When set, minting beyond the default requires Access JWT claim `roles:<DISCORD_GUILD_ID>` to include one of those IDs. When unset, anyone who already passed Access may pick longer TTLs.
- Success UI shows **Expires …** — after that time `/v/:id` 404s; remint.

## Persistence

- File: `PROXY_STORE_PATH` (default `./data/proxies.json`)
- Each entry may include `ttlMs`; legacy rows without it use global `PROXY_TTL_MS`
- Survives container restart within that URL's TTL
- Mount a volume in compose so Watchtower recreates do not drop active links

## Operator env

```
PROXY_STORE_PATH=/data/proxies.json
PROXY_TTL_MS=86400000
PROXY_TTL_MAX_MS=2592000000
# Optional: restrict extended durations to these Discord role IDs
# STREAM_URL_EXTENDED_ROLE_IDS=1104016475150352565
DISCORD_GUILD_ID=
JELLYFIN_AUTH_RETRIES=30
JELLYFIN_AUTH_RETRY_MS=5000
```
