/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GlassSystem — Liquid Glass SVG filters + sheen utility wrapper.
 *
 * Rendered once at app root via <GlassFilters />.
 * The displacement map creates the lens-bend refraction that
 * distinguishes liquid glass from plain backdrop-blur.
 */

import React from 'react';

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
      <filter id="lg-displace" x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
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
        <feBlend
          mode="normal"
          in="bent"
          in2="SourceGraphic"
        />
      </filter>
    </svg>
  );
}

/**
 * GlassSheen — wraps children in a div that responds to pointer
 * movement with a dynamic specular highlight (the "wet" slide of light
 * across the glass surface).
 *
 * Zero JS re-renders: uses CSS custom properties updated by a single
 * pointermove listener attached to the element.
 */
export function GlassSheen({ children }: { children: React.ReactNode }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSheen = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      rafRef.current = requestAnimationFrame(() => {
        el.style.setProperty('--lg-sheen-x', `${x}%`);
        el.style.setProperty('--lg-sheen-y', `${y}%`);
      });
    };

    el.addEventListener('mousemove', updateSheen);
    return () => {
      el.removeEventListener('mousemove', updateSheen);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="glx-sheen">
      {children}
    </div>
  );
}
