/**
 * Cascade probe — which rule actually wins the `border` on a .glx surface?
 *
 * The declaration is correct in source and in the built CSS, and all three
 * tokens resolve on the element, yet the computed border comes back
 * `1px solid rgba(0,0,0,0)`. Guessing at the cause has already cost two wrong
 * answers, so read the cascade directly: CDP reports every matching rule with
 * its layer and origin, in cascade order.
 *
 *   node audit-cascade.cjs
 */
// Run from the project root so playwright resolves from node_modules.
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.BASE || 'https://azmoon-three.vercel.app/teacher/dashboard';
const SELECTOR = process.env.SEL || '.glx-strong';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    // The glass surfaces only exist behind auth; without the saved session this
    // lands on the login page and every selector misses.
    storageState: fs.existsSync('audit-state.json') ? 'audit-state.json' : undefined,
  });
  const page = await ctx.newPage();
  const cdp = await page.context().newCDPSession(page);
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);

  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: SELECTOR });
  if (!nodeId) throw new Error(`no match for ${SELECTOR}`);

  const { matchedCSSRules, inlineStyle, computedStyle } =
    await cdp.send('CSS.getMatchedStylesForNode', { nodeId });

  console.log(`\n=== ${SELECTOR} — border rules, in cascade order ===`);
  matchedCSSRules.forEach((m, i) => {
    const decls = m.rule.style.cssProperties.filter(
      (p) => p.name.startsWith('border') || p.name === 'all',
    );
    if (!decls.length) return;
    const layer = m.rule.origin;
    console.log(`\n[${i}] ${JSON.stringify(m.matchingSelectors)}   (${layer})`);
    for (const p of decls)
      console.log(`      ${p.name}: ${p.value}${p.disabled ? '  [DISABLED]' : ''}${p.parsedOk === false ? '  [PARSE-FAIL]' : ''}`);
  });

  console.log('\n=== winner detail: last rule that sets border-color ===');
  matchedCSSRules.forEach((m) => {
    const d = m.rule.style.cssProperties.find((p) => p.name === 'border-color');
    if (d) console.log(`  ${JSON.stringify(m.matchingSelectors)}\n      value: ${d.value}\n      source: ${(m.rule.style.cssText||'').slice(0,200)}`);
  });

  console.log('\n=== inline style on the element ===');
  console.log(
    (inlineStyle.cssProperties || [])
      .map((p) => `${p.name}: ${p.value}`)
      .join('\n') || '(none)',
  );

  console.log('\n=== computed ===');
  for (const p of computedStyle.filter((p) => p.name.startsWith('border')))
    console.log(`      ${p.name}: ${p.value}`);

  // The element's own custom-property values, read from CSSOM not getComputedStyle,
  // to rule out a token being redefined on a nearer selector.
  const tokens = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const out = {};
    for (const k of ['--glass-p-bw', '--glass-p-ba', '--glass-p-bc']) {
      let n = el, chain = [];
      while (n && n.nodeType === 1) {
        const v = getComputedStyle(n).getPropertyValue(k).trim();
        if (v) chain.push(`${n.tagName.toLowerCase()}${n.className ? '.' + String(n.className).split(' ')[0] : ''}=${v}`);
        n = n.parentElement;
      }
      out[k] = chain;
    }
    return out;
  }, SELECTOR);
  console.log('\n=== token resolution chain (nearest first) ===');
  for (const [k, chain] of Object.entries(tokens)) console.log(`  ${k}: ${chain.join('  <-  ') || '(undefined)'}`);

  await browser.close();
})();
