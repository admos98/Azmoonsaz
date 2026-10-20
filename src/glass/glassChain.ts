/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CSS dress chain — extracted verbatim from glassController.ts. The per-
 * family blur/saturate recipe (chainOf), its inline apply, the shared SVG
 * <defs> container for the lens maps, and the data-layer gate. The defs
 * container is module state here; the engine clears it through
 * clearChainDefs() (pruneDead / teardown).
 */
import { cssNum } from './glassTokens';

/** Drawable class → css backdrop-filter chain. Same reads as
 *  paramsForWebgl (glassPipeline.ts) — keep the two in lockstep. */
export function chainOf(el: Element, cs: CSSStyleDeclaration): string {
  const lensBlur = cssNum(cs, '--lens-blur', 1);
  const sat = (v: number) => (v === 1 ? '' : ` saturate(${v})`);
  if (el.classList.contains('glx-strong'))
    return `blur(${cssNum(cs, '--glass-p-blur', 16).toFixed(2)}px)${sat(cssNum(cs, '--glass-p-sat', 1.5))}`;
  if (el.classList.contains('glx-dark')) return 'blur(10px) saturate(1.4)';
  if (el.classList.contains('glx'))
    return `blur(${cssNum(cs, '--glass-bg-blur', 8).toFixed(2)}px)${sat(cssNum(cs, '--glass-bg-sat', 1.5))}`;
  if (el.classList.contains('lens')) {
    if (el.classList.contains('lens--menu'))
      return `blur(${cssNum(cs, '--lens-menu-blur', 3).toFixed(2)}px)${sat(cssNum(cs, '--lens-menu-sat', 1.4))}`;
    return `blur(${lensBlur.toFixed(2)}px)`;
  }
  if (el.classList.contains('pane')) return `blur(${(lensBlur * 2).toFixed(2)}px)`;
  if (el.classList.contains('drop')) return `blur(${cssNum(cs, '--drop-blur', 0.5).toFixed(2)}px)`;
  return `blur(${lensBlur.toFixed(2)}px)`;
}

/** Shared <defs> host for every displacement/specular data-URI filter. */
let container: SVGDefsElement | null = null;

export function ensuredContainer(): SVGDefsElement {
  if (container && document.contains(container)) return container;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('style', 'position:absolute;width:0;height:0');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);
  container = defs;
  return container;
}

/** Live defs lookup without creating (pruneDead is read-only). */
export function chainDefs(): SVGDefsElement | null {
  return container;
}

/** Drop the defs container (recycled only on a dead-prune / teardown). */
export function clearChainDefs(): void {
  container?.remove();
  container = null;
}

export function applyChain(el: HTMLElement, chain: string): void {
  if (el.style.backdropFilter !== chain) el.style.backdropFilter = chain;
}

export function glassAllowed(): boolean {
  const root = document.documentElement;
  return root.dataset.lens === 'on' && root.dataset.glass !== 'lite' && root.dataset.glass !== 'off';
}
