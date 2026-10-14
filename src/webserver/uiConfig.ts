/** Public UI config (no secrets). Served at GET /config for the Vite SPA. */

export type UiTheme = "default" | "lounge";

export interface UiConfig {
    theme: UiTheme;
    discord: {
        guildId: string;
        channelId: string;
    } | null;
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

    return {
        theme: parseUiTheme(env.UI_THEME),
        discord,
    };
}

export function discordChannelUrl(guildId: string, channelId: string): string {
    return `https://discord.com/channels/${guildId}/${channelId}`;
}

export function widgetbotEmbedUrl(guildId: string, channelId: string): string {
    return `https://e.widgetbot.io/channels/${guildId}/${channelId}`;
}
