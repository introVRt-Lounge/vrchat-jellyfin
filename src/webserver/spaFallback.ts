/**
 * Client-side React Router paths that must serve index.html on hard refresh.
 * Keep in sync with client/App.tsx routes. Do NOT include API prefixes
 * (/libraries, /tvshows, /seasons, /items, /v, /img, /api, …).
 */

const SPA_PATH =
    /^\/(library|tvshow|season)\/[^/]+\/?$/;

export function isSpaClientPath(pathname: string): boolean {
    if (!pathname) return false;
    // Strip query/hash if a full URL sneaks in
    const path = pathname.split("?")[0].split("#")[0];
    return SPA_PATH.test(path);
}
