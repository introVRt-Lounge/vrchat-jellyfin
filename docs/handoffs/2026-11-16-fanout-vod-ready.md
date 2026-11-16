# Fan-out cinema-ready gate (issue #60)

## Playtest (Donnie Darko, Group 3+)

Mint worked; Stream mode eventually played; random start / no scrub / ~15s A/V lead matched progressive EVENT HLS handed out at `playable`.

## Fix

1. Mint UI waits for fan-out status `ready` before copy (not `playable`).
2. Published playlists shaped: EVENT+`EXT-X-START:TIME-OFFSET=0` while baking; VOD+ENDLIST+START on finalize.
3. README + modal copy: Stream mode; paste only when Ready.

## Falsify

Short clip, Group 3+, wait for Ready, paste once in VRChat Stream mode → should start near 0 with a timeline. If not, AVPro VOD HLS seek is the next suspect.
