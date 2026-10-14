const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
    identityFromAccessJwt,
    decodeAccessJwtPayload,
} = require("../dist/request/accessIdentity");

function fakeJwt(payload) {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${header}.${body}.sig`;
}

describe("Access Discord identity", () => {
    it("reads custom.id snowflake", () => {
        const token = fakeJwt({
            email: "host@example.com",
            exp: Math.floor(Date.now() / 1000) + 3600,
            custom: { id: "123456789012345678" },
        });
        const id = identityFromAccessJwt(token);
        assert.equal(id?.discordUserId, "123456789012345678");
        assert.equal(id?.email, "host@example.com");
    });

    it("rejects expired tokens", () => {
        const token = fakeJwt({
            exp: Math.floor(Date.now() / 1000) - 10,
            custom: { id: "123456789012345678" },
        });
        assert.equal(identityFromAccessJwt(token), null);
    });

    it("rejects non-snowflake ids", () => {
        const token = fakeJwt({
            exp: Math.floor(Date.now() / 1000) + 3600,
            custom: { id: "not-a-discord-id" },
        });
        assert.equal(identityFromAccessJwt(token), null);
    });

    it("decodes payload segment", () => {
        const token = fakeJwt({ hello: "world" });
        assert.deepEqual(decodeAccessJwtPayload(token), { hello: "world" });
    });
});
