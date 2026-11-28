import type { ReactNode } from "react";

/**
 * Mirror of the text being typed, with **bold** and *italic* (or _italic_) shown live. Every character of the
 * source is kept, in the same place, so the transparent <textarea> on top lines up exactly:
 * - markers stay in the text but look small and faint (a visual scale that does not change their width);
 * - bold is a thicker stroke (same glyph widths);
 * - italic slants each word with a transform (inline-block, so its width and the line breaks between words stay
 *   exactly those of the textarea). A font-based slant is not reliable: browsers skip synthetic oblique for some
 *   variable fonts, and a real italic face has different widths.
 */
export function LiveText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /(\*\*)([^*\n]+?)(\*\*)|(\*)([^*\n]+?)(\*)|(?<![\w])(_)([^_\n]+?)(_)(?![\w])/g;
  let last = 0;
  let k = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const bold = m[1] !== undefined;
    const open = m[1] ?? m[4] ?? m[7] ?? "";
    const inner = m[2] ?? m[5] ?? m[8] ?? "";
    const close = m[3] ?? m[6] ?? m[9] ?? "";
    out.push(
      <span key={k++} className={bold ? "md-b" : "md-i"}>
        <span className="md-mark">{open}</span>
        {bold ? inner : inner.split(/(\s+)/).map((w, j) => (w === "" || /^\s+$/.test(w) ? w : <span key={j} className="md-iw">{w}</span>))}
        <span className="md-mark">{close}</span>
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  // A trailing newline needs a visible character to take up its line, like the textarea does.
  out.push("​");
  return <>{out}</>;
}
