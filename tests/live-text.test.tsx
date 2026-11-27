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
