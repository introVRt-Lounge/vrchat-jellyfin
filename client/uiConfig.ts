/** Client-side mirror of public /config (types + fetch). */

export type UiTheme = 'default' | 'lounge';

export interface StreamDurationOption {
  id: string;
  label: string;
  hours: number;
  extended: boolean;
}

export interface UiConfig {
  theme: UiTheme;
  discord: {
    guildId: string;
    channelId: string;
  } | null;
  movieRequestsEnabled: boolean;
  streamUrlDurations: StreamDurationOption[];
  streamUrlDefaultHours: number;
  streamUrlExtendedRoleGated: boolean;
  ociHlsFanoutEnabled: boolean;
  ociHlsMaxSeconds: number;
}

export const DEFAULT_UI_CONFIG: UiConfig = {
  theme: 'default',
  discord: null,
  movieRequestsEnabled: false,
  streamUrlDurations: [{ id: '24h', label: '24 hours', hours: 24, extended: false }],
  streamUrlDefaultHours: 24,
  streamUrlExtendedRoleGated: false,
  ociHlsFanoutEnabled: false,
  ociHlsMaxSeconds: 120,
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
    const movieRequestsEnabled = Boolean(data.movieRequestsEnabled);
    const streamUrlDurations = Array.isArray(data.streamUrlDurations)
      ? data.streamUrlDurations.filter(
          (d): d is StreamDurationOption =>
            !!d &&
            typeof d.id === 'string' &&
            typeof d.label === 'string' &&
            typeof d.hours === 'number',
        )
      : DEFAULT_UI_CONFIG.streamUrlDurations;
    const streamUrlDefaultHours =
      typeof data.streamUrlDefaultHours === 'number'
        ? data.streamUrlDefaultHours
        : DEFAULT_UI_CONFIG.streamUrlDefaultHours;
    const streamUrlExtendedRoleGated = Boolean(data.streamUrlExtendedRoleGated);
    const ociHlsFanoutEnabled = Boolean(data.ociHlsFanoutEnabled);
    const ociHlsMaxSeconds =
      typeof data.ociHlsMaxSeconds === 'number'
        ? data.ociHlsMaxSeconds
        : DEFAULT_UI_CONFIG.ociHlsMaxSeconds;
    return {
      theme,
      discord,
      movieRequestsEnabled,
      streamUrlDurations:
        streamUrlDurations.length > 0
          ? streamUrlDurations
          : DEFAULT_UI_CONFIG.streamUrlDurations,
      streamUrlDefaultHours,
      streamUrlExtendedRoleGated,
      ociHlsFanoutEnabled,
      ociHlsMaxSeconds,
    };
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
