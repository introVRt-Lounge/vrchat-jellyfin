import React, { useEffect, useState } from 'react';
import {
  discordChannelUrl,
  fetchUiConfig,
  widgetbotEmbedUrl,
  type UiConfig,
} from '../uiConfig';

/**
 * Embedded Discord channel chat via Widgetbot (ChickCam pattern).
 * Hidden unless GET /config returns both guild and channel IDs.
 * Requires WidgetBot invited to the guild and `/setup` run in the target channel.
 */
function DiscordChatEmbed() {
  const [config, setConfig] = useState<UiConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUiConfig().then((cfg) => {
      if (!cancelled) setConfig(cfg);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!config?.discord) {
    return null;
  }

  const { guildId, channelId } = config.discord;
  const openUrl = discordChannelUrl(guildId, channelId);
  const embedUrl = widgetbotEmbedUrl(guildId, channelId);

  return (
    <section
      className="lounge-panel mt-10 rounded-lg border border-gray-700 bg-gray-800 overflow-hidden"
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
          className="lounge-link text-sm text-indigo-300 hover:text-indigo-200 underline underline-offset-2"
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
