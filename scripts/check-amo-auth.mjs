import { createHmac, randomUUID } from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export async function checkAmoAuth({
  issuer,
  secret,
  guid,
  fetchImpl = fetch,
}) {
  if (!issuer || !secret)
    throw new Error(
      "Add AMO_JWT_ISSUER and AMO_JWT_SECRET to GitHub Actions secrets.",
    );
  const base = "https://addons.mozilla.org/api/v5/";
  let next = `${base}addons/addon/?page_size=50`;
  const visited = new Set();
  while (next) {
    const url = new URL(next);
    if (
      url.origin !== "https://addons.mozilla.org" ||
      url.pathname !== "/api/v5/addons/addon/" ||
      visited.has(url.href)
    ) {
      throw new Error("Unexpected AMO pagination URL.");
    }
    visited.add(url.href);
    const now = Math.floor(Date.now() / 1000);
    const encode = (value) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ iss: issuer, jti: randomUUID(), iat: now, exp: now + 60 })}`;
    const signature = createHmac("sha256", secret)
      .update(unsigned)
      .digest("base64url");
    const response = await fetchImpl(url.href, {
      headers: { Authorization: `JWT ${unsigned}.${signature}` },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok)
      throw new Error(
        `AMO authentication/access check failed (HTTP ${response.status}).`,
      );
    const page = await response.json();
    if (!Array.isArray(page.results))
      throw new Error("Unexpected AMO add-on list response.");
    if (page.results.some((addon) => addon.guid === guid)) return;
    next = page.next;
  }
  throw new Error(
    "AMO credentials are valid, but this account is not an author of the configured add-on.",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const manifest = JSON.parse(
    fs.readFileSync("extension/manifest.json", "utf8"),
  );
  try {
    await checkAmoAuth({
      issuer: process.env.AMO_JWT_ISSUER,
      secret: process.env.AMO_JWT_SECRET,
      guid: manifest.browser_specific_settings.gecko.id,
    });
    console.log(
      "AMO credentials authenticate an author of the configured Firefox add-on. No version was uploaded.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
