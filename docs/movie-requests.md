# Movie requests

On **Movies** libraries, after a library search finishes, a quiet **Request** control appears at the **bottom of the results** (after Load more) - never under the search box.

## Flow

1. Search the library first.
2. Scroll past results / Load more; if needed, edit the title and hit **Request**.
3. Confirm pick (title / year / poster only) via Radarr lookup.
4. Server queues Radarr add+search (same quality profile / root folder defaults as Requestrr).
5. Opaque ack in UI; channel webhook posts `@user requested Title — queued…`.
6. Poller watches Radarr `hasFile`; when true, webhook posts `@user — Title is ready…`.

The panel only shows once a search query is active and the search is not in flight.

Requestrr stays the Discord slash-command front door. This path talks to **Radarr** directly.

## Env (all required to enable)

| Variable | Purpose |
|----------|---------|
| `RADARR_URL` | e.g. `http://radarr:7878/radarr` |
| `RADARR_API_KEY` | Radarr API key |
| `RADARR_QUALITY_PROFILE_ID` | Default `4` (match Requestrr) |
| `RADARR_ROOT_FOLDER` | Default `/data/movies` |
| `DISCORD_REQUEST_READY_WEBHOOK_URL` | Channel webhook for queued + ready pings |
| `MOVIE_REQUEST_STORE_PATH` | Pending JSON store (default beside proxies.json) |
| `MOVIE_REQUEST_POLL_MS` | Poll interval (default 60000) |

Secrets must not be committed. On this estate they live in `~/.config/vrchat-jellyfin/movie-request.env` and are mounted via compose `env_file`.

## Identity

Requester Discord snowflake comes from Cloudflare Access JWT claim `custom.id` (Erisa Discord OIDC — add `id` under OIDC Claims on the IdP). Without it, lookup/request return 401.

## Auth lifecycle

- Access JWT: short-lived; user re-auths via Access login when expired. No app-side refresh.
- Webhook URL: long-lived secret; rotate in Discord channel integrations if leaked, then update `movie-request.env` and recreate the container.
- Radarr API key: rotate in Radarr UI; update env the same way.
