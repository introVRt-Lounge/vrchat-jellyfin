/**
 * OCI ObjectRead URLs use /o/<url-encoded-key> where the whole key (including
 * slashes) is one path segment. Relative segment paths in an m3u8 therefore
 * break - rewrite to absolute public object URLs.
 */

/** Public GET URL for an object key (matches spike / Owncast ObjectRead shape). */
export function publicObjectUrl(publicBase: string, objectKey: string): string {
    const base = publicBase.replace(/\/+$/, "");
    return `${base}/${encodeURIComponent(objectKey)}`;
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
