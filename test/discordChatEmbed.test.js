// Widgetbot URL contract (ChickCam pattern) - keep in sync with DiscordChatEmbed.tsx
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const GUILD_ID = '1103814778616557638';
const CHANNEL_ID = '1523973372285816943';

describe('Discord event chat embed URLs', () => {
  it('uses Widgetbot e.widgetbot.io channel embed', () => {
    const url = `https://e.widgetbot.io/channels/${GUILD_ID}/${CHANNEL_ID}`;
    assert.equal(url, 'https://e.widgetbot.io/channels/1103814778616557638/1523973372285816943');
  });

  it('deep link opens the same guild channel in Discord', () => {
    const url = `https://discord.com/channels/${GUILD_ID}/${CHANNEL_ID}`;
    assert.match(url, /1523973372285816943$/);
  });
});
