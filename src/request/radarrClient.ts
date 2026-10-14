import fetch from "node-fetch";

export interface RadarrLookupHit {
    tmdbId: number;
    title: string;
    year: number | null;
    overview: string | null;
    posterUrl: string | null;
    alreadyInLibrary: boolean;
    hasFile: boolean;
}

export interface RadarrMovieStatus {
    id: number;
    tmdbId: number;
    title: string;
    hasFile: boolean;
}

export interface RadarrConfig {
    baseUrl: string;
    apiKey: string;
    qualityProfileId: number;
    rootFolder: string;
}

export function readRadarrConfig(env: NodeJS.ProcessEnv = process.env): RadarrConfig | null {
    const baseUrl = (env.RADARR_URL || "").trim().replace(/\/+$/, "");
    const apiKey = (env.RADARR_API_KEY || "").trim();
    if (!baseUrl || !apiKey) return null;

    const qualityProfileId = parseInt(env.RADARR_QUALITY_PROFILE_ID || "4", 10);
    const rootFolder = (env.RADARR_ROOT_FOLDER || "/data/movies").trim();
    if (!Number.isFinite(qualityProfileId) || qualityProfileId < 1) return null;
    if (!rootFolder) return null;

    return { baseUrl, apiKey, qualityProfileId, rootFolder };
}

function posterFromImages(images: unknown): string | null {
    if (!Array.isArray(images)) return null;
    const poster = images.find(
        (img) =>
            img &&
            typeof img === "object" &&
            (img as { coverType?: string }).coverType === "poster",
    ) as { remoteUrl?: string; url?: string } | undefined;
    const url = poster?.remoteUrl || poster?.url;
    return typeof url === "string" && url.startsWith("http") ? url : null;
}

export class RadarrClient {
    constructor(private readonly config: RadarrConfig) {}

    private headers(): Record<string, string> {
        return {
            "X-Api-Key": this.config.apiKey,
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": "vrchat-jellyfin-movie-request/1.0",
        };
    }

    private api(path: string): string {
        const p = path.startsWith("/") ? path : `/${path}`;
        return `${this.config.baseUrl}/api/v3${p}`;
    }

    async lookup(term: string, limit = 5): Promise<RadarrLookupHit[]> {
        const q = term.trim();
        if (!q) return [];

        const url = `${this.api("/movie/lookup")}?term=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: this.headers() });
        if (!res.ok) {
            throw new Error(`Radarr lookup failed (${res.status})`);
        }
        const data = (await res.json()) as Array<Record<string, unknown>>;
        if (!Array.isArray(data)) return [];

        return data.slice(0, Math.max(1, Math.min(limit, 10))).map((row) => {
            const tmdbId = Number(row.tmdbId) || 0;
            const title = typeof row.title === "string" ? row.title : "Unknown";
            const year = typeof row.year === "number" ? row.year : null;
            const overview = typeof row.overview === "string" ? row.overview : null;
            const alreadyInLibrary = typeof row.id === "number" && row.id > 0;
            const hasFile = Boolean(row.hasFile);
            return {
                tmdbId,
                title,
                year,
                overview,
                posterUrl: posterFromImages(row.images),
                alreadyInLibrary,
                hasFile,
            };
        }).filter((h) => h.tmdbId > 0);
    }

    async getByTmdbId(tmdbId: number): Promise<RadarrMovieStatus | null> {
        const url = `${this.api("/movie")}?tmdbId=${encodeURIComponent(String(tmdbId))}`;
        const res = await fetch(url, { headers: this.headers() });
        if (!res.ok) {
            throw new Error(`Radarr movie query failed (${res.status})`);
        }
        const data = (await res.json()) as Array<Record<string, unknown>>;
        if (!Array.isArray(data) || data.length === 0) return null;
        const row = data[0];
        return {
            id: Number(row.id) || 0,
            tmdbId: Number(row.tmdbId) || tmdbId,
            title: typeof row.title === "string" ? row.title : "Unknown",
            hasFile: Boolean(row.hasFile),
        };
    }

    /**
     * Lookup by tmdb id, then add+search (or trigger search if already present without file).
     */
    async requestMovie(tmdbId: number): Promise<{
        status: "added" | "already_present" | "already_available";
        movie: RadarrMovieStatus;
        title: string;
        year: number | null;
    }> {
        const existing = await this.getByTmdbId(tmdbId);
        if (existing?.hasFile) {
            return {
                status: "already_available",
                movie: existing,
                title: existing.title,
                year: null,
            };
        }
        if (existing && existing.id > 0) {
            await this.commandSearch([existing.id]);
            return {
                status: "already_present",
                movie: existing,
                title: existing.title,
                year: null,
            };
        }

        const lookupUrl = `${this.api("/movie/lookup")}?term=${encodeURIComponent(`tmdb:${tmdbId}`)}`;
        const lookupRes = await fetch(lookupUrl, { headers: this.headers() });
        if (!lookupRes.ok) {
            throw new Error(`Radarr tmdb lookup failed (${lookupRes.status})`);
        }
        const lookupData = (await lookupRes.json()) as Array<Record<string, unknown>>;
        if (!Array.isArray(lookupData) || lookupData.length === 0) {
            throw new Error("Movie not found in Radarr lookup");
        }
        const movieData = { ...lookupData[0] };
        const title = typeof movieData.title === "string" ? movieData.title : "Unknown";
        const year = typeof movieData.year === "number" ? movieData.year : null;

        movieData.rootFolderPath = this.config.rootFolder;
        movieData.qualityProfileId = this.config.qualityProfileId;
        movieData.monitored = true;
        movieData.minimumAvailability = "announced";
        movieData.addOptions = { searchForMovie: true, monitor: "movieOnly" };

        const addRes = await fetch(this.api("/movie"), {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify(movieData),
        });
        if (!addRes.ok) {
            const body = await addRes.text();
            throw new Error(`Radarr add failed (${addRes.status}): ${body.slice(0, 200)}`);
        }
        const added = (await addRes.json()) as Record<string, unknown>;
        const movie: RadarrMovieStatus = {
            id: Number(added.id) || 0,
            tmdbId: Number(added.tmdbId) || tmdbId,
            title: typeof added.title === "string" ? added.title : title,
            hasFile: Boolean(added.hasFile),
        };
        return { status: "added", movie, title: movie.title, year };
    }

    private async commandSearch(movieIds: number[]): Promise<void> {
        const res = await fetch(this.api("/command"), {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ name: "MoviesSearch", movieIds }),
        });
        if (!res.ok) {
            throw new Error(`Radarr search command failed (${res.status})`);
        }
    }
}
