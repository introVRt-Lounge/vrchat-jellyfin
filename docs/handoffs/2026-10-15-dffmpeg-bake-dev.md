# dffmpeg bake on vrchat-dev (2026-10-15)

## What shipped

`POST /i/:id/fanout` can bake via the estate dffmpeg bus when:

- `OCI_HLS_BAKE_MODE=dffmpeg`
- `DFFMPEG_COORDINATOR_URL` + `DFFMPEG_CLIENT_ID` + `DFFMPEG_HMAC_KEY` set
- Shared Fanout dir mounted at `/var/lib/dffmpeg/work`

Homelab worker advertises path `Fanout` (studio does not), so bake jobs stay on the proxmox GTX 1080 with `h264_nvenc`. Jellyfin source URLs are rewritten to `OCI_HLS_SOURCE_BASE` (host `127.0.0.1:8096`) so workers are not stuck on compose DNS.

Local ffmpeg-static remains the fallback when mode is unset or credentials incomplete.

## Secrets

`~/.config/vrchat-jellyfin/dffmpeg.env` (mode 0600) - not in git.

## Prod UX (locked framing; publish still off in prod)

Mint asks: **Just you and a friend (1–2), or a group (3+)?**

| Choice | Path |
| --- | --- |
| You + friend | Proxy `/v/…` + TTL picker |
| Group (3+) | OCI HLS fan-out (~1 day) |

Collapsed "why?" + ASCII flow diagram in the mint modal. See `2026-10-15-fanout-decisions.md`.

Prod must keep `OCI_HLS_PUBLISH` off until worker-side upload, subtitles, vanity, and load/quota land.
