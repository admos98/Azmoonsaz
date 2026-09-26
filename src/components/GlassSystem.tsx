/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GlassSystem — the SVG displacement-map definitions.
 *
 * Rendered once at app root via <GlassFilters />.
 *
 * ── What this is for ────────────────────────────────────────────────────
 * `.glx-refract` bends the background *behind* a surface at its edges, the
 * way a thick pane of glass does. This is a different effect from the lit rim
 * (`.glass-edge`), which only makes an edge *read* as lit — it changes no
 * pixels of the backdrop. Refraction is the half that was missing.
 *
 * It is applied only where a lens reads correctly: the hero panel, topbar
 * buttons and menu buttons. Content panels keep the rim and stay flat, because
 * a bent background under body text is a legibility problem, not a polish win.
 *
 * ── Browser support — read this before changing anything ─────────────────
 * `backdrop-filter: url(#…)` is CHROMIUM ONLY.
 *
 *   Chromium  refraction, as designed
 *   Safari    the entire declaration is INVALID and DROPPED — not a fallback
 *             to blur, an absence of any backdrop filter at all
 *   Firefox   unreliable; renders inconsistently between versions
 *
 * Because Safari drops the declaration outright, `.glx-refract` must never be
 * the ONLY thing giving a surface its glass. The utility therefore keeps
 * `blur()` and `saturate()` in a base rule and layers the `url()` on top under
 * `@supports`. Safari keeps the blur; Chromium adds the bend. Both read as
 * deliberate glass. This is the whole reason for the split — a rule that only
 * works in one engine cannot own a surface's appearance.
 *
 * ── Why the map is built from two images, not one ────────────────────────
 * feDisplacementMap reads a single in2 image and uses R for horizontal offset
 * and G for vertical offset. So the map must carry TWO independent directions.
 * A single grayscale gradient cannot: if R and G hold the same value the shift
 * is always diagonal, which pinches the corners instead of bending the edges.
 *
 * So the map is composed from one horizontal gradient and one vertical one,
 * each reduced to a single channel by feColorMatrix, then added together with
 * feComposite. Result: R = horizontal offset, G = vertical offset, both
 * neutral (50% grey) through the middle and extreme only at the rim.
 *
 * A flat black/white gradient — the obvious first attempt — is not a lens. Its
 * center sits at R=1, so the interior displaces by 0.5 × scale instead of 0,
 * and the whole panel slides sideways. Neutral MUST be 50% grey.
 *
 * ── primitiveUnits ──────────────────────────────────────────────────────
 * objectBoundingBox makes every number inside the filter a fraction of the
 * ELEMENT'S OWN SIZE rather than a pixel count. That is what lets one filter
 * serve a 40px button and a 700px hero panel: scale="0.1" means "displace by up
 * to 5% of this element's own width" on both. It is also why scale must stay
 * under ~0.3 — a larger fraction shatters the image instead of bending it.
 */
import { CSSProperties } from 'react';

/**
 * GlassFilters
 * Injects the SVG filter definitions used by `.glx-refract`. Must be mounted
 * once, anywhere in the React tree.
 */

/** The displacement map, as a standalone SVG data URI.
 *
 *  Grey is neutral (no shift). Black pulls the backdrop in from the left/top,
 *  white pushes it out toward the right/bottom. The 18% flat shoulders are the
 *  thickness of the glass edge: outside them the shift ramps hard, inside them
 *  the pane is optically flat and the content behind it stays readable.
 */
const map = (dir: 'x' | 'y') => {
  const a = dir === 'x' ? `x1='0%25' y1='0%25' x2='100%25' y2='0%25'` : `x1='0%25' y1='0%25' x2='0%25' y2='100%25'`;
  const stops =
    dir === 'x'
      ? `<stop offset='0%25' stop-color='black'/>` +
        `<stop offset='18%25' stop-color='%23808080'/>` +
        `<stop offset='82%25' stop-color='%23808080'/>` +
        `<stop offset='100%25' stop-color='white'/>`
      : `<stop offset='0%25' stop-color='black'/>` +
        `<stop offset='18%25' stop-color='%23808080'/>` +
        `<stop offset='82%25' stop-color='%23808080'/>` +
        `<stop offset='100%25' stop-color='white'/>`;
  return (
    `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E` +
    `%3Cdefs%3E%3ClinearGradient id='g' ${a}%3E${stops}%3C/linearGradient%3E%3C/defs%3E` +
    `%3Crect width='100' height='100' fill='url(%23g)'/%3E%3C/svg%3E`
  );
};

const MAP_X = map('x');
const MAP_Y = map('y');

export function GlassFilters() {
  return (
    <svg
      className="lg-displace-filter"
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' } as CSSProperties}
    >
      <filter
        id="lg-lens"
        /* Oversized region so the displaced pixels are not clipped at the
           edges — the whole point of the filter is the edge, so a region
           tight to the box would trim away the only part you can see. */
        x="-30%"
        y="-30%"
        width="160%"
        height="160%"
        filterUnits="objectBoundingBox"
        primitiveUnits="objectBoundingBox"
        color-interpolation-filters="sRGB"
      >
        {/* Horizontal direction, isolated into the R channel. */}
        <feImage href={MAP_X} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="rawX" />
        <feColorMatrix
          in="rawX"
          type="matrix"
          values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
          result="dirX"
        />

        {/* Vertical direction, isolated into the G channel. */}
        <feImage href={MAP_Y} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="rawY" />
        <feColorMatrix
          in="rawY"
          type="matrix"
          values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
          result="dirY"
        />

        {/* Add the two directions into one RG map. Both operands are fully
            opaque, so 'over' is equivalent to 'arithmetic k2=1 k3=1' here and
            is far better supported. */}
        <feComposite in="dirX" in2="dirY" operator="over" result="lensMap" />

        <feDisplacementMap
          in="SourceGraphic"
          in2="lensMap"
          /* Fraction of the element's own size — see primitiveUnits above.
             0.14 puts the maximum shift at 7% of the panel's width, which is
             the most a backdrop can move before text behind it distorts. */
          scale="0.14"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
