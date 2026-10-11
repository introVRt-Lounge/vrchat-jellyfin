# Handoff: capability URLs + own GHCR + assess `newui`

**Date:** 2026-10-11  
**Host:** proxmox (checkout lives here — do not migrate unless operator asks)  
**Workspace:** `/home/heavygee/coding/vrchat-jellyfin`  
**Branch at handoff:** `newui` (dirty — see below)  
**GitHub issue:** https://github.com/introVRt-Lounge/vrchat-jellyfin/issues/3  
**Orchestrator:** Cursor session on `server-setup-worktrees/1011-a32b` — **stays on Cloudflare Access / ingress**. Do not expect that chat to implement app/image work.

## DONE (orchestrator)

- Enabled Issues on `introVRt-Lounge/vrchat-jellyfin`
- Opened issue **#3** with goals/test plan
- Confirmed Access: UI gated; `/v/*` Bypass+Everyone (intentional for VRChat bare GET)
- Sketched mint/verify design (crypto id + persist + expiry; optional HMAC)

## YOU OWN

1. **Assess `newui`** — large unreleased React/HeroUI UI + TV hierarchy + search + subtitle URL copy + local Docker/auth fixes vs `master`. Decide: land `newui` as base for this work, split PRs, or cherry-pick streaming-only onto `master`. Report recommendation in issue #3 before large merges.
2. **Capability / signed stream URLs** — harden `ProxyManager` / `/v/:id` / mint `POST /i/:id` per issue #3 (crypto ids, persist across restart, expiry).
3. **Own GHCR image** — ensure publish to `ghcr.io/introVRt-Lounge/vrchat-jellyfin` from this fork’s Actions; cut **server-setup** `compose/media/docker-compose.yml` off `ghcr.io/orcachillin/vrchat-jellyfin:master` onto our image; verify pull/deploy on proxmox (container protection workflow if recreate).
4. **Ship discipline** — feature branch, PR with Summary/Test plan/`Fixes #3`, green CI, **tell operator before merge**, deploy, branch cleanup. Do not force-push `master`.

## Dirty tree (do not lose / do not commit junk)

```
## newui
 M docker-compose.local.yml
 M src/jellyfin/client.ts
?? "agent chats/"
?? recovered_agent_chats/
```

- Inspect local mods; keep or discard deliberately.
- **Never commit** `agent chats/` or `recovered_agent_chats/` — add to `.gitignore` if needed.
- This handoff file may stay uncommitted or land under `docs/` if useful.

## Cloudflare (NOT yours)

Orchestrator keeps: Access Bypass accepted-risk docs, App Launcher visibility, ensure-script `self_hosted_domains` footgun, any Access policy changes. Coordinate only if deploy needs Access verification curls.

## Kill criteria

- Operator cancels issue #3
- Upstream-only path required and fork cannot publish GHCR (escalate with evidence)
- `newui` assessment shows merge would destroy prod without a plan — stop and ask

## Remotes

- `heavygee` → https://github.com/heavygee/vrchat-jellyfin.git (resolves to Lounge fork)
- `upstream` → https://github.com/introVRt-Lounge/vrchat-jellyfin.git  
Use **`gh` as heavygee**; org is IntroVRt Lounge.
