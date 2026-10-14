import { RadarrClient } from "./radarrClient";
import { postMovieRequestReady } from "./discordNotify";
import { MovieRequestStore } from "./requestStore";

export function startMovieRequestPoller(opts: {
    store: MovieRequestStore;
    radarr: RadarrClient;
    webhookUrl: string;
    pollMs: number;
}): { stop: () => void } {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
        if (stopped) return;
        try {
            for (const row of opts.store.listPending()) {
                let current = row;
                if (current.status === "queued") {
                    const movie = await opts.radarr.getByTmdbId(current.tmdbId);
                    if (movie?.hasFile) {
                        const updated = opts.store.markAvailable(current.id);
                        if (updated) current = updated;
                    }
                }
                if (current.status === "available") {
                    await postMovieRequestReady({
                        webhookUrl: opts.webhookUrl,
                        discordUserId: current.discordUserId,
                        title: current.title,
                        year: current.year,
                    });
                    opts.store.markNotified(current.id);
                }
            }
        } catch (err) {
            console.error("movie request poller error:", err);
        } finally {
            if (!stopped) {
                timer = setTimeout(() => void tick(), opts.pollMs);
            }
        }
    };

    timer = setTimeout(() => void tick(), Math.min(5_000, opts.pollMs));

    return {
        stop: () => {
            stopped = true;
            if (timer) clearTimeout(timer);
        },
    };
}
