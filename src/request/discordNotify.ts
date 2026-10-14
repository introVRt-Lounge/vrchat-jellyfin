import fetch from "node-fetch";

export interface DiscordNotifyConfig {
    webhookUrl: string;
}

export function readDiscordNotifyConfig(
    env: NodeJS.ProcessEnv = process.env,
): DiscordNotifyConfig | null {
    const webhookUrl = (env.DISCORD_REQUEST_READY_WEBHOOK_URL || "").trim();
    if (!webhookUrl.startsWith("https://discord.com/api/webhooks/")) return null;
    return { webhookUrl };
}

function escapeDiscord(text: string): string {
    return text.replace(/([\\_*`~|])/g, "\\$1");
}

export async function postMovieRequestQueued(opts: {
    webhookUrl: string;
    discordUserId: string;
    title: string;
    year: number | null;
}): Promise<void> {
    const label = opts.year ? `${opts.title} (${opts.year})` : opts.title;
    const content = `<@${opts.discordUserId}> requested **${escapeDiscord(label)}** — queued for the mint library.`;
    await postWebhook(opts.webhookUrl, content, opts.discordUserId);
}

export async function postMovieRequestReady(opts: {
    webhookUrl: string;
    discordUserId: string;
    title: string;
    year: number | null;
}): Promise<void> {
    const label = opts.year ? `${opts.title} (${opts.year})` : opts.title;
    const content = `<@${opts.discordUserId}> — **${escapeDiscord(label)}** is ready in the mint library.`;
    await postWebhook(opts.webhookUrl, content, opts.discordUserId);
}

async function postWebhook(webhookUrl: string, content: string, userId: string): Promise<void> {
    const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": "vrchat-jellyfin-movie-request/1.0",
        },
        body: JSON.stringify({
            content,
            allowed_mentions: { users: [userId] },
        }),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Discord webhook failed (${res.status}): ${body.slice(0, 200)}`);
    }
}
