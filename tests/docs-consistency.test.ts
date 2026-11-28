import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const docs = ["README.md", "SECURITY.md", "CONTRIBUTING.md", "CHANGELOG.md", ...readdirSync(join(root, "docs")).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`)];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("documentation", () => {
  it("CHANGELOG starts with the package version", () => {
    const version = JSON.parse(read("package.json")).version as string;
    const first = read("CHANGELOG.md").match(/^## (\d+\.\d+\.\d+)/m)?.[1];
    expect(first).toBe(version);
  });

  it("every relative link and image points to an existing file", () => {
    const missing: string[] = [];
    for (const doc of docs) {
      const text = read(doc);
      const targets = [...text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g), ...text.matchAll(/src="([^"]+)"/g)].map((m) => m[1]!);
      for (const t of targets) {
        if (/^(https?:|mailto:)/.test(t)) continue;
        if (!existsSync(resolve(root, dirname(doc), t))) missing.push(`${doc} -> ${t}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("Api.md lists exactly the route files under app/api", () => {
    const routes = walk(join(root, "app", "api"))
      .filter((p) => p.endsWith("route.ts"))
      .map((p) => relative(join(root, "app", "api"), dirname(p)).split("\\").join("/"))
      .sort();
    const block = read("docs/Api.md").split("## Route files")[1] ?? "";
    const listed = (block.match(/```\n([\s\S]*?)```/)?.[1] ?? "").split("\n").map((l) => l.trim()).filter(Boolean).sort();
    expect(listed).toEqual(routes);
  });

  it("screenshots referenced by the docs exist, and every screenshot is used", () => {
    const images = readdirSync(join(root, "docs", "images"));
    const all = docs.map(read).join("\n");
    expect(images.filter((i) => !all.includes(i))).toEqual([]);
  });

  it("no personal identifiers of the owner in tracked documentation", () => {
    const all = docs.map(read).join("\n").toLowerCase();
    for (const s of ["gillandghaz", "gilland2015"]) expect(all.includes(s)).toBe(false);
  });
});
