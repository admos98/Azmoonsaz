# Azmoonsaz UI maintenance guide

## Core rule

Components must describe **meaning**, not a literal light-theme color. Use semantic CSS variables from `src/index.css`; do not add `bg-white`, `text-black`, gray/slate utilities, or literal neutral borders to TS/TSX UI. `npm run check:theme` enforces this boundary.

## Theme architecture

- `index.html` resolves the stored `light | dark | system` preference before first paint.
- `ThemeProvider` owns runtime preference changes and live system-theme updates.
- `MotionProvider` owns `system | reduced | full`; the OS reduced-motion request remains a safety ceiling.
- `data-theme="light|dark"` and `data-motion="reduce|full"` are the resolved selectors.
- Components do not branch on appearance preferences. They consume semantic tokens and global motion policy.
- Permanent dark brand surfaces use `--color-text-on-dark` and `--color-on-dark-*`; they are not theme surfaces.

## Token channels

### Surfaces

- `--color-page-bg` / `--color-paper-warm`: application canvas
- `--color-surface`: opaque card, menu, or table header
- `--color-surface-secondary`: hover and nested neutral surface
- `--color-glass-light-fill`: subtle translucent surface
- `--color-glass-panel-fill`: stronger translucent content panel
- `--color-glass-light-stroke`: standard hairline

### Text

- `--color-text-primary`: headings and primary content
- `--color-text-secondary`: normal supporting copy
- `--color-text-tertiary`: metadata; do not use for tiny critical text
- `--color-text-on-solid`: content on filled semantic controls
- `--color-text-on-dark`: content on permanently dark brand surfaces

### Semantic colors

Each status has three distinct jobs:

- `--color-*-soft`: subtle status background
- `--color-*`: status text/icon/border
- `--color-*-solid`: filled button or selected control

Do not use the text channel as a filled background. Dark mode intentionally gives these channels different values to retain contrast.

### Filled accent controls

Use `--color-accent-solid` and `--color-accent-solid-hover` for filled controls. Use `--color-accent` for icons/text and `--color-accent-soft` for subtle backgrounds.

## Component rules

- Prefer shared `Button`, `Card`, `Badge`, `Input`, modal, and feedback primitives.
- A nested surface should normally use a radius one step smaller than its parent.
- Do not stack strong glass surfaces; use one elevated parent and subtle/opaque children.
- Every icon-only button needs an accessible name.
- Every asynchronous mutation needs disabled/loading, specific success, and recoverable error behavior.
- Preserve popup trigger-origin and veil/halo layers when changing dialogs.

## Verification

For every visual unit run:

```bash
npm run typecheck
npm run check:theme
npm run lint
npm test -- --run
npm run build
npm run check:bundle
```

Manual acceptance requires light, dark, and system modes at 320, 375, 768, 1024, and 1440 px, plus keyboard-only and reduced-motion review.
