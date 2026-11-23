import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
test("Vite delegates sensitive APIs to Express without a fallback admin or tracking serializer", async () => {
  const source = await readFile("vite.config.ts", "utf8");
  assert.match(source, /"\/api": "http:\/\/127\.0\.0\.1:4179"/);
  assert.doesNotMatch(
    source,
    /admin123|Math\.random|findUnique|sessionId|booking\.find/
  );
});

test("built Express SPA serves private portal routes directly and keeps them out of search", async () => {
  const source = await readFile("server/index.ts", "utf8");
  for (const route of ["/admin/portals", "/portal", "/portal/login", "/portal/invite"]) {
    assert.ok(source.includes(`normalizedPath === "${route}"`), `${route} must be in the built client route allowlist`);
  }
  assert.ok(source.includes("portal(?:"));
  assert.ok(source.includes('req.path === "/portal"'));
  assert.ok(source.includes('req.path.startsWith("/portal/")'));
  assert.ok(source.includes('"noindex, nofollow, noarchive"'));
});
