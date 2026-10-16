/**
 * cssUrl — the iOS computed-property escape round-trip.
 *
 * Field root cause (azmoon-perf-1792181900728, iPhone iOS 26.6): the
 * computed `--page-plate` serialized with a CSS dot-escape in the URL
 * (one literal backslash). Taken verbatim that is NOT a fetchable URL:
 * the WHATWG URL parser reads a backslash as a path separator, so every
 * plate request (svg img, .2x.webp twin, fetch to createImageBitmap)
 * went to a mangled path and the WebGL bend never landed. Decoding must
 * be exact; clean input passes through byte-identical (desktop engines).
 *
 * This test source deliberately contains ZERO literal backslashes —
 * backslashes are built at runtime via String.fromCharCode(92). The bug
 * being fixed WAS escape drift; a test for it must not depend on
 * escaping surviving an editor, a diff, or a formatter.
 */
import { describe, it, expect } from 'vitest';
import { cssUnescape, plateURLFromComputed } from '../../glass/cssUrl';

const BS = String.fromCharCode(92);

describe('cssUrl — computed custom-property URL extraction', () => {
  it('passes clean serializations through byte-identical', () => {
    const clean = '/backgrounds/bg-d-light.svg';
    expect(cssUnescape(clean)).toBe(clean);
    expect(plateURLFromComputed(`url(${clean})`)).toBe(clean);
    expect(plateURLFromComputed(`url("${clean}")`)).toBe(clean);
    expect(plateURLFromComputed(`url('${clean}')`)).toBe(clean);
  });

  it('decodes the iOS dot-escape (field case, unquoted and quoted)', () => {
    const clean = '/backgrounds/bg-d-light.svg';
    const esc = '/backgrounds/bg-d-light' + BS + '.svg';
    expect(esc.length).toBe(clean.length + 1);
    expect(cssUnescape(esc)).toBe(clean);
    expect(plateURLFromComputed('url(' + esc + ')')).toBe(clean);
    expect(plateURLFromComputed('url("' + esc + '")')).toBe(clean);
  });

  it('decodes hex escapes per css-syntax-3 (whitespace terminator)', () => {
    expect(cssUnescape(BS + '2e ')).toBe('.');
    expect(cssUnescape('bg' + BS + '2e svg')).toBe('bg.svg');
    expect(cssUnescape(BS + '2E')).toBe('.');
  });

  it('decodes an escaped backslash and tolerates the fully-escaped quoted form', () => {
    expect(cssUnescape('a' + BS + BS + 'b')).toBe('a' + BS + 'b');
    // An engine that escaped the QUOTE characters too: group 2 then
    // carries the quote characters and they must be dropped once.
    const fully = 'url(' + BS + '"/a' + BS + '.svg' + BS + '")';
    expect(plateURLFromComputed(fully)).toBe('/a.svg');
  });

  it('returns empty for values with no url()', () => {
    expect(plateURLFromComputed('')).toBe('');
    expect(plateURLFromComputed('none')).toBe('');
    expect(plateURLFromComputed('url()')).toBe('');
  });

  it('handles multiple escapes in one URL', () => {
    expect(plateURLFromComputed('url(/a' + BS + '.b' + BS + '.svg)')).toBe('/a.b.svg');
  });
});
