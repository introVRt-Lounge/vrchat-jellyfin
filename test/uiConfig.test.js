// Runtime UI config (run after `npx tsc`)
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
    buildUiConfig,
    parseUiTheme,
    discordChannelUrl,
    widgetbotEmbedUrl,
} = require("../dist/webserver/uiConfig");

describe("buildUiConfig", () => {
    it("hides Discord when guild or channel missing", () => {
        assert.equal(buildUiConfig({}).discord, null);
        assert.equal(buildUiConfig({ DISCORD_GUILD_ID: "111" }).discord, null);
        assert.equal(buildUiConfig({ DISCORD_CHANNEL_ID: "222" }).discord, null);
        assert.equal(
            buildUiConfig({ DISCORD_GUILD_ID: "  ", DISCORD_CHANNEL_ID: "222" }).discord,
            null,
        );
    });

    it("exposes Discord when both IDs set", () => {
        const cfg = buildUiConfig({
            DISCORD_GUILD_ID: "1103814778616557638",
            DISCORD_CHANNEL_ID: "1523973372285816943",
        });
        assert.deepEqual(cfg.discord, {
            guildId: "1103814778616557638",
            channelId: "1523973372285816943",
        });
    });

    it("defaults theme to default; accepts lounge", () => {
        assert.equal(buildUiConfig({}).theme, "default");
        assert.equal(buildUiConfig({ UI_THEME: "lounge" }).theme, "lounge");
        assert.equal(buildUiConfig({ UI_THEME: "LOUNGE" }).theme, "lounge");
        assert.equal(parseUiTheme("nope"), "default");
    });
});

describe("Discord Widgetbot URLs", () => {
    const guild = "1103814778616557638";
    const channel = "1523973372285816943";

    it("builds Widgetbot embed URL", () => {
        assert.equal(
            widgetbotEmbedUrl(guild, channel),
            "https://e.widgetbot.io/channels/1103814778616557638/1523973372285816943",
        );
    });

    it("builds Discord deep link", () => {
        assert.equal(
            discordChannelUrl(guild, channel),
            "https://discord.com/channels/1103814778616557638/1523973372285816943",
        );
    });
});
