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
