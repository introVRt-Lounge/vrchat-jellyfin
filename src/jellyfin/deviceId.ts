/**
 * Jellyfin logs out existing sessions for the same user+DeviceId on login.
 * Prod and dev must not share a DeviceId or they invalidate each other.
 */
export function resolveJellyfinDeviceId(env: NodeJS.ProcessEnv = process.env): string {
    const raw = (env.JELLYFIN_DEVICE_ID || "").trim();
    return raw || "jellyfin-vrchat";
}
