import React from 'react';

/** IntroVRt Lounge - event management channel (Widgetbot, same pattern as ChickCam). */
export const DISCORD_GUILD_ID = '1103814778616557638';
export const DISCORD_EVENT_CHANNEL_ID = '1523973372285816943';

export function discordChannelUrl(
  guildId: string = DISCORD_GUILD_ID,
  channelId: string = DISCORD_EVENT_CHANNEL_ID,
): string {
  return `https://discord.com/channels/${guildId}/${channelId}`;
}

export function widgetbotEmbedUrl(
  guildId: string = DISCORD_GUILD_ID,
  channelId: string = DISCORD_EVENT_CHANNEL_ID,
): string {
  return `https://e.widgetbot.io/channels/${guildId}/${channelId}`;
}

/**
 * Embedded Discord channel chat via Widgetbot (ChickCam pattern).
 * Requires WidgetBot invited to the guild and `/setup` run in the target channel.
 */
function DiscordChatEmbed() {
  const openUrl = discordChannelUrl();
  const embedUrl = widgetbotEmbedUrl();

  return (
    <section
      className="mt-10 rounded-lg border border-gray-700 bg-gray-800 overflow-hidden"
      aria-label="Discord event chat"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-700">
        <div>
          <h2 className="text-lg font-semibold text-white">Event chat</h2>
          <p className="text-sm text-gray-400">
            Ask admins about streams, mint issues, or anything else in this channel.
          </p>
        </div>
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-indigo-300 hover:text-indigo-200 underline underline-offset-2"
        >
          Open in Discord
        </a>
      </div>
      <iframe
        title="Discord event management chat"
        src={embedUrl}
        allow="clipboard-write; fullscreen"
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        className="w-full border-0 bg-[#2b2d31]"
        style={{ minHeight: 420, height: 'min(60vh, 560px)' }}
      />
    </section>
  );
}

export default DiscordChatEmbed;
