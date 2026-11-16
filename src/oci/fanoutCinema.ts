/**
 * Whether a fan-out job status is safe to paste into a VRChat cinema player.
 * `playable` means head-start EVENT HLS (live-edge, no scrub) — not movie-night ready.
 */
export function isFanoutCinemaReady(status: string | undefined | null): boolean {
    return String(status || "").toLowerCase() === "ready";
}
