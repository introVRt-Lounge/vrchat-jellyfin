import { readDiscordNotifyConfig } from "./discordNotify";
import { buildMovieRequestFeatureConfig } from "./featureConfig";
import { startMovieRequestPoller } from "./poller";
import { RadarrClient, readRadarrConfig } from "./radarrClient";
import { defaultRequestStorePath, MovieRequestStore } from "./requestStore";
import { mountMovieRequestRoutes } from "./routes";
import type express from "express";

export { buildMovieRequestFeatureConfig } from "./featureConfig";
export { identityFromAccessJwt, identityFromRequestHeaders } from "./accessIdentity";

export function initMovieRequests(app: express.Express): { stop: () => void } {
    const feature = buildMovieRequestFeatureConfig();
    const radarrCfg = readRadarrConfig();
    const discordCfg = readDiscordNotifyConfig();
    const radarr = radarrCfg ? new RadarrClient(radarrCfg) : null;
    const store = feature.enabled ? new MovieRequestStore(defaultRequestStorePath()) : null;

    mountMovieRequestRoutes(app, {
        enabled: feature.enabled,
        radarr,
        store,
        webhookUrl: discordCfg?.webhookUrl || null,
    });

    if (!feature.enabled || !radarr || !store || !discordCfg) {
        console.log("Movie requests disabled (need RADARR_URL, RADARR_API_KEY, DISCORD_REQUEST_READY_WEBHOOK_URL)");
        return { stop: () => undefined };
    }

    console.log(`Movie requests enabled; polling every ${feature.pollMs}ms`);
    const poller = startMovieRequestPoller({
        store,
        radarr,
        webhookUrl: discordCfg.webhookUrl,
        pollMs: feature.pollMs,
    });
    return poller;
}
