const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
    allowsExtendedTtl,
    defaultTtlMs,
    maxTtlMs,
    resolveTtlMs,
    rolesFromAccessPayload,
    streamDurationOptions,
} = require("../dist/jellyfin/proxy/streamTtl");

describe("stream URL TTL helpers", () => {
    it("defaults to 24h and max at least default", () => {
        assert.equal(defaultTtlMs({}), 86400000);
        assert.ok(maxTtlMs({}) >= defaultTtlMs({}));
    });

    it("resolveTtlMs clamps to max and marks extended", () => {
        const env = { PROXY_TTL_MS: "86400000", PROXY_TTL_MAX_MS: String(7 * 86400000) };
        const week = resolveTtlMs(168, { allowExtended: true, env });
        assert.equal(week.extended, true);
        assert.equal(week.ttlMs, 168 * 3600000);

        const over = resolveTtlMs(720, { allowExtended: true, env });
        assert.equal(over.ttlMs, 7 * 86400000);
    });

    it("resolveTtlMs denies extended when not allowed", () => {
        const env = { PROXY_TTL_MS: "86400000" };
        const got = resolveTtlMs(168, { allowExtended: false, env });
        assert.equal(got.extended, false);
        assert.equal(got.ttlMs, 86400000);
    });

    it("streamDurationOptions includes 24h and filters by max", () => {
        const opts = streamDurationOptions({
            PROXY_TTL_MS: "86400000",
            PROXY_TTL_MAX_MS: String(3 * 86400000),
        });
        assert.ok(opts.some((o) => o.hours === 24 && !o.extended));
        assert.ok(opts.some((o) => o.hours === 72 && o.extended));
        assert.equal(
            opts.some((o) => o.hours === 168),
            false,
        );
    });

    it("allowsExtendedTtl when no role gate", () => {
        assert.equal(allowsExtendedTtl({ custom: { id: "1" } }, {}), true);
    });

    it("allowsExtendedTtl checks guild roles claim", () => {
        const env = {
            DISCORD_GUILD_ID: "1103814778616557638",
            STREAM_URL_EXTENDED_ROLE_IDS: "1104016475150352565",
        };
        const other = "1237830433203552276";
        const ok = {
            custom: { "roles:1103814778616557638": ["1104016475150352565", other] },
        };
        const no = { custom: { "roles:1103814778616557638": [other] } };
        assert.equal(allowsExtendedTtl(ok, env), true);
        assert.equal(allowsExtendedTtl(no, env), false);
        const roles = rolesFromAccessPayload(ok, env);
        assert.ok(roles.includes("1104016475150352565"));
        assert.ok(roles.includes(other));
    });
});
