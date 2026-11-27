import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("dependency pins", () => {
  // firebase-admin -> jwks-rsa require()s jose. jose 6 is ESM-only and the Vercel runtime refuses
  // `require()` of it (ERR_REQUIRE_ESM, every API route answered 500). package.json pins jose 5 via overrides.
  // (jose does not export its package.json; read the copy jwks-rsa actually resolves, nested or hoisted.)
  it("keeps jose on the CommonJS-compatible 5.x line", () => {
    const candidates = ["../node_modules/jwks-rsa/node_modules/jose/package.json", "../node_modules/jose/package.json"]
      .map((p) => fileURLToPath(new URL(p, import.meta.url)))
      .filter((f) => existsSync(f));
    expect(candidates.length).toBeGreaterThan(0);
    const { version } = JSON.parse(readFileSync(candidates[0]!, "utf8")) as { version: string };
    expect(version.startsWith("5.")).toBe(true);
  });

  it("declares the override in package.json", () => {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")) as { overrides?: Record<string, string> };
    expect(pkg.overrides?.["jose"]).toBe("5.10.0");
  });
});
