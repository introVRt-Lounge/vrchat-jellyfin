import { readDiscordNotifyConfig } from "./discordNotify";
import { readRadarrConfig } from "./radarrClient";

export interface MovieRequestFeatureConfig {
    enabled: boolean;
    pollMs: number;
}

export function buildMovieRequestFeatureConfig(
    env: NodeJS.ProcessEnv = process.env,
): MovieRequestFeatureConfig {
    const radarr = readRadarrConfig(env);
    const discord = readDiscordNotifyConfig(env);
    const enabled = Boolean(radarr && discord);
    const pollMs = Math.max(15_000, parseInt(env.MOVIE_REQUEST_POLL_MS || "60000", 10) || 60_000);
    return { enabled, pollMs };
}
