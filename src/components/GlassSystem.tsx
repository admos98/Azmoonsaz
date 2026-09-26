/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GlassSystem — the SVG displacement-map definitions.
 *
 * Rendered once at app root via <GlassFilters />.
 *
 * Note: no backdrop-filter currently references url(#lg-displace), so this
 * filter is mounted but unused. The pointer sheen that used to live here
 * (GlassSheen, wrapping the whole routed page) was removed in Phase 2 — the
 * effect now belongs to floating surfaces via the `.glx-sheen` class, which
 * Topbar and Students apply directly.
 */

/**
 * GlassFilters
 * Injects the SVG filter definitions used by .glx / .glx-strong classes.
 * Must be mounted once, anywhere in the React tree (rendered to DOM).
 * The filters are referenced via url(#lg-displace) in index.css.
 */
export function GlassFilters() {
  return (
    <svg
      className="lg-displace-filter"
      width="0"
      height="0"
      viewBox="0 0 40 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <filter
        id="lg-displace"
        x="-20%"
        y="-20%"
        width="140%"
        height="140%"
        filterUnits="objectBoundingBox"
        primitiveUnits="objectBoundingBox"
        color-interpolation-filters="sRGB"
      >
        {/* Horizontal edge displacement (left edge bends right, right edge bends left) */}
        <feImage
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cdefs%3E%3ClinearGradient id='h' x1='0%25' y1='0%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' stop-color='black'/%3E%3Cstop offset='8%25' stop-color='white'/%3E%3Cstop offset='92%25' stop-color='white'/%3E%3Cstop offset='100%25' stop-color='black'/%3E%3C/linearGradient%3E%3Cdefs%3E%3Crect width='40' height='40' fill='url(%23h)'/%3E%3C/svg%3E"
          x="0"
          y="0"
          width="40"
          height="40"
          result="displaceMap"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="displaceMap"
          scale="14"
          xChannelSelector="R"
          yChannelSelector="G"
          result="bent"
        />
        <feBlend mode="normal" in="bent" in2="SourceGraphic" />
      </filter>
    </svg>
  );
}
