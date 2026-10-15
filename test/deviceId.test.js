const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { resolveJellyfinDeviceId } = require("../dist/jellyfin/deviceId.js");

describe("resolveJellyfinDeviceId", () => {
    it("defaults to jellyfin-vrchat when unset or blank", () => {
        assert.equal(resolveJellyfinDeviceId({}), "jellyfin-vrchat");
        assert.equal(resolveJellyfinDeviceId({ JELLYFIN_DEVICE_ID: "" }), "jellyfin-vrchat");
        assert.equal(resolveJellyfinDeviceId({ JELLYFIN_DEVICE_ID: "   " }), "jellyfin-vrchat");
    });

    it("uses trimmed JELLYFIN_DEVICE_ID when set", () => {
        assert.equal(
            resolveJellyfinDeviceId({ JELLYFIN_DEVICE_ID: " jellyfin-vrchat-dev " }),
            "jellyfin-vrchat-dev",
        );
    });
});
