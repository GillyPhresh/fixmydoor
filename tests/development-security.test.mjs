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
