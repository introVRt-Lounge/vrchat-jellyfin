import fs from "fs";
import path from "path";

export type MovieRequestStatus = "queued" | "available" | "notified";

export interface MovieRequestRecord {
    id: string;
    tmdbId: number;
    title: string;
    year: number | null;
    discordUserId: string;
    radarrId: number | null;
    status: MovieRequestStatus;
    createdAt: string;
    availableAt: string | null;
    notifiedAt: string | null;
}

interface StoreFile {
    version: 1;
    requests: MovieRequestRecord[];
}

function emptyStore(): StoreFile {
    return { version: 1, requests: [] };
}

export class MovieRequestStore {
    constructor(private readonly filePath: string) {}

    private read(): StoreFile {
        try {
            if (!fs.existsSync(this.filePath)) return emptyStore();
            const raw = fs.readFileSync(this.filePath, "utf8");
            const parsed = JSON.parse(raw) as StoreFile;
            if (!parsed || !Array.isArray(parsed.requests)) return emptyStore();
            return { version: 1, requests: parsed.requests };
        } catch {
            return emptyStore();
        }
    }

    private write(store: StoreFile): void {
        const dir = path.dirname(this.filePath);
        fs.mkdirSync(dir, { recursive: true });
        const tmp = `${this.filePath}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
        fs.renameSync(tmp, this.filePath);
    }

    listPending(): MovieRequestRecord[] {
        return this.read().requests.filter((r) => r.status === "queued" || r.status === "available");
    }

    findOpen(tmdbId: number, discordUserId: string): MovieRequestRecord | undefined {
        return this.read().requests.find(
            (r) =>
                r.tmdbId === tmdbId &&
                r.discordUserId === discordUserId &&
                (r.status === "queued" || r.status === "available"),
        );
    }

    add(input: {
        tmdbId: number;
        title: string;
        year: number | null;
        discordUserId: string;
        radarrId: number | null;
        status?: MovieRequestStatus;
    }): MovieRequestRecord {
        const store = this.read();
        const now = new Date().toISOString();
        const record: MovieRequestRecord = {
            id: `mr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            tmdbId: input.tmdbId,
            title: input.title,
            year: input.year,
            discordUserId: input.discordUserId,
            radarrId: input.radarrId,
            status: input.status || "queued",
            createdAt: now,
            availableAt: input.status === "available" || input.status === "notified" ? now : null,
            notifiedAt: input.status === "notified" ? now : null,
        };
        store.requests.push(record);
        // Cap growth
        if (store.requests.length > 500) {
            store.requests = store.requests.slice(-500);
        }
        this.write(store);
        return record;
    }

    markAvailable(id: string): MovieRequestRecord | null {
        const store = this.read();
        const row = store.requests.find((r) => r.id === id);
        if (!row) return null;
        if (row.status === "notified") return row;
        row.status = "available";
        row.availableAt = row.availableAt || new Date().toISOString();
        this.write(store);
        return row;
    }

    markNotified(id: string): MovieRequestRecord | null {
        const store = this.read();
        const row = store.requests.find((r) => r.id === id);
        if (!row) return null;
        row.status = "notified";
        row.availableAt = row.availableAt || new Date().toISOString();
        row.notifiedAt = new Date().toISOString();
        this.write(store);
        return row;
    }
}

export function defaultRequestStorePath(env: NodeJS.ProcessEnv = process.env): string {
    return (env.MOVIE_REQUEST_STORE_PATH || "").trim() ||
        path.join(path.dirname(env.PROXY_STORE_PATH || "./data/proxies.json"), "movie-requests.json");
}
