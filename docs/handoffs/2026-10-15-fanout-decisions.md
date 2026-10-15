# Fan-out decisions (operator lock, 2026-10-15)

## Locked

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Prod mint UX | Explicit question: **Just you and a friend, or a group (3+)?** Plus a collapsed explainer + flow diagram of why it matters. |
| 2 | Dev bake length | Keep **clip cap** (`OCI_HLS_MAX_SECONDS`, ~90s) in dev. |
| 3 | Multi-host encode + publish | **Worker-side OCI upload** - the worker that baked also uploads; app returns the playlist URL. No shared NFS required for Fanout. |
| 4 | Teemo worker | **Yes** - silent background auto-start at boot (HAPI / old jessica-story class of mechanism). |
| 5 | Worker pick | Prefer **whoever is idle with capacity**. |
| 6 | Subtitles | **Required option** - must match current offering. |
| 7 | Vanity URL | **Yes** - subdomain in front of object origin. |
| 8 | Link lifetime | Fan-out: **~1 day**. Non-fan-out: existing mint TTL picker. |
| 9 | Prod gate | After **UX + load/quota** measures. |

## Mint UX framing (decision 1)

Utility is not "watch alone at home vs throw a party." Utility is:

> **Share a video link that lasts ~a day** so someone can go watch it - alone, with one friend, or with a group.

The mint question is therefore:

**Just you and a friend, or do you have a group (3+)?**

| Answer | Delivery | Why |
| --- | --- | --- |
| **Just you and a friend** (1–2 people) | Capability URL on our proxy (`/v/...`), TTL they already pick | Light path; one or two viewers through us is fine |
| **Group (3+)** | Fan-out bake → public OCI playlist (~1 day) | Encode once; many headsets do not multiply our egress/transcode |

Collapsed "why are you asking?" panel: short copy + a small flow diagram (1–2 viewers → proxy; 3+ → bake once → Oracle → N GETs).

## Worker-side upload (decision 3) - locked

Yes - the worker did the work; it can finish the job by uploading. We only need the **public playlist URL** back for the user.

What we have today:

| Piece | Status |
| --- | --- |
| Node S3 upload in the app (`src/oci/s3Upload.ts`) | Exists - used when app reads local files |
| `rclone` + `aws` CLI on proxmox | Present |
| Studio | ffmpeg + dffmpeg worker; **no** rclone/aws in PATH yet; NFS only for `/gallery` (wrong job) |
| Shared Fanout NFS | **Does not exist** (and we are not going to add it if workers upload) |

Plan: small worker helper (script or allowed binary) that: bake HLS locally → PUT objects to OCI (S3-compat) → print/return final playlist URL (or write a sidecar `result.json`). App submits that job, waits, returns URL. Studio/Teemo/homelab all work without a shared filesystem.

## Prod still off until

1. Mint UI with you+friend vs group 3+ + explainer/diagram  
2. Worker-side upload path live on at least homelab + studio  
3. Subtitles on fan-out  
4. Vanity subdomain  
5. Load/quota evidence  
6. Teemo worker when ready  
