// Kept for CI continuity; URL helpers live in uiConfig (see uiConfig.test.js)
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { widgetbotEmbedUrl, discordChannelUrl } = require("../dist/webserver/uiConfig");

const GUILD_ID = "1103814778616557638";
const CHANNEL_ID = "1523973372285816943";

describe("Discord event chat embed URLs", () => {
    it("uses Widgetbot e.widgetbot.io channel embed", () => {
        assert.equal(
            widgetbotEmbedUrl(GUILD_ID, CHANNEL_ID),
            "https://e.widgetbot.io/channels/1103814778616557638/1523973372285816943",
        );
    });

    it("deep link opens the same guild channel in Discord", () => {
        assert.match(discordChannelUrl(GUILD_ID, CHANNEL_ID), /1523973372285816943$/);
    });
});
