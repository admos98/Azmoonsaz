/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CSS custom-property → URL extraction (DOM-free, unit-tested).
 *
 * WHY THIS EXISTS — the iPhone "no bend" root cause (2026-10-16):
 * glassController reads the plate URL from the computed `--page-plate`.
 * Some engines serialize a computed custom property with CSS escapes
 * applied: the field report's raw bytes show iOS Safari returning
 * `bg-d-light\.svg` — one literal backslash — while the deployed CSS (and
 * every desktop engine tested) carry the URL unescaped. The old extraction
 * took the backslash verbatim, and the WHATWG URL parser reads `\` in an
 * http(s) URL as a path separator — so EVERY request built from that string
 * (the svg <img>, the `.2x.webp` twin, the fetch⇒createImageBitmap rung)
 * went to a mangled path BEFORE the network: `img-err` on both <img> rungs,
 * `fetch-err` in the probe. The lab page bends on the SAME iPhone because
 * it never crosses the getComputedStyle boundary — it hardcodes the URL as
 * a string literal.
 *
 * cssUnescape decodes escapes per css-syntax-3 §4.3.7:
 *   `\.`  → `.`        (any non-hex char after `\` is literal)
 *   `\2e ` → `.`      (1–6 hex digits + one optional whitespace)
 *   `\\`  → `\`
 * Clean input is returned byte-identical, so engines whose serialization is
 * already unescaped (all desktop Chromium/WebKit/Firefox builds tested) are
 * unaffected.
 */

/** Decode CSS escape sequences in a serialized value. No-op when clean. */
export function cssUnescape(value: string): string {
  return value.replace(/\\(?:([0-9a-fA-F]{1,6})[ \t\n\r\f]?|([^\n\r\f]))/g, (_m, hex?: string, ch?: string) => {
    if (hex !== undefined) {
      const code = parseInt(hex, 16);
      // U+0000 and out-of-range code points → U+FFFD (css-syntax-3 §4.3.7).
      return code === 0 || code > 0x10ffff ? '\ufffd' : String.fromCodePoint(code);
    }
    return ch ?? '';
  });
}

/** Extract the URL from a serialized `url(...)` value (quoted or unquoted),
 *  decoding CSS escapes — the computed-style round-trip on iOS escapes the
 *  value and the raw form is not a fetchable URL. Returns '' when the value
 *  carries no url(); the caller treats that as "no plate". */
export function plateURLFromComputed(value: string): string {
  const m = /url\((['"]?)(.*?)\1\)/.exec(value.trim());
  if (!m) return '';
  let url = cssUnescape(m[2]).trim();
  // Tolerance for engines that serialize the QUOTED form with escaped quotes
  // (`url(\"…\")`): group 2 then carries the quote characters — drop them once.
  if (
    url.length >= 2 &&
    ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'")))
  ) {
    url = url.slice(1, -1);
  }
  return url;
}
