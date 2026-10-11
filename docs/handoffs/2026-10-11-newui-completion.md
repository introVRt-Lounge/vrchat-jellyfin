# Handoff: bring HeroUI (landed `newui`) to full completion

**Date:** 2026-10-11  
**Host:** proxmox  
**Workspace:** `/home/heavygee/coding/vrchat-jellyfin` (on `master`; `newui` branch already merged)  
**Issue:** https://github.com/introVRt-Lounge/vrchat-jellyfin/issues/5  
**Prior work:** [#3](https://github.com/introVRt-Lounge/vrchat-jellyfin/issues/3) / [PR #4](https://github.com/introVRt-Lounge/vrchat-jellyfin/pull/4) closed — capability URLs + own GHCR + `newui` landed and deployed.

## Status you inherit

- Image in prod: `ghcr.io/introvrt-lounge/vrchat-jellyfin:master`
- Container `vrchat-jellyfin` Up; `healthz` ok / jellyfinReady
- HeroUI pages exist: Libraries, Library, TVShow, Season + SubtitleModal
- **Critical bug:** library `thumbnailUrl` points at `http://jellyfin:8096/...&api_key=...` — broken in browser + secret leak

## YOU OWN — finish the UI

1. Fix image proxy (no JF API key / no docker DNS hostnames in client-visible URLs)
2. Full Access UI walk + stream mint of a **real** item
3. Polish gaps (empty/error/loading, search/pagination, mobile)
4. README accuracy (shipped vs cast aspirational)
5. PR → tell operator before merge → GHCR → recreate container (protection workflow) → close #5

## NOT yours

- Cloudflare Access Bypass policy (orchestrator)
- Chromecast/Jellyfin-cast product endgame

## Kill criteria

Operator cancels #5, or thumbnails cannot be proxied without redesigning Jellyfin auth — escalate with evidence.
