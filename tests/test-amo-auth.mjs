import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { checkAmoAuth } from "../scripts/check-amo-auth.mjs";
const guid = "test-addon@example";
const options = { issuer: "test-issuer", secret: "test-secret", guid };
const response = (results, next = null) => ({
  ok: true,
  json: async () => ({ results, next }),
});
let calls = 0;
await checkAmoAuth({
  ...options,
  fetchImpl: async (url, init) => {
    assert.equal(init.redirect, "error");
    const token = init.headers.Authorization.slice(4);
    const [header, payload, signature] = token.split(".");
    assert.equal(
      signature,
      createHmac("sha256", options.secret)
        .update(`${header}.${payload}`)
        .digest("base64url"),
    );
    const claims = JSON.parse(Buffer.from(payload, "base64url"));
    assert.equal(claims.iss, options.issuer);
    assert.equal(claims.exp - claims.iat, 60);
    calls += 1;
    return calls === 1
      ? response([], "https://addons.mozilla.org/api/v5/addons/addon/?page=2")
      : response([{ guid }]);
  },
});
assert.equal(calls, 2);
await assert.rejects(
  checkAmoAuth({
    ...options,
    secret: "",
    fetchImpl: () => assert.fail("No request without credentials"),
  }),
  /AMO_JWT_SECRET/,
);
await assert.rejects(
  checkAmoAuth({
    ...options,
    fetchImpl: async () => ({ ok: false, status: 401 }),
  }),
  /HTTP 401/,
);
await assert.rejects(
  checkAmoAuth({ ...options, fetchImpl: async () => response([]) }),
  /not an author/,
);
let unsafeCalls = 0;
await assert.rejects(
  checkAmoAuth({
    ...options,
    fetchImpl: async () => {
      unsafeCalls++;
      return response([], "https://other.example/");
    },
  }),
  /pagination/,
);
assert.equal(
  unsafeCalls,
  1,
  "Credentials must not follow pagination to another origin.",
);
console.log(
  "AMO auth checks passed: JWT signing, pagination, ownership, missing credentials, and HTTP failures.",
);
