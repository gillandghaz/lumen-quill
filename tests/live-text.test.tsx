import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LiveText } from "@/client/components/LiveText";

const html = (text: string) => renderToStaticMarkup(createElement(LiveText, { text }));
const plain = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");

describe("live formatting mirror", () => {
  // The mirror must contain exactly the typed characters, or the caret of the textarea on top would drift.
  for (const t of ["plain text", "a **bold** b", "*it* and **bo** and _u_", "**unclosed and *also", "line1\n**x**\n", "snake_case_name", "<script>x</script> & \"q\"", ""]) {
    it(`keeps every character: ${JSON.stringify(t)}`, () => {
      expect(plain(html(t))).toBe(`${t}​`);
    });
  }
  it("marks bold, italic and the markers", () => {
    const h = html("a **b** *i*");
    expect(h).toContain('<span class="md-b"><span class="md-mark">**</span>b<span class="md-mark">**</span></span>');
    expect(h).toContain('<span class="md-i"><span class="md-mark">*</span>i<span class="md-mark">*</span></span>');
  });
  it("never renders raw HTML", () => {
    expect(html("<b>x</b>")).not.toContain("<b>");
  });
});

describe("markdown renderer terminates on odd input", async () => {
  const { Markdown } = await import("@/client/components/Markdown");
  const odd = ["#", "# ", "####x", ">", " >x", "- ", "-", "1.", "1. ", "*", "**", "***bold***", "\n\n\n", "   ", "> a\n> b\n- c\n1. d\n# e\n\nf", "#\t", "x".repeat(5000)];
  for (const t of odd) {
    it(`renders ${JSON.stringify(t.slice(0, 20))}`, () => {
      expect(() => renderToStaticMarkup(createElement(Markdown, { text: t }))).not.toThrow();
    });
  }
});

describe("rate limiter local rules", async () => {
  const { RateLimiter, RULES } = await import("@/server/security/rate-limit");
  it("autosave is counted in memory, never in the shared (Firestore) store", async () => {
    let shared = 0;
    const store = { hit: async () => { shared++; return { count: 1, windowStart: 0 }; } };
    const rl = new RateLimiter(store, "s".repeat(32), () => 1000);
    for (let i = 0; i < 5; i++) await rl.hit("save", "u", RULES.save);
    expect(shared).toBe(0);
    await rl.hit("write", "u", RULES.write);
    expect(shared).toBe(1);
  });
});

describe("server profile cache", async () => {
  const { forgetProfile, getProfileCached } = await import("@/server/services/profile");
  it("reads Firestore once within 15 s and again after forgetting", async () => {
    let reads = 0;
    const db = { collection: () => ({ doc: () => ({ get: async () => { reads++; return { exists: true, data: () => ({ username: "u", email: "e@x.y", role: "user" }) }; } }) }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fake = db as any;
    await getProfileCached(fake, "uid-cache-test", 1_000);
    await getProfileCached(fake, "uid-cache-test", 10_000);
    expect(reads).toBe(1);
    await getProfileCached(fake, "uid-cache-test", 17_000);
    expect(reads).toBe(2);
    forgetProfile("uid-cache-test");
    await getProfileCached(fake, "uid-cache-test", 17_500);
    expect(reads).toBe(3);
  });
});
