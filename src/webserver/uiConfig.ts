/** Public UI config (no secrets). Served at GET /config for the Vite SPA. */

import { buildMovieRequestFeatureConfig } from "../request/featureConfig";
import {
    defaultTtlMs,
    extendedRoleIds,
    streamDurationOptions,
    type StreamDurationOption,
} from "../jellyfin/proxy/streamTtl";
import { buildOciHlsPublishConfig } from "../oci/config";

export type UiTheme = "default" | "lounge";

export interface UiConfig {
    theme: UiTheme;
    discord: {
        guildId: string;
        channelId: string;
    } | null;
    /** Empty-search movie request CTA (Radarr + Discord notify). */
    movieRequestsEnabled: boolean;
    /** Capability stream URL duration presets for the mint UI. */
    streamUrlDurations: StreamDurationOption[];
    streamUrlDefaultHours: number;
    /** When true, longer-than-default options need a Discord role (server enforces). */
    streamUrlExtendedRoleGated: boolean;
    /** Dev/spike: mint can publish HLS to OCI Object Storage for multi-viewer fan-out. */
    ociHlsFanoutEnabled: boolean;
    /** Bake cap advertised in the mint UI (0 = full title). */
    ociHlsMaxSeconds: number;
}

function cleanId(value: string | undefined): string {
    return (value || "").trim();
}

export function parseUiTheme(raw: string | undefined): UiTheme {
    const v = (raw || "").trim().toLowerCase();
    if (v === "lounge") return "lounge";
    return "default";
}

/**
 * Discord embed is shown only when both guild and channel IDs are set.
 * Defaults are intentionally empty so a generic deploy does not leak Lounge IDs.
 */
export function buildUiConfig(env: NodeJS.ProcessEnv = process.env): UiConfig {
    const guildId = cleanId(env.DISCORD_GUILD_ID);
    const channelId = cleanId(env.DISCORD_CHANNEL_ID);
    const discord =
        guildId && channelId ? { guildId, channelId } : null;

    const streamUrlDurations = streamDurationOptions(env);
    const streamUrlDefaultHours = Math.round(defaultTtlMs(env) / (60 * 60 * 1000));
    const oci = buildOciHlsPublishConfig(env);

    return {
        theme: parseUiTheme(env.UI_THEME),
        discord,
        movieRequestsEnabled: buildMovieRequestFeatureConfig(env).enabled,
        streamUrlDurations,
        streamUrlDefaultHours,
        streamUrlExtendedRoleGated: extendedRoleIds(env).length > 0,
        ociHlsFanoutEnabled: oci.enabled,
        ociHlsMaxSeconds: oci.maxSeconds,
    };
}

export function discordChannelUrl(guildId: string, channelId: string): string {
    return `https://discord.com/channels/${guildId}/${channelId}`;
}

export function widgetbotEmbedUrl(guildId: string, channelId: string): string {
    return `https://e.widgetbot.io/channels/${guildId}/${channelId}`;
}
