# OCI HLS fan-out on vrchat-dev (2026-10-15)

## Decision (secondary questions)

| Question | Spike answer |
| --- | --- |
| Raw `objectstorage…oraclecloud.com` URLs vs vanity | **Raw OCI URLs OK for fan-out testing.** VRChat already played them. Vanity (`cdn.` / `stream.` on introvrtlounge) is polish + Cloudflare cache control later - not required to prove multi-viewer. |
| Cloudflare role | **Access + DNS + Traefik TLS for the mint UI** (`vrchat-dev`). Media fan-out GETs hit Oracle Object Storage directly (same as Owncast). Optional later: CF proxy/CDN in front of object URLs if we want cache/WAF/vanity - kill-criteria if CF free tier rate-limits segment floods. |

## Dev host

- UI: `https://vrchat-dev.introvrtlounge.com/` (Cloudflare Access, same email allowlist as prod)
- Compose: `vrchat-jellyfin-dev` in `server-setup/compose/media` (local image `vrchat-jellyfin:oci-hls-dev`, Watchtower off)
- Env: `~/.config/vrchat-jellyfin/oci-s3.env` with `OCI_HLS_PUBLISH=1` (prod compose must not mount this)
- Access ensure: `python3 scripts/cloudflare-access-ensure-apps.py --app vrchat-dev`

## App

- Feature flag: `OCI_HLS_PUBLISH` + S3 Customer Secret Key
- API: `POST /i/:id/fanout` → `{ playlistUrl, prefix, segmentCount, maxSeconds }`
- Mint UI checkbox when `ociHlsFanoutEnabled`
- Default bake cap: `OCI_HLS_MAX_SECONDS=90` (0 = full title)

## Verified mint (2026-10-15)

Item `928c89dc08e43d37da94a28e60106109` ("...All the Marbles"), 90s bake, 14 segments:

`https://objectstorage.us-ashburn-1.oraclecloud.com/n/idzn4iwfwrfa/b/owncast/o/vrchat-fanout%2F928c89dc08e43d37da94a28e60106109%2F20261015T095407Z-2bf8e331%2Findex.m3u8`

Bucket lifecycle still deletes after ~1 day (`ditch_stream_chunks`).

## PR

https://github.com/introVRt-Lounge/vrchat-jellyfin/pull/26 (Fixes #25)
