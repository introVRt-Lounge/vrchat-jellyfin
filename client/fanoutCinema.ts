/**
 * Keep in sync with src/oci/fanoutCinema.ts — only `ready` (VOD + ENDLIST) is
 * safe to paste into a VRChat cinema player. `playable` is live-edge EVENT HLS.
 */
export function isFanoutCinemaReady(status: string | undefined | null): boolean {
  return String(status || '').toLowerCase() === 'ready';
}
