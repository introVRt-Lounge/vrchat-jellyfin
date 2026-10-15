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

## Prod discussion (not enabled)

User-facing options to discuss before prod:

1. **Explicit mint choice** - "Watch here" (proxy `/v/`) vs "Share with friends" (OCI fan-out, slower first paint)
2. **Auto fan-out** when mint TTL > N or party size hint
3. **Background bake** - return proxy URL immediately, swap to OCI playlist when ready

Prod must keep `OCI_HLS_PUBLISH` off until that UX is decided.
