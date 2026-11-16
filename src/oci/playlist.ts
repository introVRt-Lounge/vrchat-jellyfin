/**
 * OCI ObjectRead public URLs: path after `/o/` must use real `/` separators.
 * Encoding the whole key (`%2F`) breaks VLC and is painful for humans.
 * Encode each path segment individually so spaces/specials stay safe.
 */

/** Public GET URL for an object key (slash-separated path after /o/). */
export function publicObjectUrl(publicBase: string, objectKey: string): string {
    const base = publicBase.replace(/\/+$/, "");
    const parts = objectKey
        .replace(/^\/+|\/+$/g, "")
        .split("/")
        .filter(Boolean)
        .map((p) => encodeURIComponent(p));
    return `${base}/${parts.join("/")}`;
}

/**
 * Rewrite media playlist lines that name local segment files into absolute
 * Object Storage URLs under `prefix/` (prefix has no trailing slash).
 */
export function absolutizeHlsPlaylist(
    playlistText: string,
    publicBase: string,
    prefix: string,
): string {
    const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
    return playlistText
        .split(/\r?\n/)
        .map((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) return line;
            // Already absolute
            if (/^https?:\/\//i.test(trimmed)) return line;
            const fileName = trimmed.replace(/^\.\//, "").split("/").pop()!;
            const key = `${cleanPrefix}/${fileName}`;
            return publicObjectUrl(publicBase, key);
        })
        .join("\n");
}

/** Growing bake vs finished title — VRChat needs VOD+ENDLIST for scrub / start-at-0. */
export type HlsPublishPhase = "event" | "vod";

/**
 * Normalize HLS tags for VRChat:
 * - event: keep EVENT, add EXT-X-START:TIME-OFFSET=0 (version ≥ 6), no ENDLIST
 * - vod: PLAYLIST-TYPE:VOD + ENDLIST + START=0 so players treat it as seekable VOD
 */
export function shapeHlsPlaylistForPublish(
    playlistText: string,
    phase: HlsPublishPhase,
): string {
    const lines = playlistText.split(/\r?\n/);
    const out: string[] = [];
    let versionValue = 3;

    for (const line of lines) {
        const trimmed = line.trim();
        if (/^#EXT-X-VERSION:/i.test(trimmed)) {
            const n = Number(trimmed.split(":")[1]);
            if (Number.isFinite(n)) versionValue = Math.max(versionValue, n);
            continue;
        }
        if (/^#EXT-X-PLAYLIST-TYPE:/i.test(trimmed)) continue;
        if (/^#EXT-X-START:/i.test(trimmed)) continue;
        if (/^#EXT-X-ENDLIST$/i.test(trimmed)) continue;
        out.push(line);
    }

    // EXT-X-START requires protocol version 6.
    const headerTags = [
        `#EXT-X-VERSION:${Math.max(versionValue, 6)}`,
        phase === "vod" ? "#EXT-X-PLAYLIST-TYPE:VOD" : "#EXT-X-PLAYLIST-TYPE:EVENT",
        "#EXT-X-START:TIME-OFFSET=0",
    ];

    let extm3uAt = out.findIndex((l) => l.trim() === "#EXTM3U");
    if (extm3uAt < 0) {
        out.unshift("#EXTM3U");
        extm3uAt = 0;
    }
    out.splice(extm3uAt + 1, 0, ...headerTags);

    if (phase === "vod") {
        while (out.length && out[out.length - 1].trim() === "") out.pop();
        out.push("#EXT-X-ENDLIST");
    }

    return out.join("\n").replace(/\n+$/, "\n");
}
