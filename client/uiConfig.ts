/** Client-side mirror of public /config (types + fetch). */

export type UiTheme = 'default' | 'lounge';

export interface UiConfig {
  theme: UiTheme;
  discord: {
    guildId: string;
    channelId: string;
  } | null;
}

export const DEFAULT_UI_CONFIG: UiConfig = {
  theme: 'default',
  discord: null,
};

export function discordChannelUrl(guildId: string, channelId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}`;
}

export function widgetbotEmbedUrl(guildId: string, channelId: string): string {
  return `https://e.widgetbot.io/channels/${guildId}/${channelId}`;
}

export async function fetchUiConfig(): Promise<UiConfig> {
  try {
    const res = await fetch('/config');
    if (!res.ok) return DEFAULT_UI_CONFIG;
    const data = (await res.json()) as Partial<UiConfig>;
    const theme: UiTheme = data.theme === 'lounge' ? 'lounge' : 'default';
    const guildId = data.discord?.guildId?.trim() || '';
    const channelId = data.discord?.channelId?.trim() || '';
    const discord = guildId && channelId ? { guildId, channelId } : null;
    return { theme, discord };
  } catch {
    return DEFAULT_UI_CONFIG;
  }
}

export function applyUiTheme(theme: UiTheme): void {
  const root = document.documentElement;
  root.classList.add('dark');
  if (theme === 'lounge') {
    root.classList.add('theme-lounge');
    root.dataset.theme = 'lounge';
  } else {
    root.classList.remove('theme-lounge');
    root.dataset.theme = 'default';
  }
}
