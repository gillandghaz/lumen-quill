import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

describe("dependency pins", () => {
  // firebase-admin -> jwks-rsa require()s jose. jose 6 is ESM-only and the Vercel runtime refuses
  // `require()` of it (ERR_REQUIRE_ESM, every API route answered 500). package.json pins jose 5 via overrides.
  it("keeps jose on the CommonJS-compatible 5.x line", () => {
    const pkg = JSON.parse(readFileSync(require.resolve("jose/package.json"), "utf8")) as { version: string };
    expect(pkg.version.startsWith("5.")).toBe(true);
  });
});
