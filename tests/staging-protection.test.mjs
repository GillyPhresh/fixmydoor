import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

process.env.STAGING_MODE = "true";
process.env.STAGING_BASIC_AUTH_USERNAME = "synthetic-reviewer";
process.env.STAGING_BASIC_AUTH_PASSWORD = "synthetic-staging-password-24chars";

const {
  assertStagingConfiguration,
  markHtmlNoIndex,
  stagingAccessMiddleware,
  stagingRobotsTxt,
} = await import("../server/staging.ts");

function runMiddleware({ path = "/", authorization } = {}) {
  const headers = new Map();
  let statusCode = 200;
  let body = "";
  let contentType = "";
  let calledNext = false;
  const req = { path, get: (name) => name.toLowerCase() === "authorization" ? authorization : undefined };
  const res = {
    setHeader: (name, value) => headers.set(name.toLowerCase(), value),
    status: (value) => { statusCode = value; return res; },
    type: (value) => { contentType = value; return res; },
    send: (value) => { body = value; return res; },
  };
  stagingAccessMiddleware(req, res, () => { calledNext = true; });
  return { headers, statusCode, body, contentType, calledNext };
}

test("staging mode requires independent Basic Auth credentials", () => {
  assert.doesNotThrow(() => assertStagingConfiguration());
  const original = process.env.STAGING_BASIC_AUTH_PASSWORD;
  delete process.env.STAGING_BASIC_AUTH_PASSWORD;
  assert.throws(() => assertStagingConfiguration(), /STAGING_BASIC_AUTH_USERNAME/);
  process.env.STAGING_BASIC_AUTH_PASSWORD = original;
});

test("staging blocks unauthenticated requests and sets privacy headers", () => {
  const response = runMiddleware({ path: "/admin" });
  assert.equal(response.statusCode, 401);
  assert.equal(response.calledNext, false);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive, nosnippet");
  assert.equal(response.headers.get("cache-control"), "no-store, no-cache, must-revalidate, private");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("www-authenticate"), /^Basic realm=/);
  assert.doesNotMatch(response.body, /synthetic-reviewer|synthetic-staging-password/);
});

test("valid staging Basic Auth grants access; Railway health remains checkable", () => {
  const auth = `Basic ${Buffer.from(`${process.env.STAGING_BASIC_AUTH_USERNAME}:${process.env.STAGING_BASIC_AUTH_PASSWORD}`).toString("base64")}`;
  assert.equal(runMiddleware({ path: "/", authorization: auth }).calledNext, true);
  const health = runMiddleware({ path: "/api/health" });
  assert.equal(health.calledNext, true);
  assert.equal(health.headers.get("x-robots-tag"), "noindex, nofollow, noarchive, nosnippet");
});

test("staging robots and rendered HTML prevent search indexing and verification inheritance", () => {
  assert.equal(stagingRobotsTxt(), "User-agent: *\nDisallow: /\n");
  const html = markHtmlNoIndex('<html><head><meta name="google-site-verification" content="staging-must-not-verify" /><meta name="robots" content="index, follow" /></head></html>');
  assert.match(html, /noindex, nofollow, noarchive, nosnippet/);
  assert.doesNotMatch(html, /google-site-verification|staging-must-not-verify|index, follow/);
});

test("Docker build accepts explicit staging analytics opt-out arguments", async () => {
  const dockerfile = await readFile(path.join(process.cwd(), "Dockerfile"), "utf8");
  assert.match(dockerfile, /ARG VITE_DISABLE_ANALYTICS=false/);
  assert.match(dockerfile, /ARG VITE_GA_MEASUREMENT_ID=/);
  assert.match(dockerfile, /RUN pnpm build/);
});
